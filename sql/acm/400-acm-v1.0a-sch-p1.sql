-- ============================================================================
-- ACM v1.0a — SCH P1 Migration
-- @see docs/analysis/acm-fn-sch-qna-p1-requirements.md
-- @see docs/implementation/tasks/acm-fn-sch-qna-p1-plan.md (T-S-01)
-- Adds: amb_acm_sch_school.is_authorized column,
--       amb_acm_sch_grade_band, amb_acm_sch_schedule tables.
-- Idempotent (uses IF NOT EXISTS).
-- ============================================================================

-- 1. School authorization flag (AC-SCH-02)
ALTER TABLE amb_acm_sch_school
  ADD COLUMN IF NOT EXISTS is_authorized BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Grade Bands (S-10..S-13)
CREATE TABLE IF NOT EXISTS amb_acm_sch_grade_band (
  gbd_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id           UUID NOT NULL,
  sch_id           UUID NOT NULL REFERENCES amb_acm_sch_school(sch_id) ON DELETE CASCADE,
  gbd_label        VARCHAR(80)  NOT NULL,
  gbd_grade_min    SMALLINT     NOT NULL,
  gbd_grade_max    SMALLINT     NOT NULL,
  gbd_note         TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT chk_acm_sch_gbd_grade_range CHECK (gbd_grade_min <= gbd_grade_max)
);
CREATE INDEX IF NOT EXISTS idx_acm_sch_gbd_ent_sch
  ON amb_acm_sch_grade_band (ent_id, sch_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_sch_gbd_ent_sch_label
  ON amb_acm_sch_grade_band (ent_id, sch_id, gbd_label) WHERE deleted_at IS NULL;

-- 3. Schedules (S-20..S-23)
CREATE TABLE IF NOT EXISTS amb_acm_sch_schedule (
  sched_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id           UUID NOT NULL,
  sch_id           UUID NOT NULL REFERENCES amb_acm_sch_school(sch_id) ON DELETE CASCADE,
  sched_year       SMALLINT     NOT NULL,
  sched_type       VARCHAR(20)  NOT NULL CHECK (sched_type IN ('REGULAR','ROLLING','ED','EA','OTHER')),
  sched_open_date  DATE,
  sched_close_date DATE,
  sched_test_date  DATE,
  sched_result_date DATE,
  sched_note       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_sch_schedule_ent_sch
  ON amb_acm_sch_schedule (ent_id, sch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_sch_schedule_ent_year
  ON amb_acm_sch_schedule (ent_id, sched_year) WHERE deleted_at IS NULL;
