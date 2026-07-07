---
document_id: REQ-260706-acm-tpi-course-category-alignment
version: 1.0.0
status: Draft
created: 2026-07-06
product_code: ACM
title: ACM TPI 수업 카테고리 반영 요구사항 분석서
modules:
  - CSL (상담관리)
  - CLS (수업관리)
related:
  - 수업 카테고리.pdf (external source, 2026-07-06)
  - sql/acm/998-seed-tpi-course-catalog.sql
  - backend/src/modules/acm-csl/infrastructure/typeorm/course.typeorm-entity.ts
  - backend/src/modules/acm-csl/infrastructure/typeorm/enrollment.typeorm-entity.ts
  - backend/src/modules/acm-cls/infrastructure/typeorm/class.typeorm-entity.ts
  - frontend-acm/src/modules/csl/components/enrollment-panel.tsx
  - frontend-acm/src/modules/csl/components/class-status-summary-panel.tsx
  - frontend-acm/src/modules/cls/components/class-create-dialog.tsx
  - docs/analysis/REQ-260626-acm-csl-pipeline-revision.md
scope: REQUIREMENTS ANALYSIS ONLY
change_log:
  - { version: 1.0.0, date: 2026-07-06, author: Codex, notes: "TPI 수업 카테고리 PDF 기준으로 상담/수업 모듈 내 강좌 반영 위치와 데이터 구조 갭 분석" }
---

# REQ-260706 — ACM TPI 수업 카테고리 반영 요구사항 분석서

## 1. 개요

TPI 제공 자료 `수업 카테고리.pdf` 기준으로 현재 ACM의 상담관리(CSL)와 수업관리(CLS)에서
"수업강좌" 정보를 어디에 저장하고 어떤 화면에서 사용해야 하는지 분석한다.

이번 분석의 핵심 질문은 다음 3가지다.

1. PDF의 수업 카테고리를 **어느 데이터 구조에 넣는 것이 맞는가**
2. 상담 단계에서 선택한 강좌를 수업 생성 시 **어떻게 이어받아야 하는가**
3. 현재 구현에서 어떤 부분이 이미 준비되어 있고, 어떤 부분이 아직 부족한가

결론부터 말하면:

- **강좌의 원본 마스터**는 `amb_acm_csl_course` 가 맡는 것이 맞다.
- 상담 단계에서 선택된 강좌는 `amb_acm_csl_enrollment.enr_course_id` 가 canonical source 가 되어야 한다.
- 수업 단계에서는 현재 `cls_subject_label` 에 문자열만 저장하고 있어 부족하다.
- 따라서 수업 단계에는 **`cls_course_id` FK 추가**가 필요하다.
- `applyPurpose` 나 `level test type` 에 PDF의 수업 카테고리를 직접 넣는 것은 적합하지 않다.

---

## 2. PDF 원문 요약

PDF `TPI 수업 카테고리` 에서 확인된 분류는 아래와 같다.

1. `MAP Test`
   - Reading
   - Language Usage
   - Math

2. `ISEE, SSAT`
   - Reading
   - Verbal
   - Math
   - Essay

3. `Duolingo, TOEFL, IELTS`
   - 영역 구분 없이 패키지 수업

4. `PSAT 8/9, PSAT 10, PSAT/NMSQT, SAT`
   - Reading & Writing
   - Math

5. `PreACT 8/9, PreACT, ACT`
   - English
   - Math
   - Reading
   - Science

6. `국제학교 / 외국인학교 입시`
   - KIS Jeju
   - NLCS
   - SJA
   - BHA
   - KIS 판교
   - YISS
   - 그 외 학교는 기타 / 수기입력

7. `경시대회`
   - 종류가 많아 수기입력 필요

---

## 3. 현재 시스템 구조 (AS-IS)

## 3.1 상담관리(CSL) 쪽

현재 상담관리에는 이미 "강좌 마스터" 구조가 존재한다.

### 현재 데이터 구조

- 강좌 마스터
  - table: `amb_acm_csl_course`
  - fields: `crs_id`, `crs_code`, `crs_name`, `crs_is_active`

- 상담의 등록상담/결제 전 단계 저장값
  - table: `amb_acm_csl_enrollment`
  - fields:
    - `enr_course_id`
    - `enr_course_freetext`

