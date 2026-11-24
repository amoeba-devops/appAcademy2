-- REQ-261125 — independent teacher/student academy portal menu visibility.
BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_tenant_portal_menu (
  tpm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL REFERENCES amb_acm_tenant(tnt_ent_id),
  tpm_kind VARCHAR(10) NOT NULL CHECK (tpm_kind IN ('TEACHER', 'STUDENT')),
  tpm_menu_key VARCHAR(30) NOT NULL CHECK (tpm_menu_key IN ('notices', 'calendar', 'students', 'links', 'materials', 'chat', 'me')),
  tpm_is_visible BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_tenant_portal_menu_scope UNIQUE (ent_id, tpm_kind, tpm_menu_key),
  CONSTRAINT ck_acm_tenant_portal_menu_role CHECK (
    (tpm_menu_key NOT IN ('calendar', 'students', 'chat') OR tpm_kind = 'TEACHER')
    AND (tpm_menu_key <> 'links' OR tpm_kind = 'STUDENT')
    AND tpm_menu_key <> 'me'
  )
);
DROP TRIGGER IF EXISTS trg_acm_tenant_portal_menu_updated ON amb_acm_tenant_portal_menu;
CREATE TRIGGER trg_acm_tenant_portal_menu_updated
  BEFORE UPDATE ON amb_acm_tenant_portal_menu
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
COMMIT;
