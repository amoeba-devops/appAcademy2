import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { FALLBACK_COLOR, toHex } from '../lib/cal-colors';

/** REQ-261128-CAL — tenant calendar categories (5 system + editable ones). */
export interface CalCategoryItem {
  code: string;
  /** Admin-entered name; null → translated label `cal:category.<code>`. */
  name: string | null;
  system: boolean;
  inStats?: boolean;
  sortOrder: number;
  color: string | null;
  active: boolean;
  eventCount?: number;
}

export const SYSTEM_CATEGORY_CODES = [
  'MEETING',
  'LEVEL_TEST',
  'DEMO_CLASS',
  'REGULAR_CLASS',
  'OTHER',
] as const;

/** Default colors when the tenant has not picked one. */
export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  REGULAR_CLASS: '#3b82f6',
  DEMO_CLASS: '#a855f7',
  MEETING: '#a855f7',
  LEVEL_TEST: '#f59e0b',
  OTHER: '#10b981',
  AVAILABLE: '#22c55e',
  UNAVAILABLE: '#ef4444',
  CANCELED: '#8b5cf6',
  ABSENT: '#f43f5e',
};

/** Used before the list loads (and if it fails): the fixed system set. */
const FALLBACK: CalCategoryItem[] = SYSTEM_CATEGORY_CODES.map((code, i) => ({
  code,
  name: null,
  system: true,
  sortOrder: i,
  color: null,
  active: true,
}));

export function calCategoriesQueryKey(scope: 'admin' | 'portal') {
  return ['cal', 'categories', scope] as const;
}

export function useCalCategories(scope: 'admin' | 'portal' = 'admin') {
  const { t } = useTranslation('cal');
  const { data } = useQuery({
    queryKey: calCategoriesQueryKey(scope),
    queryFn: async () =>
      (
        await apiClient.get<CalCategoryItem[]>(
          scope === 'admin' ? '/acm/cal/categories' : '/portal/cal/categories',
        )
      ).data,
    staleTime: 60_000,
  });
  const all = data?.length ? data : FALLBACK;
  const byCode = useMemo(() => new Map(all.map((c) => [c.code, c])), [all]);
  const active = useMemo(
    () => all.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [all],
  );
  const label = useCallback(
    (code: string | null | undefined) => {
      if (!code) return '';
      const c = byCode.get(code);
      return c?.name || t(`category.${code}`, code);
    },
    [byCode, t],
  );
  /** Category's own color (hex) or the default for that code. */
  const colorOf = useCallback(
    (code: string | null | undefined) =>
      (code && toHex(byCode.get(code)?.color)) ||
      (code && DEFAULT_CATEGORY_COLORS[code]) ||
      FALLBACK_COLOR,
    [byCode],
  );
  return { all, active, byCode, label, colorOf, loaded: !!data };
}

/** Non-zero counts in category order; unknown codes (e.g. legacy) go last. */
export function categoryCounts(
  byCategory: Record<string, number>,
  categories: { all: CalCategoryItem[] },
): [string, number][] {
  const order = new Map(
    [...categories.all]
      .sort((a, b) => Number(!a.active) - Number(!b.active) || a.sortOrder - b.sortOrder)
      .map((c, i) => [c.code, i]),
  );
  return Object.entries(byCategory)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}
