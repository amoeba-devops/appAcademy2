-- ============================================================================
-- ACM v1.0g — Payment 모듈 PG 스키마 (REQ-260622 Phase 1 T1-01)
--
-- Migrates tac_pay_* (MySQL) 6 tables to PostgreSQL amb_acm_pay_*.
-- BIGINT AUTOINC → UUID + legacy_id BIGINT UNIQUE preservation column
-- for the duration of the migration (drop at Phase 7 + 30 days).
--
-- @see docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.1
-- @see docs/plan/PLN-260622-mysql-to-postgres-full-migration.md Phase 1
--
-- Apply order:
--   0. amb_acm_tenant.legacy_acd_id 컬럼 추가 (이 파일 §0).
--   1. 6 결제 테이블 생성.
--   2. set_acm_updated_at trigger 적용.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) tenant.legacy_acd_id 추가 — Phase 3 데이터 이전 시 acd_id → ent_id 조인용
--    Phase 7 + 30일 후 drop 대상.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'amb_acm_tenant' AND column_name = 'legacy_acd_id'
  ) THEN
    ALTER TABLE amb_acm_tenant ADD COLUMN legacy_acd_id BIGINT;
    CREATE UNIQUE INDEX uq_acm_tenant_legacy_acd ON amb_acm_tenant (legacy_acd_id)
      WHERE legacy_acd_id IS NOT NULL;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 1) Refund policies — 환불 정책 (버전 관리, 소급 미적용)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_refund_policy (
  prp_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT       UNIQUE,
  ent_id                       UUID         NOT NULL,
  prp_version                  INTEGER      NOT NULL,
  prp_basis                    VARCHAR(20)  NOT NULL DEFAULT 'SESSION',
  prp_label                    VARCHAR(100) NOT NULL,
  prp_effective_from           DATE         NOT NULL,
  prp_effective_to             DATE,
  prp_is_default_template      BOOLEAN      NOT NULL DEFAULT FALSE,
  prp_created_by               UUID,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_pay_refund_policy_basis
    CHECK (prp_basis IN ('SESSION', 'CALENDAR')),
  CONSTRAINT uq_acm_pay_refund_policy_ent_version
    UNIQUE (ent_id, prp_version)
);

CREATE INDEX IF NOT EXISTS idx_acm_pay_refund_policy_active
  ON amb_acm_pay_refund_policy (ent_id, prp_effective_from, prp_effective_to);


-- ----------------------------------------------------------------------------
-- 2) Refund policy tiers — 환불률 단계 (CHECK + cascade)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_refund_policy_tier (
  prt_id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT        UNIQUE,
  prp_id                       UUID          NOT NULL,
  prt_tier_order               SMALLINT      NOT NULL,
  prt_elapsed_ratio_min        NUMERIC(5,4)  NOT NULL,
  prt_elapsed_ratio_max        NUMERIC(5,4)  NOT NULL,
  prt_refund_rate              NUMERIC(5,4)  NOT NULL,
  prt_note                     VARCHAR(200),
  created_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_acm_pay_refund_policy_tier_policy
    FOREIGN KEY (prp_id) REFERENCES amb_acm_pay_refund_policy (prp_id) ON DELETE CASCADE,
  CONSTRAINT chk_acm_pay_refund_policy_tier_range
    CHECK (prt_elapsed_ratio_min < prt_elapsed_ratio_max),
  CONSTRAINT chk_acm_pay_refund_policy_tier_rate
    CHECK (prt_refund_rate >= 0 AND prt_refund_rate <= 1),
  CONSTRAINT uq_acm_pay_refund_policy_tier_order
    UNIQUE (prp_id, prt_tier_order)
);


