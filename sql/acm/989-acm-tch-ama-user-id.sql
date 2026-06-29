-- ============================================================================
-- ACM v1.x — Teacher AMA userId persistence (REQ-260629 FR-304)
--
-- /admin/tch AMA directory section + CSL stage 2/3 lazy upsert 둘 다
-- (ent_id, ama_user_id) 키로 로컬 강사 row 를 빠르게 찾아야 한다. DTO
-- (TchCreateDto.tchAmaUserId) 는 이미 REQ-260604 v2 에서 추가되었으나
-- "passthrough only" 였음 — 본 변경으로 영속화한다.
--
-- 변경:
--   1. amb_acm_tch_teacher.tch_ama_user_id VARCHAR(64) NULL 컬럼 추가
--   2. UNIQUE INDEX uq_acm_tch_ama_user_id ON (ent_id, tch_ama_user_id)
--      WHERE tch_ama_user_id IS NOT NULL AND deleted_at IS NULL
--      → 같은 테넌트 안에서 동일 AMA user 가 두 row 가질 수 없음.
--        Soft-deleted row 는 제외하여 재등록 가능.
--
-- 멱등 (IF NOT EXISTS) — 여러 번 실행해도 안전.
-- ============================================================================

ALTER TABLE amb_acm_tch_teacher
  ADD COLUMN IF NOT EXISTS tch_ama_user_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_tch_ama_user_id
  ON amb_acm_tch_teacher (ent_id, tch_ama_user_id)
  WHERE tch_ama_user_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN amb_acm_tch_teacher.tch_ama_user_id IS
  'REQ-260629 — AMA platform userId for this teacher (set by AmaUserPicker / lazy upsert from CSL).';
