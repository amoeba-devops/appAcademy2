-- PLN-260728E — 테넌트 admin 메뉴 순서(order) 저장.
-- amb_acm_tenant_menu 는 기존에 hidden override(visible=false)만 저장했으나,
-- 순서 커스터마이즈를 위해 tnm_order(SMALLINT, nullable) 추가.
-- 기본 순서(ALL_MENU_KEYS 인덱스)와 다른 키만 행으로 유지.
--
-- @see docs/plan/PLN-260728E-menu-order-i18n-post-layout.md

ALTER TABLE amb_acm_tenant_menu
  ADD COLUMN IF NOT EXISTS tnm_order SMALLINT;
