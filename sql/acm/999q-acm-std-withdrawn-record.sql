-- Withdrawn source records keep personal fields encrypted; current state is independent.
BEGIN;
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_admission_date date;
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_withdrawn_date date;
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_withdrawn_reason text;
CREATE TABLE IF NOT EXISTS amb_acm_std_withdrawn_record (
 swr_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 std_id uuid NOT NULL REFERENCES amb_acm_std_student(std_id),
 source_system varchar(100) NOT NULL, external_id varchar(100) NOT NULL,
 payload_encrypted bytea NOT NULL, payload_iv bytea NOT NULL, payload_auth_tag bytea NOT NULL,
 file_hash text NOT NULL, actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_std_withdrawn_source UNIQUE(ent_id,source_system,external_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_std_withdrawn_student ON amb_acm_std_withdrawn_record(ent_id,std_id);
CREATE TABLE IF NOT EXISTS amb_acm_std_withdrawn_audit (
 swa_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, std_id uuid NOT NULL,
 swr_id uuid NOT NULL, actor_id text NOT NULL, action varchar(20) NOT NULL,
 payload_encrypted bytea NOT NULL, payload_iv bytea NOT NULL, payload_auth_tag bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
