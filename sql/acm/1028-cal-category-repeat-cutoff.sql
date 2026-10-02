-- Backward-compatible schema only. Tenant data corrections run separately with
-- scripts/correct-cal-october.cjs after a reviewed dry-run and backup.
BEGIN;
ALTER TABLE amb_acm_cal_event ALTER COLUMN evt_category SET DEFAULT 'REGULAR_CLASS';
-- Actual start cutoff, distinct from crs_stop_at (original recurrence key cutoff).
-- Preserves moved October exceptions while suppressing moved November starts.
ALTER TABLE amb_acm_cal_recurrence_series ADD COLUMN IF NOT EXISTS crs_start_before TIMESTAMPTZ;
COMMIT;
