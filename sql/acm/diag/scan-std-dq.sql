-- ============================================================================
-- scan-std-dq.sql — ACM 학생 데이터 품질 스캔 (READ-ONLY)
-- @see docs/analysis/REQ-260622-acm-std-data-correction.md  (DQ-1~10)
--
-- 부수효과 없음. 942 정비 전/후 베이스라인 카운트 측정용.
--   psql "$ACM_DSN" -f sql/acm/diag/scan-std-dq.sql
-- ============================================================================

\echo '== ACM STD Data-Quality scan =='

SELECT dq, scope, cnt FROM (
  -- DQ-1: std_phone 오염 (첫 줄이 전화패턴 아님 OR 줄바꿈으로 부가정보 혼입)
  SELECT 'DQ-1 phone-contaminated' AS dq, ent_id::text AS scope, COUNT(*) AS cnt, 1 AS ord
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_phone IS NOT NULL
    AND ( std_phone ~ E'\n'
          OR split_part(std_phone, E'\n', 1) !~ '^[+0-9][0-9()\-\s]{5,}$' )
  GROUP BY ent_id

  UNION ALL
  -- DQ-2: 비학생 garbage row (화이트리스트)
  SELECT 'DQ-2 garbage-row', ent_id::text, COUNT(*), 2
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_name IN ('Santa Croce')
  GROUP BY ent_id

  UNION ALL
  -- DQ-3: 종료사유 미분류 (OTHER)
  SELECT 'DQ-3 end-reason-OTHER', ent_id::text, COUNT(*), 3
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_end_reason = 'OTHER'
  GROUP BY ent_id

  UNION ALL
  -- DQ-4: 강사 free-text 있으나 FK 미매핑
  SELECT 'DQ-4 teacher-unmapped', ent_id::text, COUNT(*), 4
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_teacher IS NOT NULL AND std_teacher_id IS NULL
  GROUP BY ent_id

  UNION ALL
  -- DQ-5: 학부모 미연결 학생
  SELECT 'DQ-5 no-parent', s.ent_id::text, COUNT(*), 5
  FROM amb_acm_std_student s
  WHERE s.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM amb_acm_std_student_parent sp WHERE sp.std_id = s.std_id
    )
  GROUP BY s.ent_id

  UNION ALL
  -- DQ-7: legacy archive 행
  SELECT 'DQ-7 legacy-archive', ent_id::text, COUNT(*), 7
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_end_note LIKE '구 학생 정보 (legacy archive%'
  GROUP BY ent_id

  UNION ALL
  -- DQ-8: WITHDRAWN 인데 종료일 결손 (940 불변식 위반)
  SELECT 'DQ-8 withdrawn-no-enddate', ent_id::text, COUNT(*), 8
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND std_status = 'WITHDRAWN' AND std_end_date IS NULL
  GROUP BY ent_id

  UNION ALL
  -- DQ-9: 텍스트 정규화 필요 (trim/연속빈줄) — 커리큘럼·교재
  SELECT 'DQ-9 text-needs-trim', ent_id::text, COUNT(*), 9
  FROM amb_acm_std_student
  WHERE deleted_at IS NULL AND (
        (std_curriculum IS NOT NULL
           AND std_curriculum <> regexp_replace(btrim(std_curriculum), E'\n{3,}', E'\n\n', 'g'))
     OR (std_materials  IS NOT NULL
           AND std_materials  <> regexp_replace(btrim(std_materials),  E'\n{3,}', E'\n\n', 'g'))
  )
  GROUP BY ent_id
) q
ORDER BY ord, scope;

-- DQ-6(동명이인) / DQ-10(테넌트 배정) 은 (ent_id, std_name) UPSERT 머지 후라
-- 자동 카운트가 부정확 → 운영자 수동 검토 대상(정비 큐 UI). 본 스캔에서는 제외.
\echo '== DQ-6(동명이인)·DQ-10(테넌트)은 수동 검토 — 스캔 제외 =='
