import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Enrollment } from '../types';

export interface EnrollmentFilters {
  status?: string;
  classId?: string;
  studentId?: string;
}

export function useEnrollments(filters: EnrollmentFilters = {}) {
  return useQuery({
    queryKey: ['enrollments', 'list', filters],
    queryFn: async () => {
      const res = await apiClient.get<Enrollment[]>('/enrollments', {
        params: filters,
      });
      return res.data;
    },
  });
}

export function useUpdateEnrollmentStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch<Enrollment>(`/enrollments/${id}/status`, {
        status,
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enrollments', 'list'] }),
  });
}
