BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS amb_acm_ads_connection (
 adc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL,
 provider varchar(20) NOT NULL CHECK(provider IN ('META','GOOGLE','NAVER_SEARCH','NAVER_GFA')),
 account_id varchar(80) NOT NULL, name varchar(100) NOT NULL, credentials_enc text,
 config jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 1,
 active boolean NOT NULL DEFAULT false, tested_revision integer, test_result jsonb,
 last_success_at timestamptz, last_error varchar(100), disconnected_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ent_id,provider,account_id), UNIQUE(ent_id,adc_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_mapping (
 adm_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,adc_id uuid NOT NULL,
 effective_from date NOT NULL, mapping jsonb NOT NULL, revision integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,adc_id) REFERENCES amb_acm_ads_connection(ent_id,adc_id),UNIQUE(adc_id,effective_from)
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_run (
 adr_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,adc_id uuid NOT NULL,
 trigger_type varchar(20) NOT NULL, scheduled_date date, from_date date NOT NULL,to_date date NOT NULL CHECK(to_date>=from_date),
 status varchar(20) NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')), revision integer NOT NULL,
 lease_until timestamptz, fence uuid, result jsonb NOT NULL DEFAULT '{}',error_code varchar(100),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,adc_id) REFERENCES amb_acm_ads_connection(ent_id,adc_id),UNIQUE(adc_id,scheduled_date)
);
CREATE INDEX IF NOT EXISTS idx_acm_ads_run_queue ON amb_acm_ads_run(status,created_at);
CREATE TABLE IF NOT EXISTS amb_acm_ads_daily_spend (
 ads_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,adc_id uuid NOT NULL,
 date date NOT NULL,campaign_id varchar(100) NOT NULL,campaign_name varchar(300) NOT NULL,
 site varchar(20) CHECK(site IN ('TPI','TRINITY','SANTACROCE')),amount_micros numeric(24,0) NOT NULL CHECK(amount_micros>=0),
 currency varchar(3) NOT NULL,time_zone varchar(80) NOT NULL,run_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,adc_id) REFERENCES amb_acm_ads_connection(ent_id,adc_id),UNIQUE(adc_id,date,campaign_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_ads_spend_tenant_date ON amb_acm_ads_daily_spend(ent_id,date,site);
CREATE TABLE IF NOT EXISTS amb_acm_ads_day_coverage (
 adc_id uuid NOT NULL,ent_id uuid NOT NULL,date date NOT NULL,sites jsonb NOT NULL,run_id uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(adc_id,date),
 FOREIGN KEY(ent_id,adc_id) REFERENCES amb_acm_ads_connection(ent_id,adc_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_adjustment (
 ada_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,date date NOT NULL,site varchar(20) NOT NULL CHECK(site IN ('TPI','TRINITY','SANTACROCE')),
 provider varchar(20) NOT NULL CHECK(provider IN ('META','GOOGLE','NAVER_SEARCH','NAVER_GFA')),mode varchar(10) NOT NULL CHECK(mode IN ('DELTA','FIXED')),amount numeric(12,0) NOT NULL,
 reason varchar(500) NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(ent_id,date,site,provider)
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_cost_policy (
 acp_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,date date NOT NULL,site varchar(20) NOT NULL CHECK(site IN ('TPI','TRINITY','SANTACROCE')),
 manual_mode varchar(10) NOT NULL CHECK(manual_mode IN ('ADD','REPLACE')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(ent_id,date,site)
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_audit (
 ada_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid NOT NULL,actor_id uuid,action varchar(40) NOT NULL,
 target_id varchar(100) NOT NULL,before_value jsonb,after_value jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS amb_acm_ads_oauth_state (
 state_hash varchar(64) PRIMARY KEY,ent_id uuid NOT NULL,adc_id uuid NOT NULL,actor_id uuid NOT NULL,
 revision integer NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,adc_id) REFERENCES amb_acm_ads_connection(ent_id,adc_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_ads_audit_tenant_target ON amb_acm_ads_audit(ent_id,target_id,created_at);
COMMIT;
