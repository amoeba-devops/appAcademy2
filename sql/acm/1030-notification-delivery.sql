BEGIN;
-- Apply after the existing talk/inbox schema. Insert-time timestamp preserves channel-lock order.
ALTER TABLE amb_acm_talk_message ALTER COLUMN created_at SET DEFAULT clock_timestamp();
ALTER TABLE amb_acm_notification_outbox DROP CONSTRAINT IF EXISTS amb_acm_notification_outbox_nob_type_check;
ALTER TABLE amb_acm_notification_outbox ADD CONSTRAINT amb_acm_notification_outbox_nob_type_check CHECK (nob_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','CHAT_MENTION','CHAT_MESSAGE','REVIEW_OVERDUE'));
CREATE TABLE IF NOT EXISTS amb_acm_cal_review_reminder (
 rrm_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, evt_id uuid NOT NULL,
 rrm_stage int NOT NULL CHECK (rrm_stage IN (5,10)), created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_review_reminder UNIQUE(ent_id,evt_id,rrm_stage)
);
CREATE TABLE IF NOT EXISTS amb_acm_notification_rollout (
 nrl_id varchar(40) PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO amb_acm_notification_rollout(nrl_id) VALUES ('review-reminders') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS amb_acm_cal_feedback_send (
 cfs_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, evt_id uuid NOT NULL,
 tch_id uuid NOT NULL, cfs_key uuid NOT NULL, cfs_hash varchar(64) NOT NULL,
 cfs_result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_feedback_send UNIQUE(ent_id,tch_id,cfs_key)
);
ALTER TABLE amb_acm_cal_feedback_send ADD COLUMN IF NOT EXISTS cfs_feedback_updated_at timestamptz;
ALTER TABLE amb_acm_cal_feedback_send ADD COLUMN IF NOT EXISTS cfs_content_hash varchar(64);
ALTER TABLE amb_acm_cal_feedback_send ADD COLUMN IF NOT EXISTS cfs_recipients jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS amb_acm_push_subscription (
 psu_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, psu_kind varchar(10) NOT NULL CHECK(psu_kind IN ('USER','TEACHER')),
 psu_recipient_id uuid NOT NULL, psu_endpoint_hash varchar(64) NOT NULL UNIQUE, psu_subscription jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS amb_acm_push_delivery (
 pdl_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 psu_id uuid NOT NULL REFERENCES amb_acm_push_subscription(psu_id) ON DELETE CASCADE,
 nin_id uuid NOT NULL REFERENCES amb_acm_notification_inbox(nin_id) ON DELETE CASCADE,
 pdl_attempts int NOT NULL DEFAULT 0, pdl_next_at timestamptz NOT NULL DEFAULT now(), pdl_done_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT uq_acm_push_delivery UNIQUE(psu_id,nin_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_push_delivery_pending ON amb_acm_push_delivery(pdl_next_at) WHERE pdl_done_at IS NULL;
COMMIT;
