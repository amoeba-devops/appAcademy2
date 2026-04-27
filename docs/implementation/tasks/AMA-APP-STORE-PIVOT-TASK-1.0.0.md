---
document_id: AMA-APP-STORE-PIVOT-TASK-1.0.0
title: AMA App Store 이관 — 학원관리앱 SaaS 전환 작업계획서
version: 1.0.0
status: COMPLETE — shipped as v1.4.0 (2026-04-27)
date: 2026-04-27
owner: gray.kim@amoeba.group
related:
  - docs/analysis/AMA-APP-STORE-PIVOT-REQ-1.0.0.md (요구사항 분석서)
  - SPEC.md / CLAUDE.md (브랜드·도메인·보안 — 전환 후 갱신)
assumptions:
  - Q-PIVOT-01 = C (Generic 마케팅 portal)
  - Q-PIVOT-02 = AMA SSO는 OAuth 2.0 / OIDC를 가정하되, AMA 명세 확정까지 mock IdP로 개발
  - Q-PIVOT-03 = A (path 무관 active tenant)
  - Q-PIVOT-04 = A (AMA 과금 전담)
  - Q-PIVOT-05 = C (Phase 1 학부모 결제 비활성, Trinity Pay 코드 동결)
  - Q-PIVOT-06 = C (Trinity 데모 + 운영 분리)
  - Q-PIVOT-07 = A (Generic "학원관리앱 / Academy Manager")
  - Q-PIVOT-08 = ko 단일 (Phase 1)
estimated_effort: 5 sprints (1 sprint = 1 week 기준)
---

# AMA App Store Pivot — Implementation Plan (작업계획서)

## 1. Phase Overview (단계 개요)

| Phase | Sprint | 주제 | 핵심 산출 |
|------|---|---|---|
| **P-0** | S0 | 기반 + AMA 명세 확정 | mock IdP, webhook 명세 합의 |
| **P-1** | S1 | 데이터 모델·인증 | DB 마이그레이션, AMA SSO provider |
| **P-2** | S2 | Provisioning + Tenant 라이프사이클 | webhook controller, provisioning use-case |
| **P-3** | S3 | UI 디브랜딩 + 온보딩 + 멀티테넌트 UX | Generic UI, onboarding wizard, tenant switcher |
| **P-4** | S4 | 도메인·배포 정책 전환 | 신규 도메인, prod stack, 백업 자동화 |
| **P-5** | S5 | UAT + 데이터 분리 + 앱스토어 등재 자료 | demo/prod 데이터 분리, 앱스토어 메타 |

> 결제 도메인(Trinity Pay)·HSM/KMS·CLS 모듈은 본 전환 범위 밖. 도메인 전환만 반영.

---

## 2. File-Level Change List (파일 변경 목록)

### 2.1 신규 파일

#### Backend
| 경로 | 역할 |
|------|------|
| `backend/src/infrastructure/external/ama/auth/ama-oidc.client.ts` | AMA OIDC IdP 클라이언트 (authorize URL 생성, token exchange, userinfo) |
| `backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.ts` | 개발용 mock IdP (AMA_MODE=mock) |
| `backend/src/infrastructure/external/ama/auth/ama-auth.module.ts` | factory by AMA_MODE |
| `backend/src/infrastructure/database/entities/subscription-event.entity.ts` | tac_subscription_events ORM |
| `backend/src/application/tenant/provisioning.use-case.ts` | 멱등 테넌트 생성 + 기본 시드 (환불정책 v1, 알림 템플릿) |
| `backend/src/application/tenant/seed-template.util.ts` | 시드 템플릿 적용 (코드 + SQL 호출) |
| `backend/src/application/tenant/lifecycle.use-case.ts` | suspend / activate / cancel / deprovision |
| `backend/src/application/tenant/tenant-deprovision.cron.ts` | 90일 grace 후 PII export+삭제 (cron) |
| `backend/src/application/auth/ama-sso.use-case.ts` | OIDC callback 처리, user upsert, session 발급 |
| `backend/src/presentation/auth/ama-auth.controller.ts` | `/api/auth/ama/login`, `/callback`, `/logout` |
| `backend/src/presentation/webhooks/ama-subscription.controller.ts` | `/api/webhooks/ama/subscription` (HMAC + nonce) |
| `backend/src/presentation/tenant/tenant.controller.ts` | `/api/tenants/me` (현재 사용자 멤버십 목록), `/api/tenants/active` (PUT 활성 전환) |
| `backend/src/presentation/tenant/onboarding.controller.ts` | `/api/onboarding/...` (학원 정보, 직원 초대, AMA 교사 동기화 트리거) |
| `backend/src/common/guards/active-tenant.guard.ts` | 세션의 active academy_id 주입 + 강제 |
| `backend/src/common/decorators/active-tenant.decorator.ts` | `@ActiveTenant() acdId: number` |
| `backend/test/integration/it-pivot-provisioning.int-spec.ts` | webhook → 테넌트 생성 → 시드 적용 검증 |
| `backend/test/integration/it-pivot-multi-tenant-isolation.int-spec.ts` | 테넌트 A 데이터를 B 사용자로 조회 시 404 |

