import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ClassDetail, ClsStatus, Feedback } from '../types';

export function useUpdateClassStatus(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: ClsStatus) => {
      if (!id) throw new Error('class id required');
      const res = await apiClient.patch<ClassDetail>(
        `/acm/cls/classes/${id}/status`,
        { status },
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cls', 'classes'] });
    },
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<ClassDetail>('/acm/cls/classes', dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cls', 'classes'] });
    },
  });
}

export function useGenerateClassSessions(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('class id required');
      const res = await apiClient.post<{ generated: number; skipped: number }>(
        `/acm/cls/classes/${id}/sessions/generate`,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cls', 'classes'] });
      void qc.invalidateQueries({ queryKey: ['cls', 'sessions'] });
    },
  });
}

export function useUpsertSessionFeedback(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      if (!sessionId) throw new Error('session id required');
      const res = await apiClient.post<Feedback>(
        `/acm/cls/sessions/${sessionId}/feedback`,
        dto,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cls', 'feedback', sessionId] });
    },
  });
}
