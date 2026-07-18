-- PLN-260719 B+ — 문서 게시글 수정 히스토리 (저장 단위 리비전).
--
-- DOC 게시글을 저장할 때마다 제목/본문 스냅샷 + 수정자를 기록한다.
--   • 생성 = v1, 이후 저장/복원마다 seq 증가
--   • 복원(restore)도 새 리비전으로 기록 (히스토리는 append-only)
--
-- @see docs/plan/PLN-260719-portal-docs-board-students.md §2

CREATE TABLE IF NOT EXISTS amb_acm_material_revision (
  mrv_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,
  mat_id            UUID         NOT NULL,
  mrv_seq           INT          NOT NULL,
  mrv_title         VARCHAR(200) NOT NULL,
  mrv_content       TEXT         NOT NULL DEFAULT '',
  mrv_editor_kind   VARCHAR(20)  NOT NULL,
  mrv_editor_ref_id UUID,
  mrv_editor_name   VARCHAR(100) NOT NULL DEFAULT '-',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_material_rev_seq
  ON amb_acm_material_revision (ent_id, mat_id, mrv_seq);

-- 백필: 999e 이후 이미 생성된 DOC 게시글의 현재 본문을 v1 로 기록
-- (작성자 = 수정자, 이름은 강사/학생 테이블에서 조회).
INSERT INTO amb_acm_material_revision
  (ent_id, mat_id, mrv_seq, mrv_title, mrv_content,
   mrv_editor_kind, mrv_editor_ref_id, mrv_editor_name)
SELECT m.ent_id, m.mat_id, 1, m.mat_title, COALESCE(m.mat_content, ''),
       COALESCE(m.mat_author_kind, 'TEACHER'), m.mat_uploaded_by,
       COALESCE(t.tch_name, s.std_name, '-')
  FROM amb_acm_material m
  LEFT JOIN amb_acm_tch_teacher t
    ON t.tch_id = m.mat_uploaded_by AND t.ent_id = m.ent_id
  LEFT JOIN amb_acm_std_student s
    ON s.std_id = m.mat_uploaded_by AND s.ent_id = m.ent_id
 WHERE m.mat_kind = 'DOC' AND m.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM amb_acm_material_revision r WHERE r.mat_id = m.mat_id
   );