#### Frontend
| 경로 | 역할 |
|------|------|
| `frontend/src/app/page.tsx` *(교체)* | Generic 학원관리앱 랜딩 — "AMA로 시작" CTA |
| `frontend/src/app/(auth)/sign-in/ama/route.ts` | AMA OAuth 시작 → redirect |
| `frontend/src/app/api/auth/ama/callback/route.ts` | AMA → 본 앱 callback 핸들러 |
| `frontend/src/app/admin/onboarding/page.tsx` | 3-step wizard (학원 정보 / 운영 시간 / 교사 동기화) |
| `frontend/src/app/admin/billing/page.tsx` | 구독 상태 read-only + AMA portal deep link |
| `frontend/src/components/admin/tenant-switcher.tsx` | 헤더 우측 학원 선택 dropdown |
| `frontend/src/components/admin/onboarding/step-academy.tsx` | wizard step 1 |
| `frontend/src/components/admin/onboarding/step-hours.tsx` | wizard step 2 |
| `frontend/src/components/admin/onboarding/step-sync.tsx` | wizard step 3 |
| `frontend/src/hooks/use-tenants.ts` | `useMyTenants()` + `useSwitchTenant()` |
| `frontend/src/hooks/use-onboarding.ts` | wizard mutation hooks |
| `frontend/src/hooks/use-billing.ts` | `useSubscriptionStatus()` |
| `frontend/src/lib/auth/ama-client.ts` | AMA OAuth helpers (PKCE, state 검증) |

#### Database / Scripts
| 경로 | 역할 |
|------|------|
| `sql/080-migration-ama-pivot.sql` | tac_academies + tac_users 컬럼 추가, tac_subscription_events 신규 |
| `sql/090-seed-tenant-template.sql` | 신규 테넌트 자동 시드 템플릿 (참조용 SQL — provisioning use-case가 호출) |
| `sql/091-migration-trinity-as-demo.sql` | 기존 Trinity 행을 demo 테넌트로 표시 |
| `scripts/export-tenant-pii.sh` | deprovisioning 시 PII export (mysqldump + zip) |

#### Docs
| 경로 | 역할 |
|------|------|
| `docs/design/screens/ama-pivot-onboarding.html` | 와이어프레임(아래 §4) |
| `docs/deployment/RUNBOOK.md` | 배포·롤백·deprovision·시크릿 회전 절차 |
| `docs/integration/ama-platform-spec-asks.md` | AMA 팀 사전 확인 7건(분석서 §9) 정리, 회신 트래킹 |

### 2.2 변경 파일

