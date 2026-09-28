BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_cal_video_config (
  vdc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  vdc_provider VARCHAR(20) NOT NULL DEFAULT 'BODASCHOOL'
    CHECK (vdc_provider IN ('GOOGLE_MEET', 'BODASCHOOL')),
  vdc_boda_launch_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_cal_video_config_ent UNIQUE (ent_id)
);
DROP TRIGGER IF EXISTS trg_acm_cal_video_config_updated ON amb_acm_cal_video_config;
CREATE TRIGGER trg_acm_cal_video_config_updated BEFORE UPDATE ON amb_acm_cal_video_config
FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
COMMIT;
