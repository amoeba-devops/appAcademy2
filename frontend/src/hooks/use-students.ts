'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  Student,
  CreateStudentRequest,
  UpdateStudentRequest,
  Parent,
  CreateParentRequest,
  UpdateParentRequest,
} from '@/types/student';

// ── Students ──

export function useStudents(filters?: {
  status?: string;
  lifecycleStatus?: string;
  grade?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.lifecycleStatus) params.set('lifecycleStatus', filters.lifecycleStatus);
  if (filters?.grade) params.set('grade', filters.grade);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => api.get<Student[]>(`/students${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useStudent(id: number) {
  return useQuery({
    queryKey: ['students', id],
    queryFn: () => api.get<Student>(`/students/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStudentRequest) => api.post<Student>('/students', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateStudentRequest }) =>
      api.patch<Student>(`/students/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
}

// ── Parents ──

export function useParents(filters?: { search?: string }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['parents', filters],
    queryFn: () => api.get<Parent[]>(`/parents${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useCreateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateParentRequest) => api.post<Parent>('/parents', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parents'] }),
  });
}

export function useUpdateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateParentRequest }) =>
      api.patch<Parent>(`/parents/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parents'] }),
  });
}
