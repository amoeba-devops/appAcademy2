BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_pay_bill (
 pbl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 std_id UUID NOT NULL, cls_id UUID, pbl_site VARCHAR(20), pbl_month VARCHAR(7) NOT NULL,
 pbl_due DATE NOT NULL, pbl_kind VARCHAR(20) NOT NULL CHECK(pbl_kind IN ('CLASS','BOOK','MATERIAL','TRANSPORT','OTHER')),
 pbl_title VARCHAR(200) NOT NULL, pbl_amount NUMERIC(12,0) NOT NULL CHECK(pbl_amount BETWEEN 0 AND 50000000),
 pbl_discount NUMERIC(12,0) NOT NULL DEFAULT 0 CHECK(pbl_discount>=0 AND pbl_discount<=pbl_amount),
 pbl_memo TEXT NOT NULL DEFAULT '', pbl_version INT NOT NULL DEFAULT 1,
 pbl_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK(pbl_status IN ('ACTIVE','CANCELED')),
 pbl_source_key VARCHAR(250) NOT NULL, created_by UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(ent_id,pbl_id), UNIQUE(ent_id,pbl_source_key)
);
CREATE INDEX IF NOT EXISTS idx_acm_pay_bill_month ON amb_acm_pay_bill(ent_id,pbl_month,pbl_status);
CREATE INDEX IF NOT EXISTS idx_acm_pay_bill_student ON amb_acm_pay_bill(ent_id,std_id);
CREATE TABLE IF NOT EXISTS amb_acm_pay_collection (
 pcl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL, pbl_id UUID NOT NULL,
 pcl_type VARCHAR(20) NOT NULL CHECK(pcl_type IN ('PAYMENT','REFUND','REVERSAL')),
 pcl_amount NUMERIC(12,0) NOT NULL CHECK(pcl_amount>0 AND pcl_amount<=50000000),
 pcl_date DATE NOT NULL, pcl_method VARCHAR(20) NOT NULL CHECK(pcl_method IN ('CASH','TRANSFER','CARD','OTHER')),
 pcl_original_id UUID, pcl_reason TEXT NOT NULL, created_by UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(ent_id,pcl_id), FOREIGN KEY(ent_id,pbl_id) REFERENCES amb_acm_pay_bill(ent_id,pbl_id),
 FOREIGN KEY(ent_id,pcl_original_id) REFERENCES amb_acm_pay_collection(ent_id,pcl_id),
 CHECK((pcl_type='PAYMENT' AND pcl_original_id IS NULL) OR (pcl_type<>'PAYMENT' AND pcl_original_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_acm_pay_collection_bill ON amb_acm_pay_collection(ent_id,pbl_id);
CREATE INDEX IF NOT EXISTS idx_acm_pay_collection_date ON amb_acm_pay_collection(ent_id,pcl_date);
CREATE TABLE IF NOT EXISTS amb_acm_pay_bill_adjustment (
 pba_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL, pbl_id UUID NOT NULL,
 pba_amount NUMERIC(12,0) NOT NULL CHECK(pba_amount<>0), pba_reason TEXT NOT NULL, pcl_id UUID,
 created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,pbl_id) REFERENCES amb_acm_pay_bill(ent_id,pbl_id),
 FOREIGN KEY(ent_id,pcl_id) REFERENCES amb_acm_pay_collection(ent_id,pcl_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_pay_bill_adjustment_bill ON amb_acm_pay_bill_adjustment(ent_id,pbl_id);
CREATE TABLE IF NOT EXISTS amb_acm_pay_bill_audit (
 pbu_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL, pbl_id UUID NOT NULL,
 pbu_action VARCHAR(30) NOT NULL, pbu_before JSONB, pbu_after JSONB NOT NULL, pbu_reason TEXT NOT NULL,
 created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(ent_id,pbl_id) REFERENCES amb_acm_pay_bill(ent_id,pbl_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_pay_bill_audit_bill ON amb_acm_pay_bill_audit(ent_id,pbl_id,created_at);
CREATE TABLE IF NOT EXISTS amb_acm_pay_request (
 ent_id UUID NOT NULL, req_id UUID NOT NULL, req_hash TEXT NOT NULL, req_result JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(ent_id,req_id)
);
COMMIT;
