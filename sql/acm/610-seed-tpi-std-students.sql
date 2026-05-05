-- ============================================================
-- ACM STD — TPI 현재 등록 학생 시드 데이터
-- Source: docs/reference/TPI 학생 정보.xlsx — 현재 등록 학생
-- Generated: 2026-05-05
-- Idempotent: ON CONFLICT (ent_id, std_name) DO UPDATE
-- ============================================================

-- ent_id for Trinity Academy (TPI): 00000000-0000-0000-0000-000000000001

-- UNIQUE constraint required for ON CONFLICT upsert (idempotent)
ALTER TABLE amb_acm_std_student
  ADD CONSTRAINT IF NOT EXISTS uq_acm_std_ent_name UNIQUE (ent_id, std_name);

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('6aad5b81-0a10-4a38-bfec-c42c85e825a9', '00000000-0000-0000-0000-000000000001', '강병찬', NULL,
        'M', NULL,
        NULL, '중국',
        'SSIS', '6',
        NULL, NULL, NULL, NULL,
        '김태윤', NULL, 'GPA 관리', NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-02', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('5880a57c-d734-44fa-aeaf-d054ae08235a', '00000000-0000-0000-0000-000000000001', '강소율', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-02', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('64e300ba-ab72-41a6-a463-754aa259d6f6', '00000000-0000-0000-0000-000000000001', '구본의', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-06-05', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('2a389716-19a9-4088-be59-2555a7adfc78', '00000000-0000-0000-0000-000000000001', '혜리', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-14', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('2bb6a809-09b2-448b-b62c-79f1af1e4e28', '00000000-0000-0000-0000-000000000001', '이재인', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-23', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('59dbc99a-b84f-4d2c-9569-f591526c5124', '00000000-0000-0000-0000-000000000001', '정윤아', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, '6',
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-05-06', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('eb8dafe7-0af4-4c67-a4db-b9f10cc4436c', '00000000-0000-0000-0000-000000000001', '정윤지', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, '5',
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-05-06', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('d1ced1b3-545b-44f4-acf0-99c95be88562', '00000000-0000-0000-0000-000000000001', '김민', NULL,
        'F', NULL,
        NULL, '보스턴, 메사추세츠',
        NULL, '4',
        NULL, NULL, NULL, NULL,
        '정성경', NULL, 'MAP, ISEE Reading', NULL, '{"raw": "금 08:30-09:30"}',
        NULL, NULL, NULL, '2026년 8월 KIS 판교 입학예정',
        NULL, NULL, NULL,
        '2025-04-22', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('d6aadae1-7709-46ac-b688-fa24cf3ac86b', '00000000-0000-0000-0000-000000000001', '김아이비', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-08-09', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('e205bb24-613d-431a-b260-d4e46665cf07', '00000000-0000-0000-0000-000000000001', '이태오', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-11-04', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('cc9b756a-0d4e-4c49-bee3-332baa4c6241', '00000000-0000-0000-0000-000000000001', '정하율', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-06-06', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('9d1347d0-f289-4621-9f32-f817febeff4a', '00000000-0000-0000-0000-000000000001', '김지환', NULL,
        'M', NULL,
        NULL, '샴페인, 일리노이',
        'Edison Middle School', '8',
        NULL, NULL, NULL, NULL,
        '정성경', NULL, 'MAP, ISEE, SSAT Reading
KIS 입학시험 진행중', NULL, '{"raw": "수 08:00-10:00"}',
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-06-18', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('d2c89971-5d7c-443e-be77-6c42832a41c6', '00000000-0000-0000-0000-000000000001', '김하음', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-10-02', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('530c7c10-d247-4234-92fb-a37ef567b0af', '00000000-0000-0000-0000-000000000001', '이채현', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-04-09', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('1741bf15-8f98-431d-be61-915ce42f9336', '00000000-0000-0000-0000-000000000001', '황채민', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-04-13', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('9d4b6630-f5fe-4b83-8095-74203d62050d', '00000000-0000-0000-0000-000000000001', '이윤건', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-06', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('c0f68e4c-16a2-41c8-b534-f842e994b011', '00000000-0000-0000-0000-000000000001', '이윤후', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2024-12-06', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('9a99c9b5-f37a-4624-b4f1-e8847a0cb941', '00000000-0000-0000-0000-000000000001', '김라희', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-04-05', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('d0a687d4-988d-45be-b1ff-3a336b4025a9', '00000000-0000-0000-0000-000000000001', '박지온', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-03-02', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('8062c814-70ce-471f-bb24-08ff4acd28a1', '00000000-0000-0000-0000-000000000001', '정수인', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2025-08-25', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('f7c10fa7-a5b8-44f0-bcf4-5c89d929b499', '00000000-0000-0000-0000-000000000001', '장연우(Jamy)', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('f14e8d04-619a-4516-8a8a-7e0e7fd6f2dc', '00000000-0000-0000-0000-000000000001', '장연서(Janie)', NULL,
        'F', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('a41b5202-81ea-4897-aa3c-de9ea4aa2272', '00000000-0000-0000-0000-000000000001', '석예준', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-02-23', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();

INSERT INTO amb_acm_std_student
  (std_id, ent_id, std_name, std_english_name, std_gender, std_birth_date,
   std_phone, std_residence, std_school, std_grade,
   std_map_reading, std_map_math, std_map_language, std_map_note,
   std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json,
   std_mobility, std_gpa, std_ssat_isee_note, std_special_note,
   std_goals_note, std_satisfaction_note, std_last_counsel_date,
   std_start_date, std_status, created_at, updated_at)
VALUES ('b656304e-343a-404e-95b5-b1fcdae1572b', '00000000-0000-0000-0000-000000000001', '석유준', NULL,
        'M', NULL,
        NULL, NULL,
        NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        '2026-02-23', 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = EXCLUDED.std_gender, std_phone = EXCLUDED.std_phone,
  std_birth_date = EXCLUDED.std_birth_date, std_school = EXCLUDED.std_school,
  std_grade = EXCLUDED.std_grade, std_map_reading = EXCLUDED.std_map_reading,
  std_map_math = EXCLUDED.std_map_math, std_map_language = EXCLUDED.std_map_language,
  std_teacher = EXCLUDED.std_teacher, std_curriculum = EXCLUDED.std_curriculum,
  std_materials = EXCLUDED.std_materials, std_schedule_json = EXCLUDED.std_schedule_json,
  std_residence = EXCLUDED.std_residence, std_special_note = EXCLUDED.std_special_note,
  std_start_date = EXCLUDED.std_start_date, updated_at = NOW();
