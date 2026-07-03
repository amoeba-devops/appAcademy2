---
document_id: REQ-260704-acm-csl-list-and-detail-enhancement
version: 0.1.0
status: Draft
created: 2026-07-04
product_code: ACM
title: CSL 상담관리 — 목록 검색/필터·상세 입력/미리보기·결제/수강현황 개선 요구사항 분석서
modules:
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - frontend-acm/src/modules/csl/pages/csl-list-page.tsx
  - frontend-acm/src/modules/csl/pages/csl-detail-page.tsx
  - frontend-acm/src/modules/csl/components/intake-stage-panel.tsx
  - frontend-acm/src/modules/csl/components/level-test-panel.tsx
  - frontend-acm/src/modules/csl/components/level-test-schedule-dialog.tsx
  - frontend-acm/src/modules/csl/components/enrollment-panel.tsx
  - frontend-acm/src/modules/csl/components/attachment-panel.tsx
  - frontend-acm/src/modules/web/pages/web-contact-page.tsx
  - backend/src/modules/acm-csl/presentation/inquiry.controller.ts
  - backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts
  - backend/src/modules/acm-csl/application/inquiry.service.ts
  - backend/src/modules/acm-csl/application/dto/inquiry.dto.ts
  - docs/plan/PLN-260626-acm-csl-pipeline-revision.md
  - docs/plan/PLN-260701-csl-kanban-view.md
change_log:
  - { version: 0.1.0, date: 2026-07-04, author: Codex, notes: "초안 — 현행 구현 분석 + 추가 요구사항 정리 + API/데이터 영향 도출" }
---

# REQ-260704 — CSL 목록/상세 운영 개선 요구사항 분석서

## 1. Overview

대상은 `https://acm.amoeba.site/admin/csl` 와 `https://acm.amoeba.site/admin/csl/:id` 이다.
이번 요구는 신규 기능 추가라기보다, 이미 구축된 CSL 파이프라인을 **운영 실무 흐름에 맞게 다듬는 후속 개선**에 가깝다.

핵심 목표는 3가지다.

1. 목록 화면에서 상담건을 더 빨리 찾고 좁힐 수 있게 한다.
2. 상세 화면에서 실무자가 실제로 입력하는 점수/결제/파일확인 동선을 줄인다.
3. 수강 시작 이후에도 접수부터 결제까지 전체 상담 히스토리를 한 화면에서 펼쳐 볼 수 있게 한다.

---

## 2. 현행 구현 분석

### 2.1 `/admin/csl` 목록 화면

| 항목 | 현행 | 갭 |
|---|---|---|
| 데이터 조회 | `GET /acm/csl/inquiries` 1회 호출, 프론트에서 전체 렌더 | 검색/필터/페이지 상태가 없음 |
| 목록형 | 학생, 학교/학년, 유입, 신청유형, 단계, 접수일, 팔로업일 표시 | 학생/학부모 검색 불가, 항목별 필터 불가, 페이지네이션 없음 |
| 칸반형 | stage 필터만 로컬 상태로 제공 | 공통 검색/필터 불가 |
| 학교 표시 | `schoolFreetext / grade` 를 함께 노출 | 퍼블릭 상담신청은 학교명을 받지 않아 실데이터와 UI가 불일치 |

추가 확인 사항:

- 퍼블릭 상담신청 화면 `frontend-acm/src/modules/web/pages/web-contact-page.tsx` 는 `studentName`, `grade`, `parentName`, `parentPhone`, `applyPurposes` 만 전송한다.
- 백엔드 `backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts` 는 학교 미입력 시 `schoolFreetext` 에 사실상 기본값 성격의 문자열을 넣고 있다.
- 따라서 목록의 `학교 / 학년` 컬럼은 현재 운영 관점에서 정보 밀도가 낮다.

### 2.2 `/admin/csl/:id` 상세 화면

