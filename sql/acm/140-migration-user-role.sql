-- ============================================================================
-- ACM v1.0c — usr_role column (TCH/STF/CAL prerequisite)
-- @see docs/analysis/REQ-260506-acm-tch-stf-cal.md
-- Idempotent. Safe to re-run.
-- ============================================================================

ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_role VARCHAR(20) NOT NULL DEFAULT 'ADMIN';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_user_role'
  ) THEN
    ALTER TABLE amb_acm_user
      ADD CONSTRAINT chk_acm_user_role
      CHECK (usr_role IN ('ADMIN', 'TEACHER', 'STAFF'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_user_ent_role
  ON amb_acm_user (ent_id, usr_role);
