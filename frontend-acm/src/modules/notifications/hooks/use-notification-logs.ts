import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { NotificationLogResponse } from '../types';

export interface NotificationLogFilters {
  page?: number;
  limit?: number;
  event?: string;
  status?: string;
}

export function useNotificationLogs(filters: NotificationLogFilters = {}) {
  return useQuery({
    queryKey: ['notifications', 'logs', filters],
    queryFn: async () => {
      const res = await apiClient.get<NotificationLogResponse>('/notifications/logs', {
        params: filters,
      });
      return res.data;
    },
  });
}
