import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Session, AttendanceLine, Feedback, Makeup } from '../types';

export interface ListSessionsQuery {
  classId?: string;
  teacherUserId?: string;
  studentUserId?: string;
  from?: string; // ISO
  to?: string;
  status?: string;
}

export function useSessions(params: ListSessionsQuery) {
  return useQuery({
    enabled: !!(params.classId || params.from),
    queryKey: ['cls', 'sessions', params],
    queryFn: async () => {
      const res = await apiClient.get<Session[] | { items: Session[]; total: number }>(
        '/acm/cls/sessions',
        { params },
      );
      const data = res.data;
      return Array.isArray(data) ? { items: data, total: data.length } : data;
    },
  });
}

export function useSession(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['cls', 'sessions', id],
    queryFn: async () => (await apiClient.get<Session>(`/acm/cls/sessions/${id}`)).data,
  });
}

export function useAttendance(sessionId: string | undefined) {
  return useQuery({
    enabled: !!sessionId,
    queryKey: ['cls', 'attendance', sessionId],
    queryFn: async () =>
      (await apiClient.get<AttendanceLine[]>(`/acm/cls/sessions/${sessionId}/attendance`)).data,
  });
}

export function useFeedback(sessionId: string | undefined) {
  return useQuery({
    enabled: !!sessionId,
    queryKey: ['cls', 'feedback', sessionId],
    queryFn: async () =>
      (await apiClient.get<Feedback[]>(`/acm/cls/sessions/${sessionId}/feedback`)).data,
  });
}

export function useMakeups(sessionId?: string) {
  return useQuery({
    queryKey: ['cls', 'makeups', sessionId ?? 'all'],
    queryFn: async () => {
      const res = await apiClient.get<Makeup[]>('/acm/cls/makeups', {
        params: sessionId ? { originalSessionId: sessionId } : undefined,
      });
      return res.data;
    },
  });
}
