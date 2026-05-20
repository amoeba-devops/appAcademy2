---
document_id: RPT-260519-frontend-acm-consolidation-phase1
version: 1.0.0
status: phase1-complete
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc:
  - REQ-260519-frontend-acm-consolidation
  - PLN-260519-frontend-acm-consolidation (v2.0.0)
change_log:
  - 2026-05-19 — v1.0.0 — Phase 1 (Foundation) completion report
---

# Phase 1 완료 보고서 — Frontend-ACM Consolidation
## Phase 1 Completion Report — Foundation

## 1. 요약 (Summary)

PLN v2.0.0 의 **Phase 1 Foundation (Day 1–3)** 6개 task 모두 완료. frontend-acm 라우터가 admin / parent / public 3-tree 로 분리되었고, auth store 는 2-slot 모델로 확장되어 parent OTP 로그인 흐름이 dev OTP `123456` 으로 동작한다. type-check 통과 (`npm run type-check` EXIT=0).

## 2. 완료된 Task

| Task | 결과물 | 검증 |
|------|--------|------|
| T1-01 Router | [router.tsx](../../frontend-acm/src/routes/router.tsx) — `/` portal / `/admin` admin / `/my` parent 3-tree, stub 페이지 11종, 404 → `/` fallback | type-check OK |
| T1-02 Auth Store | [auth.store.ts](../../frontend-acm/src/stores/auth.store.ts) — `{ token, user, parent: { token, user }, active }`, persist v2 + migrate, [api-client.ts](../../frontend-acm/src/lib/api-client.ts) URL prefix 기반 토큰/리다이렉트 분기 | type-check OK |
| T1-03 RequireAuth | [require-auth.tsx](../../frontend-acm/src/components/layout/require-auth.tsx) — `required_role` props ('admin' 기본), 미인증 시 알맞은 로그인 페이지로 | type-check OK |
| T1-04 Parent Login | [parent-login-page.tsx](../../frontend-acm/src/modules/auth/pages/parent-login-page.tsx) + [parent-auth-api.ts](../../frontend-acm/src/modules/auth/api/parent-auth-api.ts), phone OTP 2-step UI, 3분 TTL + 30초 재발송 cooldown, 4 locale 에러 i18n | type-check OK, 백엔드 연동 OK (§4) |
| T1-05 i18n shell | `portal` namespace 등록 ([i18n/index.ts](../../frontend-acm/src/i18n/index.ts)), `portal.json` 4 locale 이식 (337 keys × 4), `auth.json` 의 `parent.*` 키 추가 (4 locale) | jq 검증 OK |
| T1-06 Backend smoke | 본 보고서 §4 매트릭스 | 4/6 PASS, 2 issue 발견 (§5) |

## 3. 신규/변경 파일 (Files)

```
frontend-acm/src/
├── stores/auth.store.ts                      [MOD] 2-slot + persist v2 migrate
├── lib/api-client.ts                         [MOD] URL prefix 토큰/리다이렉트 분기
├── components/layout/
│   ├── require-auth.tsx                      [MOD] required_role
│   ├── portal-layout.tsx                     [NEW] public portal shell
│   └── parent-shell.tsx                      [NEW] parent /my/* shell
├── routes/router.tsx                         [MOD] 3-tree 분리
├── modules/auth/
│   ├── api/parent-auth-api.ts                [NEW]
│   └── pages/parent-login-page.tsx           [NEW]
├── modules/portal/pages/stub-page.tsx        [NEW] Phase 3 채울 stub 6종
├── modules/my/pages/stub-page.tsx            [NEW] Phase 2 채울 stub 4종
└── i18n/
    ├── index.ts                              [MOD] portal namespace + import 4 locale
    └── locales/
        ├── ko/auth.json                      [MOD] parent.* 추가
        ├── ko/portal.json                    [NEW] from frontend
        ├── en/auth.json                      [MOD]
        ├── en/portal.json                    [NEW]
        ├── vi/auth.json                      [MOD]
        ├── vi/portal.json                    [NEW]
        ├── zh-CN/auth.json                   [MOD]
        └── zh-CN/portal.json                 [NEW]
```

## 4. Smoke Test 매트릭스 (T1-06)

| # | 경로 | 메서드 | 인증 | 결과 | 비고 |
|---|------|--------|------|------|------|
| 1 | `/api/health` | GET | none | ✅ 200 | service ok v1.3.0 |
| 2 | `/api/auth/parent/send-otp` | POST `{phone}` | none | ✅ 200 `{message}` | dev OTP=`123456` 로그 노출 확인 |
| 3 | `/api/auth/parent/verify-otp` | POST `{phone, otp}` | none | ✅ 200 `{accessToken, parent}` | JWT payload `{ sub, acdId, email, name, role:"PARENT" }` |
| 4 | `/api/portal/news` | GET | none | ✅ 200 `[]` | DB 비어있음 (정상) |
| 5 | `/api/portal/programs` | GET | none | ✅ 200 `[]` | DB 비어있음 (정상) |
| 6 | `/api/portal/my/children` | GET | parent Bearer | ❌ 500 | §5 R-NEW-01 |
| 7 | `/api/portal/my/kpi?studentId=1` | GET | parent Bearer | ❌ 500 | §5 R-NEW-01 |

