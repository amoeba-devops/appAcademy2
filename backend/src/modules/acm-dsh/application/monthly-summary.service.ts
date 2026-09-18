import {
  aggregateKpis,
  comparisonRange,
  type KpiRow,
  type KpiCode,
  type MetricCoverage,
} from './kpi-aggregation';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';
import { DailyKpiSiteTypeormEntity } from '../infrastructure/typeorm/daily-kpi-site.typeorm-entity';
import type { DshSite } from './dsh-site.util';

export type DshCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';

export interface MetricSummary {
  code: string;
  labelKr: string;
  labelEn: string;
  isSnapshot: boolean;
  coverage: MetricCoverage;
  sum: number | null;
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
  sum: number | null;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
  series: (number | null)[];
  /** v2 — up to 3 key metrics rendered as a mini-table inside the card. */
  metrics: MetricSummary[];
}

export interface RangeSummaryResult {
  from: string;
  to: string;
  previousFrom: string | null;
  previousTo: string | null;
  populatedDayCount: number;
  actualThrough: string | null;
  categories: CategorySummary[];
  /** PLN-260914B — site filter applied (undefined = tenant total) */
  site?: DshSite;
}

export interface MonthlySummaryResult {
  yearMonth: string;
  previousYearMonth: string | null;
  populatedDayCount: number;
  actualThrough: string | null;
  categories: CategorySummary[];
}

/** Minimal row shape shared by daily_kpi and the per-site table. */
type KpiLike = KpiRow;

interface MetricMeta {
  code: KpiCode;
  field: keyof KpiLike;
  labelKr: string;
  labelEn: string;
  isSnapshot?: boolean;
  /** mkt_effect is derived: cs_counseling + cs_apply. */
  derived?: 'EFFECT';
}

const CATEGORY_METRICS: Record<DshCategory, MetricMeta[]> = {
  MARKETING: [
    {
      code: 'mkt_visitor',
      field: 'marketingVisitor',
      labelKr: '방문자',
      labelEn: 'Visitor',
    },
    {
      code: 'mkt_cost',
      field: 'marketingCost',
      labelKr: '전체 비용',
      labelEn: 'Cost',
    },
    {
      code: 'mkt_effect',
      field: 'marketingEffect',
      labelKr: '효과',
      labelEn: 'Effect',
      derived: 'EFFECT',
    },
  ],
  CS: [
    {
      code: 'cs_counseling',
      field: 'csCounseling',
      labelKr: '상담',
      labelEn: 'Counseling',
    },
    { code: 'cs_apply', field: 'csApply', labelKr: '지원', labelEn: 'Apply' },
    {
      code: 'cs_trial_class',
      field: 'csTrialClass',
      labelKr: '체험수업',
      labelEn: 'Trial Class',
    },
  ],
  OPERATING: [
    {
      code: 'ops_count_st',
      field: 'opsCountSt',
      labelKr: '학생수',
      labelEn: '# of Students',
      isSnapshot: true,
    },
    {
      code: 'ops_count_tc',
      field: 'opsCountTc',
      labelKr: '강사수',
      labelEn: '# of Teachers',
      isSnapshot: true,
    },
    {
      code: 'ops_new_st',
      field: 'opsNewSt',
      labelKr: '신입생',
      labelEn: 'New St.',
    },
  ],
  CLASS: [
    {
      code: 'cls_tt_class',
      field: 'classTtClass',
      labelKr: '총수업',
      labelEn: 'Tt. Class',
    },
    {
      code: 'cls_student',
      field: 'classStudent',
      labelKr: '학생',
      labelEn: 'Student',
    },
    {
      code: 'cls_teacher',
      field: 'classTeacher',
      labelKr: '강사',
      labelEn: 'Teacher',
    },
  ],
};

const CATEGORY_ORDER: DshCategory[] = ['MARKETING', 'CS', 'OPERATING', 'CLASS'];
/** PLN-260914B — categories that carry a site dimension. */
const SITE_CATEGORIES: DshCategory[] = ['MARKETING', 'CS'];

