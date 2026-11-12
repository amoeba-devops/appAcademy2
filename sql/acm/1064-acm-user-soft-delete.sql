-- 1064 — REQ-261112J: 콘솔 사용자 소프트삭제
-- usr_status='DELETED' + 삭제 시각/처리자. 삭제된 계정의 이메일로 새 계정을 만들 수 있도록
-- (ent_id, usr_email) 유일성은 삭제되지 않은 계정끼리만 적용한다. Idempotent.

ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usr_deleted_by UUID;

ALTER TABLE amb_acm_user DROP CONSTRAINT IF EXISTS uq_acm_user_ent_email;
DROP INDEX IF EXISTS uq_acm_user_ent_email;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_user_ent_email
  ON amb_acm_user (ent_id, usr_email) WHERE usr_deleted_at IS NULL;

COMMENT ON COLUMN amb_acm_user.usr_deleted_at IS
  'REQ-261112J 소프트삭제 시각 (usr_status=DELETED). 이메일 유일성 대상에서 제외';
COMMENT ON COLUMN amb_acm_user.usr_deleted_by IS 'REQ-261112J 삭제 처리자 usr_id';
