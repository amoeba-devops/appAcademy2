-- ============================================================================
-- ACM v1.0e — Tenant registry + per-tenant menu visibility (REQ-260621 v1.1)
-- @see docs/analysis/REQ-260621-acm-ui-system-admin.md
--
-- Adds an ACM-side tenant registry (display name / status) and a per-tenant
-- admin-menu visibility table consumed by the admin sidebar.
--
-- ⚠️  Apply BEFORE deploying the code that references these tables/entities,
--     or the system-admin queries will fail (manual-apply on staging/prod).
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Tenant registry ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_tenant (
  tnt_ent_id     UUID         PRIMARY KEY,
  tnt_name       VARCHAR(200) NOT NULL,
  tnt_status     VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  tnt_is_system  BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_acm_tenant_status CHECK (tnt_status IN ('ACTIVE', 'INACTIVE'))
);

-- 2. Per-tenant admin-menu visibility ----------------------------------------
-- Absence of a row for a (ent_id, menu_key) means VISIBLE (backward compatible).
-- Only explicit overrides are stored.
CREATE TABLE IF NOT EXISTS amb_acm_tenant_menu (
  tnm_ent_id   UUID         NOT NULL,
  tnm_menu_key VARCHAR(40)  NOT NULL,
  tnm_visible  BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (tnm_ent_id, tnm_menu_key)
);

CREATE INDEX IF NOT EXISTS idx_acm_tenant_menu_ent ON amb_acm_tenant_menu (tnm_ent_id);

-- 3. Seed known tenants ------------------------------------------------------
INSERT INTO amb_acm_tenant (tnt_ent_id, tnt_name, tnt_status, tnt_is_system)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Trinity Academy', 'ACTIVE', false),
  ('00000000-0000-0000-0000-0000000000ff', 'System',          'ACTIVE', true)
ON CONFLICT (tnt_ent_id) DO NOTHING;
