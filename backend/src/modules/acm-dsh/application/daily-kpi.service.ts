import {
  aggregateKpis,
  kpiToday,
  type MetricCoverage,
} from './kpi-aggregation';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  DailyKpiTypeormEntity,
  type DkpDayOfWeek,
} from '../infrastructure/typeorm/daily-kpi.typeorm-entity';
import { ManualInputTypeormEntity } from '../infrastructure/typeorm/manual-input.typeorm-entity';
import { ComplaintTypeormEntity } from '../infrastructure/typeorm/complaint.typeorm-entity';
import { DailyKpiSiteTypeormEntity } from '../infrastructure/typeorm/daily-kpi-site.typeorm-entity';
import { Between, IsNull } from 'typeorm';
import type { UpsertDailyKpiManualDto } from './dto/daily-kpi-manual.dto';
import {
  DSH_SITES,
  DSH_SITE_COMMON,
  DSH_SITE_ROWS,
  INQ_SITE_SQL,
  NOT_DELETED_INQ,
  type DshSite,
  type DshSiteOrCommon,
} from './dsh-site.util';

const DOW_EN: DkpDayOfWeek[] = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

export interface MonthGridResult {
  yearMonth: string;
  rows: DailyKpiTypeormEntity[];
  sums: Record<string, number | null>;
  coverage: Record<string, MetricCoverage>;
  actualThrough: string | null;
  averages: Record<string, number | null>;
  populatedDayCount: number;
}

export interface RangeGridResult {
  from: string;
  to: string;
  rows: DailyKpiTypeormEntity[];
  sums: Record<string, number | null>;
  coverage: Record<string, MetricCoverage>;
  actualThrough: string | null;
  averages: Record<string, number | null>;
  populatedDayCount: number;
  /** PLN-260912 — GA4 per-site visitors: { [date]: { TPI: n, TRINITY: n, SANTACROCE: n } } */
  siteVisits: Record<string, Record<string, number>>;
  /** Dates whose marketingVisitor comes from manual input (override) */
  manualVisitorDates: string[];
  /** Last successful/failed GA4 sync timestamp of the active config, if any */
  ga4LastDataDate?: string | null;
  ga4LastSyncAt: string | null;
  /** PLN-260914B — site filter applied (undefined = tenant total) */
  site?: DshSite;
}

/** PLN-260914B — one row of the consolidated site comparison table. */
export interface SiteComparisonRow {
  site: DshSiteOrCommon | 'TOTAL';
  visitor: number | null;
  counseling: number | null;
  apply: number | null;
  effect: number | null;
  cost: number | null;
  complain: number | null;
}

/** Override mkt_effect = cs_counseling + cs_apply on the in-memory row. */
function applyEffectOverride(rows: DailyKpiTypeormEntity[]): void {
  for (const r of rows) {
    r.marketingEffect = (r.csCounseling ?? 0) + (r.csApply ?? 0);
  }
}

@Injectable()
export class DailyKpiService {
  private readonly logger = new Logger(DailyKpiService.name);

  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async getMonthGrid(
    entId: string,
    yearMonth: string,
  ): Promise<MonthGridResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const rows = await repo.find({
      where: { entId, yearMonth },
      order: { date: 'ASC' },
    });
    applyEffectOverride(rows);

