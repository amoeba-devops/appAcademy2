-- 1009 — REQ-260903E: 테넌트별 카카오 알림톡(Solapi) 설정
-- API Secret 은 AES-256-GCM [iv|tag|ct] BYTEA (mail_config 패턴).
-- Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_kakao_config (
  kkc_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id             UUID NOT NULL,
  kkc_api_key        VARCHAR(100),
  kkc_api_secret_enc BYTEA,
  kkc_pf_id          VARCHAR(60),
  kkc_template_id    VARCHAR(60),
  kkc_sender_phone   VARCHAR(20),
  kkc_sms_fallback   BOOLEAN NOT NULL DEFAULT FALSE,
  kkc_is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_kakao_config_ent UNIQUE (ent_id)
);

DROP TRIGGER IF EXISTS trg_acm_kakao_config_updated_at ON amb_acm_kakao_config;
CREATE TRIGGER trg_acm_kakao_config_updated_at
  BEFORE UPDATE ON amb_acm_kakao_config
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
