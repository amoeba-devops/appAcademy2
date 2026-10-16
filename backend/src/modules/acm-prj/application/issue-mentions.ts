import type { EntityManager } from 'typeorm';
import { enqueueInbox } from '../../acm-notification/application/inbox-outbox';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * REQ-261016E — 리치 텍스트(Tiptap Mention)에서 멘션된 사용자 ID 를 뽑는다.
 * `<span data-type="mention" data-id="…">` 만 인정한다(속성 순서 무관).
 */
export function mentionIds(html: string | null | undefined): string[] {
  const ids = new Set<string>();
  for (const tag of (html ?? '').match(/<span\b[^>]*>/gi) ?? []) {
    if (!/\bdata-type\s*=\s*["']mention["']/i.test(tag)) continue;
    const id = /\bdata-id\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (id && UUID.test(id)) ids.add(id.toLowerCase());
  }
  return [...ids];
}

/**
 * 새로 멘션된 사람(이전 본문에 없던 사람)에게만 ISSUE_MENTION 알림.
 * 본인·프로젝트 비참여자는 제외. 업무 트랜잭션(m) 안에서 호출한다.
 */
export async function notifyIssueMentions(
  m: EntityManager,
  a: {
    entId: string;
    actorId: string;
    issueId: string;
    before: string | null | undefined;
    after: string;
    commentId?: string;
  },
): Promise<string[]> {
  const prev = new Set(mentionIds(a.before));
  const fresh = mentionIds(a.after).filter(
    (id) => !prev.has(id) && id !== a.actorId.toLowerCase(),
  );
  if (!fresh.length) return [];
  const [issue] = await m.query<
    { pit_title: string; pit_ref_no: number | null; prj_id: string }[]
  >(
    `SELECT pit_title,pit_ref_no,prj_id FROM amb_acm_prj_item WHERE ent_id=$1 AND pit_id=$2 AND pit_kind='ISSUE'`,
    [a.entId, a.issueId],
  );
  if (!issue) return [];
  const members = await m.query<{ usr_id: string }[]>(
    `SELECT pm.usr_id FROM amb_acm_prj_member pm WHERE pm.ent_id=$1 AND pm.prj_id=$2 AND pm.usr_id=ANY($3::uuid[])
     UNION SELECT p.owner_id FROM amb_acm_prj_project p WHERE p.ent_id=$1 AND p.prj_id=$2 AND p.owner_id=ANY($3::uuid[])`,
    [a.entId, issue.prj_id, fresh],
  );
  const recipients = members.map((r) => r.usr_id);
  if (!recipients.length) return [];
  const [actor] = await m.query<{ usr_name: string }[]>(
    `SELECT usr_name FROM amb_acm_user WHERE ent_id=$1 AND usr_id=$2`,
    [a.entId, a.actorId],
  );
  await enqueueInbox(m, {
    entId: a.entId,
    actorId: a.actorId,
    type: 'ISSUE_MENTION',
    targetId: a.issueId,
    recipientIds: recipients,
    payload: {
      title: `${issue.pit_ref_no ? `ISS-${issue.pit_ref_no} ` : ''}${issue.pit_title}`,
      senderName: actor?.usr_name ?? null,
      commentId: a.commentId ?? null,
    },
  });
  return recipients;
}
