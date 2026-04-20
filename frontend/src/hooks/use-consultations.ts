'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  Consultation,
  VisitRecord,
  CreateConsultationRequest,
  UpdateConsultationRequest,
  CreateVisitRecordRequest,
} from '@/types/consultation';

export function useConsultations(filters?: {
  status?: string;
  channel?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.channel) params.set('channel', filters.channel);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['consultations', filters],
    queryFn: () => api.get<Consultation[]>(`/consultations${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function useConsultationDetail(id: number) {
  return useQuery({
    queryKey: ['consultations', id],
    queryFn: () =>
      api.get<{ consultation: Consultation; visits: VisitRecord[] }>(
        `/consultations/${id}`,
      ),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useCreateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      api.post<Consultation>('/consultations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations'] }),
  });
}

export function useUpdateConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateConsultationRequest }) =>
      api.patch<Consultation>(`/consultations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations'] }),
  });
}

export function useUpdateConsultationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch<Consultation>(`/consultations/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations'] }),
  });
}

export function useCreateVisitRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, data }: { consultationId: number; data: CreateVisitRecordRequest }) =>
      api.post<VisitRecord>(`/consultations/${consultationId}/visits`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations'] }),
  });
}
