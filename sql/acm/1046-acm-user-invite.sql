-- ============================================================================
-- REQ-261018 — 서비스 운영자의 사용자 초대(관리자·직원). 링크 72시간·1회용, 토큰은 sha256 만 저장.
-- 멱등.
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_user_invite (
  inv_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  inv_email           VARCHAR(200) NOT NULL,
  inv_name            VARCHAR(100) NOT NULL,
  inv_role            VARCHAR(20)  NOT NULL CHECK (inv_role IN ('ADMIN','STAFF')),
  inv_grant_config_admin BOOLEAN   NOT NULL DEFAULT false,
  inv_token_hash      CHAR(64)     NOT NULL,
  inv_status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING' CHECK (inv_status IN ('PENDING','ACCEPTED','REVOKED')),
  inv_expires_at      TIMESTAMPTZ  NOT NULL,
  inv_mail_sent       BOOLEAN      NOT NULL DEFAULT false,
  invited_by          UUID,
  accepted_usr_id     UUID,
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_inv_token ON amb_acm_user_invite (inv_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_inv_pending_email
  ON amb_acm_user_invite (ent_id, lower(inv_email)) WHERE inv_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_acm_inv_ent_status ON amb_acm_user_invite (ent_id, inv_status, created_at DESC);
DROP TRIGGER IF EXISTS trg_acm_inv_updated_at ON amb_acm_user_invite;
CREATE TRIGGER trg_acm_inv_updated_at BEFORE UPDATE ON amb_acm_user_invite
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
