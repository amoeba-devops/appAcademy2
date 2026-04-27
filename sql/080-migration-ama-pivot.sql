-- ============================================================
-- Migration 080 — AMA App Store Pivot
-- Document: AMA-APP-STORE-PIVOT-TASK-1.0.0
-- Target  : MySQL 8.0+
-- Date    : 2026-04-27
-- ------------------------------------------------------------
-- Goal:
--   1) 멀티테넌트 SaaS 전환을 위한 tac_academies 확장
--      (AMA tenant 매핑, 구독 상태/플랜, slug, demo flag)
--   2) tac_users 확장 (AMA SSO 사용자 매핑, 초대/수락 추적,
--      멀티테넌트 멤버십을 위해 acd_id NULL 허용)
--   3) 1인 ↔ 다(多) 학원 멤버십을 위한 신규 테이블
--      tac_user_academies
--   4) AMA 구독 lifecycle webhook 이벤트 ledger
--      tac_subscription_events
--
-- Naming convention:
--   - colPrefix per CLAUDE.md §5
--   - 신규 테이블 prefix: 본 문서 §2 정의
--     · tac_user_academies      → colPrefix uam
--     · tac_subscription_events → colPrefix sub
--
-- Idempotency:
--   - 모든 ALTER 는 IF NOT EXISTS 패턴으로 작성
--     (MySQL 8.0+ 기본 IF NOT EXISTS 미지원 → INFORMATION_SCHEMA 가드)
--   - dev/staging 재실행 안전
--
-- Rollback:
--   - 신규 컬럼은 NULL 허용 → 컬럼 drop 으로 단순 revert 가능
--   - 신규 테이블은 DROP TABLE 로 revert
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------
-- 1) tac_academies — AMA tenant 매핑 + 구독 상태 + slug + demo
-- ----------------------------------------------------------------

-- 1.1 acd_ama_tenant_id (AMA 측 tenant 식별자)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_ama_tenant_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_ama_tenant_id VARCHAR(64) DEFAULT NULL
       COMMENT ''AMA 플랫폼 tenant 식별자 (앱스토어 구독 단위)''
       AFTER acd_business_registration_no',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 unique key on acd_ama_tenant_id
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND INDEX_NAME   = 'uq_tac_academies_ama_tenant');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tac_academies
     ADD UNIQUE KEY uq_tac_academies_ama_tenant (acd_ama_tenant_id)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.3 acd_slug (URL-safe 식별자)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_slug');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_slug VARCHAR(60) DEFAULT NULL
       COMMENT ''URL slug — admin 화면 표시·딥링크용''
       AFTER acd_ama_tenant_id',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND INDEX_NAME   = 'uq_tac_academies_slug');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tac_academies
     ADD UNIQUE KEY uq_tac_academies_slug (acd_slug)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.4 acd_subscription_status
--     PROVISIONING / ACTIVE / SUSPENDED / CANCELED / DEPROVISIONED
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_subscription_status');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_subscription_status VARCHAR(30) NOT NULL DEFAULT ''ACTIVE''
       COMMENT ''PROVISIONING/ACTIVE/SUSPENDED/CANCELED/DEPROVISIONED''
       AFTER acd_status',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.5 acd_subscription_plan (자유 문자열 — AMA가 명세 확정 시 enum 화)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_subscription_plan');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_subscription_plan VARCHAR(60) DEFAULT NULL
       COMMENT ''AMA 구독 플랜 코드 (예: STANDARD/PREMIUM)''
       AFTER acd_subscription_status',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.6 acd_provisioned_at / acd_canceled_at / acd_deprovisioned_at
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_provisioned_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_provisioned_at DATETIME DEFAULT NULL
       COMMENT ''최초 provisioning 완료 시각''
       AFTER acd_subscription_plan',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_canceled_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_canceled_at DATETIME DEFAULT NULL
       COMMENT ''구독 취소 시각 (CANCELED 진입)''
       AFTER acd_provisioned_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_deprovisioned_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_deprovisioned_at DATETIME DEFAULT NULL
       COMMENT ''90일 grace 경과 후 데이터 삭제 완료 시각''
       AFTER acd_canceled_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.7 acd_is_demo (Trinity 데모 테넌트 표시)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND COLUMN_NAME  = 'acd_is_demo');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_academies
     ADD COLUMN acd_is_demo TINYINT(1) NOT NULL DEFAULT 0
       COMMENT ''데모/시드 테넌트 표시 (write 차단 가능)''
       AFTER acd_deprovisioned_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.8 인덱스: subscription_status 조회용
SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_academies'
                      AND INDEX_NAME   = 'idx_tac_academies_sub_status');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tac_academies
     ADD KEY idx_tac_academies_sub_status (acd_subscription_status)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 2) tac_users — AMA SSO 매핑 + 멀티테넌트 멤버십 대비
-- ----------------------------------------------------------------

-- 2.1 usr_ama_user_id (AMA 사용자 식별자)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_users'
                      AND COLUMN_NAME  = 'usr_ama_user_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_users
     ADD COLUMN usr_ama_user_id VARCHAR(64) DEFAULT NULL
       COMMENT ''AMA SSO sub claim — 단일 진실 원천''
       AFTER usr_email',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_users'
                      AND INDEX_NAME   = 'uq_tac_users_ama_user');
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE tac_users
     ADD UNIQUE KEY uq_tac_users_ama_user (usr_ama_user_id)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.2 usr_password 를 nullable 로 (SSO 사용자는 비밀번호 없음)
--     break-glass SUPERADMIN 만 password 보유.
ALTER TABLE tac_users MODIFY COLUMN usr_password VARCHAR(200) DEFAULT NULL
  COMMENT 'SSO 사용자 NULL, break-glass SUPERADMIN 만 보유';

