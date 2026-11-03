-- ============================================================================
-- REQ-261102B — 알림 설정: 학원(테넌트) 설정 1행 + 개인 설정(콘솔 사용자·포털 강사) 1행씩.
-- 행이 없거나 키가 없으면 기본값(= 기존 동작). 기기 푸시: 기기 종류·발송 결과 기록. 멱등.
-- ============================================================================
CREATE TABLE IF NOT EXISTS amb_acm_notification_setting (
  nst_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id      UUID NOT NULL,
  nst_config  JSONB NOT NULL DEFAULT '{}',
  nst_updated_by UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_nst_ent UNIQUE (ent_id)
);
COMMENT ON TABLE amb_acm_notification_setting IS 'REQ-261102B 학원 알림 설정(상황별 경로·받는 역할, 기기 푸시 공통, 피드백 알림 시간)';

CREATE TABLE IF NOT EXISTS amb_acm_notification_pref (
  npf_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  npf_kind         VARCHAR(10) NOT NULL CHECK (npf_kind IN ('USER','TEACHER')),
  npf_recipient_id UUID NOT NULL,
  npf_config       JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_npf_recipient UNIQUE (ent_id, npf_kind, npf_recipient_id)
);
COMMENT ON TABLE amb_acm_notification_pref IS 'REQ-261102B 개인 알림 설정(상황별 끄기·개인 방해 금지 시간)';

ALTER TABLE amb_acm_push_subscription ADD COLUMN IF NOT EXISTS psu_device VARCHAR(10);
ALTER TABLE amb_acm_push_subscription DROP CONSTRAINT IF EXISTS chk_acm_psu_device;
ALTER TABLE amb_acm_push_subscription ADD CONSTRAINT chk_acm_psu_device
  CHECK (psu_device IS NULL OR psu_device IN ('MOBILE','DESKTOP'));

ALTER TABLE amb_acm_push_delivery ADD COLUMN IF NOT EXISTS pdl_result VARCHAR(10);
ALTER TABLE amb_acm_push_delivery DROP CONSTRAINT IF EXISTS chk_acm_pdl_result;
ALTER TABLE amb_acm_push_delivery ADD CONSTRAINT chk_acm_pdl_result
  CHECK (pdl_result IS NULL OR pdl_result IN ('SENT','FAILED','SKIPPED'));
CREATE INDEX IF NOT EXISTS idx_acm_push_delivery_done ON amb_acm_push_delivery(ent_id, pdl_done_at) WHERE pdl_done_at IS NOT NULL;
