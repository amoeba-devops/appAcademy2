-- ============================================================================
-- ACM v1.0g — MAP 평가 모듈 PG 스키마 확장 (REQ-260622 Phase 1 T1-02)
--
-- Migrates tac_map_* (MySQL, 8 tables) to PG amb_acm_map_*.
-- 기존 amb_acm_map_passage / amb_acm_map_question 와 별개로 평가 흐름 (item bank,
-- test set, assignment, response, score) 을 추가.
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.2
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Passage assets — passage 에 첨부된 이미지/오디오 (S3 key 보존)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_passage_asset (
  mpa_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       BIGINT       UNIQUE,
  mpg_id          UUID         NOT NULL REFERENCES amb_acm_map_passage(mpg_id) ON DELETE CASCADE,
  mpa_asset_url   VARCHAR(500) NOT NULL,
  mpa_alt_text    VARCHAR(200),
  mpa_ordinal     INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_map_passage_asset_passage
  ON amb_acm_map_passage_asset (mpg_id, mpa_ordinal);


-- ----------------------------------------------------------------------------
-- 2) Items — 문항 (단일/멀티/Part A-B 부모-자식, JSONB options/answer_keys)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_item (
  mpi_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id          BIGINT       UNIQUE,
  ent_id             UUID,
  mpg_id             UUID         REFERENCES amb_acm_map_passage(mpg_id),
  mpi_parent_mpi_id  UUID         REFERENCES amb_acm_map_item(mpi_id),
  mpi_domain         VARCHAR(20)  NOT NULL,
  mpi_grade_level    VARCHAR(10)  NOT NULL,
  mpi_difficulty     VARCHAR(20)  NOT NULL,
  mpi_item_type      VARCHAR(20)  NOT NULL,
  mpi_stem           TEXT         NOT NULL,
  mpi_options        JSONB        NOT NULL,
  mpi_answer_keys    JSONB        NOT NULL,
  mpi_explanation    TEXT,
  mpi_points         INTEGER      NOT NULL DEFAULT 1,
  mpi_version        INTEGER      NOT NULL DEFAULT 1,
  mpi_status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_map_item_domain
    CHECK (mpi_domain IN ('RC','MATH','LANGUAGE')),
  CONSTRAINT chk_acm_map_item_difficulty
    CHECK (mpi_difficulty IN ('BASIC','INTERMEDIATE','ADVANCED')),
  CONSTRAINT chk_acm_map_item_type
    CHECK (mpi_item_type IN ('SINGLE','MULTI','PART_AB')),
  CONSTRAINT chk_acm_map_item_status
    CHECK (mpi_status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_acm_map_item_taxonomy
  ON amb_acm_map_item (mpi_domain, mpi_grade_level, mpi_difficulty, mpi_status);
CREATE INDEX IF NOT EXISTS idx_acm_map_item_passage
  ON amb_acm_map_item (mpg_id);
CREATE INDEX IF NOT EXISTS idx_acm_map_item_parent
  ON amb_acm_map_item (mpi_parent_mpi_id);


-- ----------------------------------------------------------------------------
-- 3) Item tags — 태그 (composite PK)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_item_tag (
  mpi_id     UUID         NOT NULL REFERENCES amb_acm_map_item(mpi_id) ON DELETE CASCADE,
  mit_tag    VARCHAR(50)  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (mpi_id, mit_tag)
);
CREATE INDEX IF NOT EXISTS idx_acm_map_item_tag_tag
  ON amb_acm_map_item_tag (mit_tag);


-- ----------------------------------------------------------------------------
-- 4) Test sets — 시험지 (수동 / 자동 구성 — JSONB filter_criteria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_test_set (
  mts_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id               BIGINT       UNIQUE,
  ent_id                  UUID         NOT NULL,
  mts_name                VARCHAR(100) NOT NULL,
  mts_composition_mode    VARCHAR(20)  NOT NULL DEFAULT 'FIXED',
  mts_filter_criteria     JSONB,
  mts_total_points        INTEGER      NOT NULL DEFAULT 0,
  mts_status              VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  mts_created_by          UUID,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_map_test_set_mode
    CHECK (mts_composition_mode IN ('FIXED','AUTO')),
  CONSTRAINT chk_acm_map_test_set_status
    CHECK (mts_status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE INDEX IF NOT EXISTS idx_acm_map_test_set_ent
  ON amb_acm_map_test_set (ent_id, mts_status);


-- ----------------------------------------------------------------------------
-- 5) Test set items — 시험지 내 문항 (item snapshot JSONB 보존)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_test_set_item (
  mtsi_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                     BIGINT       UNIQUE,
  mts_id                        UUID         NOT NULL REFERENCES amb_acm_map_test_set(mts_id) ON DELETE CASCADE,
  mpi_id                        UUID         NOT NULL REFERENCES amb_acm_map_item(mpi_id),
  mtsi_ordinal                  INTEGER      NOT NULL,
  mtsi_item_version_snapshot    JSONB        NOT NULL,
  created_at                    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_map_test_set_item_ordinal
    UNIQUE (mts_id, mtsi_ordinal)
);
CREATE INDEX IF NOT EXISTS idx_acm_map_test_set_item_item
  ON amb_acm_map_test_set_item (mpi_id);


-- ----------------------------------------------------------------------------
-- 6) Assignments — 시험지 배정 (대상 = 클래스 / 학생)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_assignment (
  mas_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id        BIGINT       UNIQUE,
  mts_id           UUID         NOT NULL REFERENCES amb_acm_map_test_set(mts_id),
  mas_target_type  VARCHAR(20)  NOT NULL,
  mas_target_id    UUID         NOT NULL,
  mas_due_at       TIMESTAMPTZ  NOT NULL,
  mas_status       VARCHAR(20)  NOT NULL DEFAULT 'ASSIGNED',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_map_assignment_target_type
    CHECK (mas_target_type IN ('CLASS','STUDENT')),
  CONSTRAINT chk_acm_map_assignment_status
    CHECK (mas_status IN ('ASSIGNED','IN_PROGRESS','SUBMITTED','GRADED','CANCELED'))
);
CREATE INDEX IF NOT EXISTS idx_acm_map_assignment_target
  ON amb_acm_map_assignment (mas_target_type, mas_target_id, mas_status);
CREATE INDEX IF NOT EXISTS idx_acm_map_assignment_due
  ON amb_acm_map_assignment (mas_due_at);


-- ----------------------------------------------------------------------------
-- 7) Responses — 학생 응답 (UNIQUE per assignment / student / item)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_response (
  mrs_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id          BIGINT       UNIQUE,
  mas_id             UUID         NOT NULL REFERENCES amb_acm_map_assignment(mas_id),
  std_id             UUID         NOT NULL,
  mpi_id             UUID         NOT NULL REFERENCES amb_acm_map_item(mpi_id),
  mrs_answer         JSONB        NOT NULL,
  mrs_is_correct     BOOLEAN      NOT NULL,
  mrs_points_earned  INTEGER      NOT NULL DEFAULT 0,
  mrs_submitted_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_map_response_asn_std_itm
    UNIQUE (mas_id, std_id, mpi_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_map_response_std
  ON amb_acm_map_response (std_id, mrs_submitted_at DESC);


-- ----------------------------------------------------------------------------
-- 8) Scores — 외부 MAP 점수 (Imported / System / Manual)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_score (
  mms_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           BIGINT       UNIQUE,
  std_id              UUID         NOT NULL,
  mms_assessed_at     DATE         NOT NULL,
  mms_reading_score   INTEGER,
  mms_math_score      INTEGER,
  mms_language_score  INTEGER,
  mms_source          VARCHAR(20)  NOT NULL DEFAULT 'SYSTEM',
  mas_id              UUID         REFERENCES amb_acm_map_assignment(mas_id),
  mms_note            TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_map_score_source
    CHECK (mms_source IN ('SYSTEM','IMPORT','MANUAL'))
);
CREATE INDEX IF NOT EXISTS idx_acm_map_score_std_date
  ON amb_acm_map_score (std_id, mms_assessed_at DESC);


-- ----------------------------------------------------------------------------
-- 9) updated_at triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_map_passage_asset_updated_at ON amb_acm_map_passage_asset;
DROP TRIGGER IF EXISTS trg_acm_map_item_updated_at          ON amb_acm_map_item;
DROP TRIGGER IF EXISTS trg_acm_map_test_set_updated_at      ON amb_acm_map_test_set;
DROP TRIGGER IF EXISTS trg_acm_map_assignment_updated_at    ON amb_acm_map_assignment;

CREATE TRIGGER trg_acm_map_passage_asset_updated_at
  BEFORE UPDATE ON amb_acm_map_passage_asset
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_map_item_updated_at
  BEFORE UPDATE ON amb_acm_map_item
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_map_test_set_updated_at
  BEFORE UPDATE ON amb_acm_map_test_set
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_map_assignment_updated_at
  BEFORE UPDATE ON amb_acm_map_assignment
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
