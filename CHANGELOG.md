# app-academy — Change Log

All notable changes to this project will be documented in this file.

## [1.4.5] — 2026-05-03 — ACM Admin Auth (JWT login + RequireAuth + 403 해결)

### Added — Backend
- `modules/acm-auth/` 신규 모듈 — `passport-jwt` + `bcrypt(rounds=12)` + 12h expiry.
  - `POST /api/acm/auth/login` (lockout 5회/60초/60초 cooldown, in-memory Map).
  - `GET /api/acm/auth/me` (`AcmJwtAuthGuard` 통과 시 토큰 payload 반환).
- `sql/acm/500-acm-auth.sql` — `amb_acm_user` 테이블 + seed admin (`admin@acm.local` / `acm20261234`, ent `00000000-...-001`).
- `it-auth.int-spec.ts` — 4 PASS (login OK / 잘못된 비밀번호 401 / 미존재 이메일 401 / DTO 검증 400).
- `docker/staging/docker-compose.staging.yml` — `ACM_JWT_SECRET` 환경변수 와이어링.

### Added — Frontend (frontend-acm)
- `/login` 페이지 (i18n: ko/en/vi/zh-CN, namespace `auth`).
- `RequireAuth` 래퍼 — 미인증 시 `/login?returnTo=...` 리다이렉트.
- `api-client` 401 인터셉터 → `/login` 강제 이동 + auth store clear.
- `AppShell` 헤더에 `user.email` + Logout 버튼.
- `auth-api.ts` — `POST /auth/login`, `GET /auth/me` 클라이언트 함수.

### Changed
- 14개 ACM controller 모두 `@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)` 로 변경.
- `test/integration/acm/setup.ts` — `AcmJwtAuthGuard.canActivate=>true` override 로 기존 26 P1 테스트 회귀 없음.

### Tests
- 30/30 ACM PASS (26 기존 P1 + 4 신규 auth IT).
- `it-02`/`it-09` 7건 실패는 v1.4.4 이전부터 존재 (별도 triage, P1 범위 밖).

### Deploy
- Staging 배포 완료 (commit `45db8bb`).
- Public smoke: `/api/acm/auth/login` → 200 + accessToken.
- 토큰 부착 시 `/sch/schools`, `/qna/questions`, `/qna/categories`, `/auth/me` 모두 200.
- 사전 403 → 200 으로 해결.

### Docs
- [docs/analysis/ACM-AUTH-REQ-1.0.0.md](docs/analysis/ACM-AUTH-REQ-1.0.0.md), [docs/implementation/ACM-AUTH-PLAN-1.0.0.md](docs/implementation/ACM-AUTH-PLAN-1.0.0.md), [docs/test/ACM-AUTH-TC-1.0.0.md](docs/test/ACM-AUTH-TC-1.0.0.md).
- [docs/report/REPORT-260502-acm-sch-qna-p1.md](docs/report/REPORT-260502-acm-sch-qna-p1.md) §9 Deploy Outcome (v1.4.5).

### Notes
- staging `.env.staging` 에 `ACM_JWT_SECRET` 자동 추가 (openssl rand -hex 64). 운영자가 회전 시 동일 방식.
- 운영자 자격증명: `admin@acm.local` / `acm20261234` (rotated upon first deploy).
- deploy step "6. Sync + reload host nginx" 는 `sudo` 필요 → 비대화형 SSH 에서 실패하지만 nginx config 변경 없을 시 무영향. 변경 시 수동 `sudo nginx -s reload` 필요.

## [1.4.4] — 2026-05-02 — ACM SCH + QNA P1 Follow-up (toast/confirm/forms + tests + i18n labelZh)

### Added — Frontend (frontend-acm)
- `components/ui/toast.tsx` — `ToastProvider` + `useToast()` (success/error/info, 4s 자동 dismiss).
- `components/ui/confirm-dialog.tsx` — `ConfirmProvider` + `useConfirm()` returning `Promise<boolean>` (Radix Dialog 기반).
- SCH form dialogs: `school-form-dialog`, `grade-band-form-dialog`, `schedule-form-dialog` — 모두 create/edit 통합.
- QNA form dialogs: `question-form-dialog` (POST/PUT, 4-locale category select), `category-form-dialog` (code/labelKr/En/Vi/Zh/isActive/sortOrder).
- 신규 페이지: `qna-categories-page` + 라우트 `/qna/categories`.
- 4 locales (ko/en/vi/zh-CN) `common.json` toast.* / confirm.*, `sch.json` form.* / editSchool / gradeBands.edit / schedules.edit / schedules.note, `qna.json` editQuestion / form.* / categories.{edit,labelKr,labelEn,labelVi,labelZh,sortOrder} 키 추가.

