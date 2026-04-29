import { useTranslation } from 'react-i18next';
import type { Recurrence } from '../types';

export function ClsRecurrenceList({ recurrences }: { recurrences: Recurrence[] }) {
  const { t, i18n } = useTranslation(['cls', 'common']);
  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';

  if (recurrences.length === 0) {
    return (
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('detail.schedule.empty')}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
      <header className="bg-[var(--gray-100)] px-4 py-2 text-sm font-medium">
        {t('detail.schedule.title')}
      </header>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {recurrences.map((r) => {
          const endHHMM = computeEnd(r.startTime, r.durationMin);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-md bg-accent-50 px-2 text-xs font-semibold text-accent-700">
                {t(`recurrence.days.${r.dayOfWeek}`)}
              </span>
              <span className="font-mono">
                {r.startTime}–{endHHMM}
              </span>
              <span className="text-secondary">
                {t('detail.schedule.durationMin', { minutes: r.durationMin })}
              </span>
              <span className="text-secondary">
                {' · '}
                {t(`session.modes.${r.defaultMode}`)}
              </span>
              <span className="text-xs text-secondary">
                {t('detail.schedule.effectiveFrom', {
                  date: new Date(r.effectiveFrom).toLocaleDateString(dateLocale),
                })}
                {r.effectiveTo
                  ? t('detail.schedule.effectiveTo', {
                      date: new Date(r.effectiveTo).toLocaleDateString(dateLocale),
                    })
                  : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function computeEnd(startHHMM: string, durationMin: number): string {
  const [h, m] = startHHMM.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return startHHMM;
  const total = h * 60 + m + durationMin;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}
