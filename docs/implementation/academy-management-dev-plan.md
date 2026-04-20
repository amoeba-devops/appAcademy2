---
document_id: ACADEMY-DEVPLAN-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-20
updated: 2026-04-20
author: 김익용
reviewers: []
change_log:
  - version: 1.3.0
    date: 2026-04-20
    author: 김익용
    description: |
      Initial development plan for Trinity Academy v1.3. Aligned with closed decisions
      (Toss Payments / 수업일 기준 환불 / NTS eTax 자체 발행) and the 8-module scope.
      Clean Architecture backend (NestJS) + Next.js 14 App Router monorepo.
---

# Trinity Academy — Development Plan (트리니티 아카데미 개발계획서)

본 문서는 Trinity Academy 관리 솔루션 v1.3 의 **개발 수행 계획**을 기술한다. 요구사항 분석서(`ACADEMY-REQ-1.3.0`), 기능 정의서(`ACADEMY-FUNC-1.3.0`), ERD(`ACADEMY-ERD-1.3.0`), 프로세스 정의서(`ACADEMY-PROC-1.3.0`)에 기반해 **단계(phase) · 모듈 · 리스크 · 품질 기준**을 정의한다.

작성 관점은 "개념과 설계" — 일일 작업 체크리스트가 아니라 **어떤 순서로, 어떤 원칙으로, 어떤 단위로 개발을 진행할 것인가**에 대한 의사결정을 명시한다. 실제 일일 WBS 와 이슈 카드는 GitHub Projects 로 분리 관리된다.

---

## 1. Project Overview (프로젝트 개요)

| Item | Value |
|------|-------|
| **Project code** | TAC (Trinity Academy) |
| **Version** | v1.3.0 |
| **Duration** | 2026-04-27 ~ 2026-09-25 (22 weeks) |
| **Team size** | 5 (PM 1 · Full-stack 2 · Frontend 1 · Backend 1 · QA 0.5) |
| **Go-Live target** | 2026-10 (신학기 개강 전) |
| **Scope** | 8 modules (Portal + Admin) + Trinity Pay + AMA integration |
| **Out of scope (v1.3)** | Toss Brandpay (Q-019), 위약금(Q-020), admin subdomain split (Q-016) |
| **Repository** | GitHub private `amoeba-company/trinity-academy` |
| **Project board** | GitHub Projects: `Trinity Academy v1.3` |
| **Redmine project** | `trinity-academy` (bidirectional sync with GitHub) |

### 1.1 Goals (개발 목표)

개발의 최우선 목표는 **2026년 가을학기 개강 전 운영 가능 상태로 론칭**하는 것이다. 이를 위해 핵심 경로(상담 → 등록 → 수업 → 성적 → 결제/환불 → 영수증·세금계산서)가 v1.0 시점부터 end-to-end 로 동작해야 한다. 부가 기능 — 리포트 고도화, 브랜드페이 자동결제, 뉴스 CMS, 학부모 앱 — 은 v1.4 이후로 분리한다.

두 번째 목표는 **기존 imweb 홍보 사이트 및 엑셀 기반 운영의 대체**. 기존 운영자가 별도 교육 없이 전환 가능하도록, 주요 화면의 **정보 구조와 용어**를 기존 엑셀(`TPI 학생 정보`, `수업 확인표`)과 일치시킨다.

세 번째 목표는 **아메바 플랫폼 일관성 유지**. 교사 마스터와 AmoebaTalk 알림은 AMA 를 경유하되, 결제·세무 트랜잭션은 Trinity Pay 내부에 고립된다(C-003). 이 경계를 코드·시퀀스·배포 모든 층에서 유지한다.

### 1.2 Scope Matrix (범위 매트릭스)

| Module | v1.3 in scope | v1.4+ deferred |
|--------|--------------|---------------|
| Portal (Home/About/Programs/MAP/Contact/News) | ✅ | News CMS 고도화(Q-017) |
| Consultation (Kanban + 방문/시험/등록 흐름) | ✅ | — |
| Student / Parent | ✅ | 학부모 모바일 앱 |
| Teacher (AMA Client mirror) | ✅ | 교사 역할 화면 확장 |
| Program / Class / Session | ✅ | 온라인 수업 모듈 |
| MAP Question Bank (Passage/Item/TestSet/Assign/Grade) | ✅ | MAP 자동 채점(객관식 AI) |
| Timetable (주간 달력·세션 상세) | ✅ | 월간 뷰, iCal export |
| Trinity Pay (Toss + 수업일 기준 환불 + NTS eTax 자체) | ✅ | Brandpay(Q-019), 위약금(Q-020) |
| Dashboard / Settings (Refund Policy Admin) | ✅ | Advanced BI |

