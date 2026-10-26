-- REQ-261026B — 사용자 메뉴: 위치(북마크 그룹 / 업무관리 그룹 끝) + 열기 방식(링크 / 화면 안 iframe).
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.
ALTER TABLE amb_acm_tenant_custom_menu
  ADD COLUMN IF NOT EXISTS tcm_group     VARCHAR(20) NOT NULL DEFAULT 'BOOKMARKS',
  ADD COLUMN IF NOT EXISTS tcm_open_mode VARCHAR(20) NOT NULL DEFAULT 'LINK';

ALTER TABLE amb_acm_tenant_custom_menu DROP CONSTRAINT IF EXISTS chk_acm_tcm_group;
ALTER TABLE amb_acm_tenant_custom_menu
  ADD CONSTRAINT chk_acm_tcm_group CHECK (tcm_group IN ('BOOKMARKS', 'WORK'));

ALTER TABLE amb_acm_tenant_custom_menu DROP CONSTRAINT IF EXISTS chk_acm_tcm_open_mode;
ALTER TABLE amb_acm_tenant_custom_menu
  ADD CONSTRAINT chk_acm_tcm_open_mode CHECK (tcm_open_mode IN ('LINK', 'EMBED'));

-- 화면 안에 열기(iframe)는 https 주소만.
ALTER TABLE amb_acm_tenant_custom_menu DROP CONSTRAINT IF EXISTS chk_acm_tcm_embed_https;
ALTER TABLE amb_acm_tenant_custom_menu
  ADD CONSTRAINT chk_acm_tcm_embed_https CHECK (tcm_open_mode <> 'EMBED' OR tcm_url ~ '^https://');
