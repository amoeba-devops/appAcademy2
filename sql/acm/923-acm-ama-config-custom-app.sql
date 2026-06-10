-- ============================================================================
-- ACM — AMA 연동 설정: Custom App 로컬 검증 정보  — 2026-06-10
-- @see docs/analysis/REQ-260609D-ama-custom-app-local-config.md
--
-- local_config 모드: 사이드바가 발급하는 Custom App 토큰(custom_app:context, HS256)을
-- /admin/config 에 입력한 secret + expectedScope 로 ACM 이 직접 로컬 검증한다.
--   amc_custom_app_secret_enc : HS256 서명 검증용 secret (AES-GCM 암호화 BYTEA)
--                               포맷 [iv(12)][authTag(16)][ciphertext] (ACM_PII_KEY)
--   amc_expected_scope        : 기대 scope (예 'custom_app:context'), 평문 비교용
--
-- Idempotent. Target: ACM PostgreSQL.
-- ============================================================================

ALTER TABLE amb_acm_ama_config
  ADD COLUMN IF NOT EXISTS amc_custom_app_secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS amc_expected_scope        VARCHAR(60);
