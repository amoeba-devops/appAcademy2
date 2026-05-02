---
document_id: ACM-REQ-SCH-QNA-P1-FOLLOWUP-1.0.0
version: 1.0.0
status: draft
date: 2026-05-02
related:
  - ACM-REQ-SCH-QNA-P1-1.0.0
  - ACM-PLAN-SCH-QNA-P1-1.0.0
  - ACM-REPORT-SCH-QNA-P1-1.1.0
change_log:
  - 1.0.0 (2026-05-02): initial follow-up requirements (P0 smoke / P1 frontend CRUD + integration specs / P2 toast + i18n)
---

# ACM SCH + QNA P1 — Follow-up Requirements (후속 요구사항)

## 1. Background (배경)

`ACM-REPORT-SCH-QNA-P1-1.1.0` §5 follow-up backlog 의 P0/P1/P2 항목 일괄 해소. v1.4.3 staging 배포는 완료되었으나 다음 잔여 갭이 존재한다:

| 우선순위 | 갭 |
|---|---|
| P0 | 인증된 사용자가 SCH/QNA P1 endpoint 에 접근했을 때 실제 비즈니스 로직 응답이 검증되지 않음 (현재는 라우트 등록 + 401/403 만 확인). |
| P1 | Frontend SCH/QNA 화면이 list-only — Create/Edit/Delete UX 부재. PLAN scope 제외였으나 이제 운영 진입을 위해 필요. |
| P1 | Backend SCH/QNA P1 신규 엔드포인트(escalate/reply/thread/use-faq, school active-CSL guard, school-in-use guard)에 대한 jest integration spec 부재 — 회귀 검출 방어막 없음. |
| P2 | 프론트의 native `confirm()` / `alert()` 2개 site (qna-list-page) — 사용자 경험 일관성 저하. |
| P2 | `categoryLabel()` 이 `ko` / `en` 만 분기 — `vi` / `zh-CN` 라벨 hook 누락 (i18n 4-locale 표준 위반). |

## 2. Goals (목표)

1. **P0**: 자동화된 smoke script (`scripts/smoke-acm-p1.sh`) 로 staging 인증 + SCH·QNA P1 핵심 endpoint 응답 검증.
2. **P1-A**: SCH 모듈 frontend Create/Edit/Delete UX 완성 (school / grade-band / schedule).
3. **P1-B**: QNA 모듈 frontend Create/Edit/Delete UX 완성 (question / category).
4. **P1-C**: Backend SCH/QNA P1 jest integration spec (`it-sch-p1.int-spec.ts`, `it-qna-p1.int-spec.ts`) — 모든 P0 acceptance criteria 커버.
5. **P2-A**: 공통 `Toast` + `ConfirmDialog` 컴포넌트 도입, 모든 native `confirm()`/`alert()` 교체.
6. **P2-B**: `categoryLabel()` 4-locale (ko/en/vi/zh-CN) 지원 + 카테고리 entity 에 `labelVi`/`labelZh` 필드 추가.

## 3. Non-goals (비목표)

- 새 비즈니스 룰/state machine 변경 — 모두 v1.4.3 backend 동작 기반 위에서 UX/테스트 보강만.
- P2 카테고리 4-locale 라벨의 운영 데이터 백필 — DB 컬럼 추가 + 빈 값 fallback ko 까지만 제공, 실제 번역은 운영 follow-up.
- E2E (Playwright) 추가 — int spec + manual smoke 로 충분.
- Frontend SCH 의 학교 시드 자동 import UI — 기존 `sql/acm/200-seed-sch-schools.sql` 로 충분.

## 4. Functional Requirements (기능 요구사항)

### 4.1 P0 — Smoke Script

