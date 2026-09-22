-- PLN-260922D: source observations, separate from KPI/manual inputs.
-- Apply before application deployment. No historical source inference/backfill.
BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_dsh_visit_observation (
  vob_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  vob_site VARCHAR(20) NOT NULL CHECK (vob_site IN ('TPI','TRINITY','SANTACROCE')),
  vob_date DATE NOT NULL,
  vob_source VARCHAR(10) NOT NULL CHECK (vob_source IN ('IMWEB','GA4')),
  vob_definition VARCHAR(200) NOT NULL,
  vob_metric VARCHAR(30) NOT NULL,
  vob_timezone VARCHAR(80) NOT NULL,
  vob_value INT CHECK (vob_value >= 0),
  vob_note VARCHAR(500) NOT NULL DEFAULT '',
  vob_revision INT NOT NULL DEFAULT 1 CHECK (vob_revision > 0),
  vob_actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_acm_visit_observation UNIQUE(ent_id,vob_site,vob_date,vob_source,vob_definition)
);
CREATE INDEX IF NOT EXISTS idx_acm_visit_observation_range
 ON amb_acm_dsh_visit_observation(ent_id,vob_date,vob_site);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_visit_audit (
  vad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  vob_id UUID NOT NULL REFERENCES amb_acm_dsh_visit_observation(vob_id),
  vad_before JSONB,
  vad_after JSONB NOT NULL,
  vad_actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acm_visit_audit_observation
 ON amb_acm_dsh_visit_audit(ent_id,vob_id,created_at);
CREATE OR REPLACE FUNCTION audit_acm_visit_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO amb_acm_dsh_visit_audit(ent_id,vob_id,vad_before,vad_after,vad_actor_id)
 VALUES(NEW.ent_id,NEW.vob_id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),NEW.vob_actor_id);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_acm_visit_observation_audit ON amb_acm_dsh_visit_observation;
CREATE TRIGGER trg_acm_visit_observation_audit AFTER INSERT OR UPDATE ON amb_acm_dsh_visit_observation
 FOR EACH ROW EXECUTE FUNCTION audit_acm_visit_observation();
COMMIT;
