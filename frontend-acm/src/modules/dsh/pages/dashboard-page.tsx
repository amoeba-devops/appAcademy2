import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ManualInputDialog } from '@/modules/dsh/components/manual-input-dialog';
import { ComplaintDialog } from '@/modules/dsh/components/complaint-dialog';
import { KpiSummaryCards, type CategorySummary } from '@/modules/dsh/components/kpi-summary-cards';
import { toCsv, downloadCsv } from '@/modules/dsh/lib/export-csv';

type MetCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';
type MetAggregationType =
  | 'VOLUME_COUNT'
  | 'STATUS_SNAPSHOT'
  | 'DAILY_DISTINCT'
  | 'NET_DELTA'
  | 'COMPUTED';

interface MetricDefinition {
  id: string;
  code: string;
  category: MetCategory;
  labelKr: string;
  labelEn: string;
  aggregationType: MetAggregationType;
  unit?: string | null;
  format?: string | null;
  displayOrder: number;
}

interface DailyKpiRow {
  date: string;
  dayOfMonth: number;
  dayOfWeekKr: string;
  marketingVisitor: number | null;
  marketingCost: string | null;
  marketingEffect: number | null;
  csCounseling: number;
  csApply: number;
  csBeginning: number;
  csMissing: number;
  csTrialClass: number;
  csComplain: number;
  opsNewSt: number;
  opsOutSt: number;
  opsCountSt: number;
  opsNewTc: number;
  opsOutTc: number;
  opsCountTc: number;
  classMapTest: number;
  classTtClass: string;
  classStudent: number;
  classTeacher: number;
  computationStatus: 'FRESH' | 'STALE' | 'RECOMPUTING' | 'FAILED';
  dataCompleteness: 'COMPLETE' | 'PARTIAL_PENDING_MANUAL' | 'PARTIAL_FUTURE';
}

interface MonthGridResult {
  yearMonth: string;
  rows: DailyKpiRow[];
  sums: Record<string, number>;
  averages: Record<string, number | null>;
  populatedDayCount: number;
}

interface MonthlySummaryResponse {
  yearMonth: string;
  previousYearMonth: string | null;
  populatedDayCount: number;
  categories: CategorySummary[];
}

const METRIC_TO_FIELD: Record<string, keyof DailyKpiRow> = {
  mkt_visitor: 'marketingVisitor',
  mkt_cost: 'marketingCost',
  mkt_effect: 'marketingEffect',
  cs_counseling: 'csCounseling',
  cs_apply: 'csApply',
  cs_beginning: 'csBeginning',
  cs_missing: 'csMissing',
  cs_trial_class: 'csTrialClass',
  cs_complain: 'csComplain',
  ops_new_st: 'opsNewSt',
  ops_out_st: 'opsOutSt',
  ops_count_st: 'opsCountSt',
  ops_new_tc: 'opsNewTc',
  ops_out_tc: 'opsOutTc',
  ops_count_tc: 'opsCountTc',
  cls_map_test: 'classMapTest',
  cls_tt_class: 'classTtClass',
  cls_student: 'classStudent',
  cls_teacher: 'classTeacher',
};

const CATEGORY_ORDER: MetCategory[] = ['MARKETING', 'CS', 'OPERATING', 'CLASS'];

function nowYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(value: unknown, format?: string | null): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (Number.isNaN(n)) return '';
  if (format === 'CURRENCY_KRW') return Math.round(n).toLocaleString();
  if (format === 'DECIMAL_5_1') return n.toFixed(1);
  return String(Math.round(n * 10) / 10);
}

function fmtAvg(value: number | null, format?: string | null): string {
  if (value === null || value === undefined) return '—';
  if (format === 'CURRENCY_KRW') return Math.round(value).toLocaleString();
  return value.toFixed(1);
}

