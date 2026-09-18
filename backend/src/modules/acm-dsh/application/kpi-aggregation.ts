import type { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';

export const KPI_FIELDS = {
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
} as const satisfies Record<string, keyof DailyKpiTypeormEntity>;
export type KpiCode = keyof typeof KPI_FIELDS;
export type KpiRow = Pick<
  DailyKpiTypeormEntity,
  (typeof KPI_FIELDS)[KpiCode] | 'date'
> &
  Partial<
    Pick<DailyKpiTypeormEntity, 'computationStatus' | 'dataCompleteness'>
  >;
export interface MetricCoverage {
  validDays: number;
  expectedDays: number;
  asOf: string | null;
  status: 'MISSING' | 'PARTIAL' | 'AVAILABLE';
}

/** The source event queries use Asia/Seoul, independently of the host timezone. */
export function kpiToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function addDays(day: string, count: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + count * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dayCount(from: string, to: string): number {
  return from > to
    ? 0
    : Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
}
export function isUsableRow(row: KpiRow, through = kpiToday()): boolean {
  return (
    row.date <= through &&
    row.dataCompleteness !== 'PARTIAL_FUTURE' &&
    (!row.computationStatus || row.computationStatus === 'FRESH')
  );
}
export function metricNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function kpiValue(row: KpiRow, code: KpiCode): number | null {
  if (code === 'mkt_effect') {
    const counseling = metricNumber(row.csCounseling);
    const apply = metricNumber(row.csApply);
    return counseling === null || apply === null ? null : counseling + apply;
  }
  return metricNumber(row[KPI_FIELDS[code]]);
}
export function isSnapshot(code: KpiCode): boolean {
  return code === 'ops_count_st' || code === 'ops_count_tc';
}

/** Missing days remain gaps. Zero is an observation, never a completeness test. */
export function aggregateKpis(
  rows: KpiRow[],
  from: string,
  to: string,
  today = kpiToday(),
) {
  const through = to < today ? to : today;
  const expectedDays = dayCount(from, through);
  const usable = rows
    .filter((r) => r.date >= from && r.date <= to && isUsableRow(r, through))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sums: Record<string, number | null> = {};
  const averages: Record<string, number | null> = {};
  const coverage: Record<string, MetricCoverage> = {};
  const series: Record<string, (number | null)[]> = {};
  for (const code of Object.keys(KPI_FIELDS) as KpiCode[]) {
    const observed = usable.flatMap((row) => {
      const value = kpiValue(row, code);
      return value === null ? [] : [{ date: row.date, value }];
    });
    const last = observed.at(-1);
    const total = observed.reduce((sum, item) => sum + item.value, 0);
    sums[code] = !last ? null : isSnapshot(code) ? last.value : total;
    averages[code] = !last || isSnapshot(code) ? null : total / observed.length;
    coverage[code] = {
      validDays: observed.length,
      expectedDays,
      asOf: last?.date ?? null,
      status: !last
        ? 'MISSING'
        : observed.length < expectedDays
          ? 'PARTIAL'
          : 'AVAILABLE',
    };
    const byDate = new Map(observed.map((item) => [item.date, item.value]));
    series[code] = Array.from(
      { length: expectedDays },
      (_, index) => byDate.get(addDays(from, index)) ?? null,
    );
  }
  return {
    sums,
    averages,
    coverage,
    series,
    populatedDayCount: usable.length,
    actualThrough: expectedDays ? through : null,
  };
}

export function comparisonRange(from: string, to: string, today = kpiToday()) {
  const through = to < today ? to : today;
  const days = dayCount(from, through);
  // A calendar month compares to the prior month, capped at the same elapsed day.
  if (
    from.endsWith('-01') &&
    from.slice(0, 7) === to.slice(0, 7) &&
    addDays(to, 1).endsWith('-01')
  ) {
    const previousMonthEnd = addDays(from, -1);
    const previousFrom = `${previousMonthEnd.slice(0, 7)}-01`;
    const previousTo =
      to > today
        ? addDays(
            previousFrom,
            Math.max(0, Math.min(days, Number(previousMonthEnd.slice(8))) - 1),
          )
        : previousMonthEnd;
    return { through, previousFrom, previousTo };
  }
  const previousTo = addDays(from, -1);
  return {
    through,
    previousTo,
    previousFrom: addDays(previousTo, -(Math.max(days, 1) - 1)),
  };
}
