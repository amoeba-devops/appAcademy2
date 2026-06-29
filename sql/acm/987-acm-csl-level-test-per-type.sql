-- ============================================================================
-- ACM v1.x — CSL Level Test per-exam-type schedule (DSN-260629 §6)
--
-- Stage 2 (레벨테스트) 재설계 — 인콰이어리의 신청 시험종류별로 1 row.
-- 운영자는 시험마다 응시예정일/시간/담당강사/상태/점수를 별도 관리한다.
--
-- 변경:
--   1. mpt_scheduled_status enum 의미 변경:
--      legacy: SCHEDULED/TAKEN/NOT_TAKING/RESCHEDULED
--      new:    PENDING / COMPLETED / NOT_HELD  (대기 / 진행완료 / 미진행)
--      기존 production data 가 있으면 매핑하여 보존.
--   2. uq(inq_id, mpt_test_type) UNIQUE INDEX 추가 — 1:N 강제.
--   3. mpt_teacher_id UUID 컬럼 추가 (FK → amb_acm_tch_teacher) — 시험별
--      학원측 시간조율 담당강사.
--
-- @see docs/design/DSN-260629-csl-stage-screen-revision.md §6
-- ============================================================================

-- 1. status enum 마이그레이션 (idempotent)
--
-- 기존 CHECK constraint 이름은 PG auto-gen 이라 DO 블록으로 찾아 drop.
-- 그 후 데이터 매핑 + 새 CHECK 부착.
DO $$
DECLARE
  legacy_constraint TEXT;
BEGIN
  SELECT conname INTO legacy_constraint
    FROM pg_constraint
   WHERE conrelid = 'amb_acm_csl_map_test'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%mpt_scheduled_status%'
   LIMIT 1;

  IF legacy_constraint IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE amb_acm_csl_map_test DROP CONSTRAINT %I',
      legacy_constraint
    );
    RAISE NOTICE 'dropped legacy CHECK %', legacy_constraint;
  END IF;
END $$;

-- 데이터 매핑 (legacy → new). 4 → 3 으로 축소되므로 의미 가장 가까운 것에 매핑.
--   SCHEDULED   → PENDING
--   TAKEN       → COMPLETED
--   NOT_TAKING  → NOT_HELD
--   RESCHEDULED → PENDING  (재예약은 다시 대기 상태)
UPDATE amb_acm_csl_map_test
   SET mpt_scheduled_status = CASE mpt_scheduled_status
         WHEN 'SCHEDULED'   THEN 'PENDING'
         WHEN 'TAKEN'       THEN 'COMPLETED'
         WHEN 'NOT_TAKING'  THEN 'NOT_HELD'
         WHEN 'RESCHEDULED' THEN 'PENDING'
         ELSE mpt_scheduled_status
       END
 WHERE mpt_scheduled_status IN ('SCHEDULED','TAKEN','NOT_TAKING','RESCHEDULED');

-- 새 CHECK 부착
DO $$ BEGIN
  ALTER TABLE amb_acm_csl_map_test
    ADD CONSTRAINT chk_acm_csl_mpt_scheduled_status_v2
    CHECK (mpt_scheduled_status IS NULL
           OR mpt_scheduled_status IN ('PENDING','COMPLETED','NOT_HELD'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN amb_acm_csl_map_test.mpt_scheduled_status IS
  'DSN-260629 §6.3 — 3-state level-test status: PENDING(대기) / COMPLETED(진행완료) / NOT_HELD(미진행). Legacy 4-state (SCHEDULED/TAKEN/NOT_TAKING/RESCHEDULED) 는 987 에서 매핑됨.';

-- 2. UNIQUE INDEX — 시험종류별 1 row 강제 (1:N)
--    UNIQUE 가 NULL 처리는 모든 NULL 을 distinct 취급하므로, mpt_test_type
--    NOT NULL DEFAULT 'MAP' (이미 985 에서 설정됨) 와 함께 안전.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_csl_mpt_inq_type
  ON amb_acm_csl_map_test (inq_id, mpt_test_type);

-- 3. 시험별 담당강사 (학원측 시간조율 책임자)
ALTER TABLE amb_acm_csl_map_test
  ADD COLUMN IF NOT EXISTS mpt_teacher_id UUID;

DO $$ BEGIN
  ALTER TABLE amb_acm_csl_map_test
    ADD CONSTRAINT fk_acm_csl_mpt_teacher
    FOREIGN KEY (mpt_teacher_id) REFERENCES amb_acm_tch_teacher(tch_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_acm_csl_mpt_teacher
  ON amb_acm_csl_map_test (ent_id, mpt_teacher_id)
 WHERE mpt_teacher_id IS NOT NULL;

COMMENT ON COLUMN amb_acm_csl_map_test.mpt_teacher_id IS
  'DSN-260629 §6 — 시험별 학원측 시간조율 담당강사. CAL invitee 자동 추가.';
