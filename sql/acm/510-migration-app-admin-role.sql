-- ============================================================================
-- ACM v1.0d — APP_ADMIN role + password rotation flag (REQ-260621)
-- @see docs/analysis/REQ-260621-acm-ui-system-admin.md
--
-- Schema-only, safe for ALL environments. The actual system-admin account is
-- provisioned separately:
--   • dev/staging → sql/acm/511-seed-app-admin-dev.sql (temp password)
--   • production  → backend/scripts/gen-app-admin-seed.cjs (env-specific random)
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Widen the role CHECK constraint to include APP_ADMIN ---------------------
ALTER TABLE amb_acm_user DROP CONSTRAINT IF EXISTS chk_acm_user_role;
ALTER TABLE amb_acm_user
  ADD CONSTRAINT chk_acm_user_role
  CHECK (usr_role IN ('ADMIN', 'TEACHER', 'STAFF', 'APP_ADMIN'));

-- 2. Forced password-rotation flag (set on seed / admin reset) ----------------
ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_must_change_password BOOLEAN NOT NULL DEFAULT false;
