/** REQ-261021B — access-log vocabulary (mirrors sql/acm/1049 CHECK constraints). */
export const AUD_SYSTEM_ENT = '00000000-0000-0000-0000-0000000000ff';
export type ActorKind = 'CONSOLE' | 'PORTAL';
export const ACCESS_EVENTS = [
  'LOGIN',
  'LOGOUT',
  'LOCKED',
  'UNLOCKED',
  'IP_BLOCKED',
  'PASSWORD_CHANGED',
  'TEMP_PASSWORD_ISSUED',
  'SSO_EXCHANGE',
] as const;
export type AccessEvent = (typeof ACCESS_EVENTS)[number];
export type AccessResult = 'SUCCESS' | 'FAILURE';
export type AccessMethod = 'PASSWORD' | 'SSO' | 'OTP';
export type AccessReason =
  | 'BAD_PASSWORD'
  | 'NO_ACCOUNT'
  | 'LOCKED'
  | 'TEMP_LOCKED'
  | 'INACTIVE'
  | 'TEMP_PASSWORD_EXPIRED'
  | 'SEED_PASSWORD'
  | 'IP_BLOCKED'
  | 'SSO_INVALID'
  | 'AUTO'
  | 'ADMIN'
  | 'SELF';

export interface AccessActor {
  entId: string;
  kind: ActorKind;
  id?: string | null;
  name?: string | null;
  role?: string | null;
  loginId?: string | null;
}

/** `abcdef@gmail.com` → `ab***@gmail.com`; `p1023` → `p1***`. */
export function maskLoginId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().slice(0, 200);
  const at = v.indexOf('@');
  const head = at >= 0 ? v.slice(0, at) : v;
  return `${head.slice(0, 2)}***${at >= 0 ? v.slice(at) : ''}`;
}
