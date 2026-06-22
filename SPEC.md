---
document_id: TAC-SPEC-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-19
updated: 2026-04-19
author: 김익용
change_log:
  - version: 1.3.0
    date: 2026-04-19
    author: 김익용
    description: |
      Initial SPEC.md — Trinity Academy 프로젝트 명세서 작성.
      Amoeba Basic SPEC v2 템플릿 기반, Next.js 14 App Router 풀스택 구조에 맞게 커스터마이징.
---

# app-academy — Project Specification (학원 관리 SaaS 명세서)

> Trinity Academy는 본 플랫폼 위에서 운영되는 첨 입주 테넌트다. 다른 학원은 AMA App Store를 통해 신규 프로비저닝된다.

> ⚠️ **2026-06-22 — Migration in progress (REQ-260622)**: MySQL 단일화 폐기 + PostgreSQL 통합 작업 진행 중. 본 문서의 MySQL / `tac_*` / `db_tac` / `utf8mb4` 관련 명세는 **Phase 7 (예정) 까지의 현행 상태** 기준. 신규 모듈은 PostgreSQL (`db_acm` / `amb_acm_*`) 단독 사용. 자세한 내용은 [docs/analysis/REQ-260622](docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md) 및 [PLN-260622](docs/plan/PLN-260622-mysql-to-postgres-full-migration.md) 참조.

## 1. Project Overview (프로젝트 개요)

### 1.1 Document Information (문서 정보)

| Item | Content |
|------|---------|
| **Document Name** | SPEC.md |
| **Project Name** | app-academy — Academy Management SaaS (학원 관리 멀티테넌트 솔루션) |
| **Project Code** | TAC |
| **Version** | v1.3.0 |
| **Date** | 2026-04-19 |
| **Domain** | Education / Academy Management (교육 / 학원 운영 관리) |
| **Brand Motto** | OMNIBUS OMNIA (1 Cor 9:22) |
| **Main Portal** | https://trinityacademy.kr/ |

### 1.2 Service Introduction (서비스 소개)

app-academy는 중·고등부 영어·수학 학원의 운영을 디지털화하는 멀티테넌트 SaaS다. 학부모 대면 포털과 내부 운영 콘솔을 하나의 플랫폼으로 통합해, 상담 → 등록 → 수강 → 결제 → MAP 평가까지 end-to-end로 관리한다. Trinity Academy는 첨 입주 테넌트다.

기존 imweb 기반 홍보 사이트와 엑셀(TPI 학생 정보, 수업 확인표)에 분산된 업무 데이터를 단일 진실 원천(SSOT)으로 통합하고, AMA 교사 마스터·AmoebaTalk 알림과 연계한다.

### 1.3 Core Values (핵심 가치)

| Value | Description |
|-------|-------------|
| **Brand Trust** | Trinity Heraldic Identity로 학부모 대면 신뢰도 제고 |
| **Operational Efficiency** | 엑셀 기반 분산 운영 → 단일 플랫폼 통합 관리 |
| **Data-Driven** | 상담→결제 funnel, MAP 성장 곡선 등 KPI 가시화 |
| **Legal Compliance** | 학원법 시행령 제18조 환불 규정, 전자세금계산서법 준수 |

### 1.4 User Types (사용자 유형)

| Type | Role | Key Features |
|------|------|-------------|
| **Academy Admin (학원장)** | 운영 전반 관리 | 프로그램 기획, 교사 관리, 결제 승인, 환불 정책 |
| **Academy Staff (행정 직원)** | 일상 업무 처리 | 상담 접수, 등록/수납, 시간표 관리 |
| **Teacher (교사)** | 수업 운영 | 스케줄 조회, 출결 기록, MAP 출제/채점 |
| **Parent (학부모)** | 외부 사용자 | 포털 상담 신청, 수강 신청, 결제 |
| **Content Editor** | 콘텐츠 담당 | MAP 문제은행 업로드·태깅·검수 |

