import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useNotificationLogs } from '../hooks/use-notification-logs';
import type { NotificationLog } from '../types';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RETRYING', label: 'Retrying' },
] as const;

export function NotificationsListPage() {
  const { t, i18n } = useTranslation('admin');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();
  const { data, isLoading } = useNotificationLogs({
    status: status || undefined,
    page: 1,
    limit: 20,
  });

  const resendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post(`/notifications/logs/${id}/resend`);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'logs'] });
      window.alert(t('notifications.resendSuccess', 'Resend request submitted.'));
    },
  });

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            {t('notifications.title', 'Notifications')}
          </h1>
          <p className="text-secondary max-w-2xl">
            {t(
              'notifications.description',
              'Review and manage notification history for message delivery and alerts.',
            )}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border-subtle)] bg-surface p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-secondary">{t('notifications.filter.status', 'Status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`notifications.status.${item.value || 'all'}`, item.label)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-secondary">
            {t('notifications.totalCount', {
              defaultValue: '{{count}} records',
              count: data?.meta.total ?? 0,
            })}
          </p>
        </div>

        {isLoading ? (
          <p className="text-secondary">{t('common:status.loading', 'Loading notification history...')}</p>
        ) : !data || data.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center text-secondary">
            {t('notifications.empty', 'No notifications were found for the selected filters.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--gray-100)] text-secondary">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{t('notifications.table.event', 'Event')}</th>
                  <th className="px-4 py-3">{t('notifications.table.channel', 'Channel')}</th>
                  <th className="px-4 py-3">{t('notifications.table.recipient', 'Recipient')}</th>
                  <th className="px-4 py-3">{t('notifications.table.status', 'Status')}</th>
                  <th className="px-4 py-3">{t('notifications.table.sentAt', 'Sent')}</th>
                  <th className="px-4 py-3">{t('notifications.table.createdAt', 'Created')}</th>
                  <th className="px-4 py-3">{t('actions.action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log: NotificationLog) => (
                  <tr key={log.id} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-3 text-secondary">{log.id}</td>
                    <td className="px-4 py-3">{log.event}</td>
                    <td className="px-4 py-3 text-secondary">{log.channel}</td>
                    <td className="px-4 py-3 text-secondary">{log.recipient}</td>
                    <td className="px-4 py-3 text-secondary">{log.status}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(log.sentAt)}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={log.status === 'SENT' || resendMutation.isPending}
                        onClick={() => resendMutation.mutate(log.id)}
                      >
                        {t('notifications.actions.resend', 'Resend')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
