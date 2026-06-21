/**
 * REQ-260621 v1.1 — canonical admin sidebar menu keys.
 * Must stay in sync with backend admin-menu-keys.ts and the AppShell NAV.
 * `dashboard` is always visible and cannot be toggled off per tenant.
 */
export const ALWAYS_ON_MENU_KEYS = ['dashboard'] as const;

export const TOGGLEABLE_MENU_KEYS = [
  'csl',
  'std',
  'parents',
  'cls',
  'tch',
  'stf',
  'cal',
  'sch',
  'ref',
  'posts',
  'notifications',
  'enrollments',
  'map',
  'qna',
  'config',
] as const;

export const ALL_MENU_KEYS = [
  ...ALWAYS_ON_MENU_KEYS,
  ...TOGGLEABLE_MENU_KEYS,
] as const;

export type AdminMenuKey = (typeof ALL_MENU_KEYS)[number];

export function isAlwaysOn(key: string): boolean {
  return (ALWAYS_ON_MENU_KEYS as readonly string[]).includes(key);
}
