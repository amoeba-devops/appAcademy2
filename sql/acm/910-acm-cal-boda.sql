-- ============================================================================
-- ACM CAL-BODA v1.0 — BODA(보다에듀) 화상 강의실 캘린더 연동
-- @see docs/analysis/REQ-260526-acm-cal-boda-integration.md (v2.0.0)
-- @see docs/plan/PLN-260526-acm-cal-boda-integration.md (v1.0.0)
--
-- 4 신규 테이블:
--   amb_acm_cal_boda_config       — 테넌트별 연동 설정 (자격증명 암호화 BYTEA)
--   amb_acm_cal_boda_room         — 캘린더 이벤트 ↔ BODA 룸 1:0..1
--   amb_acm_cal_boda_participant  — 입·퇴장 N (한 사용자 반복 입장 허용)
--   amb_acm_cal_boda_event_log    — Webhook 원본 + 멱등 보장 (UNIQUE dedup)
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- 마이그레이션 적용은 scripts/deploy-staging.sh + scripts/deploy-production.sh
-- 의 sql/acm/ 루프가 sha256 marker 로 추적.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) amb_acm_cal_boda_config — 테넌트별 BODA 연동 설정
--    1 row per (ent_id). 자격증명은 AES-GCM 으로 BYTEA 보관 (NFR-3).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_cal_boda_config (
  bdc_id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id                  UUID         NOT NULL,

  -- 공개 URL/식별자 (평문)
  bdc_boda_web_url        VARCHAR(255) NOT NULL,
  bdc_svr_url             VARCHAR(255) NOT NULL,
  bdc_webrtc_url          VARCHAR(255) NOT NULL,
  bdc_company_code        VARCHAR(30)  NOT NULL,
  bdc_company_id          VARCHAR(60)  NOT NULL,
  bdc_default_room_code   VARCHAR(30)  NOT NULL,

  -- 비밀 — AES-GCM 암호화 후 BYTEA. SELECT 응답에 포함 금지 (FR-BODA-CFG-3).
  bdc_auth_key_enc        BYTEA,
  bdc_event_secret_enc    BYTEA,

  -- Webhook 출발지 IP allowlist (콤마 구분 CIDR). NULL = no allowlist 강제.
  bdc_webhook_allow_cidrs VARCHAR(500),

  -- 입장 가능 시간 창 (시작 N분 전 ~ 종료 후 M분). 기본값 REQ FR-LAUNCH-3.
  bdc_grace_before_min    SMALLINT     NOT NULL DEFAULT 10,
  bdc_grace_after_min     SMALLINT     NOT NULL DEFAULT 15,

  -- 출결 reconcile 지연 시간 (수업 종료 후 N분).
  bdc_reconcile_delay_min SMALLINT     NOT NULL DEFAULT 10,

  -- 토글 — FR-BODA-CFG-4: false 면 BODASCHOOL 분기 비활성, 수동 URL fallback.
  bdc_is_active           BOOLEAN      NOT NULL DEFAULT TRUE,

  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_acm_boda_config_ent UNIQUE (ent_id),
  CONSTRAINT chk_acm_boda_config_grace CHECK (
    bdc_grace_before_min BETWEEN 0 AND 60 AND
    bdc_grace_after_min  BETWEEN 0 AND 120
  )
);

CREATE INDEX IF NOT EXISTS idx_acm_boda_config_company
  ON amb_acm_cal_boda_config (bdc_company_code);


