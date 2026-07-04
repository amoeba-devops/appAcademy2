-- ============================================================================
-- ACM CAL — expand event categories for academy workflows
--   LEVEL_TEST   : 레벨테스트
--   DEMO_CLASS   : 데모수업
--   REGULAR_CLASS: 정규수업
--   OTHER        : 기타
--
-- Legacy values (CLASS / MEETING / EVENT / PERSONAL) remain allowed so
-- historical rows continue to validate without a data rewrite.
-- ============================================================================

ALTER TABLE amb_acm_cal_event
  DROP CONSTRAINT IF EXISTS amb_acm_cal_event_evt_category_check;

ALTER TABLE amb_acm_cal_event
  ADD CONSTRAINT amb_acm_cal_event_evt_category_check
  CHECK (
    evt_category IN (
      'CLASS',
      'MEETING',
      'EVENT',
      'PERSONAL',
      'LEVEL_TEST',
      'DEMO_CLASS',
      'REGULAR_CLASS',
      'OTHER'
    )
  );
