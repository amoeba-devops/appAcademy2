-- REQ-261016D — 이슈 유형 2종(업무요청 TASK · 기타 OTHER) + 담당자 변경 이력.
-- 멱등: CD 가 sql/acm/*.sql 을 자동 적용한다.

-- 1) 유형: 기능·버그·의견은 업무요청으로 합친 뒤 제약을 2종으로 줄인다.
UPDATE amb_acm_prj_item SET pit_issue_type = 'TASK'
 WHERE pit_issue_type IN ('FEATURE', 'BUG', 'OPINION');
ALTER TABLE amb_acm_prj_item DROP CONSTRAINT IF EXISTS chk_acm_prj_item_issue_type;
ALTER TABLE amb_acm_prj_item ADD CONSTRAINT chk_acm_prj_item_issue_type
  CHECK (pit_issue_type IN ('TASK', 'OTHER'));

-- 2) 이력: 상태 변경(STATUS)과 담당자 변경(ASSIGNEE)을 같은 표에 남긴다.
ALTER TABLE amb_acm_prj_issue_status_log
  ADD COLUMN IF NOT EXISTS psl_kind      VARCHAR(10) NOT NULL DEFAULT 'STATUS',
  ADD COLUMN IF NOT EXISTS from_user_id  UUID,
  ADD COLUMN IF NOT EXISTS to_user_id    UUID;
ALTER TABLE amb_acm_prj_issue_status_log ALTER COLUMN to_status DROP NOT NULL;
ALTER TABLE amb_acm_prj_issue_status_log DROP CONSTRAINT IF EXISTS chk_acm_prj_issue_log_kind;
ALTER TABLE amb_acm_prj_issue_status_log ADD CONSTRAINT chk_acm_prj_issue_log_kind
  CHECK (psl_kind IN ('STATUS', 'ASSIGNEE') AND (psl_kind = 'ASSIGNEE' OR to_status IS NOT NULL));
