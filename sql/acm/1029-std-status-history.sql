BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_std_status_history (
 ssh_sequence BIGINT GENERATED ALWAYS AS IDENTITY,
 ssh_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 std_id UUID NOT NULL, ssh_previous VARCHAR(20), ssh_status VARCHAR(20) NOT NULL
 CHECK (ssh_status IN ('ACTIVE','INACTIVE','WITHDRAWN')),
 ssh_date DATE, ssh_site VARCHAR(30), ssh_actor UUID,
 ssh_source VARCHAR(20) NOT NULL, ssh_revision INTEGER NOT NULL DEFAULT 1,
 ssh_corrections JSONB NOT NULL DEFAULT '[]',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_std_status_history_student ON amb_acm_std_status_history(ent_id,std_id,created_at);
CREATE INDEX IF NOT EXISTS idx_acm_std_status_history_date ON amb_acm_std_status_history(ent_id,ssh_date);
-- Baselines are not evidence of unrecorded past pauses/returns. No inferred dates.
INSERT INTO amb_acm_std_status_history(ent_id,std_id,ssh_status,ssh_date,ssh_site,ssh_source)
SELECT ent_id,std_id,std_status,
 CASE WHEN std_status='ACTIVE' THEN std_admission_date WHEN std_status='WITHDRAWN' THEN std_withdrawn_date END,
 std_site,'BASELINE' FROM amb_acm_std_student s
WHERE NOT EXISTS(SELECT 1 FROM amb_acm_std_status_history h WHERE h.ent_id=s.ent_id AND h.std_id=s.std_id);
CREATE OR REPLACE FUNCTION record_acm_student_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE effective DATE; actor UUID;
BEGIN
 IF TG_OP='UPDATE' AND NEW.std_status IS NOT DISTINCT FROM OLD.std_status THEN RETURN NEW; END IF;
 effective := NULLIF(current_setting('acm.status_date',true),'')::date;
 actor := COALESCE(NULLIF(current_setting('acm.status_actor',true),''),NULLIF(current_setting('acm.actor_id',true),''))::uuid;
 IF effective IS NULL AND TG_OP='INSERT' AND NEW.std_status='ACTIVE' THEN effective:=NEW.std_admission_date; END IF;
 IF effective IS NULL AND NEW.std_status='WITHDRAWN' AND (TG_OP='INSERT' OR NEW.std_withdrawn_date IS DISTINCT FROM OLD.std_withdrawn_date) THEN effective:=NEW.std_withdrawn_date; END IF;
 INSERT INTO amb_acm_std_status_history(ent_id,std_id,ssh_previous,ssh_status,ssh_date,ssh_site,ssh_actor,ssh_source)
 VALUES(NEW.ent_id,NEW.std_id,CASE WHEN TG_OP='UPDATE' THEN OLD.std_status END,NEW.std_status,effective,NEW.std_site,actor,
 CASE WHEN TG_OP='INSERT' THEN 'CREATED' ELSE 'CHANGE' END);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_acm_student_status ON amb_acm_std_student;
CREATE TRIGGER trg_acm_student_status AFTER INSERT OR UPDATE OF std_status ON amb_acm_std_student
FOR EACH ROW EXECUTE FUNCTION record_acm_student_status();
COMMIT;
