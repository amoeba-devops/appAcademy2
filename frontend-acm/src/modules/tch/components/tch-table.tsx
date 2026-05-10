import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { TeacherDetail } from '../types';

interface TchTableProps {
  items: TeacherDetail[];
  isLoading: boolean;
  onRowClick: (t: TeacherDetail) => void;
}

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  // Accept both ISO date and full ISO timestamp
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
};

const fmtDateTime = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

export function TchTable({ items, isLoading, onRowClick }: TchTableProps) {
  const { t } = useTranslation('tch');

  if (isLoading) {
    return <p className="text-secondary py-8 text-center">{t('common:status.loading')}</p>;
  }
  if (!items.length) {
    return <p className="text-secondary py-8 text-center">{t('table.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full min-w-[1400px] text-sm">
        <thead className="bg-[var(--gray-50)] text-xs uppercase tracking-wide text-secondary">
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--gray-50)] px-4 py-3 text-left">
              {t('table.name')}
            </th>
            <th className="px-4 py-3 text-left">{t('table.isInstructor')}</th>
            <th className="px-4 py-3 text-left">{t('table.employmentType')}</th>
            <th className="px-4 py-3 text-left">{t('table.username')}</th>
            <th className="px-4 py-3 text-left">{t('table.birthDate')}</th>
            <th className="px-4 py-3 text-left">{t('table.email')}</th>
            <th className="px-4 py-3 text-left">{t('table.phone')}</th>
            <th className="px-4 py-3 text-left">{t('table.hiredAt')}</th>
            <th className="px-4 py-3 text-left">{t('table.attendanceNo')}</th>
            <th className="px-4 py-3 text-left">{t('table.lastLoginAt')}</th>
            <th className="px-4 py-3 text-left">{t('table.status')}</th>
            <th className="px-4 py-3 text-left">{t('table.accountState')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((it) => {
            const accountState = !it.hasAccount
              ? 'NO_ACCOUNT'
              : it.accountLockedAt
                ? 'LOCKED'
                : 'UNLOCKED';
            return (
              <tr
                key={it.id}
                onClick={() => onRowClick(it)}
                className="cursor-pointer hover:bg-[var(--gray-50)] transition-colors"
              >
                <td className="sticky left-0 z-10 bg-canvas px-4 py-3 font-medium">
                  {it.name}
                  {it.englishName && (
                    <span className="ml-1 text-secondary text-xs">({it.englishName})</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {it.isInstructor ? (
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {t('isInstructor.yes')}
                    </span>
                  ) : (
                    <span className="text-secondary text-xs">{t('isInstructor.no')}</span>
                  )}
                </td>
                <td className="px-4 py-3">{t(`employmentType.${it.employmentType}`)}</td>
                <td className="px-4 py-3 text-secondary">{it.accountUsername ?? '—'}</td>
                <td className="px-4 py-3">{fmtDate(it.birthDate)}</td>
                <td className="px-4 py-3">{it.email}</td>
                <td className="px-4 py-3">{it.phone ?? '—'}</td>
                <td className="px-4 py-3">{fmtDate(it.hiredAt)}</td>
                <td className="px-4 py-3">{it.attendanceNo ?? '—'}</td>
                <td className="px-4 py-3 text-xs">{fmtDateTime(it.accountLastLoginAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      it.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : it.status === 'LEAVE'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-neutral-100 text-neutral-600',
                    )}
                  >
                    {t(`status.${it.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      accountState === 'UNLOCKED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : accountState === 'LOCKED'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-neutral-100 text-neutral-600',
                    )}
                  >
                    {t(`accountState.${accountState}`)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
