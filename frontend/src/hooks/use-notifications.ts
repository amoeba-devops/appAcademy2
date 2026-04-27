'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface NotificationLog {
  id: number;
  academyId: number;
  event: string;
  templateId: number | null;
  channel: string;
  recipient: string;
  recipientKind: string | null;
  subjectId: number | null;
  subjectKind: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  providerMsgId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
  body?: string;
  variables?: Record<string, string | number>;
}

export interface NotificationLogFilters {
  event?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export function useNotificationLogs(filters: NotificationLogFilters = {}) {
  const params = new URLSearchParams();
  if (filters.event) params.set('event', filters.event);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['notification-logs', filters],
    queryFn: () =>
      api.get<NotificationLog[]>(
        `/notifications/logs${qs ? `?${qs}` : ''}`,
      ),
  });
}

export function useNotificationLog(id: number | null) {
  return useQuery({
    queryKey: ['notification-logs', id],
    queryFn: () => api.get<NotificationLog>(`/notifications/logs/${id}`),
    select: (res) => res.data,
    enabled: !!id,
  });
}

export function useResendNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<{ ok: boolean; original_log_id: number }>(
        `/notifications/logs/${id}/resend`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
  });
}

export function useTestSendTemplate() {
  return useMutation({
    mutationFn: ({
      templateId,
      to,
      variables,
    }: {
      templateId: number;
      to: string;
      variables: Record<string, string>;
    }) =>
      api.post<{ ok: boolean; templateId: number; recipient: string }>(
        `/notification-templates/${templateId}/test-send`,
        { to, variables },
      ),
  });
}
