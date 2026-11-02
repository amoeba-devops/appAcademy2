import type { EntityManager } from 'typeorm';
import {
  NOTIFY_SPEC,
  NOTIFY_TYPES,
  userRolesOf,
  type NotifyType,
} from './notification-catalog';
import { loadTenantConfig } from './notification-settings.service';

export type InboxEventType =
  | 'CSL_CREATED'
  | 'CSL_STAGE'
  | 'CAL_CREATED'
  | 'CAL_UPDATED'
  | 'CHAT_MENTION'
  | 'CHAT_MESSAGE'
  | 'REVIEW_OVERDUE'
  | 'ISSUE_MENTION'
  | 'PASSWORD_RESET_REQUEST';
export interface InboxEvent {
  entId: string;
  actorId?: string | null;
  type: InboxEventType;
  targetId: string;
  payload?: Record<string, string | number | null>;
  assigneeIds?: (string | null | undefined)[];
  recipientIds?: string[];
  teacherRecipientIds?: string[];
}
/** Must use the same transaction manager as the business write. No external I/O here. */
export async function enqueueInbox(
  m: EntityManager,
  event: InboxEvent,
): Promise<void> {
  // REQ-261102B — 학원 설정: 상황 끄기·받는 역할 좁히기(넓히지 않음), 개인 설정: 알림함 끄기
  const known = (NOTIFY_TYPES as readonly string[]).includes(event.type);
  const setting = known
    ? (await loadTenantConfig(m, event.entId)).types[event.type as NotifyType]
    : null;
  if (setting && !setting.inbox) return;
  const selectable =
    known && NOTIFY_SPEC[event.type as NotifyType].roles.length;
  const roles = setting && selectable ? setting.roles : null;
  const users: { id: string }[] = await m.query(
    `
    SELECT DISTINCT u.usr_id AS id FROM amb_acm_user u
    WHERE u.ent_id=$1 AND u.usr_status='ACTIVE' AND u.usr_id IS DISTINCT FROM $2::uuid
      AND CASE WHEN $3 IN ('CHAT_MENTION','CHAT_MESSAGE') THEN u.usr_role IN ('ADMIN','APP_ADMIN') AND u.usr_id=ANY($4::uuid[])
      WHEN $3='ISSUE_MENTION' THEN u.usr_role IN ('ADMIN','STAFF','TEACHER','APP_ADMIN') AND u.usr_id=ANY($4::uuid[])
      WHEN $3='PASSWORD_RESET_REQUEST' THEN u.usr_role IN ('ADMIN','APP_ADMIN')
      WHEN $3='REVIEW_OVERDUE' THEN u.usr_role IN ('ADMIN','APP_ADMIN')
      ELSE u.usr_role IN ('ADMIN','STAFF','APP_ADMIN') OR
        ($3 LIKE 'CAL_%' AND u.usr_role='TEACHER' AND EXISTS (
          SELECT 1 FROM amb_acm_tch_teacher t WHERE t.ent_id=u.ent_id AND t.tch_user_id=u.usr_id
          AND t.tch_id=ANY($5::uuid[]) AND t.deleted_at IS NULL)) END
      AND ($6::text[] IS NULL OR u.usr_role=ANY($6::text[]))`,
    [
      event.entId,
      event.actorId ?? null,
      event.type,
      event.recipientIds ?? [],
      event.assigneeIds?.filter(Boolean) ?? [],
      roles ? userRolesOf(roles) : null,
    ],
  );
  const teachers: { id: string }[] =
    ['CHAT_MENTION', 'CHAT_MESSAGE', 'REVIEW_OVERDUE'].includes(event.type) &&
    (!roles || roles.includes('TEACHER')) &&
    event.teacherRecipientIds?.length
      ? await m.query(
          `SELECT t.tch_id AS id FROM amb_acm_tch_teacher t
        WHERE t.ent_id=$1 AND t.tch_id=ANY($2::uuid[]) AND t.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM amb_acm_portal_account p WHERE p.ent_id=t.ent_id
          AND p.pac_kind='TEACHER' AND p.pac_ref_id=t.tch_id AND p.pac_status='ACTIVE' AND p.pac_locked_at IS NULL)`,
          [event.entId, event.teacherRecipientIds],
        )
      : [];
  const off: { kind: string; id: string }[] =
    known && (users.length || teachers.length)
      ? await m.query(
          `SELECT npf_kind AS kind, npf_recipient_id AS id FROM amb_acm_notification_pref
           WHERE ent_id=$1 AND npf_config->'types'->$2->>'inbox'='false'`,
          [event.entId, event.type],
        )
      : [];
  const muted = new Set(off.map((o) => `${o.kind}:${o.id}`));
  const toUsers = users.filter((u) => !muted.has(`USER:${u.id}`));
  const toTeachers = teachers.filter((t) => !muted.has(`TEACHER:${t.id}`));
  if (!toUsers.length && !toTeachers.length) return;
  await m.query(
    `INSERT INTO amb_acm_notification_outbox
    (ent_id,nob_type,nob_target_id,nob_actor_id,nob_payload,nob_recipients) VALUES($1,$2,$3,$4,$5,$6)`,
    [
      event.entId,
      event.type,
      event.targetId,
      event.actorId ?? null,
      event.payload ?? {},
      JSON.stringify([
        ...toUsers.map((u) => u.id),
        ...toTeachers.map((t) => ({ kind: 'TEACHER', refId: t.id })),
      ]),
    ],
  );
}
