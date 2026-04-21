-- =============================================================
-- Trinity Academy — TPI Student Data Seed
-- Document: STUDENT-IMPORT-TASK-1.0.0
-- Version: 1.0.0
-- Source:   docs/reference/TPI 학생 정보.xlsx — sheet `현재 등록 학생` (24 students)
-- Depends:  seed-dev.sql (academy) + migration-student-import-1.0.0.sql (columns)
--
-- Usage:
--   docker exec -i tac-mysql mysql -uroot -ppassword db_tac \
--     < sql/seed-tpi-students.sql
--
-- NOTE: This is a ONE-SHOT migration seed. Student rows do not have
--       a natural unique key; re-running will create duplicates.
--       Master rows (parent/teacher/program/classroom) are idempotent
--       via INSERT IGNORE on their unique constraints.
-- =============================================================

SET NAMES utf8mb4;

-- -------------------------------------------------------------
-- 0. Resolve academy id (created by seed-dev.sql)
-- -------------------------------------------------------------
SET @academy_id = (
    SELECT acd_id FROM tac_academies
     WHERE acd_business_registration_no = '123-45-67890'
     LIMIT 1
);

-- Hard fail early if seed-dev.sql was not run.
SELECT IF(@academy_id IS NULL,
    (SELECT * FROM (SELECT 'ERROR: academy not found — run seed-dev.sql first') x),
    CONCAT('✅ Academy resolved: acd_id=', @academy_id)
) AS step_0;

-- -------------------------------------------------------------
-- 1. Placeholder guardian (shared across 24 students)
--    Replace with real guardian records as they are collected.
-- -------------------------------------------------------------
INSERT INTO tac_parents (acd_id, prt_name, prt_preferred_channel)
SELECT @academy_id, '[MIGRATED] Unknown Guardian', 'SMS'
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_parents
     WHERE acd_id = @academy_id AND prt_name = '[MIGRATED] Unknown Guardian'
 );
SET @placeholder_parent_id = (
    SELECT prt_id FROM tac_parents
     WHERE acd_id = @academy_id AND prt_name = '[MIGRATED] Unknown Guardian'
     LIMIT 1
);

-- -------------------------------------------------------------
-- 2. Teachers (AMA Client IDs are placeholders — swap on AMA sync)
-- -------------------------------------------------------------
INSERT IGNORE INTO tac_teachers
    (acd_id, tch_ama_client_id, tch_employment_type, tch_cached_profile)
VALUES
    (@academy_id, 'PENDING-TPI-KTY', 'FULL_TIME', JSON_OBJECT('name','김태윤')),
    (@academy_id, 'PENDING-TPI-JSK', 'FULL_TIME', JSON_OBJECT('name','정성경')),
    (@academy_id, 'PENDING-TPI-TBD', 'FULL_TIME', JSON_OBJECT('name','TBD'));

SET @teacher_kty = (SELECT tch_id FROM tac_teachers WHERE acd_id=@academy_id AND tch_ama_client_id='PENDING-TPI-KTY');
SET @teacher_jsk = (SELECT tch_id FROM tac_teachers WHERE acd_id=@academy_id AND tch_ama_client_id='PENDING-TPI-JSK');
SET @teacher_tbd = (SELECT tch_id FROM tac_teachers WHERE acd_id=@academy_id AND tch_ama_client_id='PENDING-TPI-TBD');

-- -------------------------------------------------------------
-- 3. Programs (two cohorts: TPI, Santa Croce)
-- -------------------------------------------------------------
INSERT IGNORE INTO tac_programs
    (acd_id, prg_name, prg_category, prg_status)
VALUES
    (@academy_id, 'TPI Reading', 'READING', 'ACTIVE'),
    (@academy_id, 'Santa Croce Reading', 'READING', 'ACTIVE');

SET @prg_tpi = (SELECT prg_id FROM tac_programs WHERE acd_id=@academy_id AND prg_name='TPI Reading');
SET @prg_sc  = (SELECT prg_id FROM tac_programs WHERE acd_id=@academy_id AND prg_name='Santa Croce Reading');

