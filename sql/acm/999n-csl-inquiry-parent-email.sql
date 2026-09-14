-- ============================================================================
-- 999n — CSL inquiry parent email (encrypted)
-- 요구 260914E — 외부 상담접수 폼에서 연락처를 전화번호/이메일로 분리하면서
-- 이메일을 정식 수집·저장한다.
--
-- 전화번호·학부모명과 동일하게 AES-GCM 3-필드 구성 (ADR-005 / NFR-005).
-- 기존 행과 이메일을 받지 않는 경로(관리자 직접 등록 등)를 위해 NULL 허용.
-- Idempotent.
-- ============================================================================

ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_parent_email_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_email_iv        BYTEA,
  ADD COLUMN IF NOT EXISTS inq_parent_email_auth_tag  BYTEA;

COMMENT ON COLUMN amb_acm_csl_inquiry.inq_parent_email_encrypted
  IS 'AES-GCM ciphertext of parent email (요구 260914E)';
