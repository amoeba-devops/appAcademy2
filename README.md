# app-academy — Academy Management SaaS

[![CI](https://github.com/amoeba-devops/appAcademy2/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/amoeba-devops/appAcademy2/actions/workflows/ci.yml)
[![CD — Staging](https://github.com/amoeba-devops/appAcademy2/actions/workflows/cd-staging.yml/badge.svg?branch=main)](https://github.com/amoeba-devops/appAcademy2/actions/workflows/cd-staging.yml)

학원 운영 전반을 디지털화하는 멀티테넌트 관리 SaaS다. Trinity Academy는 이 플랫폼 위에서 운영되는 첫 입주 테넌트이며, 현재 저장소는 PostgreSQL 기반 ACM 구조를 기준으로 유지된다.

## Overview

| Item | Detail |
|------|--------|
| **Project** | App Academy / Trinity Academy ACM |
| **Version** | v1.4.6 |
| **Frontend** | `frontend-acm` — Vite + React 18 |
| **Backend** | `backend` — NestJS 11 + TypeORM |
| **Database** | PostgreSQL 16 (`db_acm`, `amb_acm_*`) |
| **Distribution** | AMA App Store — https://amoeba.site/apps/app-academy |

## Current Architecture

```text
frontend-acm (Vite SPA)
├── /                 공개 포털
├── /admin/*          관리자 콘솔
├── /parent/*         학부모 포털
└── /web/*            공개 웹 폼 / 유틸리티

backend (NestJS API)
└── /api/*            ACM REST API
```

## Core Modules

| Module | Description |
|--------|-------------|
| `acm-auth` | 인증, 사용자, 권한, 테넌트 접근 |
| `acm-csl` | 상담, 문의, 레벨테스트, 등록 파이프라인 |
| `acm-cls` | 수업/반, 배정, 일정 기반 운영 |
| `acm-std` | 학생, 학부모, 관계, import |
| `acm-tch` | 강사, AMA 연계 프로필 |
| `acm-stf` | 직원/운영 사용자 |
| `acm-cal` | 일정, 초대자, BODA 연동 |
| `acm-map` | 기출문제/문항/시험 |
| `acm-qna` | Q&A, 카테고리 |
| `acm-dsh` | 대시보드 |
| `acm-system` | 시스템 관리자, 테넌트 관리 |

## Tech Stack

- Frontend: React 18, React Router 6, TailwindCSS, Zustand, TanStack Query
- Backend: NestJS 11, TypeScript, TypeORM 0.3
- Database: PostgreSQL 16
- Infra: Redis, S3-compatible storage, Docker
- Integration: AMA SSO, BODA, SMTP, Toss Payments, AmoebaTalk

## Getting Started

```bash
npm install
npm run install:all

# backend/.env.example, frontend-acm/.env.example 을 기준으로 환경 변수 구성

npm run dev
```

기본 개발 포트는 백엔드 `4009`, 프론트엔드 `5173`이다.

## Project Structure

```text
app-academy/
├── backend/            NestJS API
├── frontend-acm/       Vite React SPA
├── sql/acm/            PostgreSQL schema, seed, migration SQL
├── docs/               분석, 설계, 보고서, 표준 문서
├── docker/             공통 / staging / production compose 자산
├── scripts/            배포 및 운영 스크립트
├── README.md
├── CLAUDE.md
├── SPEC.md
└── CHANGELOG.md
```

## Documentation

현재 기준 문서는 `docs/standard/*` 이다.

| Document | Path |
|----------|------|
| Skill | `docs/standard/SKILL.md` |
| Spec | `docs/standard/SPEC.md` |
| Structure | `docs/standard/STRUCTURE.md` |
| Code Convention | `docs/standard/CODE_CONVENTION.md` |
| Style Guide | `docs/standard/STYLE_GUIDE.md` |
| Completion Report | `docs/report/RPT-260703-app-academy-development-completion.md` |

루트 `SPEC.md`, `CLAUDE.md`, 과거 구현/이행 문서는 아카이브 성격을 포함하므로 현재 상태 판단 시 `docs/standard/*`를 우선한다.

## CI / CD

| Pipeline | Trigger | Steps |
|----------|---------|-------|
| **CI** (`.github/workflows/ci.yml`) | PR + push to `main`/`develop` | backend build/test · PostgreSQL integration test · frontend build/type-check · Docker validation |
| **CD-Staging** (`.github/workflows/cd-staging.yml`) | push to `main` or manual run | 이미지 빌드/배포 후 `scripts/deploy-staging.sh` 로 PostgreSQL ACM 마이그레이션 적용 |

## License

Private repository. All rights reserved.
