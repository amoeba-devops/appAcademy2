-- 1004-acm-std-teacher-fk-ensure.sql
-- PLN-260714 — 담당강사 정규화 FK(std_teacher_id) 보장.
--   StudentTypeormEntity 가 std_teacher_id 를 매핑하므로 이 컬럼/FK 가 없으면
--   학생 생성/수정이 500(column does not exist)으로 실패한다. 940 마이그레이션이
--   이미 적용된 환경이면 IF NOT EXISTS 로 전부 no-op. idempotent.

ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_teacher_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acm_std_teacher_id'
  ) THEN
    ALTER TABLE amb_acm_std_student
      ADD CONSTRAINT fk_acm_std_teacher_id
      FOREIGN KEY (std_teacher_id)
      REFERENCES amb_acm_tch_teacher(tch_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_std_ent_teacher
  ON amb_acm_std_student (ent_id, std_teacher_id)
  WHERE deleted_at IS NULL AND std_teacher_id IS NOT NULL;
