---
document_id: ACM-PLAN-SCH-QNA-P1-FOLLOWUP-1.0.0
version: 1.0.0
status: draft
date: 2026-05-02
related:
  - ACM-REQ-SCH-QNA-P1-FOLLOWUP-1.0.0
change_log:
  - 1.0.0 (2026-05-02): initial follow-up plan with task breakdown + UI mockups
---

# ACM SCH + QNA P1 Follow-up — Work Plan (작업 계획서)

## 1. Task Breakdown (작업 분해)

### Phase 1 — Backend (P0 + P1-C 일부)

| Task | File(s) | Acceptance |
|---|---|---|
| T-1 | `scripts/smoke-acm-p1.sh` 신규 작성 | bash + curl + jq, 7-step 검증 |
| T-2 | `backend/test/integration/acm/setup.ts` — `tac-postgres-acm:pg16-bigm` 이미지로 변경 + `withPullPolicy('never')` | 기존 it-02, it-09, it-pending 회귀 없음 |
| T-3 | `it-sch-p1.int-spec.ts` 신규 — school CRUD + isAuthorized + grade-band CRUD + schedule CRUD + school-in-use guard | jest PASS |
| T-4 | `it-qna-p1.int-spec.ts` 신규 — question CRUD + category CRUD + escalate + reply + thread + use-faq | jest PASS |

### Phase 2 — Frontend P2 토대 (Toast + ConfirmDialog)

| Task | File(s) | Acceptance |
|---|---|---|
| T-5 | `frontend-acm/src/components/ui/toast.tsx` 신규 — `ToastProvider` + `useToast()` | 5초 dismiss, 3 variants |
| T-6 | `frontend-acm/src/components/ui/confirm-dialog.tsx` 신규 — Promise 기반 | `await confirm({...})` |
| T-7 | `frontend-acm/src/main.tsx` — `ToastProvider` 외곽 wrap | App 전역 사용 가능 |
| T-8 | i18n 키 추가 (`common.json` 4-locale) — `toast.success`, `toast.error`, `confirm.cancel`, `confirm.ok` | 누락 없음 |

### Phase 3 — Frontend SCH CRUD (P1-A)

| Task | File(s) | Acceptance |
|---|---|---|
| T-9 | `frontend-acm/src/modules/sch/components/school-form-dialog.tsx` 신규 (Create + Edit) | name/level/region/isAuthorized 입력 |
| T-10 | `school-list-page.tsx` — `+ New School` 버튼 + Edit/Delete 메뉴 + form-dialog 연결 | 모달 동작, list 즉시 refresh |
| T-11 | `frontend-acm/src/modules/sch/components/grade-band-form-dialog.tsx` 신규 + 모달 내 wiring | grade min/max 검증 |
| T-12 | `frontend-acm/src/modules/sch/components/schedule-form-dialog.tsx` 신규 + 모달 내 wiring | year/type/dates |
| T-13 | i18n `sch.json` 4-locale 키 추가 (`form.*`, `actions.*`) | 누락 없음 |

### Phase 4 — Frontend QNA CRUD (P1-B)

| Task | File(s) | Acceptance |
|---|---|---|
| T-14 | `frontend-acm/src/modules/qna/components/question-form-dialog.tsx` 신규 (Create + Edit) | subject/body/categoryId |
| T-15 | `qna-list-page.tsx` — `+ New Question` 버튼 + Edit 메뉴 + form-dialog 연결 + native confirm/alert 제거 | toast/confirm 사용 |
| T-16 | `frontend-acm/src/modules/qna/pages/qna-categories-page.tsx` 신규 | list + CRUD |
| T-17 | `frontend-acm/src/modules/qna/components/category-form-dialog.tsx` 신규 | code/labelKr/labelEn/labelVi/labelZh |
| T-18 | `routes/index.tsx` — `/qna/categories` route 추가 | 정상 navigate |
| T-19 | i18n `qna.json` 4-locale 키 추가 | 누락 없음 |

### Phase 5 — Backend P2 (i18n labels)

| Task | File(s) | Acceptance |
|---|---|---|
| T-20 | `sql/acm/420-acm-qna-i18n-labels.sql` 신규 — `ALTER TABLE ... ADD COLUMN label_vi VARCHAR(50), label_zh VARCHAR(50)` | idempotent |
| T-21 | `qna-category.typeorm-entity.ts` + DTO + service + controller — `labelVi`/`labelZh` 추가 | tsc clean |
| T-22 | `categoryLabel(id)` 4-locale 분기 (frontend `qna-list-page.tsx` + 신규 categories 페이지) | vi/zh-CN 표시 OK |

