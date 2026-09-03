-- 1007 — REQ-260903B: 학생 담당강사 복수선택 (N:M 조인 테이블 + 기존 단일 FK 백필)
-- 기존 std_teacher_id/std_teacher 컬럼은 호환용 미러로 유지(대표=첫번째 강사).
-- Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_std_student_teacher (
  st_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  std_id        UUID NOT NULL REFERENCES amb_acm_std_student(std_id) ON DELETE CASCADE,
  tch_id        UUID NOT NULL REFERENCES amb_acm_tch_teacher(tch_id) ON DELETE CASCADE,
  st_sort_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_std_st_pair UNIQUE (std_id, tch_id)
);

CREATE INDEX IF NOT EXISTS idx_acm_std_st_ent_tch
  ON amb_acm_std_student_teacher (ent_id, tch_id);

DROP TRIGGER IF EXISTS trg_acm_std_st_updated_at ON amb_acm_std_student_teacher;
CREATE TRIGGER trg_acm_std_st_updated_at
  BEFORE UPDATE ON amb_acm_std_student_teacher
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 백필: 기존 단일 담당강사(std_teacher_id) → 조인 테이블 (멱등)
INSERT INTO amb_acm_std_student_teacher (ent_id, std_id, tch_id, st_sort_order)
SELECT s.ent_id, s.std_id, s.std_teacher_id, 0
  FROM amb_acm_std_student s
  JOIN amb_acm_tch_teacher t ON t.tch_id = s.std_teacher_id
 WHERE s.std_teacher_id IS NOT NULL
   AND s.deleted_at IS NULL
ON CONFLICT (std_id, tch_id) DO NOTHING;
