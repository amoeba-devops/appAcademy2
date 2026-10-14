-- ACM lightweight projects. No changes to existing student/business data.
CREATE TABLE IF NOT EXISTS amb_acm_prj_project (
 prj_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 prj_title varchar(200) NOT NULL, prj_description text NOT NULL DEFAULT '',
 prj_status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK(prj_status IN ('ACTIVE','DONE','ARCHIVED')),
 owner_id uuid NOT NULL, drive_folder_id varchar(200), drive_account_id varchar(200),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ent_id,prj_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_prj_member (
 pmb_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, prj_id uuid NOT NULL,
 usr_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,prj_id) REFERENCES amb_acm_prj_project(ent_id,prj_id), UNIQUE(ent_id,prj_id,usr_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_prj_item (
 pit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, prj_id uuid NOT NULL,
 pit_kind varchar(10) NOT NULL CHECK(pit_kind IN ('ISSUE','NOTE','FILE','DOCUMENT')),
 pit_title varchar(200) NOT NULL, pit_body text NOT NULL DEFAULT '',
 pit_status varchar(15) NOT NULL DEFAULT 'TODO' CHECK(pit_status IN ('TODO','DOING','DONE')),
 assignee_id uuid, due_date date, created_by uuid NOT NULL,
 drive_file_id varchar(200), drive_mime varchar(200), drive_size bigint, drive_account_id varchar(200),
 deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,prj_id) REFERENCES amb_acm_prj_project(ent_id,prj_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_prj_item_drive ON amb_acm_prj_item(ent_id,prj_id,drive_file_id) WHERE deleted_at IS NULL AND drive_file_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acm_prj_member_user ON amb_acm_prj_member(ent_id,usr_id);
CREATE INDEX IF NOT EXISTS idx_acm_prj_item_project ON amb_acm_prj_item(ent_id,prj_id,created_at);
CREATE TABLE IF NOT EXISTS amb_acm_prj_drive (
 pdc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL UNIQUE,
 account_id varchar(200) NOT NULL, account_email varchar(320) NOT NULL,
 token_encrypted bytea NOT NULL, token_iv bytea NOT NULL, token_auth_tag bytea NOT NULL,
 root_id varchar(200), root_name varchar(200), connected_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS amb_acm_prj_oauth (
 pos_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, usr_id uuid NOT NULL,
 state_hash varchar(64) NOT NULL UNIQUE, verifier varchar(100) NOT NULL, return_path varchar(500) NOT NULL,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- Durable operation record: uncertain external results never blindly create again.
CREATE TABLE IF NOT EXISTS amb_acm_prj_operation (
 pop_id uuid PRIMARY KEY, ent_id uuid NOT NULL, prj_id uuid,
 fingerprint varchar(64) NOT NULL, state varchar(20) NOT NULL DEFAULT 'PENDING',
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
