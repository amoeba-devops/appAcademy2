-- ============================================================================
-- ACM CAL v1.0 — Class Schedule Calendar (수업일정 캘린더)
-- @see docs/analysis/REQ-260506-acm-tch-stf-cal.md
-- Note: amb_acm_cal_invitee (초대자) is intentionally NOT created in v1.
--       Will be added in a separate v2 migration.
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_cal_event (
  evt_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,

  -- 작성자/owner (TEACHER 본인 또는 ADMIN)
  evt_owner_user_id   UUID         NOT NULL,

  -- 카테고리
  evt_category        VARCHAR(20)  NOT NULL DEFAULT 'CLASS'
                      CHECK (evt_category IN ('CLASS', 'MEETING', 'EVENT', 'PERSONAL')),

  -- 제목/설명
  evt_title           VARCHAR(200) NOT NULL,
  evt_description     TEXT,

  -- 일시
  evt_start_at        TIMESTAMPTZ  NOT NULL,
  evt_end_at          TIMESTAMPTZ  NOT NULL,
  evt_all_day         BOOLEAN      NOT NULL DEFAULT FALSE,

  -- 장소
  evt_location_text   VARCHAR(200),

  -- 화상미팅 (수동 URL 입력)
  evt_meeting_provider VARCHAR(20) NOT NULL DEFAULT 'NONE'
                      CHECK (evt_meeting_provider IN ('NONE', 'GOOGLE_MEET', 'BODASCHOOL', 'OTHER')),
  evt_meeting_url     VARCHAR(500),

  -- CLS 클래스 연계 (옵션)
  evt_cls_id          UUID,

  -- 출처 (MANUAL = 사용자 등록, CLS_SESSION = CLS sessions에서 mirror)
  evt_source          VARCHAR(20)  NOT NULL DEFAULT 'MANUAL'
                      CHECK (evt_source IN ('MANUAL', 'CLS_SESSION')),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,

  CONSTRAINT chk_acm_cal_evt_dates CHECK (evt_end_at >= evt_start_at)
);

CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_ent_range
  ON amb_acm_cal_event (ent_id, evt_start_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_owner_range
  ON amb_acm_cal_event (ent_id, evt_owner_user_id, evt_start_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_cls
  ON amb_acm_cal_event (evt_cls_id)
  WHERE evt_cls_id IS NOT NULL;
