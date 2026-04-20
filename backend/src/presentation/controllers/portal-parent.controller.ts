import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

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
    // For parent: sub = parentId; For admin preview: use query param
    const parentId = user.role === 'PARENT' ? user.userId : null;

    if (!parentId) {
      return { data: { children: [], selectedStudentId: null } };
    }

    // Get children
    const children = await this.ds.query(
      `SELECT s.std_id AS id, s.std_name AS name, s.std_grade AS grade,
              s.std_school AS school, s.std_status AS status
       FROM tac_students s
       WHERE s.prt_id = ? AND s.std_status = 'ACTIVE'
       ORDER BY s.std_name`,
      [parentId],
    );

    if (children.length === 0) {
      return { data: { children: [], selectedStudentId: null, kpi: null } };
    }

    const selectedId = children[0].id;

    // KPI for first child
    const kpi = await this.getStudentKpi(selectedId);

    return {
      data: {
        children,
        selectedStudentId: selectedId,
        kpi,
      },
    };
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
      return { data: { sessions: [], weekStart: '', weekEnd: '' } };
    }

    // Verify parent owns this student
    if (user.role === 'PARENT') {
      const check = await this.ds.query(
        `SELECT 1 FROM tac_students WHERE std_id = ? AND prt_id = ?`,
        [stdId, user.userId],
      );
      if (check.length === 0) {
        return { data: { sessions: [], weekStart: '', weekEnd: '' } };
      }
    }

    // Calculate week boundaries
    const now = weekStart ? new Date(weekStart) : new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    // Get sessions for this student's enrollments
    const sessions = await this.ds.query(
      `SELECT
         cs.ses_id AS id,
         cs.ses_date AS date,
         cs.ses_start_time AS startTime,
         cs.ses_end_time AS endTime,
         cs.ses_status AS status,
         c.cls_name AS className,
         t.tch_name AS teacherName,
         p.prg_name AS programName
       FROM tac_class_sessions cs
       JOIN tac_classes c ON c.cls_id = cs.cls_id
       JOIN tac_programs p ON p.prg_id = c.prg_id
       LEFT JOIN tac_teachers t ON t.tch_id = c.tch_id
       WHERE cs.ses_date BETWEEN ? AND ?
         AND c.cls_id IN (
           SELECT e.cls_id FROM tac_enrollments e
           WHERE e.std_id = ? AND e.enr_status = 'ACTIVE'
         )
       ORDER BY cs.ses_date, cs.ses_start_time`,
      [mondayStr, sundayStr, stdId],
    );

    return {
      data: {
        sessions,
        weekStart: mondayStr,
        weekEnd: sundayStr,
      },
    };
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get parent payment history (내 결제 이력 — FN-118)' })
  @ApiQuery({ name: 'studentId', required: false })
  async getPayments(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId?: string,
  ) {
    const parentId = user.role === 'PARENT' ? user.userId : null;
    if (!parentId) {
      return { data: [] };
    }

    let query = `
      SELECT
        po.ord_id AS id,
        po.ord_order_number AS orderNumber,
        po.ord_amount AS amount,
        po.ord_status AS status,
        po.ord_created_at AS createdAt,
        p.prg_name AS programName,
        s.std_name AS studentName
      FROM tac_payment_orders po
      LEFT JOIN tac_programs p ON p.prg_id = po.prg_id
      LEFT JOIN tac_students s ON s.std_id = po.std_id
      WHERE po.acd_id = 1
        AND po.std_id IN (SELECT std_id FROM tac_students WHERE prt_id = ?)
    `;
    const params: (string | number)[] = [parentId];

    if (studentId) {
      query += ` AND po.std_id = ?`;
      params.push(Number(studentId));
    }

    query += ` ORDER BY po.ord_created_at DESC LIMIT 50`;

    const payments = await this.ds.query(query, params);

    return { data: payments };
  }

  @Get('kpi')
  @ApiOperation({ summary: 'Get student KPI for dashboard (자녀 KPI)' })
  @ApiQuery({ name: 'studentId', required: true })
  async getKpi(
    @CurrentUser() user: CurrentUserPayload,
    @Query('studentId') studentId: string,
  ) {
    const stdId = Number(studentId);
    if (!stdId) {
      return { data: null };
    }

    // Verify parent owns this student
    if (user.role === 'PARENT') {
      const check = await this.ds.query(
        `SELECT 1 FROM tac_students WHERE std_id = ? AND prt_id = ?`,
        [stdId, user.userId],
      );
      if (check.length === 0) {
        return { data: null };
      }
    }

    const kpi = await this.getStudentKpi(stdId);
    return { data: kpi };
  }

  private async getStudentKpi(studentId: number) {
    // This week's sessions
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);

    const [weekClasses] = await this.ds.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN cs.ses_status = 'HELD' THEN 1 ELSE 0 END) AS held
       FROM tac_class_sessions cs
       JOIN tac_classes c ON c.cls_id = cs.cls_id
       WHERE cs.ses_date BETWEEN ? AND ?
         AND c.cls_id IN (
           SELECT e.cls_id FROM tac_enrollments e
           WHERE e.std_id = ? AND e.enr_status = 'ACTIVE'
         )`,
      [mondayStr, sundayStr, studentId],
    );

    // Latest MAP score
    const [latestScore] = await this.ds.query(
      `SELECT ms.scr_rit AS rit, ms.scr_percentile AS percentile,
              ms.scr_created_at AS date
       FROM tac_map_scores ms
       WHERE ms.std_id = ?
       ORDER BY ms.scr_created_at DESC LIMIT 1`,
      [studentId],
    );

    // Unpaid orders
    const [unpaid] = await this.ds.query(
      `SELECT COUNT(*) AS count
       FROM tac_payment_orders
       WHERE std_id = ? AND ord_status IN ('PENDING', 'READY')`,
      [studentId],
    );

    return {
      weekClasses: {
        total: Number(weekClasses?.total ?? 0),
        held: Number(weekClasses?.held ?? 0),
      },
      latestScore: latestScore
        ? { rit: latestScore.rit, percentile: latestScore.percentile, date: latestScore.date }
        : null,
      unpaidOrders: Number(unpaid?.count ?? 0),
    };
  }
}
