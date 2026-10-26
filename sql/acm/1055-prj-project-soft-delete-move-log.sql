-- ============================================================================
-- PLN-261027B — 서비스 관리자 프로젝트 삭제(숨김) + 이슈 프로젝트 변경 이력. 멱등.
-- 삭제된 프로젝트는 목록·이슈·내 업무·문서에서 숨긴다(복구 = prj_deleted_at NULL).
-- ============================================================================
ALTER TABLE amb_acm_prj_project ADD COLUMN IF NOT EXISTS prj_deleted_at TIMESTAMPTZ;
ALTER TABLE amb_acm_prj_project ADD COLUMN IF NOT EXISTS prj_deleted_by UUID;

-- 이력: 프로젝트 변경(PROJECT) — psl_note 에 "이전 → 새 프로젝트" 이름을 남긴다.
ALTER TABLE amb_acm_prj_issue_status_log DROP CONSTRAINT IF EXISTS chk_acm_prj_issue_log_kind;
ALTER TABLE amb_acm_prj_issue_status_log ADD CONSTRAINT chk_acm_prj_issue_log_kind
  CHECK (psl_kind IN ('STATUS', 'ASSIGNEE', 'PROJECT') AND (psl_kind <> 'STATUS' OR to_status IS NOT NULL));