-- ----------------------------------------------------------------------------
-- 2) amb_acm_cal_boda_room — 이벤트 ↔ BODA 룸 1 : 0..1
--    evt_meeting_provider='BODASCHOOL' 인 캘린더 이벤트에만 행 생성.
--    상태 머신: PENDING → OPEN → STARTED → (PAUSED) → ENDED → CLOSED
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_cal_boda_room (
  bdr_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID         NOT NULL,

  -- 이벤트 / 회차 연계
  evt_id          UUID         NOT NULL,           -- → amb_acm_cal_event.evt_id
  ses_id          UUID,                            -- CLS 회차 mirror 시 연계 (옵션)

  -- BODA 식별자
  bdr_meet_key    VARCHAR(255) NOT NULL,           -- 'tac-{evtId hex 32}' — 전역 유일·불변 (FR-ROOM-2)
  bdr_room_code   VARCHAR(30)  NOT NULL,           -- TPI=BODA_DEFAULT_ROOM_CODE
  bdr_meet_idx    VARCHAR(60),                     -- 개설(이벤트 1) 수신 시 저장 (FR-ROOM-8)

  -- 상태 + 시각
  bdr_status      VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                  CHECK (bdr_status IN
                    ('PENDING', 'OPEN', 'STARTED', 'PAUSED', 'ENDED', 'CLOSED')),
  bdr_opened_at   TIMESTAMPTZ,                     -- 이벤트 1
  bdr_started_at  TIMESTAMPTZ,                     -- 이벤트 2
  bdr_ended_at    TIMESTAMPTZ,                     -- 이벤트 4
  bdr_closed_at   TIMESTAMPTZ,                     -- 이벤트 5
  bdr_close_type  VARCHAR(20),                     -- normal | force_admin | timeout | …

  -- reconcile 진행 추적
  bdr_reconciled_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_acm_boda_room_evt UNIQUE (evt_id),
  CONSTRAINT uq_acm_boda_room_meet_key UNIQUE (bdr_meet_key),
  CONSTRAINT chk_acm_boda_room_meetkey_format CHECK (
    bdr_meet_key ~ '^tac-[0-9a-f]{32}$'
  )
);

CREATE INDEX IF NOT EXISTS idx_acm_boda_room_ent_status
  ON amb_acm_cal_boda_room (ent_id, bdr_status);
CREATE INDEX IF NOT EXISTS idx_acm_boda_room_ses
  ON amb_acm_cal_boda_room (ses_id) WHERE ses_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acm_boda_room_reconcile_pending
  ON amb_acm_cal_boda_room (ent_id, bdr_ended_at)
  WHERE bdr_reconciled_at IS NULL AND bdr_ended_at IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 3) amb_acm_cal_boda_participant — 입·퇴장 N
