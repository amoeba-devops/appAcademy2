import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ClassLink, readLinks } from './teacher-class-info';

export interface PortalClassInfoTeacher {
  tchId: string;
  name: string;
  subject: string | null;
  curriculum: string | null;
  links: ClassLink[];
}
export interface PortalClassInfoStudent {
  stdId: string;
  stdName: string;
  teachers: PortalClassInfoTeacher[];
}

/**
 * REQ-261103B — 포털 수업정보: 학생 본인 / 학부모의 자녀, 현재 배정된 강사별 과목·교재·수업링크.
 * REQ-261103C — 수업링크는 강사별 여러 개(`links`).
 * 강사 포털은 대상 아님(빈 목록).
 */
@Injectable()
export class PortalClassInfoService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async list(
    entId: string,
    kind: string,
    refId: string,
  ): Promise<PortalClassInfoStudent[]> {
    if (kind !== 'STUDENT' && kind !== 'PARENT') return [];
    const rows: Array<{
      stdId: string;
      stdName: string;
      tchId: string | null;
      name: string | null;
      info: Record<string, unknown> | null;
    }> = await this.ds.query(
      `SELECT s.std_id AS "stdId", s.std_name AS "stdName",
              t.tch_id AS "tchId", t.tch_name AS name, ci.info
         FROM amb_acm_std_student s
         LEFT JOIN amb_acm_std_student_teacher st
           ON st.ent_id = s.ent_id AND st.std_id = s.std_id
         LEFT JOIN amb_acm_tch_teacher t
           ON t.ent_id = s.ent_id AND t.tch_id = st.tch_id AND t.deleted_at IS NULL
         LEFT JOIN amb_acm_std_teacher_class_info ci
           ON ci.ent_id = s.ent_id AND ci.std_id = s.std_id AND ci.tch_id = t.tch_id
        WHERE s.ent_id = $1 AND s.deleted_at IS NULL
          AND s.std_status IS DISTINCT FROM 'WITHDRAWN'
          AND ($2 = 'STUDENT' AND s.std_id = $3
            OR $2 = 'PARENT' AND s.std_id IN (
              SELECT sp.std_id FROM amb_acm_std_student_parent sp
               WHERE sp.ent_id = $1 AND sp.par_id = $3))
        ORDER BY s.std_name, st.st_sort_order NULLS LAST, t.tch_name`,
      [entId, kind, refId],
    );
    const out = new Map<string, PortalClassInfoStudent>();
    for (const r of rows) {
      let std = out.get(r.stdId);
      if (!std) {
        std = { stdId: r.stdId, stdName: r.stdName, teachers: [] };
        out.set(r.stdId, std);
      }
      if (!r.tchId || !r.name) continue;
      std.teachers.push({
        tchId: r.tchId,
        name: r.name,
        subject: (r.info?.subject as string | null) ?? null,
        curriculum: (r.info?.curriculum as string | null) ?? null,
        links: readLinks(r.info),
      });
    }
    return [...out.values()];
  }
}
