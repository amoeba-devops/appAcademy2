-- PLN-260706 — link a consultation inquiry to the STD student that gets
-- auto-registered when the inquiry advances to CLASS_STARTED.
--
-- Serves as the idempotency guard for auto-registration: if inq_std_id is
-- already set, the class_started hook skips re-creating the student/parent.
--
-- @see docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md §4.3

ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_std_id UUID;

CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_std
  ON amb_acm_csl_inquiry (ent_id, inq_std_id);
