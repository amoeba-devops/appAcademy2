-- PLN-260718 P2 — calendar event attachments (수업/일정 첨부자료).
--
-- File attachments for a calendar event. Admins/teachers upload them in the
-- event modal; related portal users (student/parent/teacher) can download them
-- from the event detail page. Files live in S3/MinIO; this row holds metadata +
-- the object key. Distinct from amb_acm_csl_attachment (inquiry-scoped) and
-- amb_acm_material (class-scoped) — this one is keyed by evt_id.
--
-- Caps enforced in the service: ≤20MB × ≤20 rows / event.
--
-- @see docs/plan/PLN-260718-portal-materials-cal-batch.md §P2

CREATE TABLE IF NOT EXISTS amb_acm_cal_event_attachment (
  cea_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,
  evt_id          UUID         NOT NULL,
  cea_s3_key      VARCHAR(500) NOT NULL,
  cea_filename    VARCHAR(255) NOT NULL,
  cea_mime        VARCHAR(100) NOT NULL,
  cea_size_bytes  BIGINT       NOT NULL CHECK (cea_size_bytes > 0 AND cea_size_bytes <= 20971520),
  cea_uploaded_by UUID,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_cal_att_evt
  ON amb_acm_cal_event_attachment (ent_id, evt_id)
  WHERE deleted_at IS NULL;
