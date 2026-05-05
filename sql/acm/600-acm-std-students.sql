-- ============================================================================
-- ACM STD v1.0 — Student Management (학생관리)
-- @see docs/analysis/REQ-260505-acm-std-student-mgmt.md
-- Idempotent. Safe to re-run.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS amb_acm_std_student (
  std_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,

  -- 기본 인적사항
  std_name            VARCHAR(100) NOT NULL,
  std_english_name    VARCHAR(100),
  std_gender          CHAR(1)      CHECK (std_gender IN ('M','F')),
  std_birth_date      DATE,
  std_phone           VARCHAR(30),
  std_residence       VARCHAR(100),

  -- 학교 정보
  std_school          VARCHAR(100),
  std_grade           VARCHAR(20),

  -- MAP 점수
  std_map_reading     SMALLINT,
  std_map_math        SMALLINT,
  std_map_language    SMALLINT,
  std_map_note        TEXT,

  -- 수업 정보
  std_teacher         VARCHAR(100),
  std_subject         VARCHAR(100),
  std_curriculum      TEXT,
  std_materials       TEXT,
  std_schedule_json   JSONB,
  std_mobility        VARCHAR(50),

  -- 상담/목표
  std_gpa             VARCHAR(20),
  std_ssat_isee_note  TEXT,
  std_special_note    TEXT,
  std_goals_note      TEXT,
  std_satisfaction_note VARCHAR(200),
  std_last_counsel_date DATE,

  -- 상태/등록
  std_start_date      DATE,
  std_status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (std_status IN ('ACTIVE','INACTIVE','WITHDRAWN')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_std_ent
  ON amb_acm_std_student (ent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_std_ent_status
  ON amb_acm_std_student (ent_id, std_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_std_name_trgm
  ON amb_acm_std_student USING GIN (std_name gin_trgm_ops);
