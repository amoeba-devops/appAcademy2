-- =========================================================================
-- 130-migration-dkp-manual-override.sql
--   Adds dkp_manually_overridden flag so daily_batch can skip days that
--   were edited via the manual-input modal.
-- =========================================================================

ALTER TABLE amb_acm_dsh_daily_kpi
  ADD COLUMN IF NOT EXISTS dkp_manually_overridden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_acm_dsh_dkp_overridden
  ON amb_acm_dsh_daily_kpi (ent_id, dkp_manually_overridden)
  WHERE dkp_manually_overridden;
