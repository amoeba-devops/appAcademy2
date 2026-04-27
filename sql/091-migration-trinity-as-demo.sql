-- =============================================================
-- 091-migration-trinity-as-demo.sql
-- Marks the seed-installed Trinity Academy tenant as the canonical
-- demo tenant so it does NOT collide with future AMA-provisioned
-- tenants and is filterable from production analytics.
--
-- Idempotent: safe to run multiple times.
-- Applied by scripts/deploy-{staging,production}.sh via sql/_applied/
-- ledger.
-- =============================================================

SET NAMES utf8mb4;

-- Use a stable, well-known sentinel value so app code can detect "this is
-- the demo tenant" without joining on name. Production AMA tenants will
-- get values like "ama-tenant-2026-..." — never the literal "demo-trinity".
UPDATE tac_academies
SET acd_is_demo               = 1,
    acd_ama_tenant_id         = COALESCE(acd_ama_tenant_id, 'demo-trinity'),
    acd_subscription_status   = COALESCE(acd_subscription_status, 'ACTIVE'),
    acd_subscription_plan     = COALESCE(acd_subscription_plan,   'demo')
WHERE acd_name = 'Trinity Academy'
  AND acd_id = (
      SELECT acd_id_inner FROM (
          SELECT MIN(acd_id) AS acd_id_inner
          FROM tac_academies
          WHERE acd_name = 'Trinity Academy'
      ) AS first_match
  );

-- Belt-and-suspenders: any other row that happens to carry the
-- 'demo-trinity' sentinel must be flagged too (e.g. restored from backup).
UPDATE tac_academies
SET acd_is_demo = 1
WHERE acd_ama_tenant_id = 'demo-trinity'
  AND acd_is_demo = 0;
