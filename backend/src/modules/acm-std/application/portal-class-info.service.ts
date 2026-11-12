import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CAL_LINK_DAYS, CAL_PAIRS_SQL } from './calendar-teachers';
import { ClassLink, readLinks } from './teacher-class-info';

export interface PortalClassInfoTeacher {
  tchId: string;
  name: string;
  subject: string | null;
  curriculum: string | null;
  links: PortalClassLink[];
}
/** REQ-261112D — `source: 'CAL'` = 수업일정(/admin/cal)에 등록된 화상수업 링크. */
export type PortalClassLink = ClassLink & { source?: 'CAL' };
export interface PortalClassInfoStudent {
  stdId: string;
  stdName: string;
  teachers: PortalClassInfoTeacher[];
}

/**
 * REQ-261103B — 포털 수업정보: 학생 본인 / 학부모의 자녀, 현재 배정된 강사별 과목·교재·수업링크.
 * REQ-261103C — 수업링크는 강사별 여러 개(`links`).
 * REQ-261103D — 강사 = 학생관리 배정 ∪ 수업일정 강사(최근 90일 ~ 앞으로).
 * REQ-261112D — 학생관리 링크에 더해, 그 강사·학생 수업일정(최근 90일 ~ 앞으로)의
 *   Google Meet·기타 화상 링크를 중복 없이 덧붙인다 (가까운 일정 순, 강사별 최대 3개).
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
         LEFT JOIN (
           SELECT st.std_id, st.tch_id, MIN(st.st_sort_order) AS sort
             FROM amb_acm_std_student_teacher st WHERE st.ent_id = $1
            GROUP BY st.std_id, st.tch_id
           UNION
           SELECT cp.std_id, cp.tch_id, NULL FROM (${CAL_PAIRS_SQL}) cp
            WHERE cp.ent_id = $1
              AND NOT EXISTS (SELECT 1 FROM amb_acm_std_student_teacher x
                               WHERE x.ent_id = $1 AND x.std_id = cp.std_id
                                 AND x.tch_id = cp.tch_id)
         ) st ON st.std_id = s.std_id
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
        ORDER BY s.std_name, st.sort NULLS LAST, t.tch_name`,
      [entId, kind, refId],
    );
    const calLinks = await this.calendarLinks(entId, [
      ...new Set(rows.map((r) => r.stdId)),
    ]);
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
        links: mergeLinks(
          readLinks(r.info),
          calLinks.get(`${r.stdId}:${r.tchId}`) ?? [],
        ),
      });
    }
    return [...out.values()];
  }

  /** (학생:강사) → 수업일정 화상 링크 (가까운 일정 순, 같은 주소 1건). */
  private async calendarLinks(
    entId: string,
    stdIds: string[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!stdIds.length) return map;
    const rows: Array<{ stdId: string; tchId: string; url: string }> =
      await this.ds.query(
        `SELECT std_id AS "stdId", tch_id AS "tchId", url FROM (
           SELECT DISTINCT ON (si.inv_ref_id, x.tch_id, btrim(e.evt_meeting_url))
                  si.inv_ref_id AS std_id, x.tch_id, btrim(e.evt_meeting_url) AS url,
                  abs(extract(epoch FROM e.evt_start_at - now())) AS dist
             FROM amb_acm_cal_event e
             JOIN amb_acm_cal_invitee si
               ON si.evt_id = e.evt_id AND si.ent_id = e.ent_id
              AND si.inv_kind = 'STUDENT' AND si.inv_ref_id = ANY($2::uuid[])
             CROSS JOIN LATERAL (
               SELECT e.evt_assignee_tch_id AS tch_id WHERE e.evt_assignee_tch_id IS NOT NULL
               UNION
               SELECT ti.inv_ref_id FROM amb_acm_cal_invitee ti
                WHERE ti.evt_id = e.evt_id AND ti.ent_id = e.ent_id AND ti.inv_kind = 'TEACHER'
             ) x
            WHERE e.ent_id = $1 AND e.deleted_at IS NULL
              AND e.evt_start_at >= now() - interval '${CAL_LINK_DAYS} days'
              AND e.evt_meeting_provider IN ('GOOGLE_MEET', 'OTHER')
              AND btrim(coalesce(e.evt_meeting_url, '')) <> ''
            ORDER BY si.inv_ref_id, x.tch_id, btrim(e.evt_meeting_url), dist
         ) u ORDER BY dist`,
        [entId, stdIds],
      );
    for (const r of rows) {
      const key = `${r.stdId}:${r.tchId}`;
      const list = map.get(key) ?? [];
      if (list.length < 3) list.push(r.url);
      map.set(key, list);
    }
    return map;
  }
}

/** 학생관리 링크 뒤에 일정 링크를 붙인다 — 같은 주소(https:// 유무 무시)는 한 번만. */
export function mergeLinks(
  saved: ClassLink[],
  calendar: string[],
): PortalClassLink[] {
  const key = (u: string) =>
    u.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
  const seen = new Set(saved.map((l) => key(l.url)));
  const out: PortalClassLink[] = [...saved];
  for (const url of calendar) {
    if (seen.has(key(url))) continue;
    seen.add(key(url));
    out.push({ label: null, url, source: 'CAL' });
  }
  return out;
}
