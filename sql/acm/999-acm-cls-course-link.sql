-- ============================================================================
-- ACM CLS — class ↔ course master link  — 2026-07-07
-- Related:
--   - docs/analysis/REQ-260706-acm-tpi-course-category-alignment.md
--   - sql/acm/985-acm-csl-pipeline-revision.sql
--   - sql/acm/998-seed-tpi-course-catalog.sql
--
-- 목적:
--   CLS 수업(row) 이 어떤 CSL 강좌 마스터를 기반으로 생성되었는지 FK 로
--   저장한다. 기존 `cls_subject_label` 은 표시용 스냅샷 문자열로 유지한다.
--
-- 범위:
--   - amb_acm_cls_classes.cls_course_id 추가
--   - amb_acm_csl_course(crs_id) FK 추가
--   - (ent_id, cls_course_id) 조회용 partial index 추가
--
-- 주의:
--   - additive only
--   - 기존 row backfill 은 포함하지 않음 (운영 데이터 생성 후 별도 정합 작업)
-- ============================================================================

ALTER TABLE amb_acm_cls_classes
  ADD COLUMN IF NOT EXISTS cls_course_id UUID;

DO $$
BEGIN
  ALTER TABLE amb_acm_cls_classes
    ADD CONSTRAINT fk_acm_cls_classes_course
    FOREIGN KEY (cls_course_id) REFERENCES amb_acm_csl_course(crs_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_cls_classes_ent_course
  ON amb_acm_cls_classes (ent_id, cls_course_id)
  WHERE cls_deleted_at IS NULL AND cls_course_id IS NOT NULL;

