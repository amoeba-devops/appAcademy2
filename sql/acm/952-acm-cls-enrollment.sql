-- ============================================================================
-- ACM v1.0g — Class Enrollment PG 스키마 (REQ-260622 — model separation)
--
-- Decision (Phase 0 follow-up): the MySQL `tac_enrollments` table — which is
-- the *student × class* enrollment record — does NOT map onto the existing
-- PG `amb_acm_csl_enrollment` (which is a counseling pipeline stage marker
-- per acm-req-csl-001 §4.1 — columns like enr_payment_notice_status,
-- enr_counsel_done, etc).
--
-- Two semantically distinct concepts were folded into one MySQL table
-- historically. PG preserves the separation:
--
--   amb_acm_csl_enrollment   (existing) — CSL pipeline stage
--                                          FK → amb_acm_csl_inquiry
--   amb_acm_cls_enrollment   (this file) — student↔class join with status
--                                          mirror of tac_enrollments
--
-- Pay module references the new `amb_acm_cls_enrollment` (sql/acm/950 updated
-- in the same commit). Phase 3 migrator inserts tac_enrollments rows here,
-- not into amb_acm_csl_enrollment.
--
-- @see docs/analysis/REQ-260622 §2.1 (decision X)
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_cls_enrollment (
  ce_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id              BIGINT       UNIQUE,
  ent_id                 UUID         NOT NULL,
  cls_id                 UUID         NOT NULL,
  std_id                 UUID         NOT NULL,
  ce_applied_prt_id      UUID         NOT NULL,
  ce_status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  ce_applied_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ce_confirmed_at        TIMESTAMPTZ,
  ce_canceled_at         TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_cls_enrollment_status
    CHECK (ce_status IN ('PENDING','CONFIRMED','CANCELED','EXPIRED')),
  CONSTRAINT uq_acm_cls_enrollment_cls_std
    UNIQUE (cls_id, std_id),
  CONSTRAINT fk_acm_cls_enrollment_class
    FOREIGN KEY (cls_id) REFERENCES amb_acm_cls_classes (cls_id),
  CONSTRAINT fk_acm_cls_enrollment_student
    FOREIGN KEY (std_id) REFERENCES amb_acm_std_student (std_id)
);

CREATE INDEX IF NOT EXISTS idx_acm_cls_enrollment_ent_status
  ON amb_acm_cls_enrollment (ent_id, ce_status);
CREATE INDEX IF NOT EXISTS idx_acm_cls_enrollment_std_status
  ON amb_acm_cls_enrollment (std_id, ce_status);
CREATE INDEX IF NOT EXISTS idx_acm_cls_enrollment_cls_status
  ON amb_acm_cls_enrollment (cls_id, ce_status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_acm_cls_enrollment_updated_at ON amb_acm_cls_enrollment;
CREATE TRIGGER trg_acm_cls_enrollment_updated_at
  BEFORE UPDATE ON amb_acm_cls_enrollment
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

-- ----------------------------------------------------------------------------
-- Post-create FK from sql/acm/950 pay_order → this table.
-- Added here (not in 950) because deploy applies SQL files in lexical order,
-- so 950's pay_order table is created before this 952 file.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_name = 'amb_acm_pay_order'
       AND constraint_name = 'fk_acm_pay_order_enrollment'
  ) THEN
    ALTER TABLE amb_acm_pay_order
      ADD CONSTRAINT fk_acm_pay_order_enrollment
      FOREIGN KEY (enrollment_id) REFERENCES amb_acm_cls_enrollment (ce_id);
  END IF;
END $$;
