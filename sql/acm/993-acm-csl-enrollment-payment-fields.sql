-- REQ-260704 — CSL enrollment payment metadata
-- Adds operator-entered payment date/method/amount/memo to the existing
-- 1:1 enrollment row. Additive only; no legacy column drops.

ALTER TABLE amb_acm_csl_enrollment
  ADD COLUMN IF NOT EXISTS enr_payment_date date,
  ADD COLUMN IF NOT EXISTS enr_payment_method varchar(20),
  ADD COLUMN IF NOT EXISTS enr_payment_amount numeric(12,0),
  ADD COLUMN IF NOT EXISTS enr_payment_memo text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_acm_csl_enr_payment_method'
  ) THEN
    ALTER TABLE amb_acm_csl_enrollment
      ADD CONSTRAINT chk_acm_csl_enr_payment_method
      CHECK (
        enr_payment_method IS NULL
        OR enr_payment_method IN ('BANK_TRANSFER', 'CARD', 'OTHER')
      );
  END IF;
END $$;