| 경로 | 변경 |
|------|---|
| `backend/.env.example` | `AMA_OIDC_ISSUER`, `AMA_OIDC_CLIENT_ID`, `AMA_OIDC_CLIENT_SECRET`, `AMA_OIDC_REDIRECT_URI`, `AMA_WEBHOOK_HMAC_SECRET` 추가 |
| `backend/src/app.module.ts` | AmaAuthModule, TenantModule, WebhookModule 등록. ScheduleModule.forRoot 등록(이미 있는 경우 cron 추가) |
| `backend/src/infrastructure/database/entities/academy.entity.ts` | `amaTenantId`, `subscriptionStatus`, `subscriptionPlan`, `provisionedAt`, `canceledAt`, `slug` |
| `backend/src/infrastructure/database/entities/user.entity.ts` | `amaUserId`, `invitedAt`, `acceptedAt` |
| `backend/src/presentation/*/controller.ts` (전 admin 컨트롤러) | `@UseGuards(JwtAuthGuard, ActiveTenantGuard)` + `@ActiveTenant() acdId` 사용 패턴으로 통일 |
| `frontend/src/app/admin/(shell)/layout.tsx` | 헤더에 `<TenantSwitcher />` 슬롯 |
| `frontend/src/app/admin/login/page.tsx` *(또는 폐기)* | Q-PIVOT-02 SSO 단일화 — break-glass용 SUPERADMIN 폼만 유지 |
| `frontend/src/app/(portal)/page.tsx` | Trinity 카피 → Generic SaaS 카피 (옵션 C). 기존 포털 콘텐츠는 git history 보존 |
| `frontend/src/app/(portal)/{about,programs,news}/page.tsx` | Q-PIVOT-01 옵션 C — 폐기 또는 단일 "About app-academy" 페이지로 통합 |
| `frontend/src/middleware.ts` | 미인증 admin 접근 시 `/sign-in/ama`로 redirect |
| `frontend/src/lib/api/client.ts` | active tenant 헤더 자동 주입(`X-Active-Tenant`) |
| `frontend/src/locales/{ko,en,vi,zh-CN}/common.json` | Trinity 고유 카피 → generic 키로 교체 |
| `next.config.mjs` | API proxy 변경 없음. 단, `images.domains`에 AMA CDN 추가 시 |
| `docker-compose.yml` | 변경 없음(local) |
| `docker/staging/.env.staging.example` | 신규 도메인 반영 (`app-academy-stg.amoeba.site`) |
| `docker/staging/nginx-tpi.conf` → `nginx-app-academy.conf` (rename) | server_name 변경 + 운영용 vhost 분리 |
| `docker/staging/docker-compose.staging.yml` | container_name prefix `tac-` → `app-academy-`, env 갱신 |
| `scripts/deploy-staging.sh` | 도메인 변경, BACKUP 호출 추가 |
| `.github/workflows/cd-staging.yml` | smoke test URL을 `app-academy-stg.amoeba.site`로 |
| `README.md` | 프로젝트 정체성·도메인·인증 모델 갱신 |
| `CLAUDE.md` | §1 Brand Identity, §1 Project Overview, §2 Tech, §11 Security 갱신(Trinity 디브랜딩) |
| `SPEC.md` | §1, §3, §11 갱신 |

### 2.3 신규: Production Stack

| 경로 | 역할 |
|------|------|
| `docker/production/docker-compose.production.yml` | prod stack (volume/network prefix `app-academy-prod-*`) |
| `docker/production/.env.production.example` | prod 시크릿 템플릿 |
| `docker/production/nginx-app-academy.conf` | `app-academy.amoeba.site` vhost (HSTS, security headers) |
| `scripts/deploy-production.sh` | prod 배포 (수동 승인 후 호출) |
| `scripts/backup-db.sh` | mysqldump + 로테이션 (staging 7일, prod 30일) |
| `.github/workflows/cd-production.yml` | `workflow_dispatch` + environment `production` (required reviewers) |

### 2.4 보존(현상유지)

- Trinity Pay 전체(`backend/src/**/payment/**`, `frontend/src/app/admin/payments/**`) — 동결, 코드 변경 없음. 단, admin 메뉴에서 숨김(feature flag `FEATURE_PAYMENTS=off`).
- 기존 36개 단위 테스트 — 통과 유지가 요구.
- ACM Track B(`frontend-acm`, `backend/src/modules/acm-*`) — 별도 트랙, 본 작업 영향 없음.

---

## 3. Sprint Breakdown (스프린트 분해)

### S0 — Foundation & AMA 명세 확정 (1주)

