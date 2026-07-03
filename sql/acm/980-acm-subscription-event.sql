-- ============================================================================
-- ACM v1.0g — AMA Subscription Event Ledger (REQ-260622 Phase 1 T1-07)
--
-- Defines PostgreSQL AMA webhook event ledger for idempotency + lifecycle audit.
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.7
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_subscription_event (
  sub_id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id            BIGINT       UNIQUE,
  ent_id               UUID,
  sub_ama_tenant_id    VARCHAR(64)  NOT NULL,
  sub_event_type       VARCHAR(40)  NOT NULL,
  sub_plan             VARCHAR(60),
  sub_nonce            VARCHAR(64)  NOT NULL,
  sub_signature        VARCHAR(128) NOT NULL,
  sub_event_at         TIMESTAMPTZ  NOT NULL,
  sub_payload          JSONB        NOT NULL,
  sub_processed_at     TIMESTAMPTZ,
  sub_processing_error TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_subscription_event_type
    CHECK (sub_event_type IN (
      'SUBSCRIPTION_CREATED','ACTIVATED','SUSPENDED','RESUMED',
      'CANCELED','PLAN_CHANGED'
    )),
  CONSTRAINT uq_acm_subscription_event_nonce
    UNIQUE (sub_nonce)
);

CREATE INDEX IF NOT EXISTS idx_acm_subscription_event_ent
  ON amb_acm_subscription_event (ent_id, sub_event_at DESC)
  WHERE ent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acm_subscription_event_ama_tenant
  ON amb_acm_subscription_event (sub_ama_tenant_id, sub_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_subscription_event_type_at
  ON amb_acm_subscription_event (sub_event_type, sub_event_at DESC);
-- 미처리 이벤트 추적 (worker pickup)
CREATE INDEX IF NOT EXISTS idx_acm_subscription_event_pending
  ON amb_acm_subscription_event (created_at)
  WHERE sub_processed_at IS NULL;

-- append-only — updated_at trigger 불요.
