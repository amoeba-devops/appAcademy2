-- ============================================================
-- Migration 120 — AMA Entity Code gate (VN3040)
-- Document: REQ-260609 / PLN-260609 (Epic A)
-- Target  : MySQL 8.0+  (db_tac — default datasource)
-- Date    : 2026-06-09
-- ------------------------------------------------------------
-- Goal:
--   tpi-acm 앱은 TPI(entity VN3040) 전용. AMA SSO 교환 시 토큰의
--   entityId(UUID)로 academy 를 조회하고 acd_ama_entity_code 가 허용
--   화이트리스트(env AMA_ALLOWED_ENTITY_CODES, 기본 VN3040)에 포함될
--   때만 로그인을 허용한다 (REQ-260609 FR-A).
--
--   기존엔 entId 를 UUID(acd_ama_tenant_id)로만 다뤘으므로, 사람이
--   읽는 entity code(VN3040)를 academy 행에 함께 저장한다 (FR-A1).
--
-- Idempotency: INFORMATION_SCHEMA 가드 (MySQL 8.0 ADD COLUMN IF NOT
--              EXISTS 미지원). dev/staging 재실행 안전.
-- Rollback   : ALTER TABLE tac_academies DROP COLUMN acd_ama_entity_code;
-- ============================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------
-- 1) acd_ama_entity_code — AMA entity 사람-판독 코드 (예: VN3040)
-- ----------------------------------------------------------------
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_ama_entity_code');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_ama_entity_code VARCHAR(40) DEFAULT NULL
       COMMENT ''AMA entity 코드 (예: VN3040). 로그인 게이트 화이트리스트 대조용''
       AFTER acd_ama_tenant_id',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.1 조회 인덱스
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND INDEX_NAME   = 'idx_tac_academies_ama_entity_code');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tac_academies
     ADD KEY idx_tac_academies_ama_entity_code (acd_ama_entity_code)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 2) 백필 — TPI(Trinity) 데모/시드 테넌트에 VN3040 부여
--    dev/staging 즉시 동작용. 운영에서 실 TPI 행의 코드가 다르면
--    아래 운영 템플릿으로 직접 갱신할 것.
-- ----------------------------------------------------------------
UPDATE tac_academies
   SET acd_ama_entity_code = 'VN3040'
 WHERE acd_ama_entity_code IS NULL
   AND acd_is_demo = 1;

-- 운영 템플릿 (실 TPI entityId 확인 후 수동 실행):
-- UPDATE tac_academies
--    SET acd_ama_entity_code = 'VN3040'
--  WHERE acd_ama_tenant_id = ':TPI_ENTITY_UUID';

-- ============================================================
-- End of migration 120
-- ============================================================
