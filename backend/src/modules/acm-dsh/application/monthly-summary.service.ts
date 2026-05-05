import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';

export type DshCategory = 'MARKETING' | 'CS' | 'OPERATING' | 'CLASS';

export interface CategorySummary {
  category: DshCategory;
  primaryMetricCode: string;
  primaryMetricLabelKr: string;
  primaryMetricLabelEn: string;
  sum: number;
  aver: number | null;
  previousSum: number | null;
  momDeltaPct: number | null;
  series: number[]; // daily series for primary metric
}

export interface MonthlySummaryResult {
  yearMonth: string;
  previousYearMonth: string | null;
  populatedDayCount: number;
  categories: CategorySummary[];
}

const PRIMARY: Record<
  DshCategory,
  { code: string; field: keyof DailyKpiTypeormEntity; labelKr: string; labelEn: string; isSnapshot?: boolean }
> = {
  MARKETING: { code: 'mkt_visitor', field: 'marketingVisitor', labelKr: '방문자', labelEn: 'Visitor' },
  CS: { code: 'cs_counseling', field: 'csCounseling', labelKr: '상담', labelEn: 'Counseling' },
  OPERATING: {
    code: 'ops_count_st',
    field: 'opsCountSt',
    labelKr: '학생수',
    labelEn: '# of Students',
    isSnapshot: true,
  },
  CLASS: { code: 'cls_tt_class', field: 'classTtClass', labelKr: '총수업', labelEn: 'Tt. Class' },
};

const CATEGORY_ORDER: DshCategory[] = ['MARKETING', 'CS', 'OPERATING', 'CLASS'];

function prevYearMonth(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function numOf(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class MonthlySummaryService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  /** Distinct year-months that have at least one row, ASC. */
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
    const [rows, prevRows] = await Promise.all([
      repo.find({ where: { entId, yearMonth }, order: { date: 'ASC' } }),
      (async () => {
        const prev = prevYearMonth(yearMonth);
        return repo.find({ where: { entId, yearMonth: prev }, order: { date: 'ASC' } });
      })(),
    ]);

    const previousYM = rows.length > 0 || prevRows.length > 0 ? prevYearMonth(yearMonth) : null;

    const populatedDayCount = rows.filter(
      (r) =>
        (r.marketingVisitor ?? 0) > 0 ||
        r.csCounseling > 0 ||
        r.csApply > 0 ||
        r.csBeginning > 0 ||
        r.csTrialClass > 0 ||
        r.classMapTest > 0,
    ).length;

    const categories: CategorySummary[] = CATEGORY_ORDER.map((cat) => {
      const meta = PRIMARY[cat];
      const series = rows.map((r) => numOf(r[meta.field]));
      const prevSeries = prevRows.map((r) => numOf(r[meta.field]));

      let sum: number;
      let aver: number | null;
      let prevSum: number | null;

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
        category: cat,
        primaryMetricCode: meta.code,
        primaryMetricLabelKr: meta.labelKr,
        primaryMetricLabelEn: meta.labelEn,
        sum: Math.round(sum * 10) / 10,
        aver: aver === null ? null : Math.round(aver * 10) / 10,
        previousSum: prevSum === null ? null : Math.round(prevSum * 10) / 10,
        momDeltaPct: momDeltaPct === null ? null : Math.round(momDeltaPct * 10) / 10,
        series,
      };
    });

    return {
      yearMonth,
      previousYearMonth: previousYM,
      populatedDayCount,
      categories,
    };
  }
}
