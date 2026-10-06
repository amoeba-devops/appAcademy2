-- ============================================================================
-- REQ-261006 / PLN-261006 — ACM 알림 → AMA 알림 전달 (Option A)
--   1. amb_acm_ama_config: 전달 on/off, 전달 이벤트 종류, 켠 시각
--   2. amb_acm_ama_notification_forward: outbox 1건 ↔ 전달 1행 (상태·재시도·응답)
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_ama_config
  ADD COLUMN IF NOT EXISTS amc_forward_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS amc_forward_types      TEXT    NOT NULL DEFAULT 'CSL_CREATED,CSL_STAGE',
  ADD COLUMN IF NOT EXISTS amc_forward_enabled_at TIMESTAMPTZ;

COMMENT ON COLUMN amb_acm_ama_config.amc_forward_enabled    IS 'REQ-261006 AMA 알림 전달 on/off';
COMMENT ON COLUMN amb_acm_ama_config.amc_forward_types      IS 'REQ-261006 전달 대상 outbox 이벤트 종류 CSV (CSL_CREATED,CSL_STAGE,CAL_CREATED,CAL_UPDATED,CHAT_MENTION)';
COMMENT ON COLUMN amb_acm_ama_config.amc_forward_enabled_at IS 'REQ-261006 켠 시각 — 이 시각 이후 발생한 이벤트만 전달(과거 폭주 방지)';

CREATE TABLE IF NOT EXISTS amb_acm_ama_notification_forward (
  anf_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  nob_id              UUID         NOT NULL REFERENCES amb_acm_notification_outbox(nob_id),
  anf_type            VARCHAR(32)  NOT NULL,
  anf_target_id       UUID         NOT NULL,
  anf_payload         JSONB        NOT NULL DEFAULT '{}',
  anf_recipients      JSONB        NOT NULL DEFAULT '[]',   -- AMA user ids
  anf_dedupe_key      VARCHAR(200) NOT NULL,
  anf_status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                      CHECK (anf_status IN ('PENDING','SENT','FAILED','SKIPPED')),
  anf_attempts        SMALLINT     NOT NULL DEFAULT 0,
  anf_next_attempt_at TIMESTAMPTZ,
  anf_response        JSONB,
  anf_error           VARCHAR(500),
  anf_sent_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_ama_fwd_nob UNIQUE (nob_id),
  CONSTRAINT uq_acm_ama_fwd_dedupe UNIQUE (ent_id, anf_dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_acm_ama_fwd_pending
  ON amb_acm_ama_notification_forward (anf_next_attempt_at, created_at)
  WHERE anf_status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_acm_ama_fwd_ent_created
  ON amb_acm_ama_notification_forward (ent_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_acm_ama_fwd_updated_at ON amb_acm_ama_notification_forward;
CREATE TRIGGER trg_acm_ama_fwd_updated_at
  BEFORE UPDATE ON amb_acm_ama_notification_forward
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
