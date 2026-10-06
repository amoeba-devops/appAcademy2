/**
 * REQ-261006 — AMA 로 전달할 알림 제목·본문·링크.
 *
 * 수신자 언어를 알 수 없어 테넌트 단위 locale(env `AMA_FORWARD_LOCALE`, 기본 ko)
 * 으로 렌더링한다. 4 locale 동시 유지(CLAUDE.md i18n 규칙).
 */
export type ForwardLocale = 'ko' | 'en' | 'vi' | 'zh-CN';
export const FORWARD_TYPES = [
  'CSL_CREATED',
  'CSL_STAGE',
  'CAL_CREATED',
  'CAL_UPDATED',
  'CHAT_MENTION',
] as const;
export type ForwardType = (typeof FORWARD_TYPES)[number];

type Payload = Record<string, string | number | null | undefined>;

const STAGE: Record<ForwardLocale, Record<string, string>> = {
  ko: {
    INTAKE: '접수',
    MAP_TEST: '레벨테스트',
    TRIAL_CLASS: '데모수업',
    ENROLLMENT_COUNSELING: '등록 상담',
    PAYMENT: '결제',
    CLASS_STARTED: '수강등록',
    ATTENDING: '수강중',
    DROPPED: '완료',
  },
  en: {
    INTAKE: 'Intake',
    MAP_TEST: 'Level test',
    TRIAL_CLASS: 'Trial class',
    ENROLLMENT_COUNSELING: 'Enrollment counseling',
    PAYMENT: 'Payment',
    CLASS_STARTED: 'Enrolled',
    ATTENDING: 'Attending',
    DROPPED: 'Closed',
  },
  vi: {
    INTAKE: 'Tiếp nhận',
    MAP_TEST: 'Kiểm tra trình độ',
    TRIAL_CLASS: 'Lớp thử',
    ENROLLMENT_COUNSELING: 'Tư vấn đăng ký',
    PAYMENT: 'Thanh toán',
    CLASS_STARTED: 'Đã đăng ký',
    ATTENDING: 'Đang học',
    DROPPED: 'Kết thúc',
  },
  'zh-CN': {
    INTAKE: '接收',
    MAP_TEST: '等级测试',
    TRIAL_CLASS: '试听课',
    ENROLLMENT_COUNSELING: '报名咨询',
    PAYMENT: '缴费',
    CLASS_STARTED: '已报名',
    ATTENDING: '在读',
    DROPPED: '结束',
  },
};

const T: Record<
  ForwardLocale,
  Record<ForwardType, (p: Payload) => { title: string; body: string }>
