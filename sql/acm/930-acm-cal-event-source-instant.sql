-- REQ-260610 — add 'INSTANT' to evt_source CHECK constraint.
-- 'INSTANT' = 강사가 캘린더 미리 등록 없이 즉시 개설한 화상 강의.
-- 기존 'MANUAL'/'CLS_SESSION' 값은 그대로 유지.

ALTER TABLE amb_acm_cal_event
  DROP CONSTRAINT IF EXISTS amb_acm_cal_event_evt_source_check;

ALTER TABLE amb_acm_cal_event
  ADD CONSTRAINT amb_acm_cal_event_evt_source_check
  CHECK (evt_source IN ('MANUAL', 'CLS_SESSION', 'INSTANT'));

-- 강사 본인 즉시 강의 목록 조회용 (INSTANT 카드 / KPI).
CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_source_owner
  ON amb_acm_cal_event(ent_id, evt_source, evt_owner_user_id)
  WHERE deleted_at IS NULL;
