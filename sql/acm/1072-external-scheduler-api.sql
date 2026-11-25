-- External scheduler API. Additive and replayable; existing tenants remain disabled.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_user_tenant_id ON amb_acm_user(ent_id,usr_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_cal_event_tenant_id ON amb_acm_cal_event(ent_id,evt_id);
CREATE TABLE IF NOT EXISTS amb_acm_int_config (
  ent_id UUID PRIMARY KEY REFERENCES amb_acm_tenant(tnt_ent_id),
  int_is_enabled BOOLEAN NOT NULL DEFAULT false,
  int_scopes JSONB NOT NULL DEFAULT '[]',
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(int_scopes)='array')
);
CREATE TABLE IF NOT EXISTS amb_acm_int_client (
  icl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL REFERENCES amb_acm_tenant(tnt_ent_id),
  icl_name VARCHAR(100) NOT NULL,
  icl_is_active BOOLEAN NOT NULL DEFAULT true,
  icl_actor_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ent_id,icl_id),
  FOREIGN KEY(ent_id,icl_actor_id) REFERENCES amb_acm_user(ent_id,usr_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_int_api_key (
  iak_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  icl_id UUID NOT NULL,
  iak_name VARCHAR(100) NOT NULL,
  iak_hash VARCHAR(64) NOT NULL,
  iak_scopes JSONB NOT NULL,
  iak_expires_at TIMESTAMPTZ NOT NULL,
  iak_revoked_at TIMESTAMPTZ,
  iak_last_used_at TIMESTAMPTZ,
  iak_window TIMESTAMPTZ,
  iak_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ent_id,iak_id),
  FOREIGN KEY(ent_id,icl_id) REFERENCES amb_acm_int_client(ent_id,icl_id),
  CHECK(jsonb_typeof(iak_scopes)='array')
);
CREATE TABLE IF NOT EXISTS amb_acm_int_lesson_link (
  ill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  icl_id UUID NOT NULL,
  ill_external_id VARCHAR(128) NOT NULL,
  evt_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ent_id,icl_id,ill_external_id), UNIQUE(evt_id),
  FOREIGN KEY(ent_id,icl_id) REFERENCES amb_acm_int_client(ent_id,icl_id),
  FOREIGN KEY(ent_id,evt_id) REFERENCES amb_acm_cal_event(ent_id,evt_id)
);
CREATE TABLE IF NOT EXISTS amb_acm_int_request (
  irq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  icl_id UUID NOT NULL,
  irq_key VARCHAR(128) NOT NULL,
  irq_hash VARCHAR(64) NOT NULL,
  irq_result JSONB NOT NULL,
  irq_expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '24 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ent_id,icl_id,irq_key),
  FOREIGN KEY(ent_id,icl_id) REFERENCES amb_acm_int_client(ent_id,icl_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_int_request_expiry ON amb_acm_int_request(irq_expires_at);
CREATE TABLE IF NOT EXISTS amb_acm_int_audit (
  iau_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
  icl_id UUID, iak_id UUID, iau_actor_id UUID, iau_action VARCHAR(40) NOT NULL,
  iau_target_id VARCHAR(128), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acm_int_audit_tenant_time ON amb_acm_int_audit(ent_id,created_at);
ALTER TABLE amb_acm_cal_event ADD COLUMN IF NOT EXISTS evt_delivery_mode VARCHAR(10);
ALTER TABLE amb_acm_cal_event ADD COLUMN IF NOT EXISTS evt_external_students JSONB;
ALTER TABLE amb_acm_cal_event ADD COLUMN IF NOT EXISTS evt_external_client_name VARCHAR(100);
ALTER TABLE amb_acm_cal_event ADD COLUMN IF NOT EXISTS evt_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE amb_acm_cal_event DROP CONSTRAINT IF EXISTS amb_acm_cal_event_evt_source_check;
ALTER TABLE amb_acm_cal_event ADD CONSTRAINT amb_acm_cal_event_evt_source_check
  CHECK(evt_source IN ('MANUAL','CLS_SESSION','INSTANT','EXTERNAL'));
ALTER TABLE amb_acm_cal_event DROP CONSTRAINT IF EXISTS chk_acm_cal_delivery_mode;
ALTER TABLE amb_acm_cal_event ADD CONSTRAINT chk_acm_cal_delivery_mode
  CHECK(evt_delivery_mode IS NULL OR evt_delivery_mode IN ('ONSITE','ONLINE'));
-- All CAL writers participate, including ORM-independent ICS/CLS/recurrence writes.
-- A BEFORE STATEMENT lock avoids row-lock/advisory-lock inversion between bulk writers.
-- Global CAL write lock deliberately favors correctness for this small deployment.
CREATE OR REPLACE FUNCTION lock_acm_cal_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(1072,1);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_acm_cal_write_lock ON amb_acm_cal_event;
CREATE TRIGGER trg_acm_cal_write_lock BEFORE INSERT OR UPDATE OR DELETE ON amb_acm_cal_event
  FOR EACH STATEMENT EXECUTE FUNCTION lock_acm_cal_write();
DROP TRIGGER IF EXISTS trg_acm_cal_invitee_write_lock ON amb_acm_cal_invitee;
CREATE TRIGGER trg_acm_cal_invitee_write_lock BEFORE INSERT OR UPDATE OR DELETE ON amb_acm_cal_invitee
  FOR EACH STATEMENT EXECUTE FUNCTION lock_acm_cal_write();
CREATE OR REPLACE FUNCTION bump_acm_cal_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.evt_version := OLD.evt_version+1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_acm_cal_version ON amb_acm_cal_event;
CREATE TRIGGER trg_acm_cal_version BEFORE UPDATE ON amb_acm_cal_event
  FOR EACH ROW EXECUTE FUNCTION bump_acm_cal_version();
-- Direct attendee changes must also invalidate the integration ETag.
CREATE OR REPLACE FUNCTION bump_acm_cal_invitee_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE amb_acm_cal_event SET updated_at=now()
    WHERE evt_id=COALESCE(NEW.evt_id,OLD.evt_id) AND ent_id=COALESCE(NEW.ent_id,OLD.ent_id);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_acm_cal_invitee_version ON amb_acm_cal_invitee;
CREATE TRIGGER trg_acm_cal_invitee_version AFTER INSERT OR UPDATE OR DELETE ON amb_acm_cal_invitee
  FOR EACH ROW EXECUTE FUNCTION bump_acm_cal_invitee_version();
DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['config','client','api_key','lesson_link','request','audit'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_acm_int_updated ON amb_acm_int_%I',tab);
    EXECUTE format('CREATE TRIGGER trg_acm_int_updated BEFORE UPDATE ON amb_acm_int_%I FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at()',tab);
  END LOOP;
END $$;
