---
document_id: CSL-PLN-260903D
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903D-csl-prior-score-and-skip.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료 — 로컬 e2e(무점수 2→3단계 201, MAP+ISEE 2행 결정론, ISEE 입력 후 MAP 보존, INTAKE 직행 게이트 400 유지) 통과, acm-csl spec 82건 통과
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903D — 이전점수 일관화 + 레벨테스트 스킵 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안 — 변경 최소)

### 1.1 레벨테스트(2단계) 안내 문구 (기존 skipHint 갱신)

```
│ 2. 레벨테스트                                                  │
│ ※ 이전 점수가 있거나 레벨테스트를 미진행 처리한 경우에도            │
│   [데모수업] 버튼으로 다음 단계로 이동할 수 있습니다.               │
│ ┌ MAP    [진행완료 ▼] [점수 입력] … ┐                           │
│ └ ISEE   [미진행   ▼]  …          ┘                           │
│                          [데모수업 →]  ← 점수 없이도 활성          │
└──────────────────────────────────────────────────────────────┘
```

접수(1단계) 이전점수 UI는 변경 없음 — 동작만 결정론화(MAP 레벨테스트 점수가 항상 반영).

## 2. Backend (`inquiry.service.ts` 단일 파일)

| # | 위치 | 변경 |
|---|------|------|
| B1 | `getMapTest`(:477) / `upsertMapTest`(:373,380) / `recordMapTestResult` 레거시(:432) | `findOne` 조건에 `testType: 'MAP'` 고정 + 신규 행 생성 시 `testType: 'MAP'` 명시 — 접수 경로가 비MAP 행을 집거나 오염시키지 않음 |
| B2 | `recordLevelTestResultByType`(:591-596) / 레거시(:461-470) | 비MAP 유형 결과 입력 시 `scoreReading/Math/Language` **null 덮어쓰기 제거**(미변경으로 유지) |
| B3 | `assertEntryGate`(:929-949) | `fromStage === 'MAP_TEST'` 분기 **삭제** — 2→3단계는 항상 허용(미진행 포함 운영자 판단). `INTAKE → TRIAL_CLASS` 스킵 분기는 유지하되 조회에 `testType:'MAP'` 적용(B1과 일관) |

새 테이블·마이그레이션 없음. 기존 spec 영향 확인(acm-csl 테스트 전체 실행).

## 3. Frontend (frontend-acm)

| # | 파일 | 변경 |
|---|------|------|
| F1 | `csl.json` 4 locale `detail.levelTest.skipHint` | "이전 점수가 있거나 미진행 처리한 경우에도 데모수업으로 이동할 수 있습니다"로 갱신 |

(전환 버튼은 원래 비활성화가 없어 백엔드 게이트 완화만으로 동작. 접수 패널·점수 입력 잠금 UI는 무변경.)

## 4. Order & Verification (순서·검증)

1. B1~B3 → `tsc` + acm-csl spec 전체
2. 로컬 e2e:
   - **이전점수 결정론**: 상담에 MAP+ISEE 2행 생성 → MAP 결과 입력 → 접수 `GET /map-test`가 항상 MAP 행(점수 포함) 반환 확인, ISEE 결과 입력 후 MAP 점수 보존 확인(B2)
   - **스킵**: MAP_TEST 단계에서 점수 없이(전부 미진행) `POST /transitions {toStage:'TRIAL_CLASS'}` → 200 확인. INTAKE→TRIAL_CLASS 게이트는 기존대로 400 유지 확인
3. F1 → build → PR

리스크: 게이트 완화로 점수 없는 전환이 가능해짐 — 요구사항 자체가 운영자 판단 허용이며, 진행완료 시에만 점수 입력 가능한 UI 잠금은 유지되어 데이터 품질 영향 없음. 예상 규모: 백엔드 1파일, 프론트 i18n 4파일, 문서 2.