---

## 2. Tech Stack (기술 스택)

### 2.1 Frontend + Backend (Full-stack)

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js (App Router) | 14.x | Full-stack framework — SSG/ISR (Portal) + SSR (Admin) + Route Handlers (API) |
| React | 18.x | UI library |
| TypeScript | 5.x | Type system |
| TailwindCSS | 3.x | Utility-first styling |
| shadcn/ui | latest | UI component library |
| Zustand | 4.x | Client-side global state |
| React Query (TanStack) | 5.x | Server state / data fetching |
| React Hook Form | 7.x | Form management |
| Zod | 3.x | Schema validation |
| Lucide React | latest | Icons |
| react-i18next | 14.x | Internationalization (ko default) |

### 2.2 Backend / Infrastructure

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20.x LTS | Runtime |
| **PostgreSQL** (`pg_bigm`) | 16.x | **Primary database** — ACM v1.0a `db_acm` / `amb_acm_*` (REQ-260622 이후 단일 DB) |
| ~~MySQL~~ | ~~8.x~~ | ~~Legacy `db_tac` / `tac_*`~~ — Phase 7 (REQ-260622) 까지 단계적 폐기 중 |
| TypeORM | latest | ORM (NestJS 표준) |
| Redis | 7.x | Cache, session, idempotency key |
| RabbitMQ | 3.x | Message queue (events) |
| S3 Compatible | — | Object storage (MAP assets, receipts, tax invoice PDF/XML, DB backup) |

### 2.3 External Services

| Service | Purpose |
|---------|---------|
| Toss Payments | PG — 결제·승인·환불 (Widget SDK v2 + Confirm API + Webhook v2) |
| 국세청 홈택스 eTax API | 전자세금계산서 자체 발행 (공동인증서 기반) |
| AMA Service | 교사 마스터(Client) 참조 — read-only |
| AmoebaTalk | 알림 발송 (상담 접수, 결제, 환불, MAP 성적, 세금계산서) |
| reCAPTCHA v3 | Portal 상담 폼 spam 방어 |
| CDN (Cloudflare/CloudFront) | 포털 정적 자산 |
| GA4 / Plausible | 포털 유입/전환 분석 |

### 2.4 Development Tools

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Vitest | Unit testing |
| Playwright | E2E testing |
| Docker / Docker Compose | Local dev environment (MySQL, Redis, RabbitMQ) |

---

## 3. System Architecture (시스템 아키텍처)

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js 14 App Router                       │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  (portal)        │  │  (admin)                          │ │
│  │  학부모 포털       │  │  운영 콘솔                         │ │
│  │  SSG + ISR       │  │  SSR + Client Components          │ │
│  │  Public          │  │  Authenticated (JWT/Session)       │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  api/ Route Handlers                                     ││
│  │  RESTful JSON API                                        ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐        ┌──────────┐        ┌──────────────┐
   │ MySQL 8 │        │  Redis   │        │  RabbitMQ    │
   │ (Prisma)│        │  Cache   │        │  Events      │
   └─────────┘        └──────────┘        └──────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │   Workers     │
                                          │ ├─ Notify     │
                                          │ ├─ Receipt    │
                                          │ ├─ TaxInvoice │
                                          │ └─ AMA Sync   │
                                          └───────────────┘
        ↕                    ↕                    ↕
   ┌──────────┐       ┌──────────┐       ┌──────────────┐
   │  Toss    │       │   AMA    │       │  NTS eTax    │
   │ Payments │       │ Service  │       │  (홈택스)     │
   └──────────┘       └──────────┘       └──────────────┘
