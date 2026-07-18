-- PLN-260719 D — 수업생성 개선 (강사=/admin/tch 전체, 시급 옵션화).
--
-- 1) 수업의 강사 참조를 강사 마스터(tch_id)로 정규화:
--    cls_teacher_tch_id 추가 + 기존 행 백필(tch_user_id 매칭).
--    콘솔계정 미연결(포털만 등록) 강사도 수업 담당 가능하도록
--    cls_teacher_user_id 는 nullable 로 완화 (콘솔계정 연결 시 dual-write).
-- 2) 시급(cst_hourly_rate) 미입력 허용 — 수업생성 폼에서 제거.
--    정산은 NULL→0 처리 (settlement.service).
--
-- @see docs/plan/PLN-260719-portal-docs-board-students.md §4 (D)

ALTER TABLE amb_acm_cls_classes
  ADD COLUMN IF NOT EXISTS cls_teacher_tch_id UUID;

-- 백필: 기존 수업의 콘솔계정 → 강사 마스터 역매핑.
UPDATE amb_acm_cls_classes c
   SET cls_teacher_tch_id = t.tch_id
  FROM amb_acm_tch_teacher t
 WHERE c.cls_teacher_tch_id IS NULL
   AND t.ent_id = c.ent_id
   AND t.tch_user_id = c.cls_teacher_user_id;

ALTER TABLE amb_acm_cls_classes
  ALTER COLUMN cls_teacher_user_id DROP NOT NULL;

-- ⚠ amb_acm_cls_* 는 접두어형 soft-delete 컬럼(cls_deleted_at) 사용 (999b 사고 참조).
CREATE INDEX IF NOT EXISTS idx_acm_cls_teacher_tch
  ON amb_acm_cls_classes (ent_id, cls_teacher_tch_id)
  WHERE cls_deleted_at IS NULL;

-- 시급 옵션화.
ALTER TABLE amb_acm_cls_class_students
  ALTER COLUMN cst_hourly_rate DROP NOT NULL;

ALTER TABLE amb_acm_cls_class_students
  DROP CONSTRAINT IF EXISTS chk_acm_cls_cst_rate;

ALTER TABLE amb_acm_cls_class_students
  ADD CONSTRAINT chk_acm_cls_cst_rate
  CHECK (cst_hourly_rate IS NULL OR (cst_hourly_rate > 0 AND cst_hourly_rate <= 500000));