-- 2.3 acd_id NULL 허용 (멤버십을 별도 테이블로 이관)
--     기존 행은 default tenant 로 유지. 신규 SSO 사용자는 멤버십 부여 전 NULL.
ALTER TABLE tac_users MODIFY COLUMN acd_id BIGINT UNSIGNED DEFAULT NULL
  COMMENT '기본/마지막 활성 테넌트. 실제 권한은 tac_user_academies 참조';

-- 2.4 usr_active_acd_id (현재 active tenant — 다중 멤버십 지원)
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_users'
                      AND COLUMN_NAME  = 'usr_active_acd_id');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_users
     ADD COLUMN usr_active_acd_id BIGINT UNSIGNED DEFAULT NULL
       COMMENT ''현재 활성 테넌트 — 헤더 X-Active-Tenant 의 source''
       AFTER acd_id',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2.5 usr_invited_at / usr_accepted_at
SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_users'
                      AND COLUMN_NAME  = 'usr_invited_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_users
     ADD COLUMN usr_invited_at DATETIME DEFAULT NULL
       COMMENT ''직원 초대 발송 시각''
       AFTER usr_last_login_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'tac_users'
                      AND COLUMN_NAME  = 'usr_accepted_at');
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE tac_users
     ADD COLUMN usr_accepted_at DATETIME DEFAULT NULL
       COMMENT ''AMA SSO 첫 로그인 시각 (초대 수락)''
       AFTER usr_invited_at',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ----------------------------------------------------------------
-- 3) tac_user_academies — 멀티테넌트 멤버십 (M:N)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tac_user_academies (
    uam_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    usr_id          BIGINT UNSIGNED NOT NULL,
    acd_id          BIGINT UNSIGNED NOT NULL,
    uam_role        VARCHAR(20)     NOT NULL DEFAULT 'STAFF'
        COMMENT 'OWNER/ADMIN/STAFF/READONLY',
    uam_status      VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE'
        COMMENT 'INVITED/ACTIVE/SUSPENDED/REMOVED',
    uam_invited_at  DATETIME                 DEFAULT NULL,
    uam_accepted_at DATETIME                 DEFAULT NULL,
    uam_revoked_at  DATETIME                 DEFAULT NULL,
    uam_created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uam_updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (uam_id),
    UNIQUE KEY uq_tac_user_academies (usr_id, acd_id),
    KEY idx_tac_user_academies_acd_status (acd_id, uam_status),
    KEY idx_tac_user_academies_usr_status (usr_id, uam_status),
    CONSTRAINT fk_tac_user_academies_user
        FOREIGN KEY (usr_id) REFERENCES tac_users(usr_id),
    CONSTRAINT fk_tac_user_academies_academy
        FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='User ↔ Academy 멤버십 (1인 다(多) 학원 지원)';

-- 3.1 데이터 마이그레이션 — 기존 tac_users.acd_id → tac_user_academies
INSERT IGNORE INTO tac_user_academies
       (usr_id, acd_id, uam_role, uam_status, uam_accepted_at, uam_created_at)
SELECT u.usr_id,
       u.acd_id,
       CASE WHEN u.usr_role IN ('SUPERADMIN','ADMIN') THEN 'ADMIN'
            ELSE u.usr_role END,
       'ACTIVE',
       COALESCE(u.usr_last_login_at, u.usr_created_at),
       u.usr_created_at
FROM   tac_users u
WHERE  u.acd_id IS NOT NULL;

-- 3.2 usr_active_acd_id 백필 — 기존 acd_id 그대로 활성으로 표시
UPDATE tac_users
   SET usr_active_acd_id = acd_id
 WHERE usr_active_acd_id IS NULL
   AND acd_id IS NOT NULL;

-- ----------------------------------------------------------------
-- 4) tac_subscription_events — AMA webhook ledger
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tac_subscription_events (
    sub_id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id              BIGINT UNSIGNED          DEFAULT NULL
        COMMENT 'provisioning 이전 이벤트는 NULL 가능',
    sub_ama_tenant_id   VARCHAR(64)     NOT NULL,
    sub_event_type      VARCHAR(40)     NOT NULL
        COMMENT 'SUBSCRIPTION_CREATED/ACTIVATED/SUSPENDED/RESUMED/CANCELED/PLAN_CHANGED',
    sub_plan            VARCHAR(60)              DEFAULT NULL,
    sub_nonce           VARCHAR(64)     NOT NULL
        COMMENT 'X-AMA-Nonce — 멱등성 보장',
    sub_signature       VARCHAR(128)    NOT NULL
        COMMENT 'X-AMA-Signature (HMAC-SHA256)',
    sub_event_at        DATETIME        NOT NULL
        COMMENT 'AMA 측 이벤트 발생 시각',
    sub_payload         JSON            NOT NULL,
    sub_processed_at    DATETIME                 DEFAULT NULL
        COMMENT '본 앱 처리 완료 시각',
    sub_processing_error TEXT                    DEFAULT NULL,
    sub_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sub_id),
    UNIQUE KEY uq_tac_subscription_events_nonce (sub_nonce),
    KEY idx_tac_subscription_events_acd       (acd_id),
    KEY idx_tac_subscription_events_ama_tenant(sub_ama_tenant_id),
    KEY idx_tac_subscription_events_type_at   (sub_event_type, sub_event_at),
    CONSTRAINT fk_tac_subscription_events_academy
        FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='AMA 구독 lifecycle webhook ledger (멱등 + 감사용)';

-- ============================================================
-- End of migration 080
-- ============================================================
