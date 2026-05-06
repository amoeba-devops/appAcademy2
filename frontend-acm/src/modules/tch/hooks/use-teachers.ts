import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ListTeachersQuery,
  ListTeachersResponse,
  TeacherDetail,
} from '../types';

const KEY = 'tch';

export function useTeachers(params: ListTeachersQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'teachers', params],
    queryFn: async () => {
      const res = await apiClient.get<ListTeachersResponse>('/acm/tch/teachers', { params });
      return res.data;
    },
  });
}

export function useTeacher(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'teachers', id],
    queryFn: async () =>
      (await apiClient.get<TeacherDetail>(`/acm/tch/teachers/${id}`)).data,
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<TeacherDetail>('/acm/tch/teachers', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

export function useUpdateTeacher(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.put<TeacherDetail>(`/acm/tch/teachers/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}

export function useResetTeacherPassword(id: string) {
  return useMutation({
    mutationFn: async (tchPassword: string) => {
      await apiClient.patch(`/acm/tch/teachers/${id}/password`, { tchPassword });
    },
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/tch/teachers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'teachers'] }),
  });
}
