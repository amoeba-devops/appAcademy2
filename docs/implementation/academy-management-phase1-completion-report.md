---
document_id: ACADEMY-RPT-PHASE1-1.0.0
version: 1.0.0
status: Draft
project_code: TAC
stage: Implementation / Phase 1 Closure
authors:
  - 김익용 (gray.kim@amoeba.group)
date: 2026-04-20
related:
  - CLAUDE.md
  - SPEC.md
  - docs/analysis/academy-management-requirements.md (v1.3.0)
  - docs/design/academy-management-func-definition.md (v1.3.0)
  - docs/design/academy-management-erd.md (v1.3.0)
  - docs/design/academy-management-process.md (v1.3.0)
  - docs/design/academy-management-sequence.md (v1.3.0)
  - docs/implementation/academy-management-dev-plan.md
  - sql/academy-management-schema.sql
change_log:
  - 1.0.0 (2026-04-20): 1차 개발 완료 보고서 최초 작성
---

# Trinity Academy 관리 솔루션 — 1차 개발완료보고서
## Phase 1 Development Completion Report

> **OMNIBUS OMNIA** — 모든 이에게 모든 것이 되다 (고린도전서 9:22)

---

## 1. 개요 (Executive Summary)

Trinity Academy(트리니티 아카데미) 관리 솔루션의 **1차 개발(Phase 1)**은, SPEC v1.3.0 · 요구사항 분석서 v1.3.0에 기반하여 **프런트엔드(Next.js 14 포털/관리 콘솔)** 와 **백엔드(NestJS 11 Clean Architecture)** 의 핵심 골격을 모두 구축한 단계로 마감한다.

| 항목 | 내용 |
|------|------|
| **프로젝트 코드** | TAC (Trinity Academy) |
| **기준 스펙 버전** | v1.3.0 (2026-04-19 확정) |
| **보고 시점** | 2026-04-20 |
| **개발 구분** | 1차 (Phase 1 — 골격 구축 + 핵심 모듈 구현) |
| **구현 범위** | 분석·설계 산출물(v1.3.0) 전 8개 In-scope 모듈의 기본 CRUD · 핵심 유스케이스 · 외부연동 어댑터 |
| **코드 규모** | Frontend 111개 `.ts/.tsx`, Backend 285개 `.ts` (총 396개) |
| **페이지** | 44개 라우트(포털 14, 관리 콘솔 30) |
| **유스케이스** | 80개 (12개 도메인 모듈) |
| **도메인 엔티티** | 20개 (도메인 레이어) / 37개 (TypeORM 인프라 엔티티) |
| **컨트롤러 / API 모듈** | 18개 / 13개 |

1차 개발은 **"설계 확정 → 프레임워크 골격 + 기본 CRUD + Trinity Pay 핵심 플로우 + 외부연동 어댑터"** 까지를 스코프로 하며, 실제 운영 데이터 마이그레이션·E2E 품질 보증·AMA 본격 연동·세금계산서 HSM 연동은 **2차 개발(Phase 2)** 로 이월된다.

---

## 2. 개발 대상 및 범위 (Scope)

### 2.1 기준 스펙 요약

v1.3.0 기준 **In-scope 모듈 8개**:

| # | 모듈 | 한 줄 설명 |
|---|------|-----------|
| 1 | **Trinity Academy Main Portal** | 학부모 대면 공개 포털 (SSG/ISR) |
| 2 | **프로그램 관리** | Program / Program Setting / Class 3계층 |
| 3 | **상담 관리** | Portal Intake → Consultation 승격, Visit Record |
| 4 | **학생·학부모 등록** | Student + TPI, Parent 1:N / M:N 가디언 |
| 5 | **교사 등록** | AMA Client 1:1 참조(로컬 중복 저장 금지) |
| 6 | **문제은행 MAP** | Passage / Item / TestSet / Assignment / Grading |
| 7 | **수업시간표** | Class + `class_sessions` 파생 뷰 |
| 8 | **Trinity Pay** | Toss 직결 결제·환불·원장·영수증·**세금계산서** (AMA 미경유) |

