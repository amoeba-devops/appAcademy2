import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  ImportResult,
  ListStudentsQuery,
  ListStudentsResponse,
  StudentDetail,
} from '../types';

const KEY = 'std';

export function useStudents(params: ListStudentsQuery = {}) {
  return useQuery({
    queryKey: [KEY, 'students', params],
    queryFn: async () => {
      const res = await apiClient.get<ListStudentsResponse>('/acm/std/students', { params });
      return res.data;
    },
  });
}

export function useStudent(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'students', id],
    queryFn: async () => (await apiClient.get<StudentDetail>(`/acm/std/students/${id}`)).data,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<StudentDetail>('/acm/std/students', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useUpdateStudent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.put<StudentDetail>(`/acm/std/students/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useChangeStudentStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stdStatus: string) => {
      const res = await apiClient.patch(`/acm/std/students/${id}/status`, { stdStatus });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/std/students/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}

export function useImportStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post<ImportResult>('/acm/std/students/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'students'] }),
  });
}
