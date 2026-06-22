-- ============================================================================
-- ACM v1.0g — Posts / Programs / Classrooms PG 스키마 (REQ-260622 Phase 1 T1-05)
--
-- Migrates 4 MySQL tables:
--   tac_posts            → amb_acm_post
--   tac_programs         → amb_acm_program
--   tac_program_settings → amb_acm_program_setting
--   tac_classrooms       → amb_acm_classroom
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.5
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Posts — 학원 게시판 (notice / event / result)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_post (
  pst_id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id             BIGINT       UNIQUE,
  ent_id                UUID         NOT NULL,
  pst_slug              VARCHAR(200) NOT NULL,
  pst_title             VARCHAR(200) NOT NULL,
  pst_body_md           TEXT         NOT NULL,
  pst_cover_image_url   VARCHAR(500),
  pst_author_user_id    UUID,
  pst_published_at      TIMESTAMPTZ,
  pst_status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  pst_category          VARCHAR(30)  NOT NULL DEFAULT 'NOTICE',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_post_status
    CHECK (pst_status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  CONSTRAINT chk_acm_post_category
    CHECK (pst_category IN ('NOTICE','EVENT','RESULT')),
  CONSTRAINT uq_acm_post_ent_slug
    UNIQUE (ent_id, pst_slug)
);
CREATE INDEX IF NOT EXISTS idx_acm_post_published
  ON amb_acm_post (ent_id, pst_status, pst_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_post_ent_cat_pub
  ON amb_acm_post (ent_id, pst_category, pst_status, pst_published_at DESC);


-- ----------------------------------------------------------------------------
-- 2) Programs — 프로그램 카탈로그
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_program (
  prg_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           BIGINT       UNIQUE,
  ent_id              UUID         NOT NULL,
  prg_name            VARCHAR(100) NOT NULL,
  prg_category        VARCHAR(30)  NOT NULL,
  prg_description     TEXT,
  prg_duration_weeks  INTEGER,
  prg_target_age_min  INTEGER,
  prg_target_age_max  INTEGER,
  prg_level           VARCHAR(20),
  prg_status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_program_status
    CHECK (prg_status IN ('DRAFT','ACTIVE','ARCHIVED')),
  CONSTRAINT uq_acm_program_ent_name
    UNIQUE (ent_id, prg_name)
);
CREATE INDEX IF NOT EXISTS idx_acm_program_ent_status
  ON amb_acm_program (ent_id, prg_status);


-- ----------------------------------------------------------------------------
-- 3) Program settings — 수강료 / 정원 / 환불정책 JSON
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_program_setting (
  pgs_id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id          BIGINT        UNIQUE,
  prg_id             UUID          NOT NULL UNIQUE REFERENCES amb_acm_program(prg_id) ON DELETE CASCADE,
  pgs_fee_amount     NUMERIC(12,2),
  pgs_fee_currency   CHAR(3)       NOT NULL DEFAULT 'KRW',
  pgs_capacity_max   INTEGER,
  pgs_session_count  INTEGER,
  pgs_material_info  JSONB,
  pgs_refund_policy  JSONB,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 4) Classrooms — 물리 교실 마스터
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_classroom (
  clr_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id     BIGINT       UNIQUE,
  ent_id        UUID         NOT NULL,
  clr_name      VARCHAR(50)  NOT NULL,
  clr_capacity  INTEGER,
  clr_status    VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_classroom_status
    CHECK (clr_status IN ('ACTIVE','INACTIVE')),
  CONSTRAINT uq_acm_classroom_ent_name
    UNIQUE (ent_id, clr_name)
);


-- ----------------------------------------------------------------------------
-- 5) updated_at triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_post_updated_at             ON amb_acm_post;
DROP TRIGGER IF EXISTS trg_acm_program_updated_at          ON amb_acm_program;
DROP TRIGGER IF EXISTS trg_acm_program_setting_updated_at  ON amb_acm_program_setting;
DROP TRIGGER IF EXISTS trg_acm_classroom_updated_at        ON amb_acm_classroom;

CREATE TRIGGER trg_acm_post_updated_at
  BEFORE UPDATE ON amb_acm_post
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_program_updated_at
  BEFORE UPDATE ON amb_acm_program
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_program_setting_updated_at
  BEFORE UPDATE ON amb_acm_program_setting
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_classroom_updated_at
  BEFORE UPDATE ON amb_acm_classroom
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