---

## 2. Technical Architecture (기술 아키텍처)

### 2.1 System Topology (시스템 구성도)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Users (Browsers)                                 │
│  학부모·원생       원장·교무·교사·회계      운영자                          │
└──────────┬──────────────────┬──────────────────┬─────────────────────────┘
           │ https             │ https             │ https
           ▼                   ▼                   ▼
   trinityacademy.kr     (공통 도메인 또는 admin.trinityacademy.kr Q-016)
   ┌──────────────────────────────────────────────────────────────────┐
   │  Next.js 14 App Router (Vercel / Self-hosted)                    │
   │  ├─ (portal)   SSG+ISR  ─ 학부모 대면                            │
   │  └─ (admin)    SSR      ─ 운영 콘솔 (인증 필수)                   │
   └──────────────┬───────────────────────────────────────────────────┘
                  │ /api/* rewrite proxy
                  ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  NestJS 11 (Clean Architecture) — Backend :4000                  │
   │  ┌─Presentation(Controllers/Guards/Interceptors)                 │
   │  └─Application(UseCases/DTO) → Domain ← Infrastructure(TypeORM)  │
   └──┬─────────────────┬───────────────────┬────────────┬────────────┘
      │                 │                   │            │
      ▼                 ▼                   ▼            ▼
 ┌─────────┐    ┌──────────────┐     ┌──────────┐   ┌───────────┐
 │ MySQL 8 │    │  Redis 7     │     │RabbitMQ 3│   │  S3 호환  │
 │ db_tac  │    │ cache/session│     │  events  │   │ storage   │
 └─────────┘    └──────────────┘     └────┬─────┘   └───────────┘
                                          │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                    ┌────────────────┐         ┌─────────────────┐
                    │ Notification    │         │ Receipt /       │
                    │ Worker          │         │ TaxInvoice      │
                    │ (AmoebaTalk)    │         │ Worker(NTS eTax)│
                    └────────────────┘         └─────────────────┘

  External:  Toss Payments (Widget SDK v2 + Confirm API + Webhook v2)
             NTS Hometax eTax API (공동인증서 HSM/KMS 보관)
             AMA Client API (교사 마스터 read-only mirror)
             AmoebaTalk API (카카오 알림톡 발송)
```

### 2.2 Stack Decisions (스택 결정과 이유)

| Layer | Choice | Rationale (근거) |
|-------|--------|-----------------|
| Frontend Framework | Next.js 14 App Router | Portal SSG/ISR + Admin SSR 을 **동일 코드베이스**로, 라우트 그룹 `(portal)` / `(admin)` 로 분리. imweb 대체를 위한 SEO/성능 요건 충족. |
| UI System | TailwindCSS + shadcn/ui + heraldic-tokens.css | 브랜드 시스템(OMNIBUS OMNIA)을 디자인 토큰으로 고정, 코드에서 하드코딩된 색상 금지. |
| State (client) | Zustand | Redux 대비 보일러플레이트 적고, admin 운영 콘솔의 비동기 플로우에 적합. |
| State (server) | React Query v5 | 캐싱·mutation·optimistic update 일관화. |
| Backend Framework | NestJS 11 (Clean Architecture) | Domain 분리를 강제하고 Toss/AMA/NTS 어댑터를 **Infrastructure 레이어에 고립**. 단위테스트가 Domain 순수 함수에 집중. |
| ORM | TypeORM | NestJS 생태계 표준 + 마이그레이션 버전관리. |
| DB | MySQL 8 | Amoeba 플랫폼 표준(아메바톡·캠페인과 정합), JSON 컬럼 지원. |
| Cache/Session | Redis 7 | RateLimit/세션/결제 idempotency key 보관. |
| Queue | RabbitMQ 3 | 알림톡·영수증·세금계산서 등 **비동기 후처리**를 backend 에서 분리. |
| Runtime | Node.js 20 LTS | 동일 TypeScript 스택으로 Full-stack 인력 유동성 확보. |

### 2.3 Architecture Principles (아키텍처 원칙)

**Clean Architecture 의존성 규칙.** Domain 레이어는 외부(NestJS·TypeORM·Toss SDK)를 import 하지 않는다. Infrastructure 가 Domain 의 Repository 인터페이스를 구현한다. 이 원칙은 `eslint-plugin-boundaries` 로 CI 에서 강제한다.

**PG 어댑터 격리.** `infrastructure/external/toss/` 밖에서는 Toss SDK 타입/상수를 직접 참조하지 않는다. Domain 은 `PaymentProvider` 인터페이스만 알며, 결제 상태는 내부 enum (`DONE`/`CANCELED`/`PARTIAL_CANCELED`/`ABORTED`/`EXPIRED`/`IN_PROGRESS`/`READY`) 로 표준화.

**AMA 경계 유지.** `external/ama/` 는 **Teacher Client read-only mirror** + **AmoebaTalk notify publish** 의 두 기능만 제공. 결제·환불·세무 엔드포인트는 AMA 를 절대 호출하지 않는다. 이는 코드리뷰 체크리스트로 명문화.

**멀티테넌시.** 모든 주요 테이블에 `academy_id` 컬럼(NFR-004). API Guard 에서 세션의 academy_id 를 TypeORM QueryBuilder 의 global where 조건으로 자동 주입한다.

**결제·환불 불변식.** `payment_orders.refund_policy_version_id` 를 주문 생성 시 스냅샷. 이후 정책 버전이 바뀌어도 **기존 주문은 해당 시점 정책으로 처리**(소급 미적용).

---

## 3. Development Environment (개발 환경)

### 3.1 Environment Matrix (환경 매트릭스)

| Env | Domain | Purpose | PG | NTS eTax | AMA |
|-----|--------|---------|----|---------|-----|
| **Local** | localhost:3000/4000 | 개발자 로컬 | Toss Sandbox | NTS 테스트베드 | AMA Dev |
| **Dev** | dev.trinityacademy.kr | 통합 개발 | Toss Sandbox | NTS 테스트베드 | AMA Dev |
| **Staging** | stg.trinityacademy.kr | 운영자 UAT | Toss Sandbox | NTS 테스트베드 | AMA Stg |
| **Production** | trinityacademy.kr | 실서비스 | Toss Live | NTS 운영 | AMA Prod |

### 3.2 Git Flow (브랜치 전략)

```
main                                    ── 운영(태깅 v1.x.x)
  │
  └── release/v1.3.0                    ── 릴리스 안정화
        │
        └── develop                     ── 통합 개발
              │
              ├── feature/{n}-{desc}    ── 신규 기능 (issue 매핑)
              ├── bugfix/{n}-{desc}     ── 버그 수정
              ├── enhance/{n}-{desc}    ── 개선
              └── docs/{n}-{desc}       ── 문서 전용
```

- 모든 브랜치는 **GitHub Issue 번호**를 접두로 포함 (예: `feature/42-toss-widget-init`).
- PR 은 **develop** 으로만 열고, 최소 1명의 리뷰어 승인 + CI 통과 후 squash merge.
- main 으로의 머지는 release 브랜치 QA 사인오프 후.

### 3.3 CI/CD Pipeline (배포 파이프라인)

```
Push / PR 이벤트
   │
   ▼
 GitHub Actions
   ├─ lint (eslint / prettier / stylelint)
   ├─ typecheck (tsc --noEmit)
   ├─ test:unit        ─ Domain/Application 단위 테스트
   ├─ test:integration ─ Backend + MySQL testcontainer
   ├─ test:e2e         ─ Playwright (핵심 경로 5개 시나리오)
   ├─ build (next / nest)
   └─ boundaries-check (eslint-plugin-boundaries)
         │
         ▼
 (develop 머지 시) Dev 자동 배포
         │
         ▼
 (release tag 시) Staging 배포 → 수동 승인 → Production 배포
```

핵심 e2e 시나리오는 다음 5개로 시작한다. 이는 비즈니스 크리티컬 경로이므로 **CI 필수 통과**.

1. 상담 접수 → 방문 예약 → MAP 시험 → 반 배치 → 등록 → 결제(Toss Sandbox) → 영수증 발행.
2. 결제 완료 상태에서 수업 2회 진행 후 **수업일 기준 환불** 계산 → 부분취소 → 세금계산서 수정발행.
3. 교사 AMA Client 동기화(읽기 전용) 후 반 배정 → 시간표 반영 → AmoebaTalk 휴강 알림.
4. MAP Passage 작성 → Item 등록 → TestSet 빌더 → 반 대상 배포 → 채점 → 성적 포털 노출.
5. 환불정책 관리자 화면에서 신규 버전 생성 → 예전 주문의 환불 계산이 **구 버전으로 유지**되는지 검증.

### 3.4 Local Development (로컬 개발)

- Monorepo root `package.json` 의 `concurrently` 로 frontend:3000 / backend:4000 동시 기동.
- `docker-compose.local.yml` 로 MySQL / Redis / RabbitMQ 일괄 기동.
- Toss Sandbox 키는 `.env.local` 에만 주입 (커밋 금지), NTS 테스트베드 공동인증서는 `.p12` 파일을 **개발자 로컬 KMS 시뮬레이터**에 로드 후 사용.
- `npm run seed` 로 기본 academy / 사용자 / 반 / 프로그램 / 환불정책 v2026-03-01 시드.

---

## 4. Phased Schedule (단계별 일정)

22주를 5개 Phase 로 분할한다. Phase 간에는 **데모 & 사인오프** 마일스톤을 두어 사용자(원장)와 합의된 상태로만 다음 Phase 로 진행한다.

### 4.1 Phase Overview (단계 개요)

| Phase | Duration | Scope | Exit criteria |
|-------|----------|-------|---------------|
| **Phase 0 — Foundation** | W1–W2 (2w) | 모노레포 셋업, DI 구조, 공통 토큰, DB 마이그레이션, 인증/세션, 감사 로그 | 로컬/Dev 환경에서 Hello API + 로그인 동작, CI 파이프라인 green |
| **Phase 1 — People & Consultation** | W3–W6 (4w) | 교사(AMA mirror), 학생/학부모, 상담(Kanban + 방문/시험), Settings 기초 | 상담 1건 end-to-end, 학생 등록까지 가능 |
| **Phase 2 — Program / Class / Timetable** | W7–W10 (4w) | Program·Class 설계, Session 생성, 주간 달력, 출결 | 반 개설 → 시간표 노출 → 출결 체크 가능 |
| **Phase 3 — MAP Question Bank & Grading** | W11–W14 (4w) | Passage, Item (Part A/B), TestSet Builder, Assign, Grading Center, Score Portal | 반 대상 MAP 테스트 배포·채점·포털 공개 |
| **Phase 4 — Trinity Pay (v1.3 core)** | W15–W19 (5w) | Toss Widget 결제, Confirm API, Webhook, 수업일 기준 환불, NTS eTax 자체 발행, 환불정책 Admin | 결제·부분환불·세금계산서 3가지가 실 sandbox 흐름으로 통과 |
| **Phase 5 — Portal, Hardening, Launch** | W20–W22 (3w) | 홈/About/Programs/Contact/News, 부하·보안 테스트, 문서 동결, 런칭 | 실서비스 배포, 운영자 교육 완료 |

### 4.2 Phase 0 — Foundation (W1–W2)

**목표**: 나머지 21주를 안정적으로 달리기 위한 뼈대를 확정한다.

- 모노레포 스캐폴딩: `frontend/` (Next.js 14) + `backend/` (NestJS 11) + `sql/` (마이그레이션) + `docs/`.
- Backend Clean Architecture 디렉터리 구성 (`domain/`, `application/`, `infrastructure/`, `presentation/`) 과 **boundaries ESLint 규칙** 적용.
- DB 스키마 v1.3 반영: `sql/academy-management-schema.sql` → TypeORM migration 으로 변환.
- 공통 토큰: `frontend/src/styles/heraldic-tokens.css` 배포 + Tailwind preset 연결.
- 인증: NextAuth (Credentials + Session in Redis), NestJS JwtGuard + AcademyGuard (academy_id 강제 주입).
- 감사로그: `tac_audit_logs` 테이블 + NestJS Interceptor.
- CI: lint / typecheck / unit test / boundaries / build.

**Exit**: Dev 환경에서 `/api/health` + 로그인 동작, 기본 레이아웃(PortalLayout / AdminLayout) 렌더링.

### 4.3 Phase 1 — People & Consultation (W3–W6)

**목표**: 운영자가 **상담부터 학생 등록**까지 시스템 안에서 처리할 수 있는 상태를 만든다. 이 단계가 빠르게 동작해야 이후 단계의 **데이터 리얼리즘**이 확보된다.

- **Teacher (AMA Client Mirror)** — `external/ama/teacher-sync.service.ts` cron 15분. **쓰기 금지**, 로컬 DB 는 캐시 성격.
- **Student / Parent** — TPI 학생 정보 엑셀 구조 준수, `phone_encrypted`/`email_encrypted` AES-GCM.
- **Consultation Kanban** — 상태: INQUIRY → VISIT_SCHEDULED → MAP_TESTED → ENROLLED | LOST. 드래그앤드롭.
- **Settings 기초** — Academy 프로필, 역할, 권한 매트릭스.

**Exit**: 상담 접수 → 방문 → 시험 체크 → 반 배치 준비 상태(실제 반 배정은 Phase 2).

### 4.4 Phase 2 — Program / Class / Timetable (W7–W10)

**목표**: 기존 "수업 확인표.xlsx" 의 주간 캘린더 뷰를 시스템으로 완전히 대체한다.

- **Program** (교재·커리큘럼 단위): 5 unit × 4 week 의 커리큘럼 트리, 브랜드 카드.
- **Class** (운영 단위): Program × 요일/시간/교사/교실. 회차 자동 생성 (시작~종료 + 휴원일 캘린더).
- **Session**: HELD / CANCELED / UPCOMING / MAKEUP. 엑셀 레전드(초록/빨강) 컬러 맵핑 유지.
- **Timetable**: 주간 그리드(7 day × 시간), 세션 상세, 출결표.
- **Attendance**: 출석·결석·지각·병결, AmoebaTalk 결석 알림(선택).

**Exit**: 반 하나를 개설해 8주 회차를 생성 → 주간 달력에 반영 → 출결 입력.

### 4.5 Phase 3 — MAP Question Bank & Grading (W11–W14)

**목표**: 종이·파일 기반 MAP RC 운영을 "작성 → 배포 → 채점 → 포털 공개" 단일 플로우로 이관.

- **Passage** (지문): Lexile 등급, 카테고리, 원문 + 번역.
- **Item** (문항): Part A (Vocabulary) / Part B (Reading Comprehension). 정답·해설·배점.
- **TestSet Builder**: 지문/문항 조합 → 총점·배점 요약 사이드바.
- **Assignment**: 반 / 학생 / 기간 / 공개 일시 배포 + AmoebaTalk 사전 안내.
- **Grading Center**: 3-패널(학생 리스트·답안 그리드·인사이트).
- **Score Portal**: 학부모 `/my/scores` 에서 조회.

**Exit**: 1개 TestSet 을 실 학생 그룹에 배포하고 포털에 노출.

### 4.6 Phase 4 — Trinity Pay (W15–W19, v1.3 핵심 5주)

**목표**: v1.3 의 세 가지 핵심 결정(**Toss / 수업일 기준 환불 / NTS eTax 자체**) 을 모두 실장한다.

- **W15**: Toss Widget SDK v2 통합 + Confirm API + 주문/영수증 테이블 + `pg_payment_key` 보관(SAQ-A).
- **W16**: Webhook v2 이중 경로 reconcile + idempotency + 서명 HMAC 검증.
- **W17**: 수업일 기준 환불 계산기 (T0/T1/T2/T3, `elapsed_ratio = held_session_count / total_session_count`) + 부분취소 Toss 호출 + Ledger.
- **W18**: NTS Hometax eTax 자체 발행 (DRAFT→SUBMITTED→APPROVED/REJECTED), 공동인증서 HSM/KMS 보관, 익월 10일 배치.
- **W19**: Refund Policy Admin 화면(버전 관리, 소급 미적용 검증), Trinity Pay Hub KPI(NFR-013 D-day).

**Exit**: Staging 에서 결제 → 일부 수업 진행 → 부분환불 → 수정세금계산서 자체 발행 성공.

### 4.7 Phase 5 — Portal, Hardening, Launch (W20–W22)

**목표**: 학부모 대면 포털을 완성하고 실 서비스 품질로 끌어올린다.

- **Portal**: Home, About/OMNIBUS OMNIA, Programs, MAP Test 안내, Contact (reCAPTCHA v3), News.
- **성능**: Lighthouse 모바일 ≥ 90, Portal LCP < 2.5s.
- **보안**: OWASP Top 10 체크리스트, Toss/NTS 서명 검증, rate limit, CSP.
- **부하**: 결제 동시 50tps, 주간 달력 조회 500rps 기준.
- **교육**: 원장·교무 대상 2회 핸즈온, 스크린샷 기반 운영자 가이드.

**Exit**: 실 서비스 도메인 전환 + 운영자 사인오프.

---

## 5. Module-wise Milestones (모듈별 마일스톤)

| Module | Phase | Key deliverables |
|--------|-------|-----------------|
| Foundation | 0 | monorepo, DI, boundaries, auth, schema migration, CI |
| Consultation | 1 | Kanban, 방문/시험 기록, AmoebaTalk 상담 알림 |
| Student / Parent | 1 | TPI 구조, 암호화 필드, 상세 화면 |
| Teacher | 1 | AMA Client mirror (read-only), 쓰기 경로 부재 |
| Program / Class | 2 | 커리큘럼 트리, 회차 자동 생성, 휴원일 |
| Timetable | 2 | 주간 달력, 세션 상세, 출결 |
| MAP Question Bank | 3 | Passage·Item·TestSet·Assign·Grading·Portal |
| Trinity Pay | 4 | Toss · 수업일 기준 환불 · NTS eTax · 정책 Admin |
| Portal | 5 | Home·About·Programs·MAP·Contact·News |
| Settings / Dashboard | 2–5 | KPI Hub, 정책, 권한, 브랜드 |

각 모듈의 세부 WBS 는 GitHub Projects `Trinity Academy v1.3` 에서 T-{n} 카드 단위로 관리한다. Redmine 양방향 동기화를 통해 PM 뷰 (Gantt·Roadmap) 로도 조회 가능.

---

## 6. Risk Management (리스크 관리)

### 6.1 Risk Register (리스크 등록부)

| ID | Risk | Likelihood | Impact | Phase | Mitigation |
|----|------|-----------|--------|-------|-----------|
| R-01 | Toss Webhook 지연·중복으로 주문 상태 불일치 | 중 | 고 | 4 | Confirm API + Webhook 이중 reconcile, idempotency key, 5분 delta reconciler cron |
| R-02 | 수업일 기준 환불 계산 오류 → 원생 클레임 | 중 | 고 | 4 | 단위테스트 100+ 시나리오, Admin 재계산 기능, ledger 불변 |
| R-03 | NTS eTax 제출 실패(공동인증서·양식·시한) | 중 | 고 | 4 | DRAFT 로 우선 저장, 실패 시 1일 재시도 3회, 익월 10일 5일 전 alarm, HSM 만료일 D-28 알림 |
| R-04 | AMA Client 동기화 누락(삭제·병합) | 중 | 중 | 1 | mirror 는 read-only + tombstone, 운영자 수동 재동기화 버튼 |
| R-05 | 엑셀 기반 운영자의 시스템 전환 저항 | 고 | 중 | 5 | 용어·레전드·칼럼을 엑셀과 동일 유지, Phase 별 데모에 원장 참여 |
| R-06 | 멀티테넌시 누락으로 데이터 교차 노출 | 저 | 극상 | 0 | Guard 자동주입 + TypeORM subscriber + 통합테스트 |
| R-07 | 개인정보 암호화 미적용 필드 발생 | 저 | 극상 | 1 | PR 체크리스트 + eslint custom rule (VARBINARY 접두 강제) |
| R-08 | release 와 신학기 개강 충돌 | 저 | 고 | 5 | 개강 D-14 feature freeze, 이후 bugfix 만 |
| R-09 | 환불정책 변경이 기존 주문에 소급 적용 | 저 | 고 | 4 | `payment_orders.refund_policy_version_id` 스냅샷 + 통합테스트 |
| R-10 | admin 도메인 분리 결정 지연(Q-016) | 중 | 저 | 5 | 공통 도메인 + 경로 분리로 출시, 분리는 v1.4 에서 리버스 프록시만 교체 |

### 6.2 Escalation (에스컬레이션)

R-03, R-06, R-07 은 발생 시 **즉시 릴리스 차단**. 나머지는 주간 위험 리뷰에서 상태 추적.

---

## 7. Communication Plan (커뮤니케이션 계획)

| Cadence | Meeting | Attendees | Purpose |
|---------|---------|-----------|---------|
| Daily | 데일리 스탠드업 (15m, Slack huddle) | 전 개발팀 | 블로커 확인 |
| Weekly | 주간 진척 리뷰 (60m) | 개발팀 + PM + 원장 | 데모·리스크·지표 |
| Phase end | 단계별 데모 (90m) | 개발팀 + PM + 원장 + 교무 실무자 | 사인오프 |
| Ad-hoc | 결제·세무 정책 리뷰 | PM + 회계 담당자 + 외부 세무 | Toss·NTS 관련 결정 |

### 7.1 Tools (도구)

- 개발 태스크·버그·개선: **GitHub Issues + Projects**
- PM/경영진 뷰: **Redmine** (GitHub ↔ Redmine 양방향 웹훅 동기화)
- 커뮤니케이션: **Slack** `#tac-dev`, `#tac-ops`
- 문서: `docs/` 내 Git 버전관리 (main 머지 시 공개)
- 설계 시안: `docs/design/screens/*.html` (HTML 미리보기)

---

## 8. Quality Gates (품질 기준)

모든 PR 은 다음 게이트를 통과해야 develop 머지 가능.

### 8.1 Code Gates

- `tsc --noEmit` (strict) 통과.
- `eslint --max-warnings=0` 통과 + boundaries 규칙 위반 0.
- 신규 Domain/Application 코드에 대한 **단위테스트 라인 커버리지 ≥ 80%**.
- 결제·환불·세무 관련 코드는 **Property-based test (fast-check) 시나리오 ≥ 50 개** 추가.

### 8.2 Review Gates

- 리뷰어 1명 이상 승인.
- 결제/세무 변경은 **PM + Full-stack lead 2명** 승인 필수.
- 브랜드 토큰·하드코딩 색상 추가 금지 체크.

### 8.3 Release Gates (Phase 별 Exit 기준)

- **Phase 0 Exit**: Hello API / 로그인 / CI green / 레이아웃 렌더.
- **Phase 1 Exit**: 상담 end-to-end 1건 완료, TPI 필드 암호화 검증.
- **Phase 2 Exit**: 주간 달력 레전드 엑셀과 일치, 출결 저장.
- **Phase 3 Exit**: TestSet 1개가 포털에서 조회.
- **Phase 4 Exit**: 결제 → 부분환불 → 수정세금계산서 Staging 통과.
- **Phase 5 Exit**: Portal Lighthouse ≥ 90, 보안 스캔 High 0.

---

## 9. Reference Documents (참조 문서)

| Document | Path |
|----------|------|
| 요구사항 분석서 v1.3 | `docs/analysis/academy-management-requirements.md` |
| 기능 정의서 v1.3 (legacy) | `docs/design/academy-management-func-definition.md` |
| 기능명세서(화면 포함) v1.3 | `docs/design/academy-management-func-spec.md` |
| ERD v1.3 | `docs/design/academy-management-erd.md` |
| 프로세스 정의서 v1.3 | `docs/design/academy-management-process.md` |
| 시퀀스 다이어그램 v1.3 | `docs/design/academy-management-sequence.md` |
| 화면 구성안 (Legacy) | `docs/design/academy-management-screens.md` |
| DB Schema SQL v1.3 | `sql/academy-management-schema.sql` |
| Hi-Fi 목업 | `docs/design/screens/index.html` 외 |
| v1.3 의사결정 요약 | `docs/trinity-academy-v1.3-summary.md` |

---

*OMNIBUS OMNIA — 모든 이에게 모든 것이 되어.*