| 단계 | 현행 | 갭 |
|---|---|---|
| 1. 접수 | ISEE 는 scaled 만 입력, Advanced 는 `testName + JSON textarea` | ISEE percentile/stanine 없음, SSAT/Duolingo/TOEFL/SAT 구조화 입력 없음, 기타 시험은 텍스트 방식 미지원 |
| 첨부파일 | 업로드/다운로드만 가능 | 미리보기 모달 없음 |
| 2. 레벨테스트 | 시험 row 조회, 일정 모달, 결과입력, PDF 다운로드 지원 | 결과/PDF 미리보기 모달 없음, 시험종류 추가 UI 없음 |
| 4. 등록/결제 | `paymentNoticeStatus`, `paymentNoticeSent`, `classStartedAt`, `classStarted`, `tuitionPaid`, 결제승인 블록 존재 | 화면 항목이 실무 요구와 다름, 결제 메타데이터 별도 저장 불가 |
| 5. 결제 | `approve-payment` 로 카드/계좌이체 + memo만 부가 기록 | 결제일/방법/금액/비고 저장 필드가 없음, `기타` 방법 미지원 |
| 6. 수강현황 | 별도 요약 패널 없음 | 접수~결제 전체 이력을 접기/펼치기로 보는 요구 미충족 |

---

## 3. 요구사항 정리

## 3.1 목록 화면 요구사항

### FR-L01 · 공통 검색

- 목록형/칸반형 모두에서 **학생명 / 학부모명** 키워드 검색을 지원한다.
- 검색 입력은 단일 검색창으로 제공한다.
- 검색 대상은 부분일치 기준이다.

### FR-L02 · 공통 필터

목록형/칸반형 공통으로 다음 필터를 제공한다.

- 진행단계
- 유입경로
- 신청유형
- 신청목적
- 접수일 기간
- 팔로업 예정일 존재 여부

운영자가 빠르게 많이 쓰는 값 위주로 좁히는 것이 목적이므로, 1차 범위는 위 항목으로 제한한다.

### FR-L03 · 목록형 컬럼 정리

- 기존 `학교 / 학년` 컬럼에서 **학교를 제거**한다.
- 컬럼 라벨은 `학년` 또는 `학생 학년`으로 단순화한다.
- 학교명은 목록형에서 더 이상 주요 검색/정렬 정보로 취급하지 않는다.

### FR-L04 · 페이지네이션

- 목록형에 페이지네이션을 추가한다.
- 기본 정렬은 현행과 동일하게 최신 `seqNo DESC` 유지.
- 페이지 크기는 운영자 UI에 맞춰 고정값(예: 20 또는 30)으로 시작한다.

### FR-L05 · 뷰 간 상태 공유

- 검색어/필터 상태는 목록형과 칸반형 사이에서 공유한다.
- 사용자가 토글하더라도 검색 결과가 유지되어야 한다.

> 결정: 이번 범위에서 페이지네이션은 **목록형 우선 적용**으로 정의한다. 칸반형은 검색/필터 적용까지만 포함한다.

---

## 3.2 상세 화면 요구사항

### FR-D01 · 접수 단계 이전 점수 입력 확장

#### ISEE

- 접수 단계에서 각 영역별로 아래 3개를 함께 입력할 수 있어야 한다.
  - Scaled
  - Percentile
  - Stanine

#### SSAT

- 과목별 입력 항목을 구조화한다.
- 권장 필드:
  - Verbal
  - Quantitative
  - Reading
  - Total

#### Duolingo

- 과목별 입력 항목을 구조화한다.
- 권장 필드:
  - Total
  - Speaking
  - Writing
  - Reading
  - Listening
  - Production
  - Literacy
  - Comprehension
  - Conversation

#### TOEFL

- 과목별 입력 항목을 구조화한다.
- 권장 필드:
  - Total
  - Reading
  - Listening
  - Speaking
  - Writing

#### SAT

- 접수 단계 self-report 용으로 과목별 입력 항목을 구조화한다.
- 권장 필드:
  - Reading & Writing
  - Math
  - Total

#### 기타 시험

- JSON textarea 방식은 제거한다.
- 기타 시험은 시험명 + 텍스트 입력(자유서술) 방식으로 처리한다.

### FR-D02 · 접수 단계 업로드 파일 미리보기

- 업로드한 성적표/파일을 다운로드 전에 미리 볼 수 있어야 한다.
- 이미지(`jpg`, `png`)와 PDF 를 모달에서 미리보기 한다.

### FR-D03 · 레벨테스트 결과/PDF 미리보기

