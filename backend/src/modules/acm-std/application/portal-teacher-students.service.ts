import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  ClassLink,
  classValues,
  normalizeLinks,
  readLinks,
} from './teacher-class-info';

/**
 * PLN-260719 Phase C — 강사 포털 "수강생관리".
 *
 * 대상 학생 = 담당강사 FK(std_teacher_id = 내 tch_id)
 *           ∪ 내가 담당하는 수업(반)에 소속된 학생.
 * 상세 = 기본정보 + 연결 상담(단계·최근 상담기록) + 최근 수업 이벤트.
 * PortalJwtAuthGuard(kind=TEACHER) 뒤에서만 호출 — refId = tch_id.
 * REQ-261103C — 학생관리에서 배정된 학생에게 내 수업링크(여러 개) 등록.
 */

export interface TeacherStudentSummary {
  id: string;
  name: string;
  englishName: string | null;
  school: string | null;
  grade: string | null;
  subject: string | null;
  status: string;
  email: string | null;
}

export interface TeacherStudentDetail extends TeacherStudentSummary {
  phone: string | null;
  startDate: string | null;
  specialNote: string | null;
  goalsNote: string | null;
  sourceInquiry: { id: string; seqNo: number; currentStage: string } | null;
  remarks: Array<{ body: string; createdAt: string }>;
  recentEvents: Array<{
    id: string;
    title: string;
    category: string;
    startAt: string;
    endAt: string;
  }>;
  /** 내(강사) 수업링크 — 학생관리 배정 학생만 고칠 수 있다. */
  links: ClassLink[];
  linksEditable: boolean;
}

