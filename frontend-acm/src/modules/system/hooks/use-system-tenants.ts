import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** REQ-260621 v1.1 — tenant registry + per-tenant menu visibility (APP_ADMIN). */
export interface Tenant {
  entId: string;
  name: string;
  /** PLN-260708 — portal login code (slug). */
  code: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MenuConfigItem {
  key: string;
  visible: boolean;
  alwaysOn: boolean;
  /** PLN-260728E — 표시 순서(0-기반). */
  order: number;
}

export interface CreateTenantInput {
  entId: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateTenantInput {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  code?: string;
}

const KEY = 'system-tenants';
const BASE = '/acm/system/tenants';

export function useTenants() {
  return useQuery({
    queryKey: [KEY],
    queryFn: async () => (await apiClient.get<Tenant[]>(BASE)).data,
  });
}

export function useTenant(entId: string | undefined) {
  return useQuery({
    enabled: !!entId,
    queryKey: [KEY, entId],
    queryFn: async () => (await apiClient.get<Tenant>(`${BASE}/${entId}`)).data,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantInput) =>
      (await apiClient.post<Tenant>(BASE, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entId, input }: { entId: string; input: UpdateTenantInput }) =>
      (await apiClient.patch<Tenant>(`${BASE}/${entId}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useTenantMenus(entId: string | undefined) {
  return useQuery({
    enabled: !!entId,
    queryKey: [KEY, entId, 'menus'],
    queryFn: async () =>
      (await apiClient.get<MenuConfigItem[]>(`${BASE}/${entId}/menus`)).data,
  });
}

export function useUpdateTenantMenus(entId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: { key: string; visible: boolean; order?: number }[],
    ) => (await apiClient.put<MenuConfigItem[]>(`${BASE}/${entId}/menus`, { items })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, entId, 'menus'] }),
  });
}
