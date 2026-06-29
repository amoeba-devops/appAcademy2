-- ============================================================================
-- ACM v1.x — CSL INTAKE prior-scores detail JSONB (DSN-260629)
--
-- DSN-260629 §4.1 — INTAKE 단계의 "이전 점수" 는 운영자가 받은 시점의
-- self-report 성격이고, 2단계 (MAP_TEST) 의 mpt_score_detail (DSN-260626
-- §5.6) 은 정식 결과 입력이라 의미가 다르다. 한 컬럼에 섞이면 PDF 양식
-- (§5.7) 과 STD 승계 (T-19) 로직이 헷갈리기 시작해서 INTAKE 전용 컬럼
-- 으로 분리한다.
--
-- 데이터 shape (operator-facing v1, validator 는 후속):
--   {
--     "iseeIntake":      { verbal: 850, reading: 870, ... },   // 4 영역 Scaled 만
--     "priorAdvanced":   { testName: "SSAT", scores: { ... } } // freetext 1건
--   }
--
-- @see docs/design/DSN-260629-csl-stage-screen-revision.md
-- ============================================================================

ALTER TABLE amb_acm_csl_map_test
  ADD COLUMN IF NOT EXISTS mpt_prior_scores_detail JSONB;

COMMENT ON COLUMN amb_acm_csl_map_test.mpt_prior_scores_detail IS
  'INTAKE 단계 self-report 이전 점수 (ISEE 4 영역 Scaled / SSAT/Duolingo/TOEFL 등 자유입력). 2단계 결과 점수는 mpt_score_detail. DSN-260629 §4.1';
