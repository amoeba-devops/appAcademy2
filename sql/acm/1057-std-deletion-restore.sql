-- ============================================================================
-- REQ-261104 — 비활성화 학생 다시 활성화: 삭제 이력 처리유형에 RESTORE 추가. 멱등.
-- ============================================================================
ALTER TABLE amb_acm_std_deletion_history
  DROP CONSTRAINT IF EXISTS amb_acm_std_deletion_history_sdh_action_check;
ALTER TABLE amb_acm_std_deletion_history
  ADD CONSTRAINT amb_acm_std_deletion_history_sdh_action_check
  CHECK (sdh_action IN ('ARCHIVE','RESTORE','PURGE'));
