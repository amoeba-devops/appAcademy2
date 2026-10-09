BEGIN;
CREATE OR REPLACE FUNCTION acm_ops_master_dates() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text; sid uuid; os date; ns date; ne date; n integer; target_id uuid;
BEGIN
 IF TG_TABLE_NAME='amb_acm_std_student' THEN
  IF NEW.std_end_date < NEW.std_start_date THEN
   RAISE EXCEPTION 'STUDENT_END_PRECEDES_START' USING ERRCODE='23514';
  END IF;
 END IF;
 IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='amb_acm_std_student' THEN
  k:='STUDENT'; sid:=NEW.std_id; os:=OLD.std_start_date; ns:=NEW.std_start_date; ne:=NEW.std_end_date;
  IF NEW.std_start_date IS NOT DISTINCT FROM OLD.std_start_date AND NEW.std_end_date IS NOT DISTINCT FROM OLD.std_end_date THEN RETURN NEW; END IF;
 ELSE
  k:='TEACHER'; sid:=NEW.tch_id; os:=OLD.tch_hired_at; ns:=NEW.tch_hired_at; ne:=NEW.tch_ended_at;
  IF NEW.tch_hired_at IS NOT DISTINCT FROM OLD.tch_hired_at AND NEW.tch_ended_at IS NOT DISTINCT FROM OLD.tch_ended_at THEN RETURN NEW; END IF;
 END IF;
 IF k='STUDENT' THEN
  IF EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid) THEN
   SELECT count(*), (array_agg(opr_id))[1] INTO n,target_id FROM amb_acm_dsh_operating_period
    WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled AND start_date IS NOT DISTINCT FROM os;
   IF n=0 THEN
    SELECT count(*), (array_agg(opr_id))[1] INTO n,target_id FROM amb_acm_dsh_operating_period
     WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled;
   END IF;
   IF n<>1 THEN RAISE EXCEPTION 'STUDENT_EDIT_PERIOD_REQUIRED' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid
    AND NOT cancelled AND confirmed AND opr_id<>target_id AND daterange(start_date,end_date,'[)') && daterange(ns,ne,'[)')) THEN
    RAISE EXCEPTION 'STUDENT_OVERLAPPING_PERIOD' USING ERRCODE='23514';
   END IF;
   UPDATE amb_acm_dsh_operating_period SET start_date=ns,end_date=ne,revision=revision+1,updated_at=now()
    WHERE ent_id=NEW.ent_id AND opr_id=target_id;
  END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid) THEN
  SELECT count(*) INTO n FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled AND start_date IS NOT DISTINCT FROM os;
  IF n<>1 THEN RAISE EXCEPTION 'Edit the individual operating period instead of the representative date'; END IF;
  UPDATE amb_acm_dsh_operating_period SET start_date=ns,end_date=ne,revision=revision+1,updated_at=now() WHERE ent_id=NEW.ent_id AND kind=k AND subject_id=sid AND NOT cancelled AND start_date IS NOT DISTINCT FROM os;
 END IF;
 END IF;
 RETURN NEW;
END $$;


-- Synchronize only the period represented by the student master dates.
CREATE OR REPLACE FUNCTION acm_std_period_to_master() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE master_start date; matches integer; active_count integer;
BEGIN
 IF NEW.kind<>'STUDENT' OR pg_trigger_depth()>1 OR OLD.cancelled OR NEW.cancelled THEN RETURN NEW; END IF;
 IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN RETURN NEW; END IF;
 SELECT std_start_date INTO master_start FROM amb_acm_std_student
  WHERE ent_id=NEW.ent_id AND std_id=NEW.subject_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT count(*) FILTER (WHERE start_date IS NOT DISTINCT FROM master_start),count(*) INTO matches,active_count
  FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind='STUDENT' AND subject_id=NEW.subject_id AND NOT cancelled;
 IF (matches=1 AND OLD.start_date IS NOT DISTINCT FROM master_start) OR (matches=0 AND active_count=1) THEN
  UPDATE amb_acm_std_student SET std_start_date=NEW.start_date,std_end_date=NEW.end_date
   WHERE ent_id=NEW.ent_id AND std_id=NEW.subject_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_std_period_to_master ON amb_acm_dsh_operating_period;
CREATE TRIGGER trg_std_period_to_master BEFORE UPDATE ON amb_acm_dsh_operating_period FOR EACH ROW EXECUTE FUNCTION acm_std_period_to_master();
COMMIT;
