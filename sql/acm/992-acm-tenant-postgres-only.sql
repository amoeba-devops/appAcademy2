-- ============================================================================
-- ACM — PostgreSQL-only tenant subscription/cache fields
-- Date: 2026-07-04
--
-- Stores AMA entity and subscription cache fields directly on amb_acm_tenant.
-- Idempotent. Target: ACM PostgreSQL.
-- ============================================================================

ALTER TABLE amb_acm_tenant
  ADD COLUMN IF NOT EXISTS tnt_ama_entity_id        VARCHAR(80),
  ADD COLUMN IF NOT EXISTS tnt_ama_entity_code      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS tnt_subscription_status  VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS tnt_subscription_plan    VARCHAR(80),
  ADD COLUMN IF NOT EXISTS tnt_canceled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tnt_deprovisioned_at     TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_tenant_ama_entity
  ON amb_acm_tenant (tnt_ama_entity_id)
  WHERE tnt_ama_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acm_tenant_subscription_status
  ON amb_acm_tenant (tnt_subscription_status);

-- Backfill from existing PostgreSQL AMA config where available.
UPDATE amb_acm_tenant t
SET
  tnt_ama_entity_id = COALESCE(t.tnt_ama_entity_id, c.amc_ama_entity_id),
  updated_at = NOW()
FROM amb_acm_ama_config c
WHERE c.ent_id = t.tnt_ent_id
  AND c.amc_is_active = TRUE
  AND t.tnt_ama_entity_id IS NULL;

UPDATE amb_acm_tenant
SET tnt_ama_entity_code = COALESCE(tnt_ama_entity_code, 'VN3040')
WHERE tnt_ent_id = '00000000-0000-0000-0000-000000000001';