| ID | 작업 | 산출 |
|----|---|---|
| S0-1 | AMA 플랫폼 팀에 §9 7건 협의 요청 송부 | `docs/integration/ama-platform-spec-asks.md` |
| S0-2 | Mock IdP 인터페이스 설계(OIDC discovery 응답 형태) | mock service skeleton |
| S0-3 | DB 마이그레이션 SQL 작성 + dev DB에 적용 | `sql/080-migration-ama-pivot.sql` |
| S0-4 | TypeORM entity 컬럼 추가 + 기존 테스트 통과 | entity 변경 |
| S0-5 | `seed-tenant-template.sql` + provisioning 시 호출 흐름 설계 | SQL + use-case skeleton |

### S1 — 인증 (1주)

| ID | 작업 |
|----|---|
| S1-1 | `AmaOidcClient` (authorize URL, code→token, userinfo) — http impl |
| S1-2 | `AmaOidcMockService` (`AMA_MODE=mock`에서 hard-coded 응답) |
| S1-3 | `AmaAuthModule` factory by `AMA_MODE` |
| S1-4 | `AmaSsoUseCase` — userinfo upsert, `usr_ama_user_id` 매핑, session 발급 |
| S1-5 | `AmaAuthController` — `/login`, `/callback`, `/logout` |
| S1-6 | NextAuth provider 또는 Next route handler 신규 (auth route) |
| S1-7 | `ActiveTenantGuard` + `@ActiveTenant()` decorator |
| S1-8 | 기존 admin 컨트롤러를 새 guard로 점진 교체(샘플 5개) |
| S1-9 | 단위 테스트 — mock IdP, callback, multi-tenant guard |

### S2 — Provisioning + Lifecycle (1주)

| ID | 작업 |
|----|---|
| S2-1 | `tac_subscription_events` 엔티티 + 리포지토리 |
| S2-2 | `AmaSubscriptionWebhookController` — HMAC 검증, nonce/timestamp(P0-2 패턴 재사용), 멱등 처리 |
| S2-3 | `ProvisioningUseCase` — `tac_academies` insert + `seed-tenant-template` 적용 |
| S2-4 | `LifecycleUseCase` — SUSPEND(read-only flag), CANCEL(canceled_at 기록), DEPROVISION(데이터 export+삭제) |
| S2-5 | `TenantDeprovisionCron` — 매일 03:00 90일 경과 CANCELED 테넌트 처리 |
| S2-6 | Tenant API — `/me/tenants` 리스트, `/active` PUT |
| S2-7 | 통합 테스트 — webhook→provision→sign-in→데이터 격리 |

### S3 — UI 디브랜딩 + 온보딩 + 멀티테넌트 UX (1주)

| ID | 작업 |
|----|---|
| S3-1 | `(portal)` Generic 카피 교체 — Hero/About을 "학원관리앱 소개"로 |
| S3-2 | `(portal)/{programs,news}` 폐기 또는 단일 about 페이지로 통합 |
| S3-3 | `app/page.tsx` (또는 `(portal)/page.tsx`) "AMA로 시작" CTA + 앱스토어 deep link |
| S3-4 | `/sign-in/ama` route + callback handler |
| S3-5 | `/admin/onboarding` 3-step wizard (학원 정보 / 운영 시간 / 교사 동기화) |
| S3-6 | `<TenantSwitcher />` 헤더 dropdown — `useMyTenants()` 기반 |
| S3-7 | `/admin/billing` 읽기 전용 + AMA portal deep link |
| S3-8 | i18n 키 정리 — Trinity 고유 카피 → generic |
| S3-9 | feature flag — `FEATURE_PAYMENTS=off` 시 admin 메뉴 hidden |
| S3-10 | break-glass `/admin/login` 유지 여부 결정 + UI 처리 |

### S4 — 도메인·배포 (1주)

