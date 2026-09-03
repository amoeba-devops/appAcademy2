import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { List, LayoutGrid } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CslCreateDialog } from '@/modules/csl/components/csl-create-dialog';
import {
  APPLY_PURPOSES,
  APPLY_TYPES,
  CslFilterSelect,
  CslListFilters,
  type CslColumnFiltersValue,
  type CslGlobalFiltersValue,
  INFLOW_TYPES,
  STAGES,
} from '@/modules/csl/components/csl-list-filters';
import {
  CslKanbanBoard,
  type KanbanInquiry,
} from '@/modules/csl/components/csl-kanban-board';

interface Inquiry extends KanbanInquiry {
  createdAt: string;
  applyPurposes?: string[];
}

// REQ-260701 — persisted view toggle. Defaults to 'list'.
const VIEW_STORAGE_KEY = 'csl:viewMode';
type ViewMode = 'list' | 'kanban';
const PAGE_SIZE = 20;
const KANBAN_LIMIT = 500;

const DEFAULT_GLOBAL_FILTERS: CslGlobalFiltersValue = {
  q: '',
  registeredFrom: '',
  registeredTo: '',
};

const DEFAULT_COLUMN_FILTERS: CslColumnFiltersValue = {
  stage: '',
  inflowType: '',
  applyType: '',
  applyPurpose: '',
  followupState: '',
};

function loadViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'list';
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === 'kanban' ? 'kanban' : 'list';
}

