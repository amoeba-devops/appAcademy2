import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CalEventService } from '../../acm-cal/application/cal-event.service';
import { VideoConfigService } from '../../acm-cal/application/video-config.service';
import { RecurrenceService } from '../../acm-cal/application/recurrence.service';
import { IcsImportService } from '../../acm-cal/application/ics/ics-import.service';
import { BodaRoomService } from '../../acm-cal/application/boda-room.service';
import {
  apiError,
  digest,
  IntegrationAccessService,
} from './integration-access.service';
import {
  LessonDto,
  LessonQueryDto,
  StudentQueryDto,
  TeacherQueryDto,
} from './dto/scheduler.dto';
import type { IntegrationPrincipal, WriteResult } from './scheduler.types';
import {
  calCategoryBlocksBooking,
  NON_BLOCKING_CAL_CATEGORIES,
  normalizeCalCategory,
  systemCalCategory,
} from '../../acm-cal/application/cal-category';

interface EventRow {
  evt_id: string;
  evt_assignee_tch_id: string | null;
  tch_name: string | null;
  evt_start_at: Date;
  evt_end_at: Date;
  evt_category: string;
  evt_delivery_mode: string | null;
  evt_location_text: string | null;
  evt_meeting_url: string | null;
  evt_version: number;
  deleted_at: Date | null;
  ill_external_id: string | null;
  icl_id: string | null;
  teacher_ids: string[];
  students: { studentId: string | null; name: string }[];
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
const PROJECTION = `SELECT e.*,t.tch_name,l.ill_external_id,l.icl_id,
 ARRAY(SELECT tch_id FROM amb_acm_tch_teacher tr WHERE tr.ent_id=e.ent_id AND (
   tr.tch_id=e.evt_assignee_tch_id OR tr.tch_user_id=e.evt_owner_user_id OR EXISTS(
     SELECT 1 FROM amb_acm_cal_invitee ti WHERE ti.ent_id=e.ent_id AND ti.evt_id=e.evt_id AND ti.inv_kind='TEACHER' AND ti.inv_ref_id=tr.tch_id))) AS teacher_ids,
 COALESCE(e.evt_external_students,(SELECT jsonb_agg(jsonb_build_object('studentId',s.std_id,'name',s.std_name))
   FROM amb_acm_cal_invitee i JOIN amb_acm_std_student s ON s.std_id=i.inv_ref_id AND s.ent_id=i.ent_id
   WHERE i.ent_id=e.ent_id AND i.evt_id=e.evt_id AND i.inv_kind='STUDENT'),'[]'::jsonb) AS students
 FROM amb_acm_cal_event e LEFT JOIN amb_acm_tch_teacher t ON t.tch_id=e.evt_assignee_tch_id AND t.ent_id=e.ent_id
 LEFT JOIN amb_acm_int_lesson_link l ON l.evt_id=e.evt_id AND l.ent_id=e.ent_id`;

@Injectable()
export class SchedulerService {
  private readonly log = new Logger(SchedulerService.name);
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly access: IntegrationAccessService,
    private readonly cal: CalEventService,
    private readonly video: VideoConfigService,
    private readonly recurrence: RecurrenceService,
    private readonly ics: IcsImportService,
    private readonly boda: BodaRoomService,
  ) {}

