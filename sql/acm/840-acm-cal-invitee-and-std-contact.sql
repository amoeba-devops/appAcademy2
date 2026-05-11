-- ============================================================================
-- 840 — ACM Calendar Invitees + Student Email/Parents
-- @see docs/analysis/REQ-260511-cal-invitee-and-std-contact.md
-- @see docs/plan/PLN-260511-cal-invitee-and-std-contact.md
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1: Add std_email column to existing student table
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_email VARCHAR(200);


-- ----------------------------------------------------------------------------
-- A2: Parent (guardian) entity
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_std_parent (
  par_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  par_name      VARCHAR(100) NOT NULL,
  par_relation  VARCHAR(20),                 -- MOTHER|FATHER|GUARDIAN|OTHER (free text)
  par_phone     VARCHAR(30),
  par_email     VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_std_par_ent
  ON amb_acm_std_parent (ent_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_std_par_name_trgm
  ON amb_acm_std_parent USING GIN (par_name gin_trgm_ops);


-- ----------------------------------------------------------------------------
-- A3: Student ↔ Parent N:M mapping
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_std_student_parent (
  sp_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id         UUID NOT NULL,
  std_id         UUID NOT NULL REFERENCES amb_acm_std_student(std_id) ON DELETE CASCADE,
  par_id         UUID NOT NULL REFERENCES amb_acm_std_parent(par_id)  ON DELETE CASCADE,
  sp_is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_std_sp_pair'
  ) THEN
    ALTER TABLE amb_acm_std_student_parent
      ADD CONSTRAINT uq_acm_std_sp_pair UNIQUE (std_id, par_id);
  END IF;
END $$;

-- Only one primary guardian per student (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_std_sp_primary
  ON amb_acm_std_student_parent (std_id) WHERE sp_is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_acm_std_sp_par
  ON amb_acm_std_student_parent (par_id);


-- ----------------------------------------------------------------------------
-- A4: Calendar invitees (polymorphic: STUDENT / TEACHER / PARENT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_cal_invitee (
  inv_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID NOT NULL,
  evt_id            UUID NOT NULL REFERENCES amb_acm_cal_event(evt_id) ON DELETE CASCADE,
  inv_kind          VARCHAR(10) NOT NULL
                    CHECK (inv_kind IN ('STUDENT','TEACHER','PARENT')),
  inv_ref_id        UUID NOT NULL,             -- std_id | tch_id | par_id (polymorphic)
  inv_notified_at   TIMESTAMPTZ,
  inv_notify_status VARCHAR(20)
                    CHECK (inv_notify_status IS NULL OR inv_notify_status IN
                           ('SENT','SKIPPED_NO_EMAIL','SKIPPED_NO_SMTP','FAILED')),
  inv_notify_error  VARCHAR(200),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_cal_invitee_evt_kind_ref'
  ) THEN
    ALTER TABLE amb_acm_cal_invitee
      ADD CONSTRAINT uq_acm_cal_invitee_evt_kind_ref
      UNIQUE (evt_id, inv_kind, inv_ref_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_cal_inv_ent_evt
  ON amb_acm_cal_invitee (ent_id, evt_id);

CREATE INDEX IF NOT EXISTS idx_acm_cal_inv_ref
  ON amb_acm_cal_invitee (inv_kind, inv_ref_id);


-- ============================================================================
-- End of 840
-- ============================================================================
