import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  CalEvent,
  InviteeCandidate,
  ListCalEventsQuery,
  ListCalEventsResponse,
} from '../types';

const KEY = 'cal';

export function useCalEvents(params: ListCalEventsQuery) {
  return useQuery({
    queryKey: [KEY, 'events', params],
    queryFn: async () => {
      const res = await apiClient.get<ListCalEventsResponse>('/acm/cal/events', { params });
      return res.data;
    },
  });
}

export function useCalEvent(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: [KEY, 'event', id],
    queryFn: async () => (await apiClient.get<CalEvent>(`/acm/cal/events/${id}`)).data,
  });
}

export function useCreateCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.post<CalEvent>('/acm/cal/events', dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'events'] }),
  });
}

export function useUpdateCalEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: Record<string, unknown>) => {
      const res = await apiClient.put<CalEvent>(`/acm/cal/events/${id}`, dto);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'events'] }),
  });
}

export function useDeleteCalEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/acm/cal/events/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, 'events'] }),
  });
}

export function useInviteeCandidates(q: string, kind: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: [KEY, 'invitee-candidates', q, kind],
    queryFn: async () => {
      const res = await apiClient.get<InviteeCandidate[]>('/acm/cal/invitee-candidates', {
        params: { q: q || undefined, kind: kind || 'ALL' },
      });
      return res.data;
    },
  });
}
