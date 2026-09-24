BEGIN;

CREATE TABLE IF NOT EXISTS amb_acm_system_ai_config (
  aic_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL UNIQUE,
  aic_provider VARCHAR(40) NOT NULL,
  aic_model_id VARCHAR(120) NOT NULL,
  aic_api_key_enc BYTEA,
  aic_base_url VARCHAR(500),
  aic_org_project_id VARCHAR(200),
  aic_is_active BOOLEAN NOT NULL DEFAULT FALSE,
  aic_last_test_status VARCHAR(20),
  aic_last_tested_at TIMESTAMPTZ,
  aic_last_test_message VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_system_ai_provider CHECK (
    aic_provider IN ('OPENAI', 'ANTHROPIC', 'GOOGLE_GEMINI', 'CUSTOM_OPENAI_COMPATIBLE')
  ),
  CONSTRAINT chk_acm_system_ai_test_status CHECK (
    aic_last_test_status IS NULL OR aic_last_test_status IN ('SUCCESS', 'FAILED')
  )
);

DROP TRIGGER IF EXISTS trg_acm_system_ai_config_updated_at ON amb_acm_system_ai_config;
CREATE TRIGGER trg_acm_system_ai_config_updated_at
BEFORE UPDATE ON amb_acm_system_ai_config
FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

COMMIT;
