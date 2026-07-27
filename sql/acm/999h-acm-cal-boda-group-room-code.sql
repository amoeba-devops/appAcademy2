-- FIX-260724 / 요구사항 260727 — BODA 1:N(그룹) 수업용 roomCode 추가.
--
-- 배경: roomCode=699 는 벤더 1:1 전용 룸이라 3번째 참가자(2번째 학생)가
--       활성 영상 슬롯을 못 받음(FIX-260724). 벤더가 1:N 룸코드(881)를 발급.
--
-- 1) 테넌트 config 에 1:N roomCode 컬럼(bdc_group_room_code) 추가.
-- 2) 이벤트에 룸 유형(evt_boda_room_type: ONE_TO_ONE|ONE_TO_MANY) 추가
--    — 운영자가 수업일정 등록 시 1:1 / 1:N 선택. 기본 ONE_TO_ONE.
-- 3) 기존 1:1(699) 설정 테넌트(TPI)에 1:N=881 시드(멱등).
--
-- @see docs/bug-fix/FIX-260724-boda-group-third-participant-inactive.md

-- 1) config: 1:N roomCode
ALTER TABLE amb_acm_cal_boda_config
  ADD COLUMN IF NOT EXISTS bdc_group_room_code VARCHAR(30);

-- 2) event: 룸 유형
ALTER TABLE amb_acm_cal_event
  ADD COLUMN IF NOT EXISTS evt_boda_room_type VARCHAR(12) NOT NULL DEFAULT 'ONE_TO_ONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_acm_cal_event_boda_room_type'
  ) THEN
    ALTER TABLE amb_acm_cal_event
      ADD CONSTRAINT ck_acm_cal_event_boda_room_type
      CHECK (evt_boda_room_type IN ('ONE_TO_ONE', 'ONE_TO_MANY'));
  END IF;
END $$;

-- 3) 시드: 1:1=699 로 설정된 테넌트에 1:N=881 (멱등, null 일 때만)
UPDATE amb_acm_cal_boda_config
   SET bdc_group_room_code = '881'
 WHERE bdc_group_room_code IS NULL
   AND bdc_default_room_code = '699';
