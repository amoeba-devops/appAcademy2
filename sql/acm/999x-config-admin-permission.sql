-- Configuration management is a supplemental, tenant-scoped permission.
CREATE TABLE IF NOT EXISTS amb_acm_user_permission (
  upr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  usr_id UUID NOT NULL REFERENCES amb_acm_user(usr_id) ON DELETE CASCADE,
  upr_permission VARCHAR(40) NOT NULL CHECK (upr_permission IN ('CONFIG_ADMIN')),
  upr_granted_by UUID REFERENCES amb_acm_user(usr_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_user_permission UNIQUE (ent_id, usr_id, upr_permission)
);
CREATE INDEX IF NOT EXISTS idx_acm_user_permission_ent ON amb_acm_user_permission(ent_id);