### Added — Backend
- `sql/acm/420-acm-qna-i18n-labels.sql` — `amb_acm_qna_category.qct_label_zh VARCHAR(100)`.
- `qna-category` 엔티티/DTO/서비스에 `labelZh` 추가.
- `scripts/smoke-acm-p1.sh` — 7 curl smoke (인증 토큰 인자).

### Tests
- 신규 통합 테스트 `it-sch-p1.int-spec.ts` (12 PASS), `it-qna-p1.int-spec.ts` (14 PASS) — testcontainers + named TypeORM connection (`acm-pg`) + `tac-postgres-acm:pg16-bigm` (NEVER_PULL).
- `test/integration/acm/setup.ts` 정비 — 5 SQL files (100/300/400/410/420), `forbidNonWhitelisted:false` (Guard body mutation 우회).

### Changed
- 모든 SCH/QNA 페이지: native `confirm()`/`alert()` 제거 → `useConfirm()`/`useToast()` 통합 (검증 grep: 0 hits).
- 카테고리 라벨 표시: `lang.startsWith('zh')→labelZh, vi→labelVi, en→labelEn, else labelKr` 4-locale fallback chain.

### Notes
- 보고서: [docs/report/REPORT-260502-acm-sch-qna-p1.md](docs/report/REPORT-260502-acm-sch-qna-p1.md) §8 (v1.2.0).
- 잔여 follow-up: staging 배포 + smoke (별도 라운드), `it-02`/`it-09` 7건 pre-existing 실패 triage (P1 범위 밖).

## [1.4.3] — 2026-05-02 — ACM SCH + QNA P1 Boost

### Added — School (SCH) module enhancements
- `tac_acm_sch_school.is_authorized` (BOOL, default true) — flags MAP-authorized schools.
- New table `amb_acm_sch_grade_band` — per-school grade tier definitions (label/min/max/note).
- New table `amb_acm_sch_schedule` — per-school exam/admission cycle (year/type[REGULAR|ROLLING|ED|EA|OTHER]/open/close/test/result dates).
- REST endpoints: `/acm/sch/schools/:schId/grade-bands` (GET/POST/PATCH/DELETE), `/acm/sch/schools/:schId/schedules` (GET/POST/PATCH/DELETE).
- Grade-band create/update guards against `SCHOOL_NOT_AUTHORIZED` (422).
- School delete now blocks with `SCHOOL_IN_USE` (422) when active CSL inquiries reference it.
- Added `PATCH /acm/sch/schools/:id` (canonical); existing `PUT` preserved as deprecated alias.
- New `SchSchoolPublicService` for cross-module reads (CSL/QNA/CLS).
- SQL migration: `sql/acm/400-acm-v1.0a-sch-p1.sql` (idempotent).

### Added — Q&A (QNA) module enhancements
- New table `amb_acm_qna_category` (code/labelKr/labelEn/labelVi/isActive/sortOrder).
- New columns on `amb_acm_qna_question`: `thread_parent_id` (self-FK for reply chain — distinct from `parent_id` user FK), `category_id`, `use_count`, `escalated_at`, `escalated_by`.
- REST endpoints: `/acm/qna/categories` (GET/POST/PATCH/DELETE), `/acm/qna/questions/:id/escalate` (POST), `/acm/qna/questions/:id/reply` (POST), `/acm/qna/questions/:id/thread` (GET), `/acm/qna/questions/:id/use-faq` (POST), `/acm/qna/questions/:id` (DELETE), `/acm/qna/students/:userId/qna` (GET timeline).
- Category delete blocks with `CATEGORY_IN_USE` (422) when questions reference it.
- Escalate guard: rejects `RESOLVED`/`ESCALATED` with `INVALID_STATUS_TRANSITION` (422).
- `useFaq` increments `use_count`; rejects non-FAQ with `NOT_FAQ` (422).
- Question list now supports `?categoryId=`, `?faqOnly=true`, `?status=` filters.
- New `QnaPublicService` (timeline/openCount) for student profile cross-reads.
- SQL migration: `sql/acm/410-acm-v1.0a-qna-p1.sql` (idempotent).

### Added — Frontend ACM (CMS)
- `school-list-page.tsx` full implementation: table with name/level/region/authorized badge/lazy-loaded band·schedule counts; click count → modal listing children.
- `qna-list-page.tsx` full implementation: filters (category/status/faqOnly), action menu (reply/escalate/viewThread/useFaq/delete), Reply modal (POST `:id/reply`), Thread modal (GET `:id/thread` with chronological hierarchy).
- i18n keys (ko/en/vi/zh-CN) added under `sch.json` & `qna.json` namespaces — replaces TODO placeholders.

