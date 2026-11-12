-- 1065 — REQ-261112K: 사용자 초대 소프트삭제
-- 삭제된 초대는 목록에서 숨기고 재발송·취소·수락 대상에서 뺀다. 대기 중이면 REVOKED 로 함께 바꾼다. Idempotent.

ALTER TABLE amb_acm_user_invite
  ADD COLUMN IF NOT EXISTS inv_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inv_deleted_by UUID;

COMMENT ON COLUMN amb_acm_user_invite.inv_deleted_at IS 'REQ-261112K 소프트삭제 시각 (목록 제외)';
COMMENT ON COLUMN amb_acm_user_invite.inv_deleted_by IS 'REQ-261112K 삭제 처리자 usr_id';
