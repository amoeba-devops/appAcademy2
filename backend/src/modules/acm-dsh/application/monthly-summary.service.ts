import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';

export type DshCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';

export interface MetricSummary {
  code: string;
  labelKr: string;
  labelEn: string;
  isSnapshot: boolean;
  sum: number;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
}

export interface CategorySummary {
  category: DshCategory;
  /** primary metric for sparkline + back-compat with v1 KpiSummaryCards. */
  primaryMetricCode: string;
  primaryMetricLabelKr: string;
  primaryMetricLabelEn: string;
  sum: number;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
  series: number[];
  /** v2 — up to 3 key metrics rendered as a mini-table inside the card. */
  metrics: MetricSummary[];
}

export interface RangeSummaryResult {
  from: string;
  to: string;
  previousFrom: string | null;
  previousTo: string | null;
  populatedDayCount: number;
  categories: CategorySummary[];
}

export interface MonthlySummaryResult {
  yearMonth: string;
  previousYearMonth: string | null;
  populatedDayCount: number;
  categories: CategorySummary[];
}

interface MetricMeta {
  code: string;
  field: keyof DailyKpiTypeormEntity;
  labelKr: string;
  labelEn: string;
  isSnapshot?: boolean;
  /** mkt_effect is derived: cs_counseling + cs_apply. */
  derived?: 'EFFECT';
}

const CATEGORY_METRICS: Record<DshCategory, MetricMeta[]> = {
  MARKETING: [
    { code: 'mkt_visitor', field: 'marketingVisitor', labelKr: '방문자', labelEn: 'Visitor' },
    { code: 'mkt_cost', field: 'marketingCost', labelKr: '전체 비용', labelEn: 'Cost' },
    { code: 'mkt_effect', field: 'marketingEffect', labelKr: '효과', labelEn: 'Effect', derived: 'EFFECT' },
  ],
  CS: [
    { code: 'cs_counseling', field: 'csCounseling', labelKr: '상담', labelEn: 'Counseling' },
    { code: 'cs_apply', field: 'csApply', labelKr: '지원', labelEn: 'Apply' },
    { code: 'cs_trial_class', field: 'csTrialClass', labelKr: '체험수업', labelEn: 'Trial Class' },
  ],
  OPERATING: [
    { code: 'ops_count_st', field: 'opsCountSt', labelKr: '학생수', labelEn: '# of Students', isSnapshot: true },
    { code: 'ops_count_tc', field: 'opsCountTc', labelKr: '강사수', labelEn: '# of Teachers', isSnapshot: true },
    { code: 'ops_new_st', field: 'opsNewSt', labelKr: '신입생', labelEn: 'New St.' },
  ],
  CLASS: [
    { code: 'cls_tt_class', field: 'classTtClass', labelKr: '총수업', labelEn: 'Tt. Class' },
    { code: 'cls_student', field: 'classStudent', labelKr: '학생', labelEn: 'Student' },
    { code: 'cls_teacher', field: 'classTeacher', labelKr: '강사', labelEn: 'Teacher' },
  ],
};

const CATEGORY_ORDER: DshCategory[] = ['MARKETING', 'CS', 'OPERATING', 'CLASS'];

