---
document_id: DSN-260629-csl-stage-screen-revision
version: 0.1.0-draft
status: Draft (사용자 확인 대기)
created: 2026-06-29
product_code: ACM
title: CSL 상담관리 단계별 화면 재설계 — 접수 풀-필드 표시 + 동적 점수칸 + 단계 navigate
modules:
  - CSL
authors:
  - gray.kim@amoeba.group (요구)
  - Claude (작성)
related:
  - docs/analysis/REQ-260626-acm-csl-pipeline-revision.md (FR-CSL-101~109)
  - docs/design/DSN-260626-acm-csl-pipeline-revision.md v1.2.1 (§4 화면 spec)
  - docs/implementation/RPT-260626-csl-pipeline-revision-rollout.md (1차 권식)
target_inquiry: 7598e1cb-3515-434e-9c75-e08f1cd2a974 (사용자 검증용 production inquiry)
change_log:
  - { version: 0.1.0-draft, date: 2026-06-29, author: Claude, notes: "초안 — 운영자 추가 요구 3건 (접수 풀-필드 / 동적 점수칸 / stepper navigate) 반영. 사용자 확인 후 구현 진행" }
---

# DSN-260629 — CSL 단계별 화면 재설계

## 1. 배경

REQ-260626 1차 권식 (PR #59~#73) 후 운영자가 production 에서 검증하던 중 3가지 화면 구성 갭 발견:

> "1단계 접수화면에서는 접수된 내용이 모두 출력되어야 함.
> 접수시 선택한 시험종류에 따른 기존 점수 입력항목이 각 시험별로 생성되어야 함.
> 각 단계는 작성 후 해당 단계를 클릭하면 해당 단계 입력/저장된 내용이 보여야 함."

본 문서는 위 3건을 DSN-260626 §4 와 정합시켜 화면 spec 을 재정의한다.

---

## 2. 현 구현 vs 요구 갭 분석

### 2.1 갭 GAP-01 — INTAKE 패널이 접수 정보를 표시하지 않음

| 항목 | 요구 (DSN-260626 §4.1) | 현 구현 (PR #65) |
|---|---|---|
| 학생 이름 | 패널 내 표시 | ⚠ 헤더 (`displayName`) 에만 |
| 학년 | 패널 내 표시 | ⚠ 헤더 부속 |
| 보호자 이름·전화·상태 | 패널 내 표시 | ⚠ 헤더 부속 |
| 학교 / 유입경로 / 신청유형 | 패널 내 표시 | ⚠ 헤더 부속 |
| **신청 목적 multi-select** | **패널 내 표시 + 점수칸 분기** | ❌ **표시 안 됨** |
| 응시료/응시예정일/응시상태 | 제거됨 (→ 2단계) | ✅ INTAKE 에서 hidden |
| 성적표 멀티 업로드 | stub 노출 | ✅ TranscriptUploadStub (T-06 의존) |

→ **결과**: 운영자가 INTAKE 단계에서 인콰이어리 내용을 한눈에 검토할 수 없음. 헤더에 일부만 표시되고 패널은 점수 입력만 보임.

### 2.2 갭 GAP-02 — 동적 점수칸 미작동 (FR-CSL-101/102/103)

| 신청목적 | 요구 점수칸 | 현 구현 |
|---|---|---|
| MAP TEST Tutoring | Reading/Math/Language Usage (영문, 100~350) | ✅ INTAKE 에 항상 노출 |
| **ISEE Tutoring** | **Verbal/Reading/Quantitative/Mathematics** | ❌ INTAKE 에 없음 (MAP_TEST 단계 LevelTestScoreEditor 에만) |
| International School Admission Prep | 없음 (입학준비, 점수 무) | ✅ |
| Customized GPA Management | 없음 | ✅ |
| Advanced Courses (SSAT/Duolingo/…) | 시험별 점수 (분기) | ❌ INTAKE 에 없음 |

→ **결과**: 접수 시점에서 ISEE 신청자가 자신의 ISEE 이전 점수를 입력할 수단이 없음. 운영자가 2단계(레벨테스트) 진입 후에야 입력 가능.

### 2.3 갭 GAP-03 — Stepper 가 상태표시 전용, 클릭으로 단계 navigate 안 됨

요구: "각 단계는 작성 후 해당 단계를 클릭하면 해당 단계 입력/저장된 내용이 보여야 함."

현 구현 ([csl-stage-stepper.tsx](frontend-acm/src/modules/csl/components/csl-stage-stepper.tsx)): stage 칩이 `<li><div>` 로 렌더, 클릭 핸들러 없음 (display-only).

현 패널 분기 ([csl-detail-page.tsx](frontend-acm/src/modules/csl/pages/csl-detail-page.tsx)):
```tsx
{(inq.currentStage === 'MAP_TEST' || inq.currentStage === 'INTAKE') && <MapTestPanel ...>}
{inq.currentStage === 'TRIAL_CLASS' && <TrialClassPanel ...>}
{(inq.currentStage === 'ENROLLMENT_COUNSELING' || inq.currentStage === 'PAYMENT'
  || inq.currentStage === 'CLASS_STARTED') && <EnrollmentPanel ...>}
```

→ `currentStage` 1개로 패널이 결정됨. PAYMENT 단계 진입 후 운영자가 데모수업 피드백을 다시 보려면 backward transition 외 방법 없음.

DSN-260626 §4.1 표기 "상단 스테퍼: ... ← 상태표시 전용" 와 운영자 요구가 충돌 — **사용자 요구 우선**으로 정정.

---

## 3. TO-BE 화면 구성안

### 3.1 단계 라우팅 모델 (GAP-03 해소)

**선택된 단계 (selectedStage)** 와 **현재 단계 (currentStage)** 를 분리:
- `currentStage` (서버 truth) — 인콰이어리의 실제 진행 단계, 다음 단계 전이 게이트
- `selectedStage` (UI state) — 운영자가 stepper 에서 클릭한 단계, 패널 표시 결정

기본값: `selectedStage = currentStage`. stepper 클릭 시 selectedStage 만 갱신, 서버 transition 은 발생 안 함.

라우팅:
- INTAKE 패널 — `IntakeStagePanel` (신규, 아래 §3.2)
- MAP_TEST 패널 — `LevelTestPanel` (기존 MapTestPanel 의 MAP_TEST 분기 ↔ 동일)
- TRIAL_CLASS 패널 — `TrialClassPanel`
- ENROLLMENT_COUNSELING 패널 — `EnrollmentPanel` (등록상담 사용)
- PAYMENT 패널 — `EnrollmentPanel` + `PaymentApprovalBlock` (현행)
- CLASS_STARTED 패널 — `EnrollmentPanel` read-only

stepper 칩에 `<button>` 으로 onClick → `setSelectedStage(stage)`. 이미 currentStage 도달한 단계(과거 + 현재) 만 클릭 가능, 미래 stage 는 disabled.

### 3.2 SCR-CSL-01 v2 — 접수 패널 풀-필드 (GAP-01 + GAP-02)

신규 컴포넌트 `IntakeStagePanel` (`map-test-panel.tsx` 의 isIntake 분기 분리).

```
┌────────────────────────────── 1. 접수 ──────────────────────────────────┐
│ ── 접수 정보 (운영자 검토용 read-only 박스) ─────────────────────────── │
│  학생: 홍길동           학년: 중1         보호자: 홍부모                │
│  전화: 010-1234-5678  (상태: PROVIDED)   유입: HOMEPAGE                 │
│  학교: ○○중            신청유형: COUNSELING_ONLY                       │
│  등록일: 2026-06-29     상담완료: NO                                    │
│  익명 인콰이어리: NO                                                    │
│                                                                         │
│ ── 신청 목적 (다중 선택) ─────────────────────────────────────────────  │
│  [✔] MAP TEST Tutoring                                                  │
│  [✔] ISEE Tutoring                                                      │
│  [ ] International School Admission Prep                                │
│  [ ] Customized GPA Management                                          │
│  [ ] Advanced Courses                                                   │
│  ※ INTAKE 후 신청 목적 수정 시 [ 수정 ] 버튼 → 인콰이어리 update endpoint │
│                                                                         │
│ ── 이전 점수 (선택 목적에 따라 동적 노출) ────────────────────────────  │
│  MAP TEST Tutoring 선택 시:                                             │
│     Reading [___]  Math [___]  Language Usage [___]   (100~350)         │
│  ISEE Tutoring 선택 시 (Q-CSL-103 기본 입력):                           │
│     Verbal [__]  Reading [__]  Quantitative [__]  Mathematics [__]      │
│     (Scaled 760~940; Percentile / Stanine 은 2단계 LevelTestEditor 에서)│
│  Advanced Courses 선택 시 (SSAT/Duolingo/TOEFL 등):                     │
│     "기존 점수 보유" 체크 → 시험명 자유입력 + 점수 JSON / 자유입력      │
│  ※ 선택 안 한 목적에 대응되는 점수칸은 렌더링 안 함                     │
│                                                                         │
│ ── 성적표 첨부 (멀티) ─────────────────────────────────────────────────  │
│  [stub — T-06 S3 인프라 의존] 현재 disabled drop zone                    │
│                                                                         │
│                                    [  저장  ]  [ 다음 단계 ▶ 레벨테스트 ]│
└─────────────────────────────────────────────────────────────────────────┘
```

**구성 요소 매핑**

| 요소 | 컴포넌트 | 데이터 소스 | FR |
|---|---|---|---|
| 접수 정보 박스 | `IntakeReadOnlyBox` (신규) | `GET /acm/csl/inquiries/:id` | (운영자 검토) |
| 신청 목적 multi-select | `ApplyPurposesCheckboxes` (신규) | inquiry `applyPurposes` 필드 | FR-CSL-101 |
| MAP 점수 R/M/L | 기존 (영문 라벨, 100~350) | mapTest `scoreReading/Math/Language` | FR-CSL-102 |
| **ISEE 4-section** | **NEW INTAKE 분기** | mapTest `scoreDetail` (key `isee_intake`) | FR-CSL-103 |
| Advanced 시험 (SSAT/Duolingo/TOEFL) | 기존 점수 보유 시 LevelTestScoreEditor 의 OTHER 변형 + 시험명 freetext | mapTest `scoreDetail` JSONB | FR-CSL-101 |
| 성적표 첨부 | TranscriptUploadStub (T-06 의존) | — | FR-CSL-105 |
| 저장 + 다음단계 | 기존 (PUT /map-test + forward) | — | FR-CSL-108/109 |

**ISEE intake 점수 데이터 구조 결정**:
- INTAKE 단계의 ISEE "이전 점수" 는 4 영역 의 Scaled 1 지표만 (DSN-260626 §5.6 ISEE 의 3 지표 중 Scaled).
- `mapTest.scoreDetail` JSONB 의 `iseeIntake` 키에 저장:
  ```json
  { "iseeIntake": { "verbal": 850, "reading": 870, "quantitative": 830, "mathematics": 880 } }
  ```
- 2단계 LevelTestEditor 에서는 percentile + stanine 까지 채워 정식 ISEE 객체로 저장 (다른 키 `verbal: { scaled, percentile, stanine }` 형태).

**Advanced 시험 (SSAT/Duolingo/TOEFL/...) intake 데이터 구조**:
- `mapTest.scoreDetail.priorAdvanced = { testName: "SSAT", scores: { ... } }` (단일 객체) 또는 다중 시험 시 array
- v1: 시험명 freetext + 점수 자유입력 (validator 없음). v2: per-test 구조화

### 3.3 SCR-CSL-02~05 — 기존 유지

DSN-260626 §4.2~4.5 그대로. selectedStage navigate 만 추가 (§3.1).

---

## 4. 작업 계획 (WBS)

| ID | 작업 | 영역 | 효(d) | 의존 |
|---|---|---|---|---|
| TR-01 | csl-detail-page 에 `selectedStage` state + stepper onClick navigate | FE | 0.5 | — |
| TR-02 | csl-stage-stepper 에 onClick 핸들러 + disabled 상태 (currentStage 이전/포함만 활성) | FE | 0.5 | TR-01 |
| TR-03 | `IntakeReadOnlyBox` 컴포넌트 — inquiry 필드 read-only display | FE | 0.5 | — |
| TR-04 | `ApplyPurposesCheckboxes` — multi-select + 변경 시 inquiry update endpoint 호출 | FE | 1 | TR-03 |
| TR-05 | `IntakeStagePanel` — MapTestPanel 의 isIntake 분기 분리 + 위 컴포넌트 통합 + 동적 점수칸 | FE | 1 | TR-03/04 |
| TR-06 | ISEE intake 4-section Scaled 입력 (`scoreDetail.iseeIntake`) | FE | 0.5 | TR-05 |
| TR-07 | Advanced 시험 intake (시험명 freetext + 점수 자유입력) | FE | 0.5 | TR-05 |
| TR-08 | csl-detail-page 분기 로직을 `selectedStage` 기준으로 swap + IntakeStagePanel 사용 | FE | 0.3 | TR-01~07 |
| TR-09 | 4 locale i18n 신규 키 (intake.readOnly / intake.applyPurposes / intake.iseeIntake / intake.advanced / stepper.notReached 등) | FE | 0.5 | TR-05+ |
| TR-10 | 검증 spec + 운영자 staging 검증 매트릭스 | QA | 0.5 | TR-08 |

**합계**: ~5.3 영업일

### 4.1 백엔드 변경 (최소)

- 인콰이어리 update endpoint (`PATCH /acm/csl/inquiries/:id`) 는 이미 존재. `applyPurposes` 수정만 호출하면 됨 (DTO 점검 필요).
- `scoreDetail.iseeIntake` / `scoreDetail.priorAdvanced` 키는 validator 가 수용해야 함. 현 `level-test-score.validator.ts` 는 MAP/ISEE/SSAT/.../OTHER type 분기 — INTAKE 의 type 은 항상 `MAP` (기본) 이므로 validator 는 `scoreDetail` 거부함. **새 키 `priorScoresDetail` 별도 컬럼/JSONB** 추가하거나 validator 를 INTAKE-aware 하게 분기 필요.

**선택지**:
- **A**. `mpt_prior_scores_detail JSONB` 컬럼 신규 추가 (sql/acm/986-...) — clean 분리
- **B**. 현 `scoreDetail` 재사용하되 validator 의 INTAKE-aware 모드 (`testType='MAP'` + `scoreDetail` 허용) 추가 — 마이그레이션 없음

**권장 A** — INTAKE intake 점수와 MAP_TEST 결과 점수는 의미가 다르므로 컬럼 분리가 향후 PDF/STD 승계 분리에 유리.

### 4.2 의존 / 위험

| 위험 | 완화 |
|---|---|
| 인콰이어리 `applyPurposes` 수정 endpoint 부재 | 현 `PATCH /acm/csl/inquiries/:id` 와 `UpdateInquiryDto` 에 `applyPurposes` 포함 여부 1단계에서 확인 |
| selectedStage 가 currentStage 보다 미래일 때 데이터 비어있음 | UI 에서 "아직 입력되지 않았습니다" 안내 + disabled 처리 |
| stepper 클릭 시 transition 트리거 오해 | onClick 은 selectedStage 만 변경, transition 버튼은 별도 (현행 "→ PAYMENT" 버튼 유지) |
| 새 SQL 마이그레이션 (Option A) | 985 와 별도 986 prefix 사용. additive only |

---

## 5. 사용자 확인 사항

1. **§3.1 단계 navigate 모델** — selectedStage 도입으로 stepper 클릭 시 stage 별 저장 내용 표시. 미래 stage 는 disabled. 동의?
2. **§3.2 IntakeStagePanel 구조** — 접수 정보 read-only 박스 + 신청목적 multi-select + 신청목적 기반 동적 점수칸. 동의?
3. **§4.1 백엔드 데이터 모델 옵션 A vs B** — 신규 `mpt_prior_scores_detail` 컬럼 (A) 권장. 또는 기존 `mpt_score_detail` 재사용 (B). 선택?
4. **TR-07 Advanced 시험 점수 (SSAT/Duolingo/TOEFL)** — INTAKE 에서는 자유입력 form 으로만 받고, 정식 검증은 2단계에서. 동의?
5. **scope** — 본 PR 범위는 위 10 task. 별도 PR 분리?

승인 후 TR-01 부터 착수.