    const from = `${yearMonth}-01`;
    const to = new Date(
      Date.UTC(Number(yearMonth.slice(0, 4)), Number(yearMonth.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10);
    const aggregate = aggregateKpis(rows, from, to);

    return {
      yearMonth,
      rows,
      ...aggregate,
    };
  }

  /**
   * Range grid — same shape as monthly grid but for any [from, to] window.
   * Caller validates from <= to and (to - from) <= 365 days.
   */
  async getRange(
    entId: string,
    from: string,
    to: string,
    site?: DshSite,
  ): Promise<RangeGridResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    // PLN-260914B — site view reads the per-site table and presents it in the daily_kpi shape
    const rows = site
      ? await this.loadSiteRowsAsKpi(entId, from, to, site)
      : await repo.find({
          where: { entId, date: Between(from, to) },
          order: { date: 'ASC' },
        });
    applyEffectOverride(rows);

    const aggregate = aggregateKpis(rows, from, to);

    // PLN-260912 — per-site GA4 breakdown + manual-override dates for the same window
    const svtRows = await this.ds.query<
      { d: string; site: string; v: string; source: string }[]
    >(
      `SELECT svt_date::text AS d, svt_site AS site, svt_visitors::text AS v, svt_source AS source
         FROM amb_acm_dsh_site_visit
        WHERE ent_id = $1 AND svt_date BETWEEN $2 AND $3
          AND ($4::text IS NULL OR svt_site = $4)
        ORDER BY svt_date, svt_site`,
      [entId, from, to, site ?? null],
    );
    const siteVisits: Record<string, Record<string, number>> = {};
    for (const r of svtRows) {
      siteVisits[r.d] ??= {};
      siteVisits[r.d][r.site] = Number(r.v);
    }
    const manualRows = await this.ds.query<{ d: string }[]>(
      `SELECT min_date::text AS d FROM amb_acm_dsh_manual_inputs
        WHERE ent_id = $1 AND min_date BETWEEN $2 AND $3
          AND min_marketing_visitor IS NOT NULL AND min_deleted_at IS NULL
          AND (($4::text IS NULL AND min_site IS NULL) OR min_site = $4)`,
      [entId, from, to, site ?? null],
    );
    const manualVisitorDates = manualRows.map((r) => r.d);
    const gacRows = await this.ds.query<{ at: string | null }[]>(
      `SELECT gac_last_sync_at::text AS at FROM amb_acm_ga4_config
        WHERE ent_id = $1 AND gac_is_active = TRUE`,
      [entId],
    );
    const ga4LastSyncAt = gacRows[0]?.at ?? null;

    return {
      from,
      to,
      rows,
      ...aggregate,
      siteVisits,
      manualVisitorDates,
      ga4LastSyncAt,
      ga4LastDataDate:
        svtRows
          .filter((r) => r.source === 'GA4')
          .map((r) => r.d)
          .sort()
          .at(-1) ?? null,
      site,
    };
  }

