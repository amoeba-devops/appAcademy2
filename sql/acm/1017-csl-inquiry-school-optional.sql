-- FIX-260923: school became optional in REQ-260921B, but the legacy DB
-- check remained and rejected POST /api/acm/csl/inquiries with SQLSTATE 23514.
-- No row changes. School foreign key and all other constraints are retained.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE amb_acm_csl_inquiry
  DROP CONSTRAINT IF EXISTS chk_acm_csl_inq_school;
COMMIT;
