BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE IF NOT EXISTS amb_acm_dsh_marketing_day (
  ent_id uuid NOT NULL, date date NOT NULL, revision integer NOT NULL DEFAULT 0,
  additive boolean NOT NULL DEFAULT false, costs_started boolean NOT NULL DEFAULT false,
  legacy_common_cost numeric(12,0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ent_id,date)
);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_marketing_site (
  ent_id uuid NOT NULL, date date NOT NULL, site varchar(20) NOT NULL CHECK(site IN ('TPI','TRINITY','SANTACROCE','COMMON')),
  adjustment integer CHECK(adjustment BETWEEN 0 AND 1000000000), cost_managed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(ent_id,date,site), FOREIGN KEY(ent_id,date) REFERENCES amb_acm_dsh_marketing_day(ent_id,date),
  CHECK(site <> 'COMMON' OR adjustment IS NULL)
);
CREATE TABLE IF NOT EXISTS amb_acm_dsh_ad_cost (
  adc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, date date NOT NULL,
  site varchar(20) NOT NULL, medium varchar(100) NOT NULL CHECK(length(trim(medium))>0), amount numeric(12,0) NOT NULL CHECK(amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  FOREIGN KEY(ent_id,date,site) REFERENCES amb_acm_dsh_marketing_site(ent_id,date,site)
);
CREATE INDEX IF NOT EXISTS idx_acm_dsh_ad_cost_date ON amb_acm_dsh_ad_cost(ent_id,date,site) WHERE deleted_at IS NULL;
CREATE TABLE IF NOT EXISTS amb_acm_dsh_marketing_audit (
  mka_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ent_id uuid NOT NULL, date date NOT NULL,
  actor_id uuid, revision integer NOT NULL, before_value jsonb NOT NULL, after_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(ent_id,date,revision)
);
COMMIT;
