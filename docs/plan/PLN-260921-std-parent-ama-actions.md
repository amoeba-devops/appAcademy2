---
document_id: STD-PLN-260921
version: 0.2.0
status: CANCELLED (2026-09-21 사용자 결정 — "학부모 수정건은 작업 진행 필요 없음"). 현행(전원 수정·삭제 가능) 유지
date: 2026-09-21
depends_on: docs/analysis/REQ-260921-std-parent-ama-actions.md
change_log:
  - 2026-09-21 v0.2.0 취소 — 사용자 결정으로 작업 진행하지 않음. 문서는 현행 분석 기록으로 보존 (Claude Code)
  - 2026-09-21 v0.1.0 초안 (Claude Code)
---

# PLN-260921 — 학부모 수정·삭제 AMA 계정 전용 / Implementation Plan

## 1. Goal (목표)

`/admin/std/parents` 의 수정·삭제를 **AMA 연동 계정에게만** 허용한다. 서버가 기준을 강제하고, UI 는 같은 기준으로 버튼을 노출한다. 260914G(상담 삭제) 와 동일한 메커니즘을 재사용한다.

## 2. Architecture (구성)

```
frontend-acm  parent-list-page.tsx
   canManage = useAuthStore(s => s.user?.authSource) === 'ama'
   ├ canManage  → [✎ 수정] [🗑 삭제]   (삭제: 자녀 연결 시 disabled — 현행 유지)
   └ !canManage → "—" + 툴팁 "AMA 연동 계정만 수정·삭제할 수 있습니다"

backend  parent.controller.ts
   PUT    /acm/std/parents/:id   @UseGuards(AmaAccountGuard)   → 403 AMA_ACCOUNT_REQUIRED
   DELETE /acm/std/parents/:id   @UseGuards(AmaAccountGuard)
   (GET · POST · POST :id/ama-client 는 변경 없음)
```

## 3. Tasks (작업)

| # | 작업 | 파일 | 규모 |
|---|---|---|---|
| B-1 | `PUT`/`DELETE` 핸들러에 `@UseGuards(AmaAccountGuard)` 추가 + Swagger summary 갱신 | `backend/src/modules/acm-std/presentation/parent.controller.ts` | S |
| B-2 | 컨트롤러 e2e/단위 — 로컬 계정 403, AMA 계정 200 (기존 `ama-account.guard.spec.ts` 패턴) | `parent.controller.spec.ts` (신규) | S |
| F-1 | `canManage` 판정 + 버튼 조건부 렌더 + 비대상 `—`/툴팁 | `frontend-acm/src/modules/std/pages/parent-list-page.tsx` | S |
| F-2 | 403 응답 시 토스트 문구(권한 없음) — `useUpdateParent`/`useDeleteParent` onError | `frontend-acm/src/modules/std/hooks/use-parents.ts` | S |
| F-3 | i18n `std.parentList.amaOnly`, `std.parentList.amaOnlyHint` ko/en/vi/zh-CN | `i18n/locales/*/std.json` | S |
| D-1 | REQ/PLN 상태 갱신 + `RPT-260921-std-parent-ama-actions.md` | docs | S |

## 4. UI 구성안 (화면 목업)

### 4.1 AMA 연동 계정으로 로그인 (현행과 동일한 모습)

```
학부모 관리                                   [🔍 이름, 전화번호 또는 이메일]
┌───────────┬──────┬──────────────┬──────────────────┬──────────────┬──────────┐
│ 이름      │ 관계 │ 전화         │ 이메일           │ 연결 자녀    │          │
├───────────┼──────┼──────────────┼──────────────────┼──────────────┼──────────┤
│ 김영희    │ 모   │ 010-1234-…   │ kim@…            │ 김민 · 김수  │ [✎] [🗑]│  ← 🗑 disabled (자녀 연결)
│ 박철수    │ 부   │ 010-9876-…   │ —                │ 고아(자녀없음)│ [✎] [🗑]│  ← 🗑 enabled
└───────────┴──────┴──────────────┴──────────────────┴──────────────┴──────────┘
```

### 4.2 로컬 계정(비 AMA)으로 로그인

```
┌───────────┬──────┬──────────────┬──────────────────┬──────────────┬──────────┐
│ 이름      │ 관계 │ 전화         │ 이메일           │ 연결 자녀    │          │
├───────────┼──────┼──────────────┼──────────────────┼──────────────┼──────────┤
│ 김영희    │ 모   │ 010-1234-…   │ kim@…            │ 김민 · 김수  │    —     │  ← hover 툴팁:
│ 박철수    │ 부   │ 010-9876-…   │ —                │ 고아(자녀없음)│    —     │    "AMA 연동 계정만
└───────────┴──────┴──────────────┴──────────────────┴──────────────┴──────────┘     수정·삭제할 수 있습니다"
```

- 버튼 열은 유지해 레이아웃이 흔들리지 않게 한다.
- 직접 API 를 호출하면 서버가 403 → 토스트 "이 작업은 AMA 연동 계정만 수행할 수 있습니다".

## 5. Verification (검증)

- backend `tsc` · jest(신규 spec 포함) · eslint
- frontend-acm `tsc` · `vite build`
- 프로덕션: AMA 계정(`fremd@naver.com` 등) 로그인 → 버튼 노출·삭제 성공 / 로컬 계정 → `—` 및 API 403

## 6. Out of Scope (범위 외)

- 자녀 연결 학부모 삭제 허용(Q-2), 학생 상세 학부모 서브폼(Q-4), 역할(ADMIN/STAFF) 추가 제한.
