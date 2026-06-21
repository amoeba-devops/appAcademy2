import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * REQ-260621 v1.1 — hidden admin-menu keys for the caller's own tenant.
 * Used by AppShell to filter the sidebar (UI-only). Fail-open: on error the
 * caller treats the set as empty (all menus visible).
 */
export function useMyHiddenMenus() {
  return useQuery({
    queryKey: ['me-menus'],
    queryFn: async () => {
      const res = await apiClient.get<{ hidden: string[] }>('/acm/me/menus');
      return res.data.hidden;
    },
    staleTime: 5 * 60_000,
  });
}
