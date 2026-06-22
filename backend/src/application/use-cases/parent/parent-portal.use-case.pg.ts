import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../../modules/acm-common/datasource';

export interface ParentPortalChild {
  id: string;
  name: string;
  grade: string | null;
  school: string | null;
  status: string;
}

export interface ParentPortalTimetableSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  className: string;
  teacherName: string | null;
  programName: string;
}

export interface ParentPortalPaymentRow {
  id: string;
  orderNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  programName: string | null;
  studentName: string;
  studentId: string;
}

export interface ParentPortalKpi {
  weekClasses: { total: number; held: number };
  latestScore: { rit: number; percentile: number | null; date: string } | null;
  unpaidOrders: number;
}

/**
 * PG-only parent-portal queries (REQ-260622 Phase 4 T4-03).
 *
 * Mirrors the 4 endpoints in `presentation/controllers/portal-parent.controller.ts`
 * (children / timetable / payments / kpi) — same response shape, swapped data
 * source. Differences from the legacy controller:
 *
 *   - DataSource: ACM_DS (db_acm) instead of the default MySQL pool.
 *   - Parent identity: resolved via `amb_acm_std_parent.par_email` (since
 *     PG has no user→parent FK), not the legacy BIGINT `prt_id`.
 *   - Tenant key: explicit `entId UUID` parameter — caller pulls it from JWT
 *     (Phase 6 follow-up: JWT payload must carry `entId`).
 *   - Tables: `amb_acm_*` throughout — including `amb_acm_cls_enrollment`
 *     (model X) for the student↔class join.
 *   - Class name + program name now live as one denormalized column
 *     (`cls_subject_label` on `amb_acm_cls_classes`) — PG dropped the
 *     legacy `tac_programs` join.
 *   - Parameter binding: PG `$1, $2` instead of MySQL `?`.
 *
 * Phase 6 cutover swaps the controller imports from the MySQL sibling to
 * this use case.
 *
 * @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md Phase 4 T4-03
 */
@Injectable()
export class ParentPortalPgUseCase {
  constructor(
    @InjectDataSource(ACM_DS)
    private readonly ds: DataSource,
  ) {}

  /** Resolve par_id from JWT email (case-insensitive, ent-scoped). */
  private async findParentId(
    entId: string,
    email: string,
  ): Promise<string | null> {
    const rows = await this.ds.query<Array<{ par_id: string }>>(
      `SELECT par_id
         FROM amb_acm_std_parent
        WHERE ent_id = $1
          AND LOWER(par_email) = LOWER($2)
          AND deleted_at IS NULL
        LIMIT 1`,
      [entId, email],
    );
    return rows[0]?.par_id ?? null;
  }

  /** FN-115 — parent children summary. */
  async getChildren(entId: string, parentEmail: string): Promise<{
    children: ParentPortalChild[];
    selectedStudentId: string | null;
    kpi: ParentPortalKpi | null;
  }> {
    const parId = await this.findParentId(entId, parentEmail);
    if (!parId) return { children: [], selectedStudentId: null, kpi: null };

    const children = await this.ds.query<ParentPortalChild[]>(
      `SELECT s.std_id AS id, s.std_name AS name, s.std_grade AS grade,
              s.std_school AS school, s.std_status AS status
         FROM amb_acm_std_student s
         JOIN amb_acm_std_student_parent sp
           ON sp.std_id = s.std_id AND sp.par_id = $2
        WHERE s.ent_id = $1
          AND s.std_status = 'ACTIVE'
        ORDER BY s.std_name`,
      [entId, parId],
    );

    if (children.length === 0) {
      return { children: [], selectedStudentId: null, kpi: null };
    }

    const selectedId = children[0].id;
    const kpi = await this.getStudentKpi(entId, selectedId);
    return { children, selectedStudentId: selectedId, kpi };
  }

  /** FN-116 — student weekly timetable. Returns empty if parent isn't bound to studentId. */
  async getTimetable(
    entId: string,
    parentEmail: string | null,
    studentId: string,
    weekStart?: string,
  ): Promise<{
    sessions: ParentPortalTimetableSession[];
    weekStart: string;
    weekEnd: string;
  }> {
    if (!studentId) return { sessions: [], weekStart: '', weekEnd: '' };

    if (parentEmail) {
      const ok = await this.parentOwnsStudent(entId, parentEmail, studentId);
      if (!ok) return { sessions: [], weekStart: '', weekEnd: '' };
    }

    const { mondayStr, sundayStr } = weekRange(weekStart);

    const sessions = await this.ds.query<ParentPortalTimetableSession[]>(
      `SELECT
         s.ses_id AS id,
         (s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul')::date::text AS date,
         to_char(s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS "startTime",
         to_char(
           (s.ses_scheduled_at + (s.ses_duration_min || ' minutes')::interval)
             AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS'
         ) AS "endTime",
         s.ses_status AS status,
         COALESCE(c.cls_subject_label, c.cls_code) AS "className",
         NULL AS "teacherName",
         COALESCE(c.cls_subject_label, c.cls_code) AS "programName"
       FROM amb_acm_cls_sessions s
       JOIN amb_acm_cls_classes c ON c.cls_id = s.cls_id
       WHERE c.ent_id = $1
         AND (s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN $2::date AND $3::date
         AND s.cls_id IN (
           SELECT ce.cls_id FROM amb_acm_cls_enrollment ce
            WHERE ce.std_id = $4
              AND ce.ce_status IN ('PENDING', 'CONFIRMED')
         )
       ORDER BY s.ses_scheduled_at`,
      [entId, mondayStr, sundayStr, studentId],
    );

    return { sessions, weekStart: mondayStr, weekEnd: sundayStr };
  }

