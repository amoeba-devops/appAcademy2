BEGIN;
-- Explicit deletion archive, independent of the ordinary INACTIVE status.
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_archived_at timestamptz;
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_archived_by uuid;
CREATE TABLE IF NOT EXISTS amb_acm_std_deletion_history (
 sdh_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 std_id uuid NOT NULL, sdh_student_name varchar(100) NOT NULL,
 sdh_action varchar(20) NOT NULL CHECK(sdh_action IN ('ARCHIVE','PURGE')),
 sdh_actor_id uuid NOT NULL, sdh_actor_name varchar(100) NOT NULL,
 sdh_counts jsonb NOT NULL DEFAULT '{}', sdh_test_confirmed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acm_std_deletion_history_ent ON amb_acm_std_deletion_history(ent_id,created_at DESC);
-- Deliberately no student/user FK: deletion history survives either account.
CREATE TABLE IF NOT EXISTS amb_acm_std_deleted_file (
 sdf_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 sdf_key text NOT NULL UNIQUE, sdf_attempts int NOT NULL DEFAULT 0,
 sdf_next_at timestamptz NOT NULL DEFAULT now(), sdf_done_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
