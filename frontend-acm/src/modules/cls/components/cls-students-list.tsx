import { useTranslation } from 'react-i18next';
import type { ClassStudent } from '../types';

export function ClsStudentsList({ students }: { students: ClassStudent[] }) {
  const { t, i18n } = useTranslation(['cls', 'common']);
  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';

  if (students.length === 0) {
    return (
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('detail.students.empty')}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
      <header className="flex items-center justify-between bg-[var(--gray-100)] px-4 py-2 text-sm">
        <span className="font-medium">{t('detail.students.title')}</span>
        <span className="text-secondary">
          {t('detail.students.count', { count: students.length })}
        </span>
      </header>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <span className="font-medium">{s.studentName ?? s.studentUserId}</span>
            <span
              className={
                s.capacityRole === 'PRIMARY'
                  ? 'rounded bg-accent-50 px-2 py-0.5 text-xs text-accent-700'
                  : 'rounded bg-[var(--gray-200)] px-2 py-0.5 text-xs text-secondary'
              }
            >
              {t(`detail.students.${s.capacityRole === 'PRIMARY' ? 'primary' : 'secondary'}`)}
            </span>
            <span className="text-secondary">
              {t('detail.students.joinedAt', {
                date: new Date(s.joinedAt).toLocaleDateString(dateLocale),
              })}
            </span>
            {s.leftAt ? (
              <span className="text-secondary">
                {' · '}
                {t('detail.students.leftAt', {
                  date: new Date(s.leftAt).toLocaleDateString(dateLocale),
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
