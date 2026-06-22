-- ============================================================
-- 941 — ACM STD seed update from "TPI 학생 정보-202606.xlsx" (2026-06-21)
-- Source: docs/reference/TPI 학생 정보-202606.xlsx  (5 sheets)
-- Depends on: 940-acm-std-student-extension.sql (REQ-260621)
-- Idempotent: ON CONFLICT (ent_id, std_name) DO UPDATE
-- Notes:
--   · Tenants: TPI = 00000000-…-001  ·  Santa Croce = 00000000-…-002
--   · 학부모 정보·강사 FK 부재 → 후속 보완 (NULL / free-text 유지)
--   · 종료 사유 enum: 모두 'OTHER' + 원문은 std_end_note 에 보존
--   · 우선순위 머지: 현재 등록 > 수업 종료 > 구 학생 정보 (legacy archive)
-- ============================================================

-- 1. Tenant registry — Santa Croce 추가 (TPI 는 520 에서 시드됨)
INSERT INTO amb_acm_tenant (tnt_ent_id, tnt_name, tnt_status, tnt_is_system)
VALUES ('00000000-0000-0000-0000-000000000002', 'Santa Croce', 'ACTIVE', false)
ON CONFLICT (tnt_ent_id) DO NOTHING;

-- 2. Ensure uq_acm_std_ent_name 제약 존재 (610 에서 이미 생성, 멱등 가드)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_std_ent_name') THEN
    ALTER TABLE amb_acm_std_student ADD CONSTRAINT uq_acm_std_ent_name UNIQUE (ent_id, std_name);
  END IF;
END $$;

