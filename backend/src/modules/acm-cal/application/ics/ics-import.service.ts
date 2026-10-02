import { normalizeCalCategory } from '../cal-category';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../../acm-common/datasource';
import { expandSource, IcsSourceInput, splitCalendar } from './ics-parser';

interface SourceRow {
  cis_id: string;
  ent_id: string;
  calendar_key: string;
  calendar_name: string;
  source_uid: string;
  source_hash: string;
  ical_text: string;
  is_unbounded: boolean;
  owner_user_id: string;
  assignee_tch_id: string | null;
  category: string;
  generated_until: Date | null;
  stopped_at: Date | null;
}
export interface IcsFile {
  key: string;
  text: string;
}
@Injectable()
export class IcsImportService {
  private readonly logger = new Logger(IcsImportService.name);
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  private horizon() {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
  }
  private input(s: SourceRow): IcsSourceInput {
    return {
      calendarKey: s.calendar_key,
      calendarName: s.calendar_name,
      uid: s.source_uid,
      hash: s.source_hash,
      text: s.ical_text,
      unbounded: s.is_unbounded,
    };
  }
  private async lock(em: EntityManager, entId: string) {
    await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `cal-ics:${entId}`,
    ]);
  }
  private async generate(
    em: EntityManager,
    s: SourceRow,
    until: Date,
    checkExisting = false,
  ) {
    const occurrences = expandSource(this.input(s), until);
    const known: { occurrence_key: string }[] = await em.query(
      'SELECT occurrence_key FROM amb_acm_cal_ics_occurrence WHERE ent_id=$1 AND cis_id=$2',
      [s.ent_id, s.cis_id],
    );
    const keys = new Set(known.map((r) => r.occurrence_key));
    let created = 0,
      matched = 0;
    for (const o of occurrences) {
      if (
        keys.has(o.key) ||
        (s.stopped_at && new Date(o.start) >= new Date(s.stopped_at))
      )
        continue;
      if (checkExisting) {
        const existing: { evt_id: string }[] = await em.query(
          `SELECT e.evt_id FROM amb_acm_cal_event e WHERE e.ent_id=$1 AND e.deleted_at IS NULL AND e.evt_title=$2 AND e.evt_start_at=$3 AND e.evt_end_at=$4 AND e.evt_assignee_tch_id IS NOT DISTINCT FROM $5::uuid AND NOT EXISTS(SELECT 1 FROM amb_acm_cal_ics_occurrence o WHERE o.evt_id=e.evt_id)`,
          [s.ent_id, o.title, o.start, o.end, s.assignee_tch_id],
        );
        // Never claim a hand-created event automatically: review before importing.
        if (existing.length) {
          matched++;
          continue;
        }
      }
      const description = [
        o.description,
        `[ICS 원본] ${s.calendar_name}`,
        `시간대·반복 규칙은 가져오기 원본에 보존됩니다.`,
      ]
        .filter(Boolean)
        .join('\n\n');
      const rows: { evt_id: string }[] = await em.query(
        `INSERT INTO amb_acm_cal_event(ent_id,evt_owner_user_id,evt_category,evt_title,evt_description,evt_start_at,evt_end_at,evt_all_day,evt_location_text,evt_meeting_provider,evt_meeting_url,evt_assignee_tch_id,evt_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'MANUAL') RETURNING evt_id`,
        [
          s.ent_id,
          s.owner_user_id,
          normalizeCalCategory(s.category),
          o.title,
          description,
          o.start,
          o.end,
          o.allDay,
          o.location || null,
          o.meetingProvider,
          o.meetingUrl,
          s.assignee_tch_id,
        ],
      );
      await em.query(
        'INSERT INTO amb_acm_cal_ics_occurrence(ent_id,cis_id,occurrence_key,evt_id) VALUES($1,$2,$3,$4)',
        [s.ent_id, s.cis_id, o.key, rows[0].evt_id],
      );
      created++;
    }
    if (matched)
      throw new Error(
        `Existing calendar conflict: ${s.calendar_name}, ${matched} occurrence(s). No changes committed.`,
      );
    await em.query(
      'UPDATE amb_acm_cal_ics_source SET generated_until=GREATEST(generated_until,$2::timestamptz),updated_at=now() WHERE cis_id=$1',
      [s.cis_id, until],
    );
    return { created, occurrences: occurrences.length };
  }
  async import(
    files: IcsFile[],
    email: string,
    name: string,
    batchId: string,
    apply = false,
  ) {
    const sources = files.flatMap((f) => splitCalendar(f.text, f.key));
    const runner = this.ds.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const em = runner.manager;
      const owners: { usr_id: string; ent_id: string }[] = await em.query(
        "SELECT usr_id,ent_id FROM amb_acm_user WHERE lower(usr_email)=lower($1) AND usr_status='ACTIVE'",
        [email],
      );
      if (owners.length !== 1)
        throw new Error('Owner account missing or ambiguous');
      const owner = owners[0];
      await this.lock(em, owner.ent_id);
      const teachers: { tch_id: string; tch_name: string }[] = await em.query(
        'SELECT tch_id,tch_name FROM amb_acm_tch_teacher WHERE ent_id=$1 AND deleted_at IS NULL',
        [owner.ent_id],
      );
      const stats = {
        batchId,
        apply,
        files: files.length,
        sources: sources.length,
        created: 0,
        alreadyImported: 0,
        unbounded: 0,
        unmatchedTeachers: [] as string[],
        calendars: {} as Record<string, number>,
      };
      const until = this.horizon();
      for (const source of sources) {
        const teacherName = source.calendarName.endsWith(' 선생님')
          ? source.calendarName.replace(/ 선생님$/, '')
          : null;
        const matches = teachers.filter(
          (t) => t.tch_name.trim() === teacherName,
        );
        if (matches.length > 1) throw new Error('Ambiguous teacher');
        if (
          teacherName &&
          !matches.length &&
          !stats.unmatchedTeachers.includes(teacherName)
        )
          stats.unmatchedTeachers.push(teacherName);
        const old: SourceRow[] = await em.query(
          'SELECT * FROM amb_acm_cal_ics_source WHERE ent_id=$1 AND calendar_key=$2 AND source_uid=$3',
          [owner.ent_id, source.calendarKey, source.uid],
        );
        if (old.length) {
          if (old[0].source_hash !== source.hash)
            throw new Error(
              'Previously imported source changed; explicit reconciliation required',
            );
          stats.alreadyImported++;
          continue;
        }
        const rows: SourceRow[] = await em.query(
          `INSERT INTO amb_acm_cal_ics_source(ent_id,batch_id,calendar_key,calendar_name,source_uid,source_hash,ical_text,owner_user_id,assignee_tch_id,category,is_unbounded) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            owner.ent_id,
            batchId,
            source.calendarKey,
            source.calendarName,
            source.uid,
            source.hash,
            source.text,
            owner.usr_id,
            matches[0]?.tch_id ?? null,
            teacherName
              ? 'REGULAR_CLASS'
              : source.calendarName.includes('맵테스트')
                ? 'LEVEL_TEST'
                : 'OTHER',
            source.unbounded,
          ],
        );
        const result = await this.generate(em, rows[0], until, true);
        stats.created += result.created;
        stats.unbounded += Number(source.unbounded);
        stats.calendars[source.calendarName] =
          (stats.calendars[source.calendarName] ?? 0) + result.created;
      }
      await em.query(
        'UPDATE amb_acm_user SET usr_name=$2,updated_at=now() WHERE usr_id=$1',
        [owner.usr_id, name],
      );
      if (apply) await runner.commitTransaction();
      else await runner.rollbackTransaction();
      return stats;
    } catch (e) {
      await runner.rollbackTransaction();
      throw e;
    } finally {
      await runner.release();
    }
  }
  async ensureRange(entId: string, to: Date) {
    const pending: { cis_id: string }[] = await this.ds.query(
      'SELECT cis_id FROM amb_acm_cal_ics_source WHERE ent_id=$1 AND is_unbounded AND stopped_at IS NULL AND (generated_until IS NULL OR generated_until<$2) LIMIT 1',
      [entId, to],
    );
    if (!pending.length) return;
    await this.ds.transaction(async (em) => {
      await this.lock(em, entId);
      const rows: SourceRow[] = await em.query(
        'SELECT * FROM amb_acm_cal_ics_source WHERE ent_id=$1 AND is_unbounded AND stopped_at IS NULL AND (generated_until IS NULL OR generated_until<$2)',
        [entId, to],
      );
      for (const row of rows) await this.generate(em, row, to);
    });
  }
  @Cron('0 15 2 * * *', { timeZone: 'Asia/Seoul' })
  async extend() {
    const rows: { ent_id: string }[] = await this.ds.query(
      'SELECT DISTINCT ent_id FROM amb_acm_cal_ics_source WHERE is_unbounded AND stopped_at IS NULL',
    );
    for (const r of rows)
      try {
        await this.ensureRange(r.ent_id, this.horizon());
      } catch {
        this.logger.error(`ICS extension failed for tenant ${r.ent_id}`);
      }
  }
  async metadata(entId: string, eventId: string) {
    const rows: {
      calendarName: string;
      unbounded: boolean;
      stoppedAt: string | null;
      ical_text: string;
    }[] = await this.ds.query(
      `SELECT s.calendar_name AS "calendarName",s.is_unbounded AS unbounded,s.stopped_at AS "stoppedAt",s.ical_text FROM amb_acm_cal_ics_source s JOIN amb_acm_cal_ics_occurrence o ON o.cis_id=s.cis_id AND o.ent_id=s.ent_id WHERE o.ent_id=$1 AND o.evt_id=$2`,
      [entId, eventId],
    );
    if (!rows.length) return null;
    const { ical_text, ...data } = rows[0];
    return {
      ...data,
      rules: ical_text.split(/\r?\n/).filter((l) => l.startsWith('RRULE:')),
      timezone: ical_text.match(/X-WR-TIMEZONE:(.*)/)?.[1]?.trim() ?? null,
    };
  }
  async stop(entId: string, eventId: string, actor: string, at: string) {
    const cutoff = new Date(at);
    if (!Number.isFinite(cutoff.getTime()))
      throw new BadRequestException('Invalid cutoff');
    return this.ds.transaction(async (em) => {
      await this.lock(em, entId);
      const rows: SourceRow[] = await em.query(
        'SELECT s.* FROM amb_acm_cal_ics_source s JOIN amb_acm_cal_ics_occurrence o ON o.cis_id=s.cis_id AND o.ent_id=s.ent_id WHERE o.ent_id=$1 AND o.evt_id=$2',
        [entId, eventId],
      );
      if (!rows.length) throw new NotFoundException();
      const row = rows[0];
      if (row.stopped_at) throw new BadRequestException('Already stopped');
      await em.query(
        'UPDATE amb_acm_cal_ics_source SET stopped_at=$2,stopped_by=$3,updated_at=now() WHERE cis_id=$1',
        [row.cis_id, cutoff, actor],
      );
      const changed: { evt_id: string }[] = await em.query(
        `UPDATE amb_acm_cal_event e SET deleted_at=now(),evt_deleted_by=$3,evt_delete_reason='ICS 반복 종료',updated_at=now() FROM amb_acm_cal_ics_occurrence o WHERE o.ent_id=$1 AND o.cis_id=$2 AND o.evt_id=e.evt_id AND e.ent_id=$1 AND e.evt_start_at >= $4 AND e.deleted_at IS NULL RETURNING e.evt_id`,
        [entId, row.cis_id, actor, cutoff],
      );
      return { stoppedAt: cutoff.toISOString(), removed: changed.length };
    });
  }
}
