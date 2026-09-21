---
document_id: CSL-PLN-260921B
version: 1.0.0
status: IMPLEMENTED (PR 대기) — 학교 필수 해제·성별 포함
date: 2026-09-21
depends_on: docs/analysis/REQ-260921B-csl-intake-grade-birthdate-kind.md
change_log:
  - 2026-09-21 v1.0.0 구현 완료 — SQL 1016, 백엔드(구분·생년월일·성별·학교 선택·부속 행 반영), 프론트(폼·목록·상세·인라인 편집), i18n 4 locale (Claude Code)
  - 2026-09-21 v0.1.0 초안 (Claude Code)
---

# PLN-260921B — 상담 등록 개선 구현 계획 / Implementation Plan

## 1. Data Model (`sql/acm/1016-csl-inquiry-kind-birthdate-gender.sql`, 멱등) — 구현본은 파일 참조 (성별 `inq_gender`·map_apply origin `CONSOLE` 추가)

```sql
ALTER TABLE amb_acm_csl_inquiry
  ADD COLUMN IF NOT EXISTS inq_kind      VARCHAR(20) NOT NULL DEFAULT 'TUTORING',
  ADD COLUMN IF NOT EXISTS inq_birthdate DATE;
ALTER TABLE amb_acm_csl_inquiry ALTER COLUMN grade TYPE VARCHAR(40);     -- I-1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chk_acm_csl_inq_kind') THEN
    ALTER TABLE amb_acm_csl_inquiry ADD CONSTRAINT chk_acm_csl_inq_kind
      CHECK (inq_kind IN ('TUTORING','MAP_TEST'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_acm_csl_inq_kind ON amb_acm_csl_inquiry (ent_id, inq_kind);

-- 백필 (T-4) — 멱등: 이미 MAP_TEST 인 행은 건드리지 않는다
UPDATE amb_acm_csl_inquiry i SET inq_kind='MAP_TEST'
 WHERE i.inq_kind='TUTORING'
   AND (i.inq_apply_type='EXAM_ONLY'
        OR EXISTS (SELECT 1 FROM amb_acm_csl_map_apply m WHERE m.inq_id=i.inq_id));
UPDATE amb_acm_csl_inquiry i SET inq_birthdate=m.mpa_birthdate
  FROM amb_acm_csl_map_apply m
 WHERE m.inq_id=i.inq_id AND i.inq_birthdate IS NULL AND m.mpa_birthdate IS NOT NULL;
```

## 2. Backend

| # | 작업 | 파일 |
|---|---|---|
| B-1 | 엔티티 `kind`, `birthdate` 추가, `grade` 길이 주석 갱신 | `inquiry.typeorm-entity.ts` |
| B-2 | `CreateInquiryDto`/`UpdateInquiryDto`: `kind`(enum, 기본 TUTORING), `birthdate`(ISO date), `grade` `@MaxLength(40)`. 외부 접수·맵테스트 접수 DTO 의 `grade` 상한도 40 | `dto/inquiry.dto.ts`, `dto/external-intake.dto.ts`, `dto/map-apply.dto.ts` |
| B-3 | `InquiryService.create/update/list/detail/csv`: 필드 저장·노출, 목록 필터 `kind`. 구분=MAP_TEST + 부속 행 없음 → `MapApplyService` 로 부속 행 생성(생년월일 동기화) (T-5) | `inquiry.service.ts`, `map-apply.service.ts` |
| B-4 | 웹 접수: `/test2` → `kind='MAP_TEST'` + `inq_birthdate`, `/contact2` → `TUTORING` | `map-apply.service.ts`, `external-intake.controller.ts` |
| B-5 | `/admin/test` 상세에서 생년월일 수정 시 본체 `inq_birthdate` 도 갱신 (양방향 일치) | `map-apply.service.ts` |
| B-6 | 수강 등록 자동 학생 생성에 `birthDate ← inq.birthdate` (T-6) | `csl-enrollment-registration.service.ts` |
| B-7 | 단위 테스트 — `MapApplyService.reflectInquiry` (부속 행 생성·동기) | `map-apply.service.spec.ts` |
| B-8 | **학교 필수 해제** — `InquiryService.create` 의 C-105 검사 제거 | `inquiry.service.ts` |
| B-9 | **성별** — `inq_gender` 저장·노출, 웹/이관 접수·부속 행·학생 등록 연계 | 위 파일들 |

## 3. Frontend (`frontend-acm`)

