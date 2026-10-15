-- REQ-261015C WP3 — ACM 프로젝트 이슈를 AMA 이슈 화면 수준으로 확장.
-- 상태는 AMA 간소화 모드: OPEN / IN_PROGRESS / DONE (+ REJECTED). 기존 TODO→OPEN, DOING→IN_PROGRESS.
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.

ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS amb_acm_prj_item_pit_status_check;
UPDATE amb_acm_prj_item SET pit_status = 'OPEN' WHERE pit_status = 'TODO';
UPDATE amb_acm_prj_item SET pit_status = 'IN_PROGRESS' WHERE pit_status = 'DOING';
ALTER TABLE amb_acm_prj_item ALTER COLUMN pit_status SET DEFAULT 'OPEN';
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT amb_acm_prj_item_pit_status_check
  CHECK (pit_status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'));

ALTER TABLE amb_acm_prj_item
  ADD COLUMN IF NOT EXISTS pit_issue_type VARCHAR(10) NOT NULL DEFAULT 'TASK',
  ADD COLUMN IF NOT EXISTS pit_priority SMALLINT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS pit_done_at TIMESTAMPTZ;
ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS chk_acm_prj_item_issue_type;
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT chk_acm_prj_item_issue_type
  CHECK (pit_issue_type IN ('TASK', 'FEATURE', 'BUG', 'OPINION', 'OTHER'));
ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS chk_acm_prj_item_priority;
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT chk_acm_prj_item_priority
  CHECK (pit_priority BETWEEN 1 AND 5);
-- 기존 완료 이슈의 완료 시각은 마지막 수정 시각으로 보정.
UPDATE amb_acm_prj_item SET pit_done_at = updated_at
 WHERE pit_kind = 'ISSUE' AND pit_status = 'DONE' AND pit_done_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_acm_prj_item_issue_assignee
  ON amb_acm_prj_item (ent_id, assignee_id) WHERE pit_kind = 'ISSUE' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_prj_item_issue_creator
  ON amb_acm_prj_item (ent_id, created_by) WHERE pit_kind = 'ISSUE' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS amb_acm_prj_issue_comment (
  pic_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id      UUID NOT NULL,
  pit_id      UUID NOT NULL REFERENCES amb_acm_prj_item (pit_id) ON DELETE CASCADE,
  author_id   UUID NOT NULL,
  pic_body    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_issue_comment_item
  ON amb_acm_prj_issue_comment (ent_id, pit_id, created_at);
DROP TRIGGER IF EXISTS trg_acm_prj_issue_comment_updated_at ON amb_acm_prj_issue_comment;
CREATE TRIGGER trg_acm_prj_issue_comment_updated_at BEFORE UPDATE ON amb_acm_prj_issue_comment
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();

CREATE TABLE IF NOT EXISTS amb_acm_prj_issue_status_log (
  psl_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id       UUID NOT NULL,
  pit_id       UUID NOT NULL REFERENCES amb_acm_prj_item (pit_id) ON DELETE CASCADE,
  from_status  VARCHAR(15),
  to_status    VARCHAR(15) NOT NULL,
  psl_note     VARCHAR(500) NOT NULL DEFAULT '',
  changed_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_prj_issue_status_log_item
  ON amb_acm_prj_issue_status_log (ent_id, pit_id, created_at);
