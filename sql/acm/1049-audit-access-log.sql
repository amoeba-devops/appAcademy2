-- ============================================================================
-- REQ-261021B P1 — 사이트 감사: 접속 로그 · DB 기반 로그인 실패 잠금 · 접속 통제 정책 · AUDIT_VIEWER 권한.
-- 멱등.
-- ============================================================================

-- 접속 로그 (append-only)
CREATE TABLE IF NOT EXISTS amb_acm_aud_access_log (
  aal_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,
  aal_actor_kind    VARCHAR(10)  NOT NULL CHECK (aal_actor_kind IN ('CONSOLE','PORTAL')),
  aal_actor_id      UUID,
  aal_actor_name    VARCHAR(100),
  aal_actor_role    VARCHAR(20),
  aal_login_id      VARCHAR(200),
  aal_event         VARCHAR(30)  NOT NULL CHECK (aal_event IN
                      ('LOGIN','LOGOUT','LOCKED','UNLOCKED','IP_BLOCKED',
                       'PASSWORD_CHANGED','TEMP_PASSWORD_ISSUED','SSO_EXCHANGE')),
  aal_result        VARCHAR(10)  NOT NULL CHECK (aal_result IN ('SUCCESS','FAILURE')),
  aal_reason        VARCHAR(40),
  aal_method        VARCHAR(10)  CHECK (aal_method IS NULL OR aal_method IN ('PASSWORD','SSO','OTP')),
  aal_ip            VARCHAR(45),
  aal_client        VARCHAR(10),
  aal_user_agent    VARCHAR(500),
  aal_by_user_id    UUID,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS brin_acm_aal_created ON amb_acm_aud_access_log USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_acm_aal_ent_created ON amb_acm_aud_access_log (ent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_aal_ent_actor ON amb_acm_aud_access_log (ent_id, aal_actor_kind, aal_actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_aal_ent_ip ON amb_acm_aud_access_log (ent_id, aal_ip, created_at DESC);

-- 감사 기록은 수정·삭제 불가 (FR-P-2)
CREATE OR REPLACE FUNCTION acm_aud_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit records are append-only (%)', TG_TABLE_NAME;
END $$;
DROP TRIGGER IF EXISTS trg_acm_aal_append_only ON amb_acm_aud_access_log;
CREATE TRIGGER trg_acm_aal_append_only BEFORE UPDATE OR DELETE ON amb_acm_aud_access_log
  FOR EACH ROW EXECUTE FUNCTION acm_aud_append_only();

-- 로그인 실패 누적 (계정 키 · IP 키)
CREATE TABLE IF NOT EXISTS amb_acm_aud_login_failure (
  alf_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,
  alf_key           VARCHAR(250) NOT NULL,
  alf_actor_kind    VARCHAR(10)  CHECK (alf_actor_kind IS NULL OR alf_actor_kind IN ('CONSOLE','PORTAL')),
  alf_actor_id      UUID,
  alf_login_id      VARCHAR(200),
  alf_count         INT          NOT NULL DEFAULT 0,
  alf_first_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  alf_last_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  alf_locked_until  TIMESTAMPTZ,
  CONSTRAINT uq_acm_alf_key UNIQUE (alf_key)
);
CREATE INDEX IF NOT EXISTS idx_acm_alf_ent_locked ON amb_acm_aud_login_failure (ent_id, alf_locked_until)
  WHERE alf_locked_until IS NOT NULL;

-- 접속 통제 정책 (테넌트당 1행, 없으면 기본값)
CREATE TABLE IF NOT EXISTS amb_acm_aud_policy (
  ent_id                 UUID        PRIMARY KEY,
  apl_fail_max           INT         NOT NULL DEFAULT 5  CHECK (apl_fail_max BETWEEN 3 AND 20),
  apl_lock_minutes       INT         NOT NULL DEFAULT 5  CHECK (apl_lock_minutes BETWEEN 0 AND 1440),
  apl_ip_fail_max        INT         NOT NULL DEFAULT 20 CHECK (apl_ip_fail_max BETWEEN 5 AND 200),
  apl_ip_window_minutes  INT         NOT NULL DEFAULT 10 CHECK (apl_ip_window_minutes BETWEEN 1 AND 1440),
  apl_ip_block_minutes   INT         NOT NULL DEFAULT 10 CHECK (apl_ip_block_minutes BETWEEN 1 AND 1440),
  apl_settings           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_acm_apl_updated_at ON amb_acm_aud_policy;
CREATE TRIGGER trg_acm_apl_updated_at BEFORE UPDATE ON amb_acm_aud_policy
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 감사 조회 권한
ALTER TABLE amb_acm_user_permission
  DROP CONSTRAINT IF EXISTS amb_acm_user_permission_upr_permission_check;
ALTER TABLE amb_acm_user_permission
  ADD CONSTRAINT amb_acm_user_permission_upr_permission_check
  CHECK (upr_permission IN ('CONFIG_ADMIN', 'TENANT_MASTER', 'AUDIT_VIEWER'));

-- 활동 로그 기존 테이블도 수정·삭제 불가
DROP TRIGGER IF EXISTS trg_acm_adl_append_only ON amb_acm_audit_log;
CREATE TRIGGER trg_acm_adl_append_only BEFORE UPDATE OR DELETE ON amb_acm_audit_log
  FOR EACH ROW EXECUTE FUNCTION acm_aud_append_only();
