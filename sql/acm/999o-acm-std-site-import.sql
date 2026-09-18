-- ACM-STD: additive migration; no roster backfill.
BEGIN;
ALTER TABLE amb_acm_std_student ADD COLUMN IF NOT EXISTS std_site varchar(20);
DO $$ BEGIN
  ALTER TABLE amb_acm_std_student ADD CONSTRAINT ck_acm_std_site CHECK (std_site IN ('TPI','TRINITY','SANTACROCE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_acm_std_site_status ON amb_acm_std_student(ent_id,std_site,std_status) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS amb_acm_std_site_audit (
  ssa_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
  std_id uuid NOT NULL, old_site varchar(20), new_site varchar(20),
  actor_id text, reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION audit_acm_std_site() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.std_site IS DISTINCT FROM NEW.std_site THEN
    INSERT INTO amb_acm_std_site_audit(ent_id,std_id,old_site,new_site,actor_id,reason)
    VALUES(NEW.ent_id,NEW.std_id,OLD.std_site,NEW.std_site,
      nullif(current_setting('acm.actor_id',true),''),nullif(current_setting('acm.change_reason',true),''));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_acm_std_site_audit ON amb_acm_std_student;
CREATE TRIGGER trg_acm_std_site_audit AFTER UPDATE OF std_site ON amb_acm_std_student FOR EACH ROW EXECUTE FUNCTION audit_acm_std_site();
CREATE TABLE IF NOT EXISTS amb_acm_std_import_preview (
  sip_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, actor_id text NOT NULL,
  file_hash text NOT NULL, payload jsonb NOT NULL, result jsonb,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS amb_acm_std_import_row (
  sir_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
  file_hash text NOT NULL, source_key text NOT NULL, std_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_acm_std_import_source UNIQUE(ent_id,file_hash,source_key)
);
COMMIT;
