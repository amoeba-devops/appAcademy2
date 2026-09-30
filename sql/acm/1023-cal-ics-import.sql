BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_cal_ics_source (
 cis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 batch_id UUID NOT NULL, calendar_key TEXT NOT NULL, calendar_name TEXT NOT NULL,
 source_uid TEXT NOT NULL, source_hash TEXT NOT NULL, ical_text TEXT NOT NULL,
 owner_user_id UUID NOT NULL REFERENCES amb_acm_user(usr_id),
 assignee_tch_id UUID REFERENCES amb_acm_tch_teacher(tch_id),
 category VARCHAR(20) NOT NULL, is_unbounded BOOLEAN NOT NULL,
 generated_until TIMESTAMPTZ, stopped_at TIMESTAMPTZ, stopped_by UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(ent_id,calendar_key,source_uid), UNIQUE(ent_id,cis_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_cal_ics_occurrence (
 cio_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 cis_id UUID NOT NULL, occurrence_key TEXT NOT NULL,
 evt_id UUID NOT NULL REFERENCES amb_acm_cal_event(evt_id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,cis_id) REFERENCES amb_acm_cal_ics_source(ent_id,cis_id),
 UNIQUE(ent_id,cis_id,occurrence_key), UNIQUE(evt_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_ics_source_pending ON amb_acm_cal_ics_source(ent_id,generated_until) WHERE is_unbounded AND stopped_at IS NULL;
COMMIT;
