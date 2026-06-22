import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../../modules/acm-common/datasource';

export interface DashboardKpi {
  students: { total: number; delta: number };
  revenue: { monthTotal: number; delta: number };
  consultations: { newCount: number; conversionRate: number };
  todayClasses: number;
}

/**
 * PG-only KPI rewrite (REQ-260622 Phase 4 T4-01).
 *
 * Differences from the legacy MySQL `get-dashboard-kpi.use-case.ts`:
 *   - DataSource: ACM_DS (db_acm) instead of the default MySQL pool.
 *   - Tenant key: `ent_id UUID` instead of `acd_id BIGINT`.
 *   - Parameter binding: PG `$1, $2` instead of MySQL `?`.
 *   - Tables: `amb_acm_*` instead of `tac_*` — including the model-decision-X
 *     split for class enrollment (amb_acm_cls_enrollment, not csl_enrollment).
 *
 * Response shape is preserved 1:1 so the frontend doesn't need to know
 * about the cutover. Phase 6 cutover swaps the controller's import path
 * from this file's sibling .ts (MySQL) to this `.pg.ts`.
 *
 * @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md Phase 4 T4-01
 */
@Injectable()
export class GetDashboardKpiPgUseCase {
  constructor(
    @InjectDataSource(ACM_DS)
    private readonly ds: DataSource,
  ) {}

  async execute(entId: string): Promise<DashboardKpi> {
    const now = new Date();
    const monthStart = startOfMonthIso(now, 0);
    const prevMonthStart = startOfMonthIso(now, -1);
    const prevMonthEnd = startOfMonthIso(now, 0); // exclusive upper bound
    const today = now.toISOString().slice(0, 10);

    // Active students — std_lifecycle_status mirrors the legacy std_status
    // semantics (ACTIVE / ENROLLED / CONSULTING / TERMINATED — see
    // amb_acm_std_student).
    const [{ cnt: studentCount }] = await this.ds.query<[{ cnt: string }]>(
      `SELECT COUNT(DISTINCT std_id)::text AS cnt
         FROM amb_acm_std_student
        WHERE ent_id = $1
          AND std_lifecycle_status IN ('ACTIVE', 'ENROLLED')`,
      [entId],
    );

    // Previous-month enrolled count via amb_acm_cls_enrollment (model X —
    // student × class join, mirrored from tac_enrollments).
    const [{ cnt: prevStudentCount }] = await this.ds.query<[{ cnt: string }]>(
      `SELECT COUNT(DISTINCT std_id)::text AS cnt
         FROM amb_acm_cls_enrollment
        WHERE ent_id = $1
          AND ce_status IN ('PENDING', 'CONFIRMED')
          AND ce_applied_at < $2::date`,
      [entId, monthStart],
    );

    // Revenue this month — closed (DONE) orders.
    const [{ total: monthRevenue }] = await this.ds.query<[{ total: string }]>(
      `SELECT COALESCE(SUM(pod_amount), 0)::text AS total
         FROM amb_acm_pay_order
        WHERE ent_id = $1
          AND pod_status = 'DONE'
          AND pod_approved_at >= $2::date`,
      [entId, monthStart],
    );

    // Revenue previous month — inclusive lower, exclusive upper.
    const [{ total: prevRevenue }] = await this.ds.query<[{ total: string }]>(
      `SELECT COALESCE(SUM(pod_amount), 0)::text AS total
         FROM amb_acm_pay_order
        WHERE ent_id = $1
          AND pod_status = 'DONE'
          AND pod_approved_at >= $2::date
          AND pod_approved_at <  $3::date`,
      [entId, prevMonthStart, prevMonthEnd],
    );

    // New consultations this month — inq_registered_at is what matches the
    // legacy cst_created_at semantically (intake date, not last-touched).
    const [{ cnt: newConsultations }] = await this.ds.query<[{ cnt: string }]>(
      `SELECT COUNT(*)::text AS cnt
         FROM amb_acm_csl_inquiry
        WHERE ent_id = $1
          AND inq_registered_at >= $2::date
          AND deleted_at IS NULL`,
      [entId, monthStart],
    );

    // Converted this month — Q-5 enum map: legacy 'CONVERTED' →
    // current_stage IN ('CLASS_STARTED') per acm-csl pipeline.
    const [{ cnt: converted }] = await this.ds.query<[{ cnt: string }]>(
      `SELECT COUNT(*)::text AS cnt
         FROM amb_acm_csl_inquiry
        WHERE ent_id = $1
          AND inq_current_stage = 'CLASS_STARTED'
          AND inq_registered_at >= $2::date
          AND deleted_at IS NULL`,
      [entId, monthStart],
    );

    // Today's class sessions — amb_acm_cls_sessions carries the schedule;
    // FK already constrains to the tenant via amb_acm_cls_classes.ent_id.
    const [{ cnt: todayClasses }] = await this.ds.query<[{ cnt: string }]>(
      `SELECT COUNT(*)::text AS cnt
         FROM amb_acm_cls_sessions s
         JOIN amb_acm_cls_classes c ON c.cls_id = s.cls_id
        WHERE c.ent_id = $1
          AND s.ses_date = $2::date`,
      [entId, today],
    );

    const totalStudents = Number(studentCount) || 0;
    const prevStudents = Number(prevStudentCount) || 0;
    const totalRevenue = Number(monthRevenue) || 0;
    const prevRev = Number(prevRevenue) || 0;
    const newCons = Number(newConsultations) || 0;
    const conv = Number(converted) || 0;

    return {
      students: {
        total: totalStudents,
        delta: totalStudents - prevStudents,
      },
      revenue: {
        monthTotal: totalRevenue,
        delta: totalRevenue - prevRev,
      },
      consultations: {
        newCount: newCons,
        conversionRate: newCons > 0 ? Math.round((conv / newCons) * 1000) / 10 : 0,
      },
      todayClasses: Number(todayClasses) || 0,
    };
  }
}

/** First day of the month at offset N. Returns YYYY-MM-DD. */
function startOfMonthIso(base: Date, monthOffset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  return d.toISOString().slice(0, 10);
}
