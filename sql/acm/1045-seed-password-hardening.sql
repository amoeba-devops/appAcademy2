-- ============================================================================
-- REQ-261017B — 공개 시드 비밀번호 하드닝
-- 500(admin@tpi.co.kr)·511(admin@amoeba.group) 시드 비밀번호는 저장소에 공개돼 있다.
-- 아직 그 비밀번호를 쓰는 계정은 다음 로그인 때 반드시 바꾸게 한다.
-- 운영 모드(NODE_ENV=production)에서는 백엔드가 이 비밀번호 로그인 자체를 막고,
-- ACM_INITIAL_ADMIN_PASSWORD 가 있으면 기동 시 그 값으로 바꾼다(AcmSeedPasswordService).
-- 이미 비밀번호를 바꾼 기존 환경에는 영향 없음. 멱등.
-- ============================================================================
UPDATE amb_acm_user
   SET usr_must_change_password = true, updated_at = now()
 WHERE usr_password_hash IN (
         '$2b$12$6szKyUcXX6Zgt9/o3M/k9OUz01iCbqr6Y7VMMj6SKPGiDBrTfZ0Ka', -- 500 seed
         '$2b$12$7YJIg0yE8S04xPIrcLMZ8ujuSJNXctXuoOnjw83bKrUZcJPTVjbVa'  -- 511 seed
       )
   AND usr_must_change_password IS DISTINCT FROM true;