```

### 3.2 Route Group Convention

| Route Group | Purpose | Auth | Rendering |
|-------------|---------|------|-----------|
| `(portal)` | 학부모 대면 포털 | Public (일부 인증) | SSG + ISR |
| `(admin)` | 운영 콘솔 | Required (JWT/Session) | SSR + CSR |
| `api/` | REST API | Mixed (public portal + auth admin) | — |

### 3.3 Multi-Tenancy

- 모든 주요 테이블에 `academy_id` FK
- API 미들웨어에서 세션 기반 `academy_id` 자동 주입
- 쿼리 시 `WHERE academy_id = ?` 필수

### 3.4 Local Dev Port Convention (로컬 개발 포트 규칙)

TAC는 로컬 개발 환경에서 다른 프로젝트와의 충돌을 피하기 위해 **고정 포트**를 사용한다. 포트 변경 시 본 섹션·CLAUDE.md §4.7·`.env*`·`frontend/package.json`·`frontend/next.config.mjs`·`backend/src/main.ts`를 함께 갱신한다.

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js dev) | **3009** | http://localhost:3009 |
| Admin Console | 3009 | http://localhost:3009/admin |
| Admin Login | 3009 | http://localhost:3009/admin/login |
| Backend (NestJS API) | **4009** | http://localhost:4009/api |
| Swagger Docs | 4009 | http://localhost:4009/api/docs |

- **금지 포트**: 3000, 4000 (다른 로컬 프로젝트와 충돌, 과거 기본값) — 신규 코드/문서에 사용 금지.
- 환경변수 기본값: `PORT=4009`, `FRONTEND_URL=http://localhost:3009`, `BACKEND_URL=http://localhost:4009`, `API_PROXY_URL=http://localhost:4009`, `NEXTAUTH_URL=http://localhost:3009`, `NEXT_PUBLIC_SITE_URL=http://localhost:3009`.
- Staging/Production 컴포즈 내부 포트는 본 규칙 적용 대상 아님 (별도 운영).

---

## 4. Database Design (데이터베이스 설계)

### 4.1 Database Info

#### 4.1.1 PostgreSQL (`db_acm`) — 신규 표준, REQ-260622 이후 단일 DB

| Item | Value |
|------|-------|
| Engine | PostgreSQL 16.x |
| Extensions | `uuid-ossp`, `pgcrypto`, `pg_trgm`, `pg_bigm` |
| Database name | `db_acm` |
| Table prefix | `amb_acm_{module}_{entity}` (예: `amb_acm_pay_order`, `amb_acm_cls_sessions`) |
| Column prefix (PK/FK) | 3-char abbreviation per entity (예: `pod_id`, `enr_id`, `mpg_id`) |
| Tenant guard | 모든 테이블 `ent_id UUID NOT NULL` |
| Timestamps | `TIMESTAMPTZ` + `set_acm_updated_at()` trigger |
| ID 체계 | `UUID DEFAULT gen_random_uuid()` (BIGINT autoinc 폐기) |
| Index 명명 | `idx_acm_{table_short}_{cols}`, `uq_acm_{table_short}_{cols}` |

#### 4.1.2 MySQL (`db_tac`) — Legacy, Phase 7 까지 폐기 중

| Item | Value |
|------|-------|
| Database name | `db_tac` |
| Table prefix | `tac_` |
| Charset | `utf8mb4` |
| Collation | `utf8mb4_unicode_ci` |
| 상태 | ⚠️ REQ-260622 폐기 대상 — 신규 테이블/엔티티 추가 금지. 모든 `tac_*` 데이터는 Phase 6 cutover 시점에 PG 로 이전 후 Phase 7 에 컨테이너 삭제 (Q-4 즉시). |

### 4.2 Entity Summary (v1.3 — 28+ tables)

**Core**
- `tac_academies` — 학원 (테넌트)
- `tac_users` — 시스템 사용자 (Admin/Staff)

**Program**
- `tac_programs`, `tac_program_settings`

**People**
- `tac_parents`, `tac_students`, `tac_student_guardians`, `tac_teachers`

**Consultation**
- `tac_consultations`, `tac_visit_records`, `tac_consultation_intake_forms`

