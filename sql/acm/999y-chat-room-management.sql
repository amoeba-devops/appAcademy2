-- Additive migration: retain all existing conversations and notification history.
BEGIN;
ALTER TABLE amb_acm_talk_member ADD COLUMN IF NOT EXISTS tlm_archived_at timestamptz;
ALTER TABLE amb_acm_notification_inbox ADD COLUMN IF NOT EXISTS nin_recipient_kind varchar(10) NOT NULL DEFAULT 'USER';
ALTER TABLE amb_acm_notification_inbox ADD COLUMN IF NOT EXISTS nin_recipient_id uuid;
UPDATE amb_acm_notification_inbox SET nin_recipient_id=usr_id WHERE nin_recipient_id IS NULL;
ALTER TABLE amb_acm_notification_inbox ALTER COLUMN nin_recipient_id SET NOT NULL;
ALTER TABLE amb_acm_notification_inbox ALTER COLUMN usr_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_inbox_recipient_event ON amb_acm_notification_inbox(ent_id,nin_recipient_kind,nin_recipient_id,nob_id);
CREATE INDEX IF NOT EXISTS idx_acm_inbox_recipient ON amb_acm_notification_inbox(ent_id,nin_recipient_kind,nin_recipient_id,created_at DESC,nin_id DESC);
-- Old workers can finish pending USER deliveries during a rolling deployment.
CREATE OR REPLACE FUNCTION set_acm_inbox_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.nin_recipient_kind='USER' THEN
    NEW.nin_recipient_id := COALESCE(NEW.nin_recipient_id,NEW.usr_id);
    NEW.usr_id := NEW.nin_recipient_id;
  ELSIF NEW.nin_recipient_kind='TEACHER' THEN
    NEW.usr_id := NULL;
  ELSE
    RAISE EXCEPTION 'Invalid inbox recipient kind';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_acm_inbox_recipient ON amb_acm_notification_inbox;
CREATE TRIGGER trg_acm_inbox_recipient BEFORE INSERT OR UPDATE ON amb_acm_notification_inbox FOR EACH ROW EXECUTE FUNCTION set_acm_inbox_recipient();
COMMIT;
