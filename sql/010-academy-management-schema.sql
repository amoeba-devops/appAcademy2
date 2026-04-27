-- ============================================================
-- Trinity Academy — Management System MySQL Schema (DDL)
-- Document: ACADEMY-ERD-1.3.0
-- Version: 1.3.1
-- Target: MySQL 8.0+
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
-- Naming Convention: Amoeba Code Convention v2 §4
--   · Table prefix:       tac_
--   · Sub-domain prefix:  tac_{sub}_ (tac_map_, tac_pay_)
--   · PK:                 {colPrefix}_id (BIGINT AUTO_INCREMENT)
--   · FK:                 Referenced table's PK name as-is
--   · General column:     {colPrefix}_{name}
--   · Boolean:            {colPrefix}_is_{name}
--   · Timestamp:          {colPrefix}_created_at, {colPrefix}_updated_at
--   · Soft delete:        {colPrefix}_deleted_at
--   · Status:             {colPrefix}_status (VARCHAR, UPPER_SNAKE values)
--   · Index:              idx_{table}_{columns}
--   · Unique:             uq_{table}_{columns}
--   · FK constraint:      fk_{table}_{ref_table}
--
-- Column Prefix Map:
--   tac_academies              → acd
--   tac_programs               → prg
--   tac_program_settings       → pgs
--   tac_classrooms             → clr
--   tac_teachers               → tch
--   tac_parents                → prt
--   tac_students               → std
--   tac_student_guardians      → sgd
--   tac_classes                → cls
--   tac_class_sessions         → csn
--   tac_consultations          → cst
--   tac_visit_records          → vsr
--   tac_enrollments            → enr
--   tac_attendances            → att
--   tac_map_passages           → psg
--   tac_map_passage_assets     → pas
--   tac_map_items              → itm
--   tac_map_item_tags          → itg
--   tac_map_test_sets          → tst
--   tac_map_test_set_items     → tsi
--   tac_map_assignments        → asn
--   tac_map_responses          → rsp
--   tac_map_scores             → msc
--   tac_external_test_scores   → ets
--   tac_counseling_records     → cnr
--   tac_pay_refund_policies    → rfp
--   tac_pay_refund_policy_tiers→ rpt
--   tac_pay_orders             → pod
--   tac_pay_ledger             → ldg
--   tac_pay_receipts           → rct
--   tac_pay_tax_invoices       → txi
--   tac_consultation_intake_form → cif
--   tac_posts                  → pst
--   tac_users                  → usr
--   tac_audit_logs             → adl
--
-- Changelog:
--   1.0.0 — Initial core entities
--   1.2.0 — Rebranded to Trinity Academy; added MAP question bank,
--           timetable session extensions, student extensions,
--           Trinity Pay (payment_orders/ledger/receipts), Main Portal
--           (consultation_intake_form, posts).
--   1.3.0 — Trinity Pay decisions closed:
--           · Q-014 Toss Payments — pg_provider fixed to 'TOSS',
--             pg_payment_key widened to VARCHAR(200), status enum
--             mirrors Toss (READY/IN_PROGRESS/DONE/CANCELED/
--             PARTIAL_CANCELED/ABORTED/EXPIRED).
--           · Q-015 Session-based refund — new tac_pay_refund_policies +
--             tac_pay_refund_policy_tiers (default = 학원법 시행령 제18조 3-tier).
--             tac_pay_orders.pod_rfp_id links snapshot.
--             tac_pay_ledger gains rpt_id + ldg_elapsed_ratio_at_refund.
--           · Q-018 Self-issued tax invoice — new tac_pay_tax_invoices table
--             (NTS eTax API fields: txi_nts_issue_no/txi_status/xml/pdf).
--             tac_pay_receipts repurposed to CASH_RECEIPT/SIMPLE only.
--   1.3.1 — Naming convention alignment:
--           · Column naming: Amoeba Code Convention v2 §4 (colPrefix pattern)
--           · All tables prefixed tac_, MAP domain tac_map_, Pay domain tac_pay_.
--           · Index/Unique/FK names updated accordingly.
--           · Removed duplicate non-prefixed schema.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------
-- Tenant (colPrefix: acd)
-- ----------------------------
CREATE TABLE tac_academies (
    acd_id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_name                     VARCHAR(200)    NOT NULL,
    acd_business_registration_no VARCHAR(30)              DEFAULT NULL,
    acd_status                   VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    acd_created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acd_updated_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                          ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (acd_id),
    KEY idx_tac_academies_status (acd_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Program & Settings (colPrefix: prg / pgs)
-- ----------------------------
CREATE TABLE tac_programs (
    prg_id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id               BIGINT UNSIGNED NOT NULL,
    prg_name             VARCHAR(100)    NOT NULL,
    prg_category         VARCHAR(30)     NOT NULL,
    prg_description      TEXT                     DEFAULT NULL,
    prg_duration_weeks   INT                      DEFAULT NULL,
    prg_target_age_min   INT                      DEFAULT NULL,
    prg_target_age_max   INT                      DEFAULT NULL,
    prg_level            VARCHAR(20)              DEFAULT NULL,
    prg_status           VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    prg_created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    prg_updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                  ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (prg_id),
    UNIQUE KEY uq_tac_programs_acd_name (acd_id, prg_name),
    KEY idx_tac_programs_acd_status (acd_id, prg_status),
    CONSTRAINT fk_tac_programs_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tac_program_settings (
    pgs_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    prg_id             BIGINT UNSIGNED NOT NULL,
    pgs_fee_amount     DECIMAL(12,2)            DEFAULT NULL,
    pgs_fee_currency   CHAR(3)         NOT NULL DEFAULT 'KRW',
    pgs_capacity_max   INT                      DEFAULT NULL,
    pgs_session_count  INT                      DEFAULT NULL,
    pgs_material_info  JSON                     DEFAULT NULL,
    pgs_refund_policy  JSON                     DEFAULT NULL,
    pgs_updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (pgs_id),
    UNIQUE KEY uq_tac_program_settings_prg (prg_id),
    CONSTRAINT fk_tac_program_settings_program FOREIGN KEY (prg_id) REFERENCES tac_programs(prg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Classrooms (colPrefix: clr)
-- ----------------------------
CREATE TABLE tac_classrooms (
    clr_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id         BIGINT UNSIGNED NOT NULL,
    clr_name       VARCHAR(50)     NOT NULL,
    clr_capacity   INT                      DEFAULT NULL,
    clr_status     VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (clr_id),
    UNIQUE KEY uq_tac_classrooms_acd_name (acd_id, clr_name),
    CONSTRAINT fk_tac_classrooms_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Teachers — AMA Client 참조 (colPrefix: tch)
-- ----------------------------
CREATE TABLE tac_teachers (
    tch_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                 BIGINT UNSIGNED NOT NULL,
    tch_ama_client_id      VARCHAR(64)     NOT NULL COMMENT 'AMA 거래처 ID — 단일 진실 원천',
    tch_teaching_subjects  JSON                     DEFAULT NULL,
    tch_employment_type    VARCHAR(20)     NOT NULL,
    tch_status             VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    tch_last_synced_at     DATETIME                 DEFAULT NULL,
    tch_cached_profile     JSON                     DEFAULT NULL COMMENT '표시용 캐시 (name, phone)',
    tch_created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tch_updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                      ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (tch_id),
    UNIQUE KEY uq_tac_teachers_acd_ama (acd_id, tch_ama_client_id),
    KEY idx_tac_teachers_status (acd_id, tch_status),
    CONSTRAINT fk_tac_teachers_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Parents & Students (colPrefix: prt / std)
-- ----------------------------
CREATE TABLE tac_parents (
    prt_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                BIGINT UNSIGNED NOT NULL,
    prt_name              VARCHAR(100)    NOT NULL,
    prt_phone_encrypted   VARBINARY(255)           DEFAULT NULL,
    prt_email_encrypted   VARBINARY(255)           DEFAULT NULL,
    prt_preferred_channel VARCHAR(20)              DEFAULT 'SMS',
    prt_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    prt_updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                    ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (prt_id),
    KEY idx_tac_parents_acd (acd_id),
    CONSTRAINT fk_tac_parents_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tac_students (
    std_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                 BIGINT UNSIGNED NOT NULL,
    prt_id                 BIGINT UNSIGNED NOT NULL COMMENT '주 보호자 — 필수',
    std_name               VARCHAR(100)    NOT NULL,
    std_birth_date         DATE                     DEFAULT NULL,
    std_gender             CHAR(1)                  DEFAULT NULL,
    std_school             VARCHAR(100)             DEFAULT NULL,
    std_grade              VARCHAR(20)              DEFAULT NULL,
    std_status             VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    std_lifecycle_status   VARCHAR(20)     NOT NULL DEFAULT 'CONSULTING'
        COMMENT 'CONSULTING/ENROLLED/ACTIVE/TERMINATED (FR-037)',
    std_terminated_at      DATETIME                 DEFAULT NULL,
    std_termination_reason VARCHAR(100)             DEFAULT NULL,
    std_created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    std_updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                     ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (std_id),
    KEY idx_tac_students_prt (prt_id),
    KEY idx_tac_students_acd_name (acd_id, std_name),
    CONSTRAINT fk_tac_students_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_students_parent  FOREIGN KEY (prt_id) REFERENCES tac_parents(prt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Student Guardians (colPrefix: sgd)
CREATE TABLE tac_student_guardians (
    sgd_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    std_id           BIGINT UNSIGNED NOT NULL,
    prt_id           BIGINT UNSIGNED NOT NULL,
    sgd_relationship VARCHAR(20)              DEFAULT NULL,
    sgd_is_primary   BOOLEAN         NOT NULL DEFAULT FALSE,
    PRIMARY KEY (sgd_id),
    UNIQUE KEY uq_tac_student_guardians (std_id, prt_id),
    CONSTRAINT fk_tac_sg_student FOREIGN KEY (std_id) REFERENCES tac_students(std_id),
    CONSTRAINT fk_tac_sg_parent  FOREIGN KEY (prt_id) REFERENCES tac_parents(prt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Classes & Sessions (colPrefix: cls / csn)
-- ----------------------------
CREATE TABLE tac_classes (
    cls_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                BIGINT UNSIGNED NOT NULL,
    prg_id                BIGINT UNSIGNED NOT NULL,
    tch_id                BIGINT UNSIGNED NOT NULL,
    clr_id                BIGINT UNSIGNED          DEFAULT NULL,
    cls_start_date        DATE            NOT NULL,
    cls_end_date          DATE                     DEFAULT NULL,
    cls_capacity          INT             NOT NULL,
    cls_enrolled_count    INT             NOT NULL DEFAULT 0,
    cls_status            VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    cls_schedule_pattern  JSON            NOT NULL COMMENT '[{weekday,start_time,end_time}]',
    cls_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cls_updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                    ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cls_id),
    KEY idx_tac_classes_tch_date (tch_id, cls_start_date),
    KEY idx_tac_classes_clr_date (clr_id, cls_start_date),
    KEY idx_tac_classes_acd_status (acd_id, cls_status),
    CONSTRAINT fk_tac_classes_academy   FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_classes_program   FOREIGN KEY (prg_id) REFERENCES tac_programs(prg_id),
    CONSTRAINT fk_tac_classes_teacher   FOREIGN KEY (tch_id) REFERENCES tac_teachers(tch_id),
    CONSTRAINT fk_tac_classes_classroom FOREIGN KEY (clr_id) REFERENCES tac_classrooms(clr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tac_class_sessions (
    csn_id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cls_id                    BIGINT UNSIGNED NOT NULL,
    csn_session_no            INT             NOT NULL,
    csn_start_at              DATETIME        NOT NULL,
    csn_end_at                DATETIME        NOT NULL,
    csn_planned_duration_hours DECIMAL(3,1)            DEFAULT NULL,
    csn_actual_duration_hours  DECIMAL(3,1)            DEFAULT NULL,
    csn_status                VARCHAR(20)     NOT NULL DEFAULT 'SCHEDULED',
    csn_session_status        VARCHAR(20)     NOT NULL DEFAULT 'SCHEDULED'
        COMMENT 'SCHEDULED/HELD/CANCELLED/MAKEUP',
    csn_cancel_reason         VARCHAR(100)             DEFAULT NULL,
    csn_makeup_csn_id         BIGINT UNSIGNED          DEFAULT NULL COMMENT 'Self-ref: makeup of session',
    csn_memo                  TEXT                     DEFAULT NULL,
    PRIMARY KEY (csn_id),
    UNIQUE KEY uq_tac_class_sessions_cls_no (cls_id, csn_session_no),
    KEY idx_tac_class_sessions_start (csn_start_at),
    CONSTRAINT fk_tac_class_sessions_class  FOREIGN KEY (cls_id)            REFERENCES tac_classes(cls_id),
    CONSTRAINT fk_tac_class_sessions_makeup FOREIGN KEY (csn_makeup_csn_id) REFERENCES tac_class_sessions(csn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Application must enforce: csn_actual_duration_hours % 0.5 == 0 (A-007)

-- ----------------------------
-- Consultation & Visit (colPrefix: cst / vsr)
-- ----------------------------
CREATE TABLE tac_consultations (
    cst_id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                      BIGINT UNSIGNED NOT NULL,
    prt_id                      BIGINT UNSIGNED          DEFAULT NULL,
    cst_interested_prg_id       BIGINT UNSIGNED          DEFAULT NULL,
    cst_channel                 VARCHAR(20)     NOT NULL,
    cst_status                  VARCHAR(20)     NOT NULL DEFAULT 'OPEN',
    cst_assignee_user_id        BIGINT UNSIGNED          DEFAULT NULL,
    cst_note                    TEXT                     DEFAULT NULL,
    cst_converted_enr_id        BIGINT UNSIGNED          DEFAULT NULL,
    cst_created_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cst_updated_at              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                          ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cst_id),
    KEY idx_tac_consultations_acd_status (acd_id, cst_status),
    KEY idx_tac_consultations_prt (prt_id),
    CONSTRAINT fk_tac_consultations_academy FOREIGN KEY (acd_id)                REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_consultations_parent  FOREIGN KEY (prt_id)                REFERENCES tac_parents(prt_id),
    CONSTRAINT fk_tac_consultations_program FOREIGN KEY (cst_interested_prg_id) REFERENCES tac_programs(prg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tac_visit_records (
    vsr_id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    cst_id               BIGINT UNSIGNED NOT NULL,
    vsr_scheduled_at     DATETIME                 DEFAULT NULL,
    vsr_visited_at       DATETIME                 DEFAULT NULL,
    vsr_outcome          VARCHAR(20)              DEFAULT NULL,
    vsr_handler_user_id  BIGINT UNSIGNED          DEFAULT NULL,
    vsr_memo             TEXT                     DEFAULT NULL,
    vsr_created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (vsr_id),
    KEY idx_tac_visit_records_cst (cst_id),
    CONSTRAINT fk_tac_visit_records_consultation FOREIGN KEY (cst_id) REFERENCES tac_consultations(cst_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Enrollment & Attendance (colPrefix: enr / att)
-- ----------------------------
CREATE TABLE tac_enrollments (
    enr_id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                    BIGINT UNSIGNED NOT NULL,
    cls_id                    BIGINT UNSIGNED NOT NULL,
    std_id                    BIGINT UNSIGNED NOT NULL,
    enr_applied_prt_id        BIGINT UNSIGNED NOT NULL COMMENT '신청 보호자',
    enr_status                VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    enr_applied_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enr_confirmed_at          DATETIME                 DEFAULT NULL,
    enr_canceled_at           DATETIME                 DEFAULT NULL,
    PRIMARY KEY (enr_id),
    UNIQUE KEY uq_tac_enrollments_cls_std (cls_id, std_id),
    KEY idx_tac_enrollments_acd_status (acd_id, enr_status),
    KEY idx_tac_enrollments_std_status (std_id, enr_status),
    CONSTRAINT fk_tac_enrollments_academy FOREIGN KEY (acd_id)             REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_enrollments_class   FOREIGN KEY (cls_id)             REFERENCES tac_classes(cls_id),
    CONSTRAINT fk_tac_enrollments_student FOREIGN KEY (std_id)             REFERENCES tac_students(std_id),
    CONSTRAINT fk_tac_enrollments_parent  FOREIGN KEY (enr_applied_prt_id) REFERENCES tac_parents(prt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Post-FK alter: tac_consultations.cst_converted_enr_id → tac_enrollments.enr_id
ALTER TABLE tac_consultations
    ADD CONSTRAINT fk_tac_consultations_enrollment
    FOREIGN KEY (cst_converted_enr_id) REFERENCES tac_enrollments(enr_id);

CREATE TABLE tac_attendances (
    att_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    csn_id            BIGINT UNSIGNED NOT NULL,
    std_id            BIGINT UNSIGNED NOT NULL,
    att_status        VARCHAR(20)     NOT NULL,
    att_memo          TEXT                     DEFAULT NULL,
    att_recorded_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (att_id),
    UNIQUE KEY uq_tac_attendances_csn_std (csn_id, std_id),
    CONSTRAINT fk_tac_attendances_session FOREIGN KEY (csn_id) REFERENCES tac_class_sessions(csn_id),
    CONSTRAINT fk_tac_attendances_student FOREIGN KEY (std_id) REFERENCES tac_students(std_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- MAP Question Bank (tac_map_ domain)
-- ----------------------------

-- Passages (colPrefix: psg)
CREATE TABLE tac_map_passages (
    psg_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id             BIGINT UNSIGNED          DEFAULT NULL COMMENT 'NULL = shared pool (Q-006)',
    psg_title          VARCHAR(200)    NOT NULL,
    psg_body           MEDIUMTEXT      NOT NULL,
    psg_grade_level    VARCHAR(10)     NOT NULL COMMENT 'G2/G3/G4/G5',
    psg_domain         VARCHAR(20)     NOT NULL DEFAULT 'RC',
    psg_pair_group_id  BIGINT UNSIGNED          DEFAULT NULL COMMENT 'Passage 1/2 pairing',
    psg_source         VARCHAR(200)             DEFAULT NULL,
    psg_version        INT             NOT NULL DEFAULT 1,
    psg_status         VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    psg_created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    psg_updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                      ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (psg_id),
    KEY idx_tac_map_passages_acd_grade (acd_id, psg_grade_level, psg_status),
    KEY idx_tac_map_passages_pair (psg_pair_group_id),
    CONSTRAINT fk_tac_map_passages_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Passage Assets (colPrefix: pas)
CREATE TABLE tac_map_passage_assets (
    pas_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    psg_id          BIGINT UNSIGNED NOT NULL,
    pas_asset_url   VARCHAR(500)    NOT NULL,
    pas_alt_text    VARCHAR(200)             DEFAULT NULL,
    pas_ordinal     INT             NOT NULL DEFAULT 0,
    PRIMARY KEY (pas_id),
    KEY idx_tac_map_passage_assets_psg (psg_id),
    CONSTRAINT fk_tac_map_passage_assets_passage FOREIGN KEY (psg_id) REFERENCES tac_map_passages(psg_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Items (colPrefix: itm)
CREATE TABLE tac_map_items (
    itm_id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id              BIGINT UNSIGNED          DEFAULT NULL,
    psg_id              BIGINT UNSIGNED          DEFAULT NULL,
    itm_parent_itm_id   BIGINT UNSIGNED          DEFAULT NULL COMMENT 'Part A-B Part B parent',
    itm_domain          VARCHAR(20)     NOT NULL COMMENT 'RC/MATH/LANGUAGE',
    itm_grade_level     VARCHAR(10)     NOT NULL,
    itm_difficulty      VARCHAR(20)     NOT NULL COMMENT 'BASIC/INTERMEDIATE/ADVANCED',
    itm_item_type       VARCHAR(20)     NOT NULL COMMENT 'SINGLE/MULTI/PART_AB',
    itm_stem            TEXT            NOT NULL,
    itm_options         JSON            NOT NULL,
    itm_answer_keys     JSON            NOT NULL COMMENT 'Multi-correct supported (A-006)',
    itm_explanation     TEXT                     DEFAULT NULL,
    itm_points          INT             NOT NULL DEFAULT 1,
    itm_version         INT             NOT NULL DEFAULT 1,
    itm_status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    itm_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    itm_updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                      ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (itm_id),
    KEY idx_tac_map_items_taxonomy (itm_domain, itm_grade_level, itm_difficulty, itm_status),
    KEY idx_tac_map_items_psg      (psg_id),
    KEY idx_tac_map_items_parent   (itm_parent_itm_id),
    CONSTRAINT fk_tac_map_items_academy FOREIGN KEY (acd_id)            REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_map_items_passage FOREIGN KEY (psg_id)            REFERENCES tac_map_passages(psg_id),
    CONSTRAINT fk_tac_map_items_parent  FOREIGN KEY (itm_parent_itm_id) REFERENCES tac_map_items(itm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Item Tags (colPrefix: itg)
CREATE TABLE tac_map_item_tags (
    itm_id   BIGINT UNSIGNED NOT NULL,
    itg_tag  VARCHAR(50)     NOT NULL,
    PRIMARY KEY (itm_id, itg_tag),
    KEY idx_tac_map_item_tags_tag (itg_tag),
    CONSTRAINT fk_tac_map_item_tags_item FOREIGN KEY (itm_id) REFERENCES tac_map_items(itm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test Sets (colPrefix: tst)
CREATE TABLE tac_map_test_sets (
    tst_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                BIGINT UNSIGNED NOT NULL,
    tst_name              VARCHAR(100)    NOT NULL,
    tst_composition_mode  VARCHAR(20)     NOT NULL DEFAULT 'FIXED' COMMENT 'FIXED/AUTO',
    tst_filter_criteria   JSON                     DEFAULT NULL,
    tst_total_points      INT             NOT NULL DEFAULT 0,
    tst_status            VARCHAR(20)     NOT NULL DEFAULT 'DRAFT',
    tst_created_by        BIGINT UNSIGNED          DEFAULT NULL,
    tst_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tst_id),
    KEY idx_tac_map_test_sets_acd (acd_id, tst_status),
    CONSTRAINT fk_tac_map_test_sets_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Test Set Items (colPrefix: tsi)
CREATE TABLE tac_map_test_set_items (
    tsi_id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tst_id                       BIGINT UNSIGNED NOT NULL,
    itm_id                       BIGINT UNSIGNED NOT NULL,
    tsi_ordinal                  INT             NOT NULL,
    tsi_item_version_snapshot    JSON            NOT NULL COMMENT 'Item snapshot at assignment time (FR-028)',
    PRIMARY KEY (tsi_id),
    UNIQUE KEY uq_tac_map_test_set_items_ordinal (tst_id, tsi_ordinal),
    KEY idx_tac_map_test_set_items_itm (itm_id),
    CONSTRAINT fk_tac_map_test_set_items_set  FOREIGN KEY (tst_id) REFERENCES tac_map_test_sets(tst_id),
    CONSTRAINT fk_tac_map_test_set_items_item FOREIGN KEY (itm_id) REFERENCES tac_map_items(itm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Assignments (colPrefix: asn)
CREATE TABLE tac_map_assignments (
    asn_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tst_id           BIGINT UNSIGNED NOT NULL,
    asn_target_type  VARCHAR(20)     NOT NULL COMMENT 'CLASS/STUDENT',
    asn_target_id    BIGINT UNSIGNED NOT NULL,
    asn_due_at       DATETIME        NOT NULL,
    asn_status       VARCHAR(20)     NOT NULL DEFAULT 'ASSIGNED',
    asn_created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (asn_id),
    KEY idx_tac_map_assignments_target (asn_target_type, asn_target_id, asn_status),
    KEY idx_tac_map_assignments_due    (asn_due_at),
    CONSTRAINT fk_tac_map_assignments_set FOREIGN KEY (tst_id) REFERENCES tac_map_test_sets(tst_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Responses (colPrefix: rsp)
CREATE TABLE tac_map_responses (
    rsp_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asn_id             BIGINT UNSIGNED NOT NULL,
    std_id             BIGINT UNSIGNED NOT NULL,
    itm_id             BIGINT UNSIGNED NOT NULL,
    rsp_answer         JSON            NOT NULL,
    rsp_is_correct     BOOLEAN         NOT NULL,
    rsp_points_earned  INT             NOT NULL DEFAULT 0,
    rsp_submitted_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rsp_id),
    UNIQUE KEY uq_tac_map_responses_asn_std_itm (asn_id, std_id, itm_id),
    KEY idx_tac_map_responses_std (std_id),
    CONSTRAINT fk_tac_map_responses_assignment FOREIGN KEY (asn_id) REFERENCES tac_map_assignments(asn_id),
    CONSTRAINT fk_tac_map_responses_student    FOREIGN KEY (std_id) REFERENCES tac_students(std_id),
    CONSTRAINT fk_tac_map_responses_item       FOREIGN KEY (itm_id) REFERENCES tac_map_items(itm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MAP Scores (colPrefix: msc)
CREATE TABLE tac_map_scores (
    msc_id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    std_id              BIGINT UNSIGNED NOT NULL,
    msc_assessed_at     DATE            NOT NULL,
    msc_reading_score   INT                      DEFAULT NULL,
    msc_math_score      INT                      DEFAULT NULL,
    msc_language_score  INT                      DEFAULT NULL,
    msc_source          VARCHAR(20)     NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM/IMPORT/MANUAL',
    asn_id              BIGINT UNSIGNED          DEFAULT NULL,
    msc_note            TEXT                     DEFAULT NULL,
    msc_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (msc_id),
    KEY idx_tac_map_scores_std_date (std_id, msc_assessed_at),
    CONSTRAINT fk_tac_map_scores_student    FOREIGN KEY (std_id) REFERENCES tac_students(std_id),
    CONSTRAINT fk_tac_map_scores_assignment FOREIGN KEY (asn_id) REFERENCES tac_map_assignments(asn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Student Extensions
-- ----------------------------

-- External Test Scores (colPrefix: ets)
CREATE TABLE tac_external_test_scores (
    ets_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    std_id                BIGINT UNSIGNED NOT NULL,
    ets_test_type         VARCHAR(20)     NOT NULL COMMENT 'SSAT/ISEE/GPA/...',
    ets_test_date         DATE            NOT NULL,
    ets_score_raw         VARCHAR(50)     NOT NULL,
    ets_score_percentile  INT                      DEFAULT NULL,
    ets_note              TEXT                     DEFAULT NULL,
    ets_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ets_id),
    KEY idx_tac_external_test_scores_std (std_id, ets_test_type, ets_test_date),
    CONSTRAINT fk_tac_external_test_scores_student FOREIGN KEY (std_id) REFERENCES tac_students(std_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Counseling Records (colPrefix: cnr)
CREATE TABLE tac_counseling_records (
    cnr_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    std_id                BIGINT UNSIGNED NOT NULL,
    cnr_counseled_at      DATETIME        NOT NULL,
    cnr_counselor_user_id BIGINT UNSIGNED          DEFAULT NULL,
    cnr_topics            JSON                     DEFAULT NULL,
    cnr_goals             JSON                     DEFAULT NULL,
    cnr_satisfaction_note TEXT                     DEFAULT NULL,
    cnr_next_action       TEXT                     DEFAULT NULL,
    cnr_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cnr_id),
    KEY idx_tac_counseling_records_std_date (std_id, cnr_counseled_at),
    CONSTRAINT fk_tac_counseling_records_student FOREIGN KEY (std_id) REFERENCES tac_students(std_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Trinity Pay (tac_pay_ domain)
-- ----------------------------

-- Refund Policies (colPrefix: rfp) — v1.3 new
-- Basis = SESSION (수업일·회차) by default. Tiers define
-- step function: elapsed_ratio_min < x <= elapsed_ratio_max => refund_rate.
CREATE TABLE tac_pay_refund_policies (
    rfp_id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                   BIGINT UNSIGNED NOT NULL,
    rfp_version              INT             NOT NULL,
    rfp_basis                VARCHAR(20)     NOT NULL DEFAULT 'SESSION'
        COMMENT 'SESSION(수업일/회차 기준) | CALENDAR(달력일)',
    rfp_label                VARCHAR(100)    NOT NULL,
    rfp_effective_from       DATE            NOT NULL,
    rfp_effective_to         DATE                     DEFAULT NULL,
    rfp_is_default_template  TINYINT(1)      NOT NULL DEFAULT 0
        COMMENT '1 = 학원법 시행령 제18조 시드 템플릿',
    rfp_created_by           BIGINT UNSIGNED          DEFAULT NULL,
    rfp_created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rfp_id),
    UNIQUE KEY uq_tac_pay_refund_policies_acd_version (acd_id, rfp_version),
    KEY idx_tac_pay_refund_policies_active (acd_id, rfp_effective_from, rfp_effective_to),
    CONSTRAINT fk_tac_pay_refund_policies_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refund Policy Tiers (colPrefix: rpt)
CREATE TABLE tac_pay_refund_policy_tiers (
    rpt_id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rfp_id                   BIGINT UNSIGNED NOT NULL,
    rpt_tier_order           TINYINT         NOT NULL,
    rpt_elapsed_ratio_min    DECIMAL(5,4)    NOT NULL COMMENT '> (exclusive), 0.0000 = 교습 시작',
    rpt_elapsed_ratio_max    DECIMAL(5,4)    NOT NULL COMMENT '<= (inclusive), 1.0000 = 교습 종료',
    rpt_refund_rate          DECIMAL(5,4)    NOT NULL COMMENT '0.0000 ~ 1.0000',
    rpt_note                 VARCHAR(200)             DEFAULT NULL,
    PRIMARY KEY (rpt_id),
    UNIQUE KEY uq_tac_pay_refund_policy_tiers_order (rfp_id, rpt_tier_order),
    CONSTRAINT fk_tac_pay_refund_policy_tiers_policy FOREIGN KEY (rfp_id) REFERENCES tac_pay_refund_policies(rfp_id) ON DELETE CASCADE,
    CONSTRAINT chk_tac_pay_refund_policy_tiers_range CHECK (rpt_elapsed_ratio_min < rpt_elapsed_ratio_max),
    CONSTRAINT chk_tac_pay_refund_policy_tiers_rate  CHECK (rpt_refund_rate >= 0 AND rpt_refund_rate <= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: 학원법 시행령 제18조 기본 3단계 (per academy, run post-install)
-- INSERT INTO tac_pay_refund_policies (acd_id, rfp_version, rfp_basis, rfp_label, rfp_effective_from, rfp_is_default_template)
--   VALUES (?, 1, 'SESSION', '학원법 시행령 제18조 기본', CURRENT_DATE, 1);
-- INSERT INTO tac_pay_refund_policy_tiers (rfp_id, rpt_tier_order, rpt_elapsed_ratio_min, rpt_elapsed_ratio_max, rpt_refund_rate, rpt_note) VALUES
--   (?, 0, -0.0001, 0.0000, 1.0000, '교습 개시 전'),
--   (?, 1,  0.0000, 0.3333, 0.6667, '1/3 경과 전 (2/3 환불)'),
--   (?, 2,  0.3333, 0.5000, 0.5000, '1/2 경과 전 (1/2 환불)'),
--   (?, 3,  0.5000, 1.0001, 0.0000, '1/2 경과 후 (환불 불가)');

-- Payment Orders (colPrefix: pod)
CREATE TABLE tac_pay_orders (
    pod_id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                        BIGINT UNSIGNED NOT NULL,
    enr_id                        BIGINT UNSIGNED NOT NULL,
    pod_order_no                  VARCHAR(40)     NOT NULL,
    pod_idempotency_key           VARCHAR(64)     NOT NULL,
    pod_amount                    DECIMAL(12,2)   NOT NULL,
    pod_currency                  CHAR(3)         NOT NULL DEFAULT 'KRW',
    pod_method                    VARCHAR(20)              DEFAULT NULL COMMENT 'CARD/TRANSFER/VACCOUNT/EASY_PAY',
    pod_pg_provider               VARCHAR(20)     NOT NULL DEFAULT 'TOSS' COMMENT 'Fixed TOSS @ v1.3 (A-011)',
    pod_pg_order_id               VARCHAR(64)              DEFAULT NULL COMMENT 'Toss orderId = pod_order_no',
    pod_pg_payment_key            VARCHAR(200)             DEFAULT NULL COMMENT 'Toss paymentKey; no raw PAN (NFR-011)',
    pod_status                    VARCHAR(30)     NOT NULL DEFAULT 'READY'
        COMMENT 'READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED (Toss)',
    rfp_id                        BIGINT UNSIGNED NOT NULL
        COMMENT 'Snapshot of tac_pay_refund_policies at order creation (A-012)',
    pod_expires_at                DATETIME                 DEFAULT NULL,
    pod_approved_at               DATETIME                 DEFAULT NULL,
    pod_canceled_at               DATETIME                 DEFAULT NULL,
    pod_created_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pod_updated_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                                  ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (pod_id),
    UNIQUE KEY uq_tac_pay_orders_order_no (pod_order_no),
    UNIQUE KEY uq_tac_pay_orders_idempotency (pod_idempotency_key),
    KEY idx_tac_pay_orders_enr (enr_id),
    KEY idx_tac_pay_orders_status (acd_id, pod_status),
    CONSTRAINT fk_tac_pay_orders_academy        FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_pay_orders_enrollment     FOREIGN KEY (enr_id) REFERENCES tac_enrollments(enr_id),
    CONSTRAINT fk_tac_pay_orders_refund_policy  FOREIGN KEY (rfp_id) REFERENCES tac_pay_refund_policies(rfp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment Ledger (colPrefix: ldg)
CREATE TABLE tac_pay_ledger (
    ldg_id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pod_id                      BIGINT UNSIGNED NOT NULL,
    ldg_entry_type              VARCHAR(20)     NOT NULL COMMENT 'CHARGE/REFUND/ADJUSTMENT',
    ldg_amount                  DECIMAL(12,2)   NOT NULL COMMENT 'negative for refund',
    ldg_balance_after           DECIMAL(12,2)   NOT NULL,
    rpt_id                      BIGINT UNSIGNED          DEFAULT NULL COMMENT 'Tier applied (audit)',
    ldg_elapsed_ratio_at_refund DECIMAL(5,4)             DEFAULT NULL COMMENT 'Snapshot (audit)',
    ldg_memo                    VARCHAR(200)             DEFAULT NULL,
    ldg_recorded_by             BIGINT UNSIGNED          DEFAULT NULL,
    ldg_recorded_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ldg_id),
    KEY idx_tac_pay_ledger_pod (pod_id, ldg_recorded_at),
    CONSTRAINT fk_tac_pay_ledger_order       FOREIGN KEY (pod_id)  REFERENCES tac_pay_orders(pod_id),
    CONSTRAINT fk_tac_pay_ledger_refund_tier FOREIGN KEY (rpt_id)  REFERENCES tac_pay_refund_policy_tiers(rpt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Receipts — repurposed v1.3: 간이/현금영수증만. 세금계산서는 tac_pay_tax_invoices. (colPrefix: rct)
CREATE TABLE tac_pay_receipts (
    rct_id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pod_id                  BIGINT UNSIGNED NOT NULL,
    rct_receipt_type        VARCHAR(20)     NOT NULL COMMENT 'CASH_RECEIPT(현금영수증) / SIMPLE(간이)',
    rct_issued_at           DATETIME        NOT NULL,
    rct_pdf_url             VARCHAR(500)             DEFAULT NULL,
    rct_cash_receipt_no     VARCHAR(64)              DEFAULT NULL COMMENT 'NTS 현금영수증 승인번호',
    rct_buyer_identifier    VARBINARY(128)           DEFAULT NULL COMMENT '암호화 저장(휴대폰/주민번호)',
    rct_canceled_at         DATETIME                 DEFAULT NULL,
    PRIMARY KEY (rct_id),
    KEY idx_tac_pay_receipts_pod (pod_id),
    CONSTRAINT fk_tac_pay_receipts_order FOREIGN KEY (pod_id) REFERENCES tac_pay_orders(pod_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tax Invoices (FR-048) — self-issued via NTS eTax API, v1.3 new (colPrefix: txi)
CREATE TABLE tac_pay_tax_invoices (
    txi_id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pod_id                  BIGINT UNSIGNED NOT NULL,
    acd_id                  BIGINT UNSIGNED NOT NULL,
    txi_invoice_no          VARCHAR(40)     NOT NULL COMMENT 'Internal (academy-YYYY-seq)',
    txi_nts_issue_no        VARCHAR(24)              DEFAULT NULL COMMENT '국세청 발급승인번호',
    txi_supplier_biz_no     VARCHAR(13)     NOT NULL COMMENT '공급자(학원) 사업자번호',
    txi_buyer_biz_no        VARCHAR(13)              DEFAULT NULL COMMENT '공급받는자 사업자번호',
    txi_buyer_type          VARCHAR(20)     NOT NULL COMMENT 'CORP(사업자) | INDIVIDUAL(개인)',
    txi_supply_amount       DECIMAL(12,2)   NOT NULL,
    txi_tax_amount          DECIMAL(12,2)   NOT NULL,
    txi_total_amount        DECIMAL(12,2)   NOT NULL,
    txi_issue_date          DATE            NOT NULL,
    txi_status              VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
        COMMENT 'DRAFT/SUBMITTED/APPROVED/REJECTED/CANCELED',
    txi_nts_submitted_at    DATETIME                 DEFAULT NULL,
    txi_nts_approved_at     DATETIME                 DEFAULT NULL,
    txi_nts_error_code      VARCHAR(30)              DEFAULT NULL,
    txi_nts_error_message   VARCHAR(500)             DEFAULT NULL,
    txi_xml_payload_url     VARCHAR(500)             DEFAULT NULL COMMENT 'S3: signed eTax XML',
    txi_pdf_url             VARCHAR(500)             DEFAULT NULL COMMENT 'S3: buyer-facing PDF',
    txi_created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    txi_updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                              ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (txi_id),
    UNIQUE KEY uq_tac_pay_tax_invoices_acd_no (acd_id, txi_invoice_no),
    KEY idx_tac_pay_tax_invoices_pod (pod_id),
    KEY idx_tac_pay_tax_invoices_status_date (txi_status, txi_nts_submitted_at),
    CONSTRAINT fk_tac_pay_tax_invoices_order   FOREIGN KEY (pod_id) REFERENCES tac_pay_orders(pod_id),
    CONSTRAINT fk_tac_pay_tax_invoices_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT chk_tac_pay_tax_invoices_totals CHECK (txi_total_amount = txi_supply_amount + txi_tax_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Users (colPrefix: usr)
-- ----------------------------
CREATE TABLE tac_users (
    usr_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id             BIGINT UNSIGNED NOT NULL,
    usr_email          VARCHAR(200)    NOT NULL,
    usr_password       VARCHAR(200)    NOT NULL COMMENT 'bcrypt hash',
    usr_name           VARCHAR(100)    NOT NULL,
    usr_role           VARCHAR(20)     NOT NULL DEFAULT 'STAFF'
        COMMENT 'MASTER/ADMIN/TEACHER/ACCOUNTANT/STAFF',
    usr_status         VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    usr_last_login_at  DATETIME                 DEFAULT NULL,
    usr_created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usr_updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usr_id),
    UNIQUE KEY uq_tac_users_email (usr_email),
    KEY idx_tac_users_acd_role (acd_id, usr_role),
    CONSTRAINT fk_tac_users_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Audit Logs (colPrefix: adl)
-- ----------------------------
CREATE TABLE tac_audit_logs (
    adl_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id           BIGINT UNSIGNED NOT NULL,
    adl_user_id      BIGINT UNSIGNED          DEFAULT NULL,
    adl_action       VARCHAR(50)     NOT NULL COMMENT 'CREATE/READ/UPDATE/DELETE/DECRYPT',
    adl_entity_type  VARCHAR(50)     NOT NULL COMMENT 'STUDENT/PARENT/PAYMENT/...',
    adl_entity_id    BIGINT UNSIGNED NOT NULL,
    adl_field_name   VARCHAR(100)             DEFAULT NULL COMMENT 'PII field name (FN-039)',
    adl_old_value    TEXT                     DEFAULT NULL,
    adl_new_value    TEXT                     DEFAULT NULL,
    adl_ip           VARCHAR(45)              DEFAULT NULL,
    adl_user_agent   VARCHAR(500)             DEFAULT NULL,
    adl_reason       VARCHAR(200)             DEFAULT NULL COMMENT 'Access reason (FN-039)',
    adl_created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (adl_id),
    KEY idx_tac_audit_logs_acd_entity (acd_id, adl_entity_type, adl_entity_id),
    KEY idx_tac_audit_logs_user (adl_user_id, adl_created_at),
    CONSTRAINT fk_tac_audit_logs_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_audit_logs_user    FOREIGN KEY (adl_user_id) REFERENCES tac_users(usr_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Main Portal
-- ----------------------------

-- Consultation Intake Form (colPrefix: cif)
CREATE TABLE tac_consultation_intake_form (
    cif_id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                 BIGINT UNSIGNED NOT NULL,
    cif_parent_name        VARCHAR(100)    NOT NULL,
    cif_phone              VARCHAR(30)     NOT NULL,
    cif_email              VARCHAR(200)             DEFAULT NULL,
    cif_child_grade        VARCHAR(20)              DEFAULT NULL,
    cif_program_interest   VARCHAR(100)             DEFAULT NULL,
    cif_preferred_date     DATE                     DEFAULT NULL,
    cif_message            TEXT                     DEFAULT NULL,
    cif_is_consent_pi      BOOLEAN         NOT NULL DEFAULT FALSE,
    cif_captcha_score      DECIMAL(3,2)             DEFAULT NULL,
    cif_ip                 VARCHAR(45)              DEFAULT NULL,
    cif_user_agent         VARCHAR(500)             DEFAULT NULL,
    cif_status             VARCHAR(20)     NOT NULL DEFAULT 'NEW'
        COMMENT 'NEW/PROMOTED/SPAM/DUPLICATE',
    cif_promoted_cst_id    BIGINT UNSIGNED          DEFAULT NULL,
    cif_created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cif_id),
    KEY idx_tac_consultation_intake_form_acd_status (acd_id, cif_status, cif_created_at),
    CONSTRAINT fk_tac_consultation_intake_form_academy      FOREIGN KEY (acd_id)            REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_consultation_intake_form_consultation FOREIGN KEY (cif_promoted_cst_id) REFERENCES tac_consultations(cst_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Posts (colPrefix: pst)
CREATE TABLE tac_posts (
    pst_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id                BIGINT UNSIGNED NOT NULL,
    pst_slug              VARCHAR(200)    NOT NULL,
    pst_title             VARCHAR(200)    NOT NULL,
    pst_body_md           MEDIUMTEXT      NOT NULL,
    pst_cover_image_url   VARCHAR(500)             DEFAULT NULL,
    pst_author_user_id    BIGINT UNSIGNED          DEFAULT NULL,
    pst_published_at      DATETIME                 DEFAULT NULL,
    pst_status            VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
        COMMENT 'DRAFT/PUBLISHED/ARCHIVED',
    pst_category          VARCHAR(30)     NOT NULL DEFAULT 'NOTICE'
        COMMENT 'RESULT/EVENT/NOTICE',
    pst_created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pst_updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                          ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (pst_id),
    UNIQUE KEY uq_tac_posts_acd_slug (acd_id, pst_slug),
    KEY idx_tac_posts_published (acd_id, pst_status, pst_published_at),
    KEY idx_tac_posts_acd_cat_pub (acd_id, pst_category, pst_status, pst_published_at),
    CONSTRAINT fk_tac_posts_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Convenience View
-- ----------------------------
CREATE OR REPLACE VIEW v_tac_enrollment_payments AS
SELECT
    e.enr_id,
    e.acd_id,
    e.cls_id,
    e.std_id,
    e.enr_status,
    po.pod_id,
    po.pod_order_no,
    po.pod_amount,
    po.pod_status,
    po.pod_approved_at
FROM tac_enrollments e
LEFT JOIN tac_pay_orders po ON po.enr_id = e.enr_id;
