-- 1068 — REQ-261114B: 상담 4단계 '수업 시작일'을 연결된 학생의 수업 시작일로 보정.
-- 자동 등록이 상담 수업 시작일 대신 등록일을 넣어 왔다(운영 2026-11-14 기준 2명).
-- 대상: 상담과 연결된 재원 학생 중 상담 수업 시작일이 있고 학생 값과 다른 경우.
-- 입학일(std_admission_date)은 관리자 입력이라 건드리지 않는다.
-- 학생 날짜 트리거(acm_ops_master_dates)가 운영 기간 행을 함께 고치며, 거절되는 행은
-- 건너뛴다(NOTICE). 멱등: 맞춰진 행은 다시 대상이 되지 않는다.
DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    -- 한 학생에 상담이 여럿이면 가장 최근 상담 기준(재적용해도 값이 오가지 않게).
    SELECT * FROM (
    SELECT DISTINCT ON (s.std_id) s.ent_id, s.std_id, s.std_start_date, e.enr_start_date
      FROM amb_acm_csl_inquiry i
      JOIN amb_acm_std_student s ON s.ent_id=i.ent_id AND s.std_id=i.inq_std_id
      JOIN amb_acm_csl_enrollment e ON e.ent_id=i.ent_id AND e.inq_id=i.inq_id
     WHERE s.deleted_at IS NULL AND s.std_status='ACTIVE'
       AND e.enr_start_date IS NOT NULL
     ORDER BY s.std_id, i.created_at DESC
    ) latest WHERE latest.std_start_date IS DISTINCT FROM latest.enr_start_date
  LOOP
    BEGIN
      UPDATE amb_acm_std_student SET std_start_date=r.enr_start_date
       WHERE ent_id=r.ent_id AND std_id=r.std_id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '1068 skip std %: %', r.std_id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '1068 start dates synced: %', n;
END $$;
