-- REQ-261111 — 상담 단계 수업 시간 직접 입력(10분 단위·09시 이전 등) 허용.
-- 985 에서 추가한 30분 단위 CHECK 2개를 제거한다(멱등). 985 파일 자체는 수정하지 않는다.
ALTER TABLE amb_acm_csl_map_test     DROP CONSTRAINT IF EXISTS chk_acm_csl_mpt_time_30min;
ALTER TABLE amb_acm_csl_trial_class  DROP CONSTRAINT IF EXISTS chk_acm_csl_tcl_time_30min;