--    한 사용자가 같은 룸에 여러 번 입장할 수 있음 (네트워크 끊김 등) — 매 입장이
--    새 행. 퇴장 시 left_at + total_seconds 갱신.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_cal_boda_participant (
  bdp_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  bdr_id              UUID         NOT NULL,        -- → amb_acm_cal_boda_room.bdr_id (CASCADE)

  -- BODA 측 식별자 + 우리쪽 역매핑
  bdp_boda_user_id    VARCHAR(60)  NOT NULL,         -- = UId (앱 사용자 uuid 32hex)
  bdp_user_kind       VARCHAR(20)  NOT NULL DEFAULT 'UNKNOWN'
                      CHECK (bdp_user_kind IN
                        ('TEACHER', 'STUDENT', 'OPERATOR', 'UNKNOWN')),
  bdp_ref_user_id     UUID,                           -- amb_acm_user.usr_id 매핑 (없을 수 있음)

  -- 입·퇴장 + 체류 시간
  bdp_joined_at       TIMESTAMPTZ  NOT NULL,
  bdp_left_at         TIMESTAMPTZ,
  bdp_total_seconds   INTEGER,
  bdp_client_type     VARCHAR(20),                    -- 'native' | 'webrtc' | 'mobile' | …

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_acm_boda_participant_room
    FOREIGN KEY (bdr_id) REFERENCES amb_acm_cal_boda_room(bdr_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_acm_boda_participant_room
  ON amb_acm_cal_boda_participant (bdr_id, bdp_joined_at);
CREATE INDEX IF NOT EXISTS idx_acm_boda_participant_user
  ON amb_acm_cal_boda_participant (ent_id, bdp_boda_user_id);
-- 입장 진행 중 (left_at NULL) — 같은 user 의 직전 행을 빨리 찾기 위함.
CREATE INDEX IF NOT EXISTS idx_acm_boda_participant_open
  ON amb_acm_cal_boda_participant (bdr_id, bdp_boda_user_id)
  WHERE bdp_left_at IS NULL;


-- ----------------------------------------------------------------------------
-- 4) amb_acm_cal_boda_event_log — Webhook 원본 + 멱등 dedup
--    FR-EVENT-3: UNIQUE (meet_idx, event_code, event_at, COALESCE(user_id,''))
--    PG 에서 NULL 은 UNIQUE 무시되므로 COALESCE 표현식 인덱스로 강제.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_cal_boda_event_log (
  bel_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID         NOT NULL,

  -- 이벤트 분류 + dedup 키 구성요소
  bel_event_code    SMALLINT     NOT NULL,             -- 1·2·3·4·5·9·10·11·12·13·21·…
  bel_meet_idx      VARCHAR(60),                       -- 이벤트 1 이후만 채워짐 (PENDING 단계 NULL)
  bel_meet_key      VARCHAR(255),                      -- 일부 이벤트는 meetKey 만 옴
  bel_event_at      TIMESTAMPTZ  NOT NULL,
  bel_user_id       VARCHAR(60),                       -- 11/12 입퇴장에만 채워짐

  -- 원본 payload (JSONB 보관 — 후속 분석/감사)
  bel_payload       JSONB        NOT NULL,
  bel_processed     BOOLEAN      NOT NULL DEFAULT FALSE,
  bel_processed_at  TIMESTAMPTZ,
  bel_error         VARCHAR(500),                      -- 처리 실패 시 사유

  -- 수신 메타 (감사 / 디버그)
  bel_src_ip        VARCHAR(45),
  bel_received_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Dedup unique index — COALESCE(user_id, '') 로 NULL 무시 회피.
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_boda_event_dedup
  ON amb_acm_cal_boda_event_log (
    COALESCE(bel_meet_idx, ''),
    bel_event_code,
    bel_event_at,
    COALESCE(bel_user_id, '')
  );

CREATE INDEX IF NOT EXISTS idx_acm_boda_event_meet_key
  ON amb_acm_cal_boda_event_log (bel_meet_key);
CREATE INDEX IF NOT EXISTS idx_acm_boda_event_processed
  ON amb_acm_cal_boda_event_log (ent_id, bel_received_at DESC)
  WHERE bel_processed = FALSE;


-- ----------------------------------------------------------------------------
-- 5) updated_at trigger (재사용 — sql/acm/100 의 패턴)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_acm_updated_at') THEN
    CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER AS $body$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_acm_boda_config_updated_at  ON amb_acm_cal_boda_config;
DROP TRIGGER IF EXISTS trg_acm_boda_room_updated_at    ON amb_acm_cal_boda_room;
DROP TRIGGER IF EXISTS trg_acm_boda_participant_updated_at ON amb_acm_cal_boda_participant;

CREATE TRIGGER trg_acm_boda_config_updated_at
  BEFORE UPDATE ON amb_acm_cal_boda_config
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_boda_room_updated_at
  BEFORE UPDATE ON amb_acm_cal_boda_room
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
CREATE TRIGGER trg_acm_boda_participant_updated_at
  BEFORE UPDATE ON amb_acm_cal_boda_participant
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();


-- ----------------------------------------------------------------------------
-- 6) 정합성 / 스모크 쿼리 (운영자 확인용 — 실행 안 됨)
-- ----------------------------------------------------------------------------
-- 미처리 webhook 큐:
--   SELECT ent_id, COUNT(*) FROM amb_acm_cal_boda_event_log
--    WHERE bel_processed = FALSE GROUP BY ent_id;
--
-- reconcile 대기:
--   SELECT bdr_id, evt_id, bdr_ended_at FROM amb_acm_cal_boda_room
--    WHERE bdr_reconciled_at IS NULL
--      AND bdr_ended_at IS NOT NULL
--      AND bdr_ended_at < NOW() - INTERVAL '10 minutes';
--
-- 현재 OPEN 룸:
--   SELECT bdr_meet_key, bdr_opened_at, evt_id FROM amb_acm_cal_boda_room
--    WHERE bdr_status IN ('OPEN','STARTED','PAUSED');
