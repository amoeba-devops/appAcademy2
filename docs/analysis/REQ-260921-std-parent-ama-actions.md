---
document_id: STD-REQ-260921
version: 0.2.0
status: CANCELLED (2026-09-21 사용자 결정 — "학부모 수정건은 작업 진행 필요 없음"). 현행(전원 수정·삭제 가능) 유지
date: 2026-09-21
related:
  - docs/analysis/REQ-260914G-csl-delete-and-site-attribution.md (선례 — 상담 삭제 AMA 계정 전용)
  - docs/plan/PLN-260914G-csl-delete-and-site-attribution.md
change_log:
  - 2026-09-21 v0.2.0 취소 — 사용자 결정으로 작업 진행하지 않음. 문서는 현행 분석 기록으로 보존 (Claude Code)
  - 2026-09-21 v0.1.0 초안 — 학부모 수정·삭제를 AMA 연동 계정에게만 부여 (Claude Code)
---

# REQ-260921 — 학부모 관리: 수정·삭제를 AMA 운영자 계정에 부여 / Parent edit·delete for AMA-linked accounts

## 1. Requirement (요구사항)

`/admin/std/parents` 학부모 관리 화면의 **삭제 / 수정 기능을 AMA 운영자로 로그인한 사용자에게 부여**한다.

## 2. As-Is (현행 — 2026-09-21 코드 실측)

| 계층 | 항목 | 현재 |
|---|---|---|
| Backend | `PUT /acm/std/parents/:id` (수정) | **권한 게이트 없음** — 로그인한 콘솔 사용자(ADMIN·TEACHER·STAFF) 누구나 호출 가능 ([parent.controller.ts:55-63](../../backend/src/modules/acm-std/presentation/parent.controller.ts#L55-L63)) |
| Backend | `DELETE /acm/std/parents/:id` (삭제) | **권한 게이트 없음** — 동일. 소프트 삭제(`deleted_at`), 자녀 연결은 FK cascade ([parent.controller.ts:65-72](../../backend/src/modules/acm-std/presentation/parent.controller.ts#L65-L72)) |
| Backend | `POST /acm/std/parents/:id/ama-client` | `@Roles('ADMIN','STAFF')` — 유일하게 역할 제한 |
| Frontend | 목록 행의 ✎ 수정 · 🗑 삭제 버튼 | **모든 사용자에게 노출**. 삭제는 **자녀가 연결된 학부모면 비활성**(UI 만, 서버는 막지 않음) ([parent-list-page.tsx:143-170](../../frontend-acm/src/modules/std/pages/parent-list-page.tsx#L143-L170)) |
| Frontend | 수정 모달 | 이름·관계·전화·이메일 + **포털 계정 발급 패널**(`PortalAccountPanel`) 포함 |
| 인증 | AMA 판정 수단 | `amb_acm_user.auth_source ∈ {local, ama}` 가 JWT·`CurrentUser`·프론트 스토어에 이미 실려 있음(260914G). 서버 게이트 `AmaAccountGuard`(403 `AMA_ACCOUNT_REQUIRED`) 재사용 가능 |

즉 현재는 "부여되지 않은" 상태가 아니라 **누구에게나 열려 있는** 상태다. 요구의 취지는 260914G(상담 삭제)와 같이 **AMA 연동 계정에게만 허용**하는 것으로 해석한다(§4 Q-1).

## 3. To-Be (목표)

| # | 항목 | 내용 |
|---|---|---|
| T-1 | 서버 게이트 | `PUT` · `DELETE /acm/std/parents/:id` 에 `AmaAccountGuard` 적용 → AMA 연동 계정이 아니면 **403** |
| T-2 | 버튼 노출 | 목록의 ✎ · 🗑 버튼을 **`authSource === 'ama'` 사용자에게만** 렌더. 비대상 사용자에게는 열 자체를 숨기지 않고 `—` 표시(레이아웃 유지) |
| T-3 | 판정 기준 | 260914G 와 동일하게 **계정 기준**(`auth_source='ama'`). 이번 로그인이 로컬 비밀번호여도 AMA 연동 계정이면 허용. 역할(ADMIN/STAFF/TEACHER)은 보지 않는다 |
| T-4 | 자녀 연결 학부모 삭제 | **현행 유지** — 자녀가 연결돼 있으면 삭제 비활성(안내 툴팁). 학생 상세에서 연결 해제 후 삭제 (§4 Q-2) |
| T-5 | i18n | 신규 문자열(비대상 안내 툴팁)은 ko/en/vi/zh-CN 4 locale |

## 4. Open Questions (확인 요청)

| Q | 내용 | 기본안 |
|---|---|---|
| **Q-1** | "부여"의 의미 — **(A)** AMA 연동 계정에게만 허용하고 그 외 콘솔 계정은 수정·삭제 불가(260914G 와 동일) / **(B)** 현행(전원 허용) 유지하되 AMA 계정에 추가 권한 | **A** |
| **Q-2** | 자녀가 연결된 학부모 삭제 — 현재 UI 에서 막혀 있음. AMA 계정에게는 **연결 학부모도 삭제 허용**할지(삭제 시 자녀와의 연결도 함께 제거됨) | **현행 유지(불허)** |
| **Q-3** | 수정 모달 안의 **포털 계정 발급 패널**도 AMA 계정 전용이 되는데 괜찮은지 (수정 버튼 자체가 숨겨지므로) | 함께 제한 |
| **Q-4** | 학생 상세 화면의 학부모 서브폼(학생 저장 시 학부모 정보 동기화)은 이번 범위 밖 — 그대로 둘지 | 범위 밖 |

## 5. Acceptance Criteria (인수 조건)

- **AC-1** AMA 연동 계정(`auth_source='ama'`)만 학부모 수정·삭제 API 를 호출할 수 있다. 그 외는 403 `AMA_ACCOUNT_REQUIRED`.
- **AC-2** 목록의 수정·삭제 버튼은 AMA 연동 계정에게만 보인다. 비대상 계정에는 `—` 와 안내 툴팁.
- **AC-3** 삭제는 기존과 같이 소프트 삭제이며, 자녀 연결 학부모는 삭제 버튼 비활성(Q-2 기본안).
- **AC-4** 조회(`GET`)·AMA 고객사 등록(`ama-client`)은 변경 없음.
- **AC-5** 신규 UI 문자열 4 locale.