**Class**
- `tac_classrooms`, `tac_classes`, `tac_class_sessions`

**Enrollment**
- `tac_enrollments`, `tac_attendances`

**MAP Question Bank**
- `tac_map_passages`, `tac_map_items`, `tac_map_item_versions`
- `tac_map_test_sets`, `tac_map_test_set_items`
- `tac_map_assignments`, `tac_map_responses`
- `tac_map_student_scores`

**Student Extensions**
- `tac_external_test_scores`, `tac_counseling_records`

**Trinity Pay**
- `tac_payment_orders`, `tac_payment_ledger`
- `tac_receipts`, `tac_refund_policies`, `tac_refund_policy_tiers`
- `tac_tax_invoices`

**Portal**
- `tac_posts` (News/Announcements)

**System**
- `tac_audit_logs`

### 4.3 Key Relationships

```
Academy (1) ─── Program (N) ─── Class (N) ─── ClassSession (N)
                                   │                │
                                   │           Attendance (N)
                                   │                │
                              Enrollment (N) ── Student (N)
                                   │
                           PaymentOrder (1)
                                   │
                           PaymentLedger (N)

Parent (1) ─── Student (N) via primary_parent_id
Parent (M) ─── Student (N) via tac_student_guardians (M:N)

Teacher ──── AMA Client (1:1, ama_client_id)
```

---

## 5. Module Scope (모듈 범위)

### 5.1 In-Scope Modules (v1.3)

| Module | FR Range | Priority |
|--------|----------|----------|
| Tenant Public Portal (포털 메인) | FR-043~046 | P0 |
| Program Management | FR-001~003 | P0 |
| Consultation Management | FR-004~006 | P0 |
| Student/Parent Registration | FR-007~008 | P0 |
| Teacher Registration (AMA) | FR-009~010 | P0 |
| Class Management | FR-011~013 | P0 |
| Enrollment | FR-014~015 | P0 |
| Timetable | FR-029~033 | P0~P1 |
| Attendance | FR-016 | P1 |
| Trinity Pay | FR-039~042, FR-047~048 | P0 |
| MAP Question Bank | FR-021~028 | P0~P1 |
| MAP Score / Student Extensions | FR-034~038 | P0~P1 |
| Dashboard | FR-018 | P2 |
| Notification (AmoebaTalk) | FR-019 | P2 |
| Audit Log | FR-020 | P1 |

### 5.2 Out-of-Scope

- 온라인 라이브 수업 플랫폼
- 학원 간 프랜차이즈 그룹 리포트
- AMA Client 원본 수정 (read-only)
- 학생 자가 학습 포털 / 온라인 MAP 응시 UI (Phase 2)
- MAP 문제 자동 출제 AI (v2.x)
- 자체 PG 라이선스

---

## 6. Trinity Pay Design Summary (결제 설계 요약)

### 6.1 Payment Flow

```
Parent → Toss Widget (requestPayment) → Toss → successUrl redirect
  → Server POST /v1/payments/confirm (Basic Auth) → DONE
  + Webhook v2 (reconciliation)
```

### 6.2 Refund Tiers (학원법 시행령 제18조)

| Tier | Condition | Refund Rate |
|------|-----------|-------------|
| 0 | 수업 시작 전 | 100% |
| 1 | elapsed_ratio ≤ 1/3 | 66.67% |
| 2 | 1/3 < elapsed_ratio ≤ 1/2 | 50% |
| 3 | elapsed_ratio > 1/2 | 0% |

`elapsed_ratio = held_session_count / total_session_count`

### 6.3 Tax Invoice

국세청 홈택스 eTax API 직결. DRAFT → SUBMITTED → APPROVED/REJECTED.
익월 10일 법정 시한, 익월 5일 배치 경고.

---

## 7. Brand System — Trinity Heraldic Identity

