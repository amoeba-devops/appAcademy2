-- ============================================================================
-- ACM v1.0a — Auth (login users)  — 2026-05-03
-- @see docs/analysis/ACM-AUTH-REQ-1.0.0.md
-- Adds: amb_acm_user table + seed admin (admin@acm.local / acm20261234)
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_user (
  usr_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  usr_email           VARCHAR(200) NOT NULL,
  usr_password_hash   VARCHAR(120) NOT NULL,
  usr_name            VARCHAR(100) NOT NULL,
  usr_status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  usr_last_login_at   TIMESTAMPTZ  NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_acm_user_ent_email UNIQUE (ent_id, usr_email)
);

CREATE INDEX IF NOT EXISTS idx_acm_user_email_status
  ON amb_acm_user (usr_email, usr_status);

-- Seed admin operator (staging / dev). Must rotate before production.
-- Password: acm20261234  (bcrypt rounds 12)
INSERT INTO amb_acm_user (ent_id, usr_email, usr_password_hash, usr_name, usr_status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@acm.local',
  '$2b$12$6szKyUcXX6Zgt9/o3M/k9OUz01iCbqr6Y7VMMj6SKPGiDBrTfZ0Ka',
  'ACM Admin',
  'ACTIVE'
)
ON CONFLICT (ent_id, usr_email) DO NOTHING;