| # | 작업 | 파일 |
|---|---|---|
| F-1 | 신규 상담 다이얼로그: 최상단 **구분 라디오**(튜터링 상담 / 맵테스트), 학년 `Input`(자유 텍스트, 40자), **생년월일** `type=date` + **성별** 셀렉트, **학교 필수 해제**. 구분=맵테스트면 신청 유형 자동 `시험만`(Q-1 A), 생년월일 필수(Q-2) | `csl-create-dialog.tsx` |
| F-2 | 목록: 구분 배지 열(학생명 옆), 필터에 구분 셀렉트, 생년월일 열(선택 표시) | `csl-list-page.tsx`, `csl-list-filters.tsx` |
| F-3 | 상세: 헤더 구분 배지 + 생년월일·성별, 인테이크 패널에 구분·생년월일(성별) Row, **[기본정보 수정]** 인라인 편집(구분·학교·학년·생년월일·성별)(Q-3) | `csl-detail-page.tsx`, `intake-stage-panel.tsx` (`BasicInfoEditor`) |
| F-4 | 학년 표시 헬퍼 `formatGrade(value)` — 코드면 라벨, 아니면 원문 (목록·상세·편집 초기값 공용) | `modules/csl/lib/grade.ts` (신규) |
| F-5 | i18n `csl.kind.TUTORING/MAP_TEST`, `form.kind`, `form.birthdate`, `form.gradePlaceholder`, `validation.birthdateRequiredForMapTest` — ko/en/vi/zh-CN | `i18n/locales/*/csl.json` |

## 4. UI 구성안 (화면 목업)

### 4.1 신규 상담 등록 다이얼로그

```
┌──────────────── 신규 상담 등록 ─────────────────┐
│ 구분 *   (●) 튜터링 상담    ( ) 맵테스트         │  ← 신규(라디오)
│                                                  │
│ 학생 이름 *                        □ 익명       │
│ [                                   ]            │
│ 생년월일                       성별              │  ← 신규 (맵테스트면 생년월일 *)
│ [ 2012-03-14        📅 ]       [ 남 ▾ ]          │
│ 학부모 이메일                                    │
│ [                                   ]            │
│ 학부모 연락처            연락처 상태             │
│ [               ]        [ 제공 ▾ ]              │
│ 학부모 이름                                      │
│ [                                   ]            │
│ 학교 (선택)                     학년             │  ← 필수 해제
│ [                   ]           [ 예: 중2, G10 ] │  ← 셀렉트 → input
│ 유입 경로 *              신청 유형 *             │
│ [ 홈페이지 ▾ ]           [ 상담만 ▾ ]            │  ← 맵테스트 선택 시 '시험만' 자동
│ 신청 목적                                        │
│ □ MAP TEST 튜터링  □ ISEE 튜터링  □ 국제학교 준비 │
│ 상담 완료   접수일        후속 조치일            │
│ [ — ▾ ]     [ 날짜 ]      [ 날짜 ]               │
│ 메모                                             │
│ [                                              ] │
│                          [취소]  [등록]          │
└──────────────────────────────────────────────────┘
```

### 4.2 상담 목록 (`/admin/csl`)

```
필터: [단계 ▾] [사이트 ▾] [구분: 전체 ▾]  ← 신규    [🔍 검색]
┌──────────┬────────────────┬──────┬────────────┬──────────┬────────┬───────┐
│ 접수일   │ 학생           │ 학년 │ 생년월일   │ 연락처   │ 사이트 │ 단계  │
├──────────┼────────────────┼──────┼────────────┼──────────┼────────┼───────┤
│ 09-21    │ 김민  [맵테스트]│ G10  │ 2012-03-14 │ 010-…    │ TPI    │ 접수  │
│ 09-20    │ 이수  [튜터링] │ 중2  │ —          │ 010-…    │ TRINITY│ 상담  │
└──────────┴────────────────┴──────┴────────────┴──────────┴────────┴───────┘
```

배지 색: 맵테스트 = violet, 튜터링 = gray.

### 4.3 상담 상세 헤더

```
김민  [맵테스트]  [TPI]  단계: 접수
학년 G10 · 생년월일 2012-03-14 · 연락처 010-…        [/admin/test 상세 →]  ← 맵테스트일 때
```

## 5. Verification (검증)

| 확인 | 결과 |
|---|---|
| backend `tsc` · eslint(0 error) · jest acm-csl | ✅ 103 pass (+reflectInquiry 2) |
| frontend-acm `tsc` · `vite build` | ✅ |
| SQL 1016 로컬 적용 | (아래 결과) |

- backend `tsc`·jest·eslint / frontend `tsc`·build
- 로컬 `sql/acm/1016` 수동 적용(로컬만; staging/prod 는 CD 자동)
- 프로덕션 배포 후: 71건 구분 백필(맵테스트 67·튜터링 4), 생년월일 67건 채움, 신규 상담 등록 3경로(콘솔 튜터링·콘솔 맵테스트·웹) 확인

## 6. Out of Scope (범위 외)

- 맵테스트 전용 항목(영문이름·성별·응시지·희망시간)의 콘솔 폼 입력 (Q-4) · 대시보드 KPI 의 구분별 집계 · 학년 값 정규화(자유 텍스트 유지)
