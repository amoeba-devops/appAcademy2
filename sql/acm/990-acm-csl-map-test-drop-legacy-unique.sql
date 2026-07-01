-- ============================================================================
-- FIX-260630 — drop legacy UNIQUE(inq_id) on amb_acm_csl_map_test
--
-- Bug: PROD `PUT /api/acm/csl/inquiries/:inq/level-tests/ISEE` → 500.
--
-- Root cause:
--   sql/acm/100-acm-v1.0a-init.sql:275 defined the original 1:1 table with
--   `inq_id UUID NOT NULL UNIQUE` — a column-level UNIQUE constraint with an
--   auto-generated name (`amb_acm_csl_map_test_inq_id_key` by convention).
--
--   sql/acm/987-acm-csl-level-test-per-type.sql added the new composite
--   `UNIQUE(inq_id, mpt_test_type)` (uq_acm_csl_mpt_inq_type) but never
--   dropped the legacy single-column UNIQUE. So:
--     1st save (MAP) → INSERT row #1 (passes both UNIQUE constraints).
--     2nd save (ISEE) → INSERT row #2 with same inq_id → legacy
--                       UNIQUE(inq_id) violates → 500.
--
-- This migration finds the auto-named UNIQUE constraint on `inq_id` alone
-- (i.e. exactly one indexed column, NOT the composite (inq_id, type) we want
-- to keep) and drops it. Composite UNIQUE 가 1:N picker 의 진실원천.
-- ============================================================================

DO $$
DECLARE
    legacy_constraint TEXT;
BEGIN
    SELECT conname INTO legacy_constraint
      FROM pg_constraint
     WHERE conrelid = 'amb_acm_csl_map_test'::regclass
       AND contype  = 'u'
       AND conkey   = ARRAY[
           (SELECT attnum
              FROM pg_attribute
             WHERE attrelid = 'amb_acm_csl_map_test'::regclass
               AND attname  = 'inq_id')
       ]::smallint[];

    IF legacy_constraint IS NULL THEN
        RAISE NOTICE 'no legacy single-column UNIQUE(inq_id) found — already dropped';
    ELSE
        EXECUTE format(
          'ALTER TABLE amb_acm_csl_map_test DROP CONSTRAINT %I',
          legacy_constraint
        );
        RAISE NOTICE 'dropped legacy UNIQUE constraint %', legacy_constraint;
    END IF;
END $$;

-- Defensive: explicit DROP by the conventional name in case the DO block
-- above doesn't match the actual constraint name. IF EXISTS so it's a no-op
-- when the DO block already cleaned up.
ALTER TABLE amb_acm_csl_map_test
  DROP CONSTRAINT IF EXISTS amb_acm_csl_map_test_inq_id_key;
