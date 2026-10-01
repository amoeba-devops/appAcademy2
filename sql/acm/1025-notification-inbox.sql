-- Persistent personal inbox + transactional delivery outbox. No historical backfill.
BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_notification_outbox (
  nob_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
  nob_type varchar(32) NOT NULL CHECK (nob_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','CHAT_MENTION')),
  nob_target_id uuid NOT NULL, nob_actor_id uuid,
  nob_payload jsonb NOT NULL DEFAULT '{}', nob_recipients jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), nob_delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_acm_notification_outbox_pending ON amb_acm_notification_outbox(created_at) WHERE nob_delivered_at IS NULL;
CREATE TABLE IF NOT EXISTS amb_acm_notification_inbox (
  nin_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
  usr_id uuid NOT NULL, nob_id uuid NOT NULL REFERENCES amb_acm_notification_outbox(nob_id),
  nin_type varchar(32) NOT NULL, nin_target_id uuid NOT NULL, nin_payload jsonb NOT NULL,
  nin_read_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_acm_notification_inbox_event UNIQUE(ent_id,usr_id,nob_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_notification_inbox_user ON amb_acm_notification_inbox(ent_id,usr_id,created_at DESC,nin_id DESC);
CREATE INDEX IF NOT EXISTS idx_acm_notification_inbox_unread ON amb_acm_notification_inbox(ent_id,usr_id) WHERE nin_read_at IS NULL;
ALTER TABLE amb_acm_talk_message ADD COLUMN IF NOT EXISTS tms_mentions jsonb NOT NULL DEFAULT '[]';
COMMIT;
