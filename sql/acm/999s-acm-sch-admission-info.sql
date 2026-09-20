BEGIN;
ALTER TABLE amb_acm_sch_school ADD COLUMN IF NOT EXISTS curriculum_description text;
ALTER TABLE amb_acm_sch_school ADD COLUMN IF NOT EXISTS eligibility text;
ALTER TABLE amb_acm_sch_school ALTER COLUMN is_authorized DROP NOT NULL;
ALTER TABLE amb_acm_sch_school ALTER COLUMN is_authorized DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_sch_school_ent_id ON amb_acm_sch_school(ent_id,sch_id);
CREATE TABLE IF NOT EXISTS amb_acm_sch_admission_info (
 sai_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ent_id uuid NOT NULL,
 sch_id uuid NOT NULL,
 target_label text,
 exam_content text,
 schedule_text text,
 sort_order integer NOT NULL DEFAULT 0,
 source_file_hash text,
 source_sheet text,
 source_row integer,
 import_run_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 CONSTRAINT fk_acm_sch_admission_school FOREIGN KEY(ent_id,sch_id) REFERENCES amb_acm_sch_school(ent_id,sch_id),
 CONSTRAINT ck_acm_sch_admission_content CHECK (coalesce(btrim(target_label),'') <> '' OR coalesce(btrim(exam_content),'') <> '' OR coalesce(btrim(schedule_text),'') <> '')
);
CREATE INDEX IF NOT EXISTS idx_acm_sch_admission_school ON amb_acm_sch_admission_info(ent_id,sch_id,sort_order) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_sch_admission_source ON amb_acm_sch_admission_info(ent_id,source_file_hash,source_sheet,source_row) WHERE source_file_hash IS NOT NULL;
DROP TRIGGER IF EXISTS trg_acm_sch_admission_updated ON amb_acm_sch_admission_info;
CREATE TRIGGER trg_acm_sch_admission_updated BEFORE UPDATE ON amb_acm_sch_admission_info FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
COMMIT;
