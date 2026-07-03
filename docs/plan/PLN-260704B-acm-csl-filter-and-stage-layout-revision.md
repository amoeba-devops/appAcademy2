---
document_id: PLN-260704B-acm-csl-filter-and-stage-layout-revision
version: 0.1.0
status: Draft
created: 2026-07-04
product_code: ACM
title: CSL 상담관리 — 목록 필터 단순화 및 등록상담/결제/수강현황 화면 재구성 작업계획서
modules:
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260704B-acm-csl-filter-and-stage-layout-revision.md
  - docs/analysis/REQ-260704-acm-csl-list-and-detail-enhancement.md
  - frontend-acm/src/modules/csl/pages/csl-list-page.tsx
  - frontend-acm/src/modules/csl/components/csl-list-filters.tsx
  - frontend-acm/src/modules/csl/components/csl-kanban-board.tsx
  - frontend-acm/src/modules/csl/components/enrollment-panel.tsx
  - frontend-acm/src/modules/csl/components/class-status-summary-panel.tsx
change_log:
  - { version: 0.1.0, date: 2026-07-04, author: Codex, notes: "초안 — 상단 필터 단순화, 목록 헤더 필터, 4/5/6단계 재구성 작업계획 수립" }
---

# PLN-260704B — CSL 화면 재구성 작업계획서

> 범위: `/admin/csl` 상단 필터 단순화 + 목록 헤더 필터 도입 + `/admin/csl/:id` 4/5/6단계 화면 책임 재분리.

---

## 1. 구현 전략

### 1.1 목록 화면

- 상단 공통 필터 바는 `검색 + 접수일 기간` 만 남긴다.
- 세부 필터는 목록형 헤더 셀 안으로 이동한다.
- 칸반형은 검색/기간만 사용한다.

### 1.2 상세 화면

- 4단계 `등록상담` 과 5단계 `결제` 를 같은 패널로 느끼지 않도록 표시 블록을 분리한다.
- 현재 `EnrollmentPanel` 을 유지하되, **stage별 section gating** 으로 재구성하는 보수적 방식을 우선한다.
- 6단계는 `ClassStatusSummaryPanel` 을 유지하되, 섹션 구조를 `접수한 내용 + 수업 정보` 중심으로 줄인다.

### 1.3 데이터/API

- 기존 목록 API 파라미터와 enrollment 저장 구조를 최대한 재사용한다.
- 이번 범위에서는 신규 DB migration 없이 UI 책임 분리로 해결하는 방향을 우선한다.

---

## 2. 개선 화면구성안

### 2.1 `/admin/csl` 목록형

```text
┌─ 상담관리 ───────────────────────────────────────────────────────────────┐
│ [학생/학부모 검색] [접수일 From] [접수일 To] [초기화]     [List|Kanban] │
├──────────────────────────────────────────────────────────────────────────┤
│ No │ 학생명 │ 학년 │ 유입경로 ▾ │ 신청유형 ▾ │ 신청목적 ▾ │ 단계 ▾ │ 팔로업 ▾ │
│ 91 │ 김OO  │ 중2  │ 홈페이지    │ 상담+시험   │ ISEE       │ 결제    │ 있음      │
│ 90 │ 박OO  │ 고1  │ 전화        │ 상담만      │ MAP        │ 접수    │ 없음      │
└──────────────────────────────────────────────────────────────────────────┘
```

구성 포인트:

- 상단은 빠른 탐색용
- 헤더 필터는 목록 정제용
- `신청목적` 컬럼을 추가해 필터 위치를 명확히 함

### 2.2 `/admin/csl` 칸반형

```text
┌─ 상담관리 ───────────────────────────────────────────────────────────────┐
│ [학생/학부모 검색] [접수일 From] [접수일 To] [초기화]     [List|Kanban] │
├──────────────────────────────────────────────────────────────────────────┤
│ 1.접수 │ 2.레벨테스트 │ 3.데모수업 │ 4.등록상담 │ 5.결제 │ 6.수강현황 │
│ [카드] │ [카드]       │ [카드]     │ [카드]     │ [카드] │ [카드]     │
└──────────────────────────────────────────────────────────────────────────┘
```

