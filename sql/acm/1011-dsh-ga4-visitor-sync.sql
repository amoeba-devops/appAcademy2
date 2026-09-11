-- 1011 — PLN-260912: GA4 방문자 동기화 (대시보드 Marketing·방문자 자동화)
-- 테넌트별 GA4 설정 + 사이트별 일자 방문 통계. 서비스계정 키는 AES-256-GCM [iv|tag|ct] BYTEA (kakao/mail 패턴).
-- Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_ga4_config (
  gac_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id               UUID NOT NULL,
  gac_property_id      VARCHAR(20),
  gac_stream_map       JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {"TPI":"<streamId>","TRINITY":"…","SANTACROCE":"…"}
  gac_sa_email         VARCHAR(200),
  gac_sa_key_enc       BYTEA,                                 -- service-account JSON (encrypted)
  gac_metric           VARCHAR(20) NOT NULL DEFAULT 'activeUsers',
  gac_is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  gac_last_sync_at     TIMESTAMPTZ,
  gac_last_sync_status VARCHAR(20),
  gac_last_sync_error  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_ga4_config_ent UNIQUE (ent_id),
  CONSTRAINT chk_acm_ga4_config_metric
    CHECK (gac_metric IN ('activeUsers','totalUsers','sessions'))
);

DROP TRIGGER IF EXISTS trg_acm_ga4_config_updated_at ON amb_acm_ga4_config;
CREATE TRIGGER trg_acm_ga4_config_updated_at
  BEFORE UPDATE ON amb_acm_ga4_config
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

CREATE TABLE IF NOT EXISTS amb_acm_dsh_site_visit (
  svt_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  svt_site      VARCHAR(20) NOT NULL,
  svt_date      DATE NOT NULL,
  svt_visitors  INT NOT NULL DEFAULT 0,
  svt_sessions  INT,
  svt_pageviews INT,
  svt_source    VARCHAR(20) NOT NULL DEFAULT 'GA4',
  svt_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_dsh_svt_site_date UNIQUE (ent_id, svt_site, svt_date),
  CONSTRAINT chk_acm_dsh_svt_site CHECK (svt_site IN ('TPI','TRINITY','SANTACROCE')),
  CONSTRAINT chk_acm_dsh_svt_source CHECK (svt_source IN ('GA4','MANUAL'))
);

CREATE INDEX IF NOT EXISTS idx_acm_dsh_svt_ent_date ON amb_acm_dsh_site_visit (ent_id, svt_date);

DROP TRIGGER IF EXISTS trg_acm_dsh_site_visit_updated_at ON amb_acm_dsh_site_visit;
CREATE TRIGGER trg_acm_dsh_site_visit_updated_at
  BEFORE UPDATE ON amb_acm_dsh_site_visit
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 방문자 지표의 데이터 소스: MANUAL → EXTERNAL (GA4). 수동 입력은 override 로 계속 허용.
UPDATE amb_acm_dsh_metric_definitions
   SET met_data_source = 'EXTERNAL'
 WHERE met_code = 'mkt_visitor' AND met_data_source = 'MANUAL';
