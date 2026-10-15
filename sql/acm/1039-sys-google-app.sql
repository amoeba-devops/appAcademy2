-- REQ-261016B — 시스템 설정 · Google OAuth 앱(전 테넌트 공용 1벌). 저장값이 있으면 ACM_GOOGLE_* 환경변수보다 우선.
-- ent_id 는 시스템 테넌트 고정. Client Secret 은 AES-GCM(ACM_PII_KEY) 암호화. 멱등.
CREATE TABLE IF NOT EXISTS amb_acm_sys_google_app (
  sga_id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (sga_id = 1),
  ent_id                  UUID NOT NULL DEFAULT '00000000-0000-0000-0000-0000000000ff',
  sga_client_id           VARCHAR(200) NOT NULL,
  sga_secret_encrypted    BYTEA NOT NULL,
  sga_secret_iv           BYTEA NOT NULL,
  sga_secret_auth_tag     BYTEA NOT NULL,
  sga_redirect_uri        VARCHAR(500) NOT NULL,
  sga_picker_key          VARCHAR(200),
  sga_project_number      VARCHAR(30),
  updated_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_acm_sys_google_app_updated_at ON amb_acm_sys_google_app;
CREATE TRIGGER trg_acm_sys_google_app_updated_at BEFORE UPDATE ON amb_acm_sys_google_app
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
