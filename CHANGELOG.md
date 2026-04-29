# app-academy — Change Log

All notable changes to this project will be documented in this file.

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
