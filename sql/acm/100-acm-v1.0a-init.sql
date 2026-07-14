-- ============================================================================
-- ACM v1.0a — PostgreSQL Initial Schema
-- @see docs/design/acm-v1.0a-erd.md
-- @see docs/design/acm-v1.0a-adr-001.md (ADR-003, ADR-004, ADR-005, ADR-008)
-- Target DB: db_amb (shared with AMB Core), table prefix: amb_acm_*
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- ADR-008 SCH autocomplete
CREATE EXTENSION IF NOT EXISTS "pg_bigm";   -- ADR-008 QNA Korean fulltext (optional)

-- ============================================================================
-- 1. SCH — School Master
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_sch_school (
  sch_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id        UUID NOT NULL,
  name          VARCHAR(100) NOT NULL,
  level         VARCHAR(16)  NOT NULL CHECK (level IN ('ELEMENTARY','MIDDLE','HIGH','FOREIGN')),
  region        VARCHAR(50),
  district      VARCHAR(50),
  is_foreign    BOOLEAN      NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_sch_school_ent
  ON amb_acm_sch_school (ent_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_sch_school_ent_name
  ON amb_acm_sch_school (ent_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_sch_school_name_trgm
  ON amb_acm_sch_school USING GIN (name gin_trgm_ops);

-- ============================================================================
-- 2. REF — Reference Materials (per acm-req-ref-001 v1.0)
--    5 tables: class_guidelines, level_test_guides, score_benchmarks,
--    score_benchmark_grades (N:N), score_benchmark_modifiers.
--    Per-update versioning per Q-003 / ADR-006.
-- ============================================================================

-- Drop legacy single-table impl if present
DROP TABLE IF EXISTS amb_acm_ref_reference CASCADE;

-- 2.1 Class Guidelines (Sub-domain A — workflow per exam type)
CREATE TABLE IF NOT EXISTS amb_acm_ref_class_guidelines (
  cgd_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  cgd_code                VARCHAR(50) NOT NULL,
  cgd_exam_type           VARCHAR(30) NOT NULL
                          CHECK (cgd_exam_type IN
                            ('MAP_TEST','SSAT','ISEE','WRITING_COMP','SUMMER_CAMP',
                             'JUNIOR_BOARDING','BOARDING','INTL_SCHOOL_APP','OTHER')),
  cgd_label_kr            VARCHAR(200) NOT NULL,
  cgd_label_en            VARCHAR(200),
  cgd_workflow_steps      JSONB,                 -- [{step_num, role, description}]
  cgd_remark              TEXT,
  cgd_data_status         VARCHAR(20) NOT NULL DEFAULT 'PLACEHOLDER'
                          CHECK (cgd_data_status IN ('COMPLETE','PARTIAL','PLACEHOLDER')),
  cgd_version_no          INT  NOT NULL DEFAULT 1,
  cgd_effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  cgd_effective_to        DATE,
  cgd_supersedes_id       UUID REFERENCES amb_acm_ref_class_guidelines(cgd_id),
  cgd_last_reviewed_at    TIMESTAMPTZ,
  cgd_last_reviewed_by    UUID,
  cgd_created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cgd_updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cgd_deleted_at          TIMESTAMPTZ,
  CONSTRAINT uq_acm_ref_cgd_code_version UNIQUE (ent_id, cgd_code, cgd_version_no)
);
CREATE INDEX IF NOT EXISTS idx_acm_ref_cgd_active
  ON amb_acm_ref_class_guidelines (ent_id, cgd_exam_type)
  WHERE cgd_effective_to IS NULL AND cgd_deleted_at IS NULL;

-- 2.2 Level Test Guides (Sub-domain B — ISEE/SSAT level test materials)
CREATE TABLE IF NOT EXISTS amb_acm_ref_level_test_guides (
  lvl_id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                    UUID NOT NULL,
  lvl_exam_type             VARCHAR(30) NOT NULL
                            CHECK (lvl_exam_type IN
                              ('ISEE_LEVEL_TEST','SSAT_LEVEL_TEST','OTHER')),
  lvl_grade_basis           VARCHAR(20) NOT NULL
                            CHECK (lvl_grade_basis IN ('TARGET_GRADE','CURRENT_GRADE')),
  lvl_assignment_rule_text  TEXT,
  lvl_resource_url          VARCHAR(500),
  lvl_resource_type         VARCHAR(20) NOT NULL DEFAULT 'EXTERNAL_LINK'
                            CHECK (lvl_resource_type IN
                              ('DRIVE_FOLDER','EXTERNAL_LINK','INTERNAL_DOC')),
  lvl_resource_note         TEXT,
  lvl_procedure_steps       JSONB,
  lvl_default_duration_min  INT,
  lvl_version_no            INT  NOT NULL DEFAULT 1,
  lvl_effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  lvl_effective_to          DATE,
  lvl_supersedes_id         UUID REFERENCES amb_acm_ref_level_test_guides(lvl_id),
  lvl_last_reviewed_at      TIMESTAMPTZ,
  lvl_last_reviewed_by      UUID,
  lvl_created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lvl_updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lvl_deleted_at            TIMESTAMPTZ,
  CONSTRAINT uq_acm_ref_lvl_type_version UNIQUE (ent_id, lvl_exam_type, lvl_version_no)
);
CREATE INDEX IF NOT EXISTS idx_acm_ref_lvl_active
  ON amb_acm_ref_level_test_guides (ent_id, lvl_exam_type)
  WHERE lvl_effective_to IS NULL AND lvl_deleted_at IS NULL;

-- 2.3 Score Benchmarks (MAP / ISEE / SSAT — unified)
CREATE TABLE IF NOT EXISTS amb_acm_ref_score_benchmarks (
  sbm_id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                       UUID NOT NULL,
  sbm_code                     VARCHAR(50) NOT NULL,
  sbm_exam_type                VARCHAR(10) NOT NULL
                               CHECK (sbm_exam_type IN ('MAP','ISEE','SSAT')),
  sbm_level_label              VARCHAR(50) NOT NULL,
  -- MAP fields
  sbm_map_reading_score        NUMERIC(5,1),
  sbm_map_math_score           NUMERIC(5,1),
  sbm_map_no_upper_bound       BOOLEAN NOT NULL DEFAULT FALSE,
  -- ISEE / SSAT fields
  sbm_general_pct              NUMERIC(5,2),
  sbm_general_stanine          VARCHAR(20),
  sbm_premium_private_pct      NUMERIC(5,2),
  sbm_premium_private_stanine  VARCHAR(20),
  sbm_top_boarding_pct         NUMERIC(5,2),
  sbm_top_boarding_stanine     VARCHAR(20),
  -- data quality
  sbm_data_status              VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
                               CHECK (sbm_data_status IN ('COMPLETE','INHERITED_FROM','PLACEHOLDER')),
  sbm_inherits_from_sbm_id     UUID REFERENCES amb_acm_ref_score_benchmarks(sbm_id),
  -- versioning
  sbm_version_no               INT  NOT NULL DEFAULT 1,
  sbm_effective_from           DATE NOT NULL DEFAULT CURRENT_DATE,
  sbm_effective_to             DATE,
  sbm_supersedes_id            UUID REFERENCES amb_acm_ref_score_benchmarks(sbm_id),
  sbm_last_reviewed_at         TIMESTAMPTZ,
  sbm_last_reviewed_by         UUID,
  sbm_created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sbm_updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sbm_deleted_at               TIMESTAMPTZ,
  CONSTRAINT uq_acm_ref_sbm_code_version UNIQUE (ent_id, sbm_code, sbm_version_no),
  CONSTRAINT chk_acm_ref_sbm_inherit
    CHECK ((sbm_data_status = 'INHERITED_FROM') = (sbm_inherits_from_sbm_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_acm_ref_sbm_active
  ON amb_acm_ref_score_benchmarks (ent_id, sbm_exam_type)
  WHERE sbm_effective_to IS NULL AND sbm_deleted_at IS NULL;

-- 2.4 Score Benchmark ↔ Grade (N:N — Level may map to multiple grades)
CREATE TABLE IF NOT EXISTS amb_acm_ref_score_benchmark_grades (
  sbg_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  sbm_id                  UUID NOT NULL REFERENCES amb_acm_ref_score_benchmarks(sbm_id) ON DELETE CASCADE,
  sbg_grade_label         VARCHAR(10) NOT NULL,
  sbg_grade_min           INT NOT NULL,
  sbg_grade_max           INT NOT NULL,
  sbg_curriculum_system   VARCHAR(20) NOT NULL DEFAULT 'US_GRADE'
                          CHECK (sbg_curriculum_system IN ('UK_YEAR','US_GRADE','KOREAN','MIXED')),
  CONSTRAINT chk_acm_ref_sbg_range CHECK (sbg_grade_min <= sbg_grade_max)
);
CREATE INDEX IF NOT EXISTS idx_acm_ref_sbg_lookup
  ON amb_acm_ref_score_benchmark_grades (ent_id, sbg_grade_min, sbg_grade_max);
CREATE INDEX IF NOT EXISTS idx_acm_ref_sbg_sbm
  ON amb_acm_ref_score_benchmark_grades (sbm_id);

-- 2.5 Score Benchmark Modifiers (foreign-school adjustment, etc.)
CREATE TABLE IF NOT EXISTS amb_acm_ref_score_benchmark_modifiers (
  sbf_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                UUID NOT NULL,
  sbm_id                UUID REFERENCES amb_acm_ref_score_benchmarks(sbm_id) ON DELETE CASCADE,
  sbf_modifier_type     VARCHAR(30) NOT NULL
                        CHECK (sbf_modifier_type IN
                          ('FOREIGN_SCHOOL','INTERNATIONAL_BOARDING','OTHER')),
  sbf_adjustment_min    NUMERIC(5,1) NOT NULL,
  sbf_adjustment_max    NUMERIC(5,1) NOT NULL,
  sbf_unit              VARCHAR(20) NOT NULL DEFAULT 'POINTS'
                        CHECK (sbf_unit IN ('POINTS','PERCENTILE')),
  sbf_description       TEXT,
  sbf_effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  sbf_effective_to      DATE,
  sbf_created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sbf_updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_ref_sbf_range CHECK (sbf_adjustment_min <= sbf_adjustment_max)
);
CREATE INDEX IF NOT EXISTS idx_acm_ref_sbf_active
  ON amb_acm_ref_score_benchmark_modifiers (ent_id, sbf_modifier_type)
  WHERE sbf_effective_to IS NULL;

-- ============================================================================
-- 3. CSL — New Consultation (per acm-req-csl-001 v2.1)
--    25-field model spread across 5 tables + 3 audit/log tables.
--    AES-GCM PII per ADR-005. Append-only stage history & remarks.
-- ============================================================================

-- 3.1 Main inquiry table (F-01 ~ F-09 + meta + current stage)
CREATE TABLE IF NOT EXISTS amb_acm_csl_inquiry (
  inq_id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                       UUID NOT NULL,
  inq_seq_no                   INT  NOT NULL,                          -- F-01 per-tenant sequence
  inq_registered_at            DATE NOT NULL DEFAULT CURRENT_DATE,     -- F-02
  inq_followup_at              DATE,                                   -- F-03 (date)
  inq_followup_memo            TEXT,                                   -- F-03 (free text — channel hints)
  -- F-04 name (encrypted) + anonymous flag
  inq_name_encrypted           BYTEA NOT NULL,
  inq_name_iv                  BYTEA NOT NULL,
  inq_name_auth_tag            BYTEA NOT NULL,
  inq_is_anonymous             BOOLEAN NOT NULL DEFAULT FALSE,
  -- F-05 phone (encrypted) + status enum
  inq_phone_encrypted          BYTEA,
  inq_phone_iv                 BYTEA,
  inq_phone_auth_tag           BYTEA,
  inq_phone_status             VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN'
                               CHECK (inq_phone_status IN ('PROVIDED','DECLINED','UNKNOWN')),
  -- F-06 inflow type
  inq_inflow_type              VARCHAR(20) NOT NULL
                               CHECK (inq_inflow_type IN ('HOMEPAGE','KAKAO_CHANNEL','PHONE')),
  -- F-07 apply type (Q-CSL-009)
  inq_apply_type               VARCHAR(20) NOT NULL
                               CHECK (inq_apply_type IN ('COUNSELING_ONLY','EXAM_ONLY','BOTH')),
  -- F-08 apply purpose
  inq_apply_purpose            VARCHAR(32)
                               CHECK (inq_apply_purpose IS NULL OR inq_apply_purpose IN
                                 ('INTL_SCHOOL_PREP','MAP_SCORE_UP','STD_TEST_PREP','GPA_MGMT','OTHER')),
  inq_apply_purpose_other      TEXT,                                   -- when purpose = OTHER
  -- F-09 consult done
  inq_consult_done             VARCHAR(8)
                               CHECK (inq_consult_done IS NULL OR inq_consult_done IN ('YES','NO')),
  -- School (link or freetext)
  school_id                    UUID REFERENCES amb_acm_sch_school(sch_id),
  school_freetext              VARCHAR(100),
  grade                        VARCHAR(10),
  -- Pipeline state (6-stage + DROPPED)
  inq_current_stage            VARCHAR(32) NOT NULL DEFAULT 'INTAKE'
                               CHECK (inq_current_stage IN
                                 ('INTAKE','MAP_TEST','TRIAL_CLASS','ENROLLMENT_COUNSELING',
                                  'PAYMENT','CLASS_STARTED','ATTENDING','DROPPED')),
  inq_previous_stage           VARCHAR(32),
  -- Ownership / lifecycle
  advisor_id                   UUID,
  channel_legacy               VARCHAR(20),                            -- legacy free-text channel hint
  enrolled_at                  TIMESTAMPTZ,
  closed_at                    TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ,
  CONSTRAINT chk_acm_csl_inq_school CHECK (school_id IS NOT NULL OR school_freetext IS NOT NULL),
  CONSTRAINT uq_acm_csl_inq_seq UNIQUE (ent_id, inq_seq_no)
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_ent_stage
  ON amb_acm_csl_inquiry (ent_id, inq_current_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_ent_registered
  ON amb_acm_csl_inquiry (ent_id, inq_registered_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_advisor
  ON amb_acm_csl_inquiry (ent_id, advisor_id) WHERE deleted_at IS NULL;

-- 3.1b Per-tenant sequence helper (PostgreSQL function)
-- Returns next inq_seq_no for a given ent_id, atomically.
CREATE OR REPLACE FUNCTION acm_csl_next_seq_no(p_ent_id UUID) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  next_no INT;
BEGIN
  SELECT COALESCE(MAX(inq_seq_no), 0) + 1 INTO next_no
  FROM amb_acm_csl_inquiry
  WHERE ent_id = p_ent_id;
  RETURN next_no;
END;
$$;

-- 3.2 MAP test (1:1 with inquiry; F-10 ~ F-13 + waiver scaffolding)
CREATE TABLE IF NOT EXISTS amb_acm_csl_map_test (
  mpt_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  inq_id                  UUID NOT NULL UNIQUE REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  mpt_has_prior_score     BOOLEAN,                                       -- F-10
  mpt_fee_status          VARCHAR(16)                                    -- F-11
                          CHECK (mpt_fee_status IS NULL OR mpt_fee_status IN ('PAID','UNPAID','WAIVED')),
  mpt_waiver_reason       VARCHAR(40)
                          CHECK (mpt_waiver_reason IS NULL OR mpt_waiver_reason IN
                            ('RETAKE_WITHIN_90D','TRIAL_PROMOTION','SISTER_ACADEMY_TRANSFER','OTHER')),
  mpt_waiver_approver_id  UUID,
  mpt_waiver_approved_at  TIMESTAMPTZ,
  mpt_waiver_note         TEXT,
  mpt_scheduled_at        DATE,                                          -- F-12 date
  mpt_scheduled_status    VARCHAR(16)                                    -- F-12 status
                          CHECK (mpt_scheduled_status IS NULL OR mpt_scheduled_status IN
                            ('SCHEDULED','TAKEN','NOT_TAKING','RESCHEDULED')),
  mpt_score_reading       INT CHECK (mpt_score_reading IS NULL OR (mpt_score_reading BETWEEN 100 AND 300)),
  mpt_score_math          INT CHECK (mpt_score_math    IS NULL OR (mpt_score_math    BETWEEN 100 AND 300)),
  mpt_score_language      INT CHECK (mpt_score_language IS NULL OR (mpt_score_language BETWEEN 100 AND 300)),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_csl_mpt_waiver
    CHECK (mpt_fee_status <> 'WAIVED' OR mpt_waiver_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_mpt_ent ON amb_acm_csl_map_test (ent_id);

-- 3.3 Trial class (1:N — multiple sessions allowed; F-14 ~ F-15)
CREATE TABLE IF NOT EXISTS amb_acm_csl_trial_class (
  tcl_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  inq_id                  UUID NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  tcl_held_at             DATE NOT NULL,                                 -- F-14
  tcl_feedback_status     VARCHAR(16) NOT NULL DEFAULT 'PENDING'         -- F-15
                          CHECK (tcl_feedback_status IN ('SENT','PENDING','NA')),
  tcl_feedback_sent_at    TIMESTAMPTZ,
  tcl_note                TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_tcl_inq ON amb_acm_csl_trial_class (inq_id, tcl_held_at);

-- 3.4 Enrollment (1:1; F-16 ~ F-24)
CREATE TABLE IF NOT EXISTS amb_acm_csl_enrollment (
  enr_id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                       UUID NOT NULL,
  inq_id                       UUID NOT NULL UNIQUE REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  enr_payment_notice_status    VARCHAR(16)                              -- F-16
                               CHECK (enr_payment_notice_status IS NULL OR enr_payment_notice_status IN ('SENT','PENDING','NA')),
  enr_counsel_done             VARCHAR(8)                               -- F-17
                               CHECK (enr_counsel_done IS NULL OR enr_counsel_done IN ('YES','NO')),
  enr_applied                  BOOLEAN,                                 -- F-18
  enr_payment_notice_sent      VARCHAR(8)                               -- F-19
                               CHECK (enr_payment_notice_sent IS NULL OR enr_payment_notice_sent IN ('YES','NO')),
  enr_class_minutes            INT,                                     -- F-20
  enr_tuition_amount           DECIMAL(12,0) CHECK (enr_tuition_amount IS NULL OR (enr_tuition_amount BETWEEN 0 AND 50000000)), -- F-21
  enr_tuition_paid             BOOLEAN,                                 -- F-22 (BR-CSL-012 senior manager only)
  enr_tuition_paid_actor_id    UUID,
  enr_tuition_paid_at          TIMESTAMPTZ,
  cls_started_at               DATE,                                    -- F-23
  cls_started                  VARCHAR(8)                               -- F-24 (triggers CLS module)
                               CHECK (cls_started IS NULL OR cls_started IN ('YES','NO')),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_enr_ent ON amb_acm_csl_enrollment (ent_id);

-- 3.5 Cancellation (1:N; structured drop reasons per Q-CSL-006)
CREATE TABLE IF NOT EXISTS amb_acm_csl_cancellation (
  cnc_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id            UUID NOT NULL,
  inq_id            UUID NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  cnc_reason_code   VARCHAR(40) NOT NULL
                    CHECK (cnc_reason_code IN
                      ('SIMPLE_INQUIRY_END','ACADEMY_CANCELLED','STUDENT_ILLNESS',
                       'STUDENT_SCHEDULE_CHANGE','PAYMENT_DECLINED','LOST_TO_COMPETITOR','OTHER')),
  cnc_reason_other  TEXT,
  cnc_actor_id      UUID,
  cnc_occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_csl_cnc_other
    CHECK (cnc_reason_code <> 'OTHER' OR cnc_reason_other IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_cnc_inq ON amb_acm_csl_cancellation (inq_id, cnc_occurred_at);

-- 3.6 Stage transition log (immutable, append-only)
CREATE TABLE IF NOT EXISTS amb_acm_csl_transition (
  tr_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id         UUID NOT NULL,
  inq_id         UUID NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id),
  from_status    VARCHAR(32),
  to_status      VARCHAR(32) NOT NULL,
  direction      VARCHAR(16) NOT NULL DEFAULT 'FORWARD'
                 CHECK (direction IN ('FORWARD','BACKWARD','CANCEL','REACTIVATE')),
  reason_code    VARCHAR(50),
  note           TEXT,
  actor_id       UUID,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_transition_inq_at
  ON amb_acm_csl_transition (inq_id, occurred_at);

-- 3.7 Timeline remarks (F-25 append-only)
CREATE TABLE IF NOT EXISTS amb_acm_csl_remark (
  rmk_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id         UUID NOT NULL,
  inq_id         UUID NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id),
  body           TEXT NOT NULL,
  author_id      UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_remark_inq_created
  ON amb_acm_csl_remark (inq_id, created_at) WHERE deleted_at IS NULL;

-- 3.8 PII reveal audit log (NFR-CSL-S01)
CREATE TABLE IF NOT EXISTS amb_acm_csl_pii_audit (
  audit_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id         UUID NOT NULL,
  inq_id         UUID NOT NULL,
  action         VARCHAR(32) NOT NULL CHECK (action IN ('REVEAL_PHONE','REVEAL_NAME')),
  actor_id       UUID NOT NULL,
  ip             VARCHAR(45),
  user_agent     VARCHAR(500),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_pii_audit_inq_at
  ON amb_acm_csl_pii_audit (inq_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_acm_csl_pii_audit_actor_at
  ON amb_acm_csl_pii_audit (actor_id, occurred_at);

-- ============================================================================
-- 4. QNA — Regular Counseling Q&A
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_qna_question (
  qna_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id              UUID NOT NULL,
  student_id          UUID,
  parent_id           UUID,
  subject             VARCHAR(200) NOT NULL,
  body                TEXT NOT NULL,
  internal_body       TEXT,
  external_body       TEXT,
  -- Lifecycle status (acm-req-qna-001 §3 dual-tone state machine)
  status              VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','RESPONDED','RESOLVED','ESCALATED','DEFERRED')),
  -- Outcome / parent-confirmation gate for FAQ promotion (FR-QNA-006)
  resolution_status   VARCHAR(20) NOT NULL DEFAULT 'NA'
                      CHECK (resolution_status IN ('CONFIRMED_RESOLVED','UNCONFIRMED','UNSATISFIED','NA')),
  -- Dual-tone authoring lifecycle for the parent-facing answer
  response_status     VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                      CHECK (response_status IN ('DRAFT','INTERNAL_ONLY','EXTERNAL_READY','DELIVERED')),
  tags                JSONB,
  is_faq_promoted     BOOLEAN NOT NULL DEFAULT FALSE,
  -- FAQ visibility scope when promoted (FR-QNA-F06)
  faq_visibility      VARCHAR(20) NOT NULL DEFAULT 'ADVISOR_ONLY'
                      CHECK (faq_visibility IN ('ADVISOR_ONLY','ALL_USER','INCLUDE_TEACHER')),
  responded_at        TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_qna_ent_status
  ON amb_acm_qna_question (ent_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_qna_ent_student
  ON amb_acm_qna_question (ent_id, student_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_qna_faq
  ON amb_acm_qna_question (ent_id) WHERE is_faq_promoted = TRUE AND deleted_at IS NULL;
-- Korean fulltext (pg_bigm)
CREATE INDEX IF NOT EXISTS idx_acm_qna_subject_bigm
  ON amb_acm_qna_question USING GIN (subject gin_bigm_ops);
CREATE INDEX IF NOT EXISTS idx_acm_qna_body_bigm
  ON amb_acm_qna_question USING GIN (body gin_bigm_ops);

-- ============================================================================
-- 5. DSH — Dashboard (per acm-req-dsh-001 §2)
-- 4 tables: metric_definitions / daily_kpi / manual_inputs / complaints
-- ============================================================================

-- 5.1 Metric Definitions — registry of 21 KPIs
CREATE TABLE IF NOT EXISTS amb_acm_dsh_metric_definitions (
  met_id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                          UUID NOT NULL,
  met_code                        VARCHAR(50) NOT NULL,
  met_category                    VARCHAR(20) NOT NULL,
  met_label_kr                    VARCHAR(50) NOT NULL,
  met_label_en                    VARCHAR(50) NOT NULL,
  met_aggregation_type            VARCHAR(20) NOT NULL,
  met_data_source                 VARCHAR(20) NOT NULL,
  met_unit                        VARCHAR(20),
  met_format                      VARCHAR(50),
  met_display_order_in_category   INT NOT NULL DEFAULT 0,
  met_dashboard_visible           BOOLEAN NOT NULL DEFAULT TRUE,
  met_supports_drill_down         BOOLEAN NOT NULL DEFAULT FALSE,
  met_active                      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                      TIMESTAMPTZ,
  CONSTRAINT uq_acm_dsh_met_code UNIQUE (ent_id, met_code),
  CONSTRAINT chk_acm_dsh_met_category
    CHECK (met_category IN ('MARKETING','CS','OPERATING','CLASS')),
  CONSTRAINT chk_acm_dsh_met_agg
    CHECK (met_aggregation_type IN ('VOLUME_COUNT','STATUS_SNAPSHOT','DAILY_DISTINCT','NET_DELTA','COMPUTED')),
  CONSTRAINT chk_acm_dsh_met_source
    CHECK (met_data_source IN ('MANUAL','CSL','CLS','SCH','REF','QNA','AMB_USERS','EXTERNAL'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_met_ent_cat
  ON amb_acm_dsh_metric_definitions (ent_id, met_category, met_display_order_in_category);

-- 5.2 Manual Inputs (Marketing + Complain)
CREATE TABLE IF NOT EXISTS amb_acm_dsh_manual_inputs (
  min_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  min_date                DATE NOT NULL,
  min_marketing_visitor   INT,
  min_marketing_cost      NUMERIC(12,0),
  min_marketing_effect    INT,
  min_cs_complain         INT,
  min_input_status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  min_visitor_source      VARCHAR(100),
  min_cost_source         VARCHAR(100),
  min_input_note          TEXT,
  min_input_by            UUID,
  min_input_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  min_updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  min_deleted_at          TIMESTAMPTZ,
  CONSTRAINT uq_acm_dsh_min_date UNIQUE (ent_id, min_date),
  CONSTRAINT chk_acm_dsh_min_status
    CHECK (min_input_status IN ('PENDING','PARTIAL','COMPLETE'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_min_ent_date
  ON amb_acm_dsh_manual_inputs (ent_id, min_date DESC);

-- 5.3 Complaint Log
CREATE TABLE IF NOT EXISTS amb_acm_dsh_complaints (
  cmp_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                  UUID NOT NULL,
  cmp_date                DATE NOT NULL,
  cmp_channel             VARCHAR(20) NOT NULL,
  cmp_severity            VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  cmp_subject             VARCHAR(200),
  cmp_description         TEXT,
  cmp_linked_qna_id       UUID,
  cmp_created_by          UUID,
  cmp_created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cmp_updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cmp_deleted_at          TIMESTAMPTZ,
  CONSTRAINT chk_acm_dsh_cmp_channel
    CHECK (cmp_channel IN ('PHONE','EMAIL','CHAT','IN_PERSON','OTHER')),
  CONSTRAINT chk_acm_dsh_cmp_severity
    CHECK (cmp_severity IN ('LOW','MEDIUM','HIGH'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_cmp_ent_date
  ON amb_acm_dsh_complaints (ent_id, cmp_date DESC);

-- 5.4 Daily KPI Cache (1 row per (ent, day))
CREATE TABLE IF NOT EXISTS amb_acm_dsh_daily_kpi (
  dkp_id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id                          UUID NOT NULL,
  dkp_date                        DATE NOT NULL,
  dkp_year_month                  VARCHAR(7) NOT NULL,
  dkp_day_of_month                INT NOT NULL,
  dkp_day_of_week                 VARCHAR(3) NOT NULL,
  dkp_day_of_week_kr              VARCHAR(2) NOT NULL,
  -- Marketing
  dkp_marketing_visitor           INT,
  dkp_marketing_cost              NUMERIC(12,0),
  dkp_marketing_effect            INT,
  -- CS
  dkp_cs_counseling               INT NOT NULL DEFAULT 0,
  dkp_cs_apply                    INT NOT NULL DEFAULT 0,
  dkp_cs_beginning                INT NOT NULL DEFAULT 0,
  dkp_cs_missing                  INT NOT NULL DEFAULT 0,
  dkp_cs_trial_class              INT NOT NULL DEFAULT 0,
  dkp_cs_complain                 INT NOT NULL DEFAULT 0,
  -- Operating (CLS-sourced — 0 in v1.0a until CLS module)
  dkp_ops_new_st                  INT NOT NULL DEFAULT 0,
  dkp_ops_out_st                  INT NOT NULL DEFAULT 0,
  dkp_ops_count_st                INT NOT NULL DEFAULT 0,
  dkp_ops_new_tc                  INT NOT NULL DEFAULT 0,
  dkp_ops_out_tc                  INT NOT NULL DEFAULT 0,
  dkp_ops_count_tc                INT NOT NULL DEFAULT 0,
  -- Class
  dkp_class_map_test              INT NOT NULL DEFAULT 0,
  dkp_class_tt_class              NUMERIC(5,1) NOT NULL DEFAULT 0,
  dkp_class_student               INT NOT NULL DEFAULT 0,
  dkp_class_teacher               INT NOT NULL DEFAULT 0,
  -- meta
  dkp_computed_at                 TIMESTAMPTZ,
  dkp_computation_status          VARCHAR(20) NOT NULL DEFAULT 'STALE',
  dkp_data_completeness           VARCHAR(30) NOT NULL DEFAULT 'PARTIAL_PENDING_MANUAL',
  dkp_source_versions             JSONB,
  dkp_last_recompute_reason       VARCHAR(100),
  dkp_created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dkp_updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_dsh_dkp UNIQUE (ent_id, dkp_date),
  CONSTRAINT chk_acm_dsh_dkp_status
    CHECK (dkp_computation_status IN ('FRESH','STALE','RECOMPUTING','FAILED')),
  CONSTRAINT chk_acm_dsh_dkp_completeness
    CHECK (dkp_data_completeness IN ('COMPLETE','PARTIAL_PENDING_MANUAL','PARTIAL_FUTURE'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_dkp_ent_month
  ON amb_acm_dsh_daily_kpi (ent_id, dkp_year_month);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_dkp_ent_date
  ON amb_acm_dsh_daily_kpi (ent_id, dkp_date DESC);

-- 5.5 Seed: 21 metric definitions for the demo Entity (e.g. dev seed)
-- Demo ent_id is created in 020-seed-dev.sql; this seed inserts per any existing entity.
DO $$
DECLARE
  e_id UUID;
BEGIN
  FOR e_id IN SELECT DISTINCT ent_id FROM amb_acm_csl_inquiry
              UNION SELECT '00000000-0000-0000-0000-000000000001'::uuid LOOP
    INSERT INTO amb_acm_dsh_metric_definitions
      (ent_id, met_code, met_category, met_label_kr, met_label_en,
       met_aggregation_type, met_data_source, met_unit, met_format,
       met_display_order_in_category, met_dashboard_visible, met_supports_drill_down)
    VALUES
      (e_id,'mkt_visitor','MARKETING','방문자','Visitor','VOLUME_COUNT','MANUAL','명','INT',1,TRUE,FALSE),
      (e_id,'mkt_cost','MARKETING','비용','Cost','VOLUME_COUNT','MANUAL','원','CURRENCY_KRW',2,TRUE,FALSE),
      (e_id,'mkt_effect','MARKETING','효과','Effect','COMPUTED','MANUAL','건','INT',3,TRUE,FALSE),
      (e_id,'cs_counseling','CS','상담','Counseling','VOLUME_COUNT','CSL','건','INT',1,TRUE,TRUE),
      (e_id,'cs_apply','CS','지원','Apply','VOLUME_COUNT','CSL','건','INT',2,TRUE,TRUE),
      (e_id,'cs_beginning','CS','시작','Beginning','VOLUME_COUNT','CSL','건','INT',3,TRUE,TRUE),
      (e_id,'cs_missing','CS','이탈','Missing','VOLUME_COUNT','CSL','건','INT',4,TRUE,TRUE),
      (e_id,'cs_trial_class','CS','체험수업','Trial Class','VOLUME_COUNT','CSL','건','INT',5,TRUE,TRUE),
      (e_id,'cs_complain','CS','불만','Complain','VOLUME_COUNT','MANUAL','건','INT',6,TRUE,TRUE),
      (e_id,'ops_new_st','OPERATING','신규학생','New St.','NET_DELTA','CLS','명','INT',1,TRUE,FALSE),
      (e_id,'ops_out_st','OPERATING','퇴원학생','Out St.','NET_DELTA','CLS','명','INT',2,TRUE,FALSE),
      (e_id,'ops_count_st','OPERATING','학생수','# of St.','STATUS_SNAPSHOT','CLS','명','INT',3,TRUE,FALSE),
      (e_id,'ops_new_tc','OPERATING','신규교사','New Tc.','NET_DELTA','AMB_USERS','명','INT',4,TRUE,FALSE),
      (e_id,'ops_out_tc','OPERATING','퇴직교사','Out Tc.','NET_DELTA','AMB_USERS','명','INT',5,TRUE,FALSE),
      (e_id,'ops_count_tc','OPERATING','교사수','# of Tc.','STATUS_SNAPSHOT','AMB_USERS','명','INT',6,TRUE,FALSE),
      (e_id,'cls_map_test','CLASS','MAP테스트','Map Test','VOLUME_COUNT','CSL','건','INT',1,TRUE,TRUE),
      (e_id,'cls_tt_class','CLASS','수업수','Tt. Class','VOLUME_COUNT','CLS','회','DECIMAL_5_1',2,TRUE,FALSE),
      (e_id,'cls_student','CLASS','학생','Student','DAILY_DISTINCT','CLS','명','INT',3,TRUE,FALSE),
      (e_id,'cls_teacher','CLASS','교사','Teacher','DAILY_DISTINCT','CLS','명','INT',4,TRUE,FALSE)
    ON CONFLICT (ent_id, met_code) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================================
-- End of acm-v1.0a-init.sql
-- ============================================================================
