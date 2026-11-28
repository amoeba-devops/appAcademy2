-- REQ-261128-CAL / PLN-261128-CAL — calendar category management + color picker.
-- Idempotent: safe to re-run.
--  1) amb_acm_cal_category: per-tenant categories (5 system + editable ones)
--  2) seed system 5 + AVAILABLE / UNAVAILABLE / CANCELED / ABSENT (not in stats)
--     for every tenant that already uses the calendar (others are seeded lazily)
--  3) drop the fixed evt_category CHECK (validated in CalCategoryService)
--  4) color settings: palette names → the same color as #rrggbb

CREATE TABLE IF NOT EXISTS amb_acm_cal_category (
  cct_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID NOT NULL,
  cct_code        VARCHAR(20) NOT NULL,
  cct_name        VARCHAR(40),
  cct_is_system   BOOLEAN NOT NULL DEFAULT false,
  cct_in_stats    BOOLEAN NOT NULL DEFAULT true,
  cct_sort_order  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT uq_acm_cal_category_code UNIQUE (ent_id, cct_code)
);
CREATE INDEX IF NOT EXISTS idx_acm_cal_category_ent_order
  ON amb_acm_cal_category (ent_id, cct_sort_order);

DROP TRIGGER IF EXISTS trg_acm_cal_category_updated ON amb_acm_cal_category;
CREATE TRIGGER trg_acm_cal_category_updated
  BEFORE UPDATE ON amb_acm_cal_category
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

INSERT INTO amb_acm_cal_category (ent_id, cct_code, cct_is_system, cct_in_stats, cct_sort_order)
SELECT t.ent_id, d.code, d.sys, d.st, d.ord
  FROM (SELECT DISTINCT ent_id FROM amb_acm_cal_event
        UNION SELECT DISTINCT ent_id FROM amb_acm_cal_color_setting) t
 CROSS JOIN (VALUES
   ('MEETING',       true,  true,  0),
   ('LEVEL_TEST',    true,  true,  1),
   ('DEMO_CLASS',    true,  true,  2),
   ('REGULAR_CLASS', true,  true,  3),
   ('OTHER',         true,  true,  4),
   ('AVAILABLE',     false, false, 5),
   ('UNAVAILABLE',   false, false, 6),
   ('CANCELED',      false, false, 7),
   ('ABSENT',        false, false, 8)
 ) AS d(code, sys, st, ord)
ON CONFLICT (ent_id, cct_code) DO NOTHING;

ALTER TABLE amb_acm_cal_event DROP CONSTRAINT IF EXISTS amb_acm_cal_event_evt_category_check;

UPDATE amb_acm_cal_color_setting
   SET ccs_palette = CASE ccs_palette
         WHEN 'blue'   THEN '#3b82f6'
         WHEN 'purple' THEN '#a855f7'
         WHEN 'amber'  THEN '#f59e0b'
         WHEN 'green'  THEN '#10b981'
         WHEN 'rose'   THEN '#f43f5e'
         WHEN 'cyan'   THEN '#06b6d4'
         WHEN 'orange' THEN '#f97316'
         WHEN 'gray'   THEN '#6b7280'
       END,
       updated_at = NOW()
 WHERE ccs_palette IN ('blue','purple','amber','green','rose','cyan','orange','gray');
