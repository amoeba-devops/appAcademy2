-- 1012 — PLN-260914B: 사이트별 대시보드 (통합 + TPI/TRINITY/SANTACROCE)
-- daily_kpi 는 테넌트 합계(통합) 유지, 사이트 분해값은 daily_kpi_site 에 별도 저장.
-- 수동 입력·불만·상담에 사이트 컬럼 추가(NULL = 공통/미지정). Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_dsh_daily_kpi_site (
  dks_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id                 UUID NOT NULL,
  dks_site               VARCHAR(20) NOT NULL,
  dks_date               DATE NOT NULL,
  dks_year_month         VARCHAR(7) NOT NULL,
  dks_marketing_visitor  INT,
  dks_marketing_cost     NUMERIC(12,0),
  dks_marketing_effect   INT,
  dks_cs_counseling      INT NOT NULL DEFAULT 0,
  dks_cs_apply           INT NOT NULL DEFAULT 0,
  dks_cs_beginning       INT NOT NULL DEFAULT 0,
  dks_cs_missing         INT NOT NULL DEFAULT 0,
  dks_cs_trial_class     INT NOT NULL DEFAULT 0,
  dks_cs_complain        INT NOT NULL DEFAULT 0,
  dks_computed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_dsh_dks UNIQUE (ent_id, dks_site, dks_date),
  CONSTRAINT chk_acm_dsh_dks_site CHECK (dks_site IN ('TPI','TRINITY','SANTACROCE','COMMON'))
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_dks_ent_date ON amb_acm_dsh_daily_kpi_site (ent_id, dks_date);

DROP TRIGGER IF EXISTS trg_acm_dsh_dks_updated_at ON amb_acm_dsh_daily_kpi_site;
CREATE TRIGGER trg_acm_dsh_dks_updated_at
  BEFORE UPDATE ON amb_acm_dsh_daily_kpi_site
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 수동 입력: 사이트별 행 허용 (NULL = 공통). 유일키를 (ent, date, site) 로 확장.
ALTER TABLE amb_acm_dsh_manual_inputs ADD COLUMN IF NOT EXISTS min_site VARCHAR(20);
ALTER TABLE amb_acm_dsh_manual_inputs DROP CONSTRAINT IF EXISTS uq_acm_dsh_min_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_dsh_min_date_site
  ON amb_acm_dsh_manual_inputs (ent_id, min_date, COALESCE(min_site, 'COMMON'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_dsh_min_site') THEN
    ALTER TABLE amb_acm_dsh_manual_inputs
      ADD CONSTRAINT chk_acm_dsh_min_site CHECK (min_site IS NULL OR min_site IN ('TPI','TRINITY','SANTACROCE'));
  END IF;
END $$;

-- 불만: 사이트(선택)
ALTER TABLE amb_acm_dsh_complaints ADD COLUMN IF NOT EXISTS cmp_site VARCHAR(20);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_dsh_cmp_site') THEN
    ALTER TABLE amb_acm_dsh_complaints
      ADD CONSTRAINT chk_acm_dsh_cmp_site CHECK (cmp_site IS NULL OR cmp_site IN ('TPI','TRINITY','SANTACROCE'));
  END IF;
END $$;

-- 상담: 운영자 사이트 지정(웹 외 유입 귀속용). 귀속 규칙 = COALESCE(inq_site_override, inq_source_site, 'COMMON')
ALTER TABLE amb_acm_csl_inquiry ADD COLUMN IF NOT EXISTS inq_site_override VARCHAR(20);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_inq_site_override') THEN
    ALTER TABLE amb_acm_csl_inquiry
      ADD CONSTRAINT chk_acm_csl_inq_site_override CHECK (inq_site_override IS NULL OR inq_site_override IN ('TPI','TRINITY','SANTACROCE'));
  END IF;
END $$;
