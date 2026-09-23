BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_english_name_encrypted bytea,
  ADD COLUMN IF NOT EXISTS inq_english_name_iv bytea,
  ADD COLUMN IF NOT EXISTS inq_english_name_auth_tag bytea;
COMMIT;
