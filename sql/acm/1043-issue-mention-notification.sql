-- REQ-261016E — 이슈·댓글 멘션 알림(ISSUE_MENTION).
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.
ALTER TABLE amb_acm_notification_outbox DROP CONSTRAINT IF EXISTS amb_acm_notification_outbox_nob_type_check;
ALTER TABLE amb_acm_notification_outbox ADD CONSTRAINT amb_acm_notification_outbox_nob_type_check
  CHECK (nob_type IN ('CSL_CREATED','CSL_STAGE','CAL_CREATED','CAL_UPDATED','CHAT_MENTION','CHAT_MESSAGE','REVIEW_OVERDUE','ISSUE_MENTION'));
