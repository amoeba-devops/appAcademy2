-- Preserve USER creator records; teacher-created DMs use a typed identity.
BEGIN;
ALTER TABLE amb_acm_talk_channel ALTER COLUMN tlc_created_by DROP NOT NULL;
ALTER TABLE amb_acm_talk_channel ADD COLUMN IF NOT EXISTS tlc_creator_kind varchar(10) NOT NULL DEFAULT 'USER';
ALTER TABLE amb_acm_talk_channel ADD COLUMN IF NOT EXISTS tlc_creator_ref uuid;
UPDATE amb_acm_talk_channel SET tlc_creator_ref=tlc_created_by WHERE tlc_creator_ref IS NULL;
ALTER TABLE amb_acm_talk_channel ALTER COLUMN tlc_creator_ref SET NOT NULL;
CREATE OR REPLACE FUNCTION set_acm_talk_creator() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tlc_creator_kind='USER' THEN
    NEW.tlc_creator_ref := COALESCE(NEW.tlc_creator_ref,NEW.tlc_created_by);
    NEW.tlc_created_by := NEW.tlc_creator_ref;
  ELSIF NEW.tlc_creator_kind='TEACHER' AND NEW.tlc_type='DIRECT' THEN
    NEW.tlc_created_by := NULL;
  ELSE
    RAISE EXCEPTION 'Invalid chat creator';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_acm_talk_creator ON amb_acm_talk_channel;
CREATE TRIGGER trg_acm_talk_creator BEFORE INSERT OR UPDATE ON amb_acm_talk_channel FOR EACH ROW EXECUTE FUNCTION set_acm_talk_creator();
COMMIT;