### 현재 화면 사용 위치

- 상담 상세 `4. 등록 상담`
  - `frontend-acm/src/modules/csl/components/enrollment-panel.tsx`
  - 강좌 선택 드롭다운은 `/acm/csl/courses` 를 조회함
  - 자유입력 필드(`courseFreetext`)도 함께 존재

- 상담 상세 `6. 수강현황`
  - `frontend-acm/src/modules/csl/components/class-status-summary-panel.tsx`
  - 선택된 강좌를 `courseId` 또는 `courseFreetext` 기준으로 표시함

### 판단

상담관리 쪽은 이미 구조가 맞다.

즉, **PDF 수업 카테고리를 가장 먼저 반영해야 하는 위치는 `amb_acm_csl_course`** 이다.

---

## 3.2 수업관리(CLS) 쪽

수업관리에는 현재 두 축이 있다.

### 현재 데이터 구조

- 상위 분류 성격의 enum
  - table: `amb_acm_cls_classes`
  - field: `cls_subject_type`
  - current values:
    - `MAP_TEST`
    - `SSAT`
    - `ISEE`
    - `WRITING`
    - `LANGUAGE_ARTS`
    - `MATH`
    - `INTL_PREP`
    - `DEMO`
    - `OTHER`

- 문자열 라벨
  - field: `cls_subject_label`
  - 자유 문자열 저장

### 현재 화면 사용 위치

- 수업 생성
  - `frontend-acm/src/modules/cls/components/class-create-dialog.tsx`
  - 여기서 `/acm/csl/courses` 를 다시 조회해 "수업 강좌" 드롭다운에 사용함
  - 하지만 저장 시 `courseId` 자체는 보내지 않고
    `subjectLabel: "CODE - NAME"` 문자열만 넣는다

- 수업 목록 / 상세 표시
  - `cls-table.tsx`, `cls-info-card.tsx`, `cls-detail-page.tsx`
  - `subjectLabel` 이 있으면 그것을 보여주고, 없으면 `subjectType` 번역값을 보여준다

### 판단

수업관리 쪽은 **UI는 강좌 마스터를 참조하지만, DB에는 강좌 FK를 저장하지 않는다.**

즉, 현재는:

- 강좌를 선택해도 `courseId` 가 남지 않는다
- 클래스가 어느 마스터 강좌에서 왔는지 추적할 수 없다
- 강좌명 변경 시 기존 수업과 정합성을 맞추기 어렵다
- 강좌별 통계 / 검색 / 리포트가 불안정하다

이 부분이 이번 요구의 가장 큰 구조적 갭이다.

---

## 3.3 이번 PDF 카테고리를 넣으면 안 되는 곳

아래 필드들은 역할이 다르므로 PDF 강좌 카테고리의 원본 저장소가 되면 안 된다.

### 1) `applyPurpose`

위치:

- `CreateInquiryDto.applyPurposes`
- 현재 값:
  - `MAP_TEST_TUTORING`
  - `ISEE_TUTORING`
  - `INTL_SCHOOL_PREP`
  - `GPA_MGMT`
  - `ADVANCED_COURSES`

판단:

- `applyPurpose` 는 리드 유입/상담 목적을 잡는 상위 분류다
- 최종 수업강좌를 정밀하게 표현하는 용도가 아니다
- 특히 `ADVANCED_COURSES` 가 SSAT, TOEFL, SAT, ACT, 경시대회를 한 번에 삼켜 버린다

따라서 **강좌 마스터 대신 `applyPurpose` 를 세분화하는 방식은 비추천** 이다.

### 2) `mpt_test_type` / 레벨테스트 종류

위치:

- `amb_acm_csl_map_test`
- `UpsertMapTestDto.testType`

판단:

- 이 구조는 응시 일정과 결과를 기록하는 "시험" 구조다
- 수업강좌 카탈로그와는 역할이 다르다
- IELTS / SAT / ACT 를 여기로 밀어 넣으면 상담-수업 구조가 섞인다

따라서 **PDF 강좌 카테고리의 canonical place 는 level test type 이 아니다.**

---

## 4. 핵심 결론 — 어디에 넣어야 하는가

## 4.1 원본 마스터

