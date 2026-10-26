-- ============================================================================
-- PLN-261027 — 서비스 설정 > 로그인 유지 시간: PC·브라우저 "로그인 유지" 체크 시 토큰 유지 시간(1~48시간).
-- NULL = 기본(4시간). 모바일(설치한 앱·휴대폰 브라우저)은 이 값과 무관하게 계속 로그인(자동 연장). 멱등.
-- ============================================================================
ALTER TABLE amb_acm_tenant ADD COLUMN IF NOT EXISTS tnt_session_hours SMALLINT;
ALTER TABLE amb_acm_tenant ADD COLUMN IF NOT EXISTS tnt_session_updated_at TIMESTAMPTZ;
ALTER TABLE amb_acm_tenant ADD COLUMN IF NOT EXISTS tnt_session_updated_by UUID;
ALTER TABLE amb_acm_tenant DROP CONSTRAINT IF EXISTS chk_acm_tenant_session_hours;
ALTER TABLE amb_acm_tenant ADD CONSTRAINT chk_acm_tenant_session_hours
  CHECK (tnt_session_hours IS NULL OR tnt_session_hours BETWEEN 1 AND 48);
