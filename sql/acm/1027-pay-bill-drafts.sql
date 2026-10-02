BEGIN;
ALTER TABLE amb_acm_pay_bill ALTER COLUMN pbl_amount DROP NOT NULL;
ALTER TABLE amb_acm_pay_bill ALTER COLUMN pbl_due DROP NOT NULL;
ALTER TABLE amb_acm_pay_bill DROP CONSTRAINT IF EXISTS amb_acm_pay_bill_pbl_status_check;
ALTER TABLE amb_acm_pay_bill ADD CONSTRAINT amb_acm_pay_bill_pbl_status_check CHECK(pbl_status IN ('DRAFT','ACTIVE','CANCELED'));
ALTER TABLE amb_acm_pay_bill DROP CONSTRAINT IF EXISTS chk_acm_bill_draft_amount;
ALTER TABLE amb_acm_pay_bill ADD CONSTRAINT chk_acm_bill_draft_amount CHECK(
 (pbl_status='ACTIVE' AND pbl_amount IS NOT NULL AND pbl_due IS NOT NULL) OR
 (pbl_status='DRAFT' AND pbl_amount IS NULL AND pbl_due IS NULL AND pbl_discount=0) OR
 (pbl_status='CANCELED' AND ((pbl_amount IS NULL AND pbl_due IS NULL AND pbl_discount=0) OR (pbl_amount IS NOT NULL AND pbl_due IS NOT NULL)))
);
CREATE INDEX IF NOT EXISTS idx_acm_pay_bill_student_month ON amb_acm_pay_bill(ent_id,std_id,pbl_month,pbl_kind);
COMMIT;
