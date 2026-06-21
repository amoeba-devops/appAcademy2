-- ============================================================================
-- ACM v1.0d — System administrator seed — DEV / STAGING ONLY (REQ-260621)
-- @see docs/analysis/REQ-260621-acm-ui-system-admin.md
--
-- ⚠️  DO NOT APPLY TO PRODUCTION. The password below is a shared temporary
--     credential committed to the repo. For production use
--     backend/scripts/gen-app-admin-seed.cjs to generate an environment-
--     specific random password.
--
-- Email:    admin@amoeba.group
-- Password: temp@2026  (bcrypt rounds 12)
-- Role:     APP_ADMIN
-- Tenant:   00000000-0000-0000-0000-0000000000ff  (dedicated SYSTEM tenant —
--           intentionally NOT the TPI tenant …01, so the system admin holds no
--           tenant-scoped data and acts only on /system/*).
--
-- usr_must_change_password = true → the account is blocked from /acm/system/*
-- actions (RequirePasswordRotationGuard) and the UI forces a change until the
-- operator rotates the password on first login.
--
-- Requires sql/acm/510-migration-app-admin-role.sql first. Idempotent.
-- ============================================================================

INSERT INTO amb_acm_user (
  ent_id, usr_email, usr_password_hash, usr_name, usr_status, usr_role,
  auth_source, usr_must_change_password
)
VALUES (
  '00000000-0000-0000-0000-0000000000ff',
  'admin@amoeba.group',
  '$2b$12$7YJIg0yE8S04xPIrcLMZ8ujuSJNXctXuoOnjw83bKrUZcJPTVjbVa',
  'Amoeba System Admin',
  'ACTIVE',
  'APP_ADMIN',
  'local',
  true
)
ON CONFLICT (ent_id, usr_email) DO NOTHING;
