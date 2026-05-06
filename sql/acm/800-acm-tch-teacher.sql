-- ============================================================================
-- ACM TCH v1.0 — Teacher Management (교사관리)
-- @see docs/analysis/REQ-260506-acm-tch-stf-cal.md
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_tch_teacher (
  tch_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,

  -- 인적사항
  tch_name            VARCHAR(100) NOT NULL,
  tch_english_name    VARCHAR(100),
  tch_email           VARCHAR(200) NOT NULL,
  tch_phone           VARCHAR(30),
  tch_birth_date      DATE,

  -- 담당과목 (다중) — JSONB string array
  tch_subjects        JSONB        NOT NULL DEFAULT '[]'::jsonb,

  -- 메모
  tch_memo            TEXT,

  -- 로그인 계정 연계 (옵션)
  tch_user_id         UUID         REFERENCES amb_acm_user(usr_id) ON DELETE SET NULL,

  -- 상태
  tch_status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (tch_status IN ('ACTIVE', 'INACTIVE')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_tch_ent_status
  ON amb_acm_tch_teacher (ent_id, tch_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_tch_user
  ON amb_acm_tch_teacher (tch_user_id)
  WHERE tch_user_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_tch_ent_email'
  ) THEN
    ALTER TABLE amb_acm_tch_teacher
      ADD CONSTRAINT uq_acm_tch_ent_email UNIQUE (ent_id, tch_email);
  END IF;
END $$;
