-- Additive project relations; originals remain unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_prj_relation (
 prr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 ent_id UUID NOT NULL,
 prj_id UUID NOT NULL REFERENCES amb_acm_prj_project(prj_id) ON DELETE CASCADE,
 prr_kind VARCHAR(10) NOT NULL CHECK(prr_kind IN ('CLIENT','CHAT')),
 prr_name VARCHAR(200) NOT NULL,
 ref_id UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_relation_project ON amb_acm_prj_relation(ent_id,prj_id);
COMMIT;
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS file_phase varchar(20) NOT NULL DEFAULT 'ETC' CHECK(file_phase IN ('PLANNING','DESIGN','DEVELOPMENT','OPERATION','ETC'));
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS object_key text;
ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0;

ALTER TABLE amb_acm_prj_item ADD COLUMN IF NOT EXISTS viewer_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE amb_acm_prj_member ADD COLUMN IF NOT EXISTS member_role varchar(10) NOT NULL DEFAULT 'MEMBER' CHECK(member_role IN ('MANAGER','MEMBER'));
CREATE SEQUENCE IF NOT EXISTS amb_acm_prj_code_seq;
ALTER TABLE amb_acm_prj_project ADD COLUMN IF NOT EXISTS prj_code text;
UPDATE amb_acm_prj_project SET prj_code='PJ-'||to_char(created_at,'YYYYMM')||'-'||lpad(nextval('amb_acm_prj_code_seq')::text,6,'0') WHERE prj_code IS NULL;
ALTER TABLE amb_acm_prj_project ALTER COLUMN prj_code SET DEFAULT ('PJ-'||to_char(now(),'YYYYMM')||'-'||lpad(nextval('amb_acm_prj_code_seq')::text,6,'0'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_prj_code ON amb_acm_prj_project(prj_code);
