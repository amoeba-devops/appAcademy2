-- REQ-261016 — 회사 Google Workspace 연동 상태 표시용 컬럼. 멱등.
ALTER TABLE amb_acm_prj_drive
  ADD COLUMN IF NOT EXISTS account_domain VARCHAR(200),
  ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
