import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

interface StudentKpi {
  weekClasses: { total: number; held: number };
  latestScore: { rit: number; percentile: number | null; date: string } | null;
  unpaidOrders: number;
}

@ApiTags('Portal My')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portal/my')
export class PortalParentController {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get('children')
  @ApiOperation({ summary: 'Get parent children summary (자녀 요약 — FN-115)' })
  async getChildren(@CurrentUser() user: CurrentUserPayload) {
    const parentId = user.role === 'PARENT' ? Number(user.userId) : null;

    if (!parentId) {
      return { children: [], selectedStudentId: null, kpi: null };
    }

    const children = await this.ds.query(
      `SELECT s.std_id AS id, s.std_name AS name, s.std_grade AS grade,
              s.std_school AS school, s.std_status AS status
       FROM tac_students s
       WHERE s.prt_id = ? AND s.std_status = 'ACTIVE'
       ORDER BY s.std_name`,
      [parentId],
    );

    if (children.length === 0) {
      return { children: [], selectedStudentId: null, kpi: null };
    }

    const selectedId = Number(children[0].id);
    const kpi = await this.getStudentKpi(selectedId);

    return { children, selectedStudentId: selectedId, kpi };
  }

  @Get('timetable')
  @ApiOperation({ summary: 'Get student weekly timetable (내 시간표 — FN-116)' })
  @ApiQuery({ name: 'studentId', required: true })
  @ApiQuery({ name: 'weekStart', required: false, description: 'YYYY-MM-DD (Monday)' })
  async getTimetable(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    const stdId = Number(studentId);
    if (!stdId) {
      return { sessions: [], weekStart: '', weekEnd: '' };
    }

    if (user.role === 'PARENT') {
      const check = await this.ds.query(
        `SELECT 1 FROM tac_students WHERE std_id = ? AND prt_id = ?`,
        [stdId, Number(user.userId)],
      );
      if (check.length === 0) {
        return { sessions: [], weekStart: '', weekEnd: '' };
      }
    }

    const { mondayStr, sundayStr } = this.weekRange(weekStart);

    const sessions = await this.ds.query(
      `SELECT
         cs.csn_id AS id,
         DATE(cs.csn_start_at) AS date,
         TIME(cs.csn_start_at) AS startTime,
         TIME(cs.csn_end_at) AS endTime,
         cs.csn_session_status AS status,
         p.prg_name AS className,
         NULL AS teacherName,
         p.prg_name AS programName
       FROM tac_class_sessions cs
       JOIN tac_classes c ON c.cls_id = cs.cls_id
       JOIN tac_programs p ON p.prg_id = c.prg_id
       WHERE DATE(cs.csn_start_at) BETWEEN ? AND ?
         AND c.cls_id IN (
           SELECT e.cls_id FROM tac_enrollments e
           WHERE e.std_id = ? AND e.enr_status IN ('ACTIVE', 'CONFIRMED')
         )
       ORDER BY cs.csn_start_at`,
      [mondayStr, sundayStr, stdId],
    );

    return { sessions, weekStart: mondayStr, weekEnd: sundayStr };
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get parent payment history (내 결제 이력 — FN-118)' })
  @ApiQuery({ name: 'studentId', required: false })
  async getPayments(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId?: string,
  ) {
    const parentId = user.role === 'PARENT' ? Number(user.userId) : null;
    if (!parentId) {
      return [];
    }

    // Pay orders are linked to enrollments (not directly to students). Join
    // via tac_enrollments → tac_students → parent, and surface program name
    // via tac_classes → tac_programs.
    let query = `
      SELECT
        po.pod_id AS id,
        po.pod_order_no AS orderNumber,
        po.pod_amount AS amount,
        po.pod_status AS status,
        po.pod_created_at AS createdAt,
        p.prg_name AS programName,
        s.std_name AS studentName,
        s.std_id AS studentId
      FROM tac_pay_orders po
      JOIN tac_enrollments e ON e.enr_id = po.enr_id
      JOIN tac_students s ON s.std_id = e.std_id
      JOIN tac_classes c ON c.cls_id = e.cls_id
      JOIN tac_programs p ON p.prg_id = c.prg_id
      WHERE s.prt_id = ?
    `;
    const params: (string | number)[] = [parentId];

    if (studentId) {
      query += ` AND s.std_id = ?`;
      params.push(Number(studentId));
    }

    query += ` ORDER BY po.pod_created_at DESC LIMIT 50`;

    return this.ds.query(query, params);
  }

  @Get('kpi')
  @ApiOperation({ summary: 'Get student KPI for dashboard (자녀 KPI)' })
  @ApiQuery({ name: 'studentId', required: true })
  async getKpi(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId: string,
  ): Promise<StudentKpi | null> {
    const stdId = Number(studentId);
    if (!stdId) return null;

    if (user.role === 'PARENT') {
      const check = await this.ds.query(
        `SELECT 1 FROM tac_students WHERE std_id = ? AND prt_id = ?`,
        [stdId, Number(user.userId)],
      );
      if (check.length === 0) return null;
    }

    return this.getStudentKpi(stdId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private weekRange(weekStart?: string): { mondayStr: string; sundayStr: string } {
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

  private async getStudentKpi(studentId: number): Promise<StudentKpi> {
    const { mondayStr, sundayStr } = this.weekRange();

    const [weekClasses] = await this.ds.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN cs.csn_session_status = 'HELD' THEN 1 ELSE 0 END) AS held
       FROM tac_class_sessions cs
       JOIN tac_classes c ON c.cls_id = cs.cls_id
       WHERE DATE(cs.csn_start_at) BETWEEN ? AND ?
         AND c.cls_id IN (
           SELECT e.cls_id FROM tac_enrollments e
           WHERE e.std_id = ? AND e.enr_status IN ('ACTIVE', 'CONFIRMED')
         )`,
      [mondayStr, sundayStr, studentId],
    );

    // Latest MAP score — schema stores reading/math/language separately. We
    // surface reading as the primary `rit` value and leave percentile null
    // (no percentile column in tac_map_scores). UI can render NULL gracefully.
    const [latestScore] = await this.ds.query(
      `SELECT
         ms.msc_reading_score AS reading,
         ms.msc_math_score AS math,
         ms.msc_language_score AS language,
         ms.msc_assessed_at AS date
       FROM tac_map_scores ms
       WHERE ms.std_id = ?
       ORDER BY ms.msc_assessed_at DESC, ms.msc_id DESC LIMIT 1`,
      [studentId],
    );

    const [unpaid] = await this.ds.query(
      `SELECT COUNT(*) AS count
       FROM tac_pay_orders po
       JOIN tac_enrollments e ON e.enr_id = po.enr_id
       WHERE e.std_id = ? AND po.pod_status IN ('READY', 'PENDING')`,
      [studentId],
    );

    return {
      weekClasses: {
        total: Number(weekClasses?.total ?? 0),
        held: Number(weekClasses?.held ?? 0),
      },
      latestScore: latestScore
        ? {
            rit: Number(
              latestScore.reading ?? latestScore.math ?? latestScore.language ?? 0,
            ),
            percentile: null,
            date:
              latestScore.date instanceof Date
                ? latestScore.date.toISOString().slice(0, 10)
                : String(latestScore.date),
          }
        : null,
      unpaidOrders: Number(unpaid?.count ?? 0),
    };
  }
}
