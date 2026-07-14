-- 1001-acm-csl-cancel-reason-simple.sql
-- PLN-260714 — 상담종료(구 완료처리) 사유에 '단순문의종료'(SIMPLE_INQUIRY_END) 추가.
--   cnc_reason_code 의 IN-list CHECK 제약만 교체(chk_acm_csl_cnc_other 는 보존).
--   IN-list 제약은 정의에 'ACADEMY_CANCELLED' 를 포함하므로 그것으로 식별. idempotent.

DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT c.conname INTO v_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'amb_acm_csl_cancellation'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%ACADEMY_CANCELLED%';

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE amb_acm_csl_cancellation DROP CONSTRAINT %I', v_name);
    RAISE NOTICE 'Dropped constraint: %', v_name;
  END IF;
END
$$;

ALTER TABLE amb_acm_csl_cancellation
  ADD CONSTRAINT chk_acm_csl_cnc_reason_code
  CHECK (cnc_reason_code IN
    ('SIMPLE_INQUIRY_END','ACADEMY_CANCELLED','STUDENT_ILLNESS',
     'STUDENT_SCHEDULE_CHANGE','PAYMENT_DECLINED','LOST_TO_COMPETITOR','OTHER'));
