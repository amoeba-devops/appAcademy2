-- ============================================================================
-- REQ-260630 FR-A01 — calendar event "담당자" (teacher assignee) column
--
-- Adds amb_acm_cal_event.evt_assignee_tch_id with FK to amb_acm_tch_teacher
-- (ON DELETE SET NULL — keeps the calendar event intact when a teacher row
-- is hard-deleted; soft-delete via deleted_at is the normal lifecycle and
-- doesn't touch the FK).
--
-- Partial index on (ent_id, evt_assignee_tch_id, evt_start_at) accelerates
-- "show me this teacher's upcoming events" queries on /admin/cal.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_cal_event
  ADD COLUMN IF NOT EXISTS evt_assignee_tch_id UUID;

-- FK is added separately so the IF NOT EXISTS above can run twice without
-- racing the constraint addition.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'amb_acm_cal_event'::regclass
           AND conname  = 'fk_acm_cal_evt_assignee_tch'
    ) THEN
        ALTER TABLE amb_acm_cal_event
          ADD CONSTRAINT fk_acm_cal_evt_assignee_tch
          FOREIGN KEY (evt_assignee_tch_id)
          REFERENCES amb_acm_tch_teacher(tch_id)
          ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_assignee
  ON amb_acm_cal_event (ent_id, evt_assignee_tch_id, evt_start_at)
  WHERE deleted_at IS NULL AND evt_assignee_tch_id IS NOT NULL;

COMMENT ON COLUMN amb_acm_cal_event.evt_assignee_tch_id IS
  'REQ-260630 — 담당자 강사 (FK to amb_acm_tch_teacher). Separate from evt_owner_user_id (작성자) and amb_acm_cal_invitee (참석자).';
