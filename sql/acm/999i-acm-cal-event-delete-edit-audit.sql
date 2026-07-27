-- REQ-260728 — 수업일정 삭제 사유 + 수정 히스토리.
--
-- 1) 이벤트에 삭제 사유/삭제자 컬럼(soft-delete 는 기존 deleted_at 재사용).
-- 2) 수정 히스토리 테이블(append-only) — 수정마다 1행(수정자·사유·변경요약).
--
-- @see docs/plan/PLN-260728-acm-cal-event-delete-edit-audit.md

-- 1) 삭제 사유/삭제자
ALTER TABLE amb_acm_cal_event
  ADD COLUMN IF NOT EXISTS evt_delete_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS evt_deleted_by UUID;

-- 2) 수정 히스토리 (append-only)
CREATE TABLE IF NOT EXISTS amb_acm_cal_event_revision (
  rev_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id             UUID NOT NULL,
  evt_id             UUID NOT NULL,
  rev_editor_user_id UUID,
  rev_reason         VARCHAR(500),
  rev_changes        JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_rev_evt
  ON amb_acm_cal_event_revision (evt_id, created_at DESC);