### Tests
- Backend `npm test` — **73/73 passing** (no regressions). Pre-existing unit suite covers shared dispatcher/AMA/notifications; new SCH/QNA endpoints exercised manually pending dedicated integration test scaffolding (deferred — see follow-ups).

### Operator follow-up (manual)
- Apply migrations on staging PG: `400-acm-v1.0a-sch-p1.sql`, `410-acm-v1.0a-qna-p1.sql`.
- (Carryover) Generate `ACM_PII_KEY` (`openssl rand -hex 32`) into `docker/staging/.env.staging` and restart `tac-backend`.

### Documents
- REQ — `docs/analysis/acm-fn-sch-qna-p1-requirements.md` (ACM-REQ-SCH-QNA-P1-1.0.0).
- PLAN — `docs/implementation/tasks/acm-fn-sch-qna-p1-plan.md` (ACM-PLAN-SCH-QNA-P1-1.0.0).
- TC — `docs/test/acm-fn-sch-qna-p1-tc.md` (ACM-TC-SCH-QNA-P1-1.0.0).
- REPORT — `docs/report/REPORT-260502-acm-sch-qna-p1.md` (ACM-REPORT-SCH-QNA-P1-1.0.0).

## [1.4.2] — 2026-04-29 — ACM v1.0a Staging Deployment

### Added — ACM frontend deploy pipeline
- **CD-Staging matrix** — `acm-frontend` added to `.github/workflows/cd-staging.yml` build-push targets. GHCR images now publish at `ghcr.io/amoeba-devops/appacademy2/acm-frontend:{<sha>,staging}`.
- **Staging compose** — `frontend-acm` service in `docker/staging/docker-compose.staging.yml` (loopback `127.0.0.1:5174:80`, depends_on backend, GHCR image with build context fallback).
- **Host nginx vhost** — `docker/staging/nginx-acm.conf` for `acm-stg.amoeba.site` (TLS via *.amoeba.site wildcard, 80→443 redirect, proxies to `127.0.0.1:5174`).
- **deploy-staging.sh** — installs the new vhost via the existing `install_vhost` helper, restarts `frontend-acm` alongside `backend`/`frontend`, and adds an acm-stg smoke check.

### Added — ACM CLS frontend v1
- `/cls` and `/cls/:id` routes — list (filters: status·subject·teacher·search) + detail (Info / Students / Schedule / Sessions tabs, status-change PATCH).
- New components in `frontend-acm/src/modules/cls/{components,pages}/` and `useUpdateClassStatus` mutation hook.
- Locale `zh-CN` added to frontend-acm — i18n init bumped from 3 to 4 locales (ko/en/vi/zh-CN). cls.json gains `filter` + `detail` key groups.
- `LanguageSwitcher` handles full lang tags (`zh-CN`).
- Vite proxy target updated 4000 → 4009 (CLAUDE.md §4.7 port convention).

### Added — ACM frontend dockerization (local)
- `frontend-acm/Dockerfile` — multi-stage (deps → vite build → nginx:1.27-alpine).
- `frontend-acm/nginx.conf.template` — envsubst-driven, `${ACM_BACKEND_UPSTREAM}` configurable per environment (`backend:4009` local laptop / `backend:4000` staging compose; default `backend:4000`).
- Root `docker-compose.yml` — `frontend-acm` service on host port 5174 with `extra_hosts: backend:host-gateway` and `ACM_BACKEND_UPSTREAM=backend:4009` for laptop dev.
- README updated with native vs Docker workflows.

### Operator follow-up (manual)
- DNS: add A record `acm-stg.amoeba.site` → `125.133.49.165`.
- Verify CD-Staging run after merge; confirm `acm-frontend` container running on host (`docker ps`) and `https://acm-stg.amoeba.site/` 200 once DNS propagates.

## [1.4.1] — 2026-04-28 — Repository Migration

### Changed — Canonical repo cutover
- **Git remote** — `KimIgyong/app-academy` → **`amoeba-devops/appAcademy2`** (org-owned canonical from this date).
- **GHCR namespace** — `ghcr.io/kimigyong/app-academy/{tac-backend,tac-frontend}` → **`ghcr.io/amoeba-devops/appacademy2/{tac-backend,tac-frontend}`** (lowercase per registry policy).
- Files updated: `docker/staging/docker-compose.staging.yml`, `docker/production/docker-compose.production.yml`, `scripts/staging-setup.sh`, `README.md`, `docs/deployment/CUTOVER.md` (commit `fd5419f`).
- Empty trigger commit `92028be` after Phase A1 secrets registration on the new repo.
- Old repo retained as-is (no archive) for fallback / history reference. Local `legacy` remote preserved.