### 7.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-navy` | `#0E1E3A` | Primary background, header |
| `--color-gold` | `#C9A656` | Accent, CTA, emblem |
| `--color-cream` | `#FAF7EE` | Page background, cards |
| `--color-deep-ink` | `#0B0D14` | Text primary |
| `--color-ama-accent` | `#6F4DB8` | AMA integration sections only |

### 7.2 Typography

| Role | Font Family | Weight |
|------|-------------|--------|
| Display (hero, h1) | Cormorant Garamond + Noto Serif KR | 600~700 |
| Body | Inter + Pretendard | 400~500 |
| Code/Data | JetBrains Mono | 400 |

### 7.3 Design Principles

- 방패형 Heraldic 문장 (T+cross, 왕관, 3성, 페넌트)
- OMNIBUS OMNIA 라틴어 표어
- Navy + Gold 톤 중심, Cream 배경
- AMA 연동 구간에만 Purple accent 사용

---

## 8. Authentication & Authorization (인증/인가)

### 8.1 Auth Strategy

| Area | Method |
|------|--------|
| Portal (public) | No auth (public pages) |
| Portal (intake) | reCAPTCHA v3 + rate limit |
| Admin Console | Session-based auth (JWT cookie) |
| API (admin) | Bearer token / Session cookie |
| API (webhooks) | HMAC signature verification |

### 8.2 Roles

| Role | Level | Access |
|------|-------|--------|
| SUPER_ADMIN | System | All tac_academies |
| ACADEMY_ADMIN | Academy | Full access within academy |
| STAFF | Academy | CRUD (except settings, refund policy) |
| TEACHER | Academy | Own schedule, attendance, MAP |
| CONTENT_EDITOR | Academy | MAP question bank CRUD |

---

## 9. Non-Functional Requirements (비기능 요구사항)

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | API P95 response time | < 300ms (일반) / < 500ms (시간표) |
| NFR-002 | Availability | 99.5% (평일 08:00–22:00) |
| NFR-003 | Scale | 1,000 학생 / 100 교사 / 200 강의 / 50,000 문항 |
| NFR-005 | Personal data encryption | AES-GCM (연락처, 생년월일) |
| NFR-011 | PCI-DSS SAQ-A | 카드 PAN 미저장, Toss token only |
| NFR-012 | Brand consistency | Heraldic Identity 일관 적용 |
| NFR-013 | Legal compliance | 학원법·전자세금계산서법 준수 |
| — | Portal Core Web Vitals | LCP P75 < 2.5s |
| — | Payment success rate | ≥ 98% |

---

## 10. Reference Documents (참고 문서)

| Document | Location |
|----------|----------|
| Requirements Analysis v1.3 | `docs/analysis/academy-management-requirements.md` |
| ERD v1.3 | `docs/design/academy-management-erd.md` |
| Functional Spec v1.3 | `docs/design/academy-management-func-definition.md` |
| Process Definition v1.3 | `docs/design/academy-management-process.md` |
| Sequence Diagrams v1.3 | `docs/design/academy-management-sequence.md` |
| DB Schema SQL v1.3 | `sql/academy-management-schema.sql` |
| Screen UI Mockups | `docs/design/screens/*.html` |
| Design Concept | `docs/design/trinity-academy-concept.html` |
| Summary v1.3 | `docs/trinity-academy-v1.3-summary.md` |
| Amoeba Basic SPEC v2 | `reference/amoeba_basic_SPEC_v2.md` |
| Amoeba Basic Structure v2 | `reference/amoeba_basic_Structure_v2.md` |
| Amoeba Basic Skill v2 | `reference/amoeba_basic_skill_v2.md` |
| Amoeba Code Convention v2 | `reference/amoeba_code_convention_v2.md` |
| Amoeba Web Style Guide v2 | `reference/amoeba_web_style_guide_v2.md` |
| Amoeba Spec Generator SKILL v3.1 | `reference/amoeba-spec-generator-SKILL-v3.1.md` |
