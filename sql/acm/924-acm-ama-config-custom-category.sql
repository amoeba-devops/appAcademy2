-- ============================================================================
-- ACM — AMA 연동 설정: Custom Category 로컬 검증 정보  — 2026-06-10
-- @see docs/bug-fix/FIX-260610-ama-customapp-entid-resolution.md (후속)
-- @see docs/analysis/REQ-260609D-ama-custom-app-local-config.md
--
-- AMA 커스텀카테고리(/menu/<slug>) 진입 토큰은 커스텀앱과 별개 통합이라
-- **서명 secret 이 다르고** scope/식별자 클레임도 다르다:
--   scope     custom_category:context   (앱은 custom_app:context)
--   식별자     eccSlug / eccId            (앱은 appCode)
-- local_config 검증기가 토큰 scope 로 어느 secret 을 쓸지 분기하도록, 카테고리
-- 전용 secret + 기대 slug 컬럼을 추가한다. 둘 다 nullable → 기존 앱 설정 무영향.
--   amc_category_secret_enc : 카테고리 HS256 서명 검증용 secret (AES-GCM BYTEA)
--                             포맷 [iv(12)][authTag(16)][ciphertext] (ACM_PII_KEY)
--   amc_category_slug       : 기대 eccSlug (예 'tpi-academy'), 평문 비교용
--
-- Idempotent. Target: ACM PostgreSQL.
-- ============================================================================

ALTER TABLE amb_acm_ama_config
  ADD COLUMN IF NOT EXISTS amc_category_secret_enc BYTEA,
  ADD COLUMN IF NOT EXISTS amc_category_slug       VARCHAR(60);
