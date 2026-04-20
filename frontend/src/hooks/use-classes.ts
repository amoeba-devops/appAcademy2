'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  ClassInfo,
  ClassDetailResponse,
  Classroom,
  CreateClassRequest,
  UpdateClassRequest,
  RecordSessionRequest,
  ClassSession,
} from '@/types/class';

export function useClasses(filters?: {
  status?: string;
  programId?: number;
  teacherId?: number;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.programId) params.set('programId', String(filters.programId));
  if (filters?.teacherId) params.set('teacherId', String(filters.teacherId));
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['classes', filters],
    queryFn: () => api.get<ClassInfo[]>(`/classes${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useClassDetail(id: number) {
  return useQuery({
    queryKey: ['classes', id],
    queryFn: () => api.get<ClassDetailResponse>(`/classes/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useClassrooms() {
  return useQuery({
    queryKey: ['classrooms'],
    queryFn: () => api.get<Classroom[]>('/classes/classrooms'),
    select: (res) => res.data ?? [],
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClassRequest) =>
      api.post<ClassInfo>('/classes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateClassRequest }) =>
      api.patch<ClassInfo>(`/classes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useRecordSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: RecordSessionRequest }) =>
      api.patch<ClassSession>(`/classes/sessions/${sessionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
