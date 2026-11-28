/**
 * System categories are fixed codes: other modules depend on them (video
 * rooms, CSL schedules, review reminders, the external scheduler API).
 * Tenants may add their own categories (REQ-261128-CAL) — see CalCategoryService.
 */
export const ACTIVE_CAL_CATEGORIES = [
  'MEETING',
  'LEVEL_TEST',
  'DEMO_CLASS',
  'REGULAR_CLASS',
  'OTHER',
] as const;
export type ActiveCalCategory = (typeof ACTIVE_CAL_CATEGORIES)[number];
export const SYSTEM_CAL_CATEGORIES = ACTIVE_CAL_CATEGORIES;

/** Retired codes still present in old rows; never accepted as input. */
export const LEGACY_CAL_CATEGORIES = ['CLASS', 'EVENT', 'PERSONAL'] as const;

/** Upper-snake code, max 20 chars (evt_category VARCHAR(20)). */
export const CAL_CATEGORY_CODE_RE = /^[A-Z][A-Z0-9_]{1,19}$/;

/** Default (non-system) categories seeded for every tenant; editable/deletable. */
export const SEEDED_CAL_CATEGORIES = [
  'AVAILABLE',
  'UNAVAILABLE',
  'CANCELED',
  'ABSENT',
] as const;

/**
 * REQ-261128C — events in these categories never block booking a lesson in
 * the same slot (teacher availability, canceled classes). Everything else,
 * including admin-added categories, keeps the slot occupied.
 */
export const NON_BLOCKING_CAL_CATEGORIES = ['AVAILABLE', 'CANCELED'] as const;

export function calCategoryBlocksBooking(category: string): boolean {
  return !(NON_BLOCKING_CAL_CATEGORIES as readonly string[]).includes(
    normalizeCalCategory(category),
  );
}

export function isSystemCalCategory(code: string): code is ActiveCalCategory {
  return (ACTIVE_CAL_CATEGORIES as readonly string[]).includes(code);
}

/**
 * Maps retired codes to their successors. Tenant categories pass through;
 * anything that is not a valid code reads as OTHER.
 */
export function normalizeCalCategory(category: string): string {
  if (category === 'CLASS') return 'REGULAR_CLASS';
  if (category === 'EVENT' || category === 'PERSONAL') return 'OTHER';
  return CAL_CATEGORY_CODE_RE.test(category ?? '') ? category : 'OTHER';
}

/** For consumers with a fixed contract (external API): tenant codes → OTHER. */
export function systemCalCategory(category: string): ActiveCalCategory {
  const c = normalizeCalCategory(category);
  return isSystemCalCategory(c) ? c : 'OTHER';
}

export function storedCalCategories(category: string): string[] {
  return category === 'REGULAR_CLASS'
    ? ['REGULAR_CLASS', 'CLASS']
    : category === 'OTHER'
      ? ['OTHER', 'EVENT', 'PERSONAL']
      : [category];
}
