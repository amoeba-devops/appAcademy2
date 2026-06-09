-- ============================================================================
-- ACM — AMA 연동 설정 (entityId · appCode) 어드민 관리  — 2026-06-09
-- @see docs/analysis/REQ-260609B-ama-integration-config.md
-- @see docs/plan/PLN-260609B-ama-integration-config.md
--
-- `tpi-acm` 은 TPI 전용 앱이다. AMA 커스텀앱 SSO 토큰이 싣고 오는 법인정보
-- (entityId, appCode) 를 어드민이 /admin/config 에서 등록한 값과 비교하여,
-- 일치할 때만 로그인을 허용한다 (FR-3). 값은 비밀이 아닌 비교용 공개 식별자
-- 이므로 평문 저장한다 (결정 2026-06-09).
--
-- 1 row per (ent_id). 로그인 게이트는 amc_ama_entity_id(=토큰 entityId)로 조회.
-- Idempotent. Target: ACM PostgreSQL.
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_ama_config (
  amc_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,

  -- JWT entityId 와 비교할 값 (AMA 법인 entityId UUID, 평문)
  amc_ama_entity_id VARCHAR(80)  NOT NULL,
  -- JWT appCode 와 비교할 값 (커스텀앱 등록 시 작성한 앱 이름, 예 'tpi-acm')
  amc_app_code      VARCHAR(60)  NOT NULL,

  -- false 면 이 설정으로의 로그인을 전면 차단 (fail-closed)
  amc_is_active     BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- 어드민 CRUD 스코프 (테넌트당 1행) + 로그인 게이트 조회 키 유일성
  CONSTRAINT uq_acm_ama_config_ent    UNIQUE (ent_id),
  CONSTRAINT uq_acm_ama_config_entity UNIQUE (amc_ama_entity_id)
);

-- 로그인 게이트 조회: WHERE amc_ama_entity_id = :tokenEntityId AND amc_is_active
CREATE INDEX IF NOT EXISTS idx_acm_ama_config_lookup
  ON amb_acm_ama_config (amc_ama_entity_id, amc_is_active);
