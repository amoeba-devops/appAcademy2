-- REQ-261119 FR-8 — 반복 수업 회차 시각 보정 (+9시간 저장 → 한국시간).
--
-- session.service generateSessions 가 서버 로컬(UTC) setHours 로 시각을 만들어
-- 규칙 '월 15:00' 회차가 '화 00:00(KST)' 으로 저장됐다 (2026-11-19 운영 53건, 전부 SCHEDULED).
-- 대상: 같은 수업의 반복 규칙과 비교해 KST 요일 = 규칙 요일(+9h 로 날짜가 넘어가면 +1), KST 시각 = 규칙 시각+9h 인
--       회차 중 진행·취소 전(SCHEDULED, held_at 없음)이고, 보정 시각에 이미 회차가 없는 것.
-- 멱등: 보정 후에는 조건에 맞지 않아 다시 적용해도 0건.
-- 빈 DB(테이블 없음)에서도 통과.

DO $$
DECLARE
  n int;
BEGIN
  IF to_regclass('amb_acm_cls_sessions') IS NULL OR to_regclass('amb_acm_cls_recurrence') IS NULL THEN
    RETURN;
  END IF;

  UPDATE amb_acm_cls_sessions s
     SET ses_scheduled_at = s.ses_scheduled_at - interval '9 hours',
         ses_updated_at = now()
   WHERE s.ses_status = 'SCHEDULED'
     AND s.ses_held_at IS NULL
     AND s.ses_deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM amb_acm_cls_recurrence r
        WHERE r.cls_id = s.cls_id AND r.ent_id = s.ent_id
          AND (s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul')::time = (r.rec_start_time + interval '9 hours')::time
          AND extract(dow FROM (s.ses_scheduled_at AT TIME ZONE 'Asia/Seoul'))::int =
              (CASE r.rec_day_of_week WHEN 'SUN' THEN 0 WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
                                      WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5 ELSE 6 END
               + CASE WHEN r.rec_start_time >= time '15:00' THEN 1 ELSE 0 END) % 7)
     AND NOT EXISTS (
       SELECT 1 FROM amb_acm_cls_sessions o
        WHERE o.cls_id = s.cls_id AND o.ent_id = s.ent_id AND o.ses_deleted_at IS NULL
          AND o.ses_scheduled_at = s.ses_scheduled_at - interval '9 hours');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '1069 cls sessions shifted -9h: %', n;
END $$;
