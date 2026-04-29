import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useSessions } from '../hooks/use-sessions';
import type { Session, SesStatus } from '../types';

const STATUS_CLASS: Record<SesStatus, string> = {
  SCHEDULED: 'bg-accent-50 text-accent-700',
  HELD: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
  RESCHEDULED: 'bg-amber-50 text-amber-700',
  NO_SHOW: 'bg-slate-100 text-slate-700',
  MAKEUP_REPLACEMENT: 'bg-violet-50 text-violet-700',
};

const LIMIT = 5;

export function ClsRecentSessions({ classId }: { classId: string }) {
  const { t, i18n } = useTranslation(['cls', 'common']);
  const { data, isLoading } = useSessions({ classId });
  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';

  const items = (data?.items ?? [])
    .slice()
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
    .slice(0, LIMIT);

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
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
      <header className="flex items-center justify-between bg-[var(--gray-100)] px-4 py-2 text-sm">
        <span className="font-medium">{t('detail.sessions.title')}</span>
        <span className="text-xs text-secondary">
          {t('detail.sessions.limitNote', { count: LIMIT })}
        </span>
      </header>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {items.map((s: Session) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
          >
            <span className="font-mono">{fmt(s.scheduledAt)}</span>
            <span
              className={clsx(
                'rounded px-2 py-0.5 text-xs font-medium',
                STATUS_CLASS[s.status],
              )}
            >
              {t(`session.statuses.${s.status}`)}
            </span>
            <span className="text-secondary">
              {t(`session.modes.${s.mode}`)}
            </span>
            {s.cancelReason ? (
              <span className="text-xs text-secondary">
                {' · '}
                {t(`session.cancelReasons.${s.cancelReason}`)}
              </span>
            ) : null}
            {s.disposition ? (
              <span className="text-xs text-secondary">
                {' · '}
                {t(`session.dispositions.${s.disposition}`)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
