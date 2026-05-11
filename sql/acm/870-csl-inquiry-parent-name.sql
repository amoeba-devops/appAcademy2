-- ============================================================================
-- 870 — CSL inquiry parent name (encrypted)
-- REQ-260511-student-parent-link FR-CSL-PAR-01..05, NFR-02
-- AES-GCM 3-field columns, NULL allowed for backward compat.
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_parent_name_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_name_iv        BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_name_auth_tag  BYTEA;

COMMENT ON COLUMN amb_acm_csl_inquiry.inq_parent_name_encrypted
  IS 'AES-GCM ciphertext of parent name (ADR-005, REQ-260511)';
