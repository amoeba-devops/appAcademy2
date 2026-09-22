---
document_id: CSL-REQ-260922E
version: 1.0.0
status: CONFIRMED (2026-09-22 사용자 요구 — 즉시 구현)
date: 2026-09-22
related:
  - docs/bug-fix/FIX-260922B-csl-transition-error-message.md
  - docs/analysis/REQ-260903D-csl-prior-score-and-skip.md (2→3단계 게이트 완화 선례)
change_log:
  - 2026-09-22 v1.0.0 요구 접수·구현 (Claude Code)
---

# REQ-260922E — 단계별 입력 요건 안내 · 데모수업 없이 등록상담 진행 / Stage input hints & skip trial class

## 1. Requirement (요구사항 — 사용자 원문)

> 정보 입력 없이 다음 단계 진행 시 에러코드를 각 단계별로 해야 할 입력내용 안내문구 표시할 것
> 3단계 - 데모수업 - 관리자가 데모수업 없이 등록상담으로 진행 가능한 버튼 추가 (운영자 판단으로 데모수업 없이도 상담 등록 진행되어야 함)

## 2. As-Is

- FIX-260922B 로 전환 거부 시 사유(`code`)를 번역해 표시하기 시작했으나, **누르기 전에는** 무엇을 입력해야 하는지 알 수 없다.
- 3→4단계(등록상담)는 데모수업 기록 1건이 필수라 데모수업을 건너뛰는 학생은 진행 불가. 2→3단계는 REQ-260903D 에서 "운영자 판단으로 미진행 포함 허용"으로 완화된 선례가 있다.

## 3. To-Be

| # | 항목 | 내용 |
|---|---|---|
| T-1 | **단계별 입력 요건 안내** | 상세 헤더의 `→ 다음 단계` 버튼 아래에 이동 가능한 각 단계의 **진입 요건**을 상시 표시 (4 locale). 거부 시에는 FIX-260922B 의 코드별 사유가 추가로 표시 |
| T-2 | **데모수업 없이 등록상담 진행** | 3단계 패널에 데모수업 기록이 0건일 때 **[데모수업 없이 등록상담 진행]** 버튼(확인 대화상자). `POST /transitions { toStage:'ENROLLMENT_COUNSELING', skipTrialClass:true }` — 서버가 게이트를 우회하고 전환 이력 note 에 "데모수업 없이 등록상담 진행 (운영자 판단)" 기록 |
| T-3 | 권한 | 버튼·API 모두 **ADMIN·STAFF(·APP_ADMIN)** 만. TEACHER 는 403 `SKIP_TRIAL_FORBIDDEN` |
| T-4 | 범위 제한 | `skipTrialClass` 는 등록상담 단계로 갈 때만 유효(그 외 400 `SKIP_TRIAL_ONLY_FOR_COUNSELING`). 다른 게이트(수강상담 완료·수강료·학생 등록)는 그대로 |

## 4. Assumption (가정)

"관리자" = 콘솔 역할 ADMIN·STAFF (강사 TEACHER 제외). 다르게 원하시면 역할 목록 한 줄 조정.

## 5. Acceptance Criteria

- AC-1 상세 헤더에서 이동 가능한 다음 단계마다 입력 요건 문구가 보인다(4 locale).
- AC-2 3단계 패널에서 ADMIN·STAFF 가 [데모수업 없이 등록상담 진행] → 확인 → 4단계로 이동하고 전환 이력에 note 가 남는다.
- AC-3 TEACHER 는 버튼이 보이지 않고 API 호출 시 403.