-- -------------------------------------------------------------
-- 4. Classroom
-- -------------------------------------------------------------
INSERT IGNORE INTO tac_classrooms (acd_id, clr_name, clr_capacity, clr_status)
VALUES (@academy_id, 'Main', 20, 'ACTIVE');
SET @classroom_id = (SELECT clr_id FROM tac_classrooms WHERE acd_id=@academy_id AND clr_name='Main');

-- -------------------------------------------------------------
-- 5. Classes — 5 distinct classes per the plan §5.2
--    Idempotency: (acd, prg, tch, start_date) is treated as natural
--    key; re-runs re-use the existing cls_id.
-- -------------------------------------------------------------
INSERT INTO tac_classes
    (acd_id, prg_id, tch_id, clr_id, cls_start_date, cls_capacity, cls_status, cls_schedule_pattern)
SELECT @academy_id, @prg_tpi, @teacher_kty, @classroom_id,
       DATE '2024-12-02', 10, 'ACTIVE', JSON_ARRAY()
  FROM DUAL
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_kty AND cls_start_date=DATE '2024-12-02'
 );
SET @cls_tpi_kty_gpa = (
    SELECT cls_id FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_kty AND cls_start_date=DATE '2024-12-02'
     LIMIT 1
);

INSERT INTO tac_classes
    (acd_id, prg_id, tch_id, clr_id, cls_start_date, cls_capacity, cls_status, cls_schedule_pattern)
SELECT @academy_id, @prg_tpi, @teacher_jsk, @classroom_id,
       DATE '2025-04-22', 10, 'ACTIVE',
       JSON_ARRAY(JSON_OBJECT('weekday','FRI','start','08:30','end','09:30'))
  FROM DUAL
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_jsk AND cls_start_date=DATE '2025-04-22'
 );
SET @cls_tpi_jsk_fri = (
    SELECT cls_id FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_jsk AND cls_start_date=DATE '2025-04-22'
     LIMIT 1
);

INSERT INTO tac_classes
    (acd_id, prg_id, tch_id, clr_id, cls_start_date, cls_capacity, cls_status, cls_schedule_pattern)
SELECT @academy_id, @prg_tpi, @teacher_jsk, @classroom_id,
       DATE '2025-06-18', 10, 'ACTIVE',
       JSON_ARRAY(JSON_OBJECT('weekday','WED','start','08:00','end','10:00'))
  FROM DUAL
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_jsk AND cls_start_date=DATE '2025-06-18'
 );
SET @cls_tpi_jsk_wed = (
    SELECT cls_id FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_jsk AND cls_start_date=DATE '2025-06-18'
     LIMIT 1
);

INSERT INTO tac_classes
    (acd_id, prg_id, tch_id, clr_id, cls_start_date, cls_capacity, cls_status, cls_schedule_pattern)
SELECT @academy_id, @prg_tpi, @teacher_tbd, @classroom_id,
       DATE '2024-12-01', 30, 'ACTIVE', JSON_ARRAY()
  FROM DUAL
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_tbd AND cls_start_date=DATE '2024-12-01'
 );
SET @cls_tpi_placeholder = (
    SELECT cls_id FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_tpi
       AND tch_id=@teacher_tbd AND cls_start_date=DATE '2024-12-01'
     LIMIT 1
);

INSERT INTO tac_classes
    (acd_id, prg_id, tch_id, clr_id, cls_start_date, cls_capacity, cls_status, cls_schedule_pattern)
SELECT @academy_id, @prg_sc, @teacher_tbd, @classroom_id,
       DATE '2024-12-01', 20, 'ACTIVE', JSON_ARRAY()
  FROM DUAL
 WHERE NOT EXISTS (
    SELECT 1 FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_sc
       AND tch_id=@teacher_tbd AND cls_start_date=DATE '2024-12-01'
 );
