-- ============================================================================
-- REQ-260921B / PLN-260921B — 상담 등록 개선
--   1. inq_kind      : 구분 (TUTORING=튜터링 상담 | MAP_TEST=맵테스트)
--   2. inq_birthdate : 생년월일 (상담 본체; 맵테스트 부속 mpa_birthdate 와 동일 값 유지)
--   3. inq_gender    : 성별 ('M' | 'F')
--   4. grade         : VARCHAR(10) → VARCHAR(40) (자유 입력 — 실데이터 잘림 해소)
--   5. map_apply.mpa_origin 에 'CONSOLE' 허용 (콘솔에서 구분=맵테스트로 등록한 건)
--   6. 백필: 부속 행 있음 또는 EXAM_ONLY → MAP_TEST, 생년월일·성별 ← map_apply
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_kind      VARCHAR(20) NOT NULL DEFAULT 'TUTORING',
  ADD COLUMN IF NOT EXISTS inq_birthdate DATE,
  ADD COLUMN IF NOT EXISTS inq_gender    VARCHAR(10);

ALTER TABLE amb_acm_csl_inquiry ALTER COLUMN grade TYPE VARCHAR(40);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_inq_kind') THEN
    ALTER TABLE amb_acm_csl_inquiry
      ADD CONSTRAINT chk_acm_csl_inq_kind CHECK (inq_kind IN ('TUTORING', 'MAP_TEST'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_inq_gender') THEN
    ALTER TABLE amb_acm_csl_inquiry
      ADD CONSTRAINT chk_acm_csl_inq_gender CHECK (inq_gender IS NULL OR inq_gender IN ('M', 'F'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_kind ON amb_acm_csl_inquiry (ent_id, inq_kind);

COMMENT ON COLUMN amb_acm_csl_inquiry.inq_kind      IS 'REQ-260921B 구분: TUTORING(튜터링 상담) | MAP_TEST(맵테스트)';
COMMENT ON COLUMN amb_acm_csl_inquiry.inq_birthdate IS 'REQ-260921B 생년월일 (맵테스트 부속 mpa_birthdate 와 동기)';
COMMENT ON COLUMN amb_acm_csl_inquiry.inq_gender    IS 'REQ-260921B 성별 M|F (맵테스트 부속 mpa_gender 와 동기)';

-- 맵테스트 부속 행 출처에 콘솔 등록 추가
ALTER TABLE amb_acm_csl_map_apply DROP CONSTRAINT IF EXISTS chk_acm_csl_map_apply_origin;
ALTER TABLE amb_acm_csl_map_apply
  ADD CONSTRAINT chk_acm_csl_map_apply_origin CHECK (mpa_origin IN ('WEB', 'IMPORT', 'CONSOLE'));
COMMENT ON COLUMN amb_acm_csl_map_apply.mpa_origin IS 'WEB=아임웹 /test2 접수, IMPORT=아임웹 누적 CSV 이관, CONSOLE=콘솔 구분=맵테스트 등록';

-- 백필 (멱등: 이미 MAP_TEST 인 행은 건드리지 않는다)
UPDATE amb_acm_csl_inquiry i
   SET inq_kind = 'MAP_TEST'
 WHERE i.inq_kind = 'TUTORING'
   AND (i.inq_apply_type = 'EXAM_ONLY'
        OR EXISTS (SELECT 1 FROM amb_acm_csl_map_apply m WHERE m.inq_id = i.inq_id));

UPDATE amb_acm_csl_inquiry i
   SET inq_birthdate = m.mpa_birthdate
  FROM amb_acm_csl_map_apply m
 WHERE m.inq_id = i.inq_id AND i.inq_birthdate IS NULL AND m.mpa_birthdate IS NOT NULL;

UPDATE amb_acm_csl_inquiry i
   SET inq_gender = m.mpa_gender
  FROM amb_acm_csl_map_apply m
 WHERE m.inq_id = i.inq_id AND i.inq_gender IS NULL AND m.mpa_gender IS NOT NULL;
