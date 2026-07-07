-- PLN-260708 — tenant login code (slug) for portal tenant-scoped login.
--
-- The portal login (`/portal/auth/login`) resolves the loginId within a tenant
-- identified by this short code (URL `?t=<code>` or the login-form field), so
-- per-tenant-unique loginIds no longer collide across tenants.
--
-- @see docs/plan/PLN-260708-portal-tenant-scoped-login.md §4.1

ALTER TABLE amb_acm_tenant
  ADD COLUMN IF NOT EXISTS tnt_code VARCHAR(40);

-- Unique when set (nullable rows allowed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_tenant_code
  ON amb_acm_tenant (tnt_code)
  WHERE tnt_code IS NOT NULL;

-- Seed the TPI tenant's login code.
UPDATE amb_acm_tenant
SET tnt_code = 'tpi', updated_at = now()
WHERE tnt_ent_id = '00000000-0000-0000-0000-000000000001'
  AND tnt_code IS NULL;
