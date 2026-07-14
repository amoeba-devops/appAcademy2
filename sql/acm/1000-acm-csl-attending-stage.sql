-- 1000-acm-csl-attending-stage.sql
-- PLN-260714 — CSL 7단계 '수강중'(ATTENDING) 상태 추가.
--   inq_current_stage CHECK 제약에 'ATTENDING' 허용값을 추가한다.
--   기존 인라인(익명) CHECK 제약을 제거하고 명명 제약으로 재생성. idempotent.

DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT c.conname INTO v_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'amb_acm_csl_inquiry'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%inq_current_stage%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE amb_acm_csl_inquiry DROP CONSTRAINT %I', v_name);
    RAISE NOTICE 'Dropped constraint: %', v_name;
  END IF;
END
$$;

ALTER TABLE amb_acm_csl_inquiry
  ADD CONSTRAINT chk_acm_csl_inq_current_stage
  CHECK (inq_current_stage IN
    ('INTAKE','MAP_TEST','TRIAL_CLASS','ENROLLMENT_COUNSELING',
     'PAYMENT','CLASS_STARTED','ATTENDING','DROPPED'));
