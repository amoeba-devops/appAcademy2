---
document_id: CSL-FIX-260922B
version: 1.0.0
status: FIXED (배포 진행)
date: 2026-09-22
---

# FIX-260922B — 상담 단계 전환 400 사유가 화면에 보이지 않음 / Stage-transition 400 reason not surfaced

## 1. Symptom (증상)

`/admin/csl/eeb924d9-…`(접수번호 107, 3단계 데모수업) 에서 다음 단계로 이동 시 콘솔에 `Failed to load resource: 400` 만 찍히고 화면에는 사유가 없다. nginx 로그: `POST /api/acm/csl/inquiries/eeb924d9…/transitions → 400` 3회(02:35:44, 02:38:14, 02:39:36Z). 같은 시각 다른 상담(24a08800…)에서도 3회.

## 2. Root Cause (원인)

| # | 원인 | 근거 |
|---|---|---|
| R-1 | **업무 규칙 게이트**: 3단계(데모수업) → 4단계(수강상담) 전환은 **데모수업 기록 1건 이상**을 요구한다(acm-req-csl-001 v2.1 §4.1). 해당 상담은 02:35:42~43 에 접수→레벨테스트→데모수업으로 연속 전환된 직후 데모수업 기록 0건 상태에서 4단계 이동을 시도 | `assertEntryGate`, `amb_acm_csl_trial_class` 0건, `amb_acm_csl_transition` 이력 |
| R-2 | **사유 미표시(버그)**: 프론트 `onError` 가 `response.data.message` 를 읽는데, 실제 응답은 `{ success:false, error:{ code, message } }` 라 항상 undefined → axios 기본 문구("Request failed with status code 400")만 저장되고 사용자는 이유를 알 수 없음 | `csl-detail-page.tsx` forward/reactivate, `class-status-summary-panel.tsx` |
| R-3 | 서버 오류가 영문 자유 문장이라 번역 불가 | `inquiry.service.ts` |

## 3. Fix (수정)

- 백엔드: 전환 거부 7종에 안정적인 `code` 부여 — `TRANSITION_NOT_ALLOWED`, `ANONYMOUS_CANNOT_PROGRESS`, `GATE_TRIAL_SKIP_REQUIRES_MAP`, `GATE_TRIAL_CLASS_REQUIRED`, `GATE_COUNSEL_NOT_DONE`, `GATE_TUITION_NOT_PAID`, `GATE_STUDENT_NOT_REGISTERED` (message 는 그대로 유지).
- 프론트: 공용 `transitionErrorMessage()` — `error.code` → `csl:transition.errors.<code>`(ko/en/vi/zh-CN), 없으면 서버 message. 상세 헤더 단계 버튼·재개·[수강등록완료] 에 적용.
- 규칙 자체(데모수업 1건 필요)는 유지. 완화 여부는 별도 결정(§4).

## 4. Operator Note / Open Question (운영 안내·결정)

- 지금 해당 상담을 진행하려면 **3단계 패널에서 데모수업을 1건 등록**한 뒤 4단계로 이동한다.
- REQ-260903D 에서 2→3단계 게이트는 "운영자 판단으로 미진행 포함 허용"으로 완화했다. 3→4단계도 **데모수업 없이 바로 수강상담**을 허용할지는 정책 결정이 필요하다(허용 시 게이트 한 줄 제거).
