import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ClassSummary, ClassDetail, ClsStatus, ClsSubjectType } from '../types';

export interface ListClassesQuery {
  status?: ClsStatus;
  subjectType?: ClsSubjectType;
  teacherUserId?: string;
  studentUserId?: string;
}

export function useClasses(params: ListClassesQuery = {}) {
  return useQuery({
    queryKey: ['cls', 'classes', params],
    queryFn: async () => {
      const res = await apiClient.get<
        ClassSummary[] | { items: ClassSummary[]; total: number }
      >('/acm/cls/classes', { params });
      const data = res.data;
      return Array.isArray(data) ? { items: data, total: data.length } : data;
    },
  });
}

export function useClass(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['cls', 'classes', id],
    queryFn: async () => (await apiClient.get<ClassDetail>(`/acm/cls/classes/${id}`)).data,
  });
}
