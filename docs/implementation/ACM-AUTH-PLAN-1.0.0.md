---
document_id: ACM-AUTH-PLAN-1.0.0
version: 1.0.0
status: draft
created: 2026-05-03
authors: [copilot]
related:
  - docs/analysis/ACM-AUTH-REQ-1.0.0.md
change_log:
  - 2026-05-03 v1.0.0 초안 — ACM Auth 작업 분해 + UI 목업
---

# ACM Authentication — Implementation Plan v1.0.0

## 1. Scope Summary

REQ-1.0.0 의 FR-1~14 / AC-1~12 충족.

**범위**:
- Backend: Postgres user 테이블 + login/me 엔드포인트 + AcmJwtStrategy + AcmJwtAuthGuard + ACM 컨트롤러 가드 체이닝.
- Frontend: `/login` 페이지 + `RequireAuth` + AppShell 사용자 정보/로그아웃 + 401 자동 redirect.
- DB: SQL 마이그레이션 + 시드 (운영자 계정).

**범위 외**: NG-1~6 (TAC SSO, AMA OIDC, MFA, 비밀번호 재설정, self-signup, RBAC).

## 2. Task Breakdown

### Phase 1 — Backend (P0)

| ID | 파일 / 변경 | 비고 |
|---|---|---|
| T-1 | `sql/acm/500-acm-auth.sql` (신규) | `amb_acm_user` DDL + 시드 INSERT (`admin@acm.local`, bcrypt hash precomputed) |
| T-2 | `backend/src/modules/acm-auth/` (신규 모듈) | `module + controller + service + jwt.strategy + guard + dto + entity` |
| T-3 | `backend/src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity.ts` | TypeORM entity (acm-pg datasource) |
| T-4 | `backend/src/modules/acm-auth/application/acm-auth.service.ts` | login(), validateUser(), bcrypt rate-limit (in-memory Map) |
| T-5 | `backend/src/modules/acm-auth/presentation/acm-auth.controller.ts` | `POST /api/acm/auth/login`, `GET /api/acm/auth/me` |
| T-6 | `backend/src/modules/acm-auth/jwt/acm-jwt.strategy.ts` | passport name `'acm-jwt'`, secret `ACM_JWT_SECRET` |
| T-7 | `backend/src/modules/acm-auth/guards/acm-jwt-auth.guard.ts` | `AuthGuard('acm-jwt')` 래핑 |
| T-8 | `backend/src/modules/acm-auth/acm-auth.module.ts` | PassportModule + JwtModule register + TypeOrmModule.forFeature([UserEntity], 'acm-pg') |
| T-9 | `backend/src/app.module.ts` | AcmAuthModule import |
| T-10 | ACM 컨트롤러 11개 (`@UseGuards(OwnEntityGuard)` → `@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)`) | school/grade-band/schedule/question/qna-category/qna-student/dashboard/inquiry/score-benchmark/level-test-guide/class-guideline/session/class/settlement (목록 grep 으로 일괄) |
| T-11 | `backend/.env.staging` / `.env.production` 가이드 — `ACM_JWT_SECRET` 추가 (서버 별도 적용) | docker compose env file 갱신 |
| T-12 | 통합 테스트 setup 보강 — `AcmJwtAuthGuard` mock 으로 교체 (기존 테스트 회귀 방지) | `backend/test/integration/acm/setup.ts` |

### Phase 2 — Frontend (P0)

| ID | 파일 / 변경 | 비고 |
|---|---|---|
| T-13 | `frontend-acm/src/modules/auth/pages/login-page.tsx` (신규) | 이메일/비번/제출 + 에러 메시지 |
| T-14 | `frontend-acm/src/modules/auth/api/auth-api.ts` (신규) | `login()`, `me()` 함수 |
| T-15 | `frontend-acm/src/components/layout/require-auth.tsx` (신규) | router loader/element wrapper, redirect to `/login?returnTo=` |
| T-16 | `frontend-acm/src/routes/router.tsx` | `/login` 추가, `/`(AppShell) children 을 `RequireAuth` 로 감싸기 |
| T-17 | `frontend-acm/src/lib/api-client.ts` | 401 인터셉터 — `clear()` + `window.location.assign('/login')` |
| T-18 | `frontend-acm/src/components/layout/app-shell.tsx` | 우측 상단 user name + logout 버튼 |
| T-19 | i18n 4언어 — `auth.json` (login.title/email/password/submit/error/logout, returnTo, etc.) | ko/en/vi/zh-CN |

### Phase 3 — Verification & Deploy (P0)

