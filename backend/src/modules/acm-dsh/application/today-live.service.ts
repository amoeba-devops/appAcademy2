import type { CategorySummary } from './monthly-summary.service';
import { readMarketingDay } from './marketing-input.service';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { SourceCurrentService } from './source-current.service';
import { DailyKpiService } from './daily-kpi.service';
import { OperatingService } from './operating.service';
import { LifecycleService } from './lifecycle.service';
import { MetricDefinitionService } from './metric-definition.service';
import { KPI_FIELDS } from './kpi-aggregation';
import { kstDaysAgo } from '../business-date';
import { LifeCell } from './lifecycle-calculation';
@Injectable()
export class TodayLiveService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly source: SourceCurrentService,
    private readonly daily: DailyKpiService,
    private readonly operating: OperatingService,
    private readonly lifecycle: LifecycleService,
    private readonly metrics: MetricDefinitionService,
  ) {}
  async operatingRange(entId: string, from: string, to: string, site = 'ALL') {
    const [ops, life] = await Promise.all([
      this.operating.range(entId, from, to, site),
      this.lifecycle.range(entId, from, to, site),
    ]);
    const codes = [
      'ops_new_st',
      'ops_returning_st',
      'ops_referral_st',
    ] as const;
    return {
      ...ops,
      definitionVersion: 'operating-lifecycle-v1',
      metrics: [...ops.metrics, 'ops_returning_st', 'ops_referral_st'],
      rows: ops.rows.map((r) => ({
        ...r,
        values: {
          ...r.values,
          ...Object.fromEntries(
            codes.map((c) => [
              c,
              life.rows.find((l) => l.date === r.date)?.values[c],
            ]),
          ),
        },
      })),
      summary: {
        ...ops.summary,
        ...Object.fromEntries(codes.map((c) => [c, life.summary[c]])),
      },
    };
  }
  async decorateSummary<T extends { categories: CategorySummary[] }>(
    base: T,
    entId: string,
    from: string,
    to: string,
    site = 'ALL',
  ): Promise<T> {
    const [life, definitions] = await Promise.all([
      this.lifecycle.range(entId, from, to, site),
      this.metrics.list(entId),
    ]);
    for (const category of base.categories) {
      for (const definition of definitions.filter(
        (d) => d.category === category.category && d.code in life.summary,
      )) {
        const cell = life.summary[definition.code as keyof typeof life.summary];
        const metric = {
          code: definition.code,
          labelKr: definition.labelKr,
          labelEn: definition.labelEn,
          isSnapshot: definition.aggregationType === 'STATUS_SNAPSHOT',
          coverage: {
            validDays: life.rows.filter(
              (r) =>
                r.values[definition.code as keyof typeof life.summary]
                  .calculated !== null,
            ).length,
            expectedDays: life.rows.length,
            asOf: life.asOf,
            status:
              cell.quality === 'UNAVAILABLE'
                ? ('MISSING' as const)
                : ('PARTIAL' as const),
          },
          sum: cell.calculated,
          aver: null,
          previousSum: null,
          momDeltaPct: null,
        };
        category.metrics = [
          ...category.metrics.filter((m) => m.code !== definition.code),
          metric,
        ];
      }
    }
    return base;
  }
  async get(entId: string) {
    const today = kstDaysAgo(0);
    const [source, grid, ops, life, metrics, marketing] = await Promise.all([
      this.source.getCurrent(entId),
      this.daily.getRange(entId, today, today),
      this.operatingRange(entId, today, today),
      this.lifecycle.range(entId, today, today),
      this.metrics.list(entId),
      readMarketingDay(this.ds, entId, today),
    ]);
    const [live] = await this.ds.query<Array<Record<string, number>>>(
      `
 WITH inquiries AS (SELECT * FROM amb_acm_csl_inquiry WHERE ent_id=$1 AND deleted_at IS NULL),
 enrollments AS (SELECT e.* FROM amb_acm_csl_enrollment e JOIN inquiries i ON i.inq_id=e.inq_id AND i.ent_id=e.ent_id),
 manual AS (SELECT * FROM amb_acm_dsh_manual_inputs WHERE ent_id=$1 AND min_date=$2 AND min_deleted_at IS NULL)
 SELECT
 (SELECT count(*) FROM inquiries WHERE inq_registered_at=$2)::int cs_counseling,
 (SELECT count(*) FROM enrollments WHERE enr_applied AND (updated_at AT TIME ZONE 'Asia/Seoul')::date=$2)::int cs_apply,
 (SELECT count(*) FROM enrollments WHERE cls_started_at=$2)::int cs_beginning,
 (SELECT count(*) FROM amb_acm_csl_transition e JOIN inquiries i ON e.inq_id=i.inq_id AND e.ent_id=i.ent_id WHERE e.to_status='DROPPED' AND (e.occurred_at AT TIME ZONE 'Asia/Seoul')::date=$2)::int cs_missing,
 (SELECT count(*) FROM amb_acm_csl_trial_class e JOIN inquiries i ON e.inq_id=i.inq_id AND e.ent_id=i.ent_id WHERE e.tcl_held_at=$2)::int cs_trial_class,
 ((SELECT count(*) FROM amb_acm_dsh_complaints WHERE ent_id=$1 AND cmp_date=$2 AND cmp_deleted_at IS NULL)+COALESCE((SELECT sum(min_cs_complain) FROM manual),0))::int cs_complain,
 (SELECT count(*) FROM amb_acm_csl_map_test e JOIN inquiries i ON e.inq_id=i.inq_id AND e.ent_id=i.ent_id WHERE e.mpt_scheduled_at=$2)::int cls_map_test,
 (SELECT COALESCE(sum(ses_duration_min),0)/60.0 FROM amb_acm_cls_sessions WHERE ent_id=$1 AND ses_status='HELD' AND ses_deleted_at IS NULL AND (ses_scheduled_at AT TIME ZONE 'Asia/Seoul')::date=$2)::float cls_tt_class,
 (SELECT count(DISTINCT s.cst_student_user_id) FROM amb_acm_cls_class_students s JOIN amb_acm_cls_classes c ON c.cls_id=s.cls_id AND c.ent_id=s.ent_id WHERE s.ent_id=$1 AND c.cls_deleted_at IS NULL AND s.cst_enrolled_at<=$2 AND (s.cst_left_at IS NULL OR s.cst_left_at>=$2) AND c.cls_status IN ('ACTIVE','PROPOSED','PAUSED'))::int cls_student,
 (SELECT count(DISTINCT cls_teacher_user_id) FROM amb_acm_cls_classes WHERE ent_id=$1 AND cls_deleted_at IS NULL AND cls_started_at<=$2 AND (cls_ended_at IS NULL OR cls_ended_at>=$2) AND cls_status IN ('ACTIVE','PROPOSED','PAUSED'))::int cls_teacher`,
      [entId, today],
    );
    const row = grid.rows[0];
    if (row?.manuallyOverridden)
      for (const code of Object.keys(live)) {
        const field = KPI_FIELDS[code as keyof typeof KPI_FIELDS];
        if (field && row[field] != null) live[code] = Number(row[field]);
      }
    live.mkt_effect = live.cs_counseling + live.cs_apply;
    const visitorSites = marketing.sites.filter((s) => s.site !== 'COMMON');
    const visitor =
      !marketing.additive && marketing.legacyVisitor !== null
        ? marketing.legacyVisitor
        : visitorSites.every((s) => s.visitor !== null)
          ? visitorSites.reduce((n, s) => n + s.visitor!, 0)
          : null;
    const cost = marketing.sites.some((s) => s.automaticPending)
      ? null
      : marketing.sites.some((s) => s.cost !== null)
        ? marketing.sites.reduce((n, s) => n + (s.cost ?? 0), 0)
        : marketing.legacyCost;

    const values: Record<string, LifeCell> = {};
    for (const m of metrics) {
      let cell: LifeCell | undefined;
      if (m.category === 'OPERATING')
        cell = ops.summary[m.code as keyof typeof ops.summary] as
          | LifeCell
          | undefined;
      if (m.code in life.summary)
        cell = life.summary[m.code as keyof typeof life.summary];
      if (!cell) {
        const field = KPI_FIELDS[m.code as keyof typeof KPI_FIELDS];
        const raw =
          m.code === 'mkt_visitor'
            ? visitor
            : m.code === 'mkt_cost'
              ? cost
              : m.code in live
                ? live[m.code]
                : field && row
                  ? row[field]
                  : null;
        const value = raw == null ? null : Number(raw);
        cell = {
          calculated: value !== null && Number.isFinite(value) ? value : null,
          manual: null,
          manualPresent: false,
          quality:
            value == null
              ? 'UNAVAILABLE'
              : m.category === 'MARKETING'
                ? 'PARTIAL'
                : 'COMPLETE',
        };
      }
      values[m.code] = cell;
    }
    const externalSources = await this.ds.query<
      Array<{
        provider: string;
        syncedAt: string | null;
        dataDate: string | null;
        status: string | null;
      }>
    >(
      `SELECT c.provider,MAX(v.updated_at)::text "syncedAt",MAX(v.date)::text "dataDate",(SELECT r.status FROM amb_acm_ads_run r WHERE r.ent_id=c.ent_id AND r.adc_id=c.adc_id ORDER BY r.created_at DESC LIMIT 1) status FROM amb_acm_ads_connection c LEFT JOIN amb_acm_ads_day_coverage v ON v.ent_id=c.ent_id AND v.adc_id=c.adc_id WHERE c.ent_id=$1 AND c.active GROUP BY c.ent_id,c.adc_id,c.provider`,
      [entId],
    );
    return {
      ...source,
      today,
      externalSources,
      asOf: new Date().toISOString(),
      definitionVersion: 'today-live-v1',
      metrics,
      values,
      externalSyncedAt: grid.ga4LastSyncAt,
      externalDataDate: grid.ga4LastDataDate,
    };
  }
}
