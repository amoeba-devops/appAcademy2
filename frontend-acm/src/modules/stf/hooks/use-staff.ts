import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ListStaffQuery, ListStaffResponse, StaffDetail } from '../types';

const KEY = 'stf';

export function useStaff(params: ListStaffQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: async () => {
      const res = await apiClient.get<ListStaffResponse>('/acm/stf/staff', { params });
      return res.data;
    },
  });
}

export function useStaffOne(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'one', id],
    queryFn: async () => (await apiClient.get<StaffDetail>(`/acm/stf/staff/${id}`)).data,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<StaffDetail>('/acm/stf/staff', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'list'] }),
  });
}

export function useUpdateStaff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.put<StaffDetail>(`/acm/stf/staff/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'list'] }),
  });
}

export function useResetStaffPassword(id: string) {
  return useMutation({
    mutationFn: async (stfPassword: string) => {
      await apiClient.patch(`/acm/stf/staff/${id}/password`, { stfPassword });
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/stf/staff/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'list'] }),
  });
}