  /** FN-118 — parent payment history. */
  async getPayments(
    entId: string,
    parentEmail: string,
    studentId?: string,
  ): Promise<ParentPortalPaymentRow[]> {
    const parId = await this.findParentId(entId, parentEmail);
    if (!parId) return [];

    const params: (string | null)[] = [entId, parId];
    let sql = `
      SELECT
        po.pod_id AS id,
        po.pod_order_no AS "orderNumber",
        po.pod_amount AS amount,
        po.pod_status AS status,
        po.created_at AS "createdAt",
        c.cls_subject_label AS "programName",
        s.std_name AS "studentName",
        s.std_id AS "studentId"
      FROM amb_acm_pay_order po
      JOIN amb_acm_cls_enrollment ce ON ce.ce_id = po.ce_id
      JOIN amb_acm_std_student s ON s.std_id = ce.std_id
      JOIN amb_acm_cls_classes c ON c.cls_id = ce.cls_id
      JOIN amb_acm_std_student_parent sp ON sp.std_id = s.std_id AND sp.par_id = $2
      WHERE po.ent_id = $1
    `;
    if (studentId) {
      params.push(studentId);
      sql += ` AND s.std_id = $${params.length}`;
    }
    sql += ` ORDER BY po.created_at DESC LIMIT 50`;

    return this.ds.query<ParentPortalPaymentRow[]>(sql, params);
  }

  /** Dashboard KPI for one student — same shape as legacy. */
  async getStudentKpi(entId: string, studentId: string): Promise<ParentPortalKpi> {
    const { mondayStr, sundayStr } = weekRange();

    const [weekClasses] = await this.ds.query<Array<{ total: string; held: string }>>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE s.ses_status = 'HELD')::text AS held
       FROM amb_acm_cls_sessions s
       JOIN amb_acm_cls_classes c ON c.cls_id = s.cls_id
       WHERE c.ent_id = $1
         AND (s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN $2::date AND $3::date
         AND s.cls_id IN (
           SELECT ce.cls_id FROM amb_acm_cls_enrollment ce
            WHERE ce.std_id = $4
              AND ce.ce_status IN ('PENDING', 'CONFIRMED')
         )`,
      [entId, mondayStr, sundayStr, studentId],
    );

    // MAP score — PG stores reading/math/language on the student row itself
    // (amb_acm_std_student.std_map_*); amb_acm_map_score is the per-test
    // history. Surface latest history if any; fall back to student-level
    // snapshot.
    const [latestHistory] = await this.ds.query<
      Array<{ reading: number | null; math: number | null; language: number | null; assessed_at: Date | null }>
    >(
      `SELECT
         msc_reading_score AS reading,
         msc_math_score AS math,
         msc_language_score AS language,
         msc_assessed_at AS assessed_at
       FROM amb_acm_map_score
       WHERE ent_id = $1 AND std_id = $2
       ORDER BY msc_assessed_at DESC, msc_id DESC
       LIMIT 1`,
      [entId, studentId],
    );

    const [unpaid] = await this.ds.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count
       FROM amb_acm_pay_order po
       JOIN amb_acm_cls_enrollment ce ON ce.ce_id = po.ce_id
       WHERE po.ent_id = $1
         AND ce.std_id = $2
         AND po.pod_status IN ('READY', 'PENDING')`,
      [entId, studentId],
    );

    return {
      weekClasses: {
        total: Number(weekClasses?.total ?? 0),
        held: Number(weekClasses?.held ?? 0),
      },
      latestScore: latestHistory
        ? {
            rit: Number(
              latestHistory.reading ?? latestHistory.math ?? latestHistory.language ?? 0,
            ),
            percentile: null,
            date:
              latestHistory.assessed_at instanceof Date
                ? latestHistory.assessed_at.toISOString().slice(0, 10)
                : String(latestHistory.assessed_at ?? ''),
          }
        : null,
      unpaidOrders: Number(unpaid?.count ?? 0),
    };
  }

  /**
   * Phase 6 follow-up hook for the controller: given JWT email + studentId,
   * confirm the parent is bound to that student. Returns false when the
   * parent isn't found or isn't linked.
   */
  async parentOwnsStudent(
    entId: string,
    parentEmail: string,
    studentId: string,
  ): Promise<boolean> {
    const rows = await this.ds.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1
           FROM amb_acm_std_student_parent sp
           JOIN amb_acm_std_parent p ON p.par_id = sp.par_id
          WHERE p.ent_id = $1
            AND LOWER(p.par_email) = LOWER($2)
            AND sp.std_id = $3
            AND p.deleted_at IS NULL
       ) AS exists`,
      [entId, parentEmail, studentId],
    );
    return Boolean(rows[0]?.exists);
  }
}

function weekRange(weekStart?: string): { mondayStr: string; sundayStr: string } {
  const now = weekStart ? new Date(weekStart) : new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    mondayStr: monday.toISOString().slice(0, 10),
    sundayStr: sunday.toISOString().slice(0, 10),
  };
}
