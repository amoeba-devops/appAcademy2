-- ============================================================================
-- ACM v1.0g — Notification 모듈 PG 스키마 (REQ-260622 Phase 1 T1-03)
--
-- Migrates tac_notification_templates + tac_notification_logs (MySQL) to PG.
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.3
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Templates — 알림 템플릿 (Email / AmoebaTalk / SMS, locale별)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_notification_template (
  ntp_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id     BIGINT       UNIQUE,
  ent_id        UUID         NOT NULL,
  ntp_code      VARCHAR(40)  NOT NULL,
  ntp_channel   VARCHAR(20)  NOT NULL,
  ntp_locale    VARCHAR(10)  NOT NULL DEFAULT 'ko',
  ntp_subject   VARCHAR(200),
  ntp_body_text TEXT,
  ntp_body_html TEXT,
  ntp_is_active BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_notification_template_channel
    CHECK (ntp_channel IN ('EMAIL','AMOEBATALK','SMS')),
  CONSTRAINT uq_acm_notification_template_code
    UNIQUE (ent_id, ntp_code, ntp_channel, ntp_locale)
);


-- ----------------------------------------------------------------------------
-- 2) Logs — 알림 발송 이력 (대용량, BRIN 시계열)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_notification_log (
  ntl_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         BIGINT       UNIQUE,
  ent_id            UUID         NOT NULL,
  ntp_code          VARCHAR(40),
  ntl_channel       VARCHAR(20)  NOT NULL,
  ntl_recipient_kind VARCHAR(20),
  ntl_recipient_id  UUID,
  ntl_to_address    VARCHAR(200),
  ntl_subject       VARCHAR(200),
  ntl_body_summary  VARCHAR(500),
  ntl_status        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  ntl_error         VARCHAR(500),
  ntl_sent_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_notification_log_status
    CHECK (ntl_status IN ('PENDING','SENT','FAILED','SKIPPED'))
);

-- BRIN for high-volume time-series scans (NFR-MYSQL-OUT-6).
CREATE INDEX IF NOT EXISTS brin_acm_notification_log_created
  ON amb_acm_notification_log USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_acm_notification_log_recipient
  ON amb_acm_notification_log (ent_id, ntl_recipient_kind, ntl_recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_notification_log_status
  ON amb_acm_notification_log (ent_id, ntl_status, created_at DESC)
  WHERE ntl_status IN ('PENDING','FAILED');


-- ----------------------------------------------------------------------------
-- 3) updated_at trigger (templates 만 — log 는 append-only)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_notification_template_updated_at ON amb_acm_notification_template;
CREATE TRIGGER trg_acm_notification_template_updated_at
  BEFORE UPDATE ON amb_acm_notification_template
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
