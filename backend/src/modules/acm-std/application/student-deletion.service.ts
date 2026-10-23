import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { createHash } from 'crypto';

export interface DeletionListRow {
  id: string;
  name: string;
  actorName: string;
  occurredAt: string;
  action?: string;
  counts?: Record<string, number>;
}
export interface Student {
  id: string;
  name: string;
  archivedAt: string | null;
}
interface Actor {
  id: string;
  name: string;
}
interface Selection {
  table: string;
  where: string;
  params: unknown[];
  count: number;
  digest: string;
}
export interface PurgeInput {
  name: string;
  testConfirmed: boolean;
  version: string;
}
@Injectable()
export class StudentDeletionService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async actor(m: EntityManager, u: AcmCurrentUser): Promise<Actor> {
    const rows: Actor[] = await m.query(
      // REQ-261024 Q-A2 — 관리자 + (서비스 운영자 또는 테넌트 마스터). 이전: AMA 관리자 계정만.
      `SELECT u.usr_id AS id,u.usr_name AS name FROM amb_acm_user u
      WHERE u.usr_id=$1 AND u.ent_id=$2 AND u.usr_status='ACTIVE' AND u.usr_locked_at IS NULL
      AND u.usr_role IN ('ADMIN','APP_ADMIN')
      AND EXISTS (SELECT 1 FROM amb_acm_user_permission p WHERE p.ent_id=u.ent_id AND p.usr_id=u.usr_id
                  AND p.upr_permission IN ('CONFIG_ADMIN','TENANT_MASTER'))`,
      [u.id, u.entId],
    );
    if (!rows[0]) throw new ForbiddenException('DELETE_PERMISSION_REQUIRED');
    return rows[0];
  }
  async access(u: AcmCurrentUser) {
    try {
      await this.actor(this.ds.manager, u);
      return { canDelete: true };
    } catch (e) {
      if (e instanceof ForbiddenException) return { canDelete: false };
      throw e;
    }
  }
  async list(u: AcmCurrentUser, page: number, history = false) {
    await this.actor(this.ds.manager, u);
    const offset = (page - 1) * 50;
    const table = history
      ? 'amb_acm_std_deletion_history'
      : 'amb_acm_std_student';
    const where = history
      ? 'ent_id=$1'
      : 'ent_id=$1 AND std_archived_at IS NOT NULL';
    const select = history
      ? `sdh_id AS id,std_id AS "studentId",sdh_student_name AS name,sdh_action AS action,sdh_actor_name AS "actorName",sdh_actor_id AS "actorId",created_at AS "occurredAt",sdh_counts AS counts`
      : `std_id AS id,std_name AS name,std_archived_at AS "occurredAt",(SELECT h.sdh_actor_name FROM amb_acm_std_deletion_history h WHERE h.ent_id=s.ent_id AND h.std_id=s.std_id AND h.sdh_action='ARCHIVE' ORDER BY h.created_at DESC LIMIT 1) AS "actorName"`;
    const items = await this.ds.query<DeletionListRow[]>(
      `SELECT ${select} FROM ${table} s WHERE ${where} ORDER BY ${history ? 'created_at' : 'std_archived_at'} DESC,${history ? 'sdh_id' : 'std_id'} LIMIT 50 OFFSET $2`,
      [u.entId, offset],
    );
    const [row]: { total: string }[] = await this.ds.query(
      `SELECT count(*) AS total FROM ${table} WHERE ${where}`,
      [u.entId],
    );
    return { items, total: Number(row.total), page };
  }
  private async student(m: EntityManager, u: AcmCurrentUser, id: string) {
    const [s]: Student[] = await m.query(
      `SELECT std_id AS id,std_name AS name,std_archived_at AS "archivedAt" FROM amb_acm_std_student WHERE ent_id=$1 AND std_id=$2 AND (deleted_at IS NULL OR std_archived_at IS NOT NULL)`,
      [u.entId, id],
    );
    if (!s) throw new NotFoundException('STUDENT_NOT_FOUND');
    return s;
  }
  private async audit(
    m: EntityManager,
    u: AcmCurrentUser,
    a: Actor,
    s: Student,
    action: string,
    counts: unknown,
  ) {
    await m.query(
      `INSERT INTO amb_acm_std_deletion_history(ent_id,std_id,sdh_student_name,sdh_action,sdh_actor_id,sdh_actor_name,sdh_counts,sdh_test_confirmed) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        u.entId,
        s.id,
        s.name,
        action,
        a.id,
        a.name,
        JSON.stringify(counts),
        action === 'PURGE',
      ],
    );
  }
  async archive(u: AcmCurrentUser, id: string) {
    return this.ds.transaction(async (m) => {
      const a = await this.actor(m, u);
      await m.query(
        'SELECT std_id FROM amb_acm_std_student WHERE ent_id=$1 AND std_id=$2 FOR UPDATE',
        [u.entId, id],
      );
      const s = await this.student(m, u, id);
      if (s.archivedAt) return { id };
      await m.query(
        `UPDATE amb_acm_std_student SET std_archived_at=now(),std_archived_by=$3,deleted_at=now(),updated_at=now() WHERE ent_id=$1 AND std_id=$2`,
        [u.entId, id, u.id],
      );
      await this.audit(m, u, a, s, 'ARCHIVE', {});
      return { id };
    });
  }
  private async plan(m: EntityManager, u: AcmCurrentUser, id: string) {
    const s = await this.student(m, u, id),
      ent = u.entId;
    const ids = async (sql: string, p: unknown[]) =>
      (await m.query<{ id: string }[]>(sql, p)).map((r) => r.id);
    const inquiries = await ids(
      'SELECT inq_id AS id FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND inq_std_id=$2',
      [ent, id],
    );
    const classes = await ids(
      `SELECT cls_id AS id FROM amb_acm_cls_classes WHERE ent_id=$1 AND (cls_inq_id=ANY($3::uuid[]) OR cls_id IN (SELECT cls_id FROM amb_acm_cls_class_students WHERE ent_id=$1 AND (cst_student_user_id=$2 OR cst_inq_id=ANY($3::uuid[]))) OR cls_id IN (SELECT cls_id FROM amb_acm_cls_enrollment WHERE ent_id=$1 AND std_id=$2))`,
      [ent, id, inquiries],
    );
    const events = await ids(
      `SELECT evt_id AS id FROM amb_acm_cal_event WHERE ent_id=$1 AND (evt_cls_id=ANY($3::uuid[]) OR evt_id IN (SELECT evt_id FROM amb_acm_cal_invitee WHERE ent_id=$1 AND inv_kind='STUDENT' AND inv_ref_id=$2) OR evt_id IN (SELECT mpt_cal_event_id FROM amb_acm_csl_map_test WHERE ent_id=$1 AND inq_id=ANY($4::uuid[])) OR evt_id IN (SELECT tcl_cal_event_id FROM amb_acm_csl_trial_class WHERE ent_id=$1 AND inq_id=ANY($4::uuid[])))`,
      [ent, id, classes, inquiries],
    );
    const sessions = await ids(
      'SELECT ses_id AS id FROM amb_acm_cls_sessions WHERE ent_id=$1 AND cls_id=ANY($2::uuid[])',
      [ent, classes],
    );
    const bills = await ids(
      'SELECT pbl_id AS id FROM amb_acm_pay_bill WHERE ent_id=$1 AND std_id=$2',
      [ent, id],
    );
    const blocked: string[] = [];
    const check = async (code: string, sql: string, p: unknown[]) => {
      if ((await m.query<unknown[]>(sql, p)).length) blocked.push(code);
    };
    await check(
      'SHARED_RECORDS',
      `SELECT 1 FROM amb_acm_cal_invitee WHERE evt_id=ANY($3::uuid[]) AND inv_kind='STUDENT' AND (inv_ref_id<>$2 OR ent_id<>$1)
      UNION ALL SELECT 1 FROM amb_acm_cls_class_students WHERE cls_id=ANY($4::uuid[]) AND (ent_id<>$1 OR ((cst_student_user_id IS NOT NULL AND cst_student_user_id<>$2) OR (cst_inq_id IS NOT NULL AND NOT(cst_inq_id=ANY($5::uuid[]))) OR (cst_student_user_id IS NULL AND cst_inq_id IS NULL)))
      UNION ALL SELECT 1 FROM amb_acm_cls_classes WHERE cls_id=ANY($4::uuid[]) AND (ent_id<>$1 OR (cls_inq_id IS NOT NULL AND NOT(cls_inq_id=ANY($5::uuid[]))))
      UNION ALL SELECT 1 FROM amb_acm_cls_enrollment WHERE cls_id=ANY($4::uuid[]) AND (ent_id<>$1 OR std_id<>$2)
      UNION ALL SELECT 1 FROM amb_acm_csl_map_test WHERE mpt_cal_event_id=ANY($3::uuid[]) AND NOT(inq_id=ANY($5::uuid[]))
      UNION ALL SELECT 1 FROM amb_acm_csl_trial_class WHERE tcl_cal_event_id=ANY($3::uuid[]) AND NOT(inq_id=ANY($5::uuid[]))
      UNION ALL SELECT 1 FROM amb_acm_pay_bill WHERE cls_id=ANY($4::uuid[]) AND (ent_id<>$1 OR std_id<>$2)`,
      [ent, id, events, classes, inquiries],
    );
    await check(
      'PAYMENT_OR_SETTLEMENT',
      `SELECT 1 FROM amb_acm_pay_order WHERE enrollment_id IN (SELECT ce_id FROM amb_acm_cls_enrollment WHERE ent_id=$1 AND std_id=$2)
      UNION ALL SELECT 1 FROM amb_acm_cls_settlement_lines WHERE cls_id=ANY($3::uuid[])`,
      [ent, id, classes],
    );
    // Recurring series and external classroom resources cannot be safely severed automatically.
    await check(
      'EXTERNAL_OR_RECURRING',
      `SELECT 1 FROM amb_acm_cal_ics_occurrence WHERE evt_id=ANY($1::uuid[]) UNION ALL SELECT 1 FROM amb_acm_cal_recurrence_occurrence WHERE evt_id=ANY($1::uuid[]) UNION ALL SELECT 1 FROM amb_acm_cal_boda_recording WHERE evt_id=ANY($1::uuid[]) UNION ALL SELECT 1 FROM amb_acm_cal_boda_room WHERE evt_id=ANY($1::uuid[]) OR ses_id=ANY($2::uuid[]) UNION ALL SELECT 1 FROM amb_acm_cls_sessions WHERE ses_id=ANY($2::uuid[]) AND ses_gcal_event_id IS NOT NULL`,
      [events, sessions],
    );
    const files: { key: string }[] = await m.query(
      `SELECT cea_s3_key AS key FROM amb_acm_cal_event_attachment WHERE ent_id=$1 AND evt_id=ANY($2::uuid[])
      UNION SELECT att_s3_key FROM amb_acm_csl_attachment WHERE ent_id=$1 AND inq_id=ANY($3::uuid[])`,
      [ent, events, inquiries],
    );
    for (const f of files)
      if (
        !(
          f.key.startsWith(ent + '/') ||
          events.some((e) =>
            f.key.startsWith('cal-events/' + ent + '/' + e + '/'),
          )
        )
      )
        blocked.push('ATTACHED_FILES');
    await check(
      'SHARED_RECORDS',
      `SELECT 1 FROM amb_acm_cal_event_attachment WHERE cea_s3_key=ANY($1::text[]) AND NOT(evt_id=ANY($2::uuid[])) UNION ALL SELECT 1 FROM amb_acm_csl_attachment WHERE att_s3_key=ANY($1::text[]) AND NOT(inq_id=ANY($3::uuid[]))`,
      [files.map((f) => f.key), events, inquiries],
    );
    await check(
      'OTHER_LINKED_RECORDS',
      `SELECT 1 FROM amb_acm_material_share WHERE msh_tgt_ref_id=$1 OR mat_id IN(SELECT mat_id FROM amb_acm_material WHERE cls_id=ANY($2::uuid[])) UNION ALL SELECT 1 FROM amb_acm_material WHERE cls_id=ANY($2::uuid[])`,
      [id, classes],
    );
    await check(
      'OTHER_LINKED_RECORDS',
      `SELECT 1 FROM amb_acm_qna_question WHERE student_id=$1 UNION ALL SELECT 1 FROM amb_acm_map_assignment WHERE mas_target_id=$1 UNION ALL SELECT 1 FROM amb_acm_cls_makeups WHERE mkp_original_ses_id=ANY($2::uuid[]) OR mkp_makeup_ses_id=ANY($2::uuid[])`,
      [id, sessions],
    );
    const selections: Selection[] = [];
    const add = async (table: string, where: string, params: unknown[]) => {
      const [r]: { count: string; digest: string }[] = await m.query(
        `SELECT count(*),md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY md5(row_to_json(t)::text)),'')) AS digest FROM ${table} t WHERE ${where}`,
        params,
      );
      selections.push({
        table,
        where,
        params,
        count: Number(r.count),
        digest: r.digest,
      });
    };
    const by = async (table: string, col: string, values: string[]) =>
      add('amb_acm_' + table, `ent_id=$1 AND ${col}=ANY($2::uuid[])`, [
        ent,
        values,
      ]);
    // Leaf first. All identifiers below are constants, never client input.
    for (const table of [
      'pay_bill_adjustment',
      'pay_bill_audit',
      'pay_collection',
    ])
      await by(table, 'pbl_id', bills);
    await by('pay_bill', 'pbl_id', bills);
    for (const table of [
      'cal_event_attachment',
      'cal_event_review',
      'cal_event_revision',
      'cal_feedback_send',
      'cal_review_reminder',
      'cal_invitee',
    ])
      await by(table, 'evt_id', events);
    for (const table of ['cls_attendance', 'cls_feedbacks'])
      await by(table, 'ses_id', sessions);
    for (const table of [
      'cls_enrollment',
      'cls_class_students',
      'cls_recurrence',
      'cls_video_config',
      'material',
    ])
      await by(table, 'cls_id', classes);
    await by('cal_event', 'evt_id', events);
    await by('cls_sessions', 'ses_id', sessions);
    await by('cls_classes', 'cls_id', classes);
    await add(
      'amb_acm_csl_enrollment_course',
      'ent_id=$1 AND enr_id IN (SELECT enr_id FROM amb_acm_csl_enrollment WHERE ent_id=$1 AND inq_id=ANY($2::uuid[]))',
      [ent, inquiries],
    );
    for (const table of ['csl_intake_form'])
      await by(table, 'cif_promoted_inq_id', inquiries);
    for (const table of [
      'csl_attachment',
      'csl_enrollment',
      'csl_map_apply',
      'csl_map_test',
      'csl_trial_class',
      'csl_remark',
      'csl_teacher_assignment',
      'csl_transition',
      'csl_visit_record',
      'csl_cancellation',
      'csl_pii_audit',
    ])
      await by(table, 'inq_id', inquiries);
    await by('csl_inquiry', 'inq_id', inquiries);
    for (const table of [
      'std_status_history',
      'std_student_parent',
      'std_student_teacher',
      'std_teacher_class_info',
      'std_withdrawn_audit',
      'std_withdrawn_record',
      'std_import_row',
      'std_site_audit',
    ])
      await by(table, 'std_id', [id]);
    for (const table of [
      'map_response',
      'map_score',
      'std_external_test_score',
    ])
      await add('amb_acm_' + table, 'std_id=$1', [id]);
    await add(
      'amb_acm_portal_account',
      "ent_id=$1 AND pac_kind='STUDENT' AND pac_ref_id=$2",
      [ent, id],
    );
    // Queue/inbox payloads can retain student details or re-create notifications.
    await add(
      'amb_acm_notification_inbox',
      "ent_id=$1 AND nin_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','REVIEW_OVERDUE') AND nin_target_id=ANY($2::uuid[])",
      [ent, [...inquiries, ...events]],
    );
    await add(
      'amb_acm_notification_outbox',
      "ent_id=$1 AND nob_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','REVIEW_OVERDUE') AND nob_target_id=ANY($2::uuid[])",
      [ent, [...inquiries, ...events]],
    );
    await add(
      'amb_acm_dsh_lifecycle_event',
      "ent_id=$1 AND ((subject_kind='STUDENT' AND subject_id=$2) OR (subject_kind='INQUIRY' AND subject_id=ANY($3::uuid[])))",
      [ent, id, inquiries],
    );
    const counts = {
      consultations: inquiries.length,
      classes: classes.length,
      events: events.length,
      bills: bills.length,
      collections:
        selections.find((x) => x.table === 'amb_acm_pay_collection')?.count ??
        0,
    };
    const version = createHash('sha256')
      .update(
        JSON.stringify({
          s,
          counts,
          inquiries,
          classes,
          events,
          bills,
          selections: selections.map((x) => [x.table, x.count, x.digest]),
          blocked,
        }),
      )
      .digest('hex');
    return {
      s,
      selections,
      counts,
      blocked: [...new Set(blocked)],
      version,
      files,
      inquiries,
      events,
    };
  }
  async preview(u: AcmCurrentUser, id: string) {
    await this.actor(this.ds.manager, u);
    const p = await this.plan(this.ds.manager, u, id);
    return {
      student: p.s,
      counts: p.counts,
      blocked: p.blocked,
      version: p.version,
      inquiryIds: p.inquiries,
      eventIds: p.events,
    };
  }
  async purge(u: AcmCurrentUser, id: string, dto: PurgeInput) {
    if (dto.testConfirmed !== true)
      throw new BadRequestException('TEST_CONFIRMATION_REQUIRED');
    return this.ds
      .transaction(async (m) => {
        await m.query("SET LOCAL lock_timeout='3s'");
        await m.query("SET LOCAL statement_timeout='15s'");
        // Very rare destructive operation: short, ordered write barrier prevents references
        // inserted by modules which have no FK from racing the final dependency scan.
        const tables: { name: string }[] = await m.query(
          "SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'amb_acm_%' ORDER BY tablename",
        );
        await m.query(
          `LOCK TABLE ${tables.map((t) => '"' + t.name.replace(/"/g, '""') + '"').join(',')} IN SHARE ROW EXCLUSIVE MODE`,
        );
        const a = await this.actor(m, u),
          p = await this.plan(m, u, id);
        if (!p.s.archivedAt) throw new ConflictException('ARCHIVE_REQUIRED');
        if (dto.name !== p.s.name)
          throw new BadRequestException('STUDENT_NAME_MISMATCH');
        if (p.blocked.length)
          throw new ConflictException({
            message: 'PURGE_BLOCKED',
            reasons: p.blocked,
          });
        if (dto.version !== p.version)
          throw new ConflictException('PREVIEW_CHANGED');
        await this.audit(m, u, a, p.s, 'PURGE', p.counts);
        for (const f of p.files)
          await m.query(
            'INSERT INTO amb_acm_std_deleted_file(ent_id,sdf_key) VALUES($1,$2) ON CONFLICT(sdf_key) DO NOTHING',
            [u.entId, f.key],
          );
        for (const x of p.selections)
          if (x.count)
            await m.query(`DELETE FROM ${x.table} WHERE ${x.where}`, x.params);
        await m.query(
          'DELETE FROM amb_acm_std_student WHERE ent_id=$1 AND std_id=$2',
          [u.entId, id],
        );
        return { id, counts: p.counts };
      })
      .catch((error: unknown) => {
        if (error instanceof QueryFailedError)
          throw new ConflictException('DELETE_CONFLICT_RETRY_AFTER_REVIEW');
        throw error;
      });
  }
}