### Phase 6 — 검증 + 배포

| Task | Acceptance |
|---|---|
| T-23 | `cd backend && npm test` → all PASS |
| T-24 | `cd frontend-acm && npm run build` → tsc clean + bundle OK |
| T-25 | 로컬 `docker compose up -d` → 수동 UAT (school/qna CRUD/toast/confirm 동작 확인) |
| T-26 | git commit + push → staging 자동 배포 (sql/acm/420 자동 적용) |
| T-27 | staging 에서 `scripts/smoke-acm-p1.sh` 실행 → exit 0 |
| T-28 | REPORT-260502 v1.2.0 갱신 (this follow-up cycle outcome) |

## 2. Dependency Graph

```
T-1 (smoke script) — independent
T-2 → T-3 → T-4         (backend infra → SCH spec → QNA spec)
T-5,6,7,8 → T-10/15     (toast/confirm prerequisite for refactor)
T-9 → T-10              (form-dialog → list-page wiring)
T-11,12 → T-10          (child form-dialogs → SCH list)
T-14 → T-15
T-17 → T-16 → T-18      (form → page → route)
T-20 → T-21 → T-22      (SQL → entity → frontend)
T-23..28 → all above    (verification last)
```

## 3. UI Mockups (화면 구성안)

### 3.1 SCH School List — AS-IS vs TO-BE

```
[AS-IS]
┌─────────────────────────────────────────────┐
│ Schools                       [+ New School]│  ← 버튼 dummy (no handler)
├─────────────────────────────────────────────┤
│ name | level | region | auth | bands | sch │
│ ──── ───── ────── ──── ───── ───── │
│ ⋯⋯⋯ ⋯⋯ ⋯⋯ ✓ 3 ▸ 2 ▸ │
│ Actions: ⋯ (placeholder)                    │
└─────────────────────────────────────────────┘

[TO-BE]
┌─────────────────────────────────────────────┐
│ Schools                       [+ New School]│  ← 클릭 → SchoolFormDialog (create)
├─────────────────────────────────────────────┤
│ name | level | region | auth | bands | sch │
│ ──── ───── ────── ──── ───── ───── │
│ ⋯⋯⋯ ⋯⋯ ⋯⋯ ✓ 3 ▸ 2 ▸ │
│ Actions: [Edit] [Delete]                    │  ← 메뉴
└─────────────────────────────────────────────┘
```

### 3.2 School Form Dialog (Create / Edit)

```
┌────────────────────────────────────────┐
│ New School / Edit School        [✕]   │
├────────────────────────────────────────┤
│ Name      [____________________]      │
│ Level     [HIGH ▼]                    │
│ Region    [____________________]      │
│ Authorized  □ Yes                     │
│                                        │
│              [Cancel]  [Save]         │
└────────────────────────────────────────┘

Submit:
  POST /api/acm/sch/schools  (create)
  PATCH /api/acm/sch/schools/:id  (edit)
On 422 (school in use, etc.) → toast.error(message)
On 2xx → toast.success + close + refresh list
```

### 3.3 SCH Child Modal — Bands tab (TO-BE)

```
┌────────────────────────────────────────────┐
│ Grade Bands — 서울중            [✕]        │
├────────────────────────────────────────────┤
│ label  | min | max | note  | actions       │
│ M-low  | 1   | 2   |  —    | [Edit][Del]   │
│ M-mid  | 3   | 5   |  —    | [Edit][Del]   │
│                                             │
│                       [+ Add Grade Band]   │
└────────────────────────────────────────────┘
```

### 3.4 QNA List — TO-BE 추가

```
┌─────────────────────────────────────────────────┐
│ Q&A                          [+ New Question]   │
├─────────────────────────────────────────────────┤
│ filters: [Cat ▼] [Status ▼] □ FAQ only          │
├─────────────────────────────────────────────────┤
│ subject  | cat | status | ★ | when | actions    │
│ ⋯⋯⋯⋯ ⋯⋯ ⋯⋯⋯ — ⋯⋯ ⋯ │
│ ⋯⋯⋯⋯ ⋯⋯ ⋯⋯⋯ ★ ⋯⋯ ⋯ │
│ Actions menu (⋯):                                │
│   • Reply                                        │
│   • Edit          ← NEW                          │
│   • Escalate                                     │
│   • View thread                                  │
│   • Use FAQ (if ★)                              │
│   • Delete (red) ← ConfirmDialog (not native)   │
└─────────────────────────────────────────────────┘
```

