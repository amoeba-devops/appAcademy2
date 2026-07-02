-- ============================================================================
-- ACM CAL-BODA — TPI 테넌트 BODA(보다에듀) 연동 기본 설정 seed  — 2026-07-02
-- @see sql/acm/910-acm-cal-boda.sql (스키마)
-- @see docs/analysis/REQ-260526-acm-cal-boda-integration.md (FR-BODA-CFG)
--
-- 목적: 즉시 강의 개설(/admin/cal) 시 발생하는
--   422 BODA_DEFAULT_ROOM_CODE_MISSING
--   ("BODA 기본 룸코드가 설정되지 않았습니다") 를 해소한다.
--   createPending() 이 amb_acm_cal_boda_config.bdc_default_room_code 를
--   읽어 룸을 PENDING 생성하므로, 최소한 default_room_code 가 있어야 한다.
--
-- ⚠️ ent_id 주의 (TPI 함정): ACM 내부 운영 테넌트는
--   00000000-0000-0000-0000-000000000001 이다 (학생/대시보드/AMA 기본 설정이
--   모두 이 ent_id 하위). AMA 측 amaEntityId(928f5fe4-…) 와 다르며, 런타임
--   JWT(u.entId)·OwnEntityGuard 는 이 내부 ent_id 로 해석된다. 따라서 config
--   행도 반드시 이 값으로 넣어야 createPending() 이 찾을 수 있다.
--
-- 값 출처: BODA vendor 샘플 페이지 public/web/BODA_APP/tpi.html
--   bodaWebURL = https://bodaedu.kr, companyId = tpi, roomCode(기본) = 699
--   svr_url    = 같은 호스트 하위 /svr/* (tpi.html 이 `${bodaWebURL}/svr/...` 호출)
--
-- 🔒 비밀(authKey / eventSecret)·companyCode 는 seed 에 넣지 않는다
--    (922-seed-ama-config-tpi.sql 과 동일 원칙). 운영자가 배포 후
--    설정 → BODA 연동(/admin/config/boda) 에서 입력·검증한다:
--      - authKey (SERVER API Basic 인증), eventSecret (Webhook HMAC)
--      - companyCode, webrtcUrl 실값 확인
--
-- Idempotent: 행이 없으면 생성, 이미 있으면 기존 값을 보존하되
-- default_room_code 가 비어 있을 때만 채운다(운영자 입력값 미덮어씀).
-- Target: ACM PostgreSQL (db_acm).
-- ============================================================================

INSERT INTO amb_acm_cal_boda_config (
  ent_id,
  bdc_boda_web_url,
  bdc_svr_url,
  bdc_webrtc_url,
  bdc_company_code,
  bdc_company_id,
  bdc_default_room_code,
  bdc_is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'https://bodaedu.kr',
  'https://bodaedu.kr',
  'https://bodaedu.kr/webrtc',
  '',            -- companyCode: 운영자가 UI 에서 실값 입력
  'tpi',
  '699',
  TRUE
)
ON CONFLICT (ent_id) DO UPDATE SET
  bdc_default_room_code = CASE
    WHEN amb_acm_cal_boda_config.bdc_default_room_code = ''
      THEN EXCLUDED.bdc_default_room_code
      ELSE amb_acm_cal_boda_config.bdc_default_room_code
  END,
  bdc_company_id = CASE
    WHEN amb_acm_cal_boda_config.bdc_company_id = ''
      THEN EXCLUDED.bdc_company_id
      ELSE amb_acm_cal_boda_config.bdc_company_id
  END,
  updated_at = NOW();
