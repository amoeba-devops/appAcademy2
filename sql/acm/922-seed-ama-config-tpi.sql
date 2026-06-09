-- ============================================================================
-- ACM — AMA 연동 설정: TPI 운영 entityId 등록  — 2026-06-09
-- @see docs/analysis/REQ-260609C-ama-session-oauth-exchange.md (FR-3, O-1)
-- @see docs/reference/MANUAL-260609-외부앱-ama-session-연동.md
--
-- ama_session(OAuth introspect) 흐름에서 introspect 가 반환하는 `ent_id` 가
-- /admin/config(amb_acm_ama_config) 의 active 행과 일치해야 로그인이 허용된다
-- (entityId-only 게이트, D-1). TPI 운영 법인 entityId 를 결정적으로 등록한다.
--
-- entityId 는 비밀이 아닌 공개 식별자(UUID). client_id/secret 은 호스트 .env
-- 에만 두며 절대 저장소/seed 에 넣지 않는다.
--
-- Idempotent (ON CONFLICT DO NOTHING). Target: ACM PostgreSQL.
-- ============================================================================

-- 무지정 ON CONFLICT DO NOTHING — ent_id / amc_ama_entity_id 두 unique 제약 중
-- 어느 쪽이 충돌해도 no-op. (운영엔 이미 amc_ama_entity_id=928f5fe4 행이
-- 다른 ent_id 하위로 존재할 수 있어 ON CONFLICT (ent_id) 로는 못 잡음.)
INSERT INTO amb_acm_ama_config (ent_id, amc_ama_entity_id, amc_app_code, amc_is_active)
VALUES (
  '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
  '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
  'tpi-acm',
  TRUE
)
ON CONFLICT DO NOTHING;