### 2.2 1차 개발 포함/제외 구분

| 분류 | 내용 |
|------|------|
| ✅ **포함** | 모노레포 구조 수립, DB 스키마 DDL 적용, NestJS Clean Architecture 골격, 도메인 엔티티·리포지토리 인터페이스, 기본 CRUD 유스케이스, 컨트롤러·모듈·가드·필터, Next.js 14 (portal)·(admin) 라우트 그룹, 44개 페이지 화면, Toss Payments 클라이언트 + Webhook 델타 리컨실러, NTS eTax 어댑터 + 월간 배치 서비스, 인증(NextAuth + JWT Guard), Throttler/Helmet 기본 보안 |
| ⏭ **이월 (Phase 2)** | 실데이터 마이그레이션(TPI.xlsx/수업 확인표.xlsx), AMA Client/AmoebaTalk 실연동, S3 Compatible 스토리지 연동, RabbitMQ 큐 + Worker 구현, 공동인증서 HSM/KMS 연동, E2E 통합 테스트, 성능/부하 테스트, 운영 배포 파이프라인 |

---

## 3. 기술 스택 및 아키텍처 구현 결과 (Tech Stack Realized)

### 3.1 확정 스택

| 구분 | 기술 | 버전 | 비고 |
|------|------|------|------|
| **Monorepo** | npm workspaces + concurrently | — | `npm run dev` 로 FE/BE 동시 기동 |
| **Frontend Framework** | Next.js (App Router) | 14.2.35 | React 18 |
| **UI** | TailwindCSS 3 + shadcn/ui + Radix (`@base-ui/react`) + Lucide | — | Heraldic Brand System 적용 |
| **상태/데이터** | Zustand 5 · TanStack Query 5 · React Hook Form 7 · Zod 4 | — | — |
| **결제 SDK** | @tosspayments/tosspayments-sdk | 2.6.0 | Widget SDK v2 |
| **인증** | next-auth | 4.24.14 | Parent/Admin 분리 로그인 |
| **i18n** | react-i18next | 17.x | ko 기본 |
| **Backend Framework** | NestJS | 11.0.1 | 모듈 단위 Clean Architecture |
| **DB / ORM** | MySQL 8 + TypeORM | 0.3.28 | `synchronize: false` — SQL 마이그레이션 기준 |
| **Auth** | @nestjs/jwt + passport-jwt | — | JWT Bearer |
| **보안** | helmet, @nestjs/throttler (60 req/min) | — | bcrypt, ioredis |
| **문서** | @nestjs/swagger | 11.3.0 | `/api/docs` 자동 노출 |
| **스케줄러** | @nestjs/schedule | 6.1.3 | NTS 배치(익월 5일) 주관 |
| **테스트** | Jest + Playwright | — | 단위/E2E 러너 구비 (케이스는 Phase 2) |

### 3.2 Clean Architecture 레이어 구현 현황

```
Domain (핵심)            Application (유스케이스)     Infrastructure (어댑터)         Presentation (HTTP)
─────────────────        ──────────────────────       ──────────────────────         ─────────────────
entities: 20             use-cases: 80                TypeORM entities: 37           controllers: 18
repositories: 20 (IF)    dto: 12 도메인 묶음          repositories: 21 (구현)        modules: 13
services: 도메인 규칙                                 external/toss: ✅ client+recon  auth / guards / filters
                                                      external/nts: ✅ adapter+batch  interceptors / pipes
                                                      external/ama: ⏭ (Phase 2)
                                                      external/rabbitmq: ⏭ (Phase 2)
                                                      external/storage: ⏭ (Phase 2)
```

- **의존성 방향 준수**: Presentation → Application → Domain ← Infrastructure 역방향 의존 없음 (`eslint-plugin-boundaries`로 강제).
- **DI 경계**: 도메인 리포지토리 인터페이스를 Application이 소비, 인프라 구현체를 Nest 모듈에서 `useClass`로 바인딩.
- **API Prefix**: `/api` 글로벌, Swagger 문서 `/api/docs` (개발환경).

---

## 4. 산출물 상세 (Deliverables)

### 4.1 문서 산출물

| 문서 | 경로 | 상태 |
|------|------|------|
| AI 개발 지침 | `CLAUDE.md` | v1.3.0 Final |
| 프로젝트 명세서 | `SPEC.md` | v1.3.0 Final |
| 요구사항 분석서 | `docs/analysis/academy-management-requirements.md` | v1.3.0 Final |
| 포털 사이트 요구사항 | `docs/analysis/portal-trinity-site-requirements.md` | Final |
| ERD | `docs/design/academy-management-erd.md` | v1.3.0 Final |
| 기능 정의서 | `docs/design/academy-management-func-definition.md` | v1.3.0 Final |
| 기능 상세서 | `docs/design/academy-management-func-spec.md` | Final |
| 프로세스 정의서 | `docs/design/academy-management-process.md` | v1.3.0 Final |
| 시퀀스 다이어그램 | `docs/design/academy-management-sequence.md` | v1.3.0 Final |
| 화면 시안 | `docs/design/screens/*.html` | Final |
| 디자인 컨셉 | `docs/design/trinity-academy-concept.html` | v0.2 |
| DB 스키마 DDL | `sql/academy-management-schema.sql` | v1.3.0 Final |
| 개발 계획서 | `docs/implementation/academy-management-dev-plan.md` | Final |
| WBS (Academy) | `docs/implementation/tasks/ACADEMY-WORKPLAN-1.3.0.md` | Final |
| WBS (Portal) | `docs/implementation/tasks/PORTAL-TASK-TRINITY-SITE-1.0.0.md` | Final |

### 4.2 Frontend 구현 산출물 (Next.js 14)

**포털 (`src/app/(portal)`) — 총 14 라우트**

| 구분 | 경로 | 설명 |
|------|------|------|
| Home | `/` | 히어로·프로그램 하이라이트·공지 SSG |
| About | `/about` | 브랜드·연혁 |
| Programs | `/programs`, `/programs/[id]` | 프로그램 카탈로그·상세 |
| MAP Test | `/map-test` | MAP 시험 안내 |
| Contact | `/contact` | 상담 접수 인테이크 (reCAPTCHA 연동 지점) |
| News | `/news`, `/news/[slug]` | 학원 소식 |
| My Page | `/my`, `/my/payments`, `/my/scores`, `/my/timetable` | 학부모 마이페이지 |
| Auth | `/login/parent` | 학부모 로그인 |

**관리 콘솔 (`src/app/(admin)`) — 총 30 라우트**

| 모듈 | 주요 라우트 |
|------|-------------|
| Dashboard | `/dashboard` (KPI) |
| Programs | `/programs`, `/programs/[id]` |
| Consultations | `/consultations`, `/consultations/[id]` |
| Students | `/students`, `/students/[id]` |
| Teachers | `/teachers`, `/teachers/[id]` |
| Classes | `/classes`, `/classes/[id]` |
| Timetable | `/timetable` |
| Enrollments | `/enrollments` |
| **MAP** | `/map`, `/passages`, `/items`, `/testsets`, `/assignments`, `/grading` |
| **Trinity Pay** | `/payments`, `/payments/new`, `/payments/orders[/id]`, `/payments/confirm`, `/payments/fail`, `/payments/refund/[orderId]`, `/payments/receipts`, `/payments/tax-invoices[/new/[id]]` |
| Settings | `/settings`, `/settings/refund-policy`, `/settings/notifications` |
| Auth | `/login` (admin) |

**컴포넌트·인프라**
- `components/ui/` — shadcn/ui 프리미티브(Button, Card, Dialog, Form 등)
- `components/layout/` — `PortalLayout`, `AdminLayout (Sidebar + Header)`
- `components/portal/`, `components/admin/` — 도메인 전용 블록
- `components/providers/` — ReactQuery Provider, SessionProvider, Theme
- API 프록시: `next.config.mjs` rewrite → `http://localhost:4000`
- 인증: `app/api/auth/[...nextauth]`

### 4.3 Backend 구현 산출물 (NestJS 11)

#### 4.3.1 Domain Layer (`backend/src/domain/`)
- **Entities (20)**: `student`, `parent`, `teacher`, `class`, `program`, `consultation`, `visit-record`, `enrollment`, `payment-order`, `ledger-entry`, `receipt`, `tax-invoice`, `refund-policy`, `map-item`, `map-passage`, `map-test-set`, `map-assignment`, `map-score`, `post`, `base`.
- **Repositories**: 각 엔티티 대응 인터페이스(port) 정의, 인프라 레이어가 TypeORM으로 구현.
- **Services**: 환불 계산·정책 스냅샷·수업 회차 집계 등 순수 도메인 규칙.

#### 4.3.2 Application Layer — Use Cases (80개)

| 모듈 | 유스케이스 수 | 대표 케이스 |
|------|:---:|------|
| student | 4 | create / get / get-detail / update |
| parent | 4 | create / get / get-detail / update |
| teacher | 4 | AMA Client 참조 (`create-teacher`가 AMA Client ID 검증) |
| program | 4 | CRUD + 카탈로그 공개 토글 |
| consultation | 6 | intake→승격, visit-record 기록, status 전이 |
| class | 5+ | 수업 생성, `class_sessions` 파생, 스케줄 충돌 검증 |
| timetable | 1 | 교사/학생/교실 관점 조회 |
| enrollment | 3 | create / get / update-status |
| **map** | 16 | Passage·Item·TestSet·Assignment·Grading CRUD + portal score history |
| **payment** | 10 | `create-order`, `confirm-payment`(Toss Confirm + idempotency), `process-webhook`(델타 리컨), `calculate-refund`(수업일 기준), `execute-refund`(Toss Cancel + 원장 기록), `manage-refund-policy`(버전 관리), `create-tax-invoice` / `submit-tax-invoice` / `get-tax-invoices`, `get-receipts`, `get-payment-orders` |
| post | 1 | 공지/뉴스 |
| dashboard | 1 | KPI 집계 |

#### 4.3.3 Infrastructure Layer

| 서브레이어 | 구현 항목 |
|-----------|-----------|
| `database/entities` | TypeORM 엔티티 **37개** (도메인 + 조인 테이블 포함: `attendance`, `classroom`, `class-session`, `consultation-intake-form`, `counseling-record`, `external-test-score`, `map-*` 계열, `pay-*` 계열, `student-guardian`, `notification-template`, `audit-log`, `academy`, `user`) |
| `database/repositories` | 리포지토리 구현 **21개** (도메인 포트 충족) |
| `external/toss/toss-payments.client.ts` | Confirm / Cancel / 조회 REST 클라이언트, Basic Auth + idempotency |
| `external/toss/delta-reconciler.service.ts` | Toss Webhook v2 HMAC 검증 + 금액/상태 drift 보정 |
| `external/nts/nts-etax.adapter.ts` | XMLDSig 서명·전자세금계산서 발급 요청·승인/거절 파싱 |
| `external/nts/tax-invoice-batch.service.ts` | 익월 5일 경고 배치(FN-106 / PRC-076) |
| `webhook/webhook-idempotency.service.ts` | Webhook 멱등성 키 저장소 |
| `config/` | Env 스키마 / Swagger / TypeORM DataSource |
| `external/ama, rabbitmq, storage` | 디렉터리 스캐폴드(Phase 2에서 구현) |

#### 4.3.4 Presentation Layer

- **Controllers (18)**: `teacher`, `parent`, `student`, `consultation`, `program`, `class`, `timetable`, `enrollment`, `map`, `payment`, `notification-template`, `portal-parent`, `portal-program`, `portal-news`, `portal-map`, `webhook`, `dashboard`, `health`
- **Modules (13)**: 기능 단위 Nest 모듈 — Auth 포함 의존성 그래프 완성
- **Cross-cutting**: `filters/`(글로벌 예외 + 표준 에러 포맷), `guards/`(JwtAuthGuard, RolesGuard, TenantGuard — `academy_id` 자동 주입), `interceptors/`(ResponseMeta, Logging), `pipes/`(ValidationPipe — class-validator)

### 4.4 데이터베이스

- `sql/academy-management-schema.sql` v1.3.0 기준 DDL 적용 가능 (npm run `db:schema`)
- **37 TypeORM 엔티티** 매핑 완료, `synchronize: false` 원칙 유지
- Trinity Pay 영역 6 테이블(`pay_order`, `pay_ledger`, `pay_receipt`, `pay_refund_policy`, `pay_refund_policy_tier`, `pay_tax_invoice`) + 학원법 시행령 제18조 seed 포함
- 멀티테넌시: 모든 테이블 `academy_id` 컬럼 표준화 (NFR-004)

---

## 5. 요구사항 대비 구현 매트릭스 (FR/NFR Coverage)

### 5.1 기능 요구사항 (FR) — 샘플

| FR | 제목 | 1차 구현 상태 | 구현 지점 |
|----|------|:---:|-----------|
| FR-001~010 | 학원/학생/학부모/교사 마스터 | ✅ | `student/parent/teacher` UC + controllers |
| FR-011~018 | 상담 접수·방문·전환 | ✅ | `consultation` UC + `portal-parent.controller` |
| FR-019~024 | 프로그램·Class·세션 | ✅ | `program/class/timetable` UC |
| FR-025~030 | 등록·출결 | ✅ | `enrollment` UC, `attendance.entity` |
| FR-031~036 | MAP 문제은행 | ✅ | `map` UC 16개 |
| FR-040 | Toss Payments 결제 | ✅ | `create-order` + `confirm-payment` + `process-webhook` |
| FR-041 | 환불 (수업일 기준) | ✅ | `calculate-refund` + `execute-refund` |
| FR-047 | 환불 정책 관리 | ✅ | `manage-refund-policy` + `/settings/refund-policy` |
| FR-048 | 세금계산서 자체 발행 | 🟡 부분 | Adapter·배치·테이블 OK / 공동인증서 HSM 연결은 Phase 2 |

### 5.2 비기능 요구사항 (NFR)

| NFR | 요건 | 1차 구현 상태 |
|-----|------|:---:|
| NFR-001 | 응답 시간 SLA | 🟡 구조만 확보 (성능 테스트 Phase 2) |
| NFR-004 | 멀티테넌시(`academy_id`) | ✅ TenantGuard + 컬럼 강제 |
| NFR-005 | 개인정보 암호화 저장 | 🟡 컬럼 VARBINARY 예약 / KMS 키 관리 Phase 2 |
| NFR-011 | PCI-DSS SAQ-A | ✅ PAN/CVC 미저장, `pg_payment_key` 토큰만 보관 |
| NFR-012 | Webhook 서명 검증 | ✅ Toss HMAC 검증 서비스 구현 |
| NFR-013 | 학원법·전자세금계산서법 | 🟡 기본 정책·익월 배치 OK / 공동인증서 만료 알림은 HSM 연동 후 |

### 5.3 시나리오 커버리지 (Sequence v1.3)

| 시나리오 | 제목 | 1차 구현 |
|----------|------|:---:|
| Scenario 01~09 | 상담·학생·교사·수업·MAP 플로우 | ✅ |
| **Scenario 10** | Toss Confirm + Webhook v2 이중 reconciliation | ✅ |
| **Scenario 12** | 수업일 기준 환불 (tier 산출·Toss 취소·원장 기록) | ✅ |
| **Scenario 13** | NTS eTax 발급 + 승인/거절 분기 | 🟡 Adapter 완성 / HSM + 실 통신은 Phase 2 |

---

## 6. 외부 연동 현황 (Integration Status)

| 외부 시스템 | 상태 | 비고 |
|-------------|:---:|------|
| **Toss Payments** | ✅ 구현 | Widget SDK(FE) + Confirm REST + Webhook v2 HMAC + 델타 리컨. 샌드박스 키 필요 |
| **NTS eTax** | 🟡 어댑터 | XML 서명 포맷·배치 OK. 공동인증서 HSM/KMS 연결 Phase 2 (Q-021 미결) |
| **AMA Client Sync** | ⏭ 미구현 | 스캐폴드 디렉터리만 존재. 교사 마스터 1:1 참조 계약 Phase 2 |
| **AmoebaTalk 알림** | ⏭ 미구현 | 템플릿 테이블(`notification_template`)은 구축. 발송 채널 Phase 2 |
| **RabbitMQ** | ⏭ 미구현 | 이벤트 기반 분리 대비 스캐폴드만 |
| **S3 호환 스토리지** | ⏭ 미구현 | MAP Passage PDF / 영수증 PDF 보관용. Phase 2 |
| **reCAPTCHA v3** | ⏭ 미구현 | Portal Contact 폼 키 Wiring Phase 2 |

---

## 7. 보안·컴플라이언스 구현 (Security Posture)

| 항목 | 1차 상태 |
|------|:---:|
| JWT 인증 + Passport 전략 | ✅ |
| Throttler (60 req/min/IP) | ✅ |
| Helmet 기본 헤더 | ✅ |
| bcrypt 해시 | ✅ |
| TypeORM parameterized queries (SQLi 방어) | ✅ |
| React 기본 이스케이프, `dangerouslySetInnerHTML` 금지 규칙 | ✅ (lint 기준) |
| 카드 PAN/CVC 미저장 — `pg_payment_key` 토큰만 | ✅ |
| Webhook HMAC 검증 (Toss `TossPayments-Signature`) | ✅ |
| 개인정보 AES-GCM 암호화 (VARBINARY) | 🟡 컬럼만 |
| 공동인증서 HSM/KMS | ⏭ Phase 2 (Q-021) |
| reCAPTCHA v3 | ⏭ Phase 2 |

---

## 8. 결함·리스크·미결 사안 (Issues & Open Questions)

### 8.1 식별된 기술 리스크

| # | 리스크 | 영향 | 완화 방향 |
|---|--------|------|-----------|
| R-01 | 공동인증서 보관 방식 미결(Q-021) | FR-048 / NFR-013 최종 완료 블로커 | Phase 2 킥오프 첫 스프린트에서 결정 |
| R-02 | 실데이터 마이그레이션 스크립트 부재 | TPI.xlsx / 수업 확인표.xlsx 전환 | ETL 어댑터 Phase 2 별도 트랙 |
| R-03 | AMA Client 스키마 최종 고정 안됨 | 교사 1:1 매핑 계약 | AMA 팀과 스펙 싱크 필요 |
| R-04 | 자동 E2E 테스트 미작성 | 회귀 위험 | Playwright 러너는 확보, 케이스 Phase 2 |
| R-05 | 운영 배포 파이프라인(GitHub Actions/도커) 미구성 | 스테이징 검증 지연 | Phase 2 Sprint 1 |

### 8.2 미결 질문

| Q | 주제 | 상태 |
|---|------|------|
| **Q-016** | 관리 콘솔 도메인 분리(admin.trinityacademy.kr) | TBD |
| **Q-017** | News — 헤드리스 CMS vs 자체 DB | TBD |
| **Q-019** | Toss Brandpay 자동결제 도입 | TBD |
| **Q-020** | 위약금(cancellation fee) 부과 방식 | TBD |
| **Q-021** | 공동인증서 보관 방식 (HSM/KMS) | TBD |

---

## 9. 검증 결과 (Verification Summary)

| 검증 항목 | 결과 |
|-----------|------|
| `npm run build:fe` (Next.js 프로덕션 빌드) | 로컬 성공 기준 — 운영 환경 벤치 Phase 2 |
| `npm run build:be` (Nest build) | 로컬 성공 기준 |
| TypeScript `strict: true` 준수 | ✅ (FE/BE 공통) |
| `eslint-plugin-boundaries`로 레이어 역방향 import 금지 | ✅ |
| Swagger 자동 문서화 | ✅ `/api/docs` 노출 |
| 단위 테스트 케이스 | 🟡 러너 구축, 커버리지 작성은 Phase 2 |
| E2E (Playwright) | 🟡 러너 구축, 시나리오 작성은 Phase 2 |

---

## 10. Phase 2 인계 항목 (Handover to Phase 2)

