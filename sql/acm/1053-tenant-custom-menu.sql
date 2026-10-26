-- REQ-261026 — 테넌트 사용자 메뉴(북마크): 테넌트 마스터가 좌측 메뉴에 메뉴명 + 링크를 추가한다.
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.
CREATE TABLE IF NOT EXISTS amb_acm_tenant_custom_menu (
  tcm_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id       UUID NOT NULL,
  tcm_name     VARCHAR(30)  NOT NULL,
  tcm_url      VARCHAR(500) NOT NULL,
  tcm_new_tab  BOOLEAN NOT NULL DEFAULT false,
  tcm_roles    VARCHAR(20)[] NOT NULL DEFAULT ARRAY['ADMIN', 'TEACHER', 'STAFF']::VARCHAR(20)[],
  tcm_order    SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 내부 경로(/…, // 제외) 또는 http(s) 만 — javascript: 등 차단.
  CONSTRAINT chk_acm_tcm_url CHECK (tcm_url ~ '^(/($|[^/])|https?://)'),
  CONSTRAINT chk_acm_tcm_roles CHECK (tcm_roles <@ ARRAY['ADMIN', 'TEACHER', 'STAFF']::VARCHAR(20)[])
);
CREATE INDEX IF NOT EXISTS idx_acm_tcm_ent_order ON amb_acm_tenant_custom_menu (ent_id, tcm_order);
DROP TRIGGER IF EXISTS trg_acm_tcm_updated_at ON amb_acm_tenant_custom_menu;
CREATE TRIGGER trg_acm_tcm_updated_at BEFORE UPDATE ON amb_acm_tenant_custom_menu
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