### 3.5 QNA Categories Page (NEW)

```
[Sidebar] Q&A
          ├ List
          └ Categories ← NEW

┌─────────────────────────────────────────────┐
│ Q&A Categories              [+ New Category]│
├─────────────────────────────────────────────┤
│ code  | KR    | EN    | VI    | ZH   | act │
│ FEE   | 학비   | Fees  | Phí   | 学费 | E D │
│ SCHED | 일정   | Sched | Lịch  | 时间 | E D │
│   ...                                        │
└─────────────────────────────────────────────┘

CategoryFormDialog:
  code           [_______]
  Label (KR)     [___________]
  Label (EN)     [___________]
  Label (VI)     [___________]
  Label (ZH-CN)  [___________]
                  [Cancel] [Save]
```

### 3.6 Toast (TO-BE 컴포넌트)

```
                            ┌──────────────────────────┐
                            │ ✓ Saved successfully      │ (top-right, fades 5s)
                            └──────────────────────────┘
                            ┌──────────────────────────┐
                            │ ✕ Cannot delete: in use   │ (red border, error)
                            └──────────────────────────┘
```

### 3.7 ConfirmDialog (TO-BE 컴포넌트)

```
        ┌────────────────────────────┐
        │ Delete Question?           │
        │                            │
        │ This cannot be undone.     │
        │                            │
        │       [Cancel]  [Delete]   │ (Delete = red if danger=true)
        └────────────────────────────┘
```

## 4. API Contracts (신규/변경 없음 — 재확인)

기존 v1.4.3 endpoint 만 사용. 신규 SQL `420-acm-qna-i18n-labels.sql` 적용 후 다음 응답 필드만 확장:

```json
GET /api/acm/qna/categories →
[
  {
    "id": "...",
    "code": "FEE",
    "labelKr": "학비",
    "labelEn": "Fees",
    "labelVi": "Phí",       // NEW
    "labelZh": "学费"        // NEW
  }
]
```

## 5. Risk Mitigation

| 리스크 | 완화 |
|---|---|
| testcontainers `tac-postgres-acm:pg16-bigm` 이미지 못 찾음 | `cd /Users/gray/Documents/Claude/Projects/app-academy && docker compose build postgres` 사전 실행. README 갱신. |
| Toast Provider 미적용 화면에서 `useToast()` 호출 → 런타임 에러 | hook 가 Provider 없을 때 fallback console.warn |
| 기존 confirm() 호출처가 단 1곳뿐이라 미세하지만, 추가 페이지 작업 시 또 native 사용 가능성 | ESLint custom rule `no-restricted-globals: ['confirm', 'alert']` 추가 |
| pg_bigm 빌드 시간으로 CI 느려짐 | testcontainers 가 로컬 빌드 이미지 재사용 (캐시) |

## 6. Estimated Volume (참고)

| Phase | New files | Modified files |
|---|---|---|
| 1 | 1 (script) + 2 (specs) | 1 (setup.ts) |
| 2 | 2 (toast/confirm) | 2 (main.tsx, common.json) |
| 3 | 3 (form-dialogs) | 1 (school-list-page) |
| 4 | 3 (form/page/dialog) | 2 (qna-list-page, routes) |
| 5 | 1 (SQL) | ~5 (entity/dto/service/controller/frontend) |
| **합계** | ~12 | ~11 |

(예상 코드 라인: backend ~600 LOC, frontend ~1200 LOC, SQL ~30 LOC, script ~80 LOC)

## 7. Definition of Done

- [ ] 모든 AC (REQ §6) 통과.
- [ ] `cd backend && npm test` 73 + ≥10 신규 spec all PASS.
- [ ] `cd backend && npx tsc --noEmit` clean.
- [ ] `cd frontend-acm && npm run build` clean.
- [ ] grep `confirm(\|alert(` frontend-acm/src → 0건.
- [ ] Local docker stack 으로 SCH/QNA 전 CRUD 수동 검증.
- [ ] Staging 배포 + smoke script PASS.
- [ ] CHANGELOG `[1.4.4]` entry + REPORT-260502 v1.2.0.
