BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_cal_color_setting (
 ccs_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 ccs_kind VARCHAR(10) NOT NULL CHECK(ccs_kind IN ('CATEGORY','ASSIGNEE')),
 ccs_target TEXT NOT NULL, ccs_palette VARCHAR(20) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_cal_color_target UNIQUE(ent_id,ccs_kind,ccs_target)
);
CREATE TABLE IF NOT EXISTS amb_acm_cal_recurrence_series (
 crs_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 crs_owner_user_id UUID NOT NULL, crs_request_id UUID NOT NULL,
 crs_request_hash TEXT NOT NULL, crs_template JSONB NOT NULL, crs_rule JSONB NOT NULL,
 crs_timezone TEXT NOT NULL, crs_changes JSONB NOT NULL DEFAULT '[]', crs_version INTEGER NOT NULL DEFAULT 1,
 crs_generated_until TIMESTAMPTZ, crs_stop_at TIMESTAMPTZ,
 crs_error TEXT, crs_notify_claimed BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT uq_acm_cal_series_request UNIQUE(ent_id,crs_request_id),
 CONSTRAINT uq_acm_cal_series_ent UNIQUE(ent_id,crs_id)
);
ALTER TABLE amb_acm_cal_recurrence_series ADD COLUMN IF NOT EXISTS crs_error TEXT;
CREATE TABLE IF NOT EXISTS amb_acm_cal_recurrence_occurrence (
 cro_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 crs_id UUID NOT NULL, cro_key TIMESTAMPTZ NOT NULL, evt_id UUID NOT NULL REFERENCES amb_acm_cal_event(evt_id),
 cro_is_exception BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT fk_acm_cal_occ_series FOREIGN KEY(ent_id,crs_id) REFERENCES amb_acm_cal_recurrence_series(ent_id,crs_id),
 CONSTRAINT uq_acm_cal_occ_key UNIQUE(ent_id,crs_id,cro_key),
 CONSTRAINT uq_acm_cal_occ_event UNIQUE(evt_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_cal_series_ent ON amb_acm_cal_recurrence_series(ent_id);
COMMIT;
