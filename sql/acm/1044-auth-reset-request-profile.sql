-- REQ-261017 — 비밀번호 재발급 요청·임시 비밀번호 만료, 마이페이지(비상연락망·자기소개).
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.

-- 1) 콘솔 계정: 임시 비밀번호 만료 시각 + 마이페이지 항목.
--    비상연락처 전화번호는 개인정보 → AES-GCM 3필드(NFR-005).
ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_temp_password_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usr_emergency_name            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS usr_emergency_relation        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS usr_emergency_phone_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS usr_emergency_phone_iv        BYTEA,
  ADD COLUMN IF NOT EXISTS usr_emergency_phone_auth_tag  BYTEA,
  ADD COLUMN IF NOT EXISTS usr_bio                       VARCHAR(1000);

-- 2) 비밀번호 재발급 요청. 사용자당 처리 대기(REQUESTED)는 1건만(다시 요청하면 시각만 갱신).
CREATE TABLE IF NOT EXISTS amb_acm_password_reset_request (
  prr_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID NOT NULL,
  usr_id            UUID NOT NULL,
  prr_status        VARCHAR(10) NOT NULL DEFAULT 'REQUESTED'
                    CHECK (prr_status IN ('REQUESTED', 'ISSUED', 'REJECTED')),
  prr_requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prr_ip_hash       VARCHAR(64),
  prr_mail_sent     BOOLEAN,
  handled_by        UUID,
  handled_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_prr_pending
  ON amb_acm_password_reset_request (ent_id, usr_id) WHERE prr_status = 'REQUESTED';
CREATE INDEX IF NOT EXISTS idx_acm_prr_ent_status
  ON amb_acm_password_reset_request (ent_id, prr_status, prr_requested_at DESC);
DROP TRIGGER IF EXISTS trg_acm_prr_updated_at ON amb_acm_password_reset_request;
CREATE TRIGGER trg_acm_prr_updated_at BEFORE UPDATE ON amb_acm_password_reset_request
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 3) 알림 종류: 재발급 요청 → 테넌트 관리자 알림함.
ALTER TABLE amb_acm_notification_outbox DROP CONSTRAINT IF EXISTS amb_acm_notification_outbox_nob_type_check;
ALTER TABLE amb_acm_notification_outbox ADD CONSTRAINT amb_acm_notification_outbox_nob_type_check
  CHECK (nob_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','CHAT_MENTION','CHAT_MESSAGE','REVIEW_OVERDUE','ISSUE_MENTION','PASSWORD_RESET_REQUEST'));