| ID | 요구사항 | 비고 |
|---|---|---|
| FR-P0-01 | `scripts/smoke-acm-p1.sh <base_url> <token>` 실행 시 SCH/QNA P1 핵심 endpoint 7개 호출 + HTTP code 검증. | bash + curl, jq 만 사용. |
| FR-P0-02 | 검증 endpoint 목록: `GET /api/acm/sch/schools` (200), `POST /api/acm/sch/schools/:id/grade-bands` (201), `POST /api/acm/sch/schools/:id/grade-bands/:id` PATCH (200), `GET /api/acm/qna/questions` (200), `POST /api/acm/qna/questions/:id/reply` (201), `POST /api/acm/qna/questions/:id/escalate` (201), `GET /api/acm/qna/questions/:id/thread` (200). | 데이터는 자동 cleanup. |
| FR-P0-03 | 실패 시 non-zero exit + 상세 출력 (HTTP code, body 일부). | CI 통합 가능. |
| FR-P0-04 | 토큰 미지정 시 환경변수 `ACM_SMOKE_TOKEN` fallback. | local/staging/prod 공통. |

### 4.2 P1-A/B — Frontend CRUD UX

| ID | 요구사항 | 비고 |
|---|---|---|
| FR-P1-01 | SCH School: `+ New School` / `Edit` / `Delete` 동작 가능. | shadcn/Dialog, react-hook-form 미사용 — 기존 패턴 따라 native form. |
| FR-P1-02 | SCH School Delete: 활성 CSL 참조 시 backend 422 → 사용자에게 "Cannot delete: in use" toast 표시. | school-in-use guard 시각화. |
| FR-P1-03 | SCH GradeBand: 학교 모달 내에서 `+ Add` / `Edit` / `Delete`. | grade min/max 검증 (1~12). |
| FR-P1-04 | SCH Schedule: 학교 모달 내에서 `+ Add` / `Edit` / `Delete`. | year/type/dates 입력. |
| FR-P1-05 | QNA Question: `+ New Question` 모달 (subject/body/categoryId). | studentId 는 optional (관리자 직접 등록 한정). |
| FR-P1-06 | QNA Question: 각 row 의 `Edit` 메뉴 추가. | 본인 question 만 (또는 admin). |
| FR-P1-07 | QNA Category: 별도 페이지 또는 sub-route 에서 list + CRUD. | `/qna/categories` route 신설. |
| FR-P1-08 | 모든 모달 submit 후 list refresh + toast 성공 메시지. | UX 일관성. |

### 4.3 P1-C — Backend Integration Specs

| ID | 요구사항 | 비고 |
|---|---|---|
| FR-P1-09 | `backend/test/integration/acm/it-sch-p1.int-spec.ts`: school create/update/delete + isAuthorized toggle + grade-band CRUD + schedule CRUD + school-in-use guard (422). | bootAcmTestEnv 재사용. |
| FR-P1-10 | `backend/test/integration/acm/it-qna-p1.int-spec.ts`: question create/list/get/update/delete + category CRUD + escalate (state OPEN→ESCALATED) + reply (creates child question + parent → RESPONDED) + thread (returns root + replies) + use-faq (returns externalBody + increments use_count). | thread depth 1 으로 충분. |
| FR-P1-11 | setup.ts: pg image 를 `tac-postgres-acm:pg16-bigm` 으로 변경 (sql/acm/100 의 pg_bigm 의존). | testcontainers 가 로컬 이미지 자동 사용. |
| FR-P1-12 | 신규 spec 은 `npm test` 통과 + 기존 73개 회귀 없음. | CI green. |

### 4.4 P2 — UX 일관성 + i18n

