import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useEnrollments, useUpdateEnrollmentStatus } from '../hooks/use-enrollments';
import type { Enrollment } from '../types';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'WAITLIST', label: 'Waitlist' },
  { value: 'CANCELED', label: 'Canceled' },
] as const;

export function EnrollmentsListPage() {
  const { t, i18n } = useTranslation('admin');
  const [status, setStatus] = useState('');
  const { data: enrollments = [], isLoading } = useEnrollments({ status: status || undefined });
  const updateStatus = useUpdateEnrollmentStatus();

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '-';

  const onChangeStatus = (enrollment: Enrollment, nextStatus: string) => {
    updateStatus.mutate({ id: enrollment.id, status: nextStatus });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            {t('enrollments.title', 'Enrollments')}
          </h1>
          <p className="text-secondary max-w-2xl">
            {t(
              'enrollments.description',
              'Manage enrollment applications, payment notices, and enrollment progress from this admin view.',
            )}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border-subtle)] bg-surface p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-secondary">{t('enrollments.filter.status', 'Status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`enrollments.status.${item.value || 'all'}`, item.label)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-secondary">
            {t('enrollments.totalCount', {
              defaultValue: '{{count}} enrollments',
              count: enrollments.length,
            })}
          </p>
        </div>

        {isLoading ? (
          <p className="text-secondary">{t('common:status.loading', 'Loading enrollments...')}</p>
        ) : enrollments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center text-secondary">
            {t('enrollments.empty', 'No enrollments found for the selected status.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--gray-100)] text-secondary">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{t('enrollments.table.student', 'Student')}</th>
                  <th className="px-4 py-3">{t('enrollments.table.class', 'Class')}</th>
                  <th className="px-4 py-3">{t('enrollments.table.program', 'Program')}</th>
                  <th className="px-4 py-3">{t('enrollments.table.status', 'Status')}</th>
                  <th className="px-4 py-3">{t('enrollments.table.appliedAt', 'Applied')}</th>
                  <th className="px-4 py-3">{t('actions.action', 'Action')}</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment: Enrollment) => (
                  <tr key={enrollment.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--gray-50)]">
                    <td className="px-4 py-3 text-secondary">{enrollment.id}</td>
                    <td className="px-4 py-3 font-medium">
                      {enrollment.studentName ?? t('enrollments.unknownStudent', 'Unknown')}
                    </td>
                    <td className="px-4 py-3 text-secondary">{enrollment.className ?? '-'}</td>
                    <td className="px-4 py-3 text-secondary">{enrollment.programName ?? '-'}</td>
                    <td className="px-4 py-3 text-secondary">{enrollment.status}</td>
                    <td className="px-4 py-3 text-secondary">{formatDate(enrollment.appliedAt)}</td>
                    <td className="px-4 py-3 space-y-2">
                      {enrollment.status !== 'CONFIRMED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updateStatus.isPending}
                          onClick={() => onChangeStatus(enrollment, 'CONFIRMED')}
                        >
                          {t('enrollments.actions.confirm', 'Confirm')}
                        </Button>
                      )}
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
