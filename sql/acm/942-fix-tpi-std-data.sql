-- ============================================================================
-- 942 — ACM STD 데이터 기계적 정비 (REQ-260622 / PLN-260622 Phase 0+1)
-- @see docs/analysis/REQ-260622-acm-std-data-correction.md
--
--   대상: 941 시드 잔존 이슈 중 무판단·기계적 교정만
--     · DQ-1  std_phone 오염 (SNS 핸들·부가정보) — 실번호 보존, 나머지 노트 이전
--     · DQ-2  비학생 garbage row soft-delete ('Santa Croce')
--     · DQ-9  커리큘럼·교재 텍스트 정규화 (trim + 연속 빈줄 축약)  ※ cosmetic
--
--   판단 교정(DQ-3 종료사유·DQ-4 강사·DQ-5 학부모·DQ-6 동명이인 등)은
--   운영자 정비 큐 UI 후속(Phase 2~3) — 본 스크립트 범위 아님.
--
--   특성: 멱등(재실행 무해) · 무손실(원문은 노트/백업 보존) · 단일 트랜잭션.
--   선행: 940 → 941 적용 완료.  실행 전 백업은 본 스크립트 상단에서 자동 생성.
--   실행: psql "$ACM_DSN" -v ON_ERROR_STOP=1 -f sql/acm/942-fix-tpi-std-data.sql
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- ----------------------------------------------------------------------------
-- 0. 백업 — 최초 1회 스냅샷 (재실행 시 기존 백업 보존 = 정비 前 상태 유지)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amb_acm_std_student_bak_260622 AS
  TABLE amb_acm_std_student;

DO $$
DECLARE n integer;
BEGIN
  -- --------------------------------------------------------------------------
  -- DQ-1a. 혼합값 — 첫 줄이 전화패턴이면 실번호 보존, 줄바꿈 이후는 노트로 분리
  --        예: '010-4811-8297\ngracelee83' → phone '010-4811-8297' + note 'gracelee83'
  -- --------------------------------------------------------------------------
  UPDATE amb_acm_std_student s
  SET std_phone = btrim(split_part(s.std_phone, E'\n', 1)),
      std_special_note = CONCAT(
        '[연락처비고: ', btrim(regexp_replace(s.std_phone, '^[^\n]*\n', '')), ']',
        CASE WHEN s.std_special_note IS NULL OR s.std_special_note = ''
             THEN '' ELSE E'\n' || s.std_special_note END),
      updated_at = NOW()
  WHERE s.deleted_at IS NULL
    AND s.std_phone ~ E'\n'                                       -- 줄바꿈 포함
    AND split_part(s.std_phone, E'\n', 1) ~ '^[+0-9][0-9()\-\s]{5,}$';  -- 첫 줄 = 전화
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'DQ-1a 혼합 전화 분리 보존: % 행', n;

  -- --------------------------------------------------------------------------
  -- DQ-1b. 비전화값 — 첫 줄조차 전화가 아니면 전체를 노트로 이전 후 NULL
  --        예: 'aprilchoi99' / '카카오톡 QR code' / 'milano112900' / 'petitemamang'
  -- --------------------------------------------------------------------------
  UPDATE amb_acm_std_student s
  SET std_special_note = CONCAT(
        '[연락처원문: ', s.std_phone, ']',
        CASE WHEN s.std_special_note IS NULL OR s.std_special_note = ''
             THEN '' ELSE E'\n' || s.std_special_note END),
      std_phone = NULL,
      updated_at = NOW()
  WHERE s.deleted_at IS NULL
    AND s.std_phone IS NOT NULL
    AND split_part(s.std_phone, E'\n', 1) !~ '^[+0-9][0-9()\-\s]{5,}$';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'DQ-1b 비전화 연락처 노트 이전: % 행', n;

  -- --------------------------------------------------------------------------
  -- DQ-2. 비학생 garbage row soft-delete (화이트리스트 — §13 Q6 확정 후 확장)
  --        'Santa Croce' = 테넌트 라벨이 학생으로 적재된 행. 물리 삭제 금지.
  -- --------------------------------------------------------------------------
  UPDATE amb_acm_std_student
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE deleted_at IS NULL
    AND std_name IN ('Santa Croce');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'DQ-2 garbage row soft-delete: % 행', n;

  -- --------------------------------------------------------------------------
  -- DQ-9. 텍스트 정규화 (cosmetic) — 앞뒤 공백 trim + 3+ 연속 빈줄 → 1 빈줄
  --        값이 실제로 바뀌는 행만(멱등). 원문은 백업 테이블에 보존.
  -- --------------------------------------------------------------------------
  UPDATE amb_acm_std_student
  SET std_curriculum = regexp_replace(btrim(std_curriculum), E'\n{3,}', E'\n\n', 'g'),
      updated_at = NOW()
  WHERE deleted_at IS NULL AND std_curriculum IS NOT NULL
    AND std_curriculum <> regexp_replace(btrim(std_curriculum), E'\n{3,}', E'\n\n', 'g');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'DQ-9 커리큘럼 정규화: % 행', n;

  UPDATE amb_acm_std_student
  SET std_materials = regexp_replace(btrim(std_materials), E'\n{3,}', E'\n\n', 'g'),
      updated_at = NOW()
  WHERE deleted_at IS NULL AND std_materials IS NOT NULL
    AND std_materials <> regexp_replace(btrim(std_materials), E'\n{3,}', E'\n\n', 'g');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'DQ-9 교재 정규화: % 행', n;
END $$;

COMMIT;

-- ============================================================================
-- 검증 권장: 정비 후 sql/acm/diag/scan-std-dq.sql 재실행 → DQ-1·2 = 0 확인.
-- 롤백 필요 시: amb_acm_std_student_bak_260622 에서 복원.
-- End of 942
-- ============================================================================
