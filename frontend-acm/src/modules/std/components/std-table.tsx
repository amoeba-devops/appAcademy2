import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StudentSummary } from '../types';
import { StdStatusBadge } from './std-status-badge';

interface StdTableProps {
  items: StudentSummary[];
  isLoading: boolean;
}

export function StdTable({ items, isLoading }: StdTableProps) {
  const { t } = useTranslation('std');
  const navigate = useNavigate();

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
            <th className="px-4 py-3 text-left">{t('table.gender')}</th>
            <th className="px-4 py-3 text-left">{t('table.school')}</th>
            <th className="px-4 py-3 text-left">{t('table.grade')}</th>
            <th className="px-4 py-3 text-left">{t('table.teacher')}</th>
            <th className="px-4 py-3 text-left">{t('table.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((s, idx) => (
            <tr
              key={s.id}
              className="cursor-pointer hover:bg-[var(--gray-50)] transition-colors"
              onClick={() => navigate(`/std/${s.id}`)}
            >
              <td className="px-4 py-3 text-secondary">{idx + 1}</td>
              <td className="px-4 py-3 font-medium">
                {s.name}
                {s.englishName && (
                  <span className="ml-1 text-secondary text-xs">({s.englishName})</span>
                )}
              </td>
              <td className="px-4 py-3 text-secondary">
                {s.gender === 'M' ? t('gender.M') : s.gender === 'F' ? t('gender.F') : '—'}
              </td>
              <td className="px-4 py-3">{s.school ?? '—'}</td>
              <td className="px-4 py-3">{s.grade ?? '—'}</td>
              <td className="px-4 py-3">{s.teacher ?? '—'}</td>
              <td className="px-4 py-3">
                <StdStatusBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