-- ----------------------------------------------------------------------------
-- 3) Payment orders — Toss PG 결제 주문 (운영 핵심)
--    pg_payment_key 는 토큰만 저장 (PCI-DSS SAQ-A, NFR-MYSQL-OUT-4).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_order (
  pod_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT       UNIQUE,
  ent_id                       UUID         NOT NULL,
  enrollment_id                UUID         NOT NULL,
  pod_order_no                 VARCHAR(40)  NOT NULL,
  pod_idempotency_key          VARCHAR(64)  NOT NULL,
  pod_amount                   NUMERIC(12,2) NOT NULL,
  pod_currency                 CHAR(3)      NOT NULL DEFAULT 'KRW',
  pod_method                   VARCHAR(20),
  pod_pg_provider              VARCHAR(20)  NOT NULL DEFAULT 'TOSS',
  pod_pg_order_id              VARCHAR(64),
  pod_pg_payment_key           VARCHAR(200),
  pod_status                   VARCHAR(30)  NOT NULL DEFAULT 'READY',
  prp_id                       UUID         NOT NULL,
  pod_expires_at               TIMESTAMPTZ,
  pod_approved_at              TIMESTAMPTZ,
  pod_canceled_at              TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_pay_order_order_no
    UNIQUE (pod_order_no),
  CONSTRAINT uq_acm_pay_order_idempotency
    UNIQUE (pod_idempotency_key),
  -- REQ-260622 model decision X: pay → amb_acm_cls_enrollment (class
  -- enrollment), NOT amb_acm_csl_enrollment (counseling pipeline stage).
  -- The FK constraint is added in sql/acm/952 because that file creates
  -- the referenced table (deploy order is lexical; 950 runs before 952).
  CONSTRAINT fk_acm_pay_order_refund_policy
    FOREIGN KEY (prp_id) REFERENCES amb_acm_pay_refund_policy (prp_id),
  CONSTRAINT chk_acm_pay_order_status
    CHECK (pod_status IN ('READY','IN_PROGRESS','DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED')),
  CONSTRAINT chk_acm_pay_order_method
    CHECK (pod_method IS NULL OR pod_method IN ('CARD','TRANSFER','VACCOUNT','EASY_PAY')),
  CONSTRAINT chk_acm_pay_order_pg_provider
    CHECK (pod_pg_provider IN ('TOSS'))
);

CREATE INDEX IF NOT EXISTS idx_acm_pay_order_enrollment
  ON amb_acm_pay_order (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_acm_pay_order_status
  ON amb_acm_pay_order (ent_id, pod_status);
CREATE INDEX IF NOT EXISTS idx_acm_pay_order_created
  ON amb_acm_pay_order (ent_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- 4) Payment ledger — 입금/환불/조정 이력 (감사)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_ledger (
  ldg_id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT        UNIQUE,
  pod_id                       UUID          NOT NULL,
  ldg_entry_type               VARCHAR(20)   NOT NULL,
  ldg_amount                   NUMERIC(12,2) NOT NULL,
  ldg_balance_after            NUMERIC(12,2) NOT NULL,
  prt_id                       UUID,
  ldg_elapsed_ratio_at_refund  NUMERIC(5,4),
  ldg_memo                     VARCHAR(200),
  ldg_recorded_by              UUID,
  ldg_recorded_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_acm_pay_ledger_order
    FOREIGN KEY (pod_id) REFERENCES amb_acm_pay_order (pod_id),
  CONSTRAINT fk_acm_pay_ledger_refund_tier
    FOREIGN KEY (prt_id) REFERENCES amb_acm_pay_refund_policy_tier (prt_id),
  CONSTRAINT chk_acm_pay_ledger_entry_type
    CHECK (ldg_entry_type IN ('CHARGE','REFUND','ADJUSTMENT'))
);

CREATE INDEX IF NOT EXISTS idx_acm_pay_ledger_order
  ON amb_acm_pay_ledger (pod_id, ldg_recorded_at);


-- ----------------------------------------------------------------------------
-- 5) Receipts — 간이/현금영수증 (세금계산서는 별도 테이블)
--    buyer_identifier BYTEA: 휴대폰/주민번호 AES-GCM 보존 (Phase 3 재암호화 X).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_receipt (
  rct_id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT       UNIQUE,
  pod_id                       UUID         NOT NULL,
  rct_receipt_type             VARCHAR(20)  NOT NULL,
  rct_issued_at                TIMESTAMPTZ  NOT NULL,
  rct_pdf_url                  VARCHAR(500),
  rct_cash_receipt_no          VARCHAR(64),
  rct_buyer_identifier         BYTEA,
  rct_canceled_at              TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_acm_pay_receipt_order
    FOREIGN KEY (pod_id) REFERENCES amb_acm_pay_order (pod_id),
  CONSTRAINT chk_acm_pay_receipt_type
    CHECK (rct_receipt_type IN ('CASH_RECEIPT','SIMPLE'))
);