- 결과 PDF 를 다운로드만 하지 않고 모달에서 먼저 확인할 수 있어야 한다.
- 결과 입력값도 읽기 모달 또는 동일 패널 내 확장뷰로 확인 가능해야 한다.

### FR-D04 · 레벨테스트 시험종류 추가

- 운영자가 시험 row 를 수동으로 추가할 수 있어야 한다.
- `OTHER` 유형은 시험명을 직접 입력한다.
- 이미 존재하는 시험종류는 중복 추가되지 않아야 한다.

### FR-D05 · 등록/결제 화면 단순화

- `수강료안내상태` 는 노출하지 않는다.
- `수강료안내발송` 만 노출한다.
- 하단 수강신청 블록에서는 `수강시작일` 을 제거한다.
- 하단 블록에는 아래만 남긴다.
  - 수강 시작 여부
  - 수강료 납부 완료 체크

### FR-D06 · 결제 정보 저장

결제 단계에서 아래 값을 입력/저장할 수 있어야 한다.

- 결제일
- 결제 방법: `계좌이체`, `카드`, `기타`
- 결제금액
- 비고(메모)

### FR-D07 · 수강 현황 요약(접기/펼치기)

`수강 현황` 영역에 상담신청 내용을 전체 요약해서 보여준다.

접기/펼치기 단위:

1. 접수 내용
2. 레벨테스트 점수
3. 데모수업 정보
4. 수강강좌/코스/회수/수업시간 정보
5. 결제 정보

---

## 4. 데이터/API 영향 분석

### 4.1 목록 조회 API

현행 `GET /acm/csl/inquiries` 는 `stage`, `limit`, `offset` 정도만 받는다.
아래 파라미터 확장이 필요하다.

| 파라미터 | 목적 |
|---|---|
| `q` | 학생명/학부모명 통합 검색 |
| `stage[]` | 진행단계 필터 |
| `inflowType` | 유입경로 필터 |
| `applyType` | 신청유형 필터 |
| `applyPurpose` | 신청목적 필터 |
| `registeredFrom`, `registeredTo` | 접수일 기간 |
| `followupState` | 팔로업 예정일 존재 여부 |
| `limit`, `offset` | 목록형 페이지네이션 |

### 4.2 이름 검색 처리 방식

중요 제약:

- `studentName`, `parentName` 은 AES-GCM 으로 암호화 저장된다.
- 현재 스키마에는 이름 검색용 blind index 가 없다.
- 따라서 DB `LIKE` 기반 검색은 바로 사용할 수 없다.

권고 구현:

1. SQL 에서는 tenant + 비암호화 필터(stage/inflow/applyType/date 등)로 후보군을 먼저 축소한다.
2. 서비스 레이어에서 후보군을 복호화한다.
3. 복호화된 `studentName`, `parentName` 에 대해 메모리 필터로 `q` 를 적용한다.
4. 필터 결과에 대해 `total`, `limit`, `offset` 을 계산해 반환한다.

> 이는 현재 코드베이스와 가장 잘 맞는 보수적 구현이다. 데이터 규모가 크게 늘면 blind-index 컬럼 추가를 후속 과제로 분리한다.

### 4.3 접수 이전 점수 저장 구조

`priorScoresDetail` 은 현재 백엔드에서 pass-through JSONB 로 허용된다.
즉, 이번 요구의 대부분은 프론트 구조화와 표시 로직으로 해결 가능하다.

권장 저장 shape:

```json
{
  "iseeIntake": {
    "verbal": { "scaled": 820, "percentile": 71, "stanine": 6 }
  },
  "ssatIntake": {
    "verbal": { "score": 650, "percentile": 82 }
  },
  "duolingoIntake": {
    "total": 125,
    "speaking": 120
  },
  "toeflIntake": {
    "total": 103,
    "reading": 27
  },
  "satIntake": {
    "rw": 690,
    "math": 710,
    "total": 1400
  },
  "otherTestsText": "PSAT 1280, AP Calculus AB 4"
}
```

### 4.4 파일/PDF 미리보기

