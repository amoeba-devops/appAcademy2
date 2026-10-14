-- Additive workspace migration; existing references and project ACLs are preserved.
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS document_type varchar(10) CHECK(document_type IN ('MEMO','SHEET','DOC','FILE'));
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS storage_type varchar(20) CHECK(storage_type IN ('LOCAL','GOOGLE_LINK','DRIVE_FILE'));
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS content jsonb;
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS external_url varchar(500);
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
UPDATE amb_acm_prj_item SET document_type=CASE WHEN pit_kind='NOTE' THEN 'MEMO' WHEN pit_kind='FILE' THEN 'FILE' WHEN drive_mime='application/vnd.google-apps.spreadsheet' THEN 'SHEET' ELSE 'DOC' END, storage_type=CASE WHEN drive_file_id IS NULL THEN 'LOCAL' ELSE 'DRIVE_FILE' END WHERE pit_kind<>'ISSUE' AND document_type IS NULL;
CREATE TABLE IF NOT EXISTS amb_acm_drv_folder (
 drf_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 file_id varchar(200) NOT NULL, account_id varchar(200) NOT NULL, title varchar(200) NOT NULL,
 operator_access varchar(10) NOT NULL DEFAULT 'NONE' CHECK(operator_access IN ('NONE','VIEW','EDIT')),
 created_by uuid NOT NULL, deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ent_id,drf_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_drv_folder_live ON amb_acm_drv_folder(ent_id,account_id,file_id) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS amb_acm_drv_member (
 drm_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, drf_id uuid NOT NULL,
 usr_id uuid NOT NULL, access varchar(10) NOT NULL CHECK(access IN ('VIEW','EDIT')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,drf_id) REFERENCES amb_acm_drv_folder(ent_id,drf_id), UNIQUE(ent_id,drf_id,usr_id)
);
