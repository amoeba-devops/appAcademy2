-- REQ-260929: additive, tenant-scoped lifecycle evidence. No inferred backfill.
BEGIN;
CREATE TABLE IF NOT EXISTS amb_acm_dsh_lifecycle_event (
 lce_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ent_id UUID NOT NULL,
 subject_kind VARCHAR(10) NOT NULL CHECK(subject_kind IN ('STUDENT','INQUIRY')),
 subject_id UUID NOT NULL, kind VARCHAR(20) NOT NULL CHECK(kind IN ('SCHEDULE','RETURN','REFERRAL','FIRST_PAYMENT','FIRST_CLASS','PAYMENT_ENDED')),
 effective_date DATE NOT NULL, site VARCHAR(20) NOT NULL CHECK(site IN ('TPI','TRINITY','SANTACROCE','COMMON')),
 payload JSONB NOT NULL, actor_id UUID NOT NULL,
 cancelled_at TIMESTAMPTZ, cancelled_by UUID,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acm_lifecycle_subject ON amb_acm_dsh_lifecycle_event(ent_id,subject_kind,subject_id,kind,effective_date);
CREATE INDEX IF NOT EXISTS idx_acm_lifecycle_date ON amb_acm_dsh_lifecycle_event(ent_id,effective_date) WHERE cancelled_at IS NULL;
COMMIT;
