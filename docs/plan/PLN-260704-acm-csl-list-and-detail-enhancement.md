---
document_id: PLN-260704-acm-csl-list-and-detail-enhancement
version: 0.1.0
status: Draft
created: 2026-07-04
product_code: ACM
title: CSL 상담관리 — 목록 검색/필터·상세 입력/미리보기·결제/수강현황 개선 작업계획서
modules:
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260704-acm-csl-list-and-detail-enhancement.md
  - docs/plan/PLN-260626-acm-csl-pipeline-revision.md
  - docs/plan/PLN-260701-csl-kanban-view.md
  - frontend-acm/src/modules/csl/pages/csl-list-page.tsx
  - frontend-acm/src/modules/csl/pages/csl-detail-page.tsx
  - backend/src/modules/acm-csl/presentation/inquiry.controller.ts
  - backend/src/modules/acm-csl/application/inquiry.service.ts
change_log:
  - { version: 0.1.0, date: 2026-07-04, author: Codex, notes: "초안 — 현행 CSL 기준 작업범위/화면구성/WBS/리스크 정리" }
---

# PLN-260704 — CSL 운영 개선 작업계획서

> 범위: `/admin/csl` 검색/필터/목록 개선 + `/admin/csl/:id` 접수/레벨테스트/등록결제/수강현황 개선.
> 구현은 기존 `frontend-acm` / `backend acm-csl` 구조를 유지하고, 데이터 모델 변경은 필요한 최소 범위로 제한한다.

---

## 1. 구현 전략

### 1.1 목록 화면

- 검색/필터 상태를 `CslListPage` 상위에서 단일 관리한다.
- 목록형과 칸반형은 같은 query param 집합을 사용한다.
- 목록형에만 페이지네이션 UI를 붙인다.
- 칸반형은 검색/필터 결과 전체를 stage 별로 재분배한다.

### 1.2 검색 처리

- 이름 검색은 암호화 제약 때문에 `InquiryService.list()` 내부에서 복호화 후 메모리 필터로 구현한다.
- stage/inflow/applyType/date 범위는 SQL 에서 먼저 줄인다.

### 1.3 접수/레벨테스트

- 접수 단계 self-report 이전점수는 프론트 구조화 입력으로 확장한다.
- 레벨테스트 결과/PDF 미리보기는 blob 기반 모달로 구현한다.
- 시험종류 추가는 기존 `level-tests/:testType` API 를 재사용하고, `OTHER` 입력 UX 만 추가한다.

### 1.4 등록/결제

- enrollment 1:1 row 확장으로 결제 메타데이터를 저장한다.
- `paymentNoticeStatus` 는 UI 에서 제거하고, 컬럼은 당장 drop 하지 않는다.
- `tuitionPaid` 권한 제약은 유지한다.

### 1.5 수강현황 요약

- `CLASS_STARTED` 단계 전용 summary accordion 컴포넌트를 추가한다.
- 기존 stage 패널은 유지하고, 최종 단계에서만 “전체 히스토리 요약”을 노출한다.

---

## 2. 화면 구성안

### 2.1 `/admin/csl` 목록형

```
┌─ 신규 상담 ───────────────────────────────────────────────────────────────┐
│ [검색: 학생명/학부모명] [진행단계 ▾] [유입경로 ▾] [신청유형 ▾] [신청목적 ▾] │
│ [접수일 From] [접수일 To] [팔로업여부 ▾] [초기화]        [List|Kanban] [+] │
├──────────────────────────────────────────────────────────────────────────┤
│ No │ 학생명 │ 학년 │ 유입 │ 신청유형 │ 진행단계 │ 접수일 │ 팔로업일       │
│ 84 │ 김OO  │ 중2  │ 홈페이지 │ 상담+시험 │ 결제     │ 07-03 │ 07-05         │
│ 83 │ 박OO  │ 고1  │ 카카오   │ 상담만    │ 접수     │ 07-03 │ -             │
├──────────────────────────────────────────────────────────────────────────┤
│                                 ◀ 1 2 3 4 5 ▶                            │
└──────────────────────────────────────────────────────────────────────────┘
```

포인트:

- 기존 `학교 / 학년` 은 `학년` 단일 컬럼으로 변경
- 검색/필터 바는 list/kanban 공통
- 페이지네이션은 목록형 하단 고정

### 2.2 `/admin/csl` 칸반형

