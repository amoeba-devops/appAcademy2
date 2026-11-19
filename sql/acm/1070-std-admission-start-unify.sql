-- 1070 — REQ-261119B: 입학일 = 수업 시작일. 두 값이 다르면 빠른 날로, 한쪽만 있으면 그 값으로 통일.
-- 운영 2026-11-19 기준 32명(재원 26·퇴원 5·비활성 1), 이 중 수업 시작일이 앞당겨지는 학생 10명.
-- 학생 날짜 트리거(acm_ops_master_dates)가 운영 기간 행을 함께 고치며, 거절되는 행은
-- 건너뛴다(NOTICE). 멱등: 맞춰진 행은 다시 대상이 되지 않는다. 소프트 삭제 학생은 제외.
DO $$
DECLARE r record; n integer := 0; v date;
BEGIN
  IF to_regclass('amb_acm_std_student') IS NULL THEN RETURN; END IF;
  FOR r IN
    SELECT ent_id, std_id, std_admission_date, std_start_date
      FROM amb_acm_std_student
     WHERE deleted_at IS NULL
       AND std_admission_date IS DISTINCT FROM std_start_date
  LOOP
    v := COALESCE(LEAST(r.std_admission_date, r.std_start_date), r.std_admission_date, r.std_start_date);
    BEGIN
      UPDATE amb_acm_std_student SET std_admission_date=v, std_start_date=v
       WHERE ent_id=r.ent_id AND std_id=r.std_id;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '1070 skip std %: %', r.std_id, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '1070 admission/start unified: %', n;
END $$;

-- 대시보드 운영 기간 편집이 학생 수업 시작일을 바꿀 때 입학일도 같이 (999zz 함수 재정의).
CREATE OR REPLACE FUNCTION acm_std_period_to_master() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE master_start date; matches integer; active_count integer;
BEGIN
 IF NEW.kind<>'STUDENT' OR pg_trigger_depth()>1 OR OLD.cancelled OR NEW.cancelled THEN RETURN NEW; END IF;
 IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date THEN RETURN NEW; END IF;
 SELECT std_start_date INTO master_start FROM amb_acm_std_student
  WHERE ent_id=NEW.ent_id AND std_id=NEW.subject_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT count(*) FILTER (WHERE start_date IS NOT DISTINCT FROM master_start),count(*) INTO matches,active_count
  FROM amb_acm_dsh_operating_period WHERE ent_id=NEW.ent_id AND kind='STUDENT' AND subject_id=NEW.subject_id AND NOT cancelled;
 IF (matches=1 AND OLD.start_date IS NOT DISTINCT FROM master_start) OR (matches=0 AND active_count=1) THEN
  UPDATE amb_acm_std_student SET std_start_date=NEW.start_date,std_admission_date=NEW.start_date,std_end_date=NEW.end_date
   WHERE ent_id=NEW.ent_id AND std_id=NEW.subject_id;
 END IF;
 RETURN NEW;
END $$;
