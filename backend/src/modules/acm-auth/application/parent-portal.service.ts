import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../infrastructure/typeorm/acm-user.typeorm-entity';
import { StudentParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ClassStudentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { ClassTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class.typeorm-entity';
import { SessionTypeormEntity } from '../../acm-cls/infrastructure/typeorm/session.typeorm-entity';
import { ClsEnrollmentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/cls-enrollment.typeorm-entity';
import { MapScoreTypeormEntity } from '../../acm-map/infrastructure/typeorm/map-score.typeorm-entity';
import { PayOrderTypeormEntity } from '../../acm-pay/infrastructure/typeorm/pay-order.typeorm-entity';

interface LinkedStudentRow {
  id: string;
  name: string;
  grade: string | null;
  school: string | null;
  status: string;
  isPrimary: boolean;
}

export interface StudentKpi {
  weekClasses: { total: number; held: number };
  latestScore: { rit: number; percentile: number | null; date: string } | null;
  unpaidOrders: number;
}

const KST_TIME_ZONE = 'Asia/Seoul';

@Injectable()
export class ParentPortalService {
  constructor(
    @InjectRepository(StudentParentTypeormEntity, ACM_DS)
    private readonly studentParentRepo: Repository<StudentParentTypeormEntity>,
    @InjectRepository(MapScoreTypeormEntity, ACM_DS)
    private readonly mapScoreRepo: Repository<MapScoreTypeormEntity>,
    @InjectRepository(SessionTypeormEntity, ACM_DS)
    private readonly sessionRepo: Repository<SessionTypeormEntity>,
    @InjectRepository(PayOrderTypeormEntity, ACM_DS)
    private readonly payOrderRepo: Repository<PayOrderTypeormEntity>,
  ) {}

  async getChildren(parentId: string, entId: string) {
    const students = await this.listLinkedStudents(parentId, entId);
    if (students.length === 0) {
      return { children: [], selectedStudentId: null, kpi: null };
    }

    const selectedStudentId = this.pickDefaultStudentId(students);
    const kpi = selectedStudentId
      ? await this.getKpi(parentId, entId, selectedStudentId)
      : null;

    return {
      children: students.map((student) => ({
        id: student.id,
        name: student.name,
        grade: student.grade,
        school: student.school,
        status: student.status,
      })),
      selectedStudentId,
      kpi,
    };
  }

  async getKpi(
    parentId: string,
    entId: string,
    studentId: string,
  ): Promise<StudentKpi | null> {
    const students = await this.listLinkedStudents(parentId, entId);
    const selected = students.find((student) => student.id === studentId);
    if (!selected) return null;

    const { mondayStr, sundayStr } = this.weekRange();
    const weekClasses = await this.sessionRepo
      .createQueryBuilder('ses')
      .innerJoin(
        ClassStudentTypeormEntity,
        'cst',
        [
          'cst.cls_id = ses.cls_id',
          'cst.ent_id = :entId',
          'cst.cst_student_user_id = :studentId',
          'cst.cst_enrolled_at <= :weekEnd',
          '(cst.cst_left_at IS NULL OR cst.cst_left_at >= :weekStart)',
        ].join(' AND '),
        { entId, studentId, weekStart: mondayStr, weekEnd: sundayStr },
      )
      .innerJoin(
        ClassTypeormEntity,
        'cls',
        [
          'cls.cls_id = ses.cls_id',
          'cls.ent_id = :entId',
          'cls.cls_deleted_at IS NULL',
        ].join(' AND '),
        { entId },
      )
      .select('COUNT(ses.ses_id)', 'total')
      .addSelect("SUM(CASE WHEN ses.ses_status = 'HELD' THEN 1 ELSE 0 END)", 'held')
      .where('ses.ent_id = :entId', { entId })
      .andWhere('ses.ses_deleted_at IS NULL')
      .andWhere(
        "DATE(ses.ses_scheduled_at AT TIME ZONE 'Asia/Seoul') BETWEEN :weekStart AND :weekEnd",
        { weekStart: mondayStr, weekEnd: sundayStr },
      )
      .getRawOne<{ total?: string; held?: string }>();

    const latestScore = await this.mapScoreRepo.findOne({
      where: { studentId },
      order: { assessedAt: 'DESC', createdAt: 'DESC' },
    });

    const unpaid = await this.payOrderRepo
      .createQueryBuilder('po')
      .innerJoin(
        ClsEnrollmentTypeormEntity,
        'ce',
        'ce.ce_id = po.enrollment_id AND ce.ent_id = :entId',
        { entId },
      )
      .select('COUNT(po.pod_id)', 'count')
      .where('po.ent_id = :entId', { entId })
      .andWhere('ce.std_id = :studentId', { studentId })
      .andWhere("po.pod_status IN ('READY', 'IN_PROGRESS')")
      .getRawOne<{ count?: string }>();

    return {
      weekClasses: {
        total: Number(weekClasses?.total ?? 0),
        held: Number(weekClasses?.held ?? 0),
      },
      latestScore: latestScore
        ? {
            rit: Number(
              latestScore.readingScore ??
                latestScore.mathScore ??
                latestScore.languageScore ??
                0,
            ),
            percentile: null,
            date: latestScore.assessedAt,
          }
        : null,
      unpaidOrders: Number(unpaid?.count ?? 0),
    };
  }

  async getTimetable(
    parentId: string,
    entId: string,
    studentId: string,
    weekStart?: string,
  ) {
    const students = await this.listLinkedStudents(parentId, entId);
    const selected = students.find((student) => student.id === studentId);
    if (!selected) {
      return { sessions: [], weekStart: '', weekEnd: '' };
    }

    const { mondayStr, sundayStr } = this.weekRange(weekStart);
    const rows = await this.sessionRepo
      .createQueryBuilder('ses')
      .innerJoin(
        ClassStudentTypeormEntity,
        'cst',
        [
          'cst.cls_id = ses.cls_id',
          'cst.ent_id = :entId',
          'cst.cst_student_user_id = :studentId',
          'cst.cst_enrolled_at <= :weekEnd',
          '(cst.cst_left_at IS NULL OR cst.cst_left_at >= :weekStart)',
        ].join(' AND '),
        { entId, studentId, weekStart: mondayStr, weekEnd: sundayStr },
      )
      .innerJoin(
        ClassTypeormEntity,
        'cls',
        [
          'cls.cls_id = ses.cls_id',
          'cls.ent_id = :entId',
          'cls.cls_deleted_at IS NULL',
        ].join(' AND '),
        { entId },
      )
      .leftJoin(
        AcmUserTypeormEntity,
        'usr',
        'usr.usr_id = cls.cls_teacher_user_id AND usr.ent_id = :entId',
        { entId },
      )
      .select('ses.ses_id', 'id')
      .addSelect('ses.ses_scheduled_at', 'scheduledAt')
      .addSelect('ses.ses_duration_min', 'durationMin')
      .addSelect('ses.ses_status', 'status')
      .addSelect('COALESCE(cls.cls_subject_label, cls.cls_code)', 'className')
      .addSelect('COALESCE(cls.cls_subject_label, cls.cls_code)', 'programName')
      .addSelect('usr.usr_name', 'teacherName')
      .where('ses.ent_id = :entId', { entId })
      .andWhere('ses.ses_deleted_at IS NULL')
      .andWhere(
        "DATE(ses.ses_scheduled_at AT TIME ZONE 'Asia/Seoul') BETWEEN :weekStart AND :weekEnd",
        { weekStart: mondayStr, weekEnd: sundayStr },
      )
      .orderBy('ses.ses_scheduled_at', 'ASC')
      .getRawMany<{
        id: string;
        scheduledAt: Date | string;
        durationMin: number | string;
        status: string;
        className: string | null;
        programName: string | null;
        teacherName: string | null;
      }>();

    return {
      sessions: rows.map((row) => {
        const scheduledAt = new Date(row.scheduledAt);
        const durationMin = Number(row.durationMin ?? 0);
        const endAt = new Date(scheduledAt.getTime() + durationMin * 60_000);
        const label = row.className ?? row.programName ?? 'Class';
        return {
          id: row.id,
          date: this.formatDateKst(scheduledAt),
          startTime: this.formatTimeKst(scheduledAt),
          endTime: this.formatTimeKst(endAt),
          status: row.status,
          className: label,
          teacherName: row.teacherName ?? null,
          programName: row.programName ?? label,
        };
      }),
      weekStart: mondayStr,
      weekEnd: sundayStr,
    };
  }

  async getPayments(parentId: string, entId: string, studentId?: string) {
    const students = await this.listLinkedStudents(parentId, entId);
    const linkedIds = new Set(students.map((student) => student.id));
    if (studentId && !linkedIds.has(studentId)) {
      return [];
    }
    if (linkedIds.size === 0) return [];

    const qb = this.payOrderRepo
      .createQueryBuilder('po')
      .innerJoin(
        ClsEnrollmentTypeormEntity,
        'ce',
        'ce.ce_id = po.enrollment_id AND ce.ent_id = :entId',
        { entId },
      )
      .innerJoin(
        StudentTypeormEntity,
        's',
        's.std_id = ce.std_id AND s.deleted_at IS NULL',
      )
      .innerJoin(
        ClassTypeormEntity,
        'cls',
        'cls.cls_id = ce.cls_id AND cls.cls_deleted_at IS NULL',
      )
      .innerJoin(
        StudentParentTypeormEntity,
        'sp',
        'sp.std_id = s.std_id AND sp.par_id = :parentId AND sp.ent_id = :entId',
        { parentId, entId },
      )
      .select('po.pod_id', 'id')
      .addSelect('po.pod_order_no', 'orderNumber')
      .addSelect('po.pod_amount', 'amount')
      .addSelect('po.pod_status', 'status')
      .addSelect('po.created_at', 'createdAt')
      .addSelect('COALESCE(cls.cls_subject_label, cls.cls_code)', 'programName')
      .addSelect('s.std_name', 'studentName')
      .addSelect('s.std_id', 'studentId')
      .where('po.ent_id = :entId', { entId })
      .orderBy('po.created_at', 'DESC')
      .limit(50);

    if (studentId) {
      qb.andWhere('s.std_id = :studentId', { studentId });
    }

    return qb.getRawMany<{
      id: string;
      orderNumber: string;
      amount: number | string;
      status: string;
      createdAt: string;
      programName: string | null;
      studentName: string | null;
      studentId: string;
    }>();
  }

  async getScores(parentId: string, entId: string, studentId?: string) {
    const students = await this.listLinkedStudents(parentId, entId);
    if (students.length === 0) {
      return {
        accessMode: 'PARENT_UNBOUND' as const,
        selectedStudentId: null,
        selectedStudentName: null,
        students: [],
        summary: null,
        scores: [],
      };
    }

    const selectedStudent =
      students.find((student) => student.id === studentId) ??
      students.find((student) => student.id === this.pickDefaultStudentId(students)) ??
      students[0];

    const scoreRows = await this.mapScoreRepo.find({
      where: { studentId: selectedStudent.id },
      order: { assessedAt: 'ASC', createdAt: 'ASC' },
    });

    const summary = this.buildScoreSummary(scoreRows);

    return {
      accessMode: 'PARENT' as const,
      selectedStudentId: selectedStudent.id,
      selectedStudentName: selectedStudent.name,
      students: students.map((student) => ({
        studentId: student.id,
        studentName: student.name,
        gradeLevel: student.grade,
        school: student.school,
      })),
      summary,
      scores: scoreRows.map((score) => ({
        id: score.id,
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        assignmentId: score.assignmentId ?? null,
        assessedAt: score.assessedAt,
        readingScore: score.readingScore ?? null,
        mathScore: score.mathScore ?? null,
        languageScore: score.languageScore ?? null,
        source: score.source,
        note: score.note ?? null,
        createdAt: score.createdAt.toISOString(),
      })),
    };
  }

  private async listLinkedStudents(
    parentId: string,
    entId: string,
  ): Promise<LinkedStudentRow[]> {
    const rows = await this.studentParentRepo
      .createQueryBuilder('sp')
      .innerJoin(
        StudentTypeormEntity,
        's',
        's.std_id = sp.std_id AND s.deleted_at IS NULL',
      )
      .select('s.std_id', 'id')
      .addSelect('s.std_name', 'name')
      .addSelect('s.std_grade', 'grade')
      .addSelect('s.std_school', 'school')
      .addSelect('s.std_status', 'status')
      .addSelect('sp.sp_is_primary', 'isPrimary')
      .where('sp.ent_id = :entId', { entId })
      .andWhere('sp.par_id = :parentId', { parentId })
      .orderBy('sp.sp_is_primary', 'DESC')
      .addOrderBy(
        [
          'CASE',
          "WHEN s.std_status = 'ACTIVE' THEN 0",
          "WHEN s.std_status = 'INACTIVE' THEN 1",
          'ELSE 2',
          'END',
        ].join(' '),
        'ASC',
      )
      .addOrderBy('s.std_name', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        grade: string | null;
        school: string | null;
        status: string;
        isPrimary: boolean | 'true' | 'false';
      }>();

    return rows.map((row) => ({
      ...row,
      isPrimary: row.isPrimary === true || row.isPrimary === 'true',
    }));
  }

  private pickDefaultStudentId(students: LinkedStudentRow[]): string | null {
    return (
      students.find((student) => student.status === 'ACTIVE')?.id ??
      students[0]?.id ??
      null
    );
  }

  private buildScoreSummary(scores: MapScoreTypeormEntity[]) {
    if (scores.length === 0) return null;

    const latest = scores[scores.length - 1];
    const readingValues = scores
      .map((score) => score.readingScore)
      .filter((value): value is number => value != null);

    const averageReadingScore =
      readingValues.length > 0
        ? Number(
            (
              readingValues.reduce((sum, value) => sum + value, 0) /
              readingValues.length
            ).toFixed(1),
          )
        : null;

    return {
      latestAssessedAt: latest.assessedAt,
      latestReadingScore: latest.readingScore ?? null,
      latestMathScore: latest.mathScore ?? null,
      latestLanguageScore: latest.languageScore ?? null,
      averageReadingScore,
      bestReadingScore: readingValues.length > 0 ? Math.max(...readingValues) : null,
      readingDelta:
        readingValues.length >= 2
          ? readingValues[readingValues.length - 1] - readingValues[0]
          : null,
      assessmentsCount: scores.length,
    };
  }

  private weekRange(weekStart?: string): { mondayStr: string; sundayStr: string } {
    const base = weekStart ? new Date(`${weekStart}T00:00:00+09:00`) : new Date();
    const normalized = new Date(base);
    const day = normalized.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalized.setUTCDate(normalized.getUTCDate() + diff);
    const sunday = new Date(normalized);
    sunday.setUTCDate(normalized.getUTCDate() + 6);

    return {
      mondayStr: this.formatDateKst(normalized),
      sundayStr: this.formatDateKst(sunday),
    };
  }

  private formatDateKst(date: Date): string {
    return this.formatParts(date, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private formatTimeKst(date: Date): string {
    return this.formatParts(date, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatParts(
    date: Date,
    options: Intl.DateTimeFormatOptions,
  ): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: KST_TIME_ZONE,
      ...options,
    });
    const parts = formatter.formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    if (options.year && options.month && options.day) {
      return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
    }
    return `${values.get('hour')}:${values.get('minute')}`;
  }
}
