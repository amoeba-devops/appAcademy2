-- ============================================================================
-- ACM — AMA TPI role mapping + parent→client sync  — 2026-06-09
-- @see docs/analysis/REQ-260609-ama-tpi-sso-client-sync.md  (Epic B, Epic C)
-- @see docs/plan/PLN-260609-ama-tpi-sso-client-sync.md
--
-- Epic B: amb_acm_user.usr_ama_job_role — AMA 직무 필드(예: TEACHER) 보관.
--         로그인마다 USER_LEVEL + 직무로 usr_role 재평가 (감사/디버깅용).
-- Epic C: amb_acm_std_parent — AMA 고객사 등록 결과 (멱등키 + 등록 시각).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Target: ACM PostgreSQL.
-- ============================================================================

-- Epic B — AMA 직무(강사/직원 판정 근거) 보관
ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS usr_ama_job_role VARCHAR(40) NULL;

-- Epic C — 학부모 → AMA 고객사 등록 추적
ALTER TABLE amb_acm_std_parent
  ADD COLUMN IF NOT EXISTS par_ama_client_id     VARCHAR(40) NULL,
  ADD COLUMN IF NOT EXISTS par_ama_registered_at TIMESTAMPTZ NULL;

-- 멱등 보강: 한 학부모는 최대 1개의 AMA client 에 매핑.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_std_parent_ama_client
  ON amb_acm_std_parent (par_ama_client_id)
  WHERE par_ama_client_id IS NOT NULL;
