import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  matchStudents,
  type LinkState,
  type StudentCandidate,
} from './student-link-rules';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_APPLY_EVENTS = 500;

export interface StudentLinkGroup {
  title: string;
  eventIds: string[];
  count: number;
  from: string;
  to: string;
  assignees: string[];
  recurring: boolean;
  candidates: StudentCandidate[];
  state: LinkState;
}

/**
 * REQ-261023B — link students to class events whose title names them. Preview never writes;
 * apply adds STUDENT invitees (no mail), revisions, and series changes for auto-extension.
 */
@Injectable()
export class StudentLinkService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async preview(
    entId: string,
    q: {
      from: string;
      to: string;
      category?: string;
      includeWithdrawn?: boolean;
    },
  ) {
    if (!ISO.test(q.from) || !ISO.test(q.to) || q.from > q.to)
      throw new BadRequestException('from/to must be YYYY-MM-DD and from ≤ to');
    if ((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 > 400)
      throw new BadRequestException('Range must be at most 400 days');
    const category = q.category?.trim() || 'REGULAR_CLASS';
    const events = await this.ds.query<
      {
        id: string;
        title: string;
        startAt: string;
        teacher: string | null;
        recurring: boolean;
      }[]
    >(
      `SELECT e.evt_id id, e.evt_title title, e.evt_start_at::text "startAt", t.tch_name teacher,
              EXISTS (SELECT 1 FROM amb_acm_cal_recurrence_occurrence o WHERE o.evt_id=e.evt_id) recurring
         FROM amb_acm_cal_event e
         LEFT JOIN amb_acm_tch_teacher t ON t.tch_id=e.evt_assignee_tch_id AND t.ent_id=e.ent_id
        WHERE e.ent_id=$1 AND e.deleted_at IS NULL AND e.evt_category=$4
          AND e.evt_start_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Seoul')
          AND e.evt_start_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')
          AND NOT EXISTS (SELECT 1 FROM amb_acm_cal_invitee i WHERE i.evt_id=e.evt_id AND i.inv_kind='STUDENT')
        ORDER BY e.evt_start_at`,
      [entId, q.from, q.to, category],
    );
    const students = await this.students(entId, q.includeWithdrawn === true);
    const byTitle = new Map<string, typeof events>();
    for (const e of events)
      byTitle.set(e.title, [...(byTitle.get(e.title) ?? []), e]);
    const groups: StudentLinkGroup[] = [...byTitle.entries()].map(
      ([title, list]) => {
        const m = matchStudents(title, students);
        return {
          title,
          eventIds: list.map((e) => e.id),
          count: list.length,
          from: list[0].startAt,
          to: list[list.length - 1].startAt,
          assignees: [
            ...new Set(
              list.map((e) => e.teacher).filter((x): x is string => !!x),
            ),
          ],
          recurring: list.some((e) => e.recurring),
          candidates: m.candidates,
          state: m.state,
        };
      },
    );
    const order: Record<LinkState, number> = { SURE: 0, MULTI: 1, NONE: 2 };
    groups.sort(
      (a, b) =>
        order[a.state] - order[b.state] ||
        b.count - a.count ||
        a.title.localeCompare(b.title, 'ko'),
    );
    const sum = (s: LinkState) =>
      groups.filter((g) => g.state === s).reduce((n, g) => n + g.count, 0);
    return {
      summary: {
        events: events.length,
        groups: groups.length,
        sure: sum('SURE'),
        multi: sum('MULTI'),
        none: sum('NONE'),
      },
      groups,
    };
  }

  private async students(entId: string, includeWithdrawn: boolean) {
    return this.ds.query<{ stdId: string; name: string; status: string }[]>(
      `SELECT std_id::text "stdId", std_name name, std_status status FROM amb_acm_std_student
        WHERE ent_id=$1 AND deleted_at IS NULL ${includeWithdrawn ? '' : "AND std_status <> 'WITHDRAWN'"}`,
      [entId],
    );
  }

  async apply(
    entId: string,
    actorUserId: string,
    items: { title: string; eventIds: string[]; stdIds: string[] }[],
  ) {
    const eventIds = [...new Set(items.flatMap((i) => i.eventIds))];
    const stdIds = [...new Set(items.flatMap((i) => i.stdIds))];
    if (!eventIds.length || !stdIds.length)
      throw new BadRequestException('NOTHING_TO_LINK');
    if (eventIds.length > MAX_APPLY_EVENTS)
      throw new BadRequestException(
        `At most ${MAX_APPLY_EVENTS} events per request`,
      );
    return this.ds.transaction(async (m) => {
      const evts = await m.query<{ id: string; title: string }[]>(
        `SELECT evt_id::text id, evt_title title FROM amb_acm_cal_event
          WHERE ent_id=$1 AND evt_id = ANY($2::uuid[]) AND deleted_at IS NULL FOR UPDATE`,
        [entId, eventIds],
      );
      const titleOf = new Map(evts.map((e) => [e.id, e.title]));
      const stds = await m.query<{ id: string; name: string }[]>(
        `SELECT std_id::text id, std_name name FROM amb_acm_std_student WHERE ent_id=$1 AND std_id = ANY($2::uuid[]) AND deleted_at IS NULL`,
        [entId, stdIds],
      );
      const nameOf = new Map(stds.map((s) => [s.id, s.name]));
      for (const it of items) {
        if (it.eventIds.some((id) => titleOf.get(id) !== it.title))
          throw new BadRequestException('EVENT_TITLE_MISMATCH');
        if (it.stdIds.some((id) => !nameOf.has(id)))
          throw new BadRequestException('STUDENT_NOT_FOUND');
      }
      let added = 0;
      let skipped = 0;
      const linkedEvents = new Set<string>();
      for (const it of items)
        for (const evtId of it.eventIds) {
          const inserted: string[] = [];
          for (const stdId of it.stdIds) {
            const res = await m.query<{ id: string }[]>(
              `INSERT INTO amb_acm_cal_invitee (ent_id, evt_id, inv_kind, inv_ref_id) VALUES ($1,$2,'STUDENT',$3)
               ON CONFLICT DO NOTHING RETURNING inv_id id`,
              [entId, evtId, stdId],
            );
            if (res.length) inserted.push(nameOf.get(stdId)!);
            else skipped++;
          }
          if (!inserted.length) continue;
          added += inserted.length;
          linkedEvents.add(evtId);
          await m.query(
            `INSERT INTO amb_acm_cal_event_revision (ent_id, evt_id, rev_editor_user_id, rev_reason, rev_changes)
             VALUES ($1,$2,$3,'제목 기반 학생 연결',$4::jsonb)`,
            [
              entId,
              evtId,
              actorUserId,
              JSON.stringify([
                {
                  field: 'invitees',
                  before: null,
                  after: `STUDENT: ${inserted.join(', ')}`,
                },
              ]),
            ],
          );
        }
      // Recurring: from the earliest linked occurrence on, auto-extended occurrences carry the invitees.
      const series = await m.query<
        { crsId: string; key: Date; evtId: string }[]
      >(
        `SELECT DISTINCT ON (crs_id) crs_id "crsId", cro_key key, evt_id::text "evtId"
           FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND evt_id = ANY($2::uuid[])
          ORDER BY crs_id, cro_key`,
        [entId, [...linkedEvents]],
      );
      for (const s of series) {
        const inv = await m.query<{ kind: string; refId: string }[]>(
          `SELECT inv_kind kind, inv_ref_id::text "refId" FROM amb_acm_cal_invitee WHERE ent_id=$1 AND evt_id=$2 ORDER BY created_at, inv_id`,
          [entId, s.evtId],
        );
        await m.query(
          `UPDATE amb_acm_cal_recurrence_series
              SET crs_changes = crs_changes || $3::jsonb, crs_version = crs_version + 1, updated_at = now()
            WHERE ent_id=$1 AND crs_id=$2`,
          [
            entId,
            s.crsId,
            JSON.stringify([
              {
                from: new Date(s.key).toISOString(),
                patch: { evtInvitees: inv },
                startShift: 0,
                endShift: 0,
              },
            ]),
          ],
        );
      }
      const [portal] = await m.query<{ students: number; parents: number }[]>(
        `SELECT
           (SELECT count(*) FROM unnest($2::uuid[]) sid
             WHERE NOT EXISTS (SELECT 1 FROM amb_acm_portal_account a WHERE a.ent_id=$1 AND a.pac_kind='STUDENT' AND a.pac_ref_id=sid AND a.pac_status='ACTIVE'))::int students,
           (SELECT count(DISTINCT sp.par_id) FROM amb_acm_std_student_parent sp
             WHERE sp.ent_id=$1 AND sp.std_id = ANY($2::uuid[])
               AND NOT EXISTS (SELECT 1 FROM amb_acm_portal_account a WHERE a.ent_id=$1 AND a.pac_kind='PARENT' AND a.pac_ref_id=sp.par_id AND a.pac_status='ACTIVE'))::int parents`,
        [entId, stdIds],
      );
      return {
        linkedEvents: linkedEvents.size,
        addedInvitees: added,
        skippedExisting: skipped,
        seriesUpdated: series.length,
        studentsWithoutPortal: portal.students,
        parentsWithoutPortal: portal.parents,
      };
    });
  }
}
