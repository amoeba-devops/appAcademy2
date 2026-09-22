---
document_id: CSL-PLN-260922E
version: 1.0.0
status: IMPLEMENTED (PR 대기)
date: 2026-09-22
depends_on: docs/analysis/REQ-260922E-csl-stage-hints-skip-trial.md
change_log:
  - 2026-09-22 v1.0.0 구현 (Claude Code)
---

# PLN-260922E — 단계별 입력 요건 안내 · 데모수업 건너뛰기 / Implementation Plan

## 1. Changes

| # | 작업 | 파일 |
|---|---|---|
| B-1 | `ChangeStageDto.skipTrialClass?: boolean` | `dto/inquiry.dto.ts` |
| B-2 | `forwardStage(..., opts:{skipTrialClass, actorRole})` — 대상 단계·역할 검증, 게이트 우회, note 기록 | `inquiry.service.ts`, `inquiry.controller.ts` |
| F-1 | 상세 헤더 단계 버튼 아래 요건 안내 (`csl:transition.hints.*`) | `csl-detail-page.tsx` |
| F-2 | 3단계 패널 [데모수업 없이 등록상담 진행] (ADMIN·STAFF, 확인 대화상자, 오류 번역) | `trial-class-panel.tsx` |
| F-3 | i18n ko/en/vi/zh-CN — hints 7종, errors 2종, trial 4종 | `i18n/locales/*/csl.json`, `lib/api-error.ts` |

## 2. UI 구성안

```
[→ 4. 등록 상담]
4. 등록 상담 · 데모수업 기록 1건 (3단계 패널에서 추가) — 또는 3단계 패널의 [데모수업 없이 등록상담 진행]

┌ 3. 데모수업 ─────────────────────────────────────────────┐
│ 등록된 데모수업이 없습니다.                                  │
│ ┌ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┐ │
│ │ 데모수업을 진행하지 않고 등록상담으로 넘길 수 있습니다  │ │
│ │ (운영자 판단, 전환 이력에 기록됩니다).                  │ │
│ │ [ 데모수업 없이 등록상담 진행 ]  ← ADMIN·STAFF 만        │ │
│ └ - - - - - - - - - - - - - - - - - - - - - - - - - - - ┘ │
│ 데모수업 추가  예정일 [    ] 시간 [    ] 담당강사 [ ▾ ] [추가]│
└──────────────────────────────────────────────────────────┘
```

## 3. Verification

- backend tsc · eslint · jest acm-csl / frontend tsc · eslint · prettier
- 배포 후: 상담 107(eeb924d9…) 3단계 패널에서 버튼 → 4단계 이동, 이력 note 확인
