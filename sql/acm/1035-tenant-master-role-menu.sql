-- REQ-261015C WP2 — 테넌트 마스터 권한 + 등급별 좌측 메뉴 노출.
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.

-- 1) 보조 권한에 TENANT_MASTER 추가 (기존 CONFIG_ADMIN = 서비스 운영자 유지)
ALTER TABLE amb_acm_user_permission
  DROP CONSTRAINT IF EXISTS amb_acm_user_permission_upr_permission_check;
ALTER TABLE amb_acm_user_permission
  ADD CONSTRAINT amb_acm_user_permission_upr_permission_check
  CHECK (upr_permission IN ('CONFIG_ADMIN', 'TENANT_MASTER'));

-- 2) 등급별 메뉴 노출. 행이 없으면 노출(하위 호환). 테넌트 허가(amb_acm_tenant_menu)와 AND.
CREATE TABLE IF NOT EXISTS amb_acm_tenant_role_menu (
  trm_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  trm_role      VARCHAR(20) NOT NULL CHECK (trm_role IN ('ADMIN', 'TEACHER', 'STAFF')),
  trm_menu_key  VARCHAR(40) NOT NULL,
  trm_visible   BOOLEAN NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_trm_ent_role_key UNIQUE (ent_id, trm_role, trm_menu_key)
);
CREATE INDEX IF NOT EXISTS idx_acm_trm_ent ON amb_acm_tenant_role_menu (ent_id);
DROP TRIGGER IF EXISTS trg_acm_trm_updated_at ON amb_acm_tenant_role_menu;
CREATE TRIGGER trg_acm_trm_updated_at BEFORE UPDATE ON amb_acm_tenant_role_menu
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- 3) 최초 테넌트 마스터: admin@tpi.co.kr @ Trinity Academy(code tpi).
--    계정이 없으면 아무 것도 하지 않는다 — 이후 지정은 /system/tenants/:entId 에서.
INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission)
SELECT u.ent_id, u.usr_id, 'TENANT_MASTER'
FROM amb_acm_user u
WHERE u.ent_id = '00000000-0000-0000-0000-000000000001'
  AND lower(u.usr_email) = 'admin@tpi.co.kr'
ON CONFLICT (ent_id, usr_id, upr_permission) DO NOTHING;