CREATE INDEX IF NOT EXISTS idx_acm_pay_receipt_order
  ON amb_acm_pay_receipt (pod_id);


-- ----------------------------------------------------------------------------
-- 6) Tax invoices — 세금계산서 (NTS eTax API 연동)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_pay_tax_invoice (
  txi_id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id                    BIGINT        UNIQUE,
  pod_id                       UUID          NOT NULL,
  ent_id                       UUID          NOT NULL,
  txi_invoice_no               VARCHAR(40)   NOT NULL,
  txi_nts_issue_no             VARCHAR(24),
  txi_supplier_biz_no          VARCHAR(13)   NOT NULL,
  txi_buyer_biz_no             VARCHAR(13),
  txi_buyer_type               VARCHAR(20)   NOT NULL,
  txi_supply_amount            NUMERIC(12,2) NOT NULL,
  txi_tax_amount               NUMERIC(12,2) NOT NULL,
  txi_total_amount             NUMERIC(12,2) NOT NULL,
  txi_issue_date               DATE          NOT NULL,
  txi_status                   VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
  txi_nts_submitted_at         TIMESTAMPTZ,
  txi_nts_approved_at          TIMESTAMPTZ,
  txi_nts_error_code           VARCHAR(30),
  txi_nts_error_message        VARCHAR(500),
  txi_xml_payload_url          VARCHAR(500),
  txi_pdf_url                  VARCHAR(500),
  created_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_acm_pay_tax_invoice_order
    FOREIGN KEY (pod_id) REFERENCES amb_acm_pay_order (pod_id),
  CONSTRAINT chk_acm_pay_tax_invoice_status
    CHECK (txi_status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELED')),
  CONSTRAINT chk_acm_pay_tax_invoice_buyer_type
    CHECK (txi_buyer_type IN ('CORP','INDIVIDUAL')),
  CONSTRAINT chk_acm_pay_tax_invoice_totals
    CHECK (txi_total_amount = txi_supply_amount + txi_tax_amount),
  CONSTRAINT uq_acm_pay_tax_invoice_ent_no
    UNIQUE (ent_id, txi_invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_acm_pay_tax_invoice_order
  ON amb_acm_pay_tax_invoice (pod_id);
CREATE INDEX IF NOT EXISTS idx_acm_pay_tax_invoice_status_date
  ON amb_acm_pay_tax_invoice (txi_status, txi_nts_submitted_at);


-- ----------------------------------------------------------------------------
-- 7) updated_at triggers — 기존 set_acm_updated_at() 재사용
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_pay_refund_policy_updated_at      ON amb_acm_pay_refund_policy;
DROP TRIGGER IF EXISTS trg_acm_pay_refund_policy_tier_updated_at ON amb_acm_pay_refund_policy_tier;
DROP TRIGGER IF EXISTS trg_acm_pay_order_updated_at              ON amb_acm_pay_order;
DROP TRIGGER IF EXISTS trg_acm_pay_receipt_updated_at            ON amb_acm_pay_receipt;
DROP TRIGGER IF EXISTS trg_acm_pay_tax_invoice_updated_at        ON amb_acm_pay_tax_invoice;

CREATE TRIGGER trg_acm_pay_refund_policy_updated_at
  BEFORE UPDATE ON amb_acm_pay_refund_policy
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_pay_refund_policy_tier_updated_at
  BEFORE UPDATE ON amb_acm_pay_refund_policy_tier
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_pay_order_updated_at
  BEFORE UPDATE ON amb_acm_pay_order
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_pay_receipt_updated_at
  BEFORE UPDATE ON amb_acm_pay_receipt
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_pay_tax_invoice_updated_at
  BEFORE UPDATE ON amb_acm_pay_tax_invoice
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();


-- ----------------------------------------------------------------------------
-- 8) Smoke (운영자 확인용 — 실행 안 됨)
-- ----------------------------------------------------------------------------
-- SELECT count(*) FROM amb_acm_pay_order;                -- expect 0 (Phase 3 전)
-- SELECT count(*) FROM amb_acm_pay_refund_policy;        -- expect 0
-- \d amb_acm_pay_order
-- \d amb_acm_pay_tax_invoice
