import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import {
  downloadMapApplyCsv,
  useMapApplyList,
  MAP_APPLY_SITES,
  MAP_APPLY_STAGES,
  type MapApplyListQuery,
  type MapApplySite,
  type MapApplyStage,
} from '@/modules/csl/hooks/use-map-applications';
import { MapApplyImportModal } from '@/modules/csl/components/map-apply-import-modal';

const PAGE_SIZE = 20;

interface FilterState {
  q: string;
  site: MapApplySite | 'ALL';
  stage: MapApplyStage | 'ALL';
  from: string;
  to: string;
}

const EMPTY: FilterState = { q: '', site: 'ALL', stage: 'ALL', from: '', to: '' };

/** 목록에서는 가운데를 가린다 (상세에서 전체 표시). */
function maskPhone(v: string | null): string {
  if (!v) return '—';
  const d = v.replace(/[^0-9]/g, '');
  if (d.length < 7) return v;
  return `${d.slice(0, 4)}***${d.slice(-4)}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STAGE_CLASS: Record<string, string> = {
  INTAKE: 'bg-sky-100 text-sky-800',
  MAP_TEST: 'bg-violet-100 text-violet-800',
  TRIAL_CLASS: 'bg-amber-100 text-amber-800',
  ENROLLMENT_COUNSELING: 'bg-amber-100 text-amber-800',
  PAYMENT: 'bg-emerald-100 text-emerald-800',
  CLASS_STARTED: 'bg-emerald-100 text-emerald-800',
  ATTENDING: 'bg-emerald-100 text-emerald-800',
  DROPPED: 'bg-[var(--canvas-subtle)] text-secondary',
};

/** CSL-PLN-260916 — `/admin/test` 맵테스트 신청 목록. */
export function MapApplyListPage() {
  const { t } = useTranslation(['csl', 'common']);
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters] = useState<FilterState>(EMPTY);
  const [page, setPage] = useState(1);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const query: MapApplyListQuery = {
    q: filters.q.trim() || undefined,
    site: filters.site === 'ALL' ? undefined : filters.site,
    stage: filters.stage === 'ALL' ? undefined : filters.stage,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isLoading, isError } = useMapApplyList(query);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadMapApplyCsv({ ...query, page: 1, limit: 200 });
    } catch {
      toast.error(t('mapApply.export.failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('mapApply.title')}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload size={14} className="mr-1" />
            {t('mapApply.actions.import')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exporting || !total}
          >
            <Download size={14} className="mr-1" />
            {t('mapApply.actions.export')}
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-[var(--border-subtle)] bg-surface p-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-secondary">
            {t('mapApply.filters.search')}
          </label>
          <Input
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
            placeholder={t('mapApply.filters.searchPlaceholder')}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">
            {t('mapApply.field.site')}
          </label>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
            value={filters.site}
            onChange={(e) => set('site', e.target.value as FilterState['site'])}
          >
            <option value="ALL">{t('mapApply.filters.all')}</option>
            {MAP_APPLY_SITES.map((s) => (
              <option key={s} value={s}>
                {t(`sourceSite.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">
            {t('mapApply.field.stage')}
          </label>
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
            value={filters.stage}
            onChange={(e) => set('stage', e.target.value as FilterState['stage'])}
          >
            <option value="ALL">{t('mapApply.filters.all')}</option>
            {MAP_APPLY_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stage.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">
            {t('mapApply.filters.from')}
          </label>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => set('from', e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-secondary">
            {t('mapApply.filters.to')}
          </label>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => set('to', e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFilters(EMPTY);
            setPage(1);
          }}
        >
          {t('mapApply.filters.reset')}
        </Button>
        <span className="ml-auto text-xs text-secondary">
          {t('mapApply.total', { count: total })}
        </span>
      </div>

      {isLoading ? (
        <p className="text-secondary">{t('common:status.loading')}</p>
      ) : isError ? (
        <p className="text-red-600">{t('mapApply.loadFailed')}</p>
      ) : total === 0 ? (
        <p className="text-secondary">{t('mapApply.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--canvas-subtle)] text-secondary">
              <tr>
                {(
                  [
                    'seqNo',
                    'submittedAt',
                    'site',
                    'studentName',
                    'studentNameEn',
                    'grade',
                    'gender',
                    'parentPhone',
                    'examLocation',
                    'preferredSlot',
                    'stage',
                  ] as const
                ).map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-2 py-2 text-left font-normal"
                  >
                    {t(`mapApply.field.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-[var(--border-subtle)] hover:bg-[var(--canvas-subtle)]"
                  onClick={() => navigate(`/admin/test/${r.id}`)}
                >
                  <td className="whitespace-nowrap px-2 py-2">#{r.seqNo}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {fmtDateTime(r.submittedAt)}
                    {r.origin === 'IMPORT' && (
                      <span className="ml-1 text-[10px] text-secondary">
                        ({t('mapApply.origin.IMPORT')})
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {t(`sourceSite.${r.sourceSite}`)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 font-medium">
                    {r.studentName}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.studentNameEn ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.grade ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.gender ? t(`mapApply.gender.${r.gender}`) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                    {maskPhone(r.parentPhone)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.examLocation ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {r.preferredSlot ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        STAGE_CLASS[r.currentStage] ?? ''
                      }`}
                    >
                      {t(`stage.${r.currentStage}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('mapApply.pager.prev')}
          </Button>
          <span className="text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('mapApply.pager.next')}
          </Button>
        </div>
      )}

      <MapApplyImportModal open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
