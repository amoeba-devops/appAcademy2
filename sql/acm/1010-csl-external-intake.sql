-- 1010-csl-external-intake.sql  (REQ-260903G / PLN-260903G)
-- 외부 사이트(아임웹 3사이트) 상담접수 API 지원:
--   1. inq_inflow_type CHECK 확장 — 'WEB_EXTERNAL' 추가
--   2. inq_source_site 컬럼 추가 — 외부 접수 출처 사이트 코드 (TPI / TRINITY / SANTACROCE)
-- 멱등: 재실행 안전 (제약은 이름 조회 후 drop → 고정 이름으로 재생성, 컬럼은 IF NOT EXISTS)

-- 1) inflow CHECK 확장
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname INTO v_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'amb_acm_csl_inquiry'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%inq_inflow_type%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE amb_acm_csl_inquiry DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
  END IF;

  ALTER TABLE amb_acm_csl_inquiry
    ADD CONSTRAINT ck_acm_csl_inq_inflow_type
    CHECK (inq_inflow_type IN ('HOMEPAGE','KAKAO_CHANNEL','PHONE','WEB_EXTERNAL'));
END
$$;

-- 2) 출처 사이트 코드 (WEB_EXTERNAL 접수 시에만 세팅, 기존 행 NULL)
ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_source_site VARCHAR(20);

COMMENT ON COLUMN amb_acm_csl_inquiry.inq_source_site IS
  'REQ-260903G — external intake source site code (TPI/TRINITY/SANTACROCE); NULL for non-WEB_EXTERNAL rows';
