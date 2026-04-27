-- AUTO-GENERATED — Seed SCH school master
-- Source: docs/reference/[TPI] Master.xlsx › 학교입학 정보
-- Rows: 18
-- Idempotent: skips if any school already exists for the demo ent_id

BEGIN;
DO $$
DECLARE v_ent_id UUID;
BEGIN
  v_ent_id := '00000000-0000-0000-0000-000000000001'::uuid;
  IF EXISTS (SELECT 1 FROM amb_acm_sch_school WHERE ent_id = v_ent_id) THEN
    RAISE NOTICE 'SCH seed skipped — schools already exist for ent_id %', v_ent_id;
    RETURN;
  END IF;
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'BIS International School (BIS 국제학교)', 'FOREIGN', '분당', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'British Columbia Collegiate (BCC 국제학교)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'British Education Korea (BEK Prep)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'CSIS (Christian School International)', 'FOREIGN', '용인', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Cornerstone Collegiate Academy of Seoul (코너스톤 서울)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Fayston Christian School (페이스튼 크리스천 스쿨)', 'FOREIGN', '용인', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Gangnam International School (GIS)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'SALT International School (솔트 국제학교)', 'FOREIGN', '분당', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Saint Paul Preparatory Seoul (세인트폴 서울)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Seoul Scholars International (SSI)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, 'Vivian & Stanley International School (비비안앤스탠리)', 'FOREIGN', '서울 강남, 서초', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '대구국제학교 (DIS)', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '송도 CMIS', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '송도 Chadwick International', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '제주 BHA', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '제주 KIS', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '제주 NLCS', 'FOREIGN', '제주/국제', TRUE);
  INSERT INTO amb_acm_sch_school (ent_id, name, level, region, is_foreign) VALUES (v_ent_id, '제주 SJA', 'FOREIGN', '제주/국제', TRUE);
END$$;
COMMIT;
