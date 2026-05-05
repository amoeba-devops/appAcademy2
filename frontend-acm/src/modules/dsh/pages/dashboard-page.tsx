import { useEffect, useMemo, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  yearMonth?: string;
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

interface RangeGridResult {
  from: string;
  to: string;
  rows: DailyKpiRow[];
  sums: Record<string, number>;
  averages: Record<string, number | null>;
  populatedDayCount: number;
}

interface RangeSummaryResponse {
  from: string;
  to: string;
  previousFrom: string | null;
  previousTo: string | null;
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isoMonthStart(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

function isoMonthEnd(d: Date): string {
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getFullYear()}-${pad2(e.getMonth() + 1)}-${pad2(e.getDate())}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type PresetKey = 'thisMonth' | 'lastMonth' | 'last30' | 'last90' | 'custom';

function presetRange(key: PresetKey): { from: string; to: string } | null {
  const today = new Date();
  if (key === 'thisMonth') {
    return { from: isoMonthStart(today), to: isoMonthEnd(today) };
  }
  if (key === 'lastMonth') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { from: isoMonthStart(d), to: isoMonthEnd(d) };
  }
  if (key === 'last30') {
    const to = isoToday();
    return { from: addDaysIso(to, -29), to };
  }
  if (key === 'last90') {
    const to = isoToday();
    return { from: addDaysIso(to, -89), to };
  }
  return null;
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

function ymOf(iso: string): string {
  return iso.slice(0, 7);
}

export function DashboardPage() {
  const { t, i18n } = useTranslation(['dsh', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultRange = presetRange('thisMonth')!;
  const [from, setFrom] = useState<string>(searchParams.get('from') ?? defaultRange.from);
  const [to, setTo] = useState<string>(searchParams.get('to') ?? defaultRange.to);
  const [activePreset, setActivePreset] = useState<PresetKey>(
    (searchParams.get('preset') as PresetKey | null) ?? 'thisMonth',
  );

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string>(isoToday());
  const [complaintOpen, setComplaintOpen] = useState(false);

  // Sync state → URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('from', from);
    params.set('to', to);
    params.set('preset', activePreset);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, activePreset]);

  const applyPreset = (key: PresetKey) => {
    setActivePreset(key);
    const r = presetRange(key);
    if (r) {
      setFrom(r.from);
      setTo(r.to);
    }
  };

  const rangeKey = `${from}~${to}`;

  const metricsQ = useQuery({
    queryKey: ['dsh', 'metrics'],
    queryFn: async () => (await apiClient.get<MetricDefinition[]>('/acm/dsh/metrics')).data,
  });

  const gridQ = useQuery({
    queryKey: ['dsh', 'grid', rangeKey],
    queryFn: async () =>
      (
        await apiClient.get<RangeGridResult>('/acm/dsh/daily-kpi-range', {
          params: { from, to },
        })
      ).data,
    enabled: !!from && !!to && from <= to,
  });

  const summaryQ = useQuery({
    queryKey: ['dsh', 'summary', rangeKey],
    queryFn: async () =>
      (
        await apiClient.get<RangeSummaryResponse>('/acm/dsh/range-summary', {
          params: { from, to },
        })
      ).data,
    enabled: !!from && !!to && from <= to,
  });

  const grouped = useMemo(() => {
    const m: Record<MetCategory, MetricDefinition[]> = {
      MARKETING: [],
      CS: [],
      OPERATING: [],
      CLASS: [],
    };
    for (const md of metricsQ.data ?? []) m[md.category].push(md);
    for (const cat of CATEGORY_ORDER) {
      m[cat].sort((a, b) => a.displayOrder - b.displayOrder);
    }
    return m;
  }, [metricsQ.data]);

  const isKr = i18n.language?.startsWith('ko');
  const flatMetrics = CATEGORY_ORDER.flatMap((c) => grouped[c]);
  const totalCols = 2 + flatMetrics.length;

  const handleExportCsv = () => {
    if (!metricsQ.data || !gridQ.data) return;
    const header: (string | number)[] = ['Date', t('grid.dow')];
    for (const md of flatMetrics) header.push(isKr ? md.labelKr : md.labelEn);
    const dataRows: (string | number | null)[][] = gridQ.data.rows.map((row) => {
      const cells: (string | number | null)[] = [row.date, row.dayOfWeekKr];
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
    downloadCsv(`dsh-${from}_${to}.csv`, csv);
  };

  const onRowClick = (date: string) => {
    setManualDate(date);
    setManualOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={!gridQ.data}>
            {t('actions.exportCsv')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setManualDate(isoToday());
              setManualOpen(true);
            }}
          >
            {t('actions.manualInput')}
          </Button>
          <Button onClick={() => setComplaintOpen(true)}>{t('actions.addComplaint')}</Button>
        </div>
      </div>

      <div className="rounded-md border border-[var(--border-subtle)] bg-surface p-3 mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-secondary block mb-1">{t('range.from')}</label>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value);
              setActivePreset('custom');
            }}
            className="w-[160px]"
          />
        </div>
        <div>
          <label className="text-xs text-secondary block mb-1">{t('range.to')}</label>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value);
              setActivePreset('custom');
            }}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['thisMonth', 'lastMonth', 'last30', 'last90', 'custom'] as PresetKey[]).map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={activePreset === k ? 'default' : 'outline'}
              onClick={() => applyPreset(k)}
            >
              {t(`actions.preset.${k}`)}
            </Button>
          ))}
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
                <th
                  className="px-2 py-1 text-left sticky left-0 bg-surface-subtle z-10"
                  rowSpan={2}
                >
                  {t('grid.day')}
                </th>
                <th className="px-2 py-1 text-left" rowSpan={2}>
                  {t('grid.dow')}
                </th>
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
              {gridQ.data.rows.map((row, idx) => {
                const ym = row.yearMonth ?? ymOf(row.date);
                const prevYm =
                  idx > 0 ? (gridQ.data!.rows[idx - 1].yearMonth ?? ymOf(gridQ.data!.rows[idx - 1].date)) : null;
                const showDivider = prevYm !== null && prevYm !== ym;
                return (
                  <Fragment key={row.date}>
                    {showDivider && (
                      <tr className="bg-surface-subtle">
                        <td
                          colSpan={totalCols}
                          className="px-2 py-1 text-[11px] font-medium text-secondary border-t border-[var(--border-subtle)]"
                        >
                          {ym}
                        </td>
                      </tr>
                    )}
                    <tr
                      className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-surface-subtle"
                      onClick={() => onRowClick(row.date)}
                    >
                      <td className="px-2 py-1 sticky left-0 bg-surface">{row.date.slice(5)}</td>
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
                  </Fragment>
                );
              })}
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
                      {md.aggregationType === 'STATUS_SNAPSHOT'
                        ? '—'
                        : fmtAvg(avg ?? null, md.format)}
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

      <ManualInputDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        initialDate={manualDate}
        invalidateKey={rangeKey}
      />
      <ComplaintDialog
        open={complaintOpen}
        onOpenChange={setComplaintOpen}
        yearMonth={ymOf(to)}
      />
    </div>
  );
}
