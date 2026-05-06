import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  CreateMpqInput,
  ListMpqQuery,
  ListMpqResponse,
  MpqDetail,
  MpqImportResult,
  UpdateMpqInput,
} from '../types';

const KEY = 'mpq';

export function useMpqList(params: ListMpqQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: async () => {
      const res = await apiClient.get<ListMpqResponse>('/acm/map/questions', { params });
      return res.data;
    },
  });
}

export function useMpq(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'detail', id],
    queryFn: async () => (await apiClient.get<MpqDetail>(`/acm/map/questions/${id}`)).data,
  });
}

export function useCreateMpq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateMpqInput) => {
      const res = await apiClient.post<MpqDetail>('/acm/map/questions', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateMpq(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateMpqInput | Record<string, unknown>) => {
      const res = await apiClient.put<MpqDetail>(`/acm/map/questions/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function usePatchMpqAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, answerIndex }: { id: string; answerIndex: number | null }) => {
      const res = await apiClient.patch<MpqDetail>(`/acm/map/questions/${id}/answer`, {
        answerIndex,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteMpq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/map/questions/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useImportMpq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<MpqImportResult>('/acm/map/questions/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
