-- ============================================================================
-- ACM v1.0a — AMA Custom App SSO  — 2026-05-05
-- @see docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md
-- @see docs/implementation/PLAN-260505-acm-ama-sso.md
--
-- Adds AMA-source columns to amb_acm_user and relaxes password_hash to allow
-- AMA-provisioned users (auth_source='ama') to be created without a password.
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS ama_user_id   UUID         NULL,
  ADD COLUMN IF NOT EXISTS ama_entity_id UUID         NULL,
  ADD COLUMN IF NOT EXISTS ama_role      VARCHAR(40)  NULL,
  ADD COLUMN IF NOT EXISTS auth_source   VARCHAR(16)  NOT NULL DEFAULT 'local';

-- Allow NULL password_hash for AMA-provisioned users.
ALTER TABLE amb_acm_user
  ALTER COLUMN usr_password_hash DROP NOT NULL;

-- Unique mapping per (ent_id, ama_user_id) when set.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_user_ent_ama_user
  ON amb_acm_user (ent_id, ama_user_id)
  WHERE ama_user_id IS NOT NULL;

-- Index for lookup by AMA user id during exchange.
CREATE INDEX IF NOT EXISTS idx_acm_user_ama_user
  ON amb_acm_user (ama_user_id)
  WHERE ama_user_id IS NOT NULL;