### Added — Documentation
- [docs/deployment/REPO-MIGRATION-GUIDE.md](docs/deployment/REPO-MIGRATION-GUIDE.md) — end-to-end migration guide (local · CI/CD · staging host · GHCR · rollback · checklist).

## [1.4.0] — 2026-04-27 — AMA App Store Pivot

### Added — Multi-tenancy & AMA Integration
- **S0 Foundation** — `tac_user_academies` (M:N membership), `tac_subscription_events` (webhook ledger), tenant columns on `tac_academies` (`acd_ama_tenant_id`, `acd_subscription_status/plan`, `acd_suspended_at`, `acd_canceled_at`, `acd_deprovisioned_at`, `acd_is_demo`).
- **S1 AMA SSO** — OIDC integration (mock + http modes), CredentialsProvider, NextAuth user upsert by `usr_ama_user_id`.
- **S2 Provisioning + Lifecycle** — idempotent `ProvisioningUseCase` w/ default refund policy seed, `LifecycleUseCase` (SUSPEND/RESUME/CANCEL/DEPROVISION/PLAN_CHANGED), `tenant-deprovision.cron` (daily 03:00, `AMA_DEPROVISION_GRACE_DAYS`), HMAC-SHA256 webhook signature verification with replay protection.
- **S3 Onboarding & Multi-tenant UX** — `/api/me/{tenants,active-tenant}`, `/api/onboarding/{academy,hours,teacher-sync}`, `/api/billing/status`, `/api/auth/me`, AMA SSO callback page, 3-step onboarding wizard, `<TenantSwitcher />` in admin header, billing read-only page, AMA sign-in banner on portal landing.
- **S4 Deployment** — production docker stack (`docker/production/`), `nginx-app-academy.conf` for both staging and production, `scripts/deploy-production.sh` (mandatory pre-deploy backup + GHCR-only image pull), `scripts/backup-db.sh` (staging 7d / production 30d retention), `.github/workflows/cd-production.yml` with manual approval gate, [docs/deployment/RUNBOOK.md](docs/deployment/RUNBOOK.md).
- **S5 Demo & Launch Prep** — `sql/091-migration-trinity-as-demo.sql`, `scripts/export-demo-seed.sh`, [docs/test/UAT-CHECKLIST.md](docs/test/UAT-CHECKLIST.md) (4 UAT scenarios), [docs/deployment/CUTOVER.md](docs/deployment/CUTOVER.md), [docs/appstore/LISTING.md](docs/appstore/LISTING.md).

### Changed — Debranding (Trinity → Generic)
- README, SPEC.md, CLAUDE.md re-positioned: project name `Trinity Academy` → `app-academy`; Trinity reframed as the first onboarded tenant (not the product).
- i18n locales (ko/en/vi/zh-CN) `common.json` + `admin.json`: removed `Trinity Academy`, `Trinity Pay`, `Trinity Admin` strings → generic `app-academy` / `결제` / `Pay` / `관리 콘솔`.
- Admin shell hard-coded brand strings → i18n keys; settings page tenant name → dynamic `—` placeholder; onboarding slug placeholder → `my-academy`.
- Staging nginx vhost (`tpi.amoeba.site`) converted to permanent 301 redirect → `app-academy-stg.amoeba.site` (kept for 6 months).
- Compose env: `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `FRONTEND_URL`, `BACKEND_URL` migrated to canonical hostnames.

### Preserved (intentional)
- DB and container `tac_` / `tac-` prefixes (per CLAUDE.md project code convention).
- Portal (public) demo content for the Trinity tenant — operated as the showcase tenant on the platform.

### Tests
- 73/73 backend unit + integration tests pass (15 new across S2 webhook signature, provisioning, lifecycle, deprovision cron).
- Backend + frontend `tsc --noEmit` clean.

---

## [Unreleased]

### Project Setup (2026-04-19)
- Project initialized with documentation structure
- Created `CLAUDE.md` — Claude Code AI instructions for Trinity Academy
- Created `SPEC.md` — Project specification v1.3.0
- Created `README.md` — Project overview
- Set up `reference/` directory with Amoeba standard documents
- Set up `docs/` SDLC directory structure (analysis, design, implementation, test, bug-fix)

### Documentation (v1.3.0)
- Requirements Analysis v1.3.0 (`docs/analysis/academy-management-requirements.md`)
- ERD v1.3.0 (`docs/design/academy-management-erd.md`)
- Functional Specification v1.3.0 (`docs/design/academy-management-func-definition.md`)
- Process Definition v1.3.0 (`docs/design/academy-management-process.md`)
- Sequence Diagrams v1.3.0 (`docs/design/academy-management-sequence.md`)
- UI Screen Mockups (`docs/design/screens/*.html`)
- DB Schema SQL v1.3.0 (`sql/academy-management-schema.sql`)
