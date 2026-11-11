-- REQ-261111 — 대시보드 Class 'MAP테스트' 지표 이름을 Scheduled 와 동일하게 '맵테스트/Map Test' 로 통일.
-- 라벨만 변경(멱등).
UPDATE amb_acm_dsh_metric_definitions
   SET met_label_kr = '맵테스트', met_label_en = 'Map Test'
 WHERE met_code = 'cls_map_test'
   AND (met_label_kr <> '맵테스트' OR met_label_en <> 'Map Test');
