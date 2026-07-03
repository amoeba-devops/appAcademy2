-- ============================================================================
-- ACM v1.0g — PII Audit Log PG 스키마 (REQ-260622 Phase 1 T1-04)
--
-- Defines PostgreSQL PII access audit log.
-- Q-2 결정: 최근 N일 (default 90일) 만 이전. 그 외는 S3 cold archive.
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.4
-- 대용량 시계열 — BRIN 인덱스로 시점 검색 효율 + 매일 04:00 cron 으로 90일+
-- 자동 archive (Phase 2 T2-04 cron 구현 시 S3 export 후 DELETE).
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_audit_log (
  adl_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         BIGINT       UNIQUE,
  ent_id            UUID         NOT NULL,
  adl_user_id       UUID,
  adl_action        VARCHAR(50)  NOT NULL,
  adl_entity_type   VARCHAR(50)  NOT NULL,
  adl_entity_id     VARCHAR(64)  NOT NULL,
  adl_field_name    VARCHAR(100),
  adl_old_value     TEXT,
  adl_new_value     TEXT,
  adl_ip            VARCHAR(45),
  adl_user_agent    VARCHAR(500),
  adl_reason        VARCHAR(200),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_audit_log_action
    CHECK (adl_action IN ('CREATE','READ','UPDATE','DELETE','DECRYPT','LOGIN','LOGOUT','EXPORT'))
);

-- BRIN — 시계열 압축 효율적. NFR-MYSQL-OUT-6 회귀 방지.
CREATE INDEX IF NOT EXISTS brin_acm_audit_log_created
  ON amb_acm_audit_log USING BRIN (created_at);
-- B-tree — 사용자별 최근 행위 조회 (admin audit panel).
CREATE INDEX IF NOT EXISTS idx_acm_audit_log_user_created
  ON amb_acm_audit_log (ent_id, adl_user_id, created_at DESC)
  WHERE adl_user_id IS NOT NULL;
-- 엔티티별 추적 (`STUDENT/{id}` 등 PII 접근 이력).
CREATE INDEX IF NOT EXISTS idx_acm_audit_log_entity
  ON amb_acm_audit_log (ent_id, adl_entity_type, adl_entity_id, created_at DESC);
-- PII 복호화 추적 (FN-039 — sensitive ops).
CREATE INDEX IF NOT EXISTS idx_acm_audit_log_decrypt
  ON amb_acm_audit_log (ent_id, created_at DESC)
  WHERE adl_action = 'DECRYPT';

-- 본 테이블은 append-only — updated_at trigger 불요.
