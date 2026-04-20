'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Program, CreateProgramRequest, UpdateProgramRequest } from '@/types/program';

export function usePrograms(filters?: {
  status?: string;
  category?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['programs', filters],
    queryFn: () => api.get<Program[]>(`/programs${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useProgram(id: number) {
  return useQuery({
    queryKey: ['programs', id],
    queryFn: () => api.get<Program>(`/programs/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProgramRequest) =>
      api.post<Program>('/programs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}

export function useUpdateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProgramRequest }) =>
      api.patch<Program>(`/programs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
    },
  });
}
