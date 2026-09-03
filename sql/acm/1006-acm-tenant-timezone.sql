-- 1006 — REQ-260903: 테넌트 타임존 설정 (기본 Asia/Seoul — 서비스 국가 한국)
-- Idempotent.

ALTER TABLE amb_acm_tenant
  ADD COLUMN IF NOT EXISTS tnt_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul';
