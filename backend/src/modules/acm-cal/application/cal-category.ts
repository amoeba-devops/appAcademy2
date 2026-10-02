/** Legacy persisted categories remain readable until each tenant is migrated. */
export const ACTIVE_CAL_CATEGORIES = [
  'MEETING',
  'LEVEL_TEST',
  'DEMO_CLASS',
  'REGULAR_CLASS',
  'OTHER',
] as const;
export type ActiveCalCategory = (typeof ACTIVE_CAL_CATEGORIES)[number];
export function normalizeCalCategory(category: string): ActiveCalCategory {
  if (category === 'CLASS') return 'REGULAR_CLASS';
  if (category === 'EVENT' || category === 'PERSONAL') return 'OTHER';
  return ACTIVE_CAL_CATEGORIES.includes(category as ActiveCalCategory)
    ? (category as ActiveCalCategory)
    : 'OTHER';
}
export function storedCalCategories(category: string): string[] {
  return category === 'REGULAR_CLASS'
    ? ['REGULAR_CLASS', 'CLASS']
    : category === 'OTHER'
      ? ['OTHER', 'EVENT', 'PERSONAL']
      : [category];
}
