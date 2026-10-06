import type { EntityManager } from 'typeorm';

export type InboxEventType =
  | 'CSL_CREATED'
  | 'CSL_STAGE'
  | 'CAL_CREATED'
  | 'CAL_UPDATED'
  | 'CHAT_MENTION';
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
  const users: { id: string }[] = await m.query(
    `
    SELECT DISTINCT u.usr_id AS id FROM amb_acm_user u
    WHERE u.ent_id=$1 AND u.usr_status='ACTIVE' AND u.usr_id IS DISTINCT FROM $2::uuid
      AND CASE WHEN $3='CHAT_MENTION' THEN u.usr_role IN ('ADMIN','APP_ADMIN') AND u.usr_id=ANY($4::uuid[])
      ELSE u.usr_role IN ('ADMIN','STAFF','APP_ADMIN') OR
        ($3 LIKE 'CAL_%' AND u.usr_role='TEACHER' AND EXISTS (
          SELECT 1 FROM amb_acm_tch_teacher t WHERE t.ent_id=u.ent_id AND t.tch_user_id=u.usr_id
          AND t.tch_id=ANY($5::uuid[]) AND t.deleted_at IS NULL)) END`,
    [
      event.entId,
      event.actorId ?? null,
      event.type,
      event.recipientIds ?? [],
      event.assigneeIds?.filter(Boolean) ?? [],
    ],
  );
  const teachers: { id: string }[] =
    event.type === 'CHAT_MENTION' && event.teacherRecipientIds?.length
      ? await m.query(
          `SELECT t.tch_id AS id FROM amb_acm_tch_teacher t
        WHERE t.ent_id=$1 AND t.tch_id=ANY($2::uuid[]) AND t.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM amb_acm_portal_account p WHERE p.ent_id=t.ent_id
          AND p.pac_kind='TEACHER' AND p.pac_ref_id=t.tch_id AND p.pac_status='ACTIVE' AND p.pac_locked_at IS NULL)`,
          [event.entId, event.teacherRecipientIds],
        )
      : [];
  if (!users.length && !teachers.length) return;
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
        ...users.map((u) => u.id),
        ...teachers.map((t) => ({ kind: 'TEACHER', refId: t.id })),
      ]),
    ],
  );
}