  /**
   * Full-row manual override of a single daily_kpi row.
   * Sets dkp_manually_overridden=true so daily_batch will skip this day.
   */
  async upsertManualKpi(
    entId: string,
    isoDate: string,
    dto: UpsertDailyKpiManualDto,
  ): Promise<DailyKpiTypeormEntity> {
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(DailyKpiTypeormEntity);
      const d = new Date(`${isoDate}T00:00:00Z`);
      const yearMonth = isoDate.slice(0, 7);
      const dayOfMonth = d.getUTCDate();
      const dow = d.getUTCDay();
      const now = new Date();

      const existing = await repo.findOne({ where: { entId, date: isoDate } });
      const base: Partial<DailyKpiTypeormEntity> = existing ?? {
        entId,
        date: isoDate,
        yearMonth,
        dayOfMonth,
        dayOfWeek: DOW_EN[dow],
        dayOfWeekKr: DOW_KR[dow],
        csCounseling: 0,
        csApply: 0,
        csBeginning: 0,
        csMissing: 0,
        csTrialClass: 0,
        csComplain: 0,
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
        computationStatus: 'FRESH',
        dataCompleteness: 'COMPLETE',
        createdAt: now,
      };

      const apply = <K extends keyof DailyKpiTypeormEntity>(
        k: K,
        v: unknown,
      ) => {
        if (v !== undefined && v !== null) (base as any)[k] = v;
      };
      apply('marketingVisitor', dto.marketingVisitor ?? null);
      if (dto.marketingCost !== undefined)
        (base as any).marketingCost = String(dto.marketingCost);
      apply('csCounseling', dto.csCounseling);
      apply('csApply', dto.csApply);
      apply('csBeginning', dto.csBeginning);
      apply('csMissing', dto.csMissing);
      apply('csTrialClass', dto.csTrialClass);
      apply('csComplain', dto.csComplain);
      apply('opsNewSt', dto.opsNewSt);
      apply('opsOutSt', dto.opsOutSt);
      apply('opsCountSt', dto.opsCountSt);
      apply('opsNewTc', dto.opsNewTc);
      apply('opsOutTc', dto.opsOutTc);
      apply('opsCountTc', dto.opsCountTc);
      apply('classMapTest', dto.classMapTest);
      if (dto.classTtClass !== undefined)
        (base as any).classTtClass = dto.classTtClass.toFixed(1);
      apply('classStudent', dto.classStudent);
      apply('classTeacher', dto.classTeacher);
      // derived effect
      (base as any).marketingEffect =
        ((base as any).csCounseling ?? 0) + ((base as any).csApply ?? 0);
      (base as any).manuallyOverridden = true;
      (base as any).computationStatus = 'FRESH';
      (base as any).dataCompleteness = 'COMPLETE';
      (base as any).computedAt = now;
      (base as any).updatedAt = now;
      (base as any).lastRecomputeReason = 'manual_full_override';

      const mapping = {
        opsNewSt: 'ops_new_st',
        opsOutSt: 'ops_out_st',
        opsCountSt: 'ops_count_st',
        opsNewTc: 'ops_new_tc',
        opsOutTc: 'ops_out_tc',
        opsCountTc: 'ops_count_tc',
      } as const;
      for (const key of Object.keys(mapping) as (keyof typeof mapping)[]) {
        if (dto[key] !== undefined && dto[key] !== null)
          await manager.query(
            `INSERT INTO amb_acm_dsh_operating_manual(ent_id,date,site,metric,value,source) VALUES($1,$2,'ALL',$3,$4,'manual-api') ON CONFLICT(ent_id,date,site,metric) DO UPDATE SET value=EXCLUDED.value,source=EXCLUDED.source,updated_at=now()`,
            [entId, isoDate, mapping[key], dto[key]],
          );
      }
      if (existing) {
        await repo.update({ id: existing.id }, base as object);
        return (await repo.findOne({ where: { id: existing.id } }))!;
      }
      const inserted = await repo.save(base as DailyKpiTypeormEntity);
      return inserted;
    });
  }

  /**
   * Recompute a single day's daily_kpi row for the given entity.
   * Idempotent: deletes/inserts (ent_id, date) row.
   * In v1.0a: CSL-sourced metrics + manual inputs only. CLS metrics remain 0.
   */
  async recomputeDay(
    entId: string,
    isoDate: string,
    reason = 'manual_recompute',
  ): Promise<void> {
    const dkpRepo = this.ds.getRepository(DailyKpiTypeormEntity);
    const minRepo = this.ds.getRepository(ManualInputTypeormEntity);
    const cmpRepo = this.ds.getRepository(ComplaintTypeormEntity);

    // Skip if this row was full-overridden via manual upsert
    const existing = await dkpRepo.findOne({ where: { entId, date: isoDate } });
    if (existing?.manuallyOverridden) {
      this.logger.log(
        `recomputeDay SKIP (manually_overridden) ent=${entId} date=${isoDate}`,
      );
      return;
    }

    const d = new Date(`${isoDate}T00:00:00Z`);
    const yearMonth = isoDate.slice(0, 7);
    const dayOfMonth = d.getUTCDate();
    const dow = d.getUTCDay();

    // CSL aggregations — single SQL trip per metric using parameterised queries
    type CountRow = { c: string };
    const counselingQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_inquiry
        WHERE ent_id = $1 AND inq_registered_at = $2
          AND deleted_at IS NULL`,
      [entId, isoDate],
    );
    const cs_counseling = Number(counselingQ[0]?.c ?? 0);

    // apply: enrollment rows where enr_applied=true and updated on this day
    const applyQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_enrollment e
        WHERE e.ent_id = $1 AND e.enr_applied = true
          AND DATE(e.updated_at AT TIME ZONE 'Asia/Seoul') = $2
          AND ${NOT_DELETED_INQ}`,
      [entId, isoDate],
    );
    const cs_apply = Number(applyQ[0]?.c ?? 0);

    // beginning: cls_started_at = day
    const begQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_enrollment e
        WHERE e.ent_id = $1 AND e.cls_started_at = $2
          AND ${NOT_DELETED_INQ}`,
      [entId, isoDate],
    );
    const cs_beginning = Number(begQ[0]?.c ?? 0);

    // missing: transition to DROPPED on day
    const missQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_transition e
        WHERE e.ent_id = $1 AND e.to_status = 'DROPPED'
          AND DATE(e.occurred_at AT TIME ZONE 'Asia/Seoul') = $2
          AND ${NOT_DELETED_INQ}`,
      [entId, isoDate],
    );
    const cs_missing = Number(missQ[0]?.c ?? 0);

    // trial class: tcl_held_at = day
    const tclQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_trial_class e
        WHERE e.ent_id = $1 AND e.tcl_held_at = $2
          AND ${NOT_DELETED_INQ}`,
      [entId, isoDate],
    );
    const cs_trial_class = Number(tclQ[0]?.c ?? 0);

    // map test scheduled
    const mapQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_map_test e
        WHERE e.ent_id = $1 AND e.mpt_scheduled_at = $2
          AND ${NOT_DELETED_INQ}`,
      [entId, isoDate],
    );
    const cls_map_test = Number(mapQ[0]?.c ?? 0);

    // ── CLS metrics (v1.0b) ─────────────────────────────────────────
    // Tt. Class: HELD sessions on this day; sum of duration / 60 (hours)
    const ttClassQ = await this.ds.query<{ h: string | null }[]>(
      `SELECT COALESCE(SUM(ses_duration_min),0)::text AS h
         FROM amb_acm_cls_sessions
        WHERE ent_id = $1
          AND ses_status = 'HELD'
          AND ses_deleted_at IS NULL
          AND DATE(ses_scheduled_at AT TIME ZONE 'Asia/Seoul') = $2`,
      [entId, isoDate],
    );
    const cls_tt_class = (Number(ttClassQ[0]?.h ?? 0) / 60).toFixed(1);

    // Distinct active students in classes whose started_at ≤ day and (ended_at IS NULL OR ≥ day)
    const stuQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(DISTINCT cst.cst_student_user_id)::text AS c
         FROM amb_acm_cls_class_students cst
         JOIN amb_acm_cls_classes c ON c.cls_id = cst.cls_id
        WHERE cst.ent_id = $1 AND c.cls_deleted_at IS NULL
          AND cst.cst_enrolled_at <= $2
          AND (cst.cst_left_at IS NULL OR cst.cst_left_at >= $2)
          AND c.cls_status IN ('ACTIVE','PROPOSED','PAUSED')`,
      [entId, isoDate],
    );
    const cls_student_active = Number(stuQ[0]?.c ?? 0);

    // Distinct active teachers
    const tchQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(DISTINCT cls_teacher_user_id)::text AS c
         FROM amb_acm_cls_classes
        WHERE ent_id = $1 AND cls_deleted_at IS NULL
          AND cls_started_at <= $2
          AND (cls_ended_at IS NULL OR cls_ended_at >= $2)
          AND cls_status IN ('ACTIVE','PROPOSED','PAUSED')`,
      [entId, isoDate],
    );
    const cls_teacher_active = Number(tchQ[0]?.c ?? 0);

    // ops_count snapshots = current student/teacher counts
    const ops_count_st = cls_student_active;
    const ops_count_tc = cls_teacher_active;

    // complaint count from complaints table
    const cmpCnt = await cmpRepo.count({ where: { entId, date: isoDate } });

    // manual input — PLN-260914B: tenant-level row (site NULL) + optional per-site rows
    const manualRows = await minRepo.find({
      where: { entId, date: isoDate, deletedAt: IsNull() },
    });
    const manual = manualRows.find((m) => !m.site) ?? null;
    const manualSiteRows = manualRows.filter((m) => !!m.site);
    const costVals = manualRows
      .map((m) => m.marketingCost)
      .filter((v): v is string => v !== null && v !== undefined && v !== '');
    const manualCostTotal = costVals.length
      ? String(costVals.reduce((s, v) => s + Number(v), 0))
      : null;
    const manualComplainTotal = manualRows.reduce(
      (s, m) => s + (m.csComplain ?? 0),
      0,
    );

    // PLN-260912/PLN-260914B — tenant visitor = tenant manual ?? Σ_site (site manual ?? GA4 site visits)
    const svtQ = await this.ds.query<{ site: string; s: string }[]>(
      `SELECT svt_site AS site, COALESCE(SUM(svt_visitors),0)::text AS s
         FROM amb_acm_dsh_site_visit
        WHERE ent_id = $1 AND svt_date = $2
        GROUP BY svt_site`,
      [entId, isoDate],
    );
    const ga4BySite: Record<string, number> = {};
    for (const r of svtQ) ga4BySite[r.site] = Number(r.s);
    let siteVisitorSum = 0;
    let siteVisitorAny = false;
    for (const site of DSH_SITES) {
      const m = manualSiteRows.find((r) => r.site === site);
      const v = m?.marketingVisitor ?? ga4BySite[site] ?? null;
      if (v !== null && v !== undefined) {
        siteVisitorSum += Number(v);
        siteVisitorAny = true;
      }
    }
    const ga4Visitor = siteVisitorAny ? siteVisitorSum : null;

    // upsert daily_kpi row
    await this.ds.transaction(async (em) => {
      const r = await em
        .getRepository(DailyKpiTypeormEntity)
        .findOne({ where: { entId, date: isoDate } });
      const completeness: 'COMPLETE' | 'PARTIAL_PENDING_MANUAL' =
        manual && manual.status === 'COMPLETE'
          ? 'COMPLETE'
          : 'PARTIAL_PENDING_MANUAL';
      const now = new Date();
      const payload = {
        entId,
        date: isoDate,
        yearMonth,
        dayOfMonth,
        dayOfWeek: DOW_EN[dow],
        dayOfWeekKr: DOW_KR[dow],
        marketingVisitor: manual?.marketingVisitor ?? ga4Visitor,
        marketingCost: manualCostTotal,
        marketingEffect: manual?.marketingEffect ?? null,
        csCounseling: cs_counseling,
        csApply: cs_apply,
        csBeginning: cs_beginning,
        csMissing: cs_missing,
        csTrialClass: cs_trial_class,
        csComplain: manualComplainTotal + cmpCnt,
        opsNewSt: 0,
        opsOutSt: 0,
        opsCountSt: ops_count_st,
        opsNewTc: 0,
        opsOutTc: 0,
        opsCountTc: ops_count_tc,
        classMapTest: cls_map_test,
        classTtClass: cls_tt_class,
        classStudent: cls_student_active,
        classTeacher: cls_teacher_active,
        computedAt: now,
        computationStatus: 'FRESH' as const,
        dataCompleteness: completeness,
        lastRecomputeReason: reason,
        updatedAt: now,
      };
      if (r) {
        await em
          .getRepository(DailyKpiTypeormEntity)
          .update({ id: r.id }, payload);
      } else {
        await em.getRepository(DailyKpiTypeormEntity).insert({
          ...payload,
          createdAt: now,
        });
      }
    });

    // PLN-260914B — per-site breakdown rows (MARKETING + CS)
    await this.recomputeSiteRows(
      entId,
      isoDate,
      yearMonth,
      manual,
      manualSiteRows,
      cmpCnt,
    );

    this.logger.log(
      `recomputeDay ent=${entId} date=${isoDate} reason=${reason}`,
    );
  }

  /**
   * PLN-260914B — compute TPI / TRINITY / SANTACROCE / COMMON rows for one day.
   * Inquiry site = COALESCE(inq_site_override, inq_source_site, 'COMMON');
   * derived CS metrics follow their inquiry. Visitors come from site_visit
   * (manual site row wins); cost/complain from the matching manual row.
   */
  private async recomputeSiteRows(
    entId: string,
    isoDate: string,
    yearMonth: string,
    manualCommon: ManualInputTypeormEntity | null,
    manualSiteRows: ManualInputTypeormEntity[],
    complaintTotal: number,
  ): Promise<void> {
    type SiteCount = { site: string; c: string };
    const bySite = (rows: SiteCount[]): Record<string, number> =>
      Object.fromEntries(rows.map((r) => [r.site, Number(r.c)]));
    const q = (sql: string) =>
      this.ds.query<SiteCount[]>(sql, [entId, isoDate]).then(bySite);

    const [counseling, apply, beginning, missing, trial, complaints, visits] =
      await Promise.all([
        q(`SELECT ${INQ_SITE_SQL} AS site, COUNT(*)::text AS c
             FROM amb_acm_csl_inquiry i
            WHERE i.ent_id = $1 AND i.inq_registered_at = $2
              AND i.deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT ${INQ_SITE_SQL} AS site, COUNT(*)::text AS c
             FROM amb_acm_csl_enrollment e
             JOIN amb_acm_csl_inquiry i ON i.inq_id = e.inq_id
            WHERE e.ent_id = $1 AND e.enr_applied = true
              AND DATE(e.updated_at AT TIME ZONE 'Asia/Seoul') = $2
              AND i.deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT ${INQ_SITE_SQL} AS site, COUNT(*)::text AS c
             FROM amb_acm_csl_enrollment e
             JOIN amb_acm_csl_inquiry i ON i.inq_id = e.inq_id
            WHERE e.ent_id = $1 AND e.cls_started_at = $2
              AND i.deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT ${INQ_SITE_SQL} AS site, COUNT(*)::text AS c
             FROM amb_acm_csl_transition t
             JOIN amb_acm_csl_inquiry i ON i.inq_id = t.inq_id
            WHERE t.ent_id = $1 AND t.to_status = 'DROPPED'
              AND DATE(t.occurred_at AT TIME ZONE 'Asia/Seoul') = $2
              AND i.deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT ${INQ_SITE_SQL} AS site, COUNT(*)::text AS c
             FROM amb_acm_csl_trial_class tc
             JOIN amb_acm_csl_inquiry i ON i.inq_id = tc.inq_id
            WHERE tc.ent_id = $1 AND tc.tcl_held_at = $2
              AND i.deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT COALESCE(cmp_site, 'COMMON') AS site, COUNT(*)::text AS c
             FROM amb_acm_dsh_complaints
            WHERE ent_id = $1 AND cmp_date = $2 AND cmp_deleted_at IS NULL
            GROUP BY 1`),
        q(`SELECT svt_site AS site, COALESCE(SUM(svt_visitors),0)::text AS c
             FROM amb_acm_dsh_site_visit
            WHERE ent_id = $1 AND svt_date = $2
            GROUP BY 1`),
      ]);
    void complaintTotal; // tenant total already applied to daily_kpi; per-site uses `complaints`

    const now = new Date();
    const rows = DSH_SITE_ROWS.map((site) => {
      const isCommon = site === DSH_SITE_COMMON;
      const m = isCommon
        ? manualCommon
        : (manualSiteRows.find((r) => r.site === site) ?? null);
      const cs_counseling = counseling[site] ?? 0;
      const cs_apply = apply[site] ?? 0;
      const visitor = isCommon
        ? null
        : (m?.marketingVisitor ?? (site in visits ? visits[site] : null));
      return {
        entId,
        site,
        date: isoDate,
        yearMonth,
        marketingVisitor: visitor,
        marketingCost: m?.marketingCost ?? null,
        marketingEffect: cs_counseling + cs_apply,
        csCounseling: cs_counseling,
        csApply: cs_apply,
        csBeginning: beginning[site] ?? 0,
        csMissing: missing[site] ?? 0,
        csTrialClass: trial[site] ?? 0,
        csComplain: (complaints[site] ?? 0) + (m?.csComplain ?? 0),
        computedAt: now,
        createdAt: now,
        updatedAt: now,
      };
    });

    await this.ds.transaction(async (em) => {
      const repo = em.getRepository(DailyKpiSiteTypeormEntity);
      await repo.delete({ entId, date: isoDate });
      await repo.insert(rows);
    });
  }

  /** PLN-260914B — per-site rows presented in the daily_kpi row shape (OPERATING/CLASS = 0). */
  private async loadSiteRowsAsKpi(
    entId: string,
    from: string,
    to: string,
    site: DshSite,
  ): Promise<DailyKpiTypeormEntity[]> {
    const repo = this.ds.getRepository(DailyKpiSiteTypeormEntity);
    const siteRows = await repo.find({
      where: { entId, site, date: Between(from, to) },
      order: { date: 'ASC' },
    });
    return siteRows.map((r) => {
      const iso =
        typeof r.date === 'string'
          ? r.date
          : new Date(r.date).toISOString().slice(0, 10);
      const d = new Date(`${iso}T00:00:00Z`);
      const dow = d.getUTCDay();
      const kpi = new DailyKpiTypeormEntity();
      Object.assign(kpi, {
        id: r.id,
        entId,
        date: iso,
        yearMonth: r.yearMonth,
        dayOfMonth: d.getUTCDate(),
        dayOfWeek: DOW_EN[dow],
        dayOfWeekKr: DOW_KR[dow],
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
        computedAt: r.computedAt,
        computationStatus: 'FRESH',
        dataCompleteness: 'COMPLETE',
        manuallyOverridden: false,
        lastRecomputeReason: 'site_view',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      });
      return kpi;
    });
  }

  /**
   * PLN-260914B — consolidated comparison: per-site sums over [from,to] plus the
   * tenant TOTAL taken from daily_kpi (the source of truth for the 통합 tab).
   */
  async getSiteComparison(
    entId: string,
    from: string,
    to: string,
  ): Promise<{ from: string; to: string; rows: SiteComparisonRow[] }> {
    type AggRow = {
      site: string;
      visitor: string | null;
      counseling: string | null;
      apply: string | null;
      cost: string | null;
      complain: string | null;
    };
    const agg = await this.ds.query<AggRow[]>(
      `SELECT dks_site AS site,
              SUM(dks_marketing_visitor)::text AS visitor,
              SUM(dks_cs_counseling)::text AS counseling,
              SUM(dks_cs_apply)::text AS apply,
              SUM(dks_marketing_cost)::text AS cost,
              SUM(dks_cs_complain)::text AS complain
         FROM amb_acm_dsh_daily_kpi_site
        WHERE ent_id = $1 AND dks_date BETWEEN $2 AND $3
        GROUP BY dks_site`,
      [entId, from, to < kpiToday() ? to : kpiToday()],
    );
    const byCode = new Map(agg.map((r) => [r.site, r]));
    const rows: SiteComparisonRow[] = DSH_SITE_ROWS.map((site) => {
      const r = byCode.get(site);
      const counseling = r?.counseling == null ? null : Number(r.counseling);
      const apply = r?.apply == null ? null : Number(r.apply);
      return {
        site,
        visitor:
          r?.visitor === null || r?.visitor === undefined
            ? null
            : Number(r.visitor),
        counseling,
        apply,
        effect:
          counseling === null || apply === null ? null : counseling + apply,
        cost: r?.cost == null ? null : Number(r.cost),
        complain: r?.complain == null ? null : Number(r.complain),
      };
    });
    const total = await this.ds.query<
      {
        visitor: string | null;
        counseling: string | null;
        apply: string | null;
        cost: string | null;
        complain: string | null;
      }[]
    >(
      `SELECT SUM(dkp_marketing_visitor)::text AS visitor,
              SUM(dkp_cs_counseling)::text AS counseling,
              SUM(dkp_cs_apply)::text AS apply,
              SUM(dkp_marketing_cost)::text AS cost,
              SUM(dkp_cs_complain)::text AS complain
         FROM amb_acm_dsh_daily_kpi
        WHERE ent_id = $1 AND dkp_date BETWEEN $2 AND $3
          AND dkp_computation_status = 'FRESH'
          AND dkp_data_completeness <> 'PARTIAL_FUTURE'`,
      [entId, from, to < kpiToday() ? to : kpiToday()],
    );
    const t = total[0];
    const tc = t?.counseling == null ? null : Number(t.counseling);
    const ta = t?.apply == null ? null : Number(t.apply);
    rows.push({
      site: 'TOTAL',
      visitor:
        t?.visitor === null || t?.visitor === undefined
          ? null
          : Number(t.visitor),
      counseling: tc,
      apply: ta,
      effect: tc === null || ta === null ? null : tc + ta,
      cost: t?.cost == null ? null : Number(t.cost),
      complain: t?.complain == null ? null : Number(t.complain),
    });
    return { from, to, rows };
  }

  /**
   * Mark a day's row STALE so the next batch will recompute it.
   */
  async markStale(
    entId: string,
    isoDate: string,
    reason: string,
  ): Promise<void> {
    await this.ds
      .getRepository(DailyKpiTypeormEntity)
      .update(
        { entId, date: isoDate },
        { computationStatus: 'STALE', lastRecomputeReason: reason },
      );
  }

  /**
   * Daily batch — recompute the last 31 days (rolling) for every entity present in inquiries.
   * Called by Cron.
   */
  async runDailyBatch(): Promise<{ entityCount: number; dayCount: number }> {
    const ents = await this.ds.query<{ ent_id: string }[]>(
      `SELECT DISTINCT ent_id FROM amb_acm_csl_inquiry`,
    );
    const today = new Date();
    const days: string[] = [];
    for (let i = 0; i < 31; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    let count = 0;
    for (const { ent_id } of ents) {
      for (const day of days) {
        await this.recomputeDay(ent_id, day, 'daily_batch');
        count += 1;
      }
    }
    return { entityCount: ents.length, dayCount: count };
  }
}