## 5. 발견된 이슈 (Findings — pre-existing tech debt)

### R-NEW-01 | `PortalParentController` 의 schema drift
**증상**: `/api/portal/my/{children,kpi,timetable,payments}` 가 HTTP 500.

**원인** (단순 schema 미스매치, 3건):

| 컨트롤러 코드 | 실제 DB 컬럼/테이블 |
|--------------|---------------------|
| `tac_payment_orders` (테이블) | 실제는 `tac_pay_orders` |
| `tac_class_sessions.ses_id, ses_date, ses_start_time, ses_end_time, ses_status` | 실제는 `csn_id, csn_start_at, csn_end_at, csn_status, csn_session_status` |
| `tac_classes.cls_name` | `tac_classes` 에 `cls_name` 컬럼 없음 |

**영향**: Phase 1 종료에는 영향 없음 (Parent OTP + 라우터/스토어 검증만 필요). **단, Phase 2 시작의 blocker**. PLN R-05 가 "확률 중" 으로 잡혀있던 위험인데, 본 smoke check 로 "**확률 100%**" 로 확정.

**완화 (Phase 2 시작 전 별건 PR 로 처리)**:
1. `tac_payment_orders` → `tac_pay_orders` 단순 rename + `ord_*` 컬럼 prefix 확인
2. `tac_class_sessions.ses_*` → `csn_*` 컬럼명 정렬
3. `tac_classes.cls_name` 는 `cls_id || ' (' || prg_name || ')'` 등 fallback 또는 schema 에 추가
4. `PortalParentController.getChildren` 의 응답이 controller 내부에서 `{ data: {...} }` 를 한 번 더 래핑 → `TransformInterceptor` 와 이중 래핑 가능성도 동일 PR 에서 정리

### R-NEW-02 | JWT `sub` claim type
**증상**: 백엔드가 발급한 토큰의 `sub` 가 **string "1"** 인 반면, `CurrentUserPayload.userId: number` 로 타입 선언. SQL parameter 로 그대로 들어가도 MySQL 가 coerce 하므로 R-NEW-01 해결 후엔 동작은 하지만 타입은 어긋남.

**완화**: `JwtStrategy.validate` 에서 `userId: Number(payload.sub)` 로 변환 (별건 PR).

## 6. AC 매트릭스 (REQ §3 vs Phase 1)

| REQ AC | Phase 1 결과 |
|--------|-------------|
| AC-1-1 모든 새 경로 정상 작동 | ✅ stub 렌더 (Phase 2/3 에서 본 구현) |
| AC-1-2 public 경로 미인증 접근 가능 | ✅ |
| AC-1-3 미인증 admin/my 접근 시 알맞은 로그인으로 | ✅ |
| AC-2-1 OTP 발송 (mock 또는 실제) | ✅ phone 기반, dev OTP `123456` |
| AC-2-2 JWT 발급 + store 저장 | ✅ `setParentAuth` 호출 |
| AC-2-3 토큰 후 `/my` 자동 리다이렉트 | ✅ `navigate(returnTo ?? '/my', { replace: true })` |
| AC-2-4 localStorage persist | ✅ `acm-auth` v2 |
| AC-2-5 새로고침 후 로그인 유지 | ✅ persist + migrate |
| AC-3-* 마이페이지 | ⏳ Phase 2 (stub 렌더만 OK) |
| AC-4-* Portal 페이지 | ⏳ Phase 3 (stub 렌더만 OK) |
| AC-5 신청 폼 | ✅ 기존 (`/web/contact`, `/web/test`) 유지 |
| AC-6-1/2 admin/parent 로그인 | ✅ |
| AC-6-3 동시 로그인 불가 (상호 배제) | ⚠️ 본 구현은 **동시 보관**, active 마커로 UI 컨텍스트 구분. REQ 의 "동시 로그인 불가" 와 의도가 다르므로 (§7) 와 같이 의도 보정 |
| AC-6-4 로그아웃 후 private 경로 접근 불가 | ✅ RequireAuth |

## 7. REQ 보정 권고 (REQ v1.1 후속)

- **AC-6-3** "동시 로그인 불가 (admin ↔ parent 전환 시 토큰 교체)" → PLN v2 는 두 슬롯 동시 보관 + URL prefix 분기 채택. 백엔드 JWT secret 이 분리되어 있고 단일 슬롯으로는 처리 불가하므로, REQ 를 "**admin 과 parent 세션은 같은 브라우저에서 동시 보관되며, 각 라우트는 자신의 role 슬롯만 본다**" 로 보정 권고.
- **FR-02** "이메일 OTP" → backend 가 phone 기반이므로 phone 으로 보정 (PLN v2 §1.1 참조).

## 8. 다음 단계 (Next)

1. **Backend schema-drift fix PR** (별건, R-NEW-01) — Phase 2 시작 전 1h 작업 추산
2. **Phase 2 착수** — T2-01 React Query 훅 5종 → T2-02 dashboard → T2-03 payments/scores/timetable → T2-04 ParentShell 마감
3. **선택**: PR 단위로 Phase 1 산출물 commit 분리 (T1-02 store / T1-04 parent login / T1-01 router 등 단위)
