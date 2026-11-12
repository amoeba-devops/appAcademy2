-- 1066 — REQ-261112L: 포털 로그인 계정 소프트삭제
-- 삭제 시 pac_status='INACTIVE' 로 로그인 차단, 목록·학생 상세에서 제외. 관리자가 다시 발급하면
-- 같은 행(같은 로그인ID)을 되살린다(uq_acm_pac_ref 유지). Idempotent.

ALTER TABLE amb_acm_portal_account
  ADD COLUMN IF NOT EXISTS pac_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pac_deleted_by UUID;

COMMENT ON COLUMN amb_acm_portal_account.pac_deleted_at IS 'REQ-261112L 소프트삭제 시각 (재발급 시 NULL 로 복구)';
COMMENT ON COLUMN amb_acm_portal_account.pac_deleted_by IS 'REQ-261112L 삭제 처리자 usr_id';
