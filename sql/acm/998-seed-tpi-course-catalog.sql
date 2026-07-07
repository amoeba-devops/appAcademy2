-- ============================================================================
-- ACM CSL/CLS — TPI 수업 강좌 마스터 seed  — 2026-07-06
-- Source: /Users/gray/Downloads/수업 카테고리.pdf
-- Related:
--   - docs/analysis/REQ-260706-acm-tpi-course-category-alignment.md
--   - sql/acm/985-acm-csl-pipeline-revision.sql  (§4 amb_acm_csl_course)
--
-- 목적:
--   TPI PDF 기준 수업 강좌를 상담관리(CSL) 강좌 마스터에 초기 반영한다.
--   이 마스터는 등록상담의 `enr_course_id` 와, 향후 CLS `cls_course_id`
--   의 단일 기준 카탈로그로 사용된다.
--
-- 설계 원칙:
--   1) 상세 강좌는 amb_acm_csl_course 에 넣는다
--   2) 국제학교 기타 학교명 / 경시대회 세부 종목은 freetext fallback 유지
--   3) 기존 운영자가 이미 만든 동일 code 행은 절대 덮어쓰지 않는다
--
-- ⚠️ ent_id 주의 (TPI 함정):
--   ACM 내부 운영 테넌트는 00000000-0000-0000-0000-000000000001 이다.
--   AMA entityId 와 다르며, 런타임 JWT(u.entId) / OwnEntityGuard 는 이 내부
--   ent_id 를 기준으로 동작한다.
--
-- Idempotent:
--   (ent_id, crs_code) unique 기준 ON CONFLICT DO NOTHING
--
-- 비고:
--   - `경시대회` 는 종류가 많아 본 seed 에 일반 row 를 강제하지 않는다.
--     운영 입력 시 `enr_course_freetext` 를 사용한다.
--   - 국제학교/외국인학교도 seed 목록 외 학교는 `enr_course_freetext` 사용.
-- ============================================================================

BEGIN;

INSERT INTO amb_acm_csl_course (
  ent_id,
  crs_code,
  crs_name,
  crs_is_active
)
VALUES
  -- 1) MAP Test
  ('00000000-0000-0000-0000-000000000001', 'MAP-READING', 'MAP Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'MAP-LANGUAGE_USAGE', 'MAP Language Usage', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'MAP-MATH', 'MAP Math', TRUE),

  -- 2) ISEE
  ('00000000-0000-0000-0000-000000000001', 'ISEE-READING', 'ISEE Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ISEE-VERBAL', 'ISEE Verbal', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ISEE-MATH', 'ISEE Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ISEE-ESSAY', 'ISEE Essay', TRUE),

  -- 2) SSAT
  ('00000000-0000-0000-0000-000000000001', 'SSAT-READING', 'SSAT Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'SSAT-VERBAL', 'SSAT Verbal', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'SSAT-MATH', 'SSAT Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'SSAT-ESSAY', 'SSAT Essay', TRUE),

  -- 3) Duolingo / TOEFL / IELTS
  ('00000000-0000-0000-0000-000000000001', 'DUOLINGO-PACKAGE', 'Duolingo Package', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'TOEFL-PACKAGE', 'TOEFL Package', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'IELTS-PACKAGE', 'IELTS Package', TRUE),

  -- 4) PSAT / SAT
  ('00000000-0000-0000-0000-000000000001', 'PSAT89-READING_WRITING', 'PSAT 8/9 Reading & Writing', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PSAT89-MATH', 'PSAT 8/9 Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PSAT10-READING_WRITING', 'PSAT 10 Reading & Writing', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PSAT10-MATH', 'PSAT 10 Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PSATNMSQT-READING_WRITING', 'PSAT/NMSQT Reading & Writing', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PSATNMSQT-MATH', 'PSAT/NMSQT Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'SAT-READING_WRITING', 'SAT Reading & Writing', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'SAT-MATH', 'SAT Math', TRUE),

  -- 5) PreACT / ACT
  ('00000000-0000-0000-0000-000000000001', 'PREACT89-ENGLISH', 'PreACT 8/9 English', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT89-MATH', 'PreACT 8/9 Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT89-READING', 'PreACT 8/9 Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT89-SCIENCE', 'PreACT 8/9 Science', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT-ENGLISH', 'PreACT English', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT-MATH', 'PreACT Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT-READING', 'PreACT Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'PREACT-SCIENCE', 'PreACT Science', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ACT-ENGLISH', 'ACT English', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ACT-MATH', 'ACT Math', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ACT-READING', 'ACT Reading', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'ACT-SCIENCE', 'ACT Science', TRUE),

  -- 6) 국제학교 / 외국인학교 입시
  ('00000000-0000-0000-0000-000000000001', 'INTL-KIS_JEJU', '국제학교 입시 - KIS Jeju', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'INTL-NLCS', '국제학교 입시 - NLCS', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'INTL-SJA', '국제학교 입시 - SJA', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'INTL-BHA', '국제학교 입시 - BHA', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'INTL-KIS_PANGYO', '국제학교 입시 - KIS 판교', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'INTL-YISS', '국제학교 입시 - YISS', TRUE)
ON CONFLICT (ent_id, crs_code) DO NOTHING;

COMMIT;
