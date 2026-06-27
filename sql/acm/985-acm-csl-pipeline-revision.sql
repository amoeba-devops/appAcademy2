-- ============================================================================
-- ACM v1.x — CSL Pipeline Revision (DSN-260626)
--
--   Stage relabel + field re-arrangement + new sub-data for:
--     1 INTAKE        : MAP prior scores already in map_test; + transcript files
--     2 LEVEL TEST    : generalize map_test (test_type, time, JSONB, result-by, CAL)
--     3 DEMO CLASS    : trial_class teacher/time/material/feedback delivery
--     4 ENROLLMENT    : counsel memo, course, session count, start/end, multi-teacher
--     5 PAYMENT       : (no schema change — policy only; uses enr_tuition_paid)
--
--   Internal stage enum (INTAKE..CLASS_STARTED) UNCHANGED (Q-CSL-110).
--   Deprecated columns kept (not dropped) for back-compat:
--     amb_acm_csl_map_test.mpt_scheduled_status   (FR-CSL-107)
--     amb_acm_csl_trial_class.tcl_feedback_status (FR-CSL-124)
--
-- @see docs/design/DSN-260626-acm-csl-pipeline-revision.md
-- @see docs/analysis/REQ-260626-acm-csl-pipeline-revision.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) amb_acm_csl_map_test — generalize to LEVEL TEST  (FR-CSL-111~116, 102, 107)
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_csl_map_test
  ADD COLUMN IF NOT EXISTS mpt_test_type        VARCHAR(20)  NOT NULL DEFAULT 'MAP',
  ADD COLUMN IF NOT EXISTS mpt_test_type_other  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mpt_scheduled_time   TIME,
  ADD COLUMN IF NOT EXISTS mpt_cal_event_id     UUID,
  ADD COLUMN IF NOT EXISTS mpt_score_detail     JSONB,
  ADD COLUMN IF NOT EXISTS mpt_result_entered_by UUID,
  ADD COLUMN IF NOT EXISTS mpt_result_entered_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_map_test
    ADD CONSTRAINT chk_acm_csl_mpt_test_type
    CHECK (mpt_test_type IN ('MAP','ISEE','SSAT','DUOLINGO','TOEFL','TOEFL_JR','OTHER'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- MAP score range 100~350 (per "시험별 점수표" — Reading / Language Usage / Math)
-- Non-MAP test scores live in mpt_score_detail JSONB (schema per DSN §5.6).
DO $$ BEGIN
  ALTER TABLE amb_acm_csl_map_test
    ADD CONSTRAINT chk_acm_csl_mpt_map_score_range
    CHECK (
      (mpt_score_reading  IS NULL OR mpt_score_reading  BETWEEN 100 AND 350) AND
      (mpt_score_math     IS NULL OR mpt_score_math     BETWEEN 100 AND 350) AND
      (mpt_score_language IS NULL OR mpt_score_language BETWEEN 100 AND 350)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN amb_acm_csl_map_test.mpt_score_detail IS
  'Non-MAP scores keyed by test type (ISEE/SSAT/DUOLINGO/TOEFL/TOEFL_JR). Schema: DSN-260626 §5.6';

-- 30-min granularity for scheduled time (FR-CSL-113)
DO $$ BEGIN
  ALTER TABLE amb_acm_csl_map_test
    ADD CONSTRAINT chk_acm_csl_mpt_time_30min
    CHECK (mpt_scheduled_time IS NULL
           OR EXTRACT(MINUTE FROM mpt_scheduled_time) IN (0,30));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN amb_acm_csl_map_test.mpt_scheduled_status IS
  'DEPRECATED (FR-CSL-107) — no longer written; kept for back-compat';

-- ----------------------------------------------------------------------------
-- 2) amb_acm_csl_trial_class — DEMO CLASS  (FR-CSL-122~128, 124)
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_csl_trial_class
  ADD COLUMN IF NOT EXISTS tcl_held_time           TIME,
  ADD COLUMN IF NOT EXISTS tcl_teacher_id          UUID,
  ADD COLUMN IF NOT EXISTS tcl_completed           BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tcl_feedback_body       TEXT,
  ADD COLUMN IF NOT EXISTS tcl_feedback_authored_by  UUID,
  ADD COLUMN IF NOT EXISTS tcl_feedback_authored_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tcl_feedback_confirmed_by UUID,
  ADD COLUMN IF NOT EXISTS tcl_feedback_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tcl_feedback_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tcl_cal_event_id        UUID;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_trial_class
    ADD CONSTRAINT fk_acm_csl_tcl_teacher
    FOREIGN KEY (tcl_teacher_id) REFERENCES amb_acm_tch_teacher(tch_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_trial_class
    ADD CONSTRAINT chk_acm_csl_tcl_time_30min
    CHECK (tcl_held_time IS NULL
           OR EXTRACT(MINUTE FROM tcl_held_time) IN (0,30));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_acm_csl_tcl_teacher
  ON amb_acm_csl_trial_class (ent_id, tcl_teacher_id);

COMMENT ON COLUMN amb_acm_csl_trial_class.tcl_feedback_status IS
  'DEPRECATED (FR-CSL-124) — replaced by tcl_completed + feedback_* columns';

-- ----------------------------------------------------------------------------
-- 3) amb_acm_csl_enrollment — ENROLLMENT COUNSELING  (FR-CSL-131~135)
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_csl_enrollment
  ADD COLUMN IF NOT EXISTS enr_counsel_memo    TEXT,
  ADD COLUMN IF NOT EXISTS enr_course_id       UUID,
  ADD COLUMN IF NOT EXISTS enr_course_freetext VARCHAR(100),
  ADD COLUMN IF NOT EXISTS enr_session_count   INT,
  ADD COLUMN IF NOT EXISTS enr_start_date      DATE,
  ADD COLUMN IF NOT EXISTS enr_end_date        DATE;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_enrollment
    ADD CONSTRAINT chk_acm_csl_enr_session_count
    CHECK (enr_session_count IS NULL OR enr_session_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_enrollment
    ADD CONSTRAINT chk_acm_csl_enr_date_order
    CHECK (enr_start_date IS NULL OR enr_end_date IS NULL
           OR enr_end_date >= enr_start_date);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4) amb_acm_csl_course — course master (per-tenant)  (FR-CSL-132 / Q-CSL-109)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_csl_course (
  crs_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID         NOT NULL,
  crs_code      VARCHAR(40)  NOT NULL,
  crs_name      VARCHAR(100) NOT NULL,
  crs_is_active BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_csl_course_ent_code UNIQUE (ent_id, crs_code)
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_course_ent_active
  ON amb_acm_csl_course (ent_id, crs_is_active);

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_enrollment
    ADD CONSTRAINT fk_acm_csl_enr_course
    FOREIGN KEY (enr_course_id) REFERENCES amb_acm_csl_course(crs_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5) amb_acm_csl_attachment — transcripts / materials / result PDFs
--    (FR-CSL-105, 126, 116)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_csl_attachment (
  att_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  inq_id          UUID         NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  att_category    VARCHAR(20)  NOT NULL,
  att_ref_id      UUID,                       -- e.g. tcl_id for MATERIAL, mpt_id for RESULT_PDF
  att_s3_key      VARCHAR(500) NOT NULL,
  att_filename    VARCHAR(255) NOT NULL,
  att_mime        VARCHAR(100) NOT NULL,
  att_size_bytes  BIGINT       NOT NULL,
  att_visibility  VARCHAR(20)  NOT NULL DEFAULT 'STAFF_ONLY',
  att_uploaded_by UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT chk_acm_csl_att_category
    CHECK (att_category IN ('TRANSCRIPT','MATERIAL','RESULT_PDF')),
  CONSTRAINT chk_acm_csl_att_visibility
    CHECK (att_visibility IN ('STAFF_ONLY','TEACHER_STUDENT')),
  CONSTRAINT chk_acm_csl_att_mime
    CHECK (att_mime IN ('application/pdf','image/jpeg','image/png')),
  CONSTRAINT chk_acm_csl_att_size
    CHECK (att_size_bytes > 0 AND att_size_bytes <= 10485760)   -- 10MB (Q-CSL-106)
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_att_inq_category
  ON amb_acm_csl_attachment (ent_id, inq_id, att_category);
CREATE INDEX IF NOT EXISTS idx_acm_csl_att_ref
  ON amb_acm_csl_attachment (att_ref_id);

-- ----------------------------------------------------------------------------
-- 6) amb_acm_csl_teacher_assignment — enrollment multi-teacher (FR-CSL-136)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_csl_teacher_assignment (
  asg_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  inq_id          UUID         NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  tch_id          UUID         NOT NULL REFERENCES amb_acm_tch_teacher(tch_id),
  asg_role        VARCHAR(20)  NOT NULL DEFAULT 'PRIMARY',
  asg_assigned_by UUID,
  asg_assigned_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_csl_asg_inq_tch UNIQUE (inq_id, tch_id),
  CONSTRAINT chk_acm_csl_asg_role CHECK (asg_role IN ('PRIMARY','SECONDARY'))
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_asg_inq
  ON amb_acm_csl_teacher_assignment (ent_id, inq_id);

-- ----------------------------------------------------------------------------
-- 7) updated_at triggers (reuse set_acm_updated_at, sql/acm/910)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_csl_course_updated_at ON amb_acm_csl_course;
CREATE TRIGGER trg_acm_csl_course_updated_at
  BEFORE UPDATE ON amb_acm_csl_course
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