| ID | 작업 |
|----|---|
| S4-1 | `docker/staging/nginx-tpi.conf` rename → `nginx-app-academy.conf`, server_name 갱신 |
| S4-2 | DNS A 레코드: `app-academy-stg.amoeba.site` → staging host |
| S4-3 | TLS 와일드카드 `*.amoeba.site` 적용 확인 |
| S4-4 | `docker/staging/docker-compose.staging.yml` env/container 이름 갱신 |
| S4-5 | `scripts/deploy-staging.sh` 도메인 변경 + 백업 호출 |
| S4-6 | `.github/workflows/cd-staging.yml` smoke test URL 갱신 |
| S4-7 | `docker/production/*` 신규 — prod stack |
| S4-8 | `scripts/backup-db.sh` + crontab 가이드(staging 7일 / prod 30일) |
| S4-9 | `.github/workflows/cd-production.yml` (`workflow_dispatch` + environment) |
| S4-10 | `docs/deployment/RUNBOOK.md` |
| S4-11 | README/CLAUDE/SPEC 갱신(도메인·브랜드) |
| S4-12 | 구 `tpi.amoeba.site` → 신 도메인 301 redirect 6개월 유지 |

### S5 — 데이터 분리 + UAT + 앱스토어 등재 (1주)

| ID | 작업 |
|----|---|
| S5-1 | `sql/091-migration-trinity-as-demo.sql` 적용 (Trinity = demo tenant) |
| S5-2 | demo tenant용 read-only seed export 스크립트 |
| S5-3 | 신규 테넌트 가입(provisioning) e2e UAT |
| S5-4 | 멀티테넌트 격리 e2e UAT |
| S5-5 | SUSPEND/CANCEL/DEPROVISION e2e |
| S5-6 | 앱스토어 등재 자료 — 앱 메타, 스크린샷 5종, 필요 권한, 이용약관, 개인정보처리방침 |
| S5-7 | RUNBOOK 기반 production cut-over 리허설 |
| S5-8 | go-live |

---

## 4. UI Wireframes (화면 구성안)

### 4.1 Public Landing (`/` — Generic SaaS 랜딩)

```
┌─────────────────────────────────────────────────────────────┐
│ [학원관리앱]                          [ AMA에서 시작하기 → ]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   학원 운영을 한 곳에서                                      │
│   AMA 사용자라면 클릭 한 번에 시작                            │
│                                                             │
│   [ AMA로 로그인 ]   [ 앱스토어에서 보기 ↗ ]                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  교사 관리  │  │ 학생/학부모 │  │ 시간표·MAP │             │
│  │  AMA 동기화 │  │  통합 관리  │  │  통합 평가  │             │
│  └────────────┘  └────────────┘  └────────────┘             │
├─────────────────────────────────────────────────────────────┤
│           © 2026 Amoeba — app-academy.amoeba.site            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 AMA Sign-in Flow

```
[1] /              Hero
       ↓ click "AMA로 로그인"
[2] /sign-in/ama   → 302 to AMA OIDC authorize endpoint
       (state, PKCE code_challenge)
       ↓ user authorizes
[3] AMA → /api/auth/ama/callback?code=...&state=...
       ↓ token exchange + userinfo
[4] User upsert (tac_users.usr_ama_user_id)
       ↓ if 멤버십 0 → 신규 테넌트 wizard로
       ↓ if 멤버십 1 → /admin/dashboard
       ↓ if 멤버십 ≥2 → /admin/select-tenant
[5] Session 발급 (httpOnly cookie + active_academy_id)
```

### 4.3 Onboarding Wizard (`/admin/onboarding`)

```
┌─────────────────────────────────────────────────────────┐
│ 환영합니다, 김원장 님                          (1 / 3)   │
├─────────────────────────────────────────────────────────┤
│  학원 기본 정보                                          │
│                                                         │
│  학원명*       [ ____________________________ ]         │
│  대표자        [ ____________________________ ]         │
│  사업자번호    [ ____________________________ ] (선택)   │
│  슬러그*       [ trinity                 ] .app-academy │
│  대표 전화     [ ____________________________ ]         │
│                                                         │
│                              [ 취소 ]   [ 다음 → ]      │
└─────────────────────────────────────────────────────────┘

Step 2 — 운영 시간 / 휴무일
┌─────────────────────────────────────────────────────────┐
│ 운영 시간                                     (2 / 3)   │
│  평일      [ 14:00 ] – [ 22:00 ]                        │
│  토요일    [ 10:00 ] – [ 18:00 ]                        │
│  일요일    [✓] 휴무                                      │
│  공휴일    [✓] 휴무                                      │
│                              [ ← 이전 ]   [ 다음 → ]    │
└─────────────────────────────────────────────────────────┘