-- 3. TPI ent (00000000-0000-0000-0000-000000000001) — current+terminated+legacy 머지 결과
INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('f977f959-ca34-5acd-bd95-ac0178a6763d', '00000000-0000-0000-0000-000000000001', 'Emilia 혜리 Deusing', 'F', NULL, 'aprilchoi99', '네덜란드', NULL, '7', NULL, NULL, NULL, '김경진', NULL, NULL, '1) SSAT Upper Level Official Guide 

완료 
1) Mometrix SSAT Middle Level Prep Book 
2) Mometrix ISEE Upper Level Prep Book 
3) SSAT Voca_Mid', '{"raw_lines": ["토 20:00-22:00"]}'::jsonb, '어머님 한국인, 아버님 독일인', '2024-12-14', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('55cecd3d-6ae4-5dc8-9221-654309997fa0', '00000000-0000-0000-0000-000000000001', 'Erica', NULL, NULL, '010-5054-7792', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('43bc6c91-03a0-54fd-8dd5-f147e661be28', '00000000-0000-0000-0000-000000000001', 'Santa Croce', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1a6911a0-9c7a-5f77-89a8-9c883347cf32', '00000000-0000-0000-0000-000000000001', '강병찬', 'M', '2014-01-12', NULL, '중국', 'SSIS', '6', NULL, NULL, NULL, '김태윤', NULL, 'GPA 관리', '1) Vocabulary MCQs 5 
2) Great Writing 3', '{"raw_lines": ["화 20:00-21:00", "목 21:00-22:00"]}'::jsonb, NULL, '2024-12-02', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('e9a4c24b-4d1b-5e1d-8963-72470b327547', '00000000-0000-0000-0000-000000000001', '강소율', 'F', '2015-07-07', NULL, '중국', 'SSIS', '4', NULL, NULL, NULL, '김태윤', NULL, 'GPA 관리', '1) Vocabulary MCQs 4 
2) Great Writing 3 
완료: Great Writing 2', '{"raw_lines": ["월 19:30-20:30", "수 20:00-21:00"]}'::jsonb, NULL, '2024-12-02', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('ebcbe898-5356-5184-b229-6cf348c308c4', '00000000-0000-0000-0000-000000000001', '강윤하', NULL, NULL, NULL, NULL, NULL, '3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('11f80d8e-5d33-5753-98e2-f1eaba485118', '00000000-0000-0000-0000-000000000001', '고유진/Chloe', NULL, NULL, '010-9500-5516', NULL, '서원초', '1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1f764249-e99b-51e6-a849-cf1f7e1de0e1', '00000000-0000-0000-0000-000000000001', '구본의', 'M', '2012-03-26', '010-8386-1221', '서울', 'SIS', '7', NULL, NULL, NULL, '김태윤', NULL, 'MAP Reading 
Essay', '1) Vocabulary MCQs 4  
2) MAP G6 up Intermediate
3) Writing - Topic 위주, 교재 없음', '{"raw_lines": ["월 18:30-19:30", "목 19:30-21:00"]}'::jsonb, NULL, '2025-06-05', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('9460dd29-220a-548d-9447-4038526a3c3d', '00000000-0000-0000-0000-000000000001', '구시언', NULL, '2014-08-01', '010-3755-9530', NULL, 'SSIS', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('e91db722-b1b3-5480-b213-b4a2b72c6752', '00000000-0000-0000-0000-000000000001', '구시완', NULL, NULL, NULL, '미국', NULL, '9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('13feb898-9ff4-583a-ba41-69f6164e9352', '00000000-0000-0000-0000-000000000001', '권효민', NULL, '2011-05-07', '010-9015-4408', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('c1164ac7-5568-59c5-a995-0d21c791bd7d', '00000000-0000-0000-0000-000000000001', '김규민', NULL, '2013-05-20', '010-7709-9614', NULL, '부산동성초', '5', NULL, NULL, NULL, NULL, NULL, 'MAP TEST', NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b8fcadda-d4bb-5113-a059-127a5f6e279b', '00000000-0000-0000-0000-000000000001', '김라엘', 'F', '2010-12-29', '010-5333-4299', NULL, NULL, NULL, NULL, NULL, NULL, '조혜수, 김태윤', NULL, 'MAP', NULL, NULL, NULL, '2026-04-20', '2026-04-23', 'OTHER', '4/27 코너스톤 입학 시험 전 종료', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('41e620d5-2d42-584d-8468-be84ae8893e5', '00000000-0000-0000-0000-000000000001', '김라희', 'F', '2014-08-07', '010-3063-6400', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-05', '2026-04-19', 'OTHER', '4/23 KIS 시험 전 종료', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('75b989ba-f1c9-522c-97f2-a0313e31f2b6', '00000000-0000-0000-0000-000000000001', '김리나', NULL, '2014-09-16', '010-7709-9614', NULL, '부산동성초', '4', NULL, NULL, NULL, NULL, NULL, 'MAP TEST', NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('c888558e-86b9-543e-a9d5-d3e607fd6e66', '00000000-0000-0000-0000-000000000001', '김리환', NULL, '2017-06-26', '010-5225-9306', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1fd6d123-aeff-5f17-b6a6-8d271a6e2d4d', '00000000-0000-0000-0000-000000000001', '김민', 'F', '2016-03-21', NULL, '보스턴, 메사추세츠', 'Newton Countryside Elementry School', '4', NULL, NULL, NULL, '정성경', NULL, 'MAP, ISEE Reading', '1) SSAT and ISEE Middle Prep 
2) 4000 Essential English Words 4
2) IXL', '{"raw_lines": ["금 08:30-09:30"]}'::jsonb, '2026년 8월 KIS 판교 입학예정', '2025-04-22', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('ecc2ae33-272b-5a89-9d8e-53d1a1067c7a', '00000000-0000-0000-0000-000000000001', '김민건', NULL, '2011-07-25', '010-8557-2660', NULL, '신천중', '2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('7e438ac2-1034-54fc-a28d-b05ead0c8bb2', '00000000-0000-0000-0000-000000000001', '김민정', NULL, '2010-05-07', '010-4314-2355', NULL, '원촌중', '3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b6eff7c9-3267-5cc3-b7b2-f617a49c2250', '00000000-0000-0000-0000-000000000001', '김민주', NULL, '2012-08-24', '010-3198-8602', NULL, 'KIS', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('43d65c59-e2b5-5ab0-8fa8-ebe8817e7278', '00000000-0000-0000-0000-000000000001', '김민지', NULL, NULL, NULL, NULL, NULL, '5', NULL, NULL, NULL, '손민서', NULL, NULL, 'MAP RC Advanced', '{"raw_lines": ["금 21:00-22:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('833c418b-4ac4-52c0-9e18-fbbdc378e2a6', '00000000-0000-0000-0000-000000000001', '김세경', NULL, '2012-02-26', '010-3842-0954', '캐나다', NULL, 'G8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8fc76a76-7777-521c-9a9d-7572721e805d', '00000000-0000-0000-0000-000000000001', '김세나', NULL, NULL, '010-9722-6388', NULL, '숙명여중', '3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('cacede8c-3f20-5760-93f8-89329ab67317', '00000000-0000-0000-0000-000000000001', '김세원', NULL, '2012-06-26', '010-9722-6388', NULL, '숙명여중', '1', NULL, NULL, NULL, '손민서', NULL, NULL, NULL, '{"raw_lines": ["목/일"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('981a8341-e469-5bdc-b131-823b705d1c88', '00000000-0000-0000-0000-000000000001', '김아이린', 'F', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-09', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('34d53a62-b9ce-575d-a5bd-8b03645eb7f7', '00000000-0000-0000-0000-000000000001', '김아이비', 'F', '2018-02-22', '카카오톡 QR code', '홍콩', 'HKIS', '5', NULL, NULL, NULL, '김경진', NULL, 'MAP Test 대비', '1) MAP 기출 LU Advanced 
2) MAP 2026 신규문제 200-260 
3) Grammar In Use - Basic', '{"raw_lines": ["수, 토 17:00-18:00"]}'::jsonb, '5월 초 MAP 시험', '2025-08-09', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('19fb70d7-7299-52d6-a6d1-1cfa6b40b59d', '00000000-0000-0000-0000-000000000001', '김연우', 'F', '2012-02-21', '010-2654-6889', NULL, '광남중', '1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b00fe2fe-57d7-5095-9332-62eb01dc18bb', '00000000-0000-0000-0000-000000000001', '김영윤', 'M', '2013-02-07', '010-9196-1629', NULL, '언주초', '5', NULL, NULL, NULL, '김경진', 'map', '9/29(월) Fayston 입학시험', 'Cloze Practice 6
IXL Grammar, Mechanics
MAP RC G2-5 Intermediate
Intermediate Interview Questions 
MAP LU Advanced', '{"raw_lines": ["월/수 19:00-21:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('2399a84f-9959-5879-b432-1f1a7dcefca8', '00000000-0000-0000-0000-000000000001', '김예은', 'F', '2009-08-17', '010-9053-7698', '한국', 'KIS', '10', 254, 282, 266, '김효윤', NULL, NULL, '1) MAP RC G6 up Intermediate
2) MAP LU 신규문제 221-240', NULL, NULL, '2026-06-08', '2026-06-11', 'OTHER', '목요일 저녁 맵테스트 응시
월-목 단기 수업', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('3d1fd8a9-d2b9-5e35-b5e0-65ff7e80b3bd', '00000000-0000-0000-0000-000000000001', '김유리', NULL, '2011-06-10', '010-6348-0416', NULL, '센텀중', '7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('01528c42-67e2-5d5e-9c59-8c69175cc073', '00000000-0000-0000-0000-000000000001', '김윤', NULL, '2012-05-09', NULL, '미국', 'DSS', '7', NULL, NULL, NULL, '정성경', 'ssat', '10/11(토) SSAT 응시, 
11, 12월 추가 응시 예정 
2026년 1월 Boarding 입시 예정', 'SSAT Upper Level Prep Book
MAP RC G6 up - Intermediate 
4000 Essential English Words Book 5', '{"raw_lines": ["월 08:00-10:00", "금 8:00-10:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('2915533d-0536-5d44-8b41-dc6fc324a5a9', '00000000-0000-0000-0000-000000000001', '김주안', NULL, '2012-09-29', '010-9918-3140', NULL, '서일중', '1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('df5180f1-765e-5942-82a1-07be809cfcd5', '00000000-0000-0000-0000-000000000001', '김지오', NULL, NULL, '010-3734-3117', NULL, 'NLCS', '9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('da117699-2ded-56d7-973b-590287782c76', '00000000-0000-0000-0000-000000000001', '김지환', 'M', '2011-09-07', 'milano112900', '샴페인, 일리노이', 'Edison Middle School', '8', 202, 12, 237, '정성경', NULL, 'MAP, ISEE, SSAT Reading', '1) Kaplan SSAT&ISEE Prep Middle and Upper 
2) MAP 신규문제 
3) IXL 
4) SSAT Vocap Upper', '{"raw_lines": ["수 08:00-10:00"]}'::jsonb, 'KIS 제주 합격, 2026년 8월 G9 입학 예정', '2025-06-18', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8cdc6518-be9d-51a4-a4f3-aa2bd3d80c3a', '00000000-0000-0000-0000-000000000001', '김태민', NULL, '2013-08-11', '010-4654-7188', NULL, 'SIS', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('56cd11ae-9d3c-53e4-b348-42894b5df6d5', '00000000-0000-0000-0000-000000000001', '김하음', 'F', '2014-02-27', '010-4811-8297
gracelee83', '뉴질랜드', 'KingsWay School', 'Y7', NULL, NULL, NULL, '김태윤', NULL, 'MAP Test 대비
Reading, Math, 인터뷰', '1) MAP RC G6 up intermediate
2) IXL (Math)
3) 2026_Interview Questions', '{"raw_lines": ["목 14:00-15:00"]}'::jsonb, NULL, '2025-10-02', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('f4489e2b-e000-502b-853b-594a31689a39', '00000000-0000-0000-0000-000000000001', '김한별', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '김경진', NULL, NULL, NULL, '{"raw_lines": ["수 21:30-23:00", "토 15:00-17:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('d6b6c21e-94b3-55a3-85f2-d0254965b181', '00000000-0000-0000-0000-000000000001', '노영우', 'M', '2015-04-22', '010-6797-3272', '한국', 'bek', '6', NULL, NULL, NULL, '김태윤', NULL, '채드윅 지원 입학지원', '1) MAP RC G2-5 Intermediate
2) Prealgebra unit 1', '{"raw_lines": ["화, 목 17:15-18:45"]}'::jsonb, NULL, '2026-05-28', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('cbea6969-fc96-5676-a534-e20a5d47cc02', '00000000-0000-0000-0000-000000000001', '노하윤', NULL, NULL, NULL, NULL, NULL, '4', NULL, NULL, NULL, '임승희', 'map', NULL, 'Cloze Practice 4
501 Writing Prompts
MAP G6 up Basic, Intermediate
Opinion Writing 
MAP G2-5 Advanced', '{"raw_lines": ["월 21:30-23:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4d4e898e-9ef6-5038-b986-4adf7d67ca2f', '00000000-0000-0000-0000-000000000001', '듀오링고 G5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('28034b3f-ab9f-5c69-a428-b10df7b86abb', '00000000-0000-0000-0000-000000000001', '류이나', NULL, NULL, '010-4227-1778', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('6cb9876d-7257-5c8f-ba97-882fbc77e647', '00000000-0000-0000-0000-000000000001', '류인호', NULL, '2010-08-09', NULL, NULL, 'CDS', '8', NULL, NULL, NULL, '손민서', NULL, NULL, '학교 자체 커리큘럼 예습', '{"raw_lines": ["토 13:00-15:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('475edd0b-1e46-525f-96a9-c8db2c0b3911', '00000000-0000-0000-0000-000000000001', '문채영', NULL, NULL, '010-3363-4010', NULL, 'KIS', '8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('90a5b0e9-d4f4-5d22-a3c0-6618c919e313', '00000000-0000-0000-0000-000000000001', '밀라노로 G7, 정예원', NULL, '2012-05-17', '010-9195-6855', NULL, NULL, '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8ba4aa6a-bdce-5e5e-ab13-b94db35c7c00', '00000000-0000-0000-0000-000000000001', '밀라노로 G9, 정가원', NULL, '2010-06-11', '010-9195-6855', NULL, NULL, '8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('432a39ab-b018-5024-b5ca-4711feb0127e', '00000000-0000-0000-0000-000000000001', '박상욱', NULL, '2013-10-22', NULL, '필리핀', 'ISM', 'G6', NULL, NULL, NULL, '손민서', NULL, NULL, NULL, '{"raw_lines": ["목 21:00-22:30", "토 19:00-20:30"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('ec5b10ca-8092-5358-ad65-b559668ea97e', '00000000-0000-0000-0000-000000000001', '박서아', NULL, '2014-03-03', '010-8370-3070', NULL, 'KIS', '4', NULL, NULL, NULL, '김경진', NULL, NULL, 'MAP LU Advanced 
MAP RC G6 up Intermediate', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('c06f0d89-9f4a-56fc-86fd-73e65f90b642', '00000000-0000-0000-0000-000000000001', '박세령', NULL, '2015-09-24', '010-3353-1209', NULL, '상명초', '4', 262, 234, 246, '손민서', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b85e5d2c-ff45-5b5a-8867-470dad95c3f0', '00000000-0000-0000-0000-000000000001', '박용호', 'M', '2011-02-16', NULL, '홍콩', 'HKIS', '9', NULL, NULL, NULL, '최한나', 'ssat', NULL, '2026 SSAT & ISEE 1,000+ Practice Questions for the Upper Level 3rd Edition
Upper level SSAT 1500+ Practice Questions
SSAT Upper Level Prep Book', '{"raw_lines": ["목/일 20:00-22:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1d29a41b-7248-52c8-b7b9-60e86872dc11', '00000000-0000-0000-0000-000000000001', '박유빈', NULL, NULL, NULL, NULL, '언북초', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('e5698f97-77b6-5e61-b348-c5092790b540', '00000000-0000-0000-0000-000000000001', '박준우', NULL, '2010-08-28', '010-4562-1469', NULL, '일반학교', '중2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('de840f0d-9a6e-59ef-a514-0becfffa5752', '00000000-0000-0000-0000-000000000001', '박지우', NULL, '2012-02-16', '010-4562-1469', NULL, 'SJA', '6', NULL, NULL, NULL, '조혜수', 'isee', NULL, 'SSAT Upper Prep
ISEE Upper Level Prep Book 
past ISEE Tests
자체 제작 ISEE Practice Set 
Upper level ISEE 1500+ Practice Questions', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('fa355bde-1c0f-5e68-bdde-48f71ab5e4b0', '00000000-0000-0000-0000-000000000001', '백서현', 'F', '2012-09-23', '010-9270-7776', '한국', '해창중', '2', NULL, NULL, NULL, '정진석', NULL, 'MAP Reading, Math 
TIS(천진) 8월 입학시험', '1) MAP RC G6 up Intermediate  
2) IXL Math', '{"raw_lines": ["월,금 17:30-19:00"]}'::jsonb, NULL, '2026-05-04', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a2614ddd-ff4e-5a1b-b1f6-69cf094f4223', '00000000-0000-0000-0000-000000000001', '백지수', 'F', '2015-05-12', '010-9270-7776', '한국', '고덕초', '5', NULL, NULL, NULL, '김혜린', NULL, 'MAP Reading, 어법, 어휘
TIS(천진) 8월 입학시험', '1) MAP RC G2-5 Basic, Intermediate >> IXL
2) 4000 English Words 1
3) Editing for Spelling and Grammar 2', NULL, NULL, '2026-05-05', '2026-06-03', NULL, NULL, 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('83a29778-01ee-5271-8fdc-aca4096f5738', '00000000-0000-0000-0000-000000000001', '밴쿠버 G7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('5105d2bf-1060-53b5-8282-b7005074b63c', '00000000-0000-0000-0000-000000000001', '서준원', NULL, '2016-07-23', NULL, '뉴질랜드', NULL, '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('d88cc91d-ce8d-5f79-b3bd-bc8850c3b882', '00000000-0000-0000-0000-000000000001', '석예준', NULL, '2014-08-08', '010-6672-0603', '호주', NULL, '4', NULL, NULL, NULL, '김태윤', 'gpa', NULL, 'Editing for Spelling and Grammar 2', '{"raw_lines": ["월 16:30-18:30", "(호주시간)"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4e98c54b-a4aa-5988-a1bd-0c310d3297b8', '00000000-0000-0000-0000-000000000001', '석유준', NULL, '2017-02-05', NULL, NULL, NULL, '2', NULL, NULL, NULL, NULL, NULL, NULL, 'I see grammar', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('516871a0-fd8d-5ef4-be95-ad39f3ef485d', '00000000-0000-0000-0000-000000000001', '소이', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('46fad898-e68c-52cd-9daa-1744a2f385d4', '00000000-0000-0000-0000-000000000001', '손엘리', 'F', '2014-01-05', '917-922-1754
 (US number)', '텍사스 달라스', 'McCulloch Intermediate School', '6', NULL, NULL, NULL, '김효윤 (영어)', NULL, 'ISEE', 'SSAT and ISEE Middle Level Prep Book 2024-2026', '{"raw_lines": ["일 8:00-10:00"]}'::jsonb, '내년 Middle level 8학년 입학시험 준비', '2026-05-10', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4f9f3280-efa7-5521-bfb3-5edff19cbef6', '00000000-0000-0000-0000-000000000001', '손유나', NULL, NULL, '010-5128-2407', NULL, 'TIS', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('76e90939-5b22-5bb2-8dea-15290de169e6', '00000000-0000-0000-0000-000000000001', '손지효', NULL, '2008-05-23', '010-3466-5424', NULL, '청명고', '2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('7c66e9f7-cf17-509b-afa3-36cdbc1c95e8', '00000000-0000-0000-0000-000000000001', '송민건', 'M', '2017-05-25', '010-8529-3577', NULL, 'NLCS', 'Year 3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('bc946c09-8d38-5cb3-9d6c-ef31161c146b', '00000000-0000-0000-0000-000000000001', '스텔라 백', NULL, '2014-01-01', '010-3417-4790', '미국', NULL, '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b33ed505-d95b-5a59-8de6-d40da9617623', '00000000-0000-0000-0000-000000000001', '시언', NULL, '2013-01-07', NULL, NULL, '중국 소주', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4cc48045-adec-57cb-905b-4f5670f560ef', '00000000-0000-0000-0000-000000000001', '심윤설', NULL, '2016-04-21', '010-6715-3314', NULL, NULL, '3', NULL, NULL, NULL, '김경진', 'map', NULL, 'MAP RC G2-5 Intermediate', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('6e98e1a5-4ff6-5fc8-b21a-44b328388651', '00000000-0000-0000-0000-000000000001', '심지안', NULL, NULL, '010-3021-4643', NULL, 'BHA', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('d6ce5ae7-6adf-59f3-b19e-9b488846d3ac', '00000000-0000-0000-0000-000000000001', '심지효', NULL, NULL, '010-3021-4643', NULL, 'BHA', '7', NULL, NULL, NULL, '한승희', 'map', NULL, '데모: TOEFL Official Guide 6
SSAT Upper Practice
SSAT Upper Prep
MAP RC G6 UP 기출변형 
PSAT 8/9 기출변형', '{"raw_lines": ["월 19:30-21:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('75d5a464-ff46-5450-b472-5fc7f0a3adee', '00000000-0000-0000-0000-000000000001', '유니스 탁', NULL, NULL, NULL, NULL, NULL, '5', NULL, NULL, NULL, '조혜수', NULL, NULL, '1) ISEE Middle 1000+ Practice Questions 
2) ISEE Practice Essays', NULL, NULL, '2026-06-11', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('16f9d578-1461-5149-a442-e6c3de31ba5a', '00000000-0000-0000-0000-000000000001', '유지우', NULL, NULL, '010-2715-9103', NULL, 'SIS', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('db593859-7bd2-5b59-ba9b-e466ad3afb4f', '00000000-0000-0000-0000-000000000001', '유하율', 'M', '2012-01-02', '010-3386-3724', NULL, 'SJA', '8', NULL, NULL, NULL, '김혜린', NULL, NULL, NULL, NULL, NULL, '2025-12-29', '2026-04-08', 'OTHER', '일정 상 수업 어려움', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1fb49732-95e4-5ac7-8036-5a0bf45c3586', '00000000-0000-0000-0000-000000000001', '유한나', 'F', NULL, '010-8801-4798', '한국', '원천중', '3', NULL, NULL, NULL, '조혜수', NULL, '세인트폴 입학 시험 6월 중 예정', '1) IXL (Math)
2) MAP G6 up Advanced', '{"raw_lines": ["금 19:00-20:00", "토 18:00-19:30"]}'::jsonb, NULL, '2026-05-29', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('6f1e6b66-f672-5699-908d-807c0b0c3a31', '00000000-0000-0000-0000-000000000001', '이도', 'M', NULL, '010-7378-9980', NULL, NULL, '7', NULL, NULL, NULL, '정진석
김효윤', NULL, NULL, '1) 정진석: MAP LU Advanced, RC 신규문제 201-240 
2) 김효윤: 2026 Interview Questions,', NULL, NULL, '2026-05-10', '2026-05-26', 'OTHER', 'KIS 제주
입학 시험 종료', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a2025bea-a30f-5c1e-bacb-65eb7c3d42c2', '00000000-0000-0000-0000-000000000001', '이민서', 'F', NULL, NULL, '대만', NULL, '6', NULL, NULL, NULL, '김경진', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('e1b7d051-71da-514b-bcf3-c079ec3127ff', '00000000-0000-0000-0000-000000000001', '이세진', NULL, '2010-09-29', '010-7103-3038', NULL, 'BHA', '8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a0cc0481-cc42-5b95-b72a-54b5e8960df1', '00000000-0000-0000-0000-000000000001', '이수호', NULL, '2014-08-08', '010-4544-2693', NULL, 'SJIS', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a6f60a9f-c06a-5ca0-8245-7b33b6b71bd4', '00000000-0000-0000-0000-000000000001', '이승규', NULL, '2012-11-22', '010-2723-8442', NULL, '구룡초', '6', NULL, NULL, NULL, NULL, NULL, 'MAP TEST', NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('993b78df-a001-5915-872f-3b06a1129478', '00000000-0000-0000-0000-000000000001', '이시우', 'M', '2013-02-21', '010-9059-4209', NULL, 'MCA', 'G7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4f22a28b-bc3a-5d3c-ac89-8e30b54c8656', '00000000-0000-0000-0000-000000000001', '이시원', NULL, NULL, '010-8284-0327', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('0244cd49-d25b-5e45-9e83-1311bc304ac0', '00000000-0000-0000-0000-000000000001', '이유빈', NULL, '2014-01-03', '010-2308-6839', NULL, '율곡초', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b80dcd0b-739b-5929-97ff-ae09a659f688', '00000000-0000-0000-0000-000000000001', '이윤건', 'M', '2010-11-22', '010-7141-2833', NULL, '휘문중', '중2', NULL, NULL, NULL, '정성경', 'gpa', NULL, '4000 Essential English Words Book 2', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('966112ff-8254-5c29-b471-9447e6fedcc6', '00000000-0000-0000-0000-000000000001', '이윤후', 'M', '2010-11-22', '010-7141-2833', NULL, '휘문중', '중2', NULL, NULL, NULL, '임승희', 'gpa', NULL, 'History - https://www.ducksters.com/history/', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('cf84f919-e6df-5ebf-8f05-fee2e1c29d09', '00000000-0000-0000-0000-000000000001', '이재인', 'F', '2009-12-22', '010-7277-5265', '한국', 'KIS', '10', NULL, NULL, NULL, '김효윤', NULL, 'John Locke Writing Competition', '별도 교재 없음', NULL, NULL, '2024-12-23', '2026-05-19', NULL, NULL, 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('857c0088-384a-5870-9d82-0a96592c83ad', '00000000-0000-0000-0000-000000000001', '이정우', NULL, '2013-10-23', '010-3610-4771', NULL, '일반학교', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('cbacd56c-a298-5303-a08d-e55f95a23d43', '00000000-0000-0000-0000-000000000001', '이제인', 'F', '2015-03-09', '010-9771-1203', NULL, 'KIS', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-15', '2026-04-19', NULL, NULL, 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('d1f46131-ed78-504f-a090-5a66328c9fb5', '00000000-0000-0000-0000-000000000001', '이주아', 'F', '2013-09-18', '010-9887-3570', '캐나다', 'WestRidge School in Canada', '7', NULL, NULL, NULL, '김태윤', NULL, NULL, '1) MAP test G6 up Intermediate 
2) Prealgebra', NULL, NULL, '2026-05-16', '2026-05-29', 'OTHER', '국제학교 합격', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('bd0e4242-4013-5a31-9281-a67920823424', '00000000-0000-0000-0000-000000000001', '이주원', 'F', '2016-05-12', NULL, '터키', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'English: MAP RC G2-5 Advanced 
Math: IXL', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8ce94202-3743-59ab-a8d4-988dfc233b8d', '00000000-0000-0000-0000-000000000001', '이지원', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-06', '2026-04-15', 'OTHER', '시험 종료, 추후 인터뷰 수업 진행 의사있음', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('03897454-eced-5d86-a1e2-104f8d9f2933', '00000000-0000-0000-0000-000000000001', '이채현', 'F', '2012-04-09', '010-3303-7671
yalyal2', '홍콩', 'South Island School', '9', NULL, NULL, NULL, '정진석', NULL, 'MAP Reading', '1) MAP RC G6 up Advanced 
2) Writing - Topic 위주, 교재 없음', '{"raw_lines": ["화 17:30-18:30"]}'::jsonb, NULL, '2026-04-09', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('d7e8257b-09ed-55bc-be8e-19da6aacc41a', '00000000-0000-0000-0000-000000000001', '이충한', 'M', '2009-07-31', '010-7433-4774', '맥사코', 'AIM', '10', NULL, NULL, NULL, '김효윤', NULL, '11월 초 MAP test 예정', '1) MAP Reading 220-230+', '{"raw_lines": ["토 10:00-12:00"]}'::jsonb, NULL, '2026-05-31', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a39ce431-0c39-5108-b0b0-a721d9e6a7e7', '00000000-0000-0000-0000-000000000001', '이태오', 'M', NULL, NULL, '홍콩', 'International Montesori School', 'Rising Y6', NULL, NULL, NULL, '정성경', NULL, 'MAP Reading', '1) MAP RC 신규문제 201-220 
2) IXL', NULL, NULL, '2026-06-18', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('df36491f-179b-59b8-87c3-1f6c6e7bd7c7', '00000000-0000-0000-0000-000000000001', '이한서', 'F', '2013-11-25', '010-7433-4774', '맥시코', 'AIM', '6', NULL, NULL, NULL, '김효윤', NULL, '11월 초 MAP test 예정', '1) MAP G2-5 Advanced', '{"raw_lines": ["목, 토 09:00-10:00"]}'::jsonb, NULL, '2026-05-30', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('47181817-1caf-575d-a06d-47dcb5d96384', '00000000-0000-0000-0000-000000000001', '임민규', 'M', '2011-07-22', '010-4130-8939', NULL, '용이중', '3', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-05-20', '2026-05-21', 'OTHER', '시험 종료', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8cf5a4e4-1b2f-5ce5-a557-e5ed0f687204', '00000000-0000-0000-0000-000000000001', '임채은', NULL, NULL, NULL, NULL, 'KIS', '10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('74df16cb-bc62-5249-a848-4f938faf9183', '00000000-0000-0000-0000-000000000001', '장현아', NULL, '2008-12-20', '010-9813-4685', NULL, '숙명여중', '1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('dfb2c7c4-0253-592b-acb7-0499a031f2ba', '00000000-0000-0000-0000-000000000001', '정미래', NULL, '2010-01-26', '010-3846-7728', NULL, NULL, '8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8e6ec70d-371f-566a-9b43-8edace76305e', '00000000-0000-0000-0000-000000000001', '정소은', NULL, NULL, '010-3846-7728', NULL, 'rl', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('7ad18c82-40ff-566f-9fae-e5ffdf8142ca', '00000000-0000-0000-0000-000000000001', '정수인', 'F', NULL, NULL, NULL, 'BHA', '11', NULL, NULL, NULL, '김효윤, 김태윤, 조혜수', NULL, NULL, NULL, NULL, NULL, '2025-08-25', NULL, NULL, NULL, 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('ea541eee-6603-5d13-b5e6-4a591492836d', '00000000-0000-0000-0000-000000000001', '정시원', 'M', '2016-09-26', '010-4911-5606', '말레이시아', 'NEXUS Internaational school Malaysia', '4', NULL, NULL, NULL, '정진석', NULL, 'MAP Reading, Writing 
CMIS, KIS, SJA 입학지원', '1) MAP RC G2-5 Intermediate 
2) Opinion Writing 
3) 2026 Interview Questions', NULL, NULL, '2026-05-05', '2026-05-28', 'OTHER', '시험 결과 발표 후
수업 이어갈 의사 있음', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('0c8fd654-799a-5fc3-a1c2-74790eaf790e', '00000000-0000-0000-0000-000000000001', '정윤아', 'F', '2015-05-11', NULL, '텍사스 달라스', NULL, '6', NULL, NULL, NULL, '김태윤', NULL, 'Vocabulary, Grammar, Essay', '1) Cloze Practice 6
2) Opinion Writing 
3) IXL', '{"raw_lines": ["목 09:30-11:30"]}'::jsonb, NULL, '2025-05-06', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('9f1333fb-0ba0-525b-904a-ac2985428a8a', '00000000-0000-0000-0000-000000000001', '정윤지', 'F', '2016-04-22', NULL, '텍사스 달라스', NULL, '5', NULL, NULL, NULL, '김태윤', NULL, 'Vocabulary, Grammar, Essay', '1) Cloze Practice 5
2) Writing Framework Paragraph 2
3) IXL', '{"raw_lines": ["목 09:30-11:30"]}'::jsonb, NULL, '2025-05-06', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('93bc28c2-ad59-5c5a-85cb-68ff9ab9f9e4', '00000000-0000-0000-0000-000000000001', '정하율', 'F', '2014-07-14', 'petitemamang', '싱가폴', 'SAS', '4', NULL, NULL, NULL, '김태윤', NULL, 'MAP Test 대비 Reading, 
Vocabulary', '현행 
1) MCQs 4 
2) Literature Mid-Adv


완료
1) MAP RC G6 up intermediate
2) 4000 Essential English Words Book 4', '{"raw_lines": ["토 10:00-11:00"]}'::jsonb, NULL, '2025-06-06', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('ad76ed43-8b69-53ca-8715-b03ae9fa81bd', '00000000-0000-0000-0000-000000000001', '정한욱', 'M', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '김효윤', NULL, NULL, '1) MAP RC G2-5 Advanced', NULL, NULL, '2026-06-18', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('a64e003a-3484-5e77-9245-18081fd73530', '00000000-0000-0000-0000-000000000001', '제니', NULL, NULL, NULL, '중국', NULL, NULL, NULL, NULL, NULL, '손민서', NULL, NULL, NULL, '{"raw_lines": ["월 17:10-18:10", "금 20:30-21:30"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('9b73ae49-6b86-5439-8149-9c069354a5c4', '00000000-0000-0000-0000-000000000001', '제이미', 'M', NULL, NULL, '중국', NULL, NULL, NULL, NULL, NULL, '조혜수', 'sat', NULL, 'SAT - College Board 자료', '{"raw_lines": ["월/수 20:00-21:30"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('6c5d6205-8c2b-5166-ab90-54a747609caf', '00000000-0000-0000-0000-000000000001', '제이미 슈', NULL, NULL, NULL, NULL, 'St. John’s School', '12', NULL, NULL, NULL, '조혜수', NULL, NULL, 'Past official ACT Tests from 2008-2024', NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('16e210bb-73a4-5b49-9e1c-0be5f81caf61', '00000000-0000-0000-0000-000000000001', '조승규', 'M', '2014-01-17', '010-4010-6517', NULL, '이방초', '5', NULL, NULL, NULL, NULL, 'ssat', NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('0791f65c-c1c3-5351-a100-27f20d9e4fc7', '00000000-0000-0000-0000-000000000001', '조승현', NULL, NULL, NULL, '한국', 'KIS', '12', NULL, NULL, NULL, NULL, 'sat', NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('83bdd1f0-8508-57c5-8dec-b97869257df4', '00000000-0000-0000-0000-000000000001', '조형우', NULL, '2012-07-10', '010-4538-4965', '베이징', 'WAB', 'G7', NULL, NULL, NULL, '손민서', 'map', NULL, 'MAP RC Advanced', '{"raw_lines": ["일 20:00-22:00"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8999db6d-2037-594b-b3b7-197acbba4622', '00000000-0000-0000-0000-000000000001', '최나연', 'F', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '정성경
김혜린', NULL, NULL, '1) MAP G2-5 Intermediate 
2) IXL', NULL, NULL, '2026-06-17', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('f8190ae9-852d-5803-bdf5-5b02267b77a0', '00000000-0000-0000-0000-000000000001', '최예인', NULL, NULL, '010-8616-3793', NULL, 'BCC', '5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('aff5c740-ceb1-5fe6-a22c-2d2be786d6d7', '00000000-0000-0000-0000-000000000001', '최준혁', NULL, '2012-03-12', '010-3799-2689', NULL, '서일중', '1', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('3b604010-0e87-5017-8c50-5dd7d137a302', '00000000-0000-0000-0000-000000000001', '하승준', NULL, '2014-11-03', '010-5795-0407', NULL, '평촌초', '4', NULL, NULL, NULL, NULL, NULL, 'MAP TEST', NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('2ffa47c8-2deb-56a0-9dc0-76a29682c2f9', '00000000-0000-0000-0000-000000000001', '하연준', NULL, '2012-05-15', '010-5795-0407', NULL, '평촌초', '6', NULL, NULL, NULL, NULL, NULL, 'MAP TEST', NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('afc51a33-0479-500d-a9ac-f1eb23a747ad', '00000000-0000-0000-0000-000000000001', '혜리', NULL, NULL, NULL, '네덜란드', NULL, '6', NULL, NULL, NULL, '손민서', 'gpa', NULL, NULL, '{"raw_lines": ["일 17:30-19:30"]}'::jsonb, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('01e0839a-23b1-59a5-b41d-c6814ec9ea2b', '00000000-0000-0000-0000-000000000001', '홍상헌', NULL, '2012-02-27', '010-3708-1600', NULL, 'SJA', '6', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('944ca9f7-9e24-56e5-9da2-2b968985bed2', '00000000-0000-0000-0000-000000000001', '황나엘', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'OTHER', '구 학생 정보 (legacy archive, 2026-05 이전)', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('3baff172-bbec-543d-b733-9633b8c23cf4', '00000000-0000-0000-0000-000000000001', '황이현', 'F', '2016-03-09', NULL, '한국', '채드윅', '4', 220, 255, 222, '정성경 
조혜수', NULL, 'MAP 점수 향상', '1) MAP RC 221-240 
2) MAP LU Advanced', NULL, NULL, '2026-06-19', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('b16956c1-a3b9-5c3a-beda-89c0180cbbe3', '00000000-0000-0000-0000-000000000001', '황채민', 'F', '2014-12-02', '010-6435-2510', '서울', '서울 버들초', '6', 201, 244, 222, '전우현', NULL, 'MAP Reading', '1) MAP RC G6 up Basic 
2) Intermediate Interview Questions', NULL, NULL, '2026-04-13', '2026-05-12', 'OTHER', '일본 국제학교 입학 시험 종료', 'WITHDRAWN', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();


-- 4. Santa Croce ent (00000000-0000-0000-0000-000000000002) — 현재 등록 학생
INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('8c11258c-754b-5318-aa63-57f7c71fc3e9', '00000000-0000-0000-0000-000000000002', '구유빈', 'F', '2012-09-14', '010-9350-1209', NULL, 'Rectory School', '7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-15', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('76b9a571-ece2-5d98-83bd-02fbcccd5df6', '00000000-0000-0000-0000-000000000002', '김민재', 'M', '2012-10-16', '010-2328-2000', NULL, 'Rectory School', '8', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-15', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('3435d1d0-dd0c-540c-99dc-d9f40469707c', '00000000-0000-0000-0000-000000000002', '김제나', 'F', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-16', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('5af81876-8165-5fbd-9dc9-d50dffdb9a6d', '00000000-0000-0000-0000-000000000002', '박지온', NULL, NULL, '010-9544-9527', NULL, NULL, '7', NULL, NULL, NULL, '김효윤, 김혜린, 정진석', NULL, NULL, NULL, NULL, NULL, '2026-03-02', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('7b38fe20-5a95-5969-97a8-88bad380f848', '00000000-0000-0000-0000-000000000002', '석예준', 'M', '2014-08-08', '010-6672-0603', '호주', NULL, 'Y5', NULL, NULL, NULL, '김효윤', NULL, NULL, NULL, NULL, '2027년 1월 SJA 제주 입학 목표, 시험은 9월에 진행', '2026-02-23', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('1f122226-8016-5176-b342-1f4f93c5c36b', '00000000-0000-0000-0000-000000000002', '석유준', 'M', '2017-02-05', '010-6672-0603', '호주', NULL, 'Y3', NULL, NULL, NULL, '김효윤', NULL, NULL, NULL, NULL, NULL, '2026-02-23', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('2fa81db1-c456-5242-b2ec-4b3e77230868', '00000000-0000-0000-0000-000000000002', '손정연', 'F', '2014-04-09', '010-4201-7910', NULL, '세인트폴', '7', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-06-15', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('346cc5de-85f1-51c9-ad66-df3d4b01c350', '00000000-0000-0000-0000-000000000002', '이윤건', 'M', '2010-11-22', NULL, '서울', '코너스톤', '9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '온라인 스쿨링 진행 중', '2024-12-06', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('7bc74ea4-0690-5db4-aead-9e5b24affc45', '00000000-0000-0000-0000-000000000002', '이윤후', 'M', '2010-11-22', NULL, '서울', '코너스톤', '9', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2024-12-06', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('bdb843f2-6b18-5fed-8e15-9e296590c35b', '00000000-0000-0000-0000-000000000002', '이정우', 'M', '2013-10-23', '010-3610-4771', NULL, NULL, '6', NULL, NULL, NULL, '김효윤', NULL, NULL, NULL, NULL, NULL, '2026-05-21', NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('26aba421-4d3c-5903-b83e-821f36aa9c3e', '00000000-0000-0000-0000-000000000002', '장연서(Janie)', 'F', NULL, NULL, '중국', NULL, NULL, NULL, NULL, NULL, '김효윤', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();

INSERT INTO amb_acm_std_student (std_id, ent_id, std_name, std_gender, std_birth_date, std_phone, std_residence, std_school, std_grade, std_map_reading, std_map_math, std_map_language, std_teacher, std_subject, std_curriculum, std_materials, std_schedule_json, std_special_note, std_start_date, std_end_date, std_end_reason, std_end_note, std_status, created_at, updated_at)
VALUES ('4fc694bc-b82f-5043-b591-1124b266abfb', '00000000-0000-0000-0000-000000000002', '장연우(Jamy)', 'M', NULL, NULL, '중국', NULL, NULL, NULL, NULL, NULL, '조혜수', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'ACTIVE', NOW(), NOW())
ON CONFLICT (ent_id, std_name) DO UPDATE SET
  std_gender = COALESCE(EXCLUDED.std_gender, amb_acm_std_student.std_gender),
  std_birth_date = COALESCE(EXCLUDED.std_birth_date, amb_acm_std_student.std_birth_date),
  std_phone = COALESCE(EXCLUDED.std_phone, amb_acm_std_student.std_phone),
  std_residence = COALESCE(EXCLUDED.std_residence, amb_acm_std_student.std_residence),
  std_school = COALESCE(EXCLUDED.std_school, amb_acm_std_student.std_school),
  std_grade = COALESCE(EXCLUDED.std_grade, amb_acm_std_student.std_grade),
  std_map_reading = COALESCE(EXCLUDED.std_map_reading, amb_acm_std_student.std_map_reading),
  std_map_math = COALESCE(EXCLUDED.std_map_math, amb_acm_std_student.std_map_math),
  std_map_language = COALESCE(EXCLUDED.std_map_language, amb_acm_std_student.std_map_language),
  std_teacher = COALESCE(EXCLUDED.std_teacher, amb_acm_std_student.std_teacher),
  std_subject = COALESCE(EXCLUDED.std_subject, amb_acm_std_student.std_subject),
  std_curriculum = COALESCE(EXCLUDED.std_curriculum, amb_acm_std_student.std_curriculum),
  std_materials = COALESCE(EXCLUDED.std_materials, amb_acm_std_student.std_materials),
  std_schedule_json = COALESCE(EXCLUDED.std_schedule_json, amb_acm_std_student.std_schedule_json),
  std_special_note = COALESCE(EXCLUDED.std_special_note, amb_acm_std_student.std_special_note),
  std_start_date = COALESCE(EXCLUDED.std_start_date, amb_acm_std_student.std_start_date),
  std_end_date = EXCLUDED.std_end_date,
  std_end_reason = EXCLUDED.std_end_reason,
  std_end_note = COALESCE(EXCLUDED.std_end_note, amb_acm_std_student.std_end_note),
  std_status = EXCLUDED.std_status,
  updated_at = NOW();


-- 5. 학부모/학생 상담 메모 머지 (TPI ent only — 시트 3)
UPDATE amb_acm_std_student SET std_gpa = '6-7점 대 유지 (우수)', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || 'IB (Pattern) 약세 / 여름특강(수학)', std_goals_note = '리딩: Summary 강화 / 수학: 온라인 딥러닝 커리큘럼', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = 'Emilia 혜리 Deusing';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-27'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '최근 MAP test 하락 양상', std_goals_note = 'Grammar & Reading 변경 / Vocabulary 유지', std_satisfaction_note = '만족도 높음 / 수업 개선 동의', std_last_counsel_date = '2026-04-27', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '강병찬';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-27'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '-', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-27', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '강소율';
UPDATE amb_acm_std_student SET std_gpa = '90점 대 유지', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || 'SAT 준비 / 여름특강', std_goals_note = '여름특강: PSAT 준비', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '구본의';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-30'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '26년 8월 KIS 판교 입학예정', std_goals_note = '일반 리딩 수업 변경', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-30', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '김민';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '5월 초', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '수학 및 IXL 추가', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '김아이비';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-22'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || 'KIS 입학', std_goals_note = '7월 수업 재시작 예정', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-22', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '김지환';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-27'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '8월 초 달튼 지원 예정', std_goals_note = '인터뷰 수업 추가', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-27', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '김하음';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR(NULL::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '-', std_satisfaction_note = '-', std_last_counsel_date = NULL, updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '이재인';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-22'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '숙제 디테일 추가: 어휘, 라이팅 세분화 진행', std_satisfaction_note = '-', std_last_counsel_date = '2026-04-22', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '이채현';
UPDATE amb_acm_std_student SET std_gpa = '관리 미흡', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-21'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '지문 심층 분석 추가', std_satisfaction_note = '만족도 높음 / 대안 필요', std_last_counsel_date = '2026-04-21', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '이태오';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '여름 특강 오프라인', std_goals_note = '숙제 디테일 추가: 유의어 확장 및 문장 만들기', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '정윤아';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '-', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || '-', std_goals_note = '숙제 디테일 추가: 유의어 확장 및 문장 만들기 및 에세이 추가', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '정윤지';
UPDATE amb_acm_std_student SET std_gpa = '-', std_map_note = COALESCE(std_map_note, '') || E'\n[상담 ' || COALESCE(TO_CHAR('2026-04-23'::date,'YYYY-MM-DD'),'') || '] ' || '2026-04-27 00:00:00', std_ssat_isee_note = '-', std_special_note = COALESCE(std_special_note, '') || E'\n[상담] ' || 'SIS 합격', std_goals_note = '일반 리딩 수업 변경', std_satisfaction_note = '만족도 높음', std_last_counsel_date = '2026-04-23', updated_at = NOW() WHERE ent_id = '00000000-0000-0000-0000-000000000001' AND std_name = '정하율';

-- ============================================================
-- End of 941
-- ============================================================