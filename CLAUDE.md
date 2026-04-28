# app-academy — Claude Code AI Instructions

> **Project Code**: TAC (내부 코드 / DB prefix `tac_`)
> **Version**: v1.4.1
> **Last Updated**: 2026-04-28
> **Canonical Repo**: https://github.com/amoeba-devops/appAcademy2 (이전 `KimIgyong/app-academy`은 fallback only — see [docs/deployment/REPO-MIGRATION-GUIDE.md](docs/deployment/REPO-MIGRATION-GUIDE.md))

---

## 1. Project Overview (프로젝트 개요)

**app-academy**는 중·고등부 영어·수학 학원의 운영 전반을 디지털화하는 다중 테넌트 학원 관리 SaaS다. AMA App Store를 통해 학원별로 프로비저닝된다.
- 학부모 대면 포털 + 운영 콘솔(admin)을 **프론트엔드(React/Next.js)** + **백엔드(NestJS)** Clean Architecture로 구축한다.
- 기존 imweb 기반 홍보 사이트와 엑셀(TPI 학생 정보, 수업 확인표)을 대체한다.
- AMA(아메바) 플랫폼의 교사 마스터 · AmoebaTalk 알림 기능과 연계한다.
- **결제·정산(Pay)은 Toss Payments PG 직결** — AMA 미경유.
- **첨 입주 테넌트**: Trinity Academy (트리니티 아카데미) — 테넌트 테마·로고·콘텐츠는 입주 테넌트별로 독립 관리된다.

### Default Brand (테넌트 중립 기본 셰)
- 기본 컬러/타이포그래피는 내부 admin 콘솔용 세트립 색상 (Inter + Pretendard).
- 입주 테넌트의 포털 브랜딩은 `academy.brand_*` 설정으로 주입된다.
- Trinity Academy 테넌트 셰(Heraldic 방패 문장, OMNIBUS OMNIA, Navy/Gold/Cream, Cormorant Garamond)은 입주 테넌트 레퍼런스이며 새 공용 코드에 하드코딩하지 않는다.

---

## 2. Tech Stack (기술 스택)

### Frontend (`frontend/`)
| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 14.x |
| **UI Library** | React | 18.x |
| **Language** | TypeScript | 5.x |
| **Styling** | TailwindCSS + shadcn/ui | 3.x |
| **State** | Zustand (client) + React Query (server) | 5.x / 5.x |
| **Form** | React Hook Form + Zod | 7.x / 4.x |
| **Icons** | Lucide React | latest |
| **i18n** | react-i18next (ko default) | 17.x |

### Backend (`backend/`)
| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | NestJS | 11.x |
| **Language** | TypeScript (strict) | 5.x |
| **ORM** | TypeORM | latest |
| **Database** | MySQL | 8.x |
| **Validation** | class-validator + class-transformer | latest |
| **API Docs** | Swagger (@nestjs/swagger) | latest |
| **PG** | Toss Payments | Widget SDK v2 |

### Shared Infrastructure
| Layer | Technology | Version |
|-------|-----------|---------|
| **Cache** | Redis | 7.x |
| **Queue** | RabbitMQ | 3.x |
| **Storage** | S3 Compatible | — |
| **Runtime** | Node.js | 20.x LTS |

---

## 3. Project Structure (프로젝트 구조)

```
app-academy/
├── frontend/                        # React / Next.js 14 (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (portal)/            # 학부모 대면 포털 (public)
│   │   │   │   ├── page.tsx         # Home
│   │   │   │   ├── about/
│   │   │   │   ├── programs/
│   │   │   │   ├── map-test/
│   │   │   │   ├── contact/
│   │   │   │   └── news/
│   │   │   ├── (admin)/             # 운영 콘솔 (authenticated)
│   │   │   │   ├── dashboard/
│   │   │   │   ├── programs/
│   │   │   │   ├── consultations/
│   │   │   │   ├── students/
│   │   │   │   ├── teachers/
│   │   │   │   ├── classes/
│   │   │   │   ├── timetable/
│   │   │   │   ├── enrollments/
│   │   │   │   ├── map/
│   │   │   │   ├── payments/
│   │   │   │   └── settings/
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/              # Shared UI Components
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── layout/
│   │   │   ├── portal/
│   │   │   └── admin/
│   │   ├── lib/utils/               # Helper functions (cn.ts etc.)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── stores/                  # Zustand stores
│   │   ├── types/                   # Shared TypeScript types
│   │   └── styles/                  # Design tokens, brand system
│   ├── public/                      # Static assets
│   │   ├── images/
│   │   └── fonts/
│   ├── next.config.mjs              # API proxy → backend:4009
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                         # NestJS — Clean Architecture
│   ├── src/
│   │   ├── domain/                  # Domain Layer (순수 비즈니스 로직)
│   │   │   ├── entities/            # Domain entities
│   │   │   ├── repositories/        # Repository interfaces (ports)
│   │   │   └── services/            # Domain services
│   │   ├── application/             # Application Layer (use cases, DTOs)
│   │   │   ├── use-cases/
│   │   │   └── dto/
│   │   ├── infrastructure/          # Infrastructure Layer (adapters)
│   │   │   ├── database/
│   │   │   │   ├── entities/        # TypeORM entities
│   │   │   │   └── repositories/    # TypeORM repository implementations
│   │   │   ├── config/
│   │   │   └── external/            # 외부 서비스 연동
│   │   │       ├── toss/
│   │   │       ├── ama/
│   │   │       ├── rabbitmq/
│   │   │       └── storage/
│   │   ├── presentation/            # Presentation Layer (HTTP)
│   │   │   ├── controllers/
│   │   │   ├── filters/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   └── pipes/
│   │   ├── common/                  # Cross-cutting concerns
│   │   │   ├── decorators/
│   │   │   ├── constants/
│   │   │   └── interfaces/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   └── package.json
│
├── docs/                            # SDLC Documentation
│   ├── analysis/
│   ├── design/
│   │   └── screens/
│   ├── implementation/
│   │   └── tasks/
│   ├── test/
│   ├── bug-fix/
│   └── amoeba-starter-kit/          # Amoeba 플랫폼 참조 문서
│
├── sql/                             # DB Migration SQL
├── reference/                       # 프로젝트 참조 문서
│
├── CLAUDE.md                        # This file
├── SPEC.md
├── README.md
├── CHANGELOG.md
├── package.json                     # Monorepo root (concurrently)
└── .gitignore
```

---

## 4. Architecture Principles (아키텍처 원칙)

### 4.1 Clean Architecture Layers
```
Domain (핵심)  →  Application (유스케이스)  →  Infrastructure (어댑터)  →  Presentation (HTTP)
  ├ entities        ├ use-cases                ├ database/TypeORM        ├ controllers
  ├ repositories    └ dto                      ├ external services       ├ guards/filters
  └ domain services                            └ config                  └ interceptors/pipes
```
- **의존성 방향**: Presentation → Application → Domain ← Infrastructure
- Domain 레이어는 외부 프레임워크(NestJS, TypeORM)에 의존하지 않는다.
- Infrastructure가 Domain의 리포지토리 인터페이스를 구현한다 (Dependency Inversion).

### 4.2 Frontend Route Convention
- `(portal)` — SSG/ISR, 학부모 대면 공개 사이트. `PortalLayout` 사용.
- `(admin)` — SSR, 인증 필수 운영 콘솔. `AdminLayout` (Sidebar + Header) 사용.
- Frontend `/api/*` 요청은 `next.config.mjs` rewrite로 NestJS backend(`localhost:4009`)에 프록시.

### 4.3 Backend API Convention
- Global prefix: `/api`
- RESTful JSON API — NestJS Controllers
- Swagger docs: `/api/docs` (개발 환경)
- Port: 4009 (Frontend: 3009)

### 4.4 Data Flow
```
React (Frontend:3009)
    → fetch /api/*
    → Next.js rewrite proxy
    → NestJS Controller (Backend:4009)
    → Use Case → Domain Service → Repository Interface
    → TypeORM Repository Implementation → MySQL
                     ↕
            RabbitMQ (events)
                     ↓
            Workers (Notification, Receipt, TaxInvoice)
```

### 4.5 Multi-Tenancy
- 모든 데이터 테이블은 `academy_id` 컬럼으로 테넌트 격리 (NFR-004).
- API Guard에서 세션의 `academy_id` 자동 주입.

### 4.6 AMA Integration Boundary
- **연동 O**: 교사 마스터(Client 1:1 참조), AmoebaTalk 알림
- **연동 X**: 결제·환불·세무 트랜잭션 — Pay 모듈이 Toss Payments 직결

### 4.7 Local Dev Port Convention (로컬 개발 포트 규칙)

> **고정 포트** — 다른 로컬 프로젝트와의 충돌을 피하기 위해 TAC는 항상 아래 포트를 사용한다. 변경 시 본 섹션·SPEC.md·`.env*`·`next.config.mjs`·`backend/src/main.ts`를 함께 갱신한다.

| Service | Port | URL | Source of truth |
|---------|------|-----|-----------------|
| Frontend (Next.js dev) | **3009** | http://localhost:3009 | `frontend/package.json` `dev` script (`next dev -p 3009`) |
| Admin Console | 3009 | http://localhost:3009/admin | — |
| Admin Login | 3009 | http://localhost:3009/admin/login | — |
| Backend (NestJS) | **4009** | http://localhost:4009/api | `backend/.env` `PORT`, `backend/src/main.ts` default |
| Swagger Docs | 4009 | http://localhost:4009/api/docs | — |

- **금지 포트**: 3000(다른 로컬 프로젝트 점유), 4000(과거 기본값) — 새 코드/문서에 사용 금지.
- 환경변수: `PORT=4009`, `FRONTEND_URL=http://localhost:3009`, `BACKEND_URL=http://localhost:4009`, `API_PROXY_URL=http://localhost:4009`, `NEXTAUTH_URL=http://localhost:3009`, `NEXT_PUBLIC_SITE_URL=http://localhost:3009`.
- Staging/Production은 docker compose 내부 포트(컨테이너 간 통신)를 별도로 사용하며 본 섹션 적용 대상 아님.

---

## 5. Database Convention (DB 규칙)

### 5.1 Naming
| Item | Rule | Example |
|------|------|---------|
| Database | `db_tac` | — |
| Table prefix | `tac_` | `tac_students`, `tac_payment_orders` |
| Sub-domain prefix | `tac_{sub}_` | `tac_map_items`, `tac_pay_ledger` |
| Column (PK) | `id` (BIGINT AUTO_INCREMENT) | — |
| Column (FK) | `{referenced_table}_id` | `student_id`, `class_id` |
| Column (timestamp) | `created_at`, `updated_at` | DATETIME, NOT NULL |
| Column (soft delete) | `deleted_at` | DATETIME, nullable |
| Column (boolean) | `is_{name}` | `is_active`, `is_default_template` |
| Column (status) | `status` | VARCHAR, ENUM values in UPPER_SNAKE |
| Index | `idx_{table}_{columns}` | `idx_tac_students_academy_status` |
| Unique | `uq_{table}_{columns}` | `uq_tac_teachers_academy_ama_client` |

### 5.2 Key Entity Rules
- `parents.phone_encrypted`, `email_encrypted` — AES-GCM 암호화 (NFR-005)
- `receipts.buyer_identifier` — VARBINARY(128) 암호화
- `payment_orders.pg_payment_key` — VARCHAR(200), 카드 PAN 미저장 (PCI-DSS SAQ-A)
- `refund_policies` + `refund_policy_tiers` — 환불 정책 버전 관리, 소급 미적용
- `tax_invoices` — NTS 생명주기 추적 (DRAFT → SUBMITTED → APPROVED / REJECTED)

---

## 6. API Convention (API 규칙)

### 6.1 Base Path
```
/api/{resource}                    # e.g., /api/students
/api/{resource}/[id]               # e.g., /api/students/123
/api/{resource}/[id]/{sub}         # e.g., /api/consultations/5/visits
/api/portal/{resource}             # Portal-specific endpoints
/api/webhooks/{provider}           # Webhook receivers
```

### 6.2 Response Format
```typescript
// Success
{ data: T, meta?: { page, limit, total } }

// Error
{ error: { code: string, message: string, details?: any } }
```

### 6.3 Status Codes
| Code | Usage |
|------|-------|
| 200 | OK (조회, 수정 성공) |
| 201 | Created (생성 성공) |
| 400 | Validation Error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (중복 등록, 스케줄 충돌) |
| 422 | Unprocessable Entity (비즈니스 규칙 위반) |
| 503 | External Service Unavailable (AMA, Toss) |

---

## 7. Code Convention (코드 규칙)

### 7.1 TypeScript
- `strict: true` 필수
- `any` 사용 금지 — 불가피한 경우 `unknown` + type guard
- Response/Request type은 `types/` 폴더에 정의

### 7.2 Components
- Server Components 기본, Client Components는 `'use client'` 명시
- 파일명: `kebab-case.tsx` (e.g., `student-form.tsx`)
- 컴포넌트명: `PascalCase` (e.g., `StudentForm`)
- Hooks: `camelCase` with `use` prefix (e.g., `useStudents`)

### 7.3 Styling
- Tailwind utility classes 우선
- 디자인 토큰은 `heraldic-tokens.css` CSS variables 참조
- shadcn/ui 컴포넌트 커스텀은 `components/ui/` 에서만

### 7.4 Naming Convention
| Item | Convention | Example |
|------|-----------|---------|
| File (component) | kebab-case | `payment-order-list.tsx` |
| File (util/lib) | kebab-case | `toss-client.ts` |
| Component | PascalCase | `PaymentOrderList` |
| Function/Variable | camelCase | `calculateRefundAmount` |
| Constant | UPPER_SNAKE | `REFUND_POLICY_TIERS` |
| Type/Interface | PascalCase | `PaymentOrder`, `RefundTier` |
| Enum value | UPPER_SNAKE | `DONE`, `CANCELED`, `PARTIAL_CANCELED` |
| API route file | `route.ts` | `app/api/payments/route.ts` |
| CSS variable | kebab-case | `--color-heraldic-gold` |

---

## 8. Module Map (모듈 맵)

```
Portal (Public)          Admin Console              Integration
─────────────────        ──────────────────         ─────────────
Home (SSG)               Dashboard                  AMA Client Sync
About                    Program Management         AmoebaTalk Notify
Programs Catalog         Consultation Management    Toss Payments
MAP Test Info            Student/Parent Mgmt        NTS eTax API
Contact (Intake)         Teacher Management
News                     Class Management
                         Timetable View
                         Enrollment Management
                         Pay (Payment/Refund)
                         MAP Question Bank
                         Settings (Refund Policy)
```

---

## 9. Workflow Rules (작업 규칙)

### 9.1 작업 시작 전 필수 확인
1. **CLAUDE.md** (이 파일) 프로젝트 지침 확인
2. **SPEC.md** 프로젝트 명세 확인
3. **관련 설계 문서** (`docs/design/`, `docs/analysis/`) 확인
4. **Memory** (`/memories/`, `/memories/session/`, `/memories/repo/`) 확인

### 9.2 요구사항 작업 시 진행 중단점
- 요구사항 분석서 + 작업 계획서 작성 후 **반드시 사용자 확인을 받은 후** 구현으로 진행한다.
- 작업 계획서에는 **화면 구성안(UI 레이아웃 목업)**을 반드시 포함한다.

