-- ============================================================================
-- REQ-260912B / PLN-260912B — 보다스쿨 녹화본 메타 + ACM 서버 보관(아카이브)
--
-- 보다 SERVER API 에는 공개 재생 URL 이 없고 Basic 인증 다운로드만 제공한다
-- (SPEC_823 v823.002 §녹화/녹음). 따라서 ACM 이 파일을 S3(MinIO) 로 복사
-- 보관하고, 콘솔은 ACM 프록시(Range 지원)로 재생·다운로드한다.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS amb_acm_cal_boda_recording (
  bdv_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  evt_id              UUID         NOT NULL,
  bdr_id              UUID,                             -- amb_acm_cal_boda_room.bdr_id (nullable — 룸 행 정리 대비)

  -- BODA 식별자
  bdv_record_idx      INTEGER      NOT NULL,            -- SERVER API recordIdx
  bdv_meet_idx        VARCHAR(60),
  bdv_room_code       VARCHAR(30),

  -- 녹화 메타 (목록 API / event 21)
  bdv_title           VARCHAR(256),
  bdv_started_at      TIMESTAMPTZ,                      -- startDatetime (YYYYMMDDhhmmss, 테넌트 TZ 해석)
  bdv_ended_at        TIMESTAMPTZ,                      -- endDatetime
  bdv_duration_sec    INTEGER,                          -- event 21 recordTime
  bdv_file_exist      BOOLEAN      NOT NULL DEFAULT TRUE,

  -- ACM 보관 상태
  bdv_archive_status  VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                      CHECK (bdv_archive_status IN
                             ('PENDING', 'ARCHIVING', 'ARCHIVED', 'FAILED', 'MISSING')),
  bdv_s3_key          VARCHAR(400),
  bdv_mime            VARCHAR(100),
  bdv_size_bytes      BIGINT,
  bdv_archived_at     TIMESTAMPTZ,
  bdv_attempts        SMALLINT     NOT NULL DEFAULT 0,
  bdv_error           VARCHAR(500),

  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_acm_cal_bdv_ent_record UNIQUE (ent_id, bdv_record_idx)
);

CREATE INDEX IF NOT EXISTS idx_acm_cal_bdv_evt
  ON amb_acm_cal_boda_recording (ent_id, evt_id, bdv_record_idx);

-- 아카이브 워커 스캔용 — 보관 대기/실패만.
CREATE INDEX IF NOT EXISTS idx_acm_cal_bdv_archive_queue
  ON amb_acm_cal_boda_recording (bdv_archive_status, created_at)
  WHERE bdv_archive_status IN ('PENDING', 'FAILED');

-- updated_at 트리거 (sql/acm/910 의 set_acm_updated_at 재사용).
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

DROP TRIGGER IF EXISTS trg_acm_cal_bdv_updated_at ON amb_acm_cal_boda_recording;
CREATE TRIGGER trg_acm_cal_bdv_updated_at
  BEFORE UPDATE ON amb_acm_cal_boda_recording
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
