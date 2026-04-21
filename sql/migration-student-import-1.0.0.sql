-- =============================================================
-- Trinity Academy — Migration: Student Import Schema Augmentation
-- Document: STUDENT-IMPORT-TASK-1.0.0
-- Version: 1.0.0
-- Target: MySQL 8.0+
-- Purpose: Add columns to tac_students / tac_enrollments so that the
--          15 Excel columns in `docs/reference/TPI 학생 정보.xlsx`
--          (sheet `현재 등록 학생`) can be imported without loss.
--
-- Usage (UP):
--   docker exec -i tac-mysql mysql -uroot -ppassword db_tac \
--     < sql/migration-student-import-1.0.0.sql
--
-- Usage (DOWN): see block at end of file — uncomment and run.
-- =============================================================

SET NAMES utf8mb4;

-- -------------------------------------------------------------
-- UP — tac_students: cohort, residence, curriculum text, note,
--      english nickname, student-owned phone (encrypted, reserved)
-- -------------------------------------------------------------
ALTER TABLE tac_students
    ADD COLUMN std_english_name    VARCHAR(100)   DEFAULT NULL
        COMMENT 'English nickname parsed from "홍길동(Jamy)" (STUDENT-IMPORT-1.0.0)'
        AFTER std_name,
    ADD COLUMN std_residence       VARCHAR(200)   DEFAULT NULL
        COMMENT '거주지 — free text (city/region) (STUDENT-IMPORT-1.0.0)'
        AFTER std_grade,
    ADD COLUMN std_cohort_label    VARCHAR(50)    DEFAULT NULL
        COMMENT 'Cohort tag (e.g. Santa Croce) for group labels without a class (STUDENT-IMPORT-1.0.0)'
        AFTER std_residence,
    ADD COLUMN std_curriculum_text TEXT           DEFAULT NULL
        COMMENT 'Free-form curriculum summary; structured N:M relation deferred (STUDENT-IMPORT-1.0.0)'
        AFTER std_cohort_label,
    ADD COLUMN std_note            TEXT           DEFAULT NULL
        COMMENT '특이사항 — free-form note (STUDENT-IMPORT-1.0.0)'
        AFTER std_curriculum_text,
    ADD COLUMN std_phone_encrypted VARBINARY(255) DEFAULT NULL
        COMMENT 'Student-owned phone (AES-GCM, NFR-005). Reserved column; no data yet (STUDENT-IMPORT-1.0.0)'
        AFTER std_note,
    ADD KEY idx_tac_students_acd_cohort (acd_id, std_cohort_label);

-- -------------------------------------------------------------
-- UP — tac_enrollments: per-enrollment materials and memo
-- -------------------------------------------------------------
ALTER TABLE tac_enrollments
    ADD COLUMN enr_materials JSON DEFAULT NULL
        COMMENT 'Per-enrollment textbook / material assignment (STUDENT-IMPORT-1.0.0)'
        AFTER enr_status,
    ADD COLUMN enr_memo      TEXT DEFAULT NULL
        COMMENT 'Free-form enrollment note (STUDENT-IMPORT-1.0.0)'
        AFTER enr_materials;

SELECT '✅ Migration STUDENT-IMPORT-1.0.0 applied' AS result;

-- =============================================================
-- DOWN (rollback) — uncomment to revert:
-- =============================================================
-- ALTER TABLE tac_enrollments
--     DROP COLUMN enr_memo,
--     DROP COLUMN enr_materials;
--
-- ALTER TABLE tac_students
--     DROP INDEX idx_tac_students_acd_cohort,
--     DROP COLUMN std_phone_encrypted,
--     DROP COLUMN std_note,
--     DROP COLUMN std_curriculum_text,
--     DROP COLUMN std_cohort_label,
--     DROP COLUMN std_residence,
--     DROP COLUMN std_english_name;
