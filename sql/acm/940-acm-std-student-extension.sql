-- ============================================================================
-- 940 — ACM STD Student fields extension (REQ-260621)
-- @see docs/analysis/REQ-260621-acm-std-student-fields-extension.md  §8
--
--  · std_end_date / std_end_reason / std_end_note   — 종료 라이프사이클
--  · std_teacher_id                                  — 담당 강사 FK 정규화
--
-- 멱등(IF NOT EXISTS). 기존 데이터 영향 없음.
-- 941 시드를 실행하기 전에 반드시 본 마이그레이션을 먼저 적용한다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. 종료 라이프사이클 컬럼
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_end_date   DATE,
  ADD COLUMN IF NOT EXISTS std_end_reason VARCHAR(30),
  ADD COLUMN IF NOT EXISTS std_end_note   TEXT;

-- enum 값 CHECK 제약 — 멱등 패턴
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_std_end_reason'
  ) THEN
    ALTER TABLE amb_acm_std_student
      ADD CONSTRAINT chk_acm_std_end_reason
      CHECK (
        std_end_reason IS NULL
        OR std_end_reason IN (
            'COMPLETED',        -- 정상수료
            'MID_TERM_DROP',    -- 중도퇴원
            'TRANSFERRED',      -- 타원이전
            'ACADEMIC_BREAK',   -- 휴학
            'RELOCATION',       -- 이주
            'OTHER'             -- 기타 (std_end_note 권장)
        )
      );
  END IF;
END $$;

-- 종료 뷰 인덱스 (부분 인덱스 — WITHDRAWN/INACTIVE 만)
CREATE INDEX IF NOT EXISTS idx_acm_std_ent_end_date
  ON amb_acm_std_student (ent_id, std_end_date DESC, std_name)
  WHERE deleted_at IS NULL AND std_end_date IS NOT NULL;

COMMENT ON COLUMN amb_acm_std_student.std_end_date
  IS '수강 종료일 (std_status IN (INACTIVE, WITHDRAWN) 일 때 필수 — 응용 검증)';
COMMENT ON COLUMN amb_acm_std_student.std_end_reason
  IS '종료 사유 코드 (COMPLETED|MID_TERM_DROP|TRANSFERRED|ACADEMIC_BREAK|RELOCATION|OTHER)';
COMMENT ON COLUMN amb_acm_std_student.std_end_note
  IS '종료 사유 메모 (std_end_reason=OTHER 일 때 필수 — 응용 검증)';


-- ----------------------------------------------------------------------------
-- A2. 담당 강사 FK 정규화
--     기존 std_teacher (VARCHAR) 컬럼은 deprecated 로 보존 — 즉시 삭제 금지.
--     데이터 백필은 별도 운영 task.
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_teacher_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acm_std_teacher_id'
  ) THEN
    ALTER TABLE amb_acm_std_student
      ADD CONSTRAINT fk_acm_std_teacher_id
      FOREIGN KEY (std_teacher_id)
      REFERENCES amb_acm_tch_teacher(tch_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_std_ent_teacher
  ON amb_acm_std_student (ent_id, std_teacher_id)
  WHERE deleted_at IS NULL AND std_teacher_id IS NOT NULL;

COMMENT ON COLUMN amb_acm_std_student.std_teacher_id
  IS '담당 강사 FK → amb_acm_tch_teacher.tch_id (REQ-260506 FR-TCH-5). 기존 std_teacher(VARCHAR)는 deprecated.';
COMMENT ON COLUMN amb_acm_std_student.std_teacher
  IS '[DEPRECATED] 자유 텍스트 강사명. std_teacher_id 로 점진 마이그레이션 후 제거 예정.';

-- ============================================================================
-- End of 940
-- ============================================================================
