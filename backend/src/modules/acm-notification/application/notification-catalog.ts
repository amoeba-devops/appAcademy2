/**
 * REQ-261102B — 알림 상황·경로 목록과 설정 기본값.
 * 저장된 설정(JSONB)은 항상 normalize 를 거쳐 읽는다. 없는 값 = 기본값(기존 동작).
 */
export const NOTIFY_TYPES = [
  'CSL_CREATED',
  'CSL_STAGE',
  'CAL_CREATED',
  'CAL_UPDATED',
  'REVIEW_OVERDUE',
  'CHAT_MESSAGE',
  'CHAT_MENTION',
  'ISSUE_MENTION',
  'PASSWORD_RESET_REQUEST',
  'MAP_APPLY',
] as const;
export type NotifyType = (typeof NOTIFY_TYPES)[number];
export type NotifyChannel = 'inbox' | 'push' | 'popup' | 'mail' | 'alimtalk';
/** ADMIN 은 APP_ADMIN 을 포함한다. TEACHER 는 담당 강사. */
export type NotifyRole = 'ADMIN' | 'STAFF' | 'TEACHER';
/** 개인이 끌 수 있는 경로. */
export type PersonalChannel = 'inbox' | 'push' | 'popup';

export interface NotifySpec {
  channels: NotifyChannel[];
  /** 고를 수 있는 받는 역할. 빈 배열 = 대상이 정해진 상황(채팅방 참여자·멘션 등). */
  roles: NotifyRole[];
  /** 항상 켜짐(설정 불가). */
  fixed?: NotifyChannel[];
}
export const NOTIFY_SPEC: Record<NotifyType, NotifySpec> = {
  CSL_CREATED: {
    channels: ['inbox', 'push', 'popup'],
    roles: ['ADMIN', 'STAFF'],
    fixed: ['popup'],
  },
  CSL_STAGE: { channels: ['inbox', 'push'], roles: ['ADMIN', 'STAFF'] },
  CAL_CREATED: {
    channels: ['inbox', 'push'],
    roles: ['ADMIN', 'STAFF', 'TEACHER'],
  },
  CAL_UPDATED: {
    channels: ['inbox', 'push'],
    roles: ['ADMIN', 'STAFF', 'TEACHER'],
  },
  REVIEW_OVERDUE: { channels: ['inbox', 'push'], roles: ['ADMIN', 'TEACHER'] },
  CHAT_MESSAGE: { channels: ['inbox', 'push', 'popup'], roles: [] },
  CHAT_MENTION: { channels: ['inbox', 'push'], roles: [] },
  ISSUE_MENTION: { channels: ['inbox', 'push'], roles: [] },
  PASSWORD_RESET_REQUEST: { channels: ['inbox', 'push'], roles: [] },
  MAP_APPLY: { channels: ['mail', 'alimtalk'], roles: [] },
};

