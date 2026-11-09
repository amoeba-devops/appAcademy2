-- REQ-261110 — 대시보드 Scheduled(CS) 'Apply/지원' 지표 이름을 'Map Test/맵테스트'로 변경.
-- cs_apply 는 FIX-261026 이후 맵테스트 문의(inq_kind='MAP_TEST') 건수를 집계한다. 라벨만 변경(멱등).
UPDATE amb_acm_dsh_metric_definitions
   SET met_label_kr = '맵테스트', met_label_en = 'Map Test'
 WHERE met_code = 'cs_apply'
   AND (met_label_kr <> '맵테스트' OR met_label_en <> 'Map Test');
