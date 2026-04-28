# app-academy — Academy Management SaaS

[![CI](https://github.com/amoeba-devops/appAcademy2/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/amoeba-devops/appAcademy2/actions/workflows/ci.yml)
[![CD — Staging](https://github.com/amoeba-devops/appAcademy2/actions/workflows/cd-staging.yml/badge.svg?branch=main)](https://github.com/amoeba-devops/appAcademy2/actions/workflows/cd-staging.yml)

학원 운영 전반을 디지털화하는 멀티테넌트 관리 SaaS. AMA App Store를 통해 학원별로 프로비저닝된다.

> Trinity Academy는 이 플랫폼 위에서 운영되는 첨 입주 테넌트다 (`tpi.amoeba.site` → `app-academy-stg.amoeba.site` → 프로덕션 컷오버).

## Overview

| Item | Detail |
|------|--------|
| **Project Code** | TAC (내부 코드 / DB prefix `tac_`) |
| **Version** | v1.4.0 |
| **Framework** | Next.js 14 (App Router) + NestJS 11 |
| **Database** | MySQL 8 + TypeORM (multi-tenant by `academy_id`) |
| **Distribution** | AMA App Store — https://amoeba.site/apps/app-academy |

## Architecture

```
Next.js 14 App Router
├── (portal)     — 학부모 대면 포털 (SSG/ISR, Public)
├── (admin)      — 운영 콘솔 (SSR, Authenticated)
└── api/         — Route Handlers (REST API)
```

## Modules

| Module | Description |
|--------|-------------|
| **Portal** | Home, About, Programs, MAP Test, Contact, News |
| **Program** | 커리큘럼 프로그램 관리 (CRUD + 카탈로그 공개) |
| **Consultation** | 상담 접수·방문 기록·등록 전환 |
| **People** | 학부모·학생·교사 등록 (교사 = AMA Client 1:1) |
| **Class** | 강의 개설, 회차 자동 생성, 스케줄 충돌 검증 |
| **Timetable** | 학원/교사/학생 시간표 (class_sessions 파생 뷰) |
| **Enrollment** | 수강 등록·상태 관리·출결 |
| **Pay** | Toss Payments 직결 결제·환불·원장·영수증·세금계산서 |
| **MAP** | 문제은행·시험지·배정·채점·성적 이력 |
| **Dashboard** | KPI 대시보드 |

## Tech Stack

- **Frontend**: React 18, TailwindCSS, shadcn/ui, Zustand, React Query
- **Backend**: Next.js Route Handlers, Prisma, MySQL 8
- **Infra**: Redis, RabbitMQ, S3 Compatible Storage
- **Integration**: Toss Payments, AMA Service, AmoebaTalk, NTS eTax API

## Getting Started

```bash
# Prerequisites: Node 20, MySQL 8, Redis, RabbitMQ

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Set up database
npx prisma db push
npx prisma db seed

# Start development
npm run dev
```

## Project Structure

```
app-academy/
├── src/app/(portal)/     # 학부모 포털 페이지
├── src/app/(admin)/      # 운영 콘솔 페이지
├── src/app/api/          # REST API
├── src/components/       # UI 컴포넌트
├── src/lib/              # 비즈니스 로직, DB, 외부 연동
├── prisma/               # DB 스키마
├── docs/                 # SDLC 문서
│   ├── analysis/         # 요구사항 분석서
│   ├── design/           # 설계 문서 (ERD, 기능정의, 프로세스, 시퀀스)
│   └── design/screens/   # UI 화면 시안
├── sql/                  # DB Migration SQL
├── reference/            # Amoeba 표준 참조 문서
├── CLAUDE.md             # AI 개발 지침
├── SPEC.md               # 프로젝트 명세서
└── CHANGELOG.md          # 변경 이력
```

## Documentation

| Document | Path |
|----------|------|
| AI Instructions | `CLAUDE.md` |
| Project Spec | `SPEC.md` |
| Requirements | `docs/analysis/academy-management-requirements.md` |
| ERD | `docs/design/academy-management-erd.md` |
| Functional Spec | `docs/design/academy-management-func-definition.md` |
| Process | `docs/design/academy-management-process.md` |
| Sequence | `docs/design/academy-management-sequence.md` |
| DB Schema | `sql/academy-management-schema.sql` |

## Brand System

기본 셰은 테넌트에 중립적이다 (Inter + Pretendard, 메트로 팔레트). 입주 테넌트는 `academy.brand_*` 설정으로 로고·컬러·폰트를 오버라이드한다. (Trinity Academy 테넌트 셰은 `frontend/public/themes/trinity/` 아래에 분리 예정)

## CI / CD

| Pipeline | Trigger | Steps |
|----------|---------|-------|
| **CI** (`.github/workflows/ci.yml`) | PR + push to `main`/`develop` | backend lint/typecheck/unit · backend integration (MySQL service + ACM Testcontainers) · frontend lint/typecheck/build · Playwright e2e (non-blocking) · Docker build validation · Trivy scan |
| **CD-Staging** (`.github/workflows/cd-staging.yml`) | push to `main` (or manual `workflow_dispatch`) | Build & push backend/frontend images to GHCR (`:${sha_short}` + `:staging`) → SSH into staging host → run [`scripts/deploy-staging.sh`](scripts/deploy-staging.sh) (git pull · docker pull · SQL migrations · `docker compose up -d` · nginx reload · smoke test) |

### Required GitHub Secrets (CD)

| Secret | Description |
|--------|-------------|
| `STAGING_SSH_HOST` | Staging server hostname or IP |
| `STAGING_SSH_USER` | SSH login user |
| `STAGING_SSH_KEY`  | Private key (PEM) — passwordless |
| `STAGING_SSH_PORT` | _(optional)_ defaults to `22` |

`GITHUB_TOKEN` (auto-provided) is used for GHCR push with `packages: write`.

### Manual / Rollback Deploy

```bash
# On the staging host (~/app-academy):
DEPLOY_SHA=<short-sha> scripts/deploy-staging.sh        # pull pre-built image
DEPLOY_BUILD_LOCAL=1 scripts/deploy-staging.sh          # force local build (fallback)
```

### Dependabot

Weekly updates configured in `.github/dependabot.yml` for `npm` (backend, frontend, root) and `github-actions`.

## License

Private — app-academy. All rights reserved.
