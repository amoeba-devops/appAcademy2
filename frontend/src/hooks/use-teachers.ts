'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Teacher, CreateTeacherRequest, UpdateTeacherRequest } from '@/types/teacher';

export function useTeachers(filters?: {
  status?: string;
  subject?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.subject) params.set('subject', filters.subject);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['teachers', filters],
    queryFn: () => api.get<Teacher[]>(`/teachers${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useTeacher(id: number) {
  return useQuery({
    queryKey: ['teachers', id],
    queryFn: () => api.get<Teacher>(`/teachers/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeacherRequest) =>
      api.post<Teacher>('/teachers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTeacherRequest }) =>
      api.patch<Teacher>(`/teachers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}
