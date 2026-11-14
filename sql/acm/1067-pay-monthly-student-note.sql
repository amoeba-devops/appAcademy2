-- 1067 — REQ-261114: 월별 납부 목록의 학생별·월별 메모 + 그 달 목록 제외(삭제/복구).
-- 월별 납부 목록은 재원 기간으로 계산되므로 행을 지우는 대신 (학생, 월) 표시를 둔다.
-- 제외는 그 달에만 적용되고 다음 달부터는 다시 목록에 나온다. 멱등: CD 가 자동 적용.
CREATE TABLE IF NOT EXISTS amb_acm_pay_month_note (
  pmn_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  std_id           UUID NOT NULL REFERENCES amb_acm_std_student(std_id) ON DELETE CASCADE,
  pmn_month        VARCHAR(7) NOT NULL,
  pmn_is_excluded  BOOLEAN NOT NULL DEFAULT false,
  pmn_memo         VARCHAR(500),
  pmn_excluded_by  UUID,
  pmn_excluded_at  TIMESTAMPTZ,
  pmn_updated_by   UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_acm_pmn_month CHECK (pmn_month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  CONSTRAINT uq_acm_pmn_ent_std_month UNIQUE (ent_id, std_id, pmn_month)
);
CREATE INDEX IF NOT EXISTS idx_acm_pmn_ent_month ON amb_acm_pay_month_note (ent_id, pmn_month);
DROP TRIGGER IF EXISTS trg_acm_pmn_updated_at ON amb_acm_pay_month_note;
CREATE TRIGGER trg_acm_pmn_updated_at BEFORE UPDATE ON amb_acm_pay_month_note
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
COMMENT ON TABLE amb_acm_pay_month_note IS 'REQ-261114 월별 납부 목록 학생별·월별 메모와 그 달 목록 제외';