SET @cls_sc_placeholder = (
    SELECT cls_id FROM tac_classes
     WHERE acd_id=@academy_id AND prg_id=@prg_sc
       AND tch_id=@teacher_tbd AND cls_start_date=DATE '2024-12-01'
     LIMIT 1
);

SELECT CONCAT('✅ Classes: kty_gpa=',@cls_tpi_kty_gpa,
              ' jsk_fri=',@cls_tpi_jsk_fri,
              ' jsk_wed=',@cls_tpi_jsk_wed,
              ' tpi_ph=',@cls_tpi_placeholder,
              ' sc_ph=',@cls_sc_placeholder) AS step_5;

-- -------------------------------------------------------------
-- 6. Staging table — normalized 24 students
-- -------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_tpi_import;
CREATE TEMPORARY TABLE tmp_tpi_import (
    src_row         INT,
    cohort          VARCHAR(50),
    start_date      DATE,
    name_kr         VARCHAR(100),
    english_name    VARCHAR(100),
    gender          CHAR(1),
    grade           VARCHAR(20),
    school          VARCHAR(100),
    residence       VARCHAR(200),
    teacher_ama     VARCHAR(64),
    curriculum      TEXT,
    note            TEXT,
    class_tag       VARCHAR(30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO tmp_tpi_import (src_row,cohort,start_date,name_kr,english_name,gender,grade,school,residence,teacher_ama,curriculum,note,class_tag) VALUES
    ( 4,'TPI',        '2024-12-02','강병찬',NULL,      'M','6','SSIS','중국',                 'PENDING-TPI-KTY','GPA 관리',                                                NULL,'TPI-KTY-GPA'),
    ( 5,'TPI',        '2024-12-02','강소율',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    ( 6,'TPI',        '2025-06-05','구본의',NULL,      'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    ( 7,'TPI',        '2024-12-14','혜리',  NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    ( 8,'TPI',        '2024-12-23','이재인',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    ( 9,'TPI',        '2025-05-06','정윤아',NULL,      'F','6',NULL,NULL,                     NULL,                NULL,                                                      NULL,'TPI-PH'),
    (10,'TPI',        '2025-05-06','정윤지',NULL,      'F','5',NULL,NULL,                     NULL,                NULL,                                                      NULL,'TPI-PH'),
    (11,'TPI',        '2025-04-22','김민',  NULL,      'F','4',NULL,'보스턴, 메사추세츠',       'PENDING-TPI-JSK','MAP, ISEE Reading',                                      '2026년 8월 KIS 판교 입학예정','TPI-JSK-FRI'),
    (12,'TPI',        '2025-08-09','김아이비',NULL,    'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (13,'TPI',        '2025-11-04','이태오',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (15,'TPI',        '2025-06-06','정하율',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (16,'TPI',        '2025-06-18','김지환',NULL,      'M','8','Edison Middle School','샴페인, 일리노이','PENDING-TPI-JSK','MAP, ISEE, SSAT Reading\nKIS 입학시험 진행중',        NULL,'TPI-JSK-WED'),
    (17,'TPI',        '2025-10-02','김하음',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (19,'TPI',        '2026-04-09','이채현',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (20,'TPI',        '2026-04-13','황채민',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'TPI-PH'),
    (23,'Santa Croce','2024-12-06','이윤건',NULL,      'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH'),
    (24,'Santa Croce','2024-12-06','이윤후',NULL,      'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH'),
    (25,'Santa Croce','2026-04-05','김라희',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH'),
    (26,'Santa Croce','2026-03-02','박지온',NULL,      NULL,NULL,NULL,NULL,                   NULL,                NULL,                                                      NULL,'SC-PH'),
    (27,'Santa Croce','2025-08-25','정수인',NULL,      'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH'),
    (28,'Santa Croce', NULL,       '장연우','Jamy',    'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL, NULL),
    (29,'Santa Croce', NULL,       '장연서','Janie',   'F',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL, NULL),
    (30,'Santa Croce','2026-02-23','석예준',NULL,      'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH'),
    (31,'Santa Croce','2026-02-23','석유준',NULL,      'M',NULL,NULL,NULL,                    NULL,                NULL,                                                      NULL,'SC-PH');

-- -------------------------------------------------------------
-- 7. Insert students (src_row preserved via std_note prefix? No —
--    std_note keeps original 특이사항. Traceability is not required.)
-- -------------------------------------------------------------
INSERT INTO tac_students
    (acd_id, prt_id, std_name, std_english_name, std_birth_date, std_gender,
     std_school, std_grade, std_residence, std_cohort_label,
     std_curriculum_text, std_note,
     std_status, std_lifecycle_status)
SELECT
    @academy_id,
    @placeholder_parent_id,
    s.name_kr,
    s.english_name,
    NULL,                    -- 생년월일 — Excel 비어있음
    s.gender,
    s.school,
    s.grade,
    s.residence,
    s.cohort,
    s.curriculum,
    s.note,
    'ACTIVE',
    CASE WHEN s.class_tag IS NULL THEN 'CONSULTING' ELSE 'ACTIVE' END
FROM tmp_tpi_import s
ORDER BY s.src_row;

-- -------------------------------------------------------------
-- 8. Enrollments — one per student with a class_tag
-- -------------------------------------------------------------
INSERT INTO tac_enrollments
    (acd_id, cls_id, std_id, enr_applied_prt_id, enr_status, enr_applied_at, enr_confirmed_at, enr_memo)
SELECT
    @academy_id,
    CASE s.class_tag
        WHEN 'TPI-KTY-GPA' THEN @cls_tpi_kty_gpa
        WHEN 'TPI-JSK-FRI' THEN @cls_tpi_jsk_fri
        WHEN 'TPI-JSK-WED' THEN @cls_tpi_jsk_wed
        WHEN 'TPI-PH'      THEN @cls_tpi_placeholder
        WHEN 'SC-PH'       THEN @cls_sc_placeholder
    END AS cls_id,
    st.std_id,
    @placeholder_parent_id,
    'CONFIRMED',
    TIMESTAMP(s.start_date),
    TIMESTAMP(s.start_date),
    CONCAT('Imported from TPI 학생 정보.xlsx row ', s.src_row)
FROM tmp_tpi_import s
JOIN tac_students st
  ON st.acd_id = @academy_id
 AND st.std_name = s.name_kr
 AND ( (st.std_english_name <=> s.english_name) )
WHERE s.class_tag IS NOT NULL
  AND s.start_date IS NOT NULL;

-- -------------------------------------------------------------
-- 9. Sync cls_enrolled_count
-- -------------------------------------------------------------
UPDATE tac_classes c
   SET c.cls_enrolled_count = (
       SELECT COUNT(*) FROM tac_enrollments e
        WHERE e.cls_id = c.cls_id AND e.enr_status = 'CONFIRMED'
   )
 WHERE c.acd_id = @academy_id;

DROP TEMPORARY TABLE IF EXISTS tmp_tpi_import;

-- -------------------------------------------------------------
-- 10. Verification
-- -------------------------------------------------------------
SELECT '— verification —' AS section;
SELECT std_cohort_label AS cohort, COUNT(*) AS count
  FROM tac_students
 WHERE acd_id = @academy_id
 GROUP BY std_cohort_label;

SELECT COUNT(*) AS enrollments FROM tac_enrollments WHERE acd_id = @academy_id;

SELECT t.tch_ama_client_id AS teacher, COUNT(*) AS students
  FROM tac_enrollments e
  JOIN tac_classes     c ON c.cls_id = e.cls_id
  JOIN tac_teachers    t ON t.tch_id = c.tch_id
 WHERE e.acd_id = @academy_id
 GROUP BY t.tch_ama_client_id
 ORDER BY students DESC;

SELECT '✅ TPI student seed complete' AS result;
