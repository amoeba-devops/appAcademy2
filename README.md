# Trinity Academy — Management System

> **OMNIBUS OMNIA** — 모든 이에게 모든 것이 되다 (고린도전서 9:22)

중·고등부 영어·수학 학원의 운영 전반을 디지털화하는 통합 관리 솔루션.

## Overview

| Item | Detail |
|------|--------|
| **Project Code** | TAC |
| **Version** | v1.3.0 |
| **Framework** | Next.js 14 (App Router) + React 18 |
| **Database** | MySQL 8 + Prisma |
| **Portal** | https://trinityacademy.kr/ |

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
| **Trinity Pay** | Toss Payments 직결 결제·환불·원장·영수증·세금계산서 |
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

- **Colors**: Navy `#0E1E3A` · Gold `#C9A656` · Cream `#FAF7EE`
- **Typography**: Cormorant Garamond + Noto Serif KR (display) / Inter + Pretendard (body)
- **Identity**: Heraldic 방패 문장, OMNIBUS OMNIA 표어

## License

Private — Trinity Academy. All rights reserved.
