import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ClassSummary } from '../types';
import { ClsStatusBadge } from './cls-status-badge';

export interface ClsTableProps {
  items: ClassSummary[];
  isLoading?: boolean;
}

export function ClsTable({ items, isLoading }: ClsTableProps) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['cls', 'common']);
  const localeMap: Record<string, string> = {
    ko: 'ko-KR',
    en: 'en-US',
    vi: 'vi-VN',
    'zh-CN': 'zh-CN',
  };
  const dateLocale = localeMap[i18n.language ?? 'ko'] ?? 'ko-KR';
  const dash = t('common:dash');

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale) : dash;

  return (
    <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--gray-100)] text-secondary">
          <tr>
            <th className="text-left px-4 py-3">{t('table.code')}</th>
            <th className="text-left px-4 py-3">{t('table.subject')}</th>
            <th className="text-left px-4 py-3">{t('table.status')}</th>
            <th className="text-left px-4 py-3">{t('table.teacher')}</th>
            <th className="text-left px-4 py-3">{t('session.mode')}</th>
            <th className="text-left px-4 py-3">{t('table.startedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr
              key={c.id}
              onClick={() => navigate(`/admin/cls/${c.id}`)}
              className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--gray-100)]"
            >
              <td className="px-4 py-3 font-medium tabular-nums">{c.code}</td>
              <td className="px-4 py-3 text-secondary">
                {t(`subjectType.${c.subjectType}`)}
              </td>
              <td className="px-4 py-3">
                <ClsStatusBadge status={c.status} />
              </td>
              <td className="px-4 py-3 text-secondary">
                {c.teacherName ?? c.teacherUserId ?? dash}
              </td>
              <td className="px-4 py-3 text-secondary">
                {t(`session.modes.${c.defaultMode}`)}
              </td>
              <td className="px-4 py-3 text-secondary">{fmtDate(c.startedAt)}</td>
            </tr>
          ))}
          {!isLoading && items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-secondary">
                {t('table.empty')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
