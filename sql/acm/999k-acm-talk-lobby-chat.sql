-- REQ-260728C — 로비채팅 (운영자↔강사 메신저, AMA amoeba-talk 참조 구현).
--
-- 대화방(GROUP 단체방 / DIRECT 1:1)은 콘솔 운영자(ADMIN·APP_ADMIN)만 개설.
-- 참여자는 운영자(amb_acm_user.usr_id) + 강사(amb_acm_tch_teacher.tch_id) 혼합
-- — tlm_kind 로 구분. 읽음 포인터(tlm_last_read_at)는 멤버 행에 통합
-- (아메바톡 amb_talk_read_status 의 채널×사용자 유니크 모델과 등가).
-- 메시지는 TEXT | FILE (메시지당 1파일 ≤50MB, S3 키만 보관).
--
-- @see docs/plan/PLN-260728C-acm-lobby-chat.md

CREATE TABLE IF NOT EXISTS amb_acm_talk_channel (
  tlc_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id         UUID NOT NULL,
  tlc_type       VARCHAR(10) NOT NULL CHECK (tlc_type IN ('GROUP','DIRECT')),
  tlc_name       VARCHAR(100) NOT NULL,
  tlc_created_by UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS amb_acm_talk_member (
  tlm_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  tlc_id           UUID NOT NULL,
  tlm_kind         VARCHAR(10) NOT NULL CHECK (tlm_kind IN ('USER','TEACHER')),
  tlm_ref_id       UUID NOT NULL,
  tlm_role         VARCHAR(10) NOT NULL DEFAULT 'MEMBER' CHECK (tlm_role IN ('OWNER','MEMBER')),
  tlm_last_read_at TIMESTAMPTZ,
  tlm_joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tlm_left_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS amb_acm_talk_message (
  tms_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID NOT NULL,
  tlc_id          UUID NOT NULL,
  tms_sender_kind VARCHAR(10) NOT NULL CHECK (tms_sender_kind IN ('USER','TEACHER')),
  tms_sender_ref  UUID NOT NULL,
  tms_type        VARCHAR(10) NOT NULL DEFAULT 'TEXT' CHECK (tms_type IN ('TEXT','FILE')),
  tms_content     TEXT NOT NULL DEFAULT '',
  tms_filename    VARCHAR(255),
  tms_mime        VARCHAR(100),
  tms_size_bytes  BIGINT CHECK (tms_size_bytes IS NULL OR (tms_size_bytes > 0 AND tms_size_bytes <= 52428800)),
  tms_s3_key      VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_talk_member_ref
  ON amb_acm_talk_member (ent_id, tlm_kind, tlm_ref_id) WHERE tlm_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_talk_member_chn
  ON amb_acm_talk_member (ent_id, tlc_id) WHERE tlm_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_talk_msg_chn
  ON amb_acm_talk_message (ent_id, tlc_id, created_at DESC) WHERE deleted_at IS NULL;