```
┌─ 신규 상담 ───────────────────────────────────────────────────────────────┐
│ [검색] [진행단계 ▾] [유입경로 ▾] [신청유형 ▾] [신청목적 ▾] [초기화]      │
│                                                   [List|Kanban] [+]      │
├──────────────────────────────────────────────────────────────────────────┤
│ 1.접수(3)   2.레벨테스트(2)   3.데모수업(1)   4.등록상담(0) ...          │
│ [카드]      [카드]            [카드]          [빈 컬럼]                  │
│ [카드]      [카드]                                                      │
│                                                                         │
│ ▶ DROPPED (5)                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

포인트:

- 기존 stage filter 는 유지하되, 상단 공통 필터와 함께 동작
- 페이지네이션은 적용하지 않음
- 검색 결과 기준으로 stage 카운트 재계산

### 2.3 상세 — 1. 접수

```
┌─ 1. 접수 ────────────────────────────────────────────────────────────────┐
│ [읽기전용 접수정보]                                                      │
│ [신청목적 편집]                                                          │
│                                                                          │
│ 이전 점수                                                                │
│  - ISEE      : Verbal/Reading/Quantitative/Math × Scaled/Percentile/Stanine
│  - SSAT      : Verbal/Quantitative/Reading/Total                          │
│  - Duolingo  : Total + 세부 항목들                                        │
│  - TOEFL     : Total/Reading/Listening/Speaking/Writing                  │
│  - SAT       : RW/Math/Total                                             │
│  - 기타 시험 : [시험명] [자유서술 textarea]                               │
│                                                                          │
│ 첨부파일                                                                  │
│ [파일명.pdf] [미리보기] [다운로드] [삭제]                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.4 상세 — 2. 레벨테스트

```
┌─ 2. 레벨테스트 ──────────────────────────────────────────────────────────┐
│ 시험종류 | 일정 | 강사 | 상태 | 작업                                      │
│ MAP      | 07-05 14:00 | 김OO | COMPLETED | [결과입력] [미리보기] [PDF]  │
│ ISEE     | -           | -    | PENDING   | [일정입력]                     │
│ OTHER(SAT Subject)    ...                                                │
│                                                                          │
│ [+ 시험종류 추가]  -> [MAP/ISEE/SSAT/Duolingo/TOEFL/TOEFL Jr/OTHER]      │
│                        OTHER 선택 시 시험명 직접 입력                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.5 상세 — 4. 등록/결제

```
┌─ 4. 등록/결제 ───────────────────────────────────────────────────────────┐
│ 상담메모                                                                  │
│ 강좌코스 / 자유입력 / 수강회수 / 시작일 / 종료일 / 수업시간 / 수강료     │
│ 수강료안내발송 [YES/NO]                                                   │
│                                                                          │
│ 결제 정보                                                                 │
│ 결제일 [date]  결제방법 [계좌이체|카드|기타]  결제금액 [number]          │
│ 비고 [memo]                                                              │
│                                                                          │
│ 하단 상태                                                                 │
│ 수강 시작 여부 [YES/NO]     수강료 납부 완료 [checkbox]                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.6 상세 — 6. 수강 현황