PDF 카테고리는 우선 **`amb_acm_csl_course`** 에 반영해야 한다.

이 테이블이 다음의 단일 원본이 되어야 한다.

- 상담 단계의 강좌 선택
- 수업 생성 시 강좌 선택
- 수업 통계/리포트 기준 강좌
- 향후 정산/매출/전환율의 강좌 축

## 4.2 상담에서의 저장 위치

상담 상세 `4. 등록 상담` 에서 선택한 강좌는 아래에 저장한다.

- 기본:
  - `amb_acm_csl_enrollment.enr_course_id`
- 예외/수기:
  - `amb_acm_csl_enrollment.enr_course_freetext`

예외에 해당하는 경우:

- 국제학교 리스트에 없는 학교
- 경시대회 세부 종목
- 운영 중 새로 생겼지만 마스터에 아직 등록되지 않은 강좌

## 4.3 수업에서의 저장 위치

수업 생성 시에는 상담과 같은 강좌를 **FK로 다시 저장**해야 한다.

권장 구조:

- 신규 컬럼:
  - `amb_acm_cls_classes.cls_course_id UUID NULL`
- 기존 유지:
  - `cls_subject_type` = 상위 분류 / 리포트 축
  - `cls_subject_label` = 스냅샷 표시명

즉 수업 클래스는 아래 3개를 함께 가져야 한다.

1. `cls_course_id`
   - 어떤 강좌 마스터를 선택했는지

2. `cls_subject_type`
   - 빠른 필터 / 집계를 위한 상위 분류

3. `cls_subject_label`
   - 생성 시점 표시명 스냅샷

현재처럼 `subjectLabel` 문자열만 저장하는 방식은 분석/정합성 측면에서 부족하다.

---

## 5. 권장 분류 원칙

이번 PDF 기준으로 데이터는 아래 2단계로 나눠 관리하는 것이 맞다.

### A. 강좌 마스터 = 실제 상품/강좌

예:

- `MAP Reading`
- `ISEE Verbal`
- `SAT Math`
- `ACT Reading`
- `KIS Jeju 입시`

### B. 수업 분류(subjectType) = 상위 보고/필터 축

예:

- `MAP_TEST`
- `ISEE`
- `SSAT`
- `ENGLISH_TEST` 신규
- `SAT` 신규
- `ACT` 신규
- `INTL_PREP`
- `COMPETITION` 신규
- `DEMO`
- `OTHER`

즉:

- **마스터는 상세**
- **subjectType 은 상위 분류**

이렇게 분리해야 화면 선택과 운영 리포트가 동시에 깔끔해진다.

---

## 6. PDF 카테고리별 반영 매핑안

## 6.1 최종 매핑 원칙

| PDF 카테고리 | 강좌 마스터(`amb_acm_csl_course`) | 상담 저장 | 수업 분류(`cls_subject_type`) | 비고 |
|---|---|---|---|---|
| MAP Test | 세부 과목 row 생성 | `enr_course_id` | `MAP_TEST` | Reading/Language/Math 는 마스터에서 구분 |
| ISEE | 세부 과목 row 생성 | `enr_course_id` | `ISEE` | Reading/Verbal/Math/Essay |
| SSAT | 세부 과목 row 생성 | `enr_course_id` | `SSAT` | Reading/Verbal/Math/Essay |
| Duolingo / TOEFL / IELTS | 시험별 패키지 row 생성 | `enr_course_id` | `ENGLISH_TEST` 신규 | PDF 기준 과목분리 없이 패키지 |
| PSAT / SAT | 시험+영역 row 생성 | `enr_course_id` | `SAT` 신규 | RW / Math |
| PreACT / ACT | 시험+영역 row 생성 | `enr_course_id` | `ACT` 신규 | English / Math / Reading / Science |
| 국제학교 / 외국인학교 입시 | 학교별 row + 기타 수기 | `enr_course_id` 또는 `enr_course_freetext` | `INTL_PREP` | 등록되지 않은 학교는 수기 |
| 경시대회 | 기본은 수기, 필요 시 대표 row 일부 추가 | `enr_course_freetext` | `COMPETITION` 신규 | 종류가 많아 자유입력 우선 |

## 6.2 추천 강좌 마스터 예시

### 1) MAP

