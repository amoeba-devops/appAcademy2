-- Run only after backup and review: psql -v target_ent='<approved tenant UUID>' -f this-file
-- Existing dates, withdrawn students, deleted records and other tenants remain unchanged.
\set ON_ERROR_STOP on
BEGIN;
WITH changed AS (
  UPDATE amb_acm_std_student
  SET std_admission_date=std_start_date,updated_at=now()
  WHERE ent_id=:'target_ent'::uuid AND deleted_at IS NULL
    AND std_status='ACTIVE' AND std_admission_date IS NULL AND std_start_date IS NOT NULL
  RETURNING std_site
) SELECT std_site,count(*) AS updated FROM changed GROUP BY std_site;
COMMIT;