- 첨부파일 다운로드 API와 레벨테스트 PDF 다운로드 API는 이미 blob 반환이 가능하다.
- 프론트에서 blob URL 을 만들어 `img` / `iframe` 모달에 렌더하면 되므로, 미리보기는 **프론트 우선 작업**으로 가능하다.
- 별도 preview endpoint 는 필수는 아니다.

### 4.5 레벨테스트 시험종류 추가

백엔드는 이미 아래를 지원한다.

- `GET /acm/csl/inquiries/:inqId/level-tests`
- `PUT /acm/csl/inquiries/:inqId/level-tests/:testType`
- `testType = OTHER` + `testTypeOther`

즉, 이번 요구의 본체는 **프론트에 시험추가 UX 추가**이다.

### 4.6 결제 정보 저장 방식

현행 enrollment 는 결제 완료 여부(`tuitionPaid`) 중심이고, 결제 메타데이터 저장 컬럼이 없다.

이번 범위 권고안:

- `amb_acm_csl_enrollment` 1:1 row 에 아래 컬럼을 추가한다.
  - `paymentDate`
  - `paymentMethod`
  - `paymentAmount`
  - `paymentMemo`
- `tuitionPaid` 권한 게이트는 유지한다.
- 결제 메타데이터 저장은 일반 저장과 분리하지 않고 enrollment upsert 에 포함한다.

이유:

- 현재 요구는 다회 결제가 아니라 단건 결제 정보 저장이다.
- 별도 payment ledger 테이블보다 기존 enrollment 확장이 구현량과 변경범위가 작다.

> 분할 납부/복수 결제 내역이 추후 필요해지면 `acm_csl_payment` 1:N 테이블로 분리한다.

---

## 5. 화면 설계 결정사항

### D-01 · 목록형과 칸반형은 같은 검색/필터 상태를 쓴다

- 사용자가 뷰를 바꿔도 같은 결과 집합을 본다는 점이 더 중요하다.
- 따라서 필터 상태는 페이지 상위 컨테이너에서 관리한다.

### D-02 · 칸반형은 이번 범위에서 페이지네이션 대상이 아니다

- 칸반은 stage 별 개수와 배치를 보는 화면이다.
- 페이지 단위로 자르면 진행현황 해석이 왜곡된다.
- 따라서 요구의 `페이징` 은 목록형 우선으로 해석한다.

### D-03 · 파일 미리보기는 다운로드 대체가 아니라 보조기능이다

- 미리보기 모달 + 다운로드 버튼을 함께 둔다.
- 운영자가 먼저 확인하고 필요 시 저장하는 흐름을 유지한다.

### D-04 · 수강현황은 `CLASS_STARTED` 전용 요약 패널로 정의한다

- 기존 stage 패널 구조는 유지한다.
- `CLASS_STARTED` 선택 시 별도 요약 아코디언을 렌더하는 것이 현재 구조에 가장 무리가 적다.

---

## 6. Acceptance Criteria

- AC-1: `/admin/csl` 목록형/칸반형 모두 학생명/학부모명 검색 가능
- AC-2: `/admin/csl` 목록형/칸반형 모두 공통 필터 제공
- AC-3: 목록형 컬럼에서 학교 제거, 학년만 노출
- AC-4: 목록형 페이지네이션 동작
- AC-5: 접수 단계에서 ISEE percentile/stanine, SSAT/Duolingo/TOEFL/SAT 구조화 입력 가능
- AC-6: 기타 시험 입력은 JSON textarea 가 아닌 텍스트 입력
- AC-7: 접수 첨부파일 및 레벨테스트 PDF 를 모달에서 미리보기 가능
- AC-8: 레벨테스트에서 시험종류 추가 가능, `OTHER` 시험명 수기입력 가능
- AC-9: 등록/결제 화면에서 `수강료안내상태` 제거, `수강료안내발송` 만 유지
- AC-10: 결제일/방법/금액/비고 저장 가능
- AC-11: `CLASS_STARTED` 단계에서 접수~결제 전체 요약을 접기/펼치기로 확인 가능

---

## 7. 다음 산출물

본 분석서를 바탕으로 다음 문서를 작성한다.

1. 작업계획서 `docs/plan/PLN-260704-acm-csl-list-and-detail-enhancement.md`
2. 구현 시 SQL migration 1건
3. 프론트/백엔드 변경 파일 목록 및 검증 시나리오
