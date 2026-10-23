-- ============================================================================
-- REQ-261024 Part 2 — 로컬 고정 계정: AMA 로 로그인해도 로그인 방식(auth_source)·등급·이름·이메일을
-- ACM 이 관리한다(SSO 는 AMA 사용자 ID·역할 스냅숏만 갱신). 멱등.
-- ============================================================================
ALTER TABLE amb_acm_user ADD COLUMN IF NOT EXISTS usr_local_pinned BOOLEAN NOT NULL DEFAULT false;