| ID | 요구사항 | 비고 |
|---|---|---|
| FR-P2-01 | `frontend-acm/src/components/ui/toast.tsx` 신설 — Provider + `useToast()` hook. | 5초 auto-dismiss, success/error/info variant. |
| FR-P2-02 | `frontend-acm/src/components/ui/confirm-dialog.tsx` 신설 — Promise 기반 (`confirm({ title, message, danger? }) => Promise<boolean>`). | 기존 Dialog primitive 재사용. |
| FR-P2-03 | `qna-list-page.tsx` 의 `confirm('Delete?')` → `await confirm({ title, message, danger: true })` 교체. | i18n 키화. |
| FR-P2-04 | `qna-list-page.tsx` 의 `alert((e as Error).message)` → `toast.error(...)` 교체. | i18n 키화. |
| FR-P2-05 | `qna_category` table 에 `label_vi`, `label_zh` 컬럼 추가 (NULLABLE). | 마이그레이션 `sql/acm/420-acm-qna-i18n-labels.sql`. |
| FR-P2-06 | `categoryLabel(id)` 4-locale 분기 (`vi`/`zh-CN` 추가, `ko` fallback). | DTO/entity 도 동기화. |

## 5. Non-Functional Requirements (비기능)

| ID | 요구사항 |
|---|---|
| NFR-01 | 모든 frontend 추가 컴포넌트 i18n 키 4-locale (ko/en/vi/zh-CN) 등록 — 누락 시 ko fallback. |
| NFR-02 | TypeScript strict; `any` 금지. |
| NFR-03 | 신규 SQL 마이그레이션 idempotent (`ADD COLUMN IF NOT EXISTS`). |
| NFR-04 | 신규 jest spec timeout = 180s (testcontainers boot). |
| NFR-05 | smoke script bash 호환 (zsh/bash on macOS 14+, Ubuntu 22+). |

## 6. Acceptance Criteria (인수 기준)

- [AC-01] Staging 에서 `scripts/smoke-acm-p1.sh https://acm-stg.amoeba.site $TOKEN` 실행 → exit 0, 7개 endpoint 모두 OK.
- [AC-02] Frontend `/sch` → `+ New School` 클릭 → 모달 → 저장 → 리스트 즉시 반영.
- [AC-03] Frontend `/sch` → 학교 행 Edit → isAuthorized 토글 → 저장 → 행 뱃지 변경.
- [AC-04] Frontend `/sch` → 학교 Delete (active CSL 참조 학교) → toast "Cannot delete: in use".
- [AC-05] Frontend `/sch` → 학교 모달 → grade-bands tab → `+ Add` → 저장 → 카운트 증가.
- [AC-06] Frontend `/qna` → `+ New Question` → 저장 → 리스트 반영.
- [AC-07] Frontend `/qna` → row Edit → subject 변경 → 저장 → 행 갱신.
- [AC-08] Frontend `/qna` → row Delete → ConfirmDialog → confirm → 삭제 + toast.
- [AC-09] Frontend `/qna/categories` → CRUD 동작.
- [AC-10] Frontend 모든 화면에서 native `confirm()`/`alert()` 0개 (grep 결과 비어 있음).
- [AC-11] CMS 언어를 `vi` 로 전환 → QNA 카테고리 라벨이 vi 라벨 표시 (없으면 ko fallback).
- [AC-12] `cd backend && npm test` → 73 + 신규 ≥10개 spec 모두 PASS.
- [AC-13] `tsc --noEmit` (backend + frontend-acm) clean.

## 7. Risks (리스크)

| 리스크 | 완화 |
|---|---|
| testcontainers 가 `tac-postgres-acm:pg16-bigm` 로컬 이미지 못 찾음 | setup.ts 에서 `withPullPolicy('never')` + 로컬 빌드 prereq 문서화 + 자동 빌드 스크립트 |
| 신규 SQL 마이그레이션이 staging 적용 시 충돌 | `IF NOT EXISTS` + dry-run 검증 |
| Toast Provider 가 routing root 에 wrap 안 되면 동작 안 함 | `main.tsx` 에서 `App` 외곽에 `ToastProvider` 추가 |
| confirm-dialog Promise 패턴이 기존 button click handler 와 호환 안 됨 | `await confirm(...)` async 패턴, 기존 코드 async 화 |