- `MAP-READING`
- `MAP-LANGUAGE_USAGE`
- `MAP-MATH`

### 2) ISEE

- `ISEE-READING`
- `ISEE-VERBAL`
- `ISEE-MATH`
- `ISEE-ESSAY`

### 3) SSAT

- `SSAT-READING`
- `SSAT-VERBAL`
- `SSAT-MATH`
- `SSAT-ESSAY`

### 4) Duolingo / TOEFL / IELTS

- `DUOLINGO-PACKAGE`
- `TOEFL-PACKAGE`
- `IELTS-PACKAGE`

### 5) PSAT / SAT

- `PSAT89-READING_WRITING`
- `PSAT89-MATH`
- `PSAT10-READING_WRITING`
- `PSAT10-MATH`
- `PSATNMSQT-READING_WRITING`
- `PSATNMSQT-MATH`
- `SAT-READING_WRITING`
- `SAT-MATH`

### 6) PreACT / ACT

- `PREACT89-ENGLISH`
- `PREACT89-MATH`
- `PREACT89-READING`
- `PREACT89-SCIENCE`
- `PREACT-ENGLISH`
- `PREACT-MATH`
- `PREACT-READING`
- `PREACT-SCIENCE`
- `ACT-ENGLISH`
- `ACT-MATH`
- `ACT-READING`
- `ACT-SCIENCE`

### 7) 국제학교 / 외국인학교

- `INTL-KIS_JEJU`
- `INTL-NLCS`
- `INTL-SJA`
- `INTL-BHA`
- `INTL-KIS_PANGYO`
- `INTL-YISS`

기타 학교:

- `enr_course_freetext` 사용

### 8) 경시대회

기본 권장:

- 마스터 강제 없음
- `enr_course_freetext` 사용

운영상 대표 분류가 필요하면 보조 row 추가 가능:

- `COMP-GENERAL`

---

## 7. 구현 관점의 갭 분석

## 7.1 이미 준비된 부분

1. 상담 등록상담 단계에는 이미 강좌 선택 구조가 있음
   - `enr_course_id`
   - `enr_course_freetext`

2. 상담/수업 프론트 모두 `/acm/csl/courses` 를 읽는 구조가 있음

3. 강좌 마스터 CRUD API 는 이미 백엔드에 존재함
   - `GET /acm/csl/courses`
   - `POST /acm/csl/courses`
   - `PUT /acm/csl/courses/:crsId`

## 7.2 부족한 부분

1. **강좌 마스터를 관리하는 프론트 화면이 없음**
   - 현재 프론트에서 `/acm/csl/courses` create/update UI 사용처가 없다
   - 즉 실운영 반영은 초기 SQL seed 또는 별도 관리화면이 필요

2. **CLS 에 강좌 FK가 없음**
   - `cls_course_id` 부재
   - 현재는 label 문자열만 저장

3. **CLS subjectType enum 이 PDF 카테고리를 다 담지 못함**
   - 부족한 후보:
     - `ENGLISH_TEST`
     - `SAT`
     - `ACT`
     - `COMPETITION`

4. **강좌 마스터가 평면 구조다**
   - 현재는 `code`, `name` 만 있다
   - PDF는 상위카테고리 > 시험 > 영역 구조라, 행이 많아지면 드롭다운 UX가 급격히 나빠질 수 있다

---

## 8. 요구사항 정의

## 8.1 필수 요구사항 (P0)

### FR-CC-001

TPI PDF 기준 수업강좌를 `amb_acm_csl_course` 마스터로 등록할 수 있어야 한다.

### FR-CC-002

상담 상세 `4. 등록 상담` 의 강좌 선택은 반드시 `amb_acm_csl_course` 를 기준으로 해야 한다.

### FR-CC-003

국제학교 기타 학교명 및 경시대회 세부 종목은 `enr_course_freetext` 로 저장할 수 있어야 한다.

### FR-CC-004

수업 생성 시 선택한 강좌는 문자열이 아닌 FK 기준으로도 저장되어야 한다.

### FR-CC-005

상담에서 수업으로 연계 생성하는 경우, `enr_course_id` 는 기본값으로 수업 생성 화면에 자동 반영되어야 한다.

### FR-CC-006

