-- ============================================================================
-- REQ-261021B P2 (PLN-261022) — 활동 로그: amb_acm_audit_log 확장.
-- 행위자·메뉴·대상 표시명 스냅숏·결과·요청 정보. append-only 트리거(1049)는 유지. 멱등.
-- ============================================================================
ALTER TABLE amb_acm_audit_log
  ADD COLUMN IF NOT EXISTS adl_actor_kind   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS adl_actor_name   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS adl_actor_role   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS adl_menu         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS adl_target_label VARCHAR(200),
  ADD COLUMN IF NOT EXISTS adl_result       VARCHAR(10),
  ADD COLUMN IF NOT EXISTS adl_http_method  VARCHAR(10),
  ADD COLUMN IF NOT EXISTS adl_http_path    VARCHAR(300),
  ADD COLUMN IF NOT EXISTS adl_http_status  SMALLINT,
  ADD COLUMN IF NOT EXISTS adl_request_id   VARCHAR(40);
-- 변경 항목 이름 목록(값은 기록하지 않음)
ALTER TABLE amb_acm_audit_log ALTER COLUMN adl_field_name TYPE VARCHAR(500);

ALTER TABLE amb_acm_audit_log DROP CONSTRAINT IF EXISTS chk_acm_audit_log_action;
ALTER TABLE amb_acm_audit_log ADD CONSTRAINT chk_acm_audit_log_action
  CHECK (adl_action IN ('CREATE','READ','UPDATE','DELETE','DECRYPT','LOGIN','LOGOUT','EXPORT','DOWNLOAD'));
ALTER TABLE amb_acm_audit_log DROP CONSTRAINT IF EXISTS chk_acm_audit_log_actor_kind;
ALTER TABLE amb_acm_audit_log ADD CONSTRAINT chk_acm_audit_log_actor_kind
  CHECK (adl_actor_kind IS NULL OR adl_actor_kind IN ('CONSOLE','PORTAL','SYSTEM'));
ALTER TABLE amb_acm_audit_log DROP CONSTRAINT IF EXISTS chk_acm_audit_log_result;
ALTER TABLE amb_acm_audit_log ADD CONSTRAINT chk_acm_audit_log_result
  CHECK (adl_result IS NULL OR adl_result IN ('SUCCESS','FAILURE','DENIED'));

CREATE INDEX IF NOT EXISTS idx_acm_audit_log_ent_created ON amb_acm_audit_log (ent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_audit_log_ent_menu ON amb_acm_audit_log (ent_id, adl_menu, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_audit_log_ent_action ON amb_acm_audit_log (ent_id, adl_action, created_at DESC);
