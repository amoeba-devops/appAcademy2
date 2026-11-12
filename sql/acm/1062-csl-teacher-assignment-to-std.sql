-- REQ-261112C — 상담 4단계 '담당 강사 배정'이 학생 관리 담당강사에 반영되지 않던 누락분 백필 (멱등).
-- 학생과 연결된 상담(inq_std_id)의 배정 강사를, 학생 관리 담당강사가 한 명도 없는 학생에게만 추가하고
-- (학생 관리에서 따로 정한 담당강사가 있는 학생은 건드리지 않음) 레거시 미러를 채운다.
-- 이후 신규 배정·학생 등록 시에는 애플리케이션(teacher-student-sync.ts)이 같은 규칙으로 반영한다.
WITH ins AS (
  INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order)
  SELECT i.ent_id, i.inq_std_id, a.tch_id,
         COALESCE((SELECT max(x.st_sort_order) + 1 FROM amb_acm_std_student_teacher x
                   WHERE x.ent_id = i.ent_id AND x.std_id = i.inq_std_id), 0)
         + row_number() OVER (PARTITION BY i.inq_std_id ORDER BY a.asg_role, a.asg_assigned_at) - 1
  FROM amb_acm_csl_teacher_assignment a
  JOIN amb_acm_csl_inquiry i
    ON i.inq_id = a.inq_id AND i.ent_id = a.ent_id AND i.deleted_at IS NULL AND i.inq_std_id IS NOT NULL
  JOIN amb_acm_std_student s
    ON s.std_id = i.inq_std_id AND s.ent_id = i.ent_id AND s.deleted_at IS NULL
  JOIN amb_acm_tch_teacher t
    ON t.tch_id = a.tch_id AND t.ent_id = a.ent_id AND t.deleted_at IS NULL
  WHERE NOT EXISTS (SELECT 1 FROM amb_acm_std_student_teacher st
                    WHERE st.std_id = i.inq_std_id)
  ON CONFLICT ON CONSTRAINT uq_acm_std_st_pair DO NOTHING
  RETURNING std_id
)
SELECT count(*) AS inserted FROM ins;

-- 미러 갱신: 대표 강사가 비어 있거나 조인 테이블과 다른 학생만.
UPDATE amb_acm_std_student s
   SET std_teacher_id = m.first_id, std_teacher = left(m.names, 100)
  FROM (SELECT st.std_id,
               (array_agg(st.tch_id ORDER BY st.st_sort_order, st.created_at))[1] AS first_id,
               string_agg(t.tch_name, ', ' ORDER BY st.st_sort_order, st.created_at) AS names
          FROM amb_acm_std_student_teacher st
          JOIN amb_acm_tch_teacher t ON t.tch_id = st.tch_id
         WHERE st.std_id IN (SELECT i.inq_std_id FROM amb_acm_csl_teacher_assignment a
                               JOIN amb_acm_csl_inquiry i ON i.inq_id = a.inq_id AND i.ent_id = a.ent_id
                              WHERE i.inq_std_id IS NOT NULL)
         GROUP BY st.std_id) m
 WHERE s.std_id = m.std_id AND s.deleted_at IS NULL
   AND s.std_teacher_id IS NULL;
