-- 1014 — CSL-PLN-260916: 맵테스트 신청서 원본 항목 (아임웹 /test2 접수 + 누적 이관)
-- 상담(amb_acm_csl_inquiry) 1건과 1:1. 학생 한글이름·연락처·이메일·학년은 상담 레코드가 소유하고,
-- 이 테이블은 맵테스트 신청 고유 항목과 접수 시각·원문을 보존한다. Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_csl_map_apply (
  mpa_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id                UUID NOT NULL,
  inq_id                UUID NOT NULL,
  mpa_submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 실제 접수 시각 (이관 건은 아임웹 작성시각)
  mpa_student_name_en   VARCHAR(120),                        -- 학생 영문 이름
  mpa_birthdate         DATE,                                -- 생년월일 (정규화 성공 시)
  mpa_birthdate_raw     VARCHAR(40),                         -- 정규화 실패 시 원문 보존
  mpa_gender            VARCHAR(10),                         -- 'M' | 'F'
  mpa_exam_location     VARCHAR(200),                        -- 응시 국가/도시
  mpa_preferred_slot    VARCHAR(60),                         -- 응시 희망 요일/시간
  mpa_source_site       VARCHAR(20) NOT NULL,                -- TPI | TRINITY | SANTACROCE
  mpa_origin            VARCHAR(20) NOT NULL DEFAULT 'WEB',  -- WEB(신규 접수) | IMPORT(아임웹 이관)
  mpa_import_key        VARCHAR(200),                        -- 이관 중복 방지 키 (site|작성시각|한글이름)
  mpa_raw_payload       JSONB,                               -- 접수 원문 (폼 항목 추가 시 유실 방지)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 제약/인덱스는 재실행 안전하게 개별 생성
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_csl_map_apply_inq
  ON amb_acm_csl_map_apply (inq_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_csl_map_apply_import
  ON amb_acm_csl_map_apply (ent_id, mpa_import_key)
  WHERE mpa_import_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_acm_csl_map_apply_ent_submitted
  ON amb_acm_csl_map_apply (ent_id, mpa_submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_csl_map_apply_site
  ON amb_acm_csl_map_apply (ent_id, mpa_source_site);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_map_apply_gender') THEN
    ALTER TABLE amb_acm_csl_map_apply
      ADD CONSTRAINT chk_acm_csl_map_apply_gender
      CHECK (mpa_gender IS NULL OR mpa_gender IN ('M','F'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_map_apply_site') THEN
    ALTER TABLE amb_acm_csl_map_apply
      ADD CONSTRAINT chk_acm_csl_map_apply_site
      CHECK (mpa_source_site IN ('TPI','TRINITY','SANTACROCE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_csl_map_apply_origin') THEN
    ALTER TABLE amb_acm_csl_map_apply
      ADD CONSTRAINT chk_acm_csl_map_apply_origin
      CHECK (mpa_origin IN ('WEB','IMPORT'));
  END IF;
END $$;

COMMENT ON TABLE  amb_acm_csl_map_apply             IS 'CSL-PLN-260916 맵테스트 신청서 원본 (상담 1:1)';
COMMENT ON COLUMN amb_acm_csl_map_apply.mpa_origin  IS 'WEB=아임웹 /test2 접수, IMPORT=아임웹 누적 CSV 이관';
COMMENT ON COLUMN amb_acm_csl_map_apply.mpa_import_key IS '이관 멱등 키: <site>|<작성시각 ISO>|<학생 한글이름>';

DROP TRIGGER IF EXISTS trg_acm_csl_map_apply_updated_at ON amb_acm_csl_map_apply;
CREATE TRIGGER trg_acm_csl_map_apply_updated_at
  BEFORE UPDATE ON amb_acm_csl_map_apply
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