```
┌─ 6. 수강 현황 ───────────────────────────────────────────────────────────┐
│ ▼ 1. 접수 내용                                                           │
│   학생/학부모/연락처/학년/신청목적/...                                   │
│ ▼ 2. 레벨테스트 점수                                                     │
│   시험별 일정/점수/결과 PDF 링크                                         │
│ ▼ 3. 데모수업 정보                                                       │
│   일자/시간/강사/피드백 상태                                             │
│ ▼ 4. 수강강좌 정보                                                       │
│   코스명/수강회수/수업시간/시작일/종료일                                 │
│ ▼ 5. 결제 정보                                                           │
│   결제일/방법/금액/비고/납부완료 여부                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 변경 범위

### 3.1 Frontend

주요 변경 후보 파일:

- `frontend-acm/src/modules/csl/pages/csl-list-page.tsx`
- `frontend-acm/src/modules/csl/components/csl-kanban-board.tsx`
- `frontend-acm/src/modules/csl/pages/csl-detail-page.tsx`
- `frontend-acm/src/modules/csl/components/intake-stage-panel.tsx`
- `frontend-acm/src/modules/csl/components/attachment-panel.tsx`
- `frontend-acm/src/modules/csl/components/level-test-panel.tsx`
- `frontend-acm/src/modules/csl/components/level-test-schedule-dialog.tsx`
- `frontend-acm/src/modules/csl/components/enrollment-panel.tsx`
- 신규: `frontend-acm/src/modules/csl/components/csl-list-filters.tsx`
- 신규: `frontend-acm/src/modules/csl/components/file-preview-dialog.tsx`
- 신규: `frontend-acm/src/modules/csl/components/class-status-summary-panel.tsx`
- i18n: `frontend-acm/src/i18n/locales/*/csl.json`

### 3.2 Backend

주요 변경 후보 파일:

- `backend/src/modules/acm-csl/presentation/inquiry.controller.ts`
- `backend/src/modules/acm-csl/application/inquiry.service.ts`
- `backend/src/modules/acm-csl/application/dto/inquiry.dto.ts`
- `backend/src/modules/acm-csl/infrastructure/typeorm/enrollment.typeorm-entity.ts`
- 신규 SQL migration 1건

### 3.3 DB

권장 변경:

- `enrollment` 결제 메타데이터 컬럼 4종 추가
- 기존 `paymentNoticeStatus` 컬럼은 유지하되 UI 비노출

---

## 4. 단계별 작업 분해

| ID | Task | 영역 | 의존 | 효(d) |
|---|---|---|---|---:|
| T-01 | 목록 API 확장: 검색/필터/페이지네이션 파라미터 + 응답 total 정비 | BE | - | 0.8 |
| T-02 | 이름 검색 로직 구현: 복호화 후 메모리 필터 | BE | T-01 | 0.7 |
| T-03 | 목록형 공통 필터바 + query state + 학년 컬럼 반영 | FE | T-01 | 0.8 |
| T-04 | 목록형 페이지네이션 UI + 목록/칸반 상태 공유 | FE | T-03 | 0.5 |
| T-05 | 칸반형 공통 필터 연동 | FE | T-03 | 0.4 |
| T-06 | 접수 단계 structured prior score UI 개편 (ISEE/SSAT/Duolingo/TOEFL/SAT/기타) | FE | - | 1.0 |
| T-07 | 첨부파일 미리보기 모달 | FE | T-06 | 0.4 |
| T-08 | 레벨테스트 결과/PDF 미리보기 + 시험종류 추가 UX | FE | - | 0.9 |
| T-09 | enrollment 스키마/API 확장: 결제일/방법/금액/비고 저장 | DB/BE | - | 0.9 |
| T-10 | 등록/결제 화면 단순화 + 결제 정보 폼 반영 | FE | T-09 | 0.8 |
| T-11 | `CLASS_STARTED` 수강현황 아코디언 패널 구현 | FE | T-06,T-08,T-10 | 0.8 |
| T-12 | i18n/회귀점검/권한검증 | FE/BE | 전체 | 0.8 |

**총 추정**: 약 8.8 man-day

---

## 5. 마일스톤

| 마일스톤 | 완료 기준 |
|---|---|
| M1 목록 개선 | 검색/필터/목록형 페이지네이션 동작, 칸반 연동 완료 |
| M2 상세 입력 개선 | 접수 structured score + 첨부/결과 미리보기 + 시험추가 완료 |
| M3 등록/결제 개선 | 결제 메타데이터 저장 + 화면 단순화 완료 |
| M4 수강현황 | `CLASS_STARTED` 요약 아코디언 + 회귀 검증 완료 |

---

## 6. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 암호화된 이름 검색으로 SQL 인덱스 활용 불가 | 중 | v1 은 복호화 후 메모리 필터, 후보군은 SQL 필터로 축소 |
| 칸반에 페이지네이션을 억지로 넣으면 stage 해석 왜곡 | 중 | 이번 범위에서는 목록형만 페이징 |
| 결제 메타데이터와 `tuitionPaid` 권한 경계 혼동 | 중 | 저장과 납부완료 체크를 분리, `tuitionPaid` 가드 유지 |
| 큰 PDF/이미지 미리보기 시 브라우저 메모리 사용 증가 | 저 | 모달 close 시 object URL revoke |
| intake prior score shape 가 summary/PDF 와 어긋날 가능성 | 중 | 저장 key naming 을 문서에서 먼저 고정 |

---

## 7. 검증 계획

### 7.1 Backend

- 목록 API 검색/필터/페이지네이션 응답 검증
- 이름 검색: 학생명/학부모명 부분일치 케이스
- enrollment 결제 메타데이터 저장 검증
- `tuitionPaid` 권한 가드 회귀 검증

### 7.2 Frontend

- 목록형/칸반형 토글 시 검색/필터 유지
- 목록형 페이지 이동/필터 변경 시 query sync
- 접수 structured score 값 저장/재진입 복원
- 파일 미리보기 모달 이미지/PDF 정상 렌더
- 레벨테스트 시험종류 추가 후 결과입력 가능 여부
- `CLASS_STARTED` 수강현황 accordion 렌더 확인

### 7.3 수동 운영 시나리오

1. 퍼블릭 상담신청으로 생성된 건을 목록에서 검색
2. 접수 단계 이전점수/첨부 업로드
3. 레벨테스트 시험 추가 및 PDF 미리보기
4. 등록/결제 정보 저장
5. 수강 시작 후 전체 요약 확인

---

## 8. 적용 순서

1. 요구사항/화면안 승인
2. DB migration 작성 및 로컬 적용
3. Backend 목록/결제 확장
4. Frontend 목록 개선
5. Frontend 상세 개선
6. 로컬 QA
7. 스테이징 검수
8. 프로덕션 반영

---

## 9. 구현 시 후속 권고

- 이름 검색 사용량이 늘면 blind-index 컬럼 도입 검토
- 결제가 복수 회차로 바뀌면 `enrollment` 1:1 확장에서 분리하여 `payment` 1:N 테이블로 승격
- 수강현황 요약이 운영자에게 유용하면 추후 PDF 출력 기능으로 확장 가능