export interface TypeSetting {
  inbox: boolean;
  push: boolean;
  popup: boolean;
  mail: boolean;
  alimtalk: boolean;
  roles: NotifyRole[];
}
export interface Quiet {
  on: boolean;
  start: string;
  end: string;
}
export interface TenantNotifyConfig {
  types: Record<NotifyType, TypeSetting>;
  push: { enabled: boolean; chatPreview: boolean; quiet: Quiet };
  reminder: { first: number; second: number };
}
export interface PersonalPrefs {
  types: Partial<Record<NotifyType, Partial<Record<PersonalChannel, boolean>>>>;
  quiet: Quiet;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const hours = (v: unknown, d: number) =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 48
    ? (v as number)
    : d;

function quiet(raw: unknown, d: Quiet): Quiet {
  const q = isObj(raw) ? raw : {};
  return {
    on: bool(q.on, d.on),
    start:
      typeof q.start === 'string' && HHMM.test(q.start) ? q.start : d.start,
    end: typeof q.end === 'string' && HHMM.test(q.end) ? q.end : d.end,
  };
}
const DEFAULT_QUIET: Quiet = { on: false, start: '22:00', end: '08:00' };

export function normalizeTenant(raw: unknown): TenantNotifyConfig {
  const r = isObj(raw) ? raw : {};
  const rt = isObj(r.types) ? r.types : {};
  const types = {} as Record<NotifyType, TypeSetting>;
  for (const type of NOTIFY_TYPES) {
    const spec = NOTIFY_SPEC[type];
    const t = isObj(rt[type]) ? rt[type] : {};
    const roles = Array.isArray(t.roles)
      ? spec.roles.filter((x) => (t.roles as unknown[]).includes(x))
      : [...spec.roles];
    const ch = (c: NotifyChannel) =>
      spec.fixed?.includes(c) ? true : bool(t[c], true);
    types[type] = {
      inbox: ch('inbox'),
      push: ch('push'),
      popup: ch('popup'),
      mail: ch('mail'),
      alimtalk: ch('alimtalk'),
      roles,
    };
  }
  const p = isObj(r.push) ? r.push : {};
  const rem = isObj(r.reminder) ? r.reminder : {};
  let first = hours(rem.first, 5);
  let second = hours(rem.second, 10);
  if (second <= first) [first, second] = [5, 10];
  return {
    types,
    push: {
      enabled: bool(p.enabled, true),
      chatPreview: bool(p.chatPreview, true),
      quiet: quiet(p.quiet, DEFAULT_QUIET),
    },
    reminder: { first, second },
  };
}

export function normalizePersonal(raw: unknown): PersonalPrefs {
  const r = isObj(raw) ? raw : {};
  const rt = isObj(r.types) ? r.types : {};
  const types: PersonalPrefs['types'] = {};
  for (const type of NOTIFY_TYPES) {
    const t = isObj(rt[type]) ? rt[type] : null;
    if (!t) continue;
    const spec = NOTIFY_SPEC[type];
    const out: Partial<Record<PersonalChannel, boolean>> = {};
    for (const c of ['inbox', 'push', 'popup'] as const)
      if (
        spec.channels.includes(c) &&
        !spec.fixed?.includes(c) &&
        t[c] === false
      )
        out[c] = false;
    if (Object.keys(out).length) types[type] = out;
  }
  return { types, quiet: quiet(r.quiet, DEFAULT_QUIET) };
}

/** 학원 설정 AND 개인 설정. */
export function personalOn(
  tenant: TenantNotifyConfig,
  prefs: PersonalPrefs | null,
  type: string,
  channel: PersonalChannel,
): boolean {
  if (!(NOTIFY_TYPES as readonly string[]).includes(type)) return true;
  const t = type as NotifyType;
  if (NOTIFY_SPEC[t].fixed?.includes(channel)) return true;
  if (!tenant.types[t][channel]) return false;
  if (channel === 'push' && !tenant.push.enabled) return false;
  return prefs?.types[t]?.[channel] !== false;
}

/** 역할 → amb_acm_user.usr_role 값. */
export function userRolesOf(roles: NotifyRole[]): string[] {
  return roles.flatMap((r) => (r === 'ADMIN' ? ['ADMIN', 'APP_ADMIN'] : [r]));
}

const minutesOf = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * 방해 금지 시간이면 끝나는 시각, 아니면 null. 시간대는 학원 시간대.
 * 시작=끝이면 사용 안 함. 자정을 넘는 구간(22:00~08:00) 지원.
 */
export function quietUntil(now: Date, tz: string, q: Quiet): Date | null {
  if (!q.on) return null;
  const s = minutesOf(q.start);
  const e = minutesOf(q.end);
  if (s === e) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const m =
    Number(parts.find((p) => p.type === 'hour')?.value) * 60 +
    Number(parts.find((p) => p.type === 'minute')?.value);
  const inside = s < e ? m >= s && m < e : m >= s || m < e;
  if (!inside) return null;
  const wait = (e - m + 1440) % 1440;
  const at = new Date(now.getTime() + wait * 60000);
  at.setUTCSeconds(0, 0);
  return at;
}