수업 목록/상세/검색/통계는 `cls_subject_type` 과 `cls_course_id` 둘 다 활용할 수 있어야 한다.

## 8.2 권장 요구사항 (P1)

### FR-CC-011

`amb_acm_csl_course` 는 단순 code/name 뿐 아니라 상위 분류를 함께 가질 수 있어야 한다.

권장 추가 컬럼:

- `crs_family_code`
- `crs_exam_code`
- `crs_area_code`
- `crs_sort_order`
- `crs_is_freetext_fallback`

### FR-CC-012

상담 등록상담 화면과 수업 생성 화면은 동일한 강좌 선택 UX를 사용해야 한다.

권장 UI:

- 1차: 카테고리
- 2차: 시험/학교
- 3차: 세부 과목
- 예외: 기타 수기입력

### FR-CC-013

강좌 마스터 관리 화면이 필요하다.

권장 위치:

- `/admin/csl/courses`
- 또는 `/admin/cfg/course-catalog`

## 8.3 비권장 사항

### N-CC-001

PDF 카테고리를 `applyPurpose` 세분화로 해결하지 않는다.

### N-CC-002

PDF 카테고리를 `level test type` 확장으로 해결하지 않는다.

### N-CC-003

CLS 에서 강좌를 `subjectLabel` 문자열만으로 저장하는 방식에 머물지 않는다.

---

## 9. 최소안 vs 권장안

## 9.1 최소안

### 방식

- `amb_acm_csl_course` 에 PDF 카테고리 row 추가
- 상담 화면은 기존 구조 유지
- 수업 화면은 기존처럼 `subjectLabel` 문자열만 저장
- subjectType 은 사람이 수동 선택

### 장점

- 변경 범위가 작다
- 빠르게 운영 반영 가능하다

### 한계

- 수업과 강좌 마스터의 참조가 끊긴다
- 강좌별 통계/정렬/변경 추적이 불안정하다

## 9.2 권장안

### 방식

- `amb_acm_csl_course` 에 PDF 카테고리 반영
- `amb_acm_cls_classes.cls_course_id` 추가
- `cls_subject_type` 상위 분류 enum 확장
- 상담 → 수업 생성 시 course 자동 상속
- 필요 시 강좌 마스터 계층 구조 추가

### 장점

- 상담과 수업이 같은 강좌 기준을 공유한다
- 강좌별 리포트/검색/정산 확장에 유리하다
- 운영 데이터 정합성이 높다

### 결론

**실제 운영 기준으로는 권장안이 맞다.**

---

## 10. 최종 권고

이번 PDF 기반 "수업강좌 정보 업데이트"는 아래 순서로 해석하고 진행하는 것이 맞다.

1. **강좌 원본 카탈로그는 CSL course master 에 넣는다**
   - `amb_acm_csl_course`

2. **상담 단계에서는 enrollment row 가 그 선택값을 가진다**
   - `enr_course_id`
   - `enr_course_freetext`

3. **수업 단계에서는 반드시 course FK 를 추가로 저장한다**
   - 신규 `cls_course_id`
   - 기존 `cls_subject_type`, `cls_subject_label` 병행

4. **PDF 카테고리 전체를 applyPurpose 나 level test type 으로 옮기지 않는다**

5. **국제학교 기타 / 경시대회는 freetext fallback 을 유지한다**

즉, 이번 요구는 단순히 "드롭다운 항목 추가"가 아니라,
**상담과 수업이 동일한 강좌 마스터를 공유하도록 구조를 정리하는 작업**으로 보는 것이 정확하다.

---

## 11. 후속 구현 범위 제안

다음 구현 작업은 아래 순서가 적절하다.

1. `sql/acm/998-seed-tpi-course-catalog.sql` 적용
2. `CLS` 에 `cls_course_id` 컬럼 추가
3. `CreateClassDto` / `ClassTypeormEntity` / `ClassService` 에 `courseId` 반영
4. `ClassCreateDialog` 가 `courseId` 를 실제 저장하도록 수정
5. `subjectType` enum 확장 (`ENGLISH_TEST`, `SAT`, `ACT`, `COMPETITION`)
6. 상담 → 수업 생성 시 강좌 자동 상속
7. 필요 시 강좌 마스터 관리 화면 추가
