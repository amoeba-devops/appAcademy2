-- ============================================================================
-- ACM — AMA 연동 설정 부트스트랩 seed  — 2026-06-09
-- @see docs/plan/PLN-260609B-ama-integration-config.md §2 (FR-4)
--
-- 게이트 정책이 "DB 미설정 시 전면 거부" 이므로, 설정 행이 하나도 없으면
-- 최초 관리자조차 로그인할 수 없다(lockout). 이를 막기 위해 배포 시 본 seed 로
-- TPI 기본 설정 행을 미리 적재한다. 이후 /admin/config 에서 수정 가능.
--
-- 운영 무손실(lockout 방지) 핵심: 실제 TPI entityId UUID 를 하드코딩하지 않고
-- 이미 로그인 이력이 있는 amb_acm_user.ent_id 에서 부트스트랩한다. 즉 현재
-- 로그인 중인 법인과 동일한 entityId 로 allow 행을 만들어 연속성을 보장한다.
-- appCode 는 커스텀앱 등록명 'tpi-acm' 상수.
--
-- Idempotent (ON CONFLICT DO NOTHING). Target: ACM PostgreSQL.
-- ============================================================================

-- (1) 운영 부트스트랩 — 기존 사용자(들)의 entId 로 allow 행 생성.
--     동일 entId 다수 사용자라도 DISTINCT 로 1행. 이미 있으면 무시.
INSERT INTO amb_acm_ama_config (ent_id, amc_ama_entity_id, amc_app_code, amc_is_active)
SELECT DISTINCT u.ent_id, u.ent_id::text, 'tpi-acm', TRUE
  FROM amb_acm_user u
 WHERE u.ent_id IS NOT NULL
ON CONFLICT (ent_id) DO NOTHING;

-- (2) 로컬/신규 개발 환경 — Trinity Academy(TPI) dev entId.
--     운영에 실 토큰과 매칭되지 않는 dev UUID 가 추가돼도 deny-all 의미상 무해
--     (어떤 실 토큰도 이 entityId 를 싣지 않음). 충돌 시 무시.
INSERT INTO amb_acm_ama_config (ent_id, amc_ama_entity_id, amc_app_code, amc_is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'tpi-acm',
  TRUE
)
ON CONFLICT (ent_id) DO NOTHING;
