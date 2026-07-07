-- ============================================================================
-- ACM CLS — backfill cls_course_id from the subject-label snapshot  — 2026-07-07
-- Related:
--   - sql/acm/999-acm-cls-course-link.sql   (adds cls_course_id + FK)
--   - sql/acm/998-seed-tpi-course-catalog.sql
--
-- 목적:
--   기존 수업 row 중 강좌 연결(cls_course_id)이 비어 있으나, 표시용 스냅샷
--   (cls_subject_label)이 활성 강좌의 표시문자열 "CODE - Name" 과 **정확히**
--   일치하는 경우에 한해 FK 를 채운다. 생성 다이얼로그가 기록하는 라벨 포맷은
--   `${code} - ${name}` (frontend-acm class-create-dialog courseLabelMap).
--
-- 안전장치:
--   - additive/idempotent — 이미 연결된 row(cls_course_id NOT NULL)는 건드리지 않음
--   - ent_id 로 테넌트 격리, crs_code 는 테넌트별 unique 이므로 매칭 모호성 없음
--   - 정확히 일치하지 않는 라벨(자유입력/구 데이터)은 NULL 로 남겨 수동 정합 대상
-- ============================================================================

BEGIN;

UPDATE amb_acm_cls_classes c
SET cls_course_id = crs.crs_id,
    updated_at = NOW()
FROM amb_acm_csl_course crs
WHERE c.cls_course_id IS NULL
  AND c.cls_deleted_at IS NULL
  AND c.cls_subject_label IS NOT NULL
  AND crs.ent_id = c.ent_id
  AND crs.crs_is_active = TRUE
  AND c.cls_subject_label = crs.crs_code || ' - ' || crs.crs_name;

COMMIT;
