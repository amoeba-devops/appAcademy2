-- REQ-261015C WP5 — 사용자 타임존. NULL = 테넌트 기본 타임존(amb_acm_tenant.tnt_timezone) 따름.
ALTER TABLE amb_acm_portal_account ADD COLUMN IF NOT EXISTS pac_timezone VARCHAR(64);
ALTER TABLE amb_acm_user ADD COLUMN IF NOT EXISTS usr_timezone VARCHAR(64);
