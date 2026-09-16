-- 1015 — CSL-PLN-260916 §9: 맵테스트 신청 접수 알림 설정
-- (1) 알림톡 — 맵테스트 접수 확인용 템플릿 ID (기존 kkc_template_id 는 수업 피드백용이라 분리)
-- (2) 이메일 — 운영자 수신자 목록 (쉼표 구분). 비어 있으면 운영자 메일을 보내지 않는다.
-- Idempotent.

ALTER TABLE amb_acm_kakao_config
  ADD COLUMN IF NOT EXISTS kkc_template_id_map_apply VARCHAR(60);

ALTER TABLE amb_acm_mail_config
  ADD COLUMN IF NOT EXISTS mlc_operator_emails VARCHAR(500);

COMMENT ON COLUMN amb_acm_kakao_config.kkc_template_id_map_apply IS
  'CSL-PLN-260916 맵테스트 접수 확인 알림톡 템플릿 ID. 변수 #{학원명} #{학생명} #{수업명} #{일시}';
COMMENT ON COLUMN amb_acm_mail_config.mlc_operator_emails IS
  'CSL-PLN-260916 운영자 알림 수신 이메일 (쉼표 구분)';