  async teachers(p: IntegrationPrincipal, q: TeacherQueryDto) {
    const rows = await this.ds.query<
      { id: string; name: string; email: string | null; status: string }[]
    >(
      `SELECT tch_id AS id,tch_name AS name,tch_email AS email,tch_status AS status FROM amb_acm_tch_teacher
       WHERE ent_id=$1 AND deleted_at IS NULL AND tch_is_instructor=true AND ($2::text IS NULL OR lower(trim(tch_email))=lower($2))
       AND ($3::text IS NULL OR tch_status=$3) AND ($4::uuid IS NULL OR tch_id>$4) ORDER BY tch_id LIMIT $5`,
      [
        p.entId,
        q.email ?? null,
        q.status ?? null,
        q.cursor ?? null,
        q.limit + 1,
      ],
    );
    return {
      items: rows.slice(0, q.limit),
      meta: {
        limit: q.limit,
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      },
    };
  }
  /** REQ-261128D — enrolled students; no contact/birth/school data. */
  async students(p: IntegrationPrincipal, q: StudentQueryDto) {
    const rows = await this.ds.query<
      {
        id: string;
        name: string;
        englishName: string | null;
        site: string | null;
        grade: string | null;
        status: string;
        admissionDate: string | null;
        teachers: { teacherId: string; name: string; primary: boolean }[];
      }[]
    >(
      `SELECT s.std_id AS id, s.std_name AS name, s.std_english_name AS "englishName",
              s.std_site AS site, s.std_grade AS grade, s.std_status AS status,
              to_char(s.std_admission_date,'YYYY-MM-DD') AS "admissionDate",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('teacherId',t.tch_id,'name',t.tch_name,'primary',x.rn=1) ORDER BY x.rn)
                FROM (SELECT st.tch_id, row_number() OVER (ORDER BY st.st_sort_order, st.created_at, st.tch_id) AS rn
                        FROM amb_acm_std_student_teacher st
                        JOIN amb_acm_tch_teacher tt ON tt.tch_id=st.tch_id AND tt.ent_id=st.ent_id AND tt.deleted_at IS NULL
                       WHERE st.ent_id=s.ent_id AND st.std_id=s.std_id) x
                JOIN amb_acm_tch_teacher t ON t.tch_id=x.tch_id AND t.ent_id=s.ent_id),'[]'::jsonb) AS teachers
         FROM amb_acm_std_student s
        WHERE s.ent_id=$1 AND s.deleted_at IS NULL AND s.std_status='ACTIVE'
          AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM amb_acm_std_student_teacher f
                 WHERE f.ent_id=s.ent_id AND f.std_id=s.std_id AND f.tch_id=$2))
          AND ($3::text IS NULL OR s.std_site=$3)
          AND ($4::uuid IS NULL OR s.std_id>$4)
        ORDER BY s.std_id LIMIT $5`,
      [
        p.entId,
        q.teacherId ?? null,
        q.site ?? null,
        q.cursor ?? null,
        q.limit + 1,
      ],
    );
    return {
      items: rows.slice(0, q.limit),
      meta: {
        limit: q.limit,
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      },
    };
  }
  private range(from: string, to: string) {
    const a = new Date(from),
      b = new Date(to);
    if (
      !Number.isFinite(+a) ||
      !Number.isFinite(+b) ||
      +b <= +a ||
      +b - +a > 31 * 86400000
    )
      apiError(400, 'INVALID_RANGE');
    // Bound recurrence materialization to two years ahead, rather than accepting arbitrary centuries.
    if (+b > Date.now() + 732 * 86400000) apiError(400, 'RANGE_TOO_FAR');
  }
  private async ensureRange(ent: string, to: string) {
    await this.recurrence.ensureRange(ent, new Date(to));
    await this.ics.ensureRange(ent, new Date(to));
    const errors = await this.ds.query<unknown[]>(
      'SELECT 1 FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 AND crs_error IS NOT NULL LIMIT 1',
      [ent],
    );
    if (errors.length) apiError(503, 'SCHEDULE_UNAVAILABLE');
  }
  private view(row: EventRow, p: IntegrationPrincipal) {
    const own = row.icl_id === p.clientId;
    return {
      id: row.evt_id,
      externalId: own ? row.ill_external_id : null,
      managedByClient: own,
      teacherId: row.evt_assignee_tch_id,
      teacherIds: row.teacher_ids,
      teacherName: row.tch_name,
      students: row.students,
      startsAt: new Date(row.evt_start_at).toISOString(),
      endsAt: new Date(row.evt_end_at).toISOString(),
      // External contract: tenant-defined categories are reported as OTHER.
      category: systemCalCategory(row.evt_category),
      // REQ-261128C — actual tenant category + whether it occupies the slot.
      calendarCategory: normalizeCalCategory(row.evt_category),
      blocksBooking: calCategoryBlocksBooking(row.evt_category),
      deliveryMode: row.evt_delivery_mode,
      location: row.evt_location_text,
      meetingUrl: row.evt_meeting_url,
      version: own ? row.evt_version : null,
    };
  }
  async list(p: IntegrationPrincipal, q: LessonQueryDto) {
    this.range(q.from, q.to);
    await this.ensureRange(p.entId, q.to);
    const rows = await this.ds.query<EventRow[]>(
      `SELECT * FROM (${PROJECTION} WHERE e.ent_id=$1 AND e.deleted_at IS NULL
      AND e.evt_start_at<$3 AND e.evt_end_at>$2 AND ($4::uuid IS NULL OR e.evt_id>$4)) x
      WHERE ($5::uuid IS NULL OR $5=ANY(teacher_ids)) ORDER BY evt_id LIMIT $6`,
      [
        p.entId,
        q.from,
        q.to,
        q.cursor ?? null,
        q.teacherId ?? null,
        q.limit + 1,
      ],
    );
    return {
      items: rows.slice(0, q.limit).map((r) => this.view(r, p)),
      meta: {
        limit: q.limit,
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].evt_id : null,
      },
    };
  }
  private async row(
    m: EntityManager,
    p: IntegrationPrincipal,
    externalId: string,
  ) {
    const rows = await m.query<EventRow[]>(
      `${PROJECTION} WHERE e.ent_id=$1 AND l.icl_id=$2 AND l.ill_external_id=$3`,
      [p.entId, p.clientId, externalId],
    );
    return rows[0];
  }
  async get(p: IntegrationPrincipal, externalId: string) {
    this.validateId(externalId);
    const row = await this.row(this.ds.manager, p, externalId);
    if (!row || row.deleted_at) apiError(404, 'LESSON_NOT_FOUND');
    return {
      status: 200,
      data: this.view(row, p),
      etag: `"${row.evt_version}"`,
    };
  }
  private validateId(id: string) {
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(id))
      apiError(400, 'INVALID_EXTERNAL_ID');
  }
  async write(
    p: IntegrationPrincipal,
    id: string,
    dto: LessonDto | { reason: string },
    headers: { key?: string; match?: string; none?: string },
    remove = false,
  ): Promise<WriteResult> {
    this.validateId(id);
    if (!headers.key || !/^[\x21-\x7e]{1,128}$/.test(headers.key))
      apiError(400, 'IDEMPOTENCY_KEY_REQUIRED');
    if (!remove) {
      const lesson = dto as LessonDto;
      this.range(lesson.startsAt, lesson.endsAt);
      await this.ensureRange(p.entId, lesson.endsAt);
    }
    const fingerprint = digest(
      JSON.stringify(
        canonical([
          remove ? 'DELETE' : 'PUT',
          id,
          dto,
          headers.match ?? null,
          headers.none ?? null,
        ]),
      ),
    );
    let cleanupId: string | undefined;
    const result = await this.video.withLock(p.entId, () =>
      this.ds.transaction(async (m) => {
        // Fixed lock order: video -> CAL statement lock -> credential/config rows.
        await m.query('SELECT pg_advisory_xact_lock(1072,1)');
        await this.access.recheck(m, p, 'lessons:write');
        await m.query(
          `DELETE FROM amb_acm_int_request WHERE ent_id=$1 AND icl_id=$2 AND irq_expires_at<=now()`,
          [p.entId, p.clientId],
        );
        const [replay] = await m.query<
          { irq_hash: string; irq_result: WriteResult }[]
        >(
          `SELECT irq_hash,irq_result FROM amb_acm_int_request WHERE ent_id=$1 AND icl_id=$2 AND irq_key=$3`,
          [p.entId, p.clientId, headers.key],
        );
        if (replay) {
          if (replay.irq_hash !== fingerprint)
            apiError(409, 'IDEMPOTENCY_KEY_REUSED');
          return replay.irq_result;
        }
        const old = await this.row(m, p, id);
        if (old?.deleted_at) apiError(409, 'EXTERNAL_ID_RETIRED');
        if (old) {
          if (headers.none) apiError(412, 'VERSION_MISMATCH');
          if (!headers.match) apiError(428, 'PRECONDITION_REQUIRED');
          if (headers.match !== `"${old.evt_version}"`)
            apiError(412, 'VERSION_MISMATCH');
        } else {
          if (remove) apiError(404, 'LESSON_NOT_FOUND');
          if (!headers.none && !headers.match)
            apiError(428, 'PRECONDITION_REQUIRED');
          if (headers.none !== '*' || headers.match)
            apiError(412, 'VERSION_MISMATCH');
        }
        let response: WriteResult;
        if (remove) {
          await m.query(
            `UPDATE amb_acm_cal_event SET deleted_at=now(),evt_delete_reason=$3,evt_deleted_by=$4,updated_at=now() WHERE ent_id=$1 AND evt_id=$2`,
            [p.entId, old.evt_id, dto.reason, p.actorId],
          );
          cleanupId = old.evt_id;
          response = { status: 200, data: { externalId: id, deleted: true } };
        } else {
          const lesson = dto as LessonDto;
          if (!!lesson.teacherId === !!lesson.teacherEmail)
            apiError(400, 'TEACHER_IDENTIFIER_REQUIRED');
          const teachers = await m.query<
            { tch_id: string; tch_status: string }[]
          >(
            `SELECT tch_id,tch_status FROM amb_acm_tch_teacher WHERE ent_id=$1 AND deleted_at IS NULL AND tch_is_instructor=true
            AND CASE WHEN $2::uuid IS NOT NULL THEN tch_id=$2 ELSE lower(trim(tch_email))=lower($3) END`,
            [p.entId, lesson.teacherId ?? null, lesson.teacherEmail ?? null],
          );
          if (!teachers.length) apiError(422, 'TEACHER_NOT_FOUND');
          if (teachers.length !== 1) apiError(422, 'TEACHER_AMBIGUOUS');
          if (teachers[0].tch_status !== 'ACTIVE')
            apiError(422, 'TEACHER_NOT_ACTIVE');
          const teacherId = teachers[0].tch_id;
          const students: { studentId: string | null; name: string }[] = [];
          for (const input of lesson.students) {
            const rows = await m.query<{ std_id: string; std_name: string }[]>(
              `SELECT std_id,std_name FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL AND std_status='ACTIVE'
            AND CASE WHEN $2::uuid IS NOT NULL THEN std_id=$2 ELSE std_name=$3 END`,
              [p.entId, input.studentId ?? null, input.name],
            );
            if (rows.length > 1) apiError(422, 'STUDENT_AMBIGUOUS');
            if (
              !rows.length &&
              (input.studentId || lesson.category !== 'DEMO_CLASS')
            )
              apiError(422, 'STUDENT_NOT_FOUND');
            if (rows[0] && rows[0].std_name !== input.name)
              apiError(422, 'STUDENT_NAME_MISMATCH');
            students.push({
              studentId: rows[0]?.std_id ?? null,
              name: rows[0]?.std_name ?? input.name,
            });
          }
          if (
            new Set(students.map((s) => s.studentId ?? s.name)).size !==
            students.length
          )
            apiError(400, 'DUPLICATE_STUDENT');
          const clashes = await m.query<{ evt_id: string }[]>(
            `SELECT evt_id FROM (${PROJECTION} WHERE e.ent_id=$1 AND e.deleted_at IS NULL
          AND e.evt_start_at<$3 AND e.evt_end_at>$2 AND ($4::uuid IS NULL OR e.evt_id<>$4)
          AND e.evt_category <> ALL($6::text[])) x WHERE $5=ANY(teacher_ids)`,
            [
              p.entId,
              lesson.startsAt,
              lesson.endsAt,
              old?.evt_id ?? null,
              teacherId,
              [...NON_BLOCKING_CAL_CATEGORIES],
            ],
          );
          if (clashes.length)
            apiError(409, 'SCHEDULE_CONFLICT', {
              eventIds: clashes.map((c) => c.evt_id),
            });
          const config = await this.video.get(p.entId);
          const provider =
            lesson.deliveryMode === 'ONSITE' ? 'NONE' : config.provider;
          if (lesson.deliveryMode === 'ONLINE' && provider === 'NONE')
            apiError(422, 'VIDEO_CONFIG_INVALID');
          if (lesson.deliveryMode === 'ONSITE' && lesson.meetingUrl)
            apiError(422, 'VIDEO_CONFIG_INVALID');
          if (lesson.meetingUrl) {
            try {
              if (new URL(lesson.meetingUrl).protocol !== 'https:')
                throw new Error();
            } catch {
              apiError(422, 'VIDEO_CONFIG_INVALID');
            }
          }
          if (
            lesson.deliveryMode === 'ONLINE' &&
            provider !== 'BODASCHOOL' &&
            !lesson.meetingUrl
          )
            apiError(422, 'VIDEO_CONFIG_INVALID');
          if (old && old.evt_meeting_url && lesson.deliveryMode === 'ONSITE')
            cleanupId = old.evt_id;
          const eventId = await this.cal.persistExternal(
            m,
            p.entId,
            p.actorId,
            {
              evtCategory: lesson.category,
              evtTitle:
                `${lesson.category === 'DEMO_CLASS' ? 'Demo Class' : 'Class'} — ${students.map((s) => s.name).join(', ')}`.slice(
                  0,
                  200,
                ),
              evtStartAt: lesson.startsAt,
              evtEndAt: lesson.endsAt,
              evtDeliveryMode: lesson.deliveryMode,
              evtBodaRoomType:
                students.length > 1 ? 'ONE_TO_MANY' : 'ONE_TO_ONE',
              evtLocationText: lesson.location ?? '',
              evtMeetingProvider: provider,
              evtMeetingUrl: lesson.meetingUrl ?? '',
              evtAssigneeTchId: teacherId,
              evtInvitees: [
                { kind: 'TEACHER', refId: teacherId },
                ...students
                  .filter((s) => s.studentId)
                  .map((s) => ({
                    kind: 'STUDENT' as const,
                    refId: s.studentId!,
                  })),
              ],
            },
            students,
            p.clientName,
            old?.evt_id,
            lesson.reason,
          );
          if (!old)
            await m.query(
              `INSERT INTO amb_acm_int_lesson_link(ent_id,icl_id,ill_external_id,evt_id) VALUES($1,$2,$3,$4)`,
              [p.entId, p.clientId, id, eventId],
            );
          const row = await this.row(m, p, id);
          response = {
            status: old ? 200 : 201,
            data: this.view(row, p),
            etag: `"${row.evt_version}"`,
          };
        }
        await m.query(
          `INSERT INTO amb_acm_int_request(ent_id,icl_id,irq_key,irq_hash,irq_result) VALUES($1,$2,$3,$4,$5)`,
          [
            p.entId,
            p.clientId,
            headers.key,
            fingerprint,
            JSON.stringify(response),
          ],
        );
        await this.access.audit(
          m,
          p.entId,
          p.actorId,
          remove ? 'LESSON_DELETED' : old ? 'LESSON_UPDATED' : 'LESSON_CREATED',
          id,
          p.clientId,
          p.keyId,
        );
        return response;
      }),
    );
    // Close remote rooms only after durable soft deletion; retries cannot create another event.
    if (cleanupId)
      await this.boda
        .closeAndDelete(cleanupId, p.entId)
        .catch(() => this.log.warn('Deleted lesson room cleanup deferred'));
    return result;
  }
}