> = {
  ko: {
    CSL_CREATED: (p) => ({
      title: `[ACM] 신규 상담 접수 #${p.seqNo ?? '-'}`,
      body: '새 상담이 접수되었습니다. ACM 콘솔에서 확인하세요.',
    }),
    CSL_STAGE: (p) => ({
      title: `[ACM] 상담 #${p.seqNo ?? '-'} 단계 변경`,
      body: `${stage('ko', p.fromStage)} → ${stage('ko', p.toStage)}`,
    }),
    CAL_CREATED: (p) => ({
      title: '[ACM] 일정 등록',
      body: String(p.title ?? ''),
    }),
    CAL_UPDATED: (p) => ({
      title: '[ACM] 일정 변경',
      body: String(p.title ?? ''),
    }),
    CHAT_MENTION: () => ({
      title: '[ACM] 채팅에서 언급되었습니다',
      body: 'ACM 채팅을 확인하세요.',
    }),
  },
  en: {
    CSL_CREATED: (p) => ({
      title: `[ACM] New inquiry #${p.seqNo ?? '-'}`,
      body: 'A new consultation was received. Open the ACM console.',
    }),
    CSL_STAGE: (p) => ({
      title: `[ACM] Inquiry #${p.seqNo ?? '-'} stage changed`,
      body: `${stage('en', p.fromStage)} → ${stage('en', p.toStage)}`,
    }),
    CAL_CREATED: (p) => ({
      title: '[ACM] Event created',
      body: String(p.title ?? ''),
    }),
    CAL_UPDATED: (p) => ({
      title: '[ACM] Event updated',
      body: String(p.title ?? ''),
    }),
    CHAT_MENTION: () => ({
      title: '[ACM] You were mentioned in chat',
      body: 'Open ACM chat.',
    }),
  },
  vi: {
    CSL_CREATED: (p) => ({
      title: `[ACM] Tư vấn mới #${p.seqNo ?? '-'}`,
      body: 'Có tư vấn mới. Mở bảng điều khiển ACM để xem.',
    }),
    CSL_STAGE: (p) => ({
      title: `[ACM] Tư vấn #${p.seqNo ?? '-'} đổi giai đoạn`,
      body: `${stage('vi', p.fromStage)} → ${stage('vi', p.toStage)}`,
    }),
    CAL_CREATED: (p) => ({
      title: '[ACM] Lịch mới',
      body: String(p.title ?? ''),
    }),
    CAL_UPDATED: (p) => ({
      title: '[ACM] Lịch thay đổi',
      body: String(p.title ?? ''),
    }),
    CHAT_MENTION: () => ({
      title: '[ACM] Bạn được nhắc trong chat',
      body: 'Mở chat ACM.',
    }),
  },
  'zh-CN': {
    CSL_CREATED: (p) => ({
      title: `[ACM] 新咨询 #${p.seqNo ?? '-'}`,
      body: '收到新的咨询，请在 ACM 控制台查看。',
    }),
    CSL_STAGE: (p) => ({
      title: `[ACM] 咨询 #${p.seqNo ?? '-'} 阶段变更`,
      body: `${stage('zh-CN', p.fromStage)} → ${stage('zh-CN', p.toStage)}`,
    }),
    CAL_CREATED: (p) => ({
      title: '[ACM] 新日程',
      body: String(p.title ?? ''),
    }),
    CAL_UPDATED: (p) => ({
      title: '[ACM] 日程变更',
      body: String(p.title ?? ''),
    }),
    CHAT_MENTION: () => ({
      title: '[ACM] 您在聊天中被提及',
      body: '请打开 ACM 聊天。',
    }),
  },
};

function stage(locale: ForwardLocale, code: unknown): string {
  const c = String(code ?? '');
  return STAGE[locale][c] ?? c;
}

export function normalizeForwardLocale(raw: unknown): ForwardLocale {
  const s = String(raw ?? '').trim();
  return (['ko', 'en', 'vi', 'zh-CN'] as const).includes(s as ForwardLocale)
    ? (s as ForwardLocale)
    : 'ko';
}

/** ACM 콘솔 내 경로 — inbox href 와 동일 규칙. */
export function forwardHref(
  type: string,
  targetId: string,
  payload: Payload,
): string {
  if (type.startsWith('CSL_')) return `/admin/csl/${targetId}`;
  if (type.startsWith('CAL_')) return `/admin/cal/${targetId}`;
  const channel = encodeURIComponent(String(payload.channelId ?? ''));
  return `/admin/chat?channelId=${channel}&messageId=${targetId}`;
}

/** AMA 알림 클릭 → ACM 로그인(세션 있으면 즉시) → returnTo 로 SSO 재진입. */
export function forwardLink(publicUrl: string, href: string): string {
  return `${publicUrl.replace(/\/$/, '')}/login?returnTo=${encodeURIComponent(href)}`;
}

export function renderForward(
  locale: ForwardLocale,
  type: string,
  payload: Payload,
): { title: string; body: string } {
  const fn = T[locale][type as ForwardType] ?? T[locale].CSL_CREATED;
  const out = fn(payload);
  return { title: out.title.slice(0, 200), body: out.body.slice(0, 500) };
}
