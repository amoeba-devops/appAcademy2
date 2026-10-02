import { normalizeCalCategory } from './cal-category';
import { enqueueInbox } from '../../acm-notification/application/inbox-outbox';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import ICAL from 'ical.js';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import { CalEventService } from './cal-event.service';
import { VideoConfigService } from './video-config.service';
import { BodaRoomService } from './boda-room.service';
import { InviteeNotifierService } from './invitee-notifier.service';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { CalEventRevisionTypeormEntity } from '../infrastructure/typeorm/cal-event-revision.typeorm-entity';
import type { CreateCalEventDto } from './dto/cal-event.dto';
import type {
  ChangeRecurrenceDto,
  CreateRecurrenceDto,
  RecurrencePreviewDto,
  RecurrenceRuleDto,
} from './dto/recurrence.dto';
import {
  expandRecurrence,
  generationHorizon,
  recurrenceRule,
  wallTime,
} from './recurrence-calculator';
import { instant } from './ics/ics-parser';
interface SeriesChange {
  from: string | null;
  patch: Partial<CreateCalEventDto>;
  startShift: number;
  endShift: number;
}
interface Series {
  crs_id: string;
  ent_id: string;
  crs_owner_user_id: string;
  crs_template: CreateCalEventDto;
  crs_rule: RecurrenceRuleDto;
  crs_timezone: string;
  crs_version: number;
  crs_generated_until: Date | null;
  crs_stop_at: Date | null;
  crs_start_before?: Date | null;
  crs_changes: SeriesChange[];
  crs_request_hash: string;
}
interface Occurrence {
  evt_id: string;
  cro_key: Date;
  cro_is_exception: boolean;
}
@Injectable()
export class RecurrenceService {
  private readonly log = new Logger(RecurrenceService.name);
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly events: CalEventService,
    private readonly video: VideoConfigService,
    private readonly tz: TenantSettingsService,
    private readonly rooms: BodaRoomService,
    private readonly notifier: InviteeNotifierService,
  ) {}
  async preview(entId: string, dto: RecurrencePreviewDto) {
    const timezone = await this.tz.getTimezone(entId);
    // A preview searches far enough for five yearly-spaced monthly occurrences.
    const horizon = new Date(dto.event.evtStartAt);
    horizon.setUTCFullYear(horizon.getUTCFullYear() + 150);
    const items = expandRecurrence(
      dto.event.evtStartAt,
      dto.event.evtEndAt,
      timezone,
      dto.rule,
      horizon,
      5,
    );
    if (!items.length) throw new BadRequestException('REPEAT_EMPTY');
    return { timezone, items, rule: dto.rule };
  }
  private authorize(s: Series, u: AcmCurrentUser) {
    if (u.role !== 'ADMIN' && s.crs_owner_user_id !== u.id)
      throw new ForbiddenException('NOT_OWNER');
  }
  async create(u: AcmCurrentUser, dto: CreateRecurrenceDto) {
    const preview = await this.preview(u.entId, dto);
    const hash = createHash('sha256')
      .update(JSON.stringify({ event: dto.event, rule: dto.rule }))
      .digest('hex');
    const result = await this.video.withLock(u.entId, () =>
      this.ds.transaction(async (m) => {
        await this.lock(m, u.entId);
        const existing: Series[] = await m.query(
          'SELECT * FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 AND crs_request_id=$2',
          [u.entId, dto.requestId],
        );
        if (existing.length) {
          this.authorize(existing[0], u);
          if (existing[0].crs_request_hash !== hash)
            throw new ConflictException('REPEAT_REQUEST_CHANGED');
          return { series: existing[0], created: 0 };
        }
        const event = { ...dto.event };
        await this.events.prepareCreate(
          u.entId,
          u.id,
          u.role ?? 'STAFF',
          event,
        );
        await this.validateReferences(m, u.entId, event);
        const timezone = await this.tz.getTimezone(u.entId);
        const [series]: Series[] = await m.query(
          'INSERT INTO amb_acm_cal_recurrence_series(ent_id,crs_owner_user_id,crs_request_id,crs_request_hash,crs_template,crs_rule,crs_timezone) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [
            u.entId,
            event.evtOwnerUserId ?? u.id,
            dto.requestId,
            hash,
            event,
            dto.rule,
            timezone,
          ],
        );
        const created = await this.generate(
          m,
          series,
          generationHorizon(preview.items[0].start),
        );
        const [first]: { evt_id: string }[] = await m.query(
          'SELECT evt_id FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND crs_id=$2 ORDER BY cro_key LIMIT 1',
          [u.entId, series.crs_id],
        );
        if (first)
          await enqueueInbox(m, {
            entId: u.entId,
            actorId: u.id,
            type: 'CAL_CREATED',
            targetId: first.evt_id,
            assigneeIds: [event.evtAssigneeTchId],
            payload: { title: event.evtTitle, count: created },
          });
        return { series, created };
      }),
    );
    const notifySummary = await this.notifyOnce(result.series);
    return { id: result.series.crs_id, created: result.created, notifySummary };
  }
  private async lock(m: EntityManager, entId: string) {
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `cal-repeat:${entId}`,
    ]);
  }
  private async validateReferences(
    m: EntityManager,
    entId: string,
    dto: CreateCalEventDto,
  ) {
    if (dto.evtOwnerUserId) {
      const a = await m.query<{ usr_id: string }[]>(
        'SELECT usr_id FROM amb_acm_user WHERE ent_id=$1 AND usr_id=$2',
        [entId, dto.evtOwnerUserId],
      );
      if (!a.length) throw new BadRequestException('INVALID_OWNER');
    }
    if (dto.evtClsId)
      throw new BadRequestException('REPEAT_CLASS_LINK_NOT_SUPPORTED');
  }
  private shift(iso: string, ms: number, tz: string) {
    return instant(
      ICAL.Time.fromString(
        new Date(+new Date(wallTime(iso, tz) + 'Z') + ms)
          .toISOString()
          .slice(0, 19),
        undefined,
      ),
      tz,
    );
  }
  private transform(
    dto: CreateCalEventDto,
    c: SeriesChange,
    tz: string,
  ): CreateCalEventDto {
    return {
      ...dto,
      ...c.patch,
      evtStartAt: this.shift(dto.evtStartAt, c.startShift, tz),
      evtEndAt: this.shift(dto.evtEndAt, c.endShift, tz),
    };
  }
  private async persist(
    m: EntityManager,
    s: Series,
    dto: CreateCalEventDto,
    id?: string,
  ) {
    const base = await this.events.prepareCreate(
      s.ent_id,
      s.crs_owner_user_id,
      'ADMIN',
      { ...dto, evtOwnerUserId: s.crs_owner_user_id },
    );
    const repo = m.getRepository(CalEventTypeormEntity);
    const event = await repo.save({
      ...base,
      ...(id ? { id } : {}),
      updatedAt: new Date(),
    });
    if (event.meetingProvider === 'BODASCHOOL') {
      const { launcherUrl } = await this.rooms.createPending(
        { evtId: event.id, entId: s.ent_id, roomType: event.bodaRoomType },
        m,
      );
      await repo.update(
        { id: event.id, entId: s.ent_id },
        { meetingUrl: launcherUrl },
      );
      event.meetingUrl = launcherUrl;
    } else if (id) {
      await m.query(
        "DELETE FROM amb_acm_cal_boda_room WHERE ent_id=$1 AND evt_id=$2 AND bdr_status='PENDING'",
        [s.ent_id, id],
      );
    }
    const inv = m.getRepository(CalInviteeTypeormEntity);
    const existing = id ? await inv.findBy({ entId: s.ent_id, evtId: id }) : [];
    const inputs = dto.evtInvitees ?? [];
    for (const old of existing)
      if (!inputs.some((i) => i.kind === old.kind && i.refId === old.refId))
        await inv.delete({ id: old.id, entId: s.ent_id });
    const added = inputs.filter(
      (i) =>
        !existing.some((old) => i.kind === old.kind && i.refId === old.refId),
    );
    if (added.length)
      await inv.save(
        added.map((i) =>
          inv.create({
            entId: s.ent_id,
            evtId: event.id,
            kind: i.kind,
            refId: i.refId,
          }),
        ),
      );
    return event;
  }
  private async generate(m: EntityManager, s: Series, horizon: Date) {
    const rows: Occurrence[] = await m.query(
      'SELECT evt_id,cro_key,cro_is_exception FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND crs_id=$2',
      [s.ent_id, s.crs_id],
    );
    const known = new Set(rows.map((r) => new Date(r.cro_key).toISOString()));
    // A negative local-time shift can pull a later base occurrence into this query range.
    const lookAhead = s.crs_changes.reduce(
      (ms, c) => ms + Math.max(0, -c.startShift),
      0,
    );
    const displayHorizon =
      s.crs_start_before && s.crs_start_before < horizon
        ? s.crs_start_before
        : horizon;
    const expandedHorizon = new Date(+displayHorizon + lookAhead);
    const until =
      s.crs_stop_at && s.crs_stop_at < expandedHorizon
        ? s.crs_stop_at
        : expandedHorizon;
    const occurrences = expandRecurrence(
      s.crs_template.evtStartAt,
      s.crs_template.evtEndAt,
      s.crs_timezone,
      s.crs_rule,
      until,
    );
    let created = 0;
    for (const o of occurrences) {
      if (known.has(o.key)) continue;
      let dto = { ...s.crs_template, evtStartAt: o.start, evtEndAt: o.end };
      for (const c of s.crs_changes)
        if (!c.from || o.key >= c.from)
          dto = this.transform(dto, c, s.crs_timezone);
      if (s.crs_start_before && new Date(dto.evtStartAt) >= s.crs_start_before)
        continue;
      dto.evtCategory = normalizeCalCategory(
        dto.evtCategory ?? 'REGULAR_CLASS',
      );
      const event = await this.persist(m, s, dto);
      await m.query(
        'INSERT INTO amb_acm_cal_recurrence_occurrence(ent_id,crs_id,cro_key,evt_id) VALUES($1,$2,$3,$4)',
        [s.ent_id, s.crs_id, o.key, event.id],
      );
      created++;
    }
    await m.query(
      'UPDATE amb_acm_cal_recurrence_series SET crs_generated_until=$3,updated_at=now() WHERE ent_id=$1 AND crs_id=$2',
      [s.ent_id, s.crs_id, horizon],
    );
    return created;
  }
  private async notifyOnce(s: Series) {
    // Claim before delivery: retries never duplicate external email. Failed deliveries remain visible on invitees.
    const claimed = await this.ds.query<{ crs_id: string }[]>(
      'WITH claimed AS (UPDATE amb_acm_cal_recurrence_series SET crs_notify_claimed=true WHERE ent_id=$1 AND crs_id=$2 AND NOT crs_notify_claimed RETURNING crs_id) SELECT crs_id FROM claimed',
      [s.ent_id, s.crs_id],
    );
    if (!claimed.length) return null;
    const [row]: Occurrence[] = await this.ds.query(
      'SELECT evt_id FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND crs_id=$2 ORDER BY cro_key LIMIT 1',
      [s.ent_id, s.crs_id],
    );
    if (!row) return null;
    const event = await this.ds
      .getRepository(CalEventTypeormEntity)
      .findOneByOrFail({ entId: s.ent_id, id: row.evt_id });
    const invitees = await this.ds
      .getRepository(CalInviteeTypeormEntity)
      .findBy({ entId: s.ent_id, evtId: event.id });
    event.title = `${event.title} (반복 일정)`;
    const summary =
      s.crs_rule.kind === 'DATES'
        ? s.crs_rule.dates?.join(', ')
        : `${recurrenceRule(s.crs_rule)} / ${s.crs_rule.end}${s.crs_rule.until ? ' ' + s.crs_rule.until : ''}${s.crs_rule.count ? ' ' + s.crs_rule.count + '회' : ''}`;
    return this.notifier.notifyAdded(
      s.ent_id,
      event,
      invitees,
      `반복: ${summary}\n시간대: ${s.crs_timezone}\n이후 회차는 캘린더에서 확인하세요.`,
    );
  }
  async generationStatus(u: AcmCurrentUser) {
    return this.ds.query<{ id: string; title: string; error: string }[]>(
      "SELECT crs_id AS id,crs_template->>'evtTitle' AS title,crs_error AS error FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 AND crs_error IS NOT NULL AND ($2::boolean OR crs_owner_user_id=$3)",
      [u.entId, u.role === 'ADMIN', u.id],
    );
  }
  async ensureRange(entId: string, to: Date) {
    if (!Number.isFinite(+to)) throw new BadRequestException('INVALID_RANGE');
    const ids: { crs_id: string }[] = await this.ds.query(
      'SELECT crs_id FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 AND (crs_generated_until IS NULL OR crs_generated_until<$2) AND (crs_stop_at IS NULL OR crs_generated_until<crs_stop_at) AND (crs_start_before IS NULL OR crs_generated_until IS NULL OR crs_generated_until<crs_start_before)',
      [entId, to],
    );
    for (const row of ids) {
      try {
        await this.video.withLock(entId, () =>
          this.ds.transaction(async (m) => {
            await this.lock(m, entId);
            const [s]: Series[] = await m.query(
              'SELECT * FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 AND crs_id=$2',
              [entId, row.crs_id],
            );
            if (s.crs_generated_until && s.crs_generated_until >= to) return;
            await this.generate(m, s, to);
            await m.query(
              'UPDATE amb_acm_cal_recurrence_series SET crs_error=NULL WHERE ent_id=$1 AND crs_id=$2',
              [entId, s.crs_id],
            );
          }),
        );
      } catch (error) {
        this.log.error(
          `Repeat extension failed series=${row.crs_id}`,
          error instanceof Error ? error.message : 'unknown',
        );
        await this.ds.query(
          'UPDATE amb_acm_cal_recurrence_series SET crs_error=$3 WHERE ent_id=$1 AND crs_id=$2',
          [
            entId,
            row.crs_id,
            error instanceof BadRequestException
              ? error.message
              : 'REPEAT_GENERATION_FAILED',
          ],
        );
      }
    }
  }
  @Cron('0 25 2 * * *', { timeZone: 'Asia/Seoul' })
  async extend() {
    const rows: { ent_id: string }[] = await this.ds.query(
      'SELECT DISTINCT ent_id FROM amb_acm_cal_recurrence_series',
    );
    for (const r of rows)
      try {
        await this.ensureRange(
          r.ent_id,
          generationHorizon(new Date().toISOString()),
        );
      } catch (e) {
        this.log.error(
          `Repeat extension failed tenant=${r.ent_id}`,
          e instanceof Error ? e.message : 'unknown',
        );
      }
  }
  private async source(m: EntityManager, entId: string, eventId: string) {
    const [s]: Series[] = await m.query(
      'SELECT s.* FROM amb_acm_cal_recurrence_series s JOIN amb_acm_cal_recurrence_occurrence o ON o.ent_id=s.ent_id AND o.crs_id=s.crs_id WHERE o.ent_id=$1 AND o.evt_id=$2',
      [entId, eventId],
    );
    return s;
  }
  async metadata(u: AcmCurrentUser, eventId: string) {
    await this.events.findOne(u.entId, u.id, u.role ?? 'STAFF', eventId);
    const s = await this.source(this.ds.manager, u.entId, eventId);
    if (!s) return null;
    const [o]: Occurrence[] = await this.ds.query(
      'SELECT * FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND evt_id=$2',
      [u.entId, eventId],
    );
    return {
      seriesId: s.crs_id,
      version: s.crs_version,
      rule: s.crs_rule,
      timezone: s.crs_timezone,
      stoppedAt: s.crs_start_before ?? s.crs_stop_at,
      key: o.cro_key,
    };
  }
  private async protected(m: EntityManager, entId: string, id: string) {
    const [r]: { protected: boolean }[] = await m.query(
      `SELECT (e.evt_start_at<now() OR e.evt_cls_id IS NOT NULL
   OR EXISTS(SELECT 1 FROM amb_acm_cal_event_review x WHERE x.ent_id=e.ent_id AND x.evt_id=e.evt_id)
   OR EXISTS(SELECT 1 FROM amb_acm_cal_event_attachment x WHERE x.ent_id=e.ent_id AND x.evt_id=e.evt_id AND x.deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM amb_acm_cal_boda_room x WHERE x.ent_id=e.ent_id AND x.evt_id=e.evt_id AND x.bdr_status<>'PENDING')
   OR EXISTS(SELECT 1 FROM amb_acm_csl_trial_class x WHERE x.ent_id=e.ent_id AND x.tcl_cal_event_id=e.evt_id)
   OR EXISTS(SELECT 1 FROM amb_acm_csl_map_test x WHERE x.ent_id=e.ent_id AND x.mpt_cal_event_id=e.evt_id)) AS protected
   FROM amb_acm_cal_event e WHERE e.ent_id=$1 AND e.evt_id=$2`,
      [entId, id],
    );
    return r?.protected ?? true;
  }
  async change(
    u: AcmCurrentUser,
    eventId: string,
    dto: ChangeRecurrenceDto,
    remove = false,
    preview = false,
  ) {
    const reason = dto.reason?.trim() || null;
    if (remove && (!reason || reason.length < 2 || reason.length > 500))
      throw new BadRequestException('DELETE_REASON_REQUIRED');
    return this.video.withLock(u.entId, () =>
      this.ds.transaction(async (m) => {
        await this.lock(m, u.entId);
        const s = await this.source(m, u.entId, eventId);
        if (!s) throw new NotFoundException('REPEAT_NOT_FOUND');
        this.authorize(s, u);
        if (s.crs_version !== dto.version)
          throw new ConflictException('REPEAT_VERSION_CHANGED');
        const repo = m.getRepository(CalEventTypeormEntity);
        const selected = await repo.findOneBy({ id: eventId, entId: u.entId });
        if (!selected || selected.deletedAt)
          throw new NotFoundException('EVENT_NOT_FOUND');
        const [sel]: Occurrence[] = await m.query(
          'SELECT * FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND evt_id=$2',
          [u.entId, eventId],
        );
        const rows: Occurrence[] = await m.query(
          'SELECT * FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND crs_id=$2 ORDER BY cro_key',
          [u.entId, s.crs_id],
        );
        const candidates = rows.filter((o) =>
          dto.scope === 'ONE'
            ? o.evt_id === eventId
            : dto.scope === 'ALL' || o.cro_key >= sel.cro_key,
        );
        const eligible: Occurrence[] = [];
        let protectedCount = 0;
        for (const o of candidates) {
          const e = await repo.findOneBy({ entId: u.entId, id: o.evt_id });
          if (!e || e.deletedAt) continue;
          if (
            (dto.scope !== 'ONE' && o.cro_is_exception) ||
            (await this.protected(m, u.entId, o.evt_id))
          )
            protectedCount++;
          else eligible.push(o);
        }
        if (preview)
          return { changed: eligible.length, protected: protectedCount };
        if (dto.scope === 'ONE' && !eligible.length)
          throw new ConflictException('REPEAT_HISTORY_PROTECTED');
        let change: SeriesChange | undefined;
        if (!remove) {
          if (!dto.event)
            throw new BadRequestException('REPEAT_EVENT_REQUIRED');
          const { evtStartAt, evtEndAt, evtEditReason, ...patch } = dto.event;
          if ((evtEditReason?.trim() || null) !== reason)
            throw new BadRequestException('REPEAT_REASON_MISMATCH');
          const delta = (v: string | undefined, old: Date) =>
            v
              ? +new Date(wallTime(v, s.crs_timezone) + 'Z') -
                +new Date(wallTime(old.toISOString(), s.crs_timezone) + 'Z')
              : 0;
          change = {
            from:
              dto.scope === 'ALL' ? null : new Date(sel.cro_key).toISOString(),
            patch: patch as Partial<CreateCalEventDto>,
            startShift: delta(evtStartAt, selected.startAt),
            endShift: delta(evtEndAt, selected.endAt),
          };
          // Validate the new template even when no generated occurrences are mutable.
          const check = this.transform(s.crs_template, change, s.crs_timezone);
          await this.events.prepareCreate(
            u.entId,
            s.crs_owner_user_id,
            'ADMIN',
            check,
          );
          await this.validateReferences(m, u.entId, check);
        }
        let actualChanges = 0;
        const assigneeIds = new Set<string>();
        let changedEventId = eventId;
        for (const o of eligible) {
          const old = await repo.findOneByOrFail({
            entId: u.entId,
            id: o.evt_id,
          });
          if (remove)
            await repo.update(
              { id: o.evt_id, entId: u.entId },
              {
                deletedAt: new Date(),
                deletedBy: u.id,
                deleteReason: reason,
              },
            );
          else {
            const inv = await m
              .getRepository(CalInviteeTypeormEntity)
              .findBy({ entId: u.entId, evtId: old.id });
            const input: CreateCalEventDto = {
              evtTitle: old.title,
              evtCategory: normalizeCalCategory(old.category),
              evtDescription: old.description ?? undefined,
              evtStartAt: old.startAt.toISOString(),
              evtEndAt: old.endAt.toISOString(),
              evtAllDay: old.allDay,
              evtLocationText: old.locationText ?? undefined,
              evtMeetingProvider: old.meetingProvider,
              evtMeetingUrl: old.meetingUrl ?? undefined,
              evtBodaRoomType: old.bodaRoomType,
              evtAssigneeTchId: old.assigneeTchId ?? undefined,
              evtInvitees: inv.map((i) => ({ kind: i.kind, refId: i.refId })),
            };
            const saved = await this.persist(
              m,
              s,
              this.transform(input, change!, s.crs_timezone),
              old.id,
            );
            const fields = [
              'title',
              'category',
              'description',
              'startAt',
              'endAt',
              'allDay',
              'locationText',
              'meetingProvider',
              'meetingUrl',
              'bodaRoomType',
              'assigneeTchId',
            ] as const;
            const changes = fields
              .filter((f) => String(old[f] ?? '') !== String(saved[f] ?? ''))
              .map((f) => ({
                field: f,
                before: old[f] == null ? null : String(old[f]),
                after: saved[f] == null ? null : String(saved[f]),
              }));
            const nextInvitees = dto.event?.evtInvitees;
            const inviteeKeys = (items: { kind: string; refId: string }[]) =>
              items
                .map((i) => i.kind + ':' + i.refId)
                .sort()
                .join(',');
            const inviteesChanged =
              nextInvitees !== undefined &&
              inviteeKeys(nextInvitees) !== inviteeKeys(inv);
            if (changes.length || inviteesChanged) {
              actualChanges++;
              changedEventId = saved.id;
              if (old.assigneeTchId) assigneeIds.add(old.assigneeTchId);
              if (saved.assigneeTchId) assigneeIds.add(saved.assigneeTchId);
            }
            await m.getRepository(CalEventRevisionTypeormEntity).save({
              entId: u.entId,
              evtId: old.id,
              editorUserId: u.id,
              reason,
              changes,
            });
          }
          if (dto.scope === 'ONE')
            await m.query(
              'UPDATE amb_acm_cal_recurrence_occurrence SET cro_is_exception=true,updated_at=now() WHERE ent_id=$1 AND evt_id=$2',
              [u.entId, o.evt_id],
            );
        }
        if (dto.scope !== 'ONE') {
          if (remove) {
            const cutoff =
              dto.scope === 'ALL'
                ? new Date('0001-01-01T00:00:00Z')
                : sel.cro_key;
            await m.query(
              'UPDATE amb_acm_cal_recurrence_series SET crs_stop_at=LEAST(crs_stop_at,$3) WHERE ent_id=$1 AND crs_id=$2',
              [u.entId, s.crs_id, cutoff],
            );
          } else
            await m.query(
              'UPDATE amb_acm_cal_recurrence_series SET crs_changes=crs_changes || $3::jsonb WHERE ent_id=$1 AND crs_id=$2',
              [u.entId, s.crs_id, JSON.stringify([change])],
            );
        }
        await m.query(
          'UPDATE amb_acm_cal_recurrence_series SET crs_version=crs_version+1,updated_at=now() WHERE ent_id=$1 AND crs_id=$2',
          [u.entId, s.crs_id],
        );
        if (!remove && actualChanges)
          await enqueueInbox(m, {
            entId: u.entId,
            actorId: u.id,
            type: 'CAL_UPDATED',
            targetId: changedEventId,
            assigneeIds: [...assigneeIds],
            payload: {
              title: dto.event?.evtTitle ?? selected.title,
              count: actualChanges,
              scope: dto.scope,
            },
          });
        return { changed: eligible.length, protected: protectedCount };
      }),
    );
  }
}
