import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { StudentSummary } from '../types';
import { StdStatusBadge } from './std-status-badge';

export interface StdSort {
  field: 'name' | 'createdAt';
  dir: 'asc' | 'desc';
}

interface StdTableProps {
  items: StudentSummary[];
  isLoading: boolean;
  sort: StdSort;
  onSort: (field: StdSort['field']) => void;
}

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
};

export function StdTable({ items, isLoading, sort, onSort }: StdTableProps) {
  const { t } = useTranslation('std');
  const navigate = useNavigate();

  if (isLoading) {
    return <p className="text-secondary py-8 text-center">{t('common:status.loading')}</p>;
  }

  if (!items.length) {
    return <p className="text-secondary py-8 text-center">{t('table.empty')}</p>;
  }

  const SortIcon = ({ field }: { field: StdSort['field'] }) => {
    if (sort.field !== field) return <ChevronsUpDown size={12} className="opacity-40" />;
    return sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const SortableTh = ({ field, label }: { field: StdSort['field']; label: string }) => (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-primary"
        aria-sort={sort.field === field ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        <SortIcon field={field} />
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[var(--gray-50)] text-xs uppercase tracking-wide text-secondary">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <SortableTh field="name" label={t('table.name')} />
            <th className="px-4 py-3 text-left">{t('table.gender')}</th>
            <th className="px-4 py-3 text-left">{t('table.school')}</th>
            <th className="px-4 py-3 text-left">{t('table.grade')}</th>
            <th className="px-4 py-3 text-left">{t('table.teacher')}</th>
            <th className="px-4 py-3 text-left">{t('table.status')}</th>
            <SortableTh field="createdAt" label={t('table.createdAt')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {items.map((s, idx) => (
            <tr
              key={s.id}
              className="cursor-pointer hover:bg-[var(--gray-50)] transition-colors"
              onClick={() => navigate(`/admin/std/${s.id}`)}
            >
              <td className="px-4 py-3 text-secondary">{idx + 1}</td>
              <td className="px-4 py-3 font-medium">
                {s.name}
                {s.englishName && (
                  <span className="ml-1 text-secondary text-xs">({s.englishName})</span>
                )}
                {s.sourceInquiry && (
                  <span
                    className="ml-1.5 inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[10px] font-normal text-accent-700"
                    title={t('table.fromInquiry', '신규상담 연결')}
                  >
                    {t('table.fromInquiry', '신규상담 연결')} #{s.sourceInquiry.seqNo}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-secondary">
                {s.gender === 'M' ? t('gender.M') : s.gender === 'F' ? t('gender.F') : '—'}
              </td>
              <td className="px-4 py-3">{s.school ?? '—'}</td>
              <td className="px-4 py-3">{s.grade ?? '—'}</td>
              <td
                className="px-4 py-3"
                title={s.teachers?.map((x) => x.name).join(', ') || undefined}
              >
                {s.teachers && s.teachers.length > 1
                  ? t('table.teacherMore', {
                      defaultValue: '{{name}} 외 {{count}}명',
                      name: s.teachers[0].name,
                      count: s.teachers.length - 1,
                    })
                  : (s.teachers?.[0]?.name ?? s.teacher ?? '—')}
              </td>
              <td className="px-4 py-3">
                <StdStatusBadge status={s.status} />
              </td>
              <td className="px-4 py-3 text-secondary">{fmtDate(s.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
