-- ============================================================================
-- ACM v1.0a — QNA i18n labels (Follow-up cycle 2026-05-02)
-- @see docs/analysis/ACM-SCH-QNA-P1-FOLLOWUP-REQ-1.0.0.md (FR-P2-05)
-- Adds: amb_acm_qna_category.qct_label_zh column (Simplified Chinese)
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_qna_category
  ADD COLUMN IF NOT EXISTS qct_label_zh VARCHAR(100);