### 9.3 문서 작성 규칙
- **이중 언어**: 영어 우선, 한국어 병기 — Section headers: `## 1. Overview (개요)`
- **문서 ID**: `{FEATURE}-{TYPE}-{VERSION}` (e.g., `ACADEMY-REQ-1.3.0`)
- **버전 관리**: YAML front matter with `document_id`, `version`, `status`, `change_log`
- **파일 저장**: `docs/{stage}/{feature}-{type}.md`

### 9.4 버그 수정 보고서
- `docs/bug-fix/FIX-{YYMMDD}-{제목}.md` 형식

### 9.5 Git Convention
```
feat(module): description       # 새 기능
fix(module): description        # 버그 수정
docs(stage): description        # 문서
refactor(module): description   # 리팩토링
style(module): description      # 코드 포맷
test(module): description       # 테스트
chore: description              # 빌드/설정
```

---

## 10. Key Design References (주요 설계 참조)

| Document | Path |
|----------|------|
| 요구사항 분석서 v1.3 | `docs/analysis/academy-management-requirements.md` |
| ERD v1.3 | `docs/design/academy-management-erd.md` |
| 기능 정의서 v1.3 | `docs/design/academy-management-func-definition.md` |
| 프로세스 정의서 v1.3 | `docs/design/academy-management-process.md` |
| 시퀀스 다이어그램 v1.3 | `docs/design/academy-management-sequence.md` |
| DB Schema SQL v1.3 | `sql/academy-management-schema.sql` |
| 화면 UI 시안 | `docs/design/screens/*.html` |
| 디자인 컨셉 | `docs/design/trinity-academy-concept.html` |

---

## 11. Security Rules (보안 규칙)

1. **PCI-DSS SAQ-A**: 카드 PAN/CVC 절대 저장 금지. `pg_payment_key` 토큰만 보관.
2. **개인정보**: 연락처·생년월일 암호화 저장 (AES-GCM). `VARBINARY` 컬럼 사용.
3. **Webhook 검증**: Toss `TossPayments-Signature` HMAC, AMA HMAC 서명 필수 검증.
4. **인증서**: 공동인증서는 KMS envelope 암호화로 S3 보관, 서명 워커 메모리에서만 복호화 후 즉시 zeroize ([ADR-003](docs/design/adr/ADR-003-cert-storage.md)). 코드에 하드코딩 금지.
5. **CAPTCHA**: Portal intake 폼에 reCAPTCHA v3 적용.
6. **Rate Limiting**: API 엔드포인트에 rate limit 적용.
7. **SQL Injection**: TypeORM parameterized queries 사용 (raw SQL 최소화).
8. **XSS**: React 기본 이스케이프 + dangerouslySetInnerHTML 사용 금지.

---

## 12. Open Questions (미결 사항)

| Q | Topic | Status |
|---|-------|--------|
| Q-019 | Toss Brandpay 자동결제 | **Out of scope** — 현 개발 범위 제외 (2026-04-27). 향후 구독제 요구 발생 시 재검토 |
| Q-020 | 위약금(cancellation fee) 처리 | **Out of scope** — 현 개발 범위 제외 (2026-04-27). 학원법 시행령 기본 환불 정책만 적용 |
| Q-021 | 공동인증서 보관 방식 (HSM/KMS) | **Resolved** — KMS envelope 암호화 + 서명 워커 메모리 처리 ([ADR-003](docs/design/adr/ADR-003-cert-storage.md), 2026-04-27) |
| Q-016 | 도메인 분리 (admin.trinityacademy.kr) | **Resolved** — 단일 호스트 + `/admin/*` 경로 유지 ([ADR-002](docs/design/adr/ADR-002-admin-domain-split.md), 2026-04-27) |
| Q-017 | News — 헤드리스 CMS vs 자체 DB | **Resolved** — 자체 DB 유지 ([ADR-001](docs/design/adr/ADR-001-news-storage.md), 2026-04-27) |
