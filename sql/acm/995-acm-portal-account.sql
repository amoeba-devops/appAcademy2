-- PLN-260706 — Portal accounts (student / parent / teacher portal login)
--
-- System-generated login_id + bcrypt password. Admin issues a temporary
-- password (pac_must_change_password = TRUE) that the user rotates on first
-- login. Exactly one credential per (kind, ref_id) per tenant.
--
-- @see docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md §4.1

CREATE TABLE IF NOT EXISTS amb_acm_portal_account (
  pac_id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id                   UUID         NOT NULL,
  pac_kind                 VARCHAR(10)  NOT NULL,
  pac_ref_id               UUID         NOT NULL,
  pac_login_id             VARCHAR(200) NOT NULL,  -- PLN-260714: 이메일 로그인ID 수용
  pac_password_hash        VARCHAR(120) NOT NULL,
  pac_must_change_password BOOLEAN      NOT NULL DEFAULT TRUE,
  pac_status               VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  pac_last_login_at        TIMESTAMPTZ,
  pac_locked_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_pac_kind
    CHECK (pac_kind IN ('STUDENT', 'PARENT', 'TEACHER')),
  CONSTRAINT chk_acm_pac_status
    CHECK (pac_status IN ('ACTIVE', 'INACTIVE')),
  -- login id is the username → unique within a tenant
  CONSTRAINT uq_acm_pac_login
    UNIQUE (ent_id, pac_login_id),
  -- one portal credential per subject (student/parent/teacher)
  CONSTRAINT uq_acm_pac_ref
    UNIQUE (ent_id, pac_kind, pac_ref_id)
);
