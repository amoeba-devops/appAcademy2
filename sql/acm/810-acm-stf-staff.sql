-- ============================================================================
-- ACM STF v1.0 — Staff Management (직원관리)
-- @see docs/analysis/REQ-260506-acm-tch-stf-cal.md
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_stf_staff (
  stf_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,

  -- 인적사항
  stf_name            VARCHAR(100) NOT NULL,
  stf_english_name    VARCHAR(100),
  stf_email           VARCHAR(200) NOT NULL,
  stf_phone           VARCHAR(30),

  -- 직무
  stf_position        VARCHAR(100),
  stf_department      VARCHAR(100),
  stf_hired_at        DATE,

  -- 메모
  stf_memo            TEXT,

  -- 로그인 계정 연계
  stf_user_id         UUID         REFERENCES amb_acm_user(usr_id) ON DELETE SET NULL,

  -- 상태
  stf_status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (stf_status IN ('ACTIVE', 'INACTIVE')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_stf_ent_status
  ON amb_acm_stf_staff (ent_id, stf_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_stf_user
  ON amb_acm_stf_staff (stf_user_id)
  WHERE stf_user_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_stf_ent_email'
  ) THEN
    ALTER TABLE amb_acm_stf_staff
      ADD CONSTRAINT uq_acm_stf_ent_email UNIQUE (ent_id, stf_email);
  END IF;
END $$;
