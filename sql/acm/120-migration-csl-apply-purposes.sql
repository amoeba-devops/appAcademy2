-- 120-migration-csl-apply-purposes.sql
-- 신청목적(inq_apply_purpose) 컬럼 변경:
--   1. CHECK 제약 제거 (단일 ENUM → 복수 선택 쉼표구분 문자열)
--   2. VARCHAR(32) → TEXT (길이 제한 제거)
-- 새 목적 5항목: MAP_TEST_TUTORING, ISEE_TUTORING, INTL_SCHOOL_PREP, GPA_MGMT, ADVANCED_COURSES
-- 저장 형식 예: 'MAP_TEST_TUTORING,GPA_MGMT'
-- 기존 데이터 보존: 구버전 값(MAP_SCORE_UP, STD_TEST_PREP, OTHER 등)은 NULL로 초기화

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- 1) inq_apply_purpose 에 걸린 CHECK 제약 이름 조회
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'amb_acm_csl_inquiry'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%inq_apply_purpose%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE amb_acm_csl_inquiry DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
  ELSE
    RAISE NOTICE 'No CHECK constraint found on inq_apply_purpose — skipping drop';
  END IF;
END
$$;

-- 2) 컬럼 타입 TEXT로 변경 (VARCHAR(32) → TEXT)
ALTER TABLE amb_acm_csl_inquiry
  ALTER COLUMN inq_apply_purpose TYPE TEXT;

-- 3) 기존 데이터 정리: 새 목적 코드에 없는 값은 NULL로 초기화
UPDATE amb_acm_csl_inquiry
SET inq_apply_purpose = NULL
WHERE inq_apply_purpose IS NOT NULL
  AND inq_apply_purpose NOT IN (
    'MAP_TEST_TUTORING',
    'ISEE_TUTORING',
    'INTL_SCHOOL_PREP',
    'GPA_MGMT',
    'ADVANCED_COURSES'
  );
