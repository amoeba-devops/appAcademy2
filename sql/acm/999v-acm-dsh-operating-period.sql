-- Additive operating history; legacy KPI values are never rewritten.
BEGIN;
ALTER TABLE amb_acm_tch_teacher ADD COLUMN IF NOT EXISTS tch_ended_at date;
CREATE TABLE IF NOT EXISTS amb_acm_dsh_operating_period (
 opr_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('STUDENT','TEACHER')), subject_id uuid,
 site text CHECK(site IN ('TPI','TRINITY','SANTACROCE')),
 start_date date, end_date date, source_key text NOT NULL,
 confirmed boolean NOT NULL DEFAULT true, cancelled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1, actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date IS NULL OR start_date IS NULL OR end_date>=start_date),
 CHECK(NOT confirmed OR subject_id IS NOT NULL),
 UNIQUE(ent_id,source_key)
);
CREATE INDEX IF NOT EXISTS idx_acm_ops_period_subject ON amb_acm_dsh_operating_period(ent_id,kind,subject_id);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_operating_manual (
 omv_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 date date NOT NULL, site text NOT NULL CHECK(site IN ('ALL','TPI','TRINITY','SANTACROCE')),
 metric text NOT NULL CHECK(metric IN ('ops_new_st','ops_out_st','ops_count_st','ops_new_tc','ops_out_tc','ops_count_tc')),
 value integer CHECK(value>=0), source text NOT NULL, actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ent_id,date,site,metric)
);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_operating_audit (
 opa_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 record_id uuid NOT NULL, record_type text NOT NULL, before_value jsonb, after_value jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION acm_ops_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO amb_acm_dsh_operating_audit(ent_id,record_id,record_type,before_value,after_value)
 VALUES(NEW.ent_id,CASE WHEN TG_TABLE_NAME='amb_acm_dsh_operating_period' THEN (to_jsonb(NEW)->>'opr_id')::uuid ELSE (to_jsonb(NEW)->>'omv_id')::uuid END,TG_TABLE_NAME,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ops_audit ON amb_acm_dsh_operating_period;
CREATE TRIGGER trg_ops_audit AFTER INSERT OR UPDATE ON amb_acm_dsh_operating_period FOR EACH ROW EXECUTE FUNCTION acm_ops_audit();
DROP TRIGGER IF EXISTS trg_ops_audit ON amb_acm_dsh_operating_manual;
CREATE TRIGGER trg_ops_audit AFTER INSERT OR UPDATE ON amb_acm_dsh_operating_manual FOR EACH ROW EXECUTE FUNCTION acm_ops_audit();
CREATE OR REPLACE FUNCTION acm_ops_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.subject_id IS NOT NULL THEN
  IF NEW.kind='STUDENT' THEN
   PERFORM 1 FROM amb_acm_std_student WHERE ent_id=NEW.ent_id AND std_id=NEW.subject_id;
  ELSE
   PERFORM 1 FROM amb_acm_tch_teacher WHERE ent_id=NEW.ent_id AND tch_id=NEW.subject_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Period subject tenant mismatch'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ops_period_guard ON amb_acm_dsh_operating_period;
CREATE TRIGGER trg_ops_period_guard BEFORE INSERT OR UPDATE ON amb_acm_dsh_operating_period FOR EACH ROW EXECUTE FUNCTION acm_ops_period_guard();
-- Existing date writers update the matching historical period, never all periods.
CREATE OR REPLACE FUNCTION acm_ops_master_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text; sid uuid; os date; ns date; ne date; n integer;
BEGIN
 IF TG_TABLE_NAME='amb_acm_std_student' THEN
  k:='STUDENT'; sid:=NEW.std_id; os:=OLD.std_start_date; ns:=NEW.std_start_date; ne:=NEW.std_end_date;
  IF NEW.std_start_date IS NOT DISTINCT FROM OLD.std_start_date AND NEW.std_end_date IS NOT DISTINCT FROM OLD.std_end_date THEN RETURN NEW; END IF;
 ELSE
  k:='TEACHER'; sid:=NEW.tch_id; os:=OLD.tch_hired_at; ns:=NEW.tch_hired_at; ne:=NEW.tch_ended_at;
  IF NEW.tch_hired_at IS NOT DISTINCT FROM OLD.tch_hired_at AND NEW.tch_ended_at IS NOT DISTINCT FROM OLD.tch_ended_at THEN RETURN NEW; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid) THEN
  SELECT count(*) INTO n FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled AND start_date IS NOT DISTINCT FROM os;
  IF n<>1 THEN RAISE EXCEPTION 'Edit the individual operating period instead of the representative date'; END IF;
  UPDATE amb_acm_dsh_operating_period SET start_date=ns,end_date=ne,revision=revision+1,updated_at=now() WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled AND start_date IS NOT DISTINCT FROM os;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ops_master_dates ON amb_acm_std_student;
CREATE TRIGGER trg_ops_master_dates AFTER UPDATE OF std_start_date,std_end_date ON amb_acm_std_student FOR EACH ROW EXECUTE FUNCTION acm_ops_master_dates();
DROP TRIGGER IF EXISTS trg_ops_master_dates ON amb_acm_tch_teacher;
CREATE TRIGGER trg_ops_master_dates AFTER UPDATE OF tch_hired_at,tch_ended_at ON amb_acm_tch_teacher FOR EACH ROW EXECUTE FUNCTION acm_ops_master_dates();
COMMIT;