1. **Q-019/020/021 의사결정 완료** — Brandpay·위약금·공동인증서 보관 방식 확정.
2. **AMA 실연동** — Client 1:1 참조 계약, AmoebaTalk 발송 채널 구축, HMAC 서명.
3. **공동인증서 HSM/KMS 연결 + 만료 30일 전 알림** — NFR-013 완결.
4. **실데이터 마이그레이션** — TPI 학생 정보(4 시트), 수업 확인표(15 시트), imweb 콘텐츠.
5. **RabbitMQ + Worker** — 알림·영수증·세금계산서 비동기 처리 파이프라인.
6. **S3 호환 스토리지** — MAP Passage PDF / Receipt / Tax Invoice XML·PDF.
7. **개인정보 AES-GCM 키 관리** — KMS 키 + 인코딩 유틸.
8. **reCAPTCHA v3** — Portal Contact/Intake.
9. **CI/CD 파이프라인** — GitHub Actions + 도커 + 스테이징/운영 환경 분리.
10. **단위·E2E 테스트 커버리지 확장** — 결제/환불/세무 시나리오 우선.
11. **성능·부하 테스트** — NFR-001 응답 SLA 검증.
12. **브랜드 시스템 최종화** — Heraldic 문장 v1.0 승격.

---

## 11. 결론 (Conclusion)

1차 개발은 **SPEC v1.3.0 확정 → Clean Architecture 기반 프런트/백엔드 골격 + In-scope 8개 모듈의 기본 유스케이스 + Trinity Pay 핵심 플로우(결제·환불·세금계산서 어댑터)** 구축까지를 목표대로 완료했다.

- **완결도 높은 영역**: 포털·관리 콘솔 라우트 구조, 도메인/유스케이스/컨트롤러 레이어, Toss Payments 결제·환불 플로우, 환불 정책 버전 관리, 수업일 기준 환불 계산.
- **Phase 2 필수 영역**: AMA/AmoebaTalk 실연동, 공동인증서 HSM, 실데이터 마이그레이션, 비동기 파이프라인(RabbitMQ + Storage), 테스트·배포 자동화.

본 보고서 승인 후 Phase 2 킥오프(스프린트 0 플래닝)로 이행한다.

---

### 부록 A. 코드 규모 (as of 2026-04-20)

| 계측 | 수치 |
|------|-----:|
| Frontend `.ts/.tsx` 파일 | 111 |
| Frontend 페이지 (App Router `page.tsx`) | 44 |
| Frontend 컴포넌트 파일 | 33 |
| Backend `.ts` 파일 | 285 |
| Backend 도메인 엔티티 | 20 |
| Backend 유스케이스 | 80 |
| Backend TypeORM 엔티티 | 37 |
| Backend 리포지토리 구현 | 21 |
| Backend 컨트롤러 | 18 |
| Backend Feature 모듈 | 13 |

### 부록 B. 실행 명령 (Quick Start)

```bash
# 의존성 설치
npm run install:all

# DB 스키마 적용 (MySQL 컨테이너 필요)
npm run db:schema
npm run db:seed

# 개발 서버 동시 기동 (FE:3000, BE:4000)
npm run dev

# 프로덕션 빌드
npm run build
```

### 부록 C. 참조 문서

| 문서 | 경로 |
|------|------|
| CLAUDE.md | [CLAUDE.md](../../CLAUDE.md) |
| SPEC.md | [SPEC.md](../../SPEC.md) |
| Requirements v1.3 | [analysis/academy-management-requirements.md](../analysis/academy-management-requirements.md) |
| ERD v1.3 | [design/academy-management-erd.md](../design/academy-management-erd.md) |
| Functional Definition v1.3 | [design/academy-management-func-definition.md](../design/academy-management-func-definition.md) |
| Process v1.3 | [design/academy-management-process.md](../design/academy-management-process.md) |
| Sequence v1.3 | [design/academy-management-sequence.md](../design/academy-management-sequence.md) |
| Dev Plan | [implementation/academy-management-dev-plan.md](./academy-management-dev-plan.md) |
| DB Schema | [sql/academy-management-schema.sql](../../sql/academy-management-schema.sql) |

— *End of Document* —
