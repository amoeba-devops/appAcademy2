BEGIN;
SET LOCAL lock_timeout='5s';
-- Legacy counseling end date is archival; it must not block edits to start date.
-- Student withdrawal / operating period constraints remain unchanged.
ALTER TABLE amb_acm_csl_enrollment DROP CONSTRAINT IF EXISTS chk_acm_csl_enr_date_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_csl_enrollment_ent_id ON amb_acm_csl_enrollment(ent_id,enr_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_csl_course_ent_id ON amb_acm_csl_course(ent_id,crs_id);
CREATE TABLE IF NOT EXISTS amb_acm_csl_enrollment_course (
 ecr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 ent_id UUID NOT NULL, enr_id UUID NOT NULL, course_id UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_enrollment_course UNIQUE(ent_id,enr_id,course_id),
 FOREIGN KEY(ent_id,enr_id) REFERENCES amb_acm_csl_enrollment(ent_id,enr_id) ON DELETE CASCADE,
 FOREIGN KEY(ent_id,course_id) REFERENCES amb_acm_csl_course(ent_id,crs_id)
);
INSERT INTO amb_acm_csl_enrollment_course(ent_id,enr_id,course_id)
 SELECT e.ent_id,e.enr_id,e.enr_course_id FROM amb_acm_csl_enrollment e
 JOIN amb_acm_csl_course c ON c.ent_id=e.ent_id AND c.crs_id=e.enr_course_id
 ON CONFLICT(ent_id,enr_id,course_id) DO NOTHING;
COMMIT;
