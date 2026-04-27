-- ============================================================================
-- ACM v1.0b — CLS Class Management Module
-- Spec: docs/reference/acm-req-cls-001-class-mgmt-requirements.md
-- 10 tables: classes / class_students / recurrence / sessions / attendance /
--            makeups / feedbacks / video_config / settlements / settlement_lines
-- v1.0b excludes external integrations (Google Meet/Bodaschool/GCal) — ENUMs +
-- placeholder columns only; provider abstraction adapter implemented in Phase 2.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CLS Classes — long-running enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_classes (
  cls_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  cls_code                  VARCHAR(50) NOT NULL,
  -- linkage
  cls_inq_id                UUID,                       -- nullable; FK to amb_acm_csl_inquiry
  cls_started_from          VARCHAR(20) NOT NULL DEFAULT 'DIRECT_ENROLLMENT'
                            CHECK (cls_started_from IN ('CSL_PIPELINE','DIRECT_ENROLLMENT','MIGRATION')),
  -- subject
  cls_subject_type          VARCHAR(20) NOT NULL
                            CHECK (cls_subject_type IN
                              ('MAP_TEST','SSAT','ISEE','WRITING','LANGUAGE_ARTS','MATH','INTL_PREP','DEMO','OTHER')),
  cls_subject_label         VARCHAR(200),
  cls_ref_guideline_id      UUID,                       -- FK to amb_acm_ref_class_guidelines (loose ref)
  -- teacher
  cls_teacher_user_id       UUID NOT NULL,
  -- flags
  cls_is_demo               BOOLEAN NOT NULL DEFAULT FALSE,
  cls_is_group              BOOLEAN NOT NULL DEFAULT FALSE,
  cls_is_in_person_default  BOOLEAN NOT NULL DEFAULT FALSE,
  -- status
  cls_status                VARCHAR(20) NOT NULL DEFAULT 'PROPOSED'
                            CHECK (cls_status IN ('PROPOSED','ACTIVE','PAUSED','COMPLETED','CANCELLED')),
  cls_started_at            DATE NOT NULL,
  cls_ended_at              DATE,
  cls_completed_at          DATE,
  cls_visibility            VARCHAR(20) NOT NULL DEFAULT 'ENTITY'
                            CHECK (cls_visibility IN ('ENTITY','CELL','PRIVATE')),
  cls_remark                TEXT,
  -- audit
  cls_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cls_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cls_deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_acm_cls_classes_code UNIQUE (ent_id, cls_code)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_classes_ent_status
  ON amb_acm_cls_classes (ent_id, cls_status) WHERE cls_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_cls_classes_ent_teacher
  ON amb_acm_cls_classes (ent_id, cls_teacher_user_id) WHERE cls_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_cls_classes_inq
  ON amb_acm_cls_classes (cls_inq_id) WHERE cls_inq_id IS NOT NULL;

-- ============================================================================
-- 2. CLS Class Students — N students per class (DEC-5 + per-pair rate DEC-6)
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_class_students (
  cst_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  cls_id                    UUID NOT NULL REFERENCES amb_acm_cls_classes(cls_id) ON DELETE CASCADE,
  cst_student_user_id       UUID NOT NULL,
  cst_hourly_rate           NUMERIC(10,0) NOT NULL,
  cst_capacity_role         VARCHAR(15) NOT NULL DEFAULT 'PRIMARY'
                            CHECK (cst_capacity_role IN ('PRIMARY','GROUP_PEER')),
  cst_enrolled_at           DATE NOT NULL DEFAULT CURRENT_DATE,
  cst_left_at               DATE,
  cst_inq_id                UUID,
  cst_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cst_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_cls_cst_rate CHECK (cst_hourly_rate > 0 AND cst_hourly_rate <= 500000),
  CONSTRAINT chk_acm_cls_cst_dates CHECK (cst_left_at IS NULL OR cst_left_at >= cst_enrolled_at)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_cst_cls ON amb_acm_cls_class_students (cls_id);
CREATE INDEX IF NOT EXISTS idx_acm_cls_cst_student
  ON amb_acm_cls_class_students (ent_id, cst_student_user_id) WHERE cst_left_at IS NULL;

-- ============================================================================
-- 3. CLS Recurrence — weekly recurring pattern
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_recurrence (
  rec_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  cls_id                    UUID NOT NULL REFERENCES amb_acm_cls_classes(cls_id) ON DELETE CASCADE,
  rec_day_of_week           VARCHAR(3) NOT NULL
                            CHECK (rec_day_of_week IN ('MON','TUE','WED','THU','FRI','SAT','SUN')),
  rec_start_time            TIME NOT NULL,
  rec_duration_min          INT NOT NULL,
  rec_default_mode          VARCHAR(25) NOT NULL DEFAULT 'ONLINE'
                            CHECK (rec_default_mode IN ('IN_PERSON','ONLINE','TWO_PERSON_IN_PERSON')),
  rec_effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  rec_effective_to          DATE,
  rec_exceptions            JSONB,                      -- ["YYYY-MM-DD", ...]
  rec_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rec_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_cls_rec_duration CHECK (rec_duration_min BETWEEN 30 AND 480 AND rec_duration_min % 30 = 0)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_rec_cls ON amb_acm_cls_recurrence (cls_id);
CREATE INDEX IF NOT EXISTS idx_acm_cls_rec_active
  ON amb_acm_cls_recurrence (cls_id) WHERE rec_effective_to IS NULL;

-- ============================================================================
-- 4. CLS Sessions — individual occurrence
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_sessions (
  ses_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  cls_id                    UUID NOT NULL REFERENCES amb_acm_cls_classes(cls_id) ON DELETE CASCADE,
  ses_seq_no                INT NOT NULL,
  -- timing
  ses_scheduled_at          TIMESTAMPTZ NOT NULL,
  ses_duration_min          INT NOT NULL,
  ses_held_at               TIMESTAMPTZ,
  ses_actual_minutes        INT,
  -- status
  ses_status                VARCHAR(25) NOT NULL DEFAULT 'SCHEDULED'
                            CHECK (ses_status IN ('SCHEDULED','HELD','CANCELLED','RESCHEDULED','NO_SHOW','MAKEUP_REPLACEMENT')),
  ses_mode                  VARCHAR(25) NOT NULL DEFAULT 'ONLINE'
                            CHECK (ses_mode IN ('IN_PERSON','ONLINE','TWO_PERSON_IN_PERSON','HYBRID')),
  -- cancellation
  ses_cancel_reason         VARCHAR(35)
                            CHECK (ses_cancel_reason IS NULL OR ses_cancel_reason IN
                              ('STUDENT_ABSENCE','STUDENT_ILLNESS','TEACHER_ABSENCE','TEACHER_BUSINESS_TRIP',
                               'TEACHER_CONSULTING_PREP','STUDENT_DAY_OF_CANCEL','FAMILY_TRAVEL','HOLIDAY','OTHER')),
  ses_cancel_note           TEXT,
  ses_cancelled_by          UUID,
  ses_cancelled_at          TIMESTAMPTZ,
  ses_cancel_disposition    VARCHAR(30)
                            CHECK (ses_cancel_disposition IS NULL OR ses_cancel_disposition IN
                              ('MAKEUP_PLANNED','CARRYOVER_TO_NEXT_MONTH','NO_MAKEUP')),
  -- makeup linkage
  ses_is_makeup             BOOLEAN NOT NULL DEFAULT FALSE,
  ses_replaces_ses_id       UUID REFERENCES amb_acm_cls_sessions(ses_id),
  -- video (placeholders, populated by v1.1 integration)
  ses_video_provider        VARCHAR(15) NOT NULL DEFAULT 'NONE'
                            CHECK (ses_video_provider IN ('GOOGLE_MEET','BODASCHOOL','NONE')),
  ses_video_url             VARCHAR(500),
  ses_video_link_sent_at    TIMESTAMPTZ,
  -- gcal (placeholders)
  ses_gcal_event_id         VARCHAR(200),
  ses_gcal_pushed_at        TIMESTAMPTZ,
  ses_gcal_push_status      VARCHAR(15) NOT NULL DEFAULT 'NOT_REQUESTED'
                            CHECK (ses_gcal_push_status IN ('NOT_REQUESTED','PUSHED','FAILED','OUTDATED')),
  -- audit
  ses_modification_count    INT NOT NULL DEFAULT 0,
  ses_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ses_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ses_deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_acm_cls_ses_cls_seq UNIQUE (cls_id, ses_seq_no),
  CONSTRAINT chk_acm_cls_ses_duration CHECK (ses_duration_min BETWEEN 30 AND 480),
  CONSTRAINT chk_acm_cls_ses_cancel CHECK (
    (ses_status NOT IN ('CANCELLED','NO_SHOW')) OR (ses_cancel_reason IS NOT NULL)
  ),
  CONSTRAINT chk_acm_cls_ses_makeup_link CHECK (
    (ses_is_makeup = FALSE) OR (ses_replaces_ses_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_ses_cls_sched
  ON amb_acm_cls_sessions (cls_id, ses_scheduled_at) WHERE ses_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_cls_ses_ent_sched
  ON amb_acm_cls_sessions (ent_id, ses_scheduled_at) WHERE ses_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_cls_ses_status
  ON amb_acm_cls_sessions (ent_id, ses_status, ses_scheduled_at) WHERE ses_deleted_at IS NULL;

-- ============================================================================
-- 5. CLS Attendance — one row per session per student
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_attendance (
  att_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  ses_id                    UUID NOT NULL REFERENCES amb_acm_cls_sessions(ses_id) ON DELETE CASCADE,
  cst_id                    UUID NOT NULL REFERENCES amb_acm_cls_class_students(cst_id) ON DELETE CASCADE,
  att_status                VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
                            CHECK (att_status IN ('PRESENT','ABSENT_EXCUSED','ABSENT_UNEXCUSED','LATE','LEFT_EARLY')),
  att_billable_hours        NUMERIC(3,1) NOT NULL DEFAULT 0,
  att_recorded_by           UUID,
  att_recorded_at           TIMESTAMPTZ,
  att_remark                TEXT,
  att_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  att_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_cls_att_ses_cst UNIQUE (ses_id, cst_id),
  CONSTRAINT chk_acm_cls_att_hours CHECK (att_billable_hours >= 0 AND att_billable_hours <= 10)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_att_cst
  ON amb_acm_cls_attendance (ent_id, cst_id);
CREATE INDEX IF NOT EXISTS idx_acm_cls_att_ses
  ON amb_acm_cls_attendance (ses_id);

-- ============================================================================
-- 6. CLS Makeups — makeup proposal/approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_makeups (
  mkp_id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                          UUID NOT NULL,
  mkp_original_ses_id             UUID NOT NULL REFERENCES amb_acm_cls_sessions(ses_id),
  mkp_makeup_ses_id               UUID REFERENCES amb_acm_cls_sessions(ses_id),
  mkp_substitute_teacher_id       UUID,
  mkp_substitution_approver_id    UUID,
  mkp_proposed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mkp_proposed_by                 UUID,
  mkp_status                      VARCHAR(15) NOT NULL DEFAULT 'PROPOSED'
                                  CHECK (mkp_status IN ('PROPOSED','APPROVED','COMPLETED','CARRIED_OVER','REJECTED')),
  mkp_advisor_id                  UUID,
  mkp_remark                      TEXT,
  mkp_created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mkp_updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_cls_mkp_substitute CHECK (
    (mkp_substitute_teacher_id IS NULL) OR (mkp_substitution_approver_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_mkp_orig ON amb_acm_cls_makeups (mkp_original_ses_id);
CREATE INDEX IF NOT EXISTS idx_acm_cls_mkp_status
  ON amb_acm_cls_makeups (ent_id, mkp_status);

-- ============================================================================
-- 7. CLS Feedbacks — per session per student
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_feedbacks (
  fbk_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  ses_id                    UUID NOT NULL REFERENCES amb_acm_cls_sessions(ses_id) ON DELETE CASCADE,
  fbk_student_user_id       UUID NOT NULL,
  -- content
  fbk_progress              TEXT,
  fbk_feedback              TEXT,
  fbk_homework              TEXT,                 -- standard only
  fbk_weakness_dev          TEXT,                 -- demo only
  fbk_academic_plan         TEXT,                 -- demo only
  -- status
  fbk_written_at            TIMESTAMPTZ,
  fbk_written_by            UUID,
  fbk_status                VARCHAR(25) NOT NULL DEFAULT 'DRAFT'
                            CHECK (fbk_status IN ('DRAFT','SUBMITTED','DELIVERED_TO_PARENT')),
  fbk_sla_breached          BOOLEAN NOT NULL DEFAULT FALSE,
  fbk_delivered_to_parent_at TIMESTAMPTZ,
  fbk_gcal_synced_at        TIMESTAMPTZ,
  -- audit
  fbk_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fbk_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fbk_deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_acm_cls_fbk_ses_student UNIQUE (ses_id, fbk_student_user_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_fbk_ent_status
  ON amb_acm_cls_feedbacks (ent_id, fbk_status) WHERE fbk_deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_cls_fbk_sla
  ON amb_acm_cls_feedbacks (ent_id) WHERE fbk_sla_breached = TRUE AND fbk_deleted_at IS NULL;

-- ============================================================================
-- 8. CLS Video Config — per-class default video provider
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_video_config (
  vcf_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  cls_id                    UUID NOT NULL UNIQUE REFERENCES amb_acm_cls_classes(cls_id) ON DELETE CASCADE,
  vcf_provider              VARCHAR(15) NOT NULL DEFAULT 'GOOGLE_MEET'
                            CHECK (vcf_provider IN ('GOOGLE_MEET','BODASCHOOL')),
  vcf_persistent_link       VARCHAR(500),
  vcf_bodaschool_room_id    VARCHAR(100),
  vcf_gmeet_event_id        VARCHAR(200),
  vcf_changed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vcf_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vcf_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. CLS Settlements — monthly per-teacher settlement header
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_settlements (
  stl_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  stl_teacher_user_id       UUID NOT NULL,
  stl_year_month            VARCHAR(7) NOT NULL,        -- 'YYYY-MM'
  stl_hours_total           NUMERIC(6,1) NOT NULL DEFAULT 0,
  stl_amount_gross          NUMERIC(12,0) NOT NULL DEFAULT 0,
  stl_withholding_rate      NUMERIC(5,4) NOT NULL DEFAULT 0.0330,
  stl_amount_withheld       NUMERIC(12,0) NOT NULL DEFAULT 0,
  stl_amount_after_tax      NUMERIC(12,0) NOT NULL DEFAULT 0,
  stl_status                VARCHAR(25) NOT NULL DEFAULT 'DRAFT'
                            CHECK (stl_status IN ('DRAFT','CONFIRMED','EXPORTED_TO_PAYROLL','PAID')),
  stl_confirmed_by          UUID,
  stl_confirmed_at          TIMESTAMPTZ,
  stl_payroll_export_id     UUID,
  stl_computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stl_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stl_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_cls_stl_teacher_month UNIQUE (ent_id, stl_teacher_user_id, stl_year_month),
  CONSTRAINT chk_acm_cls_stl_year_month CHECK (stl_year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT chk_acm_cls_stl_withholding CHECK (stl_withholding_rate >= 0 AND stl_withholding_rate <= 0.5)
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_stl_ent_month
  ON amb_acm_cls_settlements (ent_id, stl_year_month);

-- ============================================================================
-- 10. CLS Settlement Lines — per attendance line breakdown
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_cls_settlement_lines (
  stl_line_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  stl_id                    UUID NOT NULL REFERENCES amb_acm_cls_settlements(stl_id) ON DELETE CASCADE,
  cls_id                    UUID NOT NULL,
  ses_id                    UUID NOT NULL,
  cst_id                    UUID NOT NULL,
  stl_line_session_date     DATE NOT NULL,
  stl_line_billable_hours   NUMERIC(3,1) NOT NULL,
  stl_line_hourly_rate      NUMERIC(10,0) NOT NULL,
  stl_line_amount           NUMERIC(12,0) NOT NULL,
  stl_line_created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_cls_stl_line_stl
  ON amb_acm_cls_settlement_lines (stl_id);
CREATE INDEX IF NOT EXISTS idx_acm_cls_stl_line_session
  ON amb_acm_cls_settlement_lines (ses_id);
