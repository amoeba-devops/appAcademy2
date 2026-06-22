-- ============================================================================
-- ACM v1.0g — CSL 보조 + 학생 외부 점수 PG 스키마 (REQ-260622 Phase 1 T1-06)
--
-- Migrates 3 MySQL tables:
--   tac_visit_records             → amb_acm_csl_visit_record
--   tac_consultation_intake_form  → amb_acm_csl_intake_form (orphan — schema 보존)
--   tac_external_test_scores      → amb_acm_std_external_test_score (orphan — 보존)
--
-- @see docs/design/SPEC-260622-tac-to-pg-schema-map.md §2.6
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Visit records — 상담 후속 방문 / 통화 이력
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_csl_visit_record (
  vsr_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           BIGINT       UNIQUE,
  ent_id              UUID         NOT NULL,
  inq_id              UUID         NOT NULL REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  vsr_scheduled_at    TIMESTAMPTZ,
  vsr_visited_at      TIMESTAMPTZ,
  vsr_outcome         VARCHAR(20),
  vsr_handler_user_id UUID,
  vsr_memo            TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_csl_visit_record_outcome
    CHECK (vsr_outcome IS NULL OR vsr_outcome IN ('SCHEDULED','VISITED','CANCELED','NO_SHOW'))
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_visit_record_inq
  ON amb_acm_csl_visit_record (inq_id, vsr_scheduled_at DESC);


-- ----------------------------------------------------------------------------
-- 2) Intake form — 포털 공개 상담 신청 폼 (CAPTCHA + 개인정보 수집)
--    orphan 이지만 향후 부활 대비 schema 보존.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_csl_intake_form (
  cif_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           BIGINT       UNIQUE,
  ent_id              UUID         NOT NULL,
  cif_parent_name     VARCHAR(100) NOT NULL,
  cif_phone           VARCHAR(30)  NOT NULL,
  cif_email           VARCHAR(200),
  cif_child_grade     VARCHAR(20),
  cif_program_interest VARCHAR(100),
  cif_preferred_date  DATE,
  cif_message         TEXT,
  cif_is_consent_pi   BOOLEAN      NOT NULL DEFAULT FALSE,
  cif_captcha_score   NUMERIC(3,2),
  cif_ip              VARCHAR(45),
  cif_user_agent      VARCHAR(500),
  cif_status          VARCHAR(20)  NOT NULL DEFAULT 'NEW',
  cif_promoted_inq_id UUID         REFERENCES amb_acm_csl_inquiry(inq_id),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_csl_intake_form_status
    CHECK (cif_status IN ('NEW','PROMOTED','SPAM','DUPLICATE'))
);
CREATE INDEX IF NOT EXISTS idx_acm_csl_intake_form_ent_status
  ON amb_acm_csl_intake_form (ent_id, cif_status, created_at DESC);


-- ----------------------------------------------------------------------------
-- 3) External test scores — 학생 외부 평가 점수 (SSAT/ISEE/GPA 등)
--    orphan 이지만 schema 보존.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_std_external_test_score (
  ets_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id         BIGINT       UNIQUE,
  std_id            UUID         NOT NULL,
  ets_test_type     VARCHAR(20)  NOT NULL,
  ets_test_date     DATE         NOT NULL,
  ets_score         VARCHAR(50),
  ets_score_detail  JSONB,
  ets_note          TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_std_external_test_score_std
  ON amb_acm_std_external_test_score (std_id, ets_test_date DESC);


-- ----------------------------------------------------------------------------
-- 4) updated_at triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_acm_csl_visit_record_updated_at         ON amb_acm_csl_visit_record;
DROP TRIGGER IF EXISTS trg_acm_std_external_test_score_updated_at  ON amb_acm_std_external_test_score;

CREATE TRIGGER trg_acm_csl_visit_record_updated_at
  BEFORE UPDATE ON amb_acm_csl_visit_record
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_std_external_test_score_updated_at
  BEFORE UPDATE ON amb_acm_std_external_test_score
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