Step 3 — 교사 동기화
┌─────────────────────────────────────────────────────────┐
│ AMA 교사 마스터 자동 동기화                    (3 / 3)   │
│                                                         │
│ AMA 거래처(직원·강사)를 본 앱의 교사 마스터로 자동 가져옴.│
│ 동기화는 야간 02:00에 자동 실행되며 수동도 가능합니다.    │
│                                                         │
│ [✓] 동의 — 교사 마스터를 자동 동기화합니다.               │
│                                                         │
│                              [ ← 이전 ]   [ 시작하기 ]  │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Tenant Switcher (헤더 우측 dropdown)

```
[ Trinity Academy ▾ ]    [ 알림 🔔 ]   [ 김원장 👤 ]
        ↓ click
   ┌──────────────────────────┐
   │ ⦿ Trinity Academy        │   ← 활성
   │ ○ Sister Academy A       │
   │ ○ Sister Academy B       │
   │ ───────────────────────  │
   │ + 새 학원 추가            │
   └──────────────────────────┘
```

### 4.5 Subscription / Billing (`/admin/billing` — 읽기 전용)

```
┌─────────────────────────────────────────────────────────┐
│ 구독 정보                                               │
├─────────────────────────────────────────────────────────┤
│ 플랜       Standard                                     │
│ 상태       ● ACTIVE                                     │
│ 시작일     2026-04-27                                   │
│ 다음 결제   2026-05-27 (AMA가 자동 처리)                  │
│                                                         │
│ 플랜 변경, 결제 수단, 인보이스는 AMA 결제센터에서.        │
│                                                         │
│ [ AMA 결제센터로 이동 ↗ ]                                │
└─────────────────────────────────────────────────────────┘
```

### 4.6 Suspended Banner (구독 중지 시)

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ 구독이 일시 중지되었습니다. 30일 내 결제하지 않으면      │
│   데이터가 보관 모드로 전환됩니다.                        │
│   [ AMA 결제센터로 이동 ↗ ]                              │
└─────────────────────────────────────────────────────────┘
                  ↓ 모든 admin 페이지가 read-only