function prevYearMonth(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDaysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

function numOf(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function metricValue(row: DailyKpiTypeormEntity, meta: MetricMeta): number {
  if (meta.derived === 'EFFECT') {
    return (row.csCounseling ?? 0) + (row.csApply ?? 0);
  }
  return numOf(row[meta.field]);
}

function buildCategory(
  cat: DshCategory,
  rows: DailyKpiTypeormEntity[],
  prevRows: DailyKpiTypeormEntity[],
): CategorySummary {
  const metricsMeta = CATEGORY_METRICS[cat];
  const metrics: MetricSummary[] = metricsMeta.map((meta) => {
    const series = rows.map((r) => metricValue(r, meta));
    const prevSeries = prevRows.map((r) => metricValue(r, meta));
    let sum: number, aver: number | null, prevSum: number | null;
    if (meta.isSnapshot) {
      sum = series.length > 0 ? series[series.length - 1] : 0;
      aver = null;
      prevSum = prevSeries.length > 0 ? prevSeries[prevSeries.length - 1] : null;
    } else {
      sum = series.reduce((a, b) => a + b, 0);
      aver = series.length > 0 ? sum / series.length : null;
      prevSum = prevSeries.length > 0 ? prevSeries.reduce((a, b) => a + b, 0) : null;
    }
    let momDeltaPct: number | null = null;
    if (prevSum !== null && prevSum !== 0) {
      momDeltaPct = ((sum - prevSum) / prevSum) * 100;
    } else if (prevSum === 0 && sum > 0) {
      momDeltaPct = 100;
    }
    return {
      code: meta.code,
      labelKr: meta.labelKr,
      labelEn: meta.labelEn,
      isSnapshot: !!meta.isSnapshot,
      sum: Math.round(sum * 10) / 10,
      aver: aver === null ? null : Math.round(aver * 10) / 10,
      previousSum: prevSum === null ? null : Math.round(prevSum * 10) / 10,
      momDeltaPct: momDeltaPct === null ? null : Math.round(momDeltaPct * 10) / 10,
    };
  });

  const primary = metrics[0];
  const primaryMeta = metricsMeta[0];
  const series = rows.map((r) => metricValue(r, primaryMeta));

  return {
    category: cat,
    primaryMetricCode: primary.code,
    primaryMetricLabelKr: primary.labelKr,
    primaryMetricLabelEn: primary.labelEn,
    sum: primary.sum,
    aver: primary.aver,
    previousSum: primary.previousSum,
    momDeltaPct: primary.momDeltaPct,
    series,
    metrics,
  };
}

function isPopulated(r: DailyKpiTypeormEntity): boolean {
  return (
    (r.marketingVisitor ?? 0) > 0 ||
    r.csCounseling > 0 ||
    r.csApply > 0 ||
    r.csBeginning > 0 ||
    r.csTrialClass > 0 ||
    r.classMapTest > 0
  );
}

@Injectable()
export class MonthlySummaryService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async listYearMonths(entId: string): Promise<string[]> {
    const rows = await this.ds.query<{ ym: string }[]>(
      `SELECT DISTINCT dkp_year_month AS ym
         FROM amb_acm_dsh_daily_kpi
        WHERE ent_id = $1
        ORDER BY ym ASC`,
      [entId],
    );
    return rows.map((r) => r.ym);
  }

  async getMonthlySummary(entId: string, yearMonth: string): Promise<MonthlySummaryResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const prev = prevYearMonth(yearMonth);
    const [rows, prevRows] = await Promise.all([
      repo.find({ where: { entId, yearMonth }, order: { date: 'ASC' } }),
      repo.find({ where: { entId, yearMonth: prev }, order: { date: 'ASC' } }),
    ]);
    const previousYM = rows.length > 0 || prevRows.length > 0 ? prev : null;
    const populatedDayCount = rows.filter(isPopulated).length;
    const categories = CATEGORY_ORDER.map((cat) => buildCategory(cat, rows, prevRows));
    return { yearMonth, previousYearMonth: previousYM, populatedDayCount, categories };
  }

  async getRangeSummary(entId: string, from: string, to: string): Promise<RangeSummaryResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const lengthDays = diffDaysInclusive(from, to);
    const previousTo = isoAddDays(from, -1);
    const previousFrom = isoAddDays(previousTo, -(lengthDays - 1));

    const [rows, prevRows] = await Promise.all([
      repo.find({ where: { entId, date: Between(from, to) }, order: { date: 'ASC' } }),
      repo.find({ where: { entId, date: Between(previousFrom, previousTo) }, order: { date: 'ASC' } }),
    ]);

    const populatedDayCount = rows.filter(isPopulated).length;
    const categories = CATEGORY_ORDER.map((cat) => buildCategory(cat, rows, prevRows));

    return {
      from,
      to,
      previousFrom: prevRows.length > 0 ? previousFrom : null,
      previousTo: prevRows.length > 0 ? previousTo : null,
      populatedDayCount,
      categories,
    };
  }
}