export function CslListPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['csl', 'common']);
  const [view, setView] = useState<ViewMode>(loadViewMode);
  const [globalFilters, setGlobalFilters] = useState<CslGlobalFiltersValue>(DEFAULT_GLOBAL_FILTERS);
  const [columnFilters, setColumnFilters] = useState<CslColumnFiltersValue>(DEFAULT_COLUMN_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const effectiveFilters =
    view === 'list'
      ? { ...globalFilters, ...columnFilters }
      : { ...globalFilters, ...DEFAULT_COLUMN_FILTERS };

  const { data, isLoading } = useQuery({
    queryKey: ['csl', 'list', view, effectiveFilters, page],
    queryFn: async () => {
      const res = await apiClient.get<Inquiry[] | { items: Inquiry[]; total: number }>(
        '/acm/csl/inquiries',
        {
          params: {
            ...(effectiveFilters.q.trim() ? { q: effectiveFilters.q.trim() } : {}),
            ...(effectiveFilters.stage ? { stage: effectiveFilters.stage } : {}),
            ...(effectiveFilters.inflowType ? { inflowType: effectiveFilters.inflowType } : {}),
            ...(effectiveFilters.applyType ? { applyType: effectiveFilters.applyType } : {}),
            ...(effectiveFilters.applyPurpose ? { applyPurpose: effectiveFilters.applyPurpose } : {}),
            ...(effectiveFilters.registeredFrom
              ? { registeredFrom: effectiveFilters.registeredFrom }
              : {}),
            ...(effectiveFilters.registeredTo
              ? { registeredTo: effectiveFilters.registeredTo }
              : {}),
            ...(effectiveFilters.followupState
              ? { followupState: effectiveFilters.followupState }
              : {}),
            limit: view === 'list' ? PAGE_SIZE : KANBAN_LIMIT,
            offset: view === 'list' ? (page - 1) * PAGE_SIZE : 0,
          },
        },
      );
      const payload = res.data;
      return Array.isArray(payload)
        ? { items: payload, total: payload.length }
        : payload;
    },
  });

  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', vi: 'vi-VN' };
  const dateLocale = localeMap[i18n.language?.slice(0, 2) ?? 'ko'] ?? 'ko-KR';
  const dash = t('common:dash');

  const stageBadgeClass = (stage: Inquiry['currentStage']) => {
    if (stage === 'DROPPED') return 'bg-[var(--gray-200)] text-secondary';
    if (stage === 'CLASS_STARTED' || stage === 'ATTENDING')
      return 'bg-emerald-50 text-emerald-700';
    if (stage === 'PAYMENT') return 'bg-amber-50 text-amber-700';
    return 'bg-accent-50 text-accent-700';
  };

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateGlobalFilter<K extends keyof CslGlobalFiltersValue>(
    key: K,
    next: CslGlobalFiltersValue[K],
  ): void {
    setPage(1);
    setGlobalFilters((current) => ({ ...current, [key]: next }));
  }

  function updateColumnFilter<K extends keyof CslColumnFiltersValue>(
    key: K,
    next: CslColumnFiltersValue[K],
  ): void {
    setPage(1);
    setColumnFilters((current) => ({ ...current, [key]: next }));
  }

  function resetFilters(): void {
    setPage(1);
    setGlobalFilters(DEFAULT_GLOBAL_FILTERS);
    setColumnFilters(DEFAULT_COLUMN_FILTERS);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} />
          <CslCreateDialog />
        </div>
      </div>
      <CslListFilters
        value={globalFilters}
        onChange={updateGlobalFilter}
        onReset={resetFilters}
      />
      <div className="flex items-center justify-between mb-3 text-sm text-secondary">
        <span>
          {t('table.totalCount', {
            count: total,
            defaultValue: `총 ${total}건`,
          })}
        </span>
        {view === 'list' && (
          <span>
            {t('pagination.pageStatus', {
              page,
              totalPages,
              defaultValue: `${page} / ${totalPages} 페이지`,
            })}
          </span>
        )}
      </div>
      {isLoading && <p className="text-secondary">{t('common:status.loading')}</p>}
      {!isLoading && view === 'kanban' && (
        <CslKanbanBoard inquiries={items} dateLocale={dateLocale} />
      )}
      {view === 'list' && (
        <div className="rounded-lg bg-surface border border-[var(--border-subtle)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-100)] text-secondary">
              <tr>
                <th className="text-left px-4 py-3 w-16">{t('table.seqNo')}</th>
                <th className="text-left px-4 py-3">{t('table.student')}</th>
                <th className="text-left px-4 py-3">
                  {t('table.grade', { defaultValue: '학년' })}
                </th>
                <th className="text-left px-4 py-3 min-w-[150px]">
                  <div className="grid gap-2">
                    <span>{t('table.inflow')}</span>
                    <CslFilterSelect
                      value={columnFilters.inflowType}
                      onChange={(e) => updateColumnFilter('inflowType', e.target.value)}
                      aria-label={t('filters.allInflows', { defaultValue: '전체 유입' })}
                    >
                      <option value="">
                        {t('filters.allInflows', { defaultValue: '전체 유입' })}
                      </option>
                      {INFLOW_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {t(`inflow.${item}`)}
                        </option>
                      ))}
                    </CslFilterSelect>
                  </div>
                </th>
                <th className="text-left px-4 py-3 min-w-[150px]">
                  <div className="grid gap-2">
                    <span>{t('table.applyType')}</span>
                    <CslFilterSelect
                      value={columnFilters.applyType}
                      onChange={(e) => updateColumnFilter('applyType', e.target.value)}
                      aria-label={t('filters.allApplyTypes', { defaultValue: '전체 신청유형' })}
                    >
                      <option value="">
                        {t('filters.allApplyTypes', { defaultValue: '전체 신청유형' })}
                      </option>
                      {APPLY_TYPES.map((item) => (
                        <option key={item} value={item}>
                          {t(`applyType.${item}`)}
                        </option>
                      ))}
                    </CslFilterSelect>
                  </div>
                </th>
                <th className="text-left px-4 py-3 min-w-[200px]">
                  <div className="grid gap-2">
                    <span>{t('table.applyPurpose', { defaultValue: '신청목적' })}</span>
                    <CslFilterSelect
                      value={columnFilters.applyPurpose}
                      onChange={(e) => updateColumnFilter('applyPurpose', e.target.value)}
                      aria-label={t('filters.allPurposes', { defaultValue: '전체 신청목적' })}
                    >
                      <option value="">
                        {t('filters.allPurposes', { defaultValue: '전체 신청목적' })}
                      </option>
                      {APPLY_PURPOSES.map((item) => (
                        <option key={item} value={item}>
                          {t(`applyPurpose.${item}`)}
                        </option>
                      ))}
                    </CslFilterSelect>
                  </div>
                </th>
                <th className="text-left px-4 py-3 min-w-[160px]">
                  <div className="grid gap-2">
                    <span>{t('table.stage')}</span>
                    <CslFilterSelect
                      value={columnFilters.stage}
                      onChange={(e) => updateColumnFilter('stage', e.target.value)}
                      aria-label={t('filters.allStages', { defaultValue: '전체 단계' })}
                    >
                      <option value="">
                        {t('filters.allStages', { defaultValue: '전체 단계' })}
                      </option>
                      {STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {t(`stage.${stage}`)}
                        </option>
                      ))}
                    </CslFilterSelect>
                  </div>
                </th>
                <th className="text-left px-4 py-3">{t('table.registered')}</th>
                <th className="text-left px-4 py-3 min-w-[160px]">
                  <div className="grid gap-2">
                    <span>{t('table.followup')}</span>
                    <CslFilterSelect
                      value={columnFilters.followupState}
                      onChange={(e) =>
                        updateColumnFilter(
                          'followupState',
                          e.target.value as CslColumnFiltersValue['followupState'],
                        )
                      }
                      aria-label={t('filters.followup.all', { defaultValue: '전체 팔로업' })}
                    >
                      <option value="">
                        {t('filters.followup.all', { defaultValue: '전체 팔로업' })}
                      </option>
                      <option value="SET">
                        {t('filters.followup.set', { defaultValue: '팔로업 있음' })}
                      </option>
                      <option value="EMPTY">
                        {t('filters.followup.empty', { defaultValue: '팔로업 없음' })}
                      </option>
                    </CslFilterSelect>
                  </div>
                </th>
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
                    {c.linkedStudent && (
                      <span
                        className="ml-1.5 inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-1.5 py-0.5 text-[10px] font-normal text-accent-700"
                        title={c.linkedStudent.name}
                      >
                        🎓 {t('kanban.enrolled', '수강등록')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {c.grade ? t(`grade.${c.grade}`, c.grade) : dash}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {t(`inflow.${c.inflowType}`)}
                    {c.sourceSite && ` (${t(`sourceSite.${c.sourceSite}`)})`}
                  </td>
                  <td className="px-4 py-3 text-secondary">{t(`applyType.${c.applyType}`)}</td>
                  <td className="px-4 py-3 text-secondary">
                    {c.applyPurposes?.length
                      ? c.applyPurposes.map((item) => t(`applyPurpose.${item}`)).join(', ')
                      : dash}
                  </td>
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
                  <td colSpan={9} className="px-4 py-6 text-center text-secondary">
                    {t('table.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {view === 'list' && total > 0 && (
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
            className="h-8 rounded-md border border-[var(--border-subtle)] px-3 text-sm disabled:opacity-40"
          >
            {t('pagination.prev', { defaultValue: '이전' })}
          </button>
          <span className="min-w-[88px] text-center text-sm text-secondary">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
            className="h-8 rounded-md border border-[var(--border-subtle)] px-3 text-sm disabled:opacity-40"
          >
            {t('pagination.next', { defaultValue: '다음' })}
          </button>
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