```

---

## 5. API Surface — Phase 1

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET  | `/api/auth/ama/login`         | public      | OIDC authorize URL로 302 |
| GET  | `/api/auth/ama/callback`      | public      | code 교환, session 발급 |
| POST | `/api/auth/logout`            | session     | session 종료 |
| POST | `/api/webhooks/ama/subscription` | HMAC      | 구독 lifecycle 이벤트 수신 |
| GET  | `/api/me/tenants`             | session     | 사용자 멤버십 목록 |
| PUT  | `/api/me/active-tenant`       | session     | active 테넌트 전환 |
| POST | `/api/onboarding/academy`     | session+W   | 학원 기본정보 |
| POST | `/api/onboarding/hours`       | session+W   | 운영시간 |
| POST | `/api/onboarding/teacher-sync`| session+W   | 동기화 동의 |
| POST | `/api/onboarding/staff/invite`| session+T   | 직원 초대 |
| GET  | `/api/billing/status`         | session+T   | 구독 상태 read-only |

(W = wizard 권한, T = active tenant 필요)

---

## 6. Migration & Cut-over (이행 절차)

```
1. (사전) AMA 팀 §9 협의 완료 → 명세 fix
2. dev DB에 080 마이그레이션 적용 → 모든 기존 테스트 통과 확인
3. staging 배포 → 신규 도메인(app-academy-stg) 가동, 기존 tpi와 병행
4. demo tenant(Trinity) 데이터 검증 — 기존 화면 회귀 없음
5. UAT — provisioning, multi-tenant 격리, suspend/cancel
6. (T-day) production stack 가동 → app-academy.amoeba.site
7. tpi.amoeba.site → app-academy.amoeba.site 301 redirect (6개월)
8. 앱스토어 등재 신청
```

### Rollback
- 마이그레이션 SQL은 모두 ALTER ADD COLUMN(파괴 X) → 신규 컬럼은 NULL 허용 → revert 안전
- 신규 컨트롤러/모듈은 module wiring 제거로 비활성 가능
- nginx vhost는 분리되어 있어 신 도메인 vhost 비활성으로 즉시 격리

---

## 7. Testing Strategy

### 7.1 신규 단위 테스트 (target ≥10건)

| ID | 대상 | 시나리오 |
|----|---|---|
| T-PV-01 | render-template | (해당 없음 — 기존 유지) |
| T-PV-02 | AmaOidcMockService | userinfo 응답 안정 |
| T-PV-03 | AmaSsoUseCase | upsert (신규/기존) |
| T-PV-04 | ProvisioningUseCase | 멱등 — 동일 ama_tenant_id 2회 호출 시 1건 |
| T-PV-05 | ProvisioningUseCase | 시드 적용 — 환불정책 v1 자동 생성 |
| T-PV-06 | LifecycleUseCase | SUSPEND → read-only flag |
| T-PV-07 | LifecycleUseCase | DEPROVISION → 데이터 삭제 후 audit log 보존 |
| T-PV-08 | TenantDeprovisionCron | 89일 < skip, 90일 ≥ trigger |
| T-PV-09 | AmaSubscriptionWebhookController | HMAC 불일치 → 401 |
| T-PV-10 | AmaSubscriptionWebhookController | nonce 재사용 → 409 |
| T-PV-11 | ActiveTenantGuard | 세션의 active acdId 주입 + 다른 테넌트 데이터 차단 |
| T-PV-12 | TenantController | switch active → 새 acdId로 후속 요청 정합 |

### 7.2 통합 테스트

| ID | 시나리오 |
|----|---|
| IT-PV-01 | webhook → provisioning → sign-in → dashboard 200 |
| IT-PV-02 | 테넌트 A의 학생을 B 사용자로 GET → 404 |
| IT-PV-03 | SUSPEND webhook → 이후 PUT 요청 403/read-only |

### 7.3 회귀

- 기존 36개 단위 + (P0-2) 21개 + (P0-3) 15개 통과 유지

---

## 8. Documentation Updates

| 문서 | 변경 |
|------|---|
| `CLAUDE.md` | §1 Project Overview(Trinity 단일 → SaaS), §1 Brand Identity(Heraldic → Generic), §4.7 도메인, §11 Security(SSO/Webhook 추가) |
| `SPEC.md` | §1, §3, §11 갱신 |
| `README.md` | 프로젝트 정체성 + 신규 도메인 + AMA SSO 모델 |
| `CHANGELOG.md` | v1.4.0 (planned) — AMA App Store Pivot |
| `docs/deployment/RUNBOOK.md` | 신규 |
| `docs/integration/ama-platform-spec-asks.md` | 신규 |

---

## 9. Risks & Mitigations (재정리)

| ID | 리스크 | 완화 |
|----|---|---|
| R-1 | AMA 측 명세 늦어짐 | mock IdP 우선 개발, S2-S3는 mock으로 완결 가능 |
| R-2 | Trinity 데이터 분리 실패 | 091 마이그레이션 dry-run 후 실제 적용. 백업 필수 |
| R-3 | nginx vhost 충돌 | 신/구 vhost 병행 운영 + DNS TTL 단축 |
| R-4 | 1인 다 학원 케이스 — 활성 전환 시 캐시 stale | active 전환 시 React Query cache reset |
| R-5 | i18n 회귀 | 키 단위 diff + 4개 로케일 lint |
| R-6 | 기존 테스트 회귀 | S0 마이그레이션 직후 jest 회귀 회수 |

---

## 10. Approval Checklist

- [ ] §2 파일 변경 목록(특히 보존 vs 변경 vs 폐기) 동의
- [ ] §3 5-스프린트 분해 동의
- [ ] §4 와이어프레임 5종 동의 (또는 별도 HTML 목업 요청)
- [ ] §6 cut-over 절차 + 6개월 301 redirect 동의
- [ ] §8 CLAUDE/SPEC/README 갱신 권한 동의

승인 후 **S0(Foundation & AMA 명세 협의 송부 + DB 마이그레이션)** 부터 착수합니다.
