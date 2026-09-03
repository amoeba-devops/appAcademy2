import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/** 테넌트 일반 설정 — 타임존 (REQ-260903). 조회 키는 lib/tz useTenantTz 와 공유. */
export interface TenantSettings {
  timezone: string;
}

export function useTenantSettings() {
  return useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () =>
      (await apiClient.get<TenantSettings>('/acm/me/tenant-settings')).data,
  });
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TenantSettings) =>
      (await apiClient.put<TenantSettings>('/acm/admin/tenant-settings', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-settings'] }),
  });
}
