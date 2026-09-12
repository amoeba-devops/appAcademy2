-- ============================================================================
-- 요구 260912C — 신규상담 등록일(inq_registered_at) 타임존 보정 (1회성 백필)
--
-- 원인: InquiryService.create 가 등록일 기본값을 UTC 날짜
--       (`new Date().toISOString().slice(0,10)`) 로 계산해, KST 00:00~09:00 에
--       접수된 건의 등록일이 하루 전으로 기록됐다. 코드는 테넌트 타임존 기준
--       'YYYY-MM-DD' (ymdInTz) 로 수정 완료.
--
-- 대상: 아래 세 조건을 모두 만족하는 행만 — 운영자가 의도적으로 소급 입력한
--       건을 건드리지 않기 위해 최대한 좁힌다.
--         a) 등록일이 테넌트 타임존 기준 접수 날짜와 다르고
--         b) 등록일이 UTC 기준 접수 날짜와 정확히 일치하며 (= 버그로 자동 기록된 값)
--         c) 코드 수정 배포 이전(2026-09-13 KST 이전)에 생성된 행
--
-- 프로덕션 확인(2026-09-12): 4건 (seq 19·20·21·22, 전부 WEB_EXTERNAL,
--   registered 2026-09-11 / 실제 접수 2026-09-12 01:35~01:38 KST).
--
-- Idempotent — 조건 (a) 때문에 재실행 시 0 rows.
-- ============================================================================

UPDATE amb_acm_csl_inquiry i
   SET inq_registered_at =
         (i.created_at AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'))::date
  FROM amb_acm_tenant t
 WHERE t.tnt_ent_id = i.ent_id
   AND i.created_at < TIMESTAMPTZ '2026-09-13 00:00:00+09'
   AND i.inq_registered_at
         <> (i.created_at AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'))::date
   AND i.inq_registered_at = (i.created_at AT TIME ZONE 'UTC')::date;

-- 검증용 (실행 안 됨):
--   SELECT inq_seq_no, inq_registered_at,
--          (created_at AT TIME ZONE 'Asia/Seoul')::date AS kst_date
--     FROM amb_acm_csl_inquiry
--    WHERE inq_registered_at <> (created_at AT TIME ZONE 'Asia/Seoul')::date;
--   → 0 rows 이어야 한다.
