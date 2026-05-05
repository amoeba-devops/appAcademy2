import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { DailyKpiTypeormEntity, type DkpDayOfWeek } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';
import { ManualInputTypeormEntity } from '../infrastructure/typeorm/manual-input.typeorm-entity';
import { ComplaintTypeormEntity } from '../infrastructure/typeorm/complaint.typeorm-entity';
import { Between } from 'typeorm';
import type { UpsertDailyKpiManualDto } from './dto/daily-kpi-manual.dto';

const DOW_EN: DkpDayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DOW_KR = ['일', '월', '화', '수', '목', '금', '토'];

export interface MonthGridResult {
  yearMonth: string;
  rows: DailyKpiTypeormEntity[];
  sums: Record<string, number>;
  averages: Record<string, number | null>;
  populatedDayCount: number;
}

export interface RangeGridResult {
  from: string;
  to: string;
  rows: DailyKpiTypeormEntity[];
  sums: Record<string, number>;
  averages: Record<string, number | null>;
  populatedDayCount: number;
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

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
  ) {}

  async getMonthGrid(entId: string, yearMonth: string): Promise<MonthGridResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const rows = await repo.find({
      where: { entId, yearMonth },
      order: { date: 'ASC' },
    });
    applyEffectOverride(rows);

    const sums: Record<string, number> = {
      mkt_visitor: 0, mkt_cost: 0, mkt_effect: 0,
      cs_counseling: 0, cs_apply: 0, cs_beginning: 0, cs_missing: 0, cs_trial_class: 0, cs_complain: 0,
      ops_new_st: 0, ops_out_st: 0, ops_count_st: 0,
      ops_new_tc: 0, ops_out_tc: 0, ops_count_tc: 0,
      cls_map_test: 0, cls_tt_class: 0, cls_student: 0, cls_teacher: 0,
    };

    let populatedDayCount = 0;
    for (const r of rows) {
      const populated =
        (r.marketingVisitor ?? 0) > 0 ||
        r.csCounseling > 0 ||
        r.csApply > 0 ||
        r.csBeginning > 0 ||
        r.csTrialClass > 0 ||
        r.classMapTest > 0;
      if (populated) populatedDayCount += 1;

      sums.mkt_visitor += r.marketingVisitor ?? 0;
      sums.mkt_cost += Number(r.marketingCost ?? 0);
      sums.mkt_effect += r.marketingEffect ?? 0;
      sums.cs_counseling += r.csCounseling;
      sums.cs_apply += r.csApply;
      sums.cs_beginning += r.csBeginning;
      sums.cs_missing += r.csMissing;
      sums.cs_trial_class += r.csTrialClass;
      sums.cs_complain += r.csComplain;
      sums.ops_new_st += r.opsNewSt;
      sums.ops_out_st += r.opsOutSt;
      sums.ops_new_tc += r.opsNewTc;
      sums.ops_out_tc += r.opsOutTc;
      sums.cls_map_test += r.classMapTest;
      sums.cls_tt_class += Number(r.classTtClass ?? 0);
      sums.cls_student += r.classStudent;
      sums.cls_teacher += r.classTeacher;
    }

    // STATUS_SNAPSHOT — last day's value
    const last = rows[rows.length - 1];
    sums.ops_count_st = last?.opsCountSt ?? 0;
    sums.ops_count_tc = last?.opsCountTc ?? 0;

    // Aver. — UI-DSH-006: only volume/distinct/net_delta types average; status types null.
    const dayCount = rows.length || 1;
    const averagesNumeric: Record<string, number | null> = {
      mkt_visitor: sums.mkt_visitor / dayCount,
      mkt_cost: sums.mkt_cost / dayCount,
      mkt_effect: sums.mkt_effect / dayCount,
      cs_counseling: sums.cs_counseling / dayCount,
      cs_apply: sums.cs_apply / dayCount,
      cs_beginning: sums.cs_beginning / dayCount,
      cs_missing: sums.cs_missing / dayCount,
      cs_trial_class: sums.cs_trial_class / dayCount,
      cs_complain: sums.cs_complain / dayCount,
      ops_new_st: sums.ops_new_st / dayCount,
      ops_out_st: sums.ops_out_st / dayCount,
      ops_count_st: null,
      ops_new_tc: sums.ops_new_tc / dayCount,
      ops_out_tc: sums.ops_out_tc / dayCount,
      ops_count_tc: null,
      cls_map_test: sums.cls_map_test / dayCount,
      cls_tt_class: sums.cls_tt_class / dayCount,
      cls_student: sums.cls_student / dayCount,
      cls_teacher: sums.cls_teacher / dayCount,
    };

    return { yearMonth, rows, sums, averages: averagesNumeric, populatedDayCount };
  }

  /**
   * Range grid — same shape as monthly grid but for any [from, to] window.
   * Caller validates from <= to and (to - from) <= 365 days.
   */
  async getRange(entId: string, from: string, to: string): Promise<RangeGridResult> {
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const rows = await repo.find({
      where: { entId, date: Between(from, to) },
      order: { date: 'ASC' },
    });
    applyEffectOverride(rows);

    const sums: Record<string, number> = {
      mkt_visitor: 0, mkt_cost: 0, mkt_effect: 0,
      cs_counseling: 0, cs_apply: 0, cs_beginning: 0, cs_missing: 0, cs_trial_class: 0, cs_complain: 0,
      ops_new_st: 0, ops_out_st: 0, ops_count_st: 0,
      ops_new_tc: 0, ops_out_tc: 0, ops_count_tc: 0,
      cls_map_test: 0, cls_tt_class: 0, cls_student: 0, cls_teacher: 0,
    };

    let populatedDayCount = 0;
    for (const r of rows) {
      const populated =
        (r.marketingVisitor ?? 0) > 0 ||
        r.csCounseling > 0 || r.csApply > 0 || r.csBeginning > 0 ||
        r.csTrialClass > 0 || r.classMapTest > 0;
      if (populated) populatedDayCount += 1;
      sums.mkt_visitor += r.marketingVisitor ?? 0;
      sums.mkt_cost += Number(r.marketingCost ?? 0);
      sums.mkt_effect += r.marketingEffect ?? 0;
      sums.cs_counseling += r.csCounseling;
      sums.cs_apply += r.csApply;
      sums.cs_beginning += r.csBeginning;
      sums.cs_missing += r.csMissing;
      sums.cs_trial_class += r.csTrialClass;
      sums.cs_complain += r.csComplain;
      sums.ops_new_st += r.opsNewSt;
      sums.ops_out_st += r.opsOutSt;
      sums.ops_new_tc += r.opsNewTc;
      sums.ops_out_tc += r.opsOutTc;
      sums.cls_map_test += r.classMapTest;
      sums.cls_tt_class += Number(r.classTtClass ?? 0);
      sums.cls_student += r.classStudent;
      sums.cls_teacher += r.classTeacher;
    }
    const last = rows[rows.length - 1];
    sums.ops_count_st = last?.opsCountSt ?? 0;
    sums.ops_count_tc = last?.opsCountTc ?? 0;

    const dayCount = rows.length || 1;
    const averages: Record<string, number | null> = {
      mkt_visitor: sums.mkt_visitor / dayCount,
      mkt_cost: sums.mkt_cost / dayCount,
      mkt_effect: sums.mkt_effect / dayCount,
      cs_counseling: sums.cs_counseling / dayCount,
      cs_apply: sums.cs_apply / dayCount,
      cs_beginning: sums.cs_beginning / dayCount,
      cs_missing: sums.cs_missing / dayCount,
      cs_trial_class: sums.cs_trial_class / dayCount,
      cs_complain: sums.cs_complain / dayCount,
      ops_new_st: sums.ops_new_st / dayCount,
      ops_out_st: sums.ops_out_st / dayCount,
      ops_count_st: null,
      ops_new_tc: sums.ops_new_tc / dayCount,
      ops_out_tc: sums.ops_out_tc / dayCount,
      ops_count_tc: null,
      cls_map_test: sums.cls_map_test / dayCount,
      cls_tt_class: sums.cls_tt_class / dayCount,
      cls_student: sums.cls_student / dayCount,
      cls_teacher: sums.cls_teacher / dayCount,
    };

    return { from, to, rows, sums, averages, populatedDayCount };
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
    const repo = this.ds.getRepository(DailyKpiTypeormEntity);
    const d = new Date(`${isoDate}T00:00:00Z`);
    const yearMonth = isoDate.slice(0, 7);
    const dayOfMonth = d.getUTCDate();
    const dow = d.getUTCDay();
    const now = new Date();

    const existing = await repo.findOne({ where: { entId, date: isoDate } });
    const base: Partial<DailyKpiTypeormEntity> = existing ?? {
      entId, date: isoDate, yearMonth, dayOfMonth,
      dayOfWeek: DOW_EN[dow], dayOfWeekKr: DOW_KR[dow],
      csCounseling: 0, csApply: 0, csBeginning: 0, csMissing: 0,
      csTrialClass: 0, csComplain: 0,
      opsNewSt: 0, opsOutSt: 0, opsCountSt: 0,
      opsNewTc: 0, opsOutTc: 0, opsCountTc: 0,
      classMapTest: 0, classTtClass: '0', classStudent: 0, classTeacher: 0,
      computationStatus: 'FRESH',
      dataCompleteness: 'COMPLETE',
      createdAt: now,
    };

    const apply = <K extends keyof DailyKpiTypeormEntity>(k: K, v: unknown) => {
      if (v !== undefined && v !== null) (base as any)[k] = v;
    };
    apply('marketingVisitor', dto.marketingVisitor ?? null);
    if (dto.marketingCost !== undefined) (base as any).marketingCost = String(dto.marketingCost);
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
    if (dto.classTtClass !== undefined) (base as any).classTtClass = dto.classTtClass.toFixed(1);
    apply('classStudent', dto.classStudent);
    apply('classTeacher', dto.classTeacher);
    // derived effect
    (base as any).marketingEffect = ((base as any).csCounseling ?? 0) + ((base as any).csApply ?? 0);
    (base as any).manuallyOverridden = true;
    (base as any).computationStatus = 'FRESH';
    (base as any).dataCompleteness = 'COMPLETE';
    (base as any).computedAt = now;
    (base as any).updatedAt = now;
    (base as any).lastRecomputeReason = 'manual_full_override';

    if (existing) {
      await repo.update({ id: existing.id }, base as object);
      return (await repo.findOne({ where: { id: existing.id } }))!;
    }
    const inserted = await repo.save(base as DailyKpiTypeormEntity);
    return inserted;
  }

  /**
   * Recompute a single day's daily_kpi row for the given entity.
   * Idempotent: deletes/inserts (ent_id, date) row.
   * In v1.0a: CSL-sourced metrics + manual inputs only. CLS metrics remain 0.
   */
  async recomputeDay(entId: string, isoDate: string, reason = 'manual_recompute'): Promise<void> {
    const dkpRepo = this.ds.getRepository(DailyKpiTypeormEntity);
    const minRepo = this.ds.getRepository(ManualInputTypeormEntity);
    const cmpRepo = this.ds.getRepository(ComplaintTypeormEntity);

    // Skip if this row was full-overridden via manual upsert
    const existing = await dkpRepo.findOne({ where: { entId, date: isoDate } });
    if (existing?.manuallyOverridden) {
      this.logger.log(`recomputeDay SKIP (manually_overridden) ent=${entId} date=${isoDate}`);
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
        WHERE ent_id = $1 AND inq_registered_at = $2`,
      [entId, isoDate],
    );
    const cs_counseling = Number(counselingQ[0]?.c ?? 0);

    // apply: enrollment rows where enr_applied=true and updated on this day
    const applyQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_enrollment
        WHERE ent_id = $1 AND enr_applied = true
          AND DATE(updated_at AT TIME ZONE 'Asia/Seoul') = $2`,
      [entId, isoDate],
    );
    const cs_apply = Number(applyQ[0]?.c ?? 0);

    // beginning: cls_started_at = day
    const begQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_enrollment
        WHERE ent_id = $1 AND cls_started_at = $2`,
      [entId, isoDate],
    );
    const cs_beginning = Number(begQ[0]?.c ?? 0);

    // missing: transition to DROPPED on day
    const missQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_transition
        WHERE ent_id = $1 AND to_status = 'DROPPED'
          AND DATE(created_at AT TIME ZONE 'Asia/Seoul') = $2`,
      [entId, isoDate],
    );
    const cs_missing = Number(missQ[0]?.c ?? 0);

    // trial class: tcl_held_at = day
    const tclQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_trial_class
        WHERE ent_id = $1 AND tcl_held_at = $2`,
      [entId, isoDate],
    );
    const cs_trial_class = Number(tclQ[0]?.c ?? 0);

    // map test scheduled
    const mapQ = await this.ds.query<CountRow[]>(
      `SELECT COUNT(*)::text AS c FROM amb_acm_csl_map_test
        WHERE ent_id = $1 AND mpt_scheduled_at = $2`,
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

    // manual input
    const manual = await minRepo.findOne({ where: { entId, date: isoDate } });

    // upsert daily_kpi row
    await this.ds.transaction(async (em) => {
      const r = await em.getRepository(DailyKpiTypeormEntity).findOne({ where: { entId, date: isoDate } });
      const completeness = manual && manual.status === 'COMPLETE'
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
        marketingVisitor: manual?.marketingVisitor ?? null,
        marketingCost: manual?.marketingCost ?? null,
        marketingEffect: manual?.marketingEffect ?? null,
        csCounseling: cs_counseling,
        csApply: cs_apply,
        csBeginning: cs_beginning,
        csMissing: cs_missing,
        csTrialClass: cs_trial_class,
        csComplain: (manual?.csComplain ?? 0) + cmpCnt,
        opsNewSt: 0, opsOutSt: 0, opsCountSt: ops_count_st,
        opsNewTc: 0, opsOutTc: 0, opsCountTc: ops_count_tc,
        classMapTest: cls_map_test,
        classTtClass: cls_tt_class,
        classStudent: cls_student_active, classTeacher: cls_teacher_active,
        computedAt: now,
        computationStatus: 'FRESH' as const,
        dataCompleteness: completeness as 'COMPLETE' | 'PARTIAL_PENDING_MANUAL',
        lastRecomputeReason: reason,
        updatedAt: now,
      };
      if (r) {
        await em.getRepository(DailyKpiTypeormEntity).update({ id: r.id }, payload);
      } else {
        await em.getRepository(DailyKpiTypeormEntity).insert({
          ...payload,
          createdAt: now,
        });
      }
    });

    this.logger.log(`recomputeDay ent=${entId} date=${isoDate} reason=${reason}`);
  }

  /**
   * Mark a day's row STALE so the next batch will recompute it.
   */
  async markStale(entId: string, isoDate: string, reason: string): Promise<void> {
    await this.ds
      .getRepository(DailyKpiTypeormEntity)
      .update({ entId, date: isoDate }, { computationStatus: 'STALE', lastRecomputeReason: reason });
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
