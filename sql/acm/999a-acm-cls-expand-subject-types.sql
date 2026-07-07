-- ============================================================================
-- ACM CLS — expand class subject categories for TPI course catalog
-- 2026-07-07
--
-- 목적:
--   상담/수업 강좌 카탈로그(998 seed)와 CLS 수업 분류 체계를 맞춘다.
--
-- 변경:
--   - ENGLISH_TEST  : Duolingo / TOEFL / IELTS 계열
--   - SAT           : PSAT / SAT 계열
--   - ACT           : PreACT / ACT 계열
--   - COMPETITION   : 경시대회 계열
--
-- 주의:
--   기존 운영 데이터 호환을 위해 WRITING / LANGUAGE_ARTS / MATH 는 유지한다.
-- ============================================================================

BEGIN;

ALTER TABLE amb_acm_cls_classes
  DROP CONSTRAINT IF EXISTS amb_acm_cls_classes_cls_subject_type_check;

ALTER TABLE amb_acm_cls_classes
  DROP CONSTRAINT IF EXISTS chk_acm_cls_classes_subject_type;

ALTER TABLE amb_acm_cls_classes
  ADD CONSTRAINT chk_acm_cls_classes_subject_type
  CHECK (
    cls_subject_type IN (
      'MAP_TEST',
      'SSAT',
      'ISEE',
      'ENGLISH_TEST',
      'SAT',
      'ACT',
      'COMPETITION',
      'WRITING',
      'LANGUAGE_ARTS',
      'MATH',
      'INTL_PREP',
      'DEMO',
      'OTHER'
    )
  );

COMMIT;
