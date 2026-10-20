/**
 * REQ-261020C — 휴대폰 푸시 문구(종류별).
 * 서버는 받는 사람의 화면 언어를 모르므로 알림함 한국어 문구와 같게 쓴다.
 * REQ-261020D — 채팅은 메시지 내용(preview)을 본문에 넣어 잠금 화면에서도 보이게 한다.
 */
const LABELS: Record<string, string> = {
  CSL_CREATED: '신규 상담이 접수되었습니다',
  CSL_STAGE: '상담 상태가 변경되었습니다',
  CAL_CREATED: '수업일정이 등록되었습니다',
  CAL_UPDATED: '수업일정이 변경되었습니다',
  REVIEW_OVERDUE: '수업 피드백·숙제 미완료',
  PASSWORD_RESET_REQUEST: '비밀번호 재발급 요청이 접수되었습니다',
};
const FALLBACK = '새 알림이 도착했습니다';
/** 잠금 화면 미리보기 길이(글자). */
export const PREVIEW_MAX = 120;

/** 채팅 메시지 → 미리보기 한 줄(공백 정리·길이 제한, 파일은 파일명). */
export function chatPreview(msg?: {
  type?: string | null;
  content?: string | null;
  filename?: string | null;
}): string {
  if (!msg) return '';
  const raw =
    msg.type === 'FILE'
      ? `📎 ${msg.filename ?? ''}`
      : String(msg.content ?? '');
  const flat = raw.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_MAX
    ? `${flat.slice(0, PREVIEW_MAX - 1)}…`
    : flat;
}

type Payload = Record<string, string | number | null | undefined>;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');

export function pushText(
  item: { type?: string; payload?: Payload | null },
  /** 채팅 메시지 미리보기(chatPreview). 있으면 제목=누가·어디, 본문=내용 */
  preview = '',
): { title: string; body: string } {
  const p = item.payload ?? {};
  const sender = text(p.senderName);
  const who = sender ? `${sender}님` : '';
  const chat = (head: string) =>
    preview ? { title: head, body: preview } : { title: 'ACM', body: head };
  switch (item.type) {
    case 'CHAT_MENTION':
      return chat(
        join(
          `${who ? who + '이 ' : ''}채팅에서 나를 멘션했습니다`,
          text(p.title),
        ),
      );
    case 'CHAT_MESSAGE':
      return chat(join(who ? `${who}의 새 메시지` : '새 채팅', text(p.title)));
    case 'ISSUE_MENTION':
      return {
        title: 'ACM',
        body: join(
          `${who ? who + '이 ' : ''}${p.commentId ? '이슈 댓글에서' : '이슈에서'} 나를 멘션했습니다`,
          text(p.title),
        ),
      };
    case 'CSL_CREATED':
    case 'CSL_STAGE':
      return {
        title: 'ACM',
        body: join(LABELS[item.type], p.seqNo ? `#${String(p.seqNo)}` : ''),
      };
    default:
      return {
        title: 'ACM',
        body: join((item.type && LABELS[item.type]) || FALLBACK, text(p.title)),
      };
  }
}