| ID | 작업 | 비고 |
|---|---|---|
| T-20 | Backend build + 기존 P1 통합 테스트 회귀 (`it-sch-p1`, `it-qna-p1`) | clean PASS |
| T-21 | 신규 통합 테스트 `it-auth.int-spec.ts` (login 200/401, me 200/401, 보호 라우트 401→200) | 6+ tests |
| T-22 | Frontend build clean | tsc + vite |
| T-23 | Smoke (curl): `/api/acm/auth/login` → JWT, `/api/acm/sch/schools` with bearer → 200 | smoke-acm-p1.sh 보강 |
| T-24 | Staging deploy (`scripts/deploy-staging.sh`) | sql/acm/500 자동 적용 + 컨테이너 재기동 |
| T-25 | 공개 URL `https://acm-stg.amoeba.site/login` 수동 검증 | admin@acm.local 로그인 → /sch 진입 |
| T-26 | REPORT, CHANGELOG, repo memory 갱신 | v1.4.5 |

## 3. UI Mockup (화면 구성안)

### 3.1 `/login` Login Page

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                                                                │
│                  ┌──────────────────────────┐                  │
│                  │   ACM v1.0a              │                  │
│                  │   Academy Management     │                  │
│                  ├──────────────────────────┤                  │
│                  │                          │                  │
│                  │  Email                   │                  │
│                  │  ┌────────────────────┐  │                  │
│                  │  │ admin@acm.local    │  │                  │
│                  │  └────────────────────┘  │                  │
│                  │                          │                  │
│                  │  Password                │                  │
│                  │  ┌────────────────────┐  │                  │
│                  │  │ ●●●●●●●●●●●●       │  │                  │
│                  │  └────────────────────┘  │                  │
│                  │                          │                  │
│                  │  ⚠ Invalid credentials   │ ← 에러 영역       │
│                  │                          │                  │
│                  │  ┌────────────────────┐  │                  │
│                  │  │     Sign in        │  │                  │
│                  │  └────────────────────┘  │                  │
│                  │                          │                  │
│                  │  KO | EN | VI | ZH       │ ← 언어 토글       │
│                  └──────────────────────────┘                  │
│                                                                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- 미인증 상태에서 모든 라우트(`/sch` 등) 접근 시 → `/login?returnTo=/sch` 로 redirect.
- 로그인 성공 → `returnTo` 또는 `/dashboard` 로 navigate.
- 5회 연속 실패 → "Too many attempts. Try again in 60s." 메시지로 변경 + submit disabled.

### 3.2 AppShell Header (변경)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ACM v1.0a   Dashboard | New Counseling | Classes | Schools | Refs | Q&A      │
│                                            [admin@acm.local ▾]   [Logout]    │
└──────────────────────────────────────────────────────────────────────────────┘
│                                                                              │
│   <route content>                                                            │
```

- 우측 상단: 사용자 이름(이메일) + Logout 버튼.
- Logout 클릭 → store clear → `/login`.

### 3.3 401 Auto-Redirect Flow

```
[사용자 화면 /sch]
   → API 호출 (만료된 JWT)
   → 401 response
   → apiClient interceptor: store.clear() + window.location.assign('/login?returnTo=/sch')
   → /login 페이지 표시
   → 재로그인 → /sch 로 복귀
```

## 4. Dependencies

- **순서**: T-1 (DDL+seed) → T-2~T-9 (backend module) → T-10 (가드 체이닝) → T-12 (테스트 회귀) → T-13~T-19 (frontend) → T-20~T-26 (검증/배포).
- T-10 은 T-2~T-9 가 build 가능한 상태가 된 직후. T-12 와 동시 작업 가능.
- Frontend (T-13~T-19) 는 backend T-5 (login/me 엔드포인트) 기동 가능 시점부터 병렬.

## 5. Risk & Mitigation

| Risk | Mitigation |
|---|---|
| 기존 P1 통합 테스트가 가드 추가로 401 회귀 | T-12 — `overrideGuard(AcmJwtAuthGuard).useValue({canActivate:()=>true})` + setup.ts 가 `req.user.entId` 직접 주입. |
| `ACM_JWT_SECRET` env 누락 → backend boot 실패 | docker compose `.env.staging` 에 강제 주입 + boot 시 명시적 throw. README 업데이트. |
| 기존 staging 컨테이너의 `req.user` 부재로 401 → smoke 회귀 | smoke 스크립트에 login 단계 추가 (`smoke-acm-p1.sh`). |
| zustand persist 의 `acm-auth` localStorage key 가 이전 세션의 stale token 을 보유 | 401 인터셉터에서 명시적 clear + 강제 redirect. |
| seed 비번 노출 위험 (문서/git) | 시드 비번 `acm20261234` (스테이징 한정), 운영 적용 전 강제 변경. README/REPORT 에 ROTATE 표시. |

## 6. Migration / Rollback

- Forward: `sql/acm/500-acm-auth.sql` idempotent (`CREATE TABLE IF NOT EXISTS` + `ON CONFLICT DO NOTHING`).
- Rollback: 새 컨테이너 이전 이미지로 재기동. DDL 은 잔존하나 사용 코드 미배포로 무영향.

## 7. Estimated Footprint

- 신규 파일: ~14 (backend 8, frontend 5, sql 1)
- 수정 파일: ~16 (controllers 11, app.module 1, api-client 1, app-shell 1, router 1, setup.ts 1)
- 신규 테스트: 1 spec (~6 cases)
