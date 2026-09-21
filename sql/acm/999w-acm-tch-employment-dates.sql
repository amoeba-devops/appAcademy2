BEGIN;
CREATE OR REPLACE FUNCTION acm_ops_master_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text; sid uuid; os date; ns date; ne date; n integer;
BEGIN
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION acm_tch_validate_employment_dates() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.tch_hired_at IS NOT DISTINCT FROM OLD.tch_hired_at AND NEW.tch_ended_at IS NOT DISTINCT FROM OLD.tch_ended_at THEN RETURN NEW; END IF;
 IF NEW.tch_ended_at < NEW.tch_hired_at THEN RAISE EXCEPTION 'EMPLOYMENT_END_PRECEDES_START' USING ERRCODE='23514'; END IF;
 IF pg_trigger_depth()=1 AND EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind='TEACHER' AND subject_id=NEW.tch_id) THEN
   IF NEW.tch_hired_at IS NULL THEN RAISE EXCEPTION 'EMPLOYMENT_EDIT_PERIOD_REQUIRED' USING ERRCODE='23514'; END IF;
   IF (SELECT count(*) FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind='TEACHER' AND subject_id=NEW.tch_id AND NOT cancelled AND start_date IS NOT DISTINCT FROM OLD.tch_hired_at)<>1 THEN
     RAISE EXCEPTION 'EMPLOYMENT_EDIT_PERIOD_REQUIRED' USING ERRCODE='23514';
   END IF;
   IF EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind='TEACHER' AND subject_id=NEW.tch_id AND NOT cancelled AND confirmed AND start_date IS DISTINCT FROM OLD.tch_hired_at AND daterange(start_date,end_date,'[)') && daterange(NEW.tch_hired_at,NEW.tch_ended_at,'[)')) THEN
     RAISE EXCEPTION 'EMPLOYMENT_OVERLAPPING_PERIOD' USING ERRCODE='23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tch_validate_employment_dates ON amb_acm_tch_teacher;
CREATE TRIGGER trg_tch_validate_employment_dates BEFORE UPDATE OF tch_hired_at,tch_ended_at ON amb_acm_tch_teacher FOR EACH ROW EXECUTE FUNCTION acm_tch_validate_employment_dates();
CREATE OR REPLACE FUNCTION acm_tch_period_to_master() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind<>'TEACHER' OR pg_trigger_depth()>1 OR OLD.cancelled OR NEW.cancelled THEN RETURN NEW; END IF;
 IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN RETURN NEW; END IF;
 UPDATE amb_acm_tch_teacher SET tch_hired_at=NEW.start_date,tch_ended_at=NEW.end_date,updated_at=now()
 WHERE ent_id=NEW.ent_id AND tch_id=NEW.subject_id AND deleted_at IS NULL AND tch_hired_at IS NOT DISTINCT FROM OLD.start_date
 AND (SELECT count(*) FROM amb_acm_dsh_operating_period p WHERE p.ent_id=NEW.ent_id AND p.kind='TEACHER' AND p.subject_id=NEW.subject_id AND NOT p.cancelled AND p.start_date IS NOT DISTINCT FROM OLD.start_date)=1;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tch_period_to_master ON amb_acm_dsh_operating_period;
CREATE TRIGGER trg_tch_period_to_master BEFORE UPDATE ON amb_acm_dsh_operating_period FOR EACH ROW EXECUTE FUNCTION acm_tch_period_to_master();
COMMIT;
