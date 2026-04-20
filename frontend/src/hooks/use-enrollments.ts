'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CreateEnrollmentRequest,
  Enrollment,
  UpdateEnrollmentStatusRequest,
} from '@/types/enrollment';

export function useEnrollments(filters?: {
  status?: string;
  classId?: number;
  studentId?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.classId) params.set('classId', String(filters.classId));
  if (filters?.studentId) params.set('studentId', String(filters.studentId));
  const qs = params.toString();

  return useQuery({
    queryKey: ['enrollments', filters],
    queryFn: () => api.get<Enrollment[]>(`/enrollments${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEnrollmentRequest) => api.post<Enrollment>('/enrollments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateEnrollmentStatusRequest }) =>
      api.patch<Enrollment>(`/enrollments/${id}/status`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}