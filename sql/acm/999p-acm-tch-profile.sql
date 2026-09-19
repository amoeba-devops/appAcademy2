-- ACM-TCH profile fields; preserves all existing teacher values.
BEGIN;
ALTER TABLE amb_acm_tch_teacher
  ALTER COLUMN tch_email DROP NOT NULL,
  ALTER COLUMN tch_employment_type DROP NOT NULL,
  ALTER COLUMN tch_employment_type DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS tch_education text,
  ADD COLUMN IF NOT EXISTS tch_teaching_subjects_text text,
  ADD COLUMN IF NOT EXISTS tch_experience text,
  ADD COLUMN IF NOT EXISTS tch_profile_text text,
  ADD COLUMN IF NOT EXISTS tch_residence varchar(200),
  ADD COLUMN IF NOT EXISTS tch_kakao_id varchar(100),
  ADD COLUMN IF NOT EXISTS tch_gender varchar(20);
COMMIT;
