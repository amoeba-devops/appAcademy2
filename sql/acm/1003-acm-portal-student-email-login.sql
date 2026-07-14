-- 1003-acm-portal-student-email-login.sql
-- PLN-260714 (D-2) — 포털 로그인ID = 학생 이메일.
--   1) pac_login_id 컬럼을 VARCHAR(40) → VARCHAR(200) 로 확장(이메일 수용).
--   2) 기존 STUDENT 포털계정 로그인ID를 연결 학생 이메일(소문자)로 백필.
--      · 이메일이 있는 학생 계정만 대상(이메일 없는 계정은 기존 랜덤ID 유지).
--      · 테넌트 내 로그인ID 충돌이 없는 행만 갱신(uq_acm_pac_login 보호).
--   idempotent — 이미 이메일로 바뀐 행은 조건에서 제외된다.

-- 1) 컬럼 확장
ALTER TABLE amb_acm_portal_account
  ALTER COLUMN pac_login_id TYPE VARCHAR(200);

-- 2) 기존 STUDENT 계정 로그인ID 백필
UPDATE amb_acm_portal_account pa
SET pac_login_id = LOWER(s.std_email),
    updated_at = NOW()
FROM amb_acm_std_student s
WHERE pa.pac_kind = 'STUDENT'
  AND pa.pac_ref_id = s.std_id
  AND pa.ent_id = s.ent_id
  AND s.std_email IS NOT NULL
  AND s.deleted_at IS NULL
  AND LOWER(pa.pac_login_id) <> LOWER(s.std_email)
  AND NOT EXISTS (
    SELECT 1
    FROM amb_acm_portal_account x
    WHERE x.ent_id = pa.ent_id
      AND LOWER(x.pac_login_id) = LOWER(s.std_email)
      AND x.pac_id <> pa.pac_id
  );
