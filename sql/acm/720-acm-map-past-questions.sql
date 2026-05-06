-- ============================================================================
-- ACM MAP v1.0 — MAP Past Questions (기출문제관리)
-- @see docs/analysis/REQ-260506-acm-map-past-questions.md
-- @see docs/plan/PLN-260506-acm-map-past-questions.md
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Passages (mpg_*)
-- A "primary" passage (mpg_ordinal = 1) carries the question; a "secondary"
-- passage (mpg_ordinal = 2) is the paired sibling sharing mpg_pair_group_id.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_passage (
  mpg_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,

  mpg_grade           VARCHAR(8)   NOT NULL,
  mpg_domain          VARCHAR(20)  NOT NULL DEFAULT 'RC',
  mpg_body            TEXT         NOT NULL,
  mpg_glossary        TEXT,
  mpg_pair_group_id   UUID,
  mpg_ordinal         SMALLINT     NOT NULL DEFAULT 1
                      CHECK (mpg_ordinal IN (1, 2)),

  mpg_source          VARCHAR(40)  NOT NULL DEFAULT 'MAP_RC_G2-4_PAST',
  mpg_version         INT          NOT NULL DEFAULT 1,
  mpg_status          VARCHAR(16)  NOT NULL DEFAULT 'PUBLISHED'
                      CHECK (mpg_status IN ('PUBLISHED','DRAFT','ARCHIVED')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acm_mpg_ent_grade
  ON amb_acm_map_passage (ent_id, mpg_grade, mpg_status);

CREATE INDEX IF NOT EXISTS idx_acm_mpg_pair
  ON amb_acm_map_passage (mpg_pair_group_id)
  WHERE mpg_pair_group_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Questions (mpq_*)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_map_question (
  mpq_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  mpg_id              UUID         NOT NULL REFERENCES amb_acm_map_passage(mpg_id),

  mpq_grade           VARCHAR(8)   NOT NULL,
  mpq_domain          VARCHAR(20)  NOT NULL DEFAULT 'RC',
  mpq_external_no     INT          NOT NULL,

  mpq_question        TEXT         NOT NULL,
  mpq_choices         JSONB        NOT NULL,
  mpq_answer_index    SMALLINT     CHECK (mpq_answer_index BETWEEN 0 AND 3),
  mpq_explanation     TEXT,

  mpq_difficulty      VARCHAR(16)  NOT NULL DEFAULT 'INTERMEDIATE'
                      CHECK (mpq_difficulty IN ('BASIC','INTERMEDIATE','ADVANCED')),

  mpq_source          VARCHAR(40)  NOT NULL DEFAULT 'MAP_RC_G2-4_PAST',
  mpq_version         INT          NOT NULL DEFAULT 1,
  mpq_status          VARCHAR(16)  NOT NULL DEFAULT 'PUBLISHED'
                      CHECK (mpq_status IN ('PUBLISHED','DRAFT','ARCHIVED')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acm_mpq_ent_grade
  ON amb_acm_map_question (ent_id, mpq_grade, mpq_status);

CREATE INDEX IF NOT EXISTS idx_acm_mpq_mpg
  ON amb_acm_map_question (mpg_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_acm_mpq_upsert'
  ) THEN
    ALTER TABLE amb_acm_map_question
      ADD CONSTRAINT uq_acm_mpq_upsert
        UNIQUE (ent_id, mpq_grade, mpq_external_no, mpq_source);
  END IF;
END $$;
