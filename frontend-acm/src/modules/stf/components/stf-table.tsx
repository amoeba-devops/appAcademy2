import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { StaffDetail } from '../types';

interface Props {
  items: StaffDetail[];
  isLoading: boolean;
  onRowClick: (s: StaffDetail) => void;
}

export function StfTable({ items, isLoading, onRowClick }: Props) {
  const { t } = useTranslation('stf');

  if (isLoading) {
    return <p className="text-secondary py-8 text-center">{t('common:status.loading')}</p>;
  }
  if (!items.length) {
    return <p className="text-secondary py-8 text-center">{t('table.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="bg-[var(--gray-50)] text-xs uppercase tracking-wide text-secondary">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">{t('table.name')}</th>
            <th className="px-4 py-3 text-left">{t('table.email')}</th>
            <th className="px-4 py-3 text-left">{t('table.position')}</th>
            <th className="px-4 py-3 text-left">{t('table.department')}</th>
            <th className="px-4 py-3 text-left">{t('table.account')}</th>
            <th className="px-4 py-3 text-left">{t('table.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((it, idx) => (
            <tr
              key={it.id}
              onClick={() => onRowClick(it)}
              className="cursor-pointer hover:bg-[var(--gray-50)] transition-colors"
            >
              <td className="px-4 py-3 text-secondary">{idx + 1}</td>
              <td className="px-4 py-3 font-medium">
                {it.name}
                {it.englishName && (
                  <span className="ml-1 text-secondary text-xs">({it.englishName})</span>
                )}
              </td>
              <td className="px-4 py-3">{it.email}</td>
              <td className="px-4 py-3">{it.position ?? '—'}</td>
              <td className="px-4 py-3">{it.department ?? '—'}</td>
              <td className="px-4 py-3">
                {it.hasAccount ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    {t('account.yes')}
                  </span>
                ) : (
                  <span className="text-secondary text-xs">{t('account.no')}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                    it.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-600',
                  )}
                >
                  {t(`status.${it.status}`)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
