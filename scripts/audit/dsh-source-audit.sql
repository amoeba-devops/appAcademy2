\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '20s';
SELECT 'clock' AS section, now(), current_setting('TimeZone'), (now() AT TIME ZONE 'Asia/Seoul')::date AS kst_today;
SELECT 'students' AS section, ent_id, std_status, COALESCE(std_site,'COMMON') AS site, COUNT(*) AS total,
 COUNT(*) FILTER (WHERE std_admission_date IS NULL) AS missing_admission,
 COUNT(*) FILTER (WHERE std_status='WITHDRAWN' AND std_withdrawn_date IS NULL) AS missing_withdrawal,
 COUNT(*) FILTER (WHERE std_admission_date > std_withdrawn_date) AS invalid_dates
 FROM amb_acm_std_student WHERE deleted_at IS NULL GROUP BY 2,3,4 ORDER BY 2,3,4;
SELECT 'teachers' AS section, ent_id,tch_status,tch_is_instructor,COUNT(*) AS total,
 COUNT(*) FILTER(WHERE tch_hired_at IS NULL) AS missing_hired
 FROM amb_acm_tch_teacher WHERE deleted_at IS NULL GROUP BY 2,3,4;
SELECT 'assignments' AS section,l.ent_id,COUNT(*) AS links,COUNT(DISTINCT s.std_id) AS students,COUNT(DISTINCT t.tch_id) AS teachers
 FROM amb_acm_std_student_teacher l
 JOIN amb_acm_std_student s ON s.std_id=l.std_id AND s.ent_id=l.ent_id
 JOIN amb_acm_tch_teacher t ON t.tch_id=l.tch_id AND t.ent_id=l.ent_id
 WHERE s.deleted_at IS NULL AND t.deleted_at IS NULL AND s.std_status='ACTIVE' AND t.tch_status='ACTIVE' AND t.tch_is_instructor
 GROUP BY 2;
SELECT 'unlinked_teacher_text' AS section, s.ent_id,COUNT(*) FROM amb_acm_std_student s WHERE s.deleted_at IS NULL AND s.std_status='ACTIVE' AND NULLIF(TRIM(s.std_teacher),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM amb_acm_std_student_teacher l WHERE l.ent_id=s.ent_id AND l.std_id=s.std_id) GROUP BY 2;
SELECT 'enrollment' AS section,e.ent_id,COUNT(*) FILTER(WHERE enr_applied) AS applied,COUNT(*) FILTER(WHERE cls_started='YES') AS started,COUNT(*) FILTER(WHERE cls_started='YES' AND cls_started_at IS NULL) AS missing_start FROM amb_acm_csl_enrollment e JOIN amb_acm_csl_inquiry i ON i.inq_id=e.inq_id AND i.ent_id=e.ent_id WHERE i.deleted_at IS NULL GROUP BY 2;
SELECT 'trial' AS section,e.ent_id,tcl_completed,COUNT(*) FROM amb_acm_csl_trial_class e JOIN amb_acm_csl_inquiry i ON i.inq_id=e.inq_id AND i.ent_id=e.ent_id WHERE i.deleted_at IS NULL GROUP BY 2,3;
SELECT 'map' AS section,e.ent_id,mpt_test_type,mpt_scheduled_status,COUNT(*),COUNT(*) FILTER(WHERE mpt_scheduled_at IS NULL) AS missing_date FROM amb_acm_csl_map_test e JOIN amb_acm_csl_inquiry i ON i.inq_id=e.inq_id AND i.ent_id=e.ent_id WHERE i.deleted_at IS NULL GROUP BY 2,3,4;
SELECT 'legacy_kpi' AS section, ent_id,dkp_date,dkp_manually_overridden,dkp_ops_count_st,dkp_ops_count_tc,dkp_last_recompute_reason FROM amb_acm_dsh_daily_kpi WHERE dkp_date IN ('2026-09-11','2026-09-12','2026-09-21','2026-09-22') ORDER BY ent_id,dkp_date;
SELECT 'cls_sessions' AS section,ent_id,ses_status,COUNT(*),SUM(ses_duration_min) AS minutes FROM amb_acm_cls_sessions WHERE ses_deleted_at IS NULL GROUP BY 2,3;
COMMIT;
