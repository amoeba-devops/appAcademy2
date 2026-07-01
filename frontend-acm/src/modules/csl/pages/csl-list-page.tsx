import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { List, LayoutGrid } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CslCreateDialog } from '@/modules/csl/components/csl-create-dialog';
import {
  CslKanbanBoard,
  type KanbanInquiry,
} from '@/modules/csl/components/csl-kanban-board';

interface Inquiry extends KanbanInquiry {
  createdAt: string;
}

// REQ-260701 — persisted view toggle. Defaults to 'list'.
const VIEW_STORAGE_KEY = 'csl:viewMode';
type ViewMode = 'list' | 'kanban';

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'list';
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === 'kanban' ? 'kanban' : 'list';
}

export function CslListPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['csl', 'common']);
  const [view, setView] = useState<ViewMode>(loadViewMode);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const { data, isLoading } = useQuery({
    queryKey: ['csl', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<Inquiry[] | { items: Inquiry[]; total: number }>(
        '/acm/csl/inquiries',
      );
      const payload = res.data;
      return Array.isArray(payload) ? { items: payload } : payload;
    },
  });

  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', vi: 'vi-VN' };
  const dateLocale = localeMap[i18n.language?.slice(0, 2) ?? 'ko'] ?? 'ko-KR';
  const dash = t('common:dash');

  const stageBadgeClass = (stage: Inquiry['currentStage']) => {
    if (stage === 'DROPPED') return 'bg-[var(--gray-200)] text-secondary';
    if (stage === 'CLASS_STARTED') return 'bg-emerald-50 text-emerald-700';
    if (stage === 'PAYMENT') return 'bg-amber-50 text-amber-700';
    return 'bg-accent-50 text-accent-700';
  };

  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} />
          <CslCreateDialog />
        </div>
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      {!isLoading && view === 'kanban' && (
        <CslKanbanBoard inquiries={items} dateLocale={dateLocale} />
      )}
      {view === 'list' && (
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--gray-100)] text-secondary">
            <tr>
              <th className="text-left px-4 py-3 w-16">{t('table.seqNo')}</th>
              <th className="text-left px-4 py-3">{t('table.student')}</th>
              <th className="text-left px-4 py-3">{t('table.schoolGrade')}</th>
              <th className="text-left px-4 py-3">{t('table.inflow')}</th>
              <th className="text-left px-4 py-3">{t('table.applyType')}</th>
              <th className="text-left px-4 py-3">{t('table.stage')}</th>
              <th className="text-left px-4 py-3">{t('table.registered')}</th>
              <th className="text-left px-4 py-3">{t('table.followup')}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/csl/${c.id}`)}
                className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--gray-100)]"
              >
                <td className="px-4 py-3 text-secondary tabular-nums">#{c.seqNo}</td>
                <td className="px-4 py-3 font-medium">
                  {c.isAnonymous
                    ? t('anonymousInquiry', { seqNo: c.seqNo })
                    : c.studentName}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.schoolFreetext ?? dash} / {c.grade ? t(`grade.${c.grade}`, c.grade) : dash}
                </td>
                <td className="px-4 py-3 text-secondary">{t(`inflow.${c.inflowType}`)}</td>
                <td className="px-4 py-3 text-secondary">{t(`applyType.${c.applyType}`)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-1 text-xs ${stageBadgeClass(c.currentStage)}`}
                  >
                    {t(`stage.${c.currentStage}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.registeredAt
                    ? new Date(c.registeredAt).toLocaleDateString(dateLocale)
                    : dash}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {c.followupAt
                    ? new Date(c.followupAt).toLocaleDateString(dateLocale)
                    : dash}
                </td>
              </tr>
            ))}
            {!isLoading && (data?.items ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-secondary">
                  {t('table.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// ── View toggle (List / Kanban) ────────────────────────────────────────

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const { t } = useTranslation('csl');
  const base =
    'inline-flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition';
  return (
    <div className="inline-flex rounded-md border border-[var(--border-subtle)] overflow-hidden bg-surface">
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        className={`${base} ${
          value === 'list'
            ? 'bg-accent-50 text-accent-700'
            : 'text-secondary hover:bg-[var(--gray-100)]'
        }`}
      >
        <List size={14} />
        {t('view.list')}
      </button>
      <button
        type="button"
        onClick={() => onChange('kanban')}
        aria-pressed={value === 'kanban'}
        className={`${base} border-l border-[var(--border-subtle)] ${
          value === 'kanban'
            ? 'bg-accent-50 text-accent-700'
            : 'text-secondary hover:bg-[var(--gray-100)]'
        }`}
      >
        <LayoutGrid size={14} />
        {t('view.kanban')}
      </button>
    </div>
  );
}