@Injectable()
export class PortalTeacherStudentsService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  /** 내(강사) 수강생 목록 — FK 배정 ∪ 반 소속. */
  async listMyStudents(
    entId: string,
    tchId: string,
  ): Promise<TeacherStudentSummary[]> {
    const rows: Array<{
      std_id: string;
      std_name: string;
      std_english_name: string | null;
      std_school: string | null;
      std_grade: string | null;
      std_subject: string | null;
      std_status: string;
      std_email: string | null;
    }> = await this.ds.query(
      `SELECT DISTINCT s.std_id, s.std_name, s.std_english_name, s.std_school,
              s.std_grade, s.std_subject, s.std_status, s.std_email
         FROM amb_acm_std_student s
        WHERE s.ent_id = $1 AND s.deleted_at IS NULL
          AND (
            s.std_teacher_id = $2
            OR EXISTS (
              SELECT 1 FROM amb_acm_std_student_teacher st
               WHERE st.std_id = s.std_id AND st.tch_id = $2
            )
            OR s.std_id IN (
              SELECT cs.cst_student_user_id
                FROM amb_acm_cls_class_students cs
                JOIN amb_acm_cls_classes c
                  ON c.cls_id = cs.cls_id AND c.ent_id = cs.ent_id
                JOIN amb_acm_tch_teacher t
                  ON (c.cls_teacher_tch_id = t.tch_id
                      OR t.tch_user_id = c.cls_teacher_user_id)
                 AND t.ent_id = c.ent_id
               WHERE cs.ent_id = $1 AND t.tch_id = $2 AND cs.cst_left_at IS NULL
            )
          )
        ORDER BY s.std_name`,
      [entId, tchId],
    );
    return rows.map((r) => ({
      id: r.std_id,
      name: r.std_name,
      englishName: r.std_english_name,
      school: r.std_school,
      grade: r.std_grade,
      subject: r.std_subject,
      status: r.std_status,
      email: r.std_email,
    }));
  }

  /** 학생 상세 + 상담/수업 기록 — 내 수강생이 아니면 403. */
  async getMyStudent(
    entId: string,
    tchId: string,
    stdId: string,
  ): Promise<TeacherStudentDetail> {
    const mine = await this.listMyStudents(entId, tchId);
    const summary = mine.find((s) => s.id === stdId);
    if (!summary) throw new ForbiddenException('NOT_MY_STUDENT');

    const [row]: Array<{
      std_phone: string | null;
      std_start_date: string | null;
      std_special_note: string | null;
      std_goals_note: string | null;
    }> = await this.ds.query(
      `SELECT std_phone, std_start_date, std_special_note, std_goals_note
         FROM amb_acm_std_student
        WHERE ent_id = $1 AND std_id = $2 AND deleted_at IS NULL`,
      [entId, stdId],
    );
    if (!row) throw new NotFoundException('STUDENT_NOT_FOUND');

    // 연결 상담 (inq_std_id 역조회, 최신 1건) + 최근 상담기록 5건.
    const inqRows: Array<{
      inq_id: string;
      inq_seq_no: number;
      inq_current_stage: string;
    }> = await this.ds.query(
      `SELECT inq_id, inq_seq_no, inq_current_stage
         FROM amb_acm_csl_inquiry
        WHERE ent_id = $1 AND inq_std_id = $2 AND deleted_at IS NULL
        ORDER BY inq_seq_no DESC LIMIT 1`,
      [entId, stdId],
    );
    const sourceInquiry = inqRows[0]
      ? {
          id: inqRows[0].inq_id,
          seqNo: Number(inqRows[0].inq_seq_no),
          currentStage: inqRows[0].inq_current_stage,
        }
      : null;

    let remarks: Array<{ body: string; createdAt: string }> = [];
    if (sourceInquiry) {
      const remarkRows: Array<{ body: string; created_at: string }> =
        await this.ds.query(
          `SELECT body, created_at FROM amb_acm_csl_remark
            WHERE ent_id = $1 AND inq_id = $2 AND deleted_at IS NULL
            ORDER BY created_at DESC LIMIT 5`,
          [entId, sourceInquiry.id],
        );
      remarks = remarkRows.map((r) => ({
        body: r.body,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    }

    // 최근 수업 이벤트 10건 — 참석자(invitee) 또는 반(evt_cls_id) 소속 기준.
    const eventRows: Array<{
      evt_id: string;
      evt_title: string;
      evt_category: string;
      evt_start_at: string;
      evt_end_at: string;
    }> = await this.ds.query(
      `SELECT e.evt_id, e.evt_title, e.evt_category, e.evt_start_at, e.evt_end_at
         FROM amb_acm_cal_event e
        WHERE e.ent_id = $1 AND e.deleted_at IS NULL
          AND (
            EXISTS (SELECT 1 FROM amb_acm_cal_invitee i
                     WHERE i.evt_id = e.evt_id AND i.ent_id = e.ent_id
                       AND i.inv_kind = 'STUDENT' AND i.inv_ref_id = $2)
            OR (e.evt_cls_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM amb_acm_cls_class_students cs
                   WHERE cs.cls_id = e.evt_cls_id AND cs.ent_id = e.ent_id
                     AND cs.cst_student_user_id = $2 AND cs.cst_left_at IS NULL))
          )
        ORDER BY e.evt_start_at DESC LIMIT 10`,
      [entId, stdId],
    );

    const link = await this.linkState(entId, tchId, stdId);

    return {
      ...summary,
      ...link,
      phone: row.std_phone,
      startDate: row.std_start_date,
      specialNote: row.std_special_note,
      goalsNote: row.std_goals_note,
      sourceInquiry,
      remarks,
      recentEvents: eventRows.map((e) => ({
        id: e.evt_id,
        title: e.evt_title,
        category: e.evt_category,
        startAt: new Date(e.evt_start_at).toISOString(),
        endAt: new Date(e.evt_end_at).toISOString(),
      })),
    };
  }

  private async linkState(entId: string, tchId: string, stdId: string) {
    const [r]: Array<{ assigned: boolean; info: Record<string, unknown> | null }> =
      await this.ds.query(
        `SELECT EXISTS (SELECT 1 FROM amb_acm_std_student_teacher st
                         WHERE st.ent_id = $1 AND st.std_id = $3 AND st.tch_id = $2) AS assigned,
                (SELECT ci.info FROM amb_acm_std_teacher_class_info ci
                  WHERE ci.ent_id = $1 AND ci.std_id = $3 AND ci.tch_id = $2) AS info`,
        [entId, tchId, stdId],
      );
    return { links: readLinks(r?.info ?? null), linksEditable: !!r?.assigned };
  }

  /** REQ-261103C — 내 수업링크 저장. 배정 학생이 아니면 403(반 소속만으로는 불가). */
  async saveMyLinks(
    entId: string,
    tchId: string,
    stdId: string,
    input: Array<{ label?: string | null; url?: string | null }>,
  ): Promise<{ links: ClassLink[]; linksEditable: boolean }> {
    const { linksEditable } = await this.linkState(entId, tchId, stdId);
    if (!linksEditable) throw new ForbiddenException('NOT_ASSIGNED_STUDENT');
    const links = normalizeLinks(input);
    const patch = { links, meetingUrl: links[0]?.url ?? null };
    await this.ds.query(
      `INSERT INTO amb_acm_std_teacher_class_info (ent_id, std_id, tch_id, info)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (ent_id, std_id, tch_id) DO UPDATE
         SET info = amb_acm_std_teacher_class_info.info || $5::jsonb, updated_at = now()`,
      [
        entId,
        stdId,
        tchId,
        JSON.stringify({ ...classValues({}), ...patch }),
        JSON.stringify(patch),
      ],
    );
    return { links, linksEditable };
  }
}
