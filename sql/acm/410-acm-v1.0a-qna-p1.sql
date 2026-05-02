-- ============================================================================
-- ACM v1.0a — QNA P1 Migration
-- @see docs/analysis/acm-fn-sch-qna-p1-requirements.md
-- @see docs/implementation/tasks/acm-fn-sch-qna-p1-plan.md (T-Q-01)
-- Adds: amb_acm_qna_category table,
--       thread_parent_id / category_id / use_count columns on amb_acm_qna_question.
-- Idempotent (uses IF NOT EXISTS / DO blocks).
-- ============================================================================

-- 1. Categories (Q-30..Q-34)
CREATE TABLE IF NOT EXISTS amb_acm_qna_category (
  qct_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id        UUID NOT NULL,
  qct_code      VARCHAR(50)  NOT NULL,
  qct_label_kr  VARCHAR(100) NOT NULL,
  qct_label_en  VARCHAR(100),
  qct_label_vi  VARCHAR(100),
  qct_is_active BOOLEAN      NOT NULL DEFAULT TRUE,
  qct_sort_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT uq_acm_qna_category_ent_code UNIQUE (ent_id, qct_code)
);
CREATE INDEX IF NOT EXISTS idx_acm_qna_category_ent_active
  ON amb_acm_qna_category (ent_id, qct_is_active) WHERE deleted_at IS NULL;

-- 2. Question table additive columns
ALTER TABLE amb_acm_qna_question
  ADD COLUMN IF NOT EXISTS thread_parent_id UUID REFERENCES amb_acm_qna_question(qna_id) ON DELETE SET NULL;
ALTER TABLE amb_acm_qna_question
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES amb_acm_qna_category(qct_id) ON DELETE SET NULL;
ALTER TABLE amb_acm_qna_question
  ADD COLUMN IF NOT EXISTS use_count INT NOT NULL DEFAULT 0;
ALTER TABLE amb_acm_qna_question
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE amb_acm_qna_question
  ADD COLUMN IF NOT EXISTS escalated_by UUID;

CREATE INDEX IF NOT EXISTS idx_acm_qna_question_thread_parent
  ON amb_acm_qna_question (thread_parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_qna_question_category
  ON amb_acm_qna_question (ent_id, category_id) WHERE deleted_at IS NULL;
