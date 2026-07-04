import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useSessions } from '../hooks/use-sessions';
import type { ClassStudent, Session, SesStatus } from '../types';
import { SessionFeedbackDialog } from './session-feedback-dialog';

const STATUS_CLASS: Record<SesStatus, string> = {
  SCHEDULED: 'bg-accent-50 text-accent-700',
  HELD: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
  RESCHEDULED: 'bg-amber-50 text-amber-700',
  NO_SHOW: 'bg-slate-100 text-slate-700',
  MAKEUP_REPLACEMENT: 'bg-violet-50 text-violet-700',
};

const LIMIT = 8;

export function ClsRecentSessions({
  classId,
  students,
}: {
  classId: string;
  students: ClassStudent[];
}) {
  const { t, i18n } = useTranslation(['cls', 'common']);
  const { data, isLoading } = useSessions({ classId });
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';

  const items = useMemo(
    () =>
      (data?.items ?? [])
        .slice()
        .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
        .slice(0, LIMIT),
    [data],
  );

  if (isLoading) {
    return (
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-sm text-secondary">
        {t('common:status.loading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('detail.sessions.empty')}
      </div>
    );
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-surface">
        <header className="flex items-center justify-between bg-[var(--gray-100)] px-4 py-2 text-sm">
          <span className="font-medium">{t('detail.sessions.title')}</span>
          <span className="text-xs text-secondary">
            {t('detail.sessions.limitNote', { count: LIMIT })}
          </span>
        </header>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {items.map((session: Session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-sm"
            >
              <span className="font-mono">{fmt(session.scheduledAt)}</span>
              <span
                className={clsx(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  STATUS_CLASS[session.status],
                )}
              >
                {t(`session.statuses.${session.status}`)}
              </span>
              <span className="text-secondary">{t(`session.modes.${session.mode}`)}</span>
              {session.cancelReason ? (
                <span className="text-xs text-secondary">
                  {' · '}
                  {t(`session.cancelReasons.${session.cancelReason}`)}
                </span>
              ) : null}
              {session.disposition ? (
                <span className="text-xs text-secondary">
                  {' · '}
                  {t(`session.dispositions.${session.disposition}`)}
                </span>
              ) : null}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSession(session)}
                  className="text-xs font-medium text-accent-700 hover:underline"
                >
                  {t('actions.writeFeedback')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <SessionFeedbackDialog
        open={!!selectedSession}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedSession(null)}
        session={selectedSession}
        students={students}
      />
    </>
  );
}
