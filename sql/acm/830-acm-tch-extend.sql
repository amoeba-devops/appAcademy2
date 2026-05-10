-- ============================================================================
-- ACM TCH v1.1 — Teacher list expansion + resume attachments + account lock
-- @see docs/analysis/REQ-260510-acm-tch-list-and-resume.md
--
-- Adds:
--   1. amb_acm_tch_teacher: tch_is_instructor, tch_employment_type,
--      tch_hired_at, tch_attendance_no
--   2. amb_acm_tch_teacher.tch_status CHECK extended:
--      ACTIVE | INACTIVE  →  ACTIVE | LEAVE | RESIGNED
--      (existing INACTIVE rows migrated to RESIGNED)
--   3. amb_acm_user.usr_locked_at  (account lockout)
--   4. amb_acm_tch_attachment      (resume / certificate files)
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1) tch columns ─────────────────────────────────────────────────────────────
ALTER TABLE amb_acm_tch_teacher
  ADD COLUMN IF NOT EXISTS tch_is_instructor   BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tch_employment_type VARCHAR(20) NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS tch_hired_at        DATE,
  ADD COLUMN IF NOT EXISTS tch_attendance_no   VARCHAR(50);

-- employment_type CHECK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'amb_acm_tch_teacher_tch_employment_type_check'
  ) THEN
    ALTER TABLE amb_acm_tch_teacher
      ADD CONSTRAINT amb_acm_tch_teacher_tch_employment_type_check
      CHECK (tch_employment_type IN ('FULL_TIME', 'PART_TIME'));
  END IF;
END $$;

-- 2) status CHECK extension (ACTIVE | LEAVE | RESIGNED) ─────────────────────
-- Migrate legacy INACTIVE → RESIGNED first so the new CHECK passes.
UPDATE amb_acm_tch_teacher
   SET tch_status = 'RESIGNED', updated_at = NOW()
 WHERE tch_status = 'INACTIVE';

DO $$
DECLARE
  cname text;
BEGIN
  -- Drop any existing tch_status CHECK constraint (name varies by Postgres version)
  FOR cname IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class cl ON cl.oid = con.conrelid
     WHERE cl.relname = 'amb_acm_tch_teacher'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%tch_status%'
  LOOP
    EXECUTE format('ALTER TABLE amb_acm_tch_teacher DROP CONSTRAINT %I', cname);
  END LOOP;

  ALTER TABLE amb_acm_tch_teacher
    ADD CONSTRAINT amb_acm_tch_teacher_tch_status_check
    CHECK (tch_status IN ('ACTIVE', 'LEAVE', 'RESIGNED'));
END $$;

-- 3) user lock column ───────────────────────────────────────────────────────
ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_locked_at TIMESTAMPTZ;

-- 4) attachment table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amb_acm_tch_attachment (
  att_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  tch_id              UUID         NOT NULL REFERENCES amb_acm_tch_teacher(tch_id) ON DELETE CASCADE,

  att_original_name   VARCHAR(255) NOT NULL,
  att_mime            VARCHAR(100) NOT NULL,
  att_size_bytes      BIGINT       NOT NULL,
  att_storage_path    VARCHAR(500) NOT NULL,           -- relative: {entId}/{tchId}/{attId}.{ext}
  att_kind            VARCHAR(30)  NOT NULL DEFAULT 'RESUME',  -- RESUME | CERTIFICATE | OTHER

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by          UUID,
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_tch_att_ent_tch
  ON amb_acm_tch_attachment (ent_id, tch_id)
  WHERE deleted_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'amb_acm_tch_attachment_kind_check'
  ) THEN
    ALTER TABLE amb_acm_tch_attachment
      ADD CONSTRAINT amb_acm_tch_attachment_kind_check
      CHECK (att_kind IN ('RESUME', 'CERTIFICATE', 'OTHER'));
  END IF;
END $$;
