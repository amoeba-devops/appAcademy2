/**
 * REQ-260621 v1.1 — canonical admin sidebar menu keys.
 *
 * Must stay in sync with the frontend NAV (frontend-acm app-shell.tsx) and the
 * shared FE constant (frontend-acm/src/lib/admin-menu-keys.ts).
 *
 * `dashboard` is always visible (core landing) and cannot be toggled off.
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
  'calStats',
  'sch',
  'ref',
  'posts',
  'notifications',
  'enrollments',
  'map',
  'qna',
  'chat',
  'config',
] as const;

export const ALL_MENU_KEYS = [
  ...ALWAYS_ON_MENU_KEYS,
  ...TOGGLEABLE_MENU_KEYS,
] as const;

export type AdminMenuKey = (typeof ALL_MENU_KEYS)[number];

export function isAdminMenuKey(v: string): v is AdminMenuKey {
  return (ALL_MENU_KEYS as readonly string[]).includes(v);
}

export function isAlwaysOn(key: string): boolean {
  return (ALWAYS_ON_MENU_KEYS as readonly string[]).includes(key);
}
