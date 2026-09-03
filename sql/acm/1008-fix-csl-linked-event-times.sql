-- 1008 — REQ-260903F: CSL 연동 캘린더 일정 시각 복구.
-- 링커가 naive 문자열을 서버 TZ(UTC)로 해석해 저장한 이벤트들을
-- CSL 원본(held_at/held_time, scheduled_at/scheduled_time) 기준으로
-- 테넌트 타임존 벽시계 → UTC 재계산한다. 원본 기준 재계산이므로 멱등.

-- 데모수업 연동 이벤트
UPDATE amb_acm_cal_event e
   SET evt_start_at = (tc.tcl_held_at + tc.tcl_held_time)
                        AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'),
       evt_end_at   = (tc.tcl_held_at + tc.tcl_held_time)
                        AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul')
                        + interval '1 hour',
       updated_at   = NOW()
  FROM amb_acm_csl_trial_class tc
  LEFT JOIN amb_acm_tenant t ON t.tnt_ent_id = tc.ent_id
 WHERE tc.tcl_cal_event_id = e.evt_id
   AND tc.tcl_held_at IS NOT NULL
   AND tc.tcl_held_time IS NOT NULL
   AND e.deleted_at IS NULL
   AND e.evt_start_at IS DISTINCT FROM
       ((tc.tcl_held_at + tc.tcl_held_time)
         AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'));

-- 레벨테스트 연동 이벤트
UPDATE amb_acm_cal_event e
   SET evt_start_at = (mt.mpt_scheduled_at + mt.mpt_scheduled_time)
                        AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'),
       evt_end_at   = (mt.mpt_scheduled_at + mt.mpt_scheduled_time)
                        AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul')
                        + interval '1 hour',
       updated_at   = NOW()
  FROM amb_acm_csl_map_test mt
  LEFT JOIN amb_acm_tenant t ON t.tnt_ent_id = mt.ent_id
 WHERE mt.mpt_cal_event_id = e.evt_id
   AND mt.mpt_scheduled_at IS NOT NULL
   AND mt.mpt_scheduled_time IS NOT NULL
   AND e.deleted_at IS NULL
   AND e.evt_start_at IS DISTINCT FROM
       ((mt.mpt_scheduled_at + mt.mpt_scheduled_time)
         AT TIME ZONE COALESCE(t.tnt_timezone, 'Asia/Seoul'));
