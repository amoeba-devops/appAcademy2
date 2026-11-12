import type { EntityManager } from 'typeorm';

/**
 * REQ-261112C — 상담 4단계(등록상담) '담당 강사 배정'을 학생 관리의 담당강사
 * (amb_acm_std_student_teacher)에 반영한다. 상담이 학생과 연결(inq_std_id)된 경우에만,
 * 학생에 아직 없는 강사만 추가한다(기존 학생 담당강사·순서는 건드리지 않음, 멱등).
 * 순서: 기존 마지막 다음부터 PRIMARY → SECONDARY, 배정 시각 순.
 */
export const SYNC_ASSIGNED_TEACHERS_TO_STUDENT_SQL = `
INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order)
SELECT i.ent_id, i.inq_std_id, a.tch_id,
       COALESCE((SELECT max(x.st_sort_order) + 1 FROM amb_acm_std_student_teacher x
                 WHERE x.ent_id = i.ent_id AND x.std_id = i.inq_std_id), 0)
       + row_number() OVER (ORDER BY a.asg_role, a.asg_assigned_at) - 1
FROM amb_acm_csl_teacher_assignment a
JOIN amb_acm_csl_inquiry i
  ON i.inq_id = a.inq_id AND i.ent_id = a.ent_id AND i.deleted_at IS NULL AND i.inq_std_id IS NOT NULL
JOIN amb_acm_std_student s
  ON s.std_id = i.inq_std_id AND s.ent_id = i.ent_id AND s.deleted_at IS NULL
JOIN amb_acm_tch_teacher t
  ON t.tch_id = a.tch_id AND t.ent_id = a.ent_id AND t.deleted_at IS NULL
WHERE a.ent_id = $1 AND a.inq_id = $2
  AND NOT EXISTS (SELECT 1 FROM amb_acm_std_student_teacher st
                  WHERE st.std_id = i.inq_std_id AND st.tch_id = a.tch_id)
ON CONFLICT ON CONSTRAINT uq_acm_std_st_pair DO NOTHING
RETURNING std_id::text AS "stdId"`;

/** 학생 레거시 미러(std_teacher_id=대표, std_teacher=이름 콤마조인 100자)를 조인 테이블 기준으로 갱신. */
export const REFRESH_STUDENT_TEACHER_MIRROR_SQL = `
UPDATE amb_acm_std_student s
   SET std_teacher_id = m.first_id, std_teacher = left(m.names, 100)
  FROM (SELECT st.std_id,
               (array_agg(st.tch_id ORDER BY st.st_sort_order, st.created_at))[1] AS first_id,
               string_agg(t.tch_name, ', ' ORDER BY st.st_sort_order, st.created_at) AS names
          FROM amb_acm_std_student_teacher st
          JOIN amb_acm_tch_teacher t ON t.tch_id = st.tch_id
         WHERE st.ent_id = $1 AND st.std_id = ANY($2::uuid[])
         GROUP BY st.std_id) m
 WHERE s.ent_id = $1 AND s.std_id = m.std_id
   AND (s.std_teacher_id IS DISTINCT FROM m.first_id OR s.std_teacher IS DISTINCT FROM left(m.names, 100))`;

export async function syncAssignedTeachersToStudent(
  manager: EntityManager,
  entId: string,
  inqId: string,
): Promise<number> {
  const inserted: Array<{ stdId: string }> = await manager.query(
    SYNC_ASSIGNED_TEACHERS_TO_STUDENT_SQL,
    [entId, inqId],
  );
  if (inserted.length === 0) return 0;
  const stdIds = [...new Set(inserted.map((r) => r.stdId))];
  await manager.query(REFRESH_STUDENT_TEACHER_MIRROR_SQL, [entId, stdIds]);
  return inserted.length;
}