export function DashboardPage() {
  const { t, i18n } = useTranslation(['dsh', 'common']);
  const [yearMonth, setYearMonth] = useState<string>(nowYearMonth());
  const [manualOpen, setManualOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);

  const metricsQ = useQuery({
    queryKey: ['dsh', 'metrics'],
    queryFn: async () => (await apiClient.get<MetricDefinition[]>('/acm/dsh/metrics')).data,
  });

  const gridQ = useQuery({
    queryKey: ['dsh', 'grid', yearMonth],
    queryFn: async () =>
      (await apiClient.get<MonthGridResult>('/acm/dsh/daily-kpi', { params: { yearMonth } })).data,
  });

  const summaryQ = useQuery({
    queryKey: ['dsh', 'summary', yearMonth],
    queryFn: async () =>
      (await apiClient.get<MonthlySummaryResponse>('/acm/dsh/monthly-summary', { params: { yearMonth } })).data,
  });

  const yearMonthsQ = useQuery({
    queryKey: ['dsh', 'year-months'],
    queryFn: async () => (await apiClient.get<string[]>('/acm/dsh/year-months')).data,
  });

  const grouped = useMemo(() => {
    const m: Record<MetCategory, MetricDefinition[]> = {
      MARKETING: [], CS: [], OPERATING: [], CLASS: [],
    };
    for (const md of metricsQ.data ?? []) {
      m[md.category].push(md);
    }
    for (const cat of CATEGORY_ORDER) {
      m[cat].sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return m;
  }, [metricsQ.data]);

  const isKr = i18n.language?.startsWith('ko');
  const flatMetrics = CATEGORY_ORDER.flatMap((c) => grouped[c]);

  const monthOptions = useMemo(() => {
    const seeded = yearMonthsQ.data ?? [];
    const set = new Set<string>(seeded);
    const now = new Date();
    for (let i = -1; i <= 1; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(set).sort().reverse();
  }, [yearMonthsQ.data]);

  const handleExportCsv = () => {
    if (!metricsQ.data || !gridQ.data) return;
    const header: (string | number)[] = [t('grid.day'), t('grid.dow')];
    for (const md of flatMetrics) header.push(isKr ? md.labelKr : md.labelEn);
    const dataRows: (string | number | null)[][] = gridQ.data.rows.map((row) => {
      const cells: (string | number | null)[] = [row.dayOfMonth, row.dayOfWeekKr];
      for (const md of flatMetrics) {
        const field = METRIC_TO_FIELD[md.code];
        const v = field ? (row[field] as unknown) : null;
        cells.push(v === null || v === undefined ? null : (v as string | number));
      }
      return cells;
    });
    const sumRow: (string | number | null)[] = [t('grid.sum'), ''];
    const averRow: (string | number | null)[] = [t('grid.aver'), ''];
    for (const md of flatMetrics) {
      sumRow.push(gridQ.data.sums[md.code] ?? null);
      averRow.push(
        md.aggregationType === 'STATUS_SNAPSHOT'
          ? null
          : gridQ.data.averages[md.code] !== null
            ? Math.round((gridQ.data.averages[md.code] as number) * 10) / 10
            : null,
      );
    }
    const csv = toCsv([header, ...dataRows, sumRow, averRow]);
    downloadCsv(`dsh-${yearMonth}.csv`, csv);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <Button variant="outline" onClick={handleExportCsv} disabled={!gridQ.data}>
            {t('actions.exportCsv')}
          </Button>
          <Button variant="outline" onClick={() => setManualOpen(true)}>
            {t('actions.manualInput')}
          </Button>
          <Button onClick={() => setComplaintOpen(true)}>
            {t('actions.addComplaint')}
          </Button>
        </div>
      </div>

      {gridQ.data && (
        <p className="text-xs text-secondary mb-2">
          {t('status.populated', {
            count: gridQ.data.populatedDayCount,
            total: gridQ.data.rows.length,
          })}
        </p>
      )}

      <KpiSummaryCards
        categories={summaryQ.data?.categories ?? []}
        isLoading={summaryQ.isLoading}
      />

      {(metricsQ.isLoading || gridQ.isLoading) && (
        <p className="text-secondary">{t('common:status.loading')}</p>
      )}

      {metricsQ.data && gridQ.data && (
        <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-subtle">
              <tr>
                <th className="px-2 py-1 text-left sticky left-0 bg-surface-subtle z-10" rowSpan={2}>{t('grid.day')}</th>
                <th className="px-2 py-1 text-left" rowSpan={2}>{t('grid.dow')}</th>
                {CATEGORY_ORDER.map((cat) => (
                  <th
                    key={cat}
                    className="px-2 py-1 text-center border-l border-[var(--border-subtle)]"
                    colSpan={grouped[cat].length || 1}
                  >
                    {t(`category.${cat}`)}
                  </th>
                ))}
              </tr>
              <tr>
                {flatMetrics.map((md, i) => {
                  const prevCat = i > 0 ? flatMetrics[i - 1].category : null;
                  const isFirstOfCat = prevCat !== md.category;
                  return (
                    <th
                      key={md.id}
                      className={
                        'px-2 py-1 text-right whitespace-nowrap font-normal ' +
                        (isFirstOfCat ? 'border-l border-[var(--border-subtle)]' : '')
                      }
                      title={`${md.code} · ${md.aggregationType}`}
                    >
                      {isKr ? md.labelKr : md.labelEn}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {gridQ.data.rows.map((row) => (
                <tr key={row.date} className="border-t border-[var(--border-subtle)]">
                  <td className="px-2 py-1 sticky left-0 bg-surface">{row.dayOfMonth}</td>
                  <td className="px-2 py-1">{row.dayOfWeekKr}</td>
                  {flatMetrics.map((md, i) => {
                    const field = METRIC_TO_FIELD[md.code];
                    const v = field ? (row[field] as unknown) : null;
                    const prevCat = i > 0 ? flatMetrics[i - 1].category : null;
                    const isFirstOfCat = prevCat !== md.category;
                    return (
                      <td
                        key={md.id}
                        className={
                          'px-2 py-1 text-right ' +
                          (isFirstOfCat ? 'border-l border-[var(--border-subtle)]' : '')
                        }
                      >
                        {fmt(v, md.format)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-subtle font-medium">
              <tr className="border-t border-[var(--border-subtle)]">
                <td className="px-2 py-1 sticky left-0 bg-surface-subtle" colSpan={2}>
                  {t('grid.sum')}
                </td>
                {flatMetrics.map((md, i) => {
                  const prevCat = i > 0 ? flatMetrics[i - 1].category : null;
                  const isFirstOfCat = prevCat !== md.category;
                  return (
                    <td
                      key={md.id}
                      className={
                        'px-2 py-1 text-right ' +
                        (isFirstOfCat ? 'border-l border-[var(--border-subtle)]' : '')
                      }
                    >
                      {fmt(gridQ.data!.sums[md.code], md.format)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="px-2 py-1 sticky left-0 bg-surface-subtle" colSpan={2}>
                  {t('grid.aver')}
                </td>
                {flatMetrics.map((md, i) => {
                  const prevCat = i > 0 ? flatMetrics[i - 1].category : null;
                  const isFirstOfCat = prevCat !== md.category;
                  const avg = gridQ.data!.averages[md.code];
                  return (
                    <td
                      key={md.id}
                      className={
                        'px-2 py-1 text-right ' +
                        (isFirstOfCat ? 'border-l border-[var(--border-subtle)]' : '')
                      }
                    >
                      {md.aggregationType === 'STATUS_SNAPSHOT' ? '—' : fmtAvg(avg ?? null, md.format)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {gridQ.data && gridQ.data.rows.length === 0 && (
        <p className="text-secondary mt-4">{t('empty.noData')}</p>
      )}

      <ManualInputDialog open={manualOpen} onOpenChange={setManualOpen} yearMonth={yearMonth} />
      <ComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} yearMonth={yearMonth} />
    </div>
  );
}