function buildCategory(
  cat: DshCategory,
  aggregate: ReturnType<typeof aggregateKpis>,
  previous: ReturnType<typeof aggregateKpis>,
): CategorySummary {
  const metrics = CATEGORY_METRICS[cat].map((meta): MetricSummary => {
    const coverage = aggregate.coverage[meta.code];
    const priorCoverage = previous.coverage[meta.code];
    const sum = aggregate.sums[meta.code];
    const previousSum = previous.sums[meta.code];
    const comparable =
      coverage.status === 'AVAILABLE' && priorCoverage.status === 'AVAILABLE';
    return {
      code: meta.code,
      labelKr: meta.labelKr,
      labelEn: meta.labelEn,
      isSnapshot: !!meta.isSnapshot,
      sum,
      previousSum,
      coverage,
      aver: aggregate.averages[meta.code],
      momDeltaPct:
        comparable && sum !== null && previousSum !== null && previousSum !== 0
          ? Math.round(((sum - previousSum) / previousSum) * 1000) / 10
          : null,
    };
  });
  const primary = metrics[0];
  return {
    category: cat,
    primaryMetricCode: primary.code,
    primaryMetricLabelKr: primary.labelKr,
    primaryMetricLabelEn: primary.labelEn,
    sum: primary.sum,
    aver: primary.aver,
    previousSum: primary.previousSum,
    momDeltaPct: primary.momDeltaPct,
    series: aggregate.series[primary.code],
    metrics,
  };
}

/** Per-site row → KpiLike (OPERATING/CLASS have no site dimension → 0). */
function siteRowToKpiLike(r: DailyKpiSiteTypeormEntity): KpiLike {
  return {
    date: r.date,
    marketingVisitor: r.marketingVisitor ?? null,
    marketingCost: r.marketingCost ?? null,
    marketingEffect: r.marketingEffect ?? null,
    csCounseling: r.csCounseling,
    csApply: r.csApply,
    csBeginning: r.csBeginning,
    csMissing: r.csMissing,
    csTrialClass: r.csTrialClass,
    csComplain: r.csComplain,
    opsNewSt: 0,
    opsOutSt: 0,
    opsCountSt: 0,
    opsNewTc: 0,
    opsOutTc: 0,
    opsCountTc: 0,
    classMapTest: 0,
    classTtClass: '0',
    classStudent: 0,
    classTeacher: 0,
  };
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

  async getMonthlySummary(
    entId: string,
    yearMonth: string,
  ): Promise<MonthlySummaryResult> {
    const from = `${yearMonth}-01`;
    const to = new Date(
      Date.UTC(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10);
    const result = await this.getRangeSummary(entId, from, to);
    return {
      yearMonth,
      previousYearMonth: result.previousFrom?.slice(0, 7) ?? null,
      populatedDayCount: result.populatedDayCount,
      actualThrough: result.actualThrough,
      categories: result.categories,
    };
  }

  /**
   * Range summary. PLN-260914B: with `site`, rows come from daily_kpi_site and
   * only the site-aware categories (MARKETING, CS) are returned.
   */
  async getRangeSummary(
    entId: string,
    from: string,
    to: string,
    site?: DshSite,
  ): Promise<RangeSummaryResult> {
    const { previousFrom, previousTo } = comparisonRange(from, to);

    let rows: KpiLike[];
    let prevRows: KpiLike[];
    if (site) {
      const repo = this.ds.getRepository(DailyKpiSiteTypeormEntity);
      const [a, b] = await Promise.all([
        repo.find({
          where: { entId, site, date: Between(from, to) },
          order: { date: 'ASC' },
        }),
        repo.find({
          where: { entId, site, date: Between(previousFrom, previousTo) },
          order: { date: 'ASC' },
        }),
      ]);
      rows = a.map(siteRowToKpiLike);
      prevRows = b.map(siteRowToKpiLike);
    } else {
      const repo = this.ds.getRepository(DailyKpiTypeormEntity);
      [rows, prevRows] = await Promise.all([
        repo.find({
          where: { entId, date: Between(from, to) },
          order: { date: 'ASC' },
        }),
        repo.find({
          where: { entId, date: Between(previousFrom, previousTo) },
          order: { date: 'ASC' },
        }),
      ]);
    }

    const aggregate = aggregateKpis(rows, from, to);
    const previous = aggregateKpis(prevRows, previousFrom, previousTo);
    const populatedDayCount = aggregate.populatedDayCount;
    const cats = site ? SITE_CATEGORIES : CATEGORY_ORDER;
    const categories = cats.map((cat) =>
      buildCategory(cat, aggregate, previous),
    );

    return {
      from,
      to,
      previousFrom: prevRows.length > 0 ? previousFrom : null,
      previousTo: prevRows.length > 0 ? previousTo : null,
      populatedDayCount,
      actualThrough: aggregate.actualThrough,
      categories,
      site,
    };
  }
}
