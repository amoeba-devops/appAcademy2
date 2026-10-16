-- REQ-261016C — 이슈를 AMA 이슈 작성 화면 수준으로 확장.
-- 번호(테넌트별), 상위 이슈, 진행률, 해결 내용, 배정 시각, 출처(이전), 참여자, 첨부.
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.

ALTER TABLE amb_acm_prj_item
  ADD COLUMN IF NOT EXISTS pit_ref_no      INT,
  ADD COLUMN IF NOT EXISTS pit_parent_id   UUID,
  ADD COLUMN IF NOT EXISTS pit_done_ratio  SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pit_resolution  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pit_source      VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pit_source_ref  VARCHAR(50);
ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS chk_acm_prj_item_done_ratio;
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT chk_acm_prj_item_done_ratio
  CHECK (pit_done_ratio BETWEEN 0 AND 100);
ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS fk_acm_prj_item_parent;
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT fk_acm_prj_item_parent
  FOREIGN KEY (pit_parent_id) REFERENCES amb_acm_prj_item (pit_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_acm_prj_item_parent
  ON amb_acm_prj_item (ent_id, pit_parent_id) WHERE pit_parent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_prj_item_source
  ON amb_acm_prj_item (ent_id, pit_source, pit_source_ref) WHERE pit_source IS NOT NULL;

-- 테넌트별 이슈 번호(화면 ISS-n). 신규 이슈는 트리거가 채번한다.
CREATE TABLE IF NOT EXISTS amb_acm_prj_issue_seq (
  ent_id   UUID PRIMARY KEY,
  last_no  INT NOT NULL DEFAULT 0
);
WITH numbered AS (
  SELECT pit_id, ent_id,
         row_number() OVER (PARTITION BY ent_id ORDER BY created_at, pit_id) AS n
    FROM amb_acm_prj_item
   WHERE pit_kind = 'ISSUE' AND pit_ref_no IS NULL
     AND NOT EXISTS (SELECT 1 FROM amb_acm_prj_issue_seq s WHERE s.ent_id = amb_acm_prj_item.ent_id)
)
UPDATE amb_acm_prj_item i SET pit_ref_no = n.n FROM numbered n WHERE i.pit_id = n.pit_id;
INSERT INTO amb_acm_prj_issue_seq (ent_id, last_no)
SELECT ent_id, max(pit_ref_no) FROM amb_acm_prj_item
 WHERE pit_kind = 'ISSUE' AND pit_ref_no IS NOT NULL GROUP BY ent_id
ON CONFLICT (ent_id) DO UPDATE SET last_no = GREATEST(amb_acm_prj_issue_seq.last_no, EXCLUDED.last_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_prj_item_ref_no
  ON amb_acm_prj_item (ent_id, pit_ref_no) WHERE pit_ref_no IS NOT NULL;

CREATE OR REPLACE FUNCTION set_acm_prj_issue_ref_no() RETURNS trigger AS $$
BEGIN
  IF NEW.pit_kind = 'ISSUE' AND NEW.pit_ref_no IS NULL THEN
    INSERT INTO amb_acm_prj_issue_seq (ent_id, last_no) VALUES (NEW.ent_id, 1)
    ON CONFLICT (ent_id) DO UPDATE SET last_no = amb_acm_prj_issue_seq.last_no + 1
    RETURNING last_no INTO NEW.pit_ref_no;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_acm_prj_item_issue_ref_no ON amb_acm_prj_item;
CREATE TRIGGER trg_acm_prj_item_issue_ref_no BEFORE INSERT ON amb_acm_prj_item
  FOR EACH ROW EXECUTE FUNCTION set_acm_prj_issue_ref_no();

-- 배정 시각: 기존 담당 이슈는 등록 시각으로 보정.
UPDATE amb_acm_prj_item SET assigned_at = created_at
 WHERE pit_kind = 'ISSUE' AND assignee_id IS NOT NULL AND assigned_at IS NULL;

CREATE TABLE IF NOT EXISTS amb_acm_prj_issue_participant (
  ent_id      UUID NOT NULL,
  pit_id      UUID NOT NULL REFERENCES amb_acm_prj_item (pit_id) ON DELETE CASCADE,
  usr_id      UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pit_id, usr_id)
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_issue_participant_user
  ON amb_acm_prj_issue_participant (ent_id, usr_id);

-- 첨부: 프로젝트 파일(ACM 저장소·Drive, pit_kind='FILE') 연결 또는 URL.
CREATE TABLE IF NOT EXISTS amb_acm_prj_issue_attachment (
  pia_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id        UUID NOT NULL,
  pit_id        UUID NOT NULL REFERENCES amb_acm_prj_item (pit_id) ON DELETE CASCADE,
  file_item_id  UUID REFERENCES amb_acm_prj_item (pit_id) ON DELETE SET NULL,
  pia_url       VARCHAR(1000),
  pia_name      VARCHAR(255) NOT NULL,
  pia_size      BIGINT,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT chk_acm_prj_issue_attachment_target CHECK (file_item_id IS NOT NULL OR pia_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_issue_attachment_item
  ON amb_acm_prj_issue_attachment (ent_id, pit_id) WHERE deleted_at IS NULL;