구성 포인트:

- 칸반은 stage 분포 확인이 목적
- 목록 전용 헤더 필터를 억지로 복제하지 않음

### 2.3 상세 4단계 `등록상담`

```text
┌─ 4. 등록상담 ───────────────────────────────────────────────────────────┐
│ 상담 내용                                                               │
│ 강좌 코스 / 코스 직접 입력                                              │
│ 수강 회수 / 시작일 / 종료일 / 수업 시간 / 수강료                        │
│ 수강료안내발송                                                          │
│ 담당 강사 배정                                                          │
│                                                  [저장] [결제 단계로]   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 상세 5단계 `결제`

```text
┌─ 5. 결제 ───────────────────────────────────────────────────────────────┐
│ 결제일 [date]    결제방법 [계좌이체|카드|기타]                         │
│ 결제금액 [number]    비고 [text]                                        │
│ 수강 시작 여부 [YES/NO]    수강료 납부 완료 [checkbox]                 │
│                                                         [저장]          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.5 상세 6단계 `수강현황`

```text
┌─ 6. 수강현황 ───────────────────────────────────────────────────────────┐
│ ▼ 접수한 내용                                                           │
│   학생/학부모/연락처/학년/유입경로/신청유형/신청목적/팔로업             │
│                                                                         │
│ ▼ 수업 정보                                                             │
│   강좌코스/담당강사/수강회수/수업시간/시작일/종료일                     │
│   레벨테스트 결과 요약/데모수업 이력 요약                              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 변경 범위

### 3.1 Frontend

우선 변경 후보:

- `frontend-acm/src/modules/csl/pages/csl-list-page.tsx`
- `frontend-acm/src/modules/csl/components/csl-list-filters.tsx`
- `frontend-acm/src/modules/csl/components/csl-kanban-board.tsx`
- `frontend-acm/src/modules/csl/pages/csl-detail-page.tsx`
- `frontend-acm/src/modules/csl/components/enrollment-panel.tsx`
- `frontend-acm/src/modules/csl/components/class-status-summary-panel.tsx`
- `frontend-acm/src/i18n/locales/ko/csl.json`

추가 컴포넌트 후보:

- `csl-list-header-filters.tsx` 또는 `CslListPage` 내부의 header-row subcomponent

### 3.2 Backend

필수 변경은 낮은 편이다.

검토 후보:

- 목록 응답에서 `applyPurposes` 사용 여부 점검
- 세부 필터 조합에서 `total` 계산 회귀 여부 확인

### 3.3 DB

예상 범위:

- 신규 migration 없음
- 기존 `993` 결제 필드 재사용

---

## 4. 단계별 작업 분해

| ID | Task | 영역 | 의존 | 효(d) |
|---|---|---|---|---:|
| T-01 | 상단 공통 필터를 `검색 + 기간` 구조로 단순화 | FE | - | 0.4 |
| T-02 | 목록형 헤더 필터 row 구현 (`유입/신청유형/신청목적/단계/팔로업`) | FE | T-01 | 0.8 |
| T-03 | 목록형 `신청목적` 컬럼 추가 및 width/overflow 정리 | FE | T-02 | 0.4 |
| T-04 | 칸반형에서 세부 필터 제거, 검색/기간만 유지 | FE | T-01 | 0.3 |
| T-05 | 상세 4단계 제목/표시 항목 재구성 (`등록상담`) | FE | - | 0.7 |
| T-06 | 상세 5단계 결제 전용 블록 분리 | FE | T-05 | 0.6 |
| T-07 | 6단계 라벨 `수강현황` 변경 및 summary panel 축소/재배열 | FE | T-05 | 0.6 |
| T-08 | locale / 회귀 검증 / 운영 시나리오 점검 | FE | T-01~T-07 | 0.5 |

**총 추정**: 약 4.3 man-day

---

## 5. 구현 메모

### 5.1 목록형 필터 상태 관리

권장 상태 분리:

- `globalFilters`
  - `q`
  - `registeredFrom`
  - `registeredTo`
- `listColumnFilters`
  - `inflowType`
  - `applyType`
  - `applyPurpose`
  - `stage`
  - `followupState`

이 구조를 쓰면:

- 목록형은 `global + column` 둘 다 사용
- 칸반형은 `global` 만 사용

### 5.2 상세 4/5단계 렌더 전략

현재 `EnrollmentPanel` 을 완전히 둘로 나누기보다 아래처럼 section 분리하는 쪽이 안전하다.

- `showCounselingSection = currentStage === 'ENROLLMENT_COUNSELING'`
- `showPaymentSection = currentStage === 'PAYMENT'`
- `showClassStartSection = currentStage === 'PAYMENT'`

6단계에서는 `EnrollmentPanel` 을 최소 또는 읽기 요약만 노출하고, 핵심은 `ClassStatusSummaryPanel` 로 둔다.

### 5.3 6단계 summary 설계

현재 5개 아코디언을 아래 구조로 재편한다.

1. `접수한 내용`
2. `수업 정보`

`수업 정보` 안에 포함할 후보:

- 강좌 코스
- 담당 강사
- 수강 회수
- 수업 시간
- 시작일/종료일
- 레벨테스트 결과 요약
- 데모수업 이력 요약

결제 상세는 5단계에서 본다는 원칙을 유지하므로, 6단계에서는 반복을 최소화한다.

---

## 6. 검증 계획

### 6.1 목록 화면

1. 상단에 검색/기간만 보이는지 확인
2. 목록형 헤더 셀에서 세부 필터가 동작하는지 확인
3. 칸반형으로 전환 시 세부 필터 UI가 사라지고 검색/기간만 유지되는지 확인
4. `신청목적` 컬럼 추가 후 테이블 가독성/줄바꿈 문제 없는지 확인

### 6.2 상세 화면

1. 4단계 제목이 `등록상담` 으로 보이는지 확인
2. 4단계에서 결제 정보/수강 시작/납부 완료가 보이지 않는지 확인
3. 5단계에서 결제 정보와 운영 상태값이 보이는지 확인
4. 단계 스테퍼와 칸반 컬럼에서 `6. 수강현황` 라벨이 일치하는지 확인
5. 6단계에서 접수 내용과 수업 정보가 중심으로 보이는지 확인

### 6.3 회귀 체크

1. 기존 검색 `q` 와 기간 필터 API 호출 정상 여부
2. 목록 페이징 유지 여부
3. 결제 저장 필드가 5단계에서도 기존처럼 정상 저장되는지 확인

---

## 7. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| `신청목적` 컬럼 추가로 목록 폭이 넓어짐 | 중 | 텍스트 truncate + tooltip 또는 1줄 요약 |
| 목록형 전용 필터와 칸반형 공통 필터의 상태 분리가 헷갈릴 수 있음 | 중 | `globalFilters` / `listColumnFilters` 분리 |
| `EnrollmentPanel` 에 stage 조건이 많아져 가독성이 떨어질 수 있음 | 중 | section 함수 또는 소형 subcomponent 분리 |
| 6단계에서 너무 많은 내용을 다시 보여주면 5단계와 차별성이 약해짐 | 중 | 결제 상세 반복을 줄이고 수업 운영 정보 위주로 구성 |

---

## 8. 적용 순서

1. 본 문서 승인
2. 목록 화면 상단/헤더 필터 구조 개편
3. 4단계/5단계 역할 분리
4. 6단계 라벨/요약 구조 개편
5. locale 및 수동 QA
6. staging 검수
7. production 반영
