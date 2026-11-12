-- 1063 — REQ-261112I: 메일 발송 기본 숨은참조(BCC)
-- 시스템이 보내는 메일(초대·임시 비밀번호 제외)에 사본을 BCC 로 붙일 주소 목록 (쉼표 구분).
-- 비어 있으면 붙이지 않는다. Idempotent.

ALTER TABLE amb_acm_mail_config
  ADD COLUMN IF NOT EXISTS mlc_default_bcc VARCHAR(500);

COMMENT ON COLUMN amb_acm_mail_config.mlc_default_bcc IS
  'REQ-261112I 메일 기본 숨은참조(BCC) 주소 (쉼표 구분). 초대·임시 비밀번호 메일 제외';
