-- 1005 — REQ-260902B: 테넌트별 메일(SMTP) 설정 (관리자 /admin/config/mail)
-- Gmail SMTP 1차 대상. 비밀번호(앱 비밀번호)는 AES-256-GCM [iv|tag|ct] BYTEA.
-- Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_mail_config (
  mlc_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  mlc_host         VARCHAR(200) NOT NULL DEFAULT 'smtp.gmail.com',
  mlc_port         INTEGER NOT NULL DEFAULT 587,
  mlc_secure       BOOLEAN NOT NULL DEFAULT FALSE,
  mlc_username     VARCHAR(200),
  mlc_password_enc BYTEA,
  mlc_from_name    VARCHAR(100),
  mlc_from_address VARCHAR(200),
  mlc_is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_mail_config_ent UNIQUE (ent_id)
);

DROP TRIGGER IF EXISTS trg_acm_mail_config_updated_at ON amb_acm_mail_config;
CREATE TRIGGER trg_acm_mail_config_updated_at
  BEFORE UPDATE ON amb_acm_mail_config
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
