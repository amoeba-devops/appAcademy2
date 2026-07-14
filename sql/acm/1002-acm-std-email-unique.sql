-- 1002-acm-std-email-unique.sql
-- PLN-260714 — 학생 이메일 테넌트 내 중복 불가.
--   소프트삭제 제외 + 대소문자 무시 부분 유니크 인덱스. idempotent.
--   ⚠️ 기존 데이터에 (ent_id, lower(std_email)) 중복이 있으면 인덱스 생성이
--      실패한다. 실패 시 아래 조회로 중복을 먼저 정리한 뒤 재실행할 것:
--   SELECT ent_id, LOWER(std_email) e, COUNT(*)
--     FROM amb_acm_std_student
--    WHERE std_email IS NOT NULL AND deleted_at IS NULL
--    GROUP BY ent_id, LOWER(std_email) HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_std_ent_email
  ON amb_acm_std_student (ent_id, LOWER(std_email))
  WHERE std_email IS NOT NULL AND deleted_at IS NULL;
