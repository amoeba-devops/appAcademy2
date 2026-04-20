---
name: trinity-academy-spec-generator
description: >
  Trinity Academy(TAC) 프로젝트 전용 SDLC 문서 생성 스킬.
  Amoeba Company amoeba-spec-generator v3.1 기반, React/Next.js + NestJS Clean Architecture 구조에 맞게 커스터마이징.
  이중 언어(EN/KR) 문서, 단계별 산출물 추적(FR → FN → T → TC), Git 기반 형상관리.
  Triggers: "기획서", "스펙 문서", "API 설계", "DB 스키마", "PRD", "기능 명세",
  "요구사항 분석", "시퀀스다이어그램", "ERD", "WBS", "개발계획서", "테스트케이스",
  "화면기획서", "작업계획서", "작업리포트", "테스트리포트",
  "버그 리포트", "기능 개선", "형상관리" 등의 표현에 트리거한다.
  Also triggers on: "spec document", "create issue", "development plan", "test report".
version: 2.0.0
based_on: amoeba-spec-generator v3.1
---

# Trinity Academy Spec Generator (트리니티 아카데미 스펙 생성 스킬)

Trinity Academy(TAC) 프로젝트의 SDLC 전체 라이프사이클을 지원하는 **문서 생성 스킬**이다.
Amoeba Company `amoeba-spec-generator v3.1` 기반이며, React/Next.js + NestJS Clean Architecture 구조에 맞게 커스터마이징되었다.

Core principles:
1. **Bilingual documentation** — English-first with Korean annotations (영어 우선, 한국어 병기)
2. **Traceability** — FR → FN → T → TC consistent ID references
3. **Git-native workflow** — 형상관리는 Git 기반
4. **Conversational creation** — 대화형 인터뷰로 점진적 문서 작성
5. **Clean Architecture alignment** — 문서가 4-layer 아키텍처를 반영

---

## 1. Technical Context (기술 컨텍스트)

### 1.1 Project Info

| Item | Value |
|------|-------|
| Project Code | TAC |
| Version | v1.3.0 |
| Database Name | `db_tac` |
| Table Prefix | `tac_` (sub-domain: `tac_map_`, `tac_pay_`) |
| API Base | `/api/{resource}` (NestJS global prefix) |
| Frontend Port | 3000 (Next.js) |
| Backend Port | 4000 (NestJS) |

### 1.2 Tech Stack

#### Frontend (`frontend/`)

| Layer | Technology | Version | Note |
|-------|-----------|---------|------|
| Framework | Next.js (App Router) | 14.x | SSG/ISR (Portal) + SSR (Admin) |
| UI | React | 18.x | Server Components default |
| Language | TypeScript | 5.x | strict: true |
| Styling | TailwindCSS + shadcn/ui | 3.x | Heraldic brand tokens |
| State | Zustand (client) + React Query (server) | 5.x / 5.x | |
| Form | React Hook Form + Zod | 7.x / 4.x | Schema validation |
| Icons | Lucide React | latest | |
| i18n | react-i18next (ko default) | 17.x | |

#### Backend (`backend/`)

| Layer | Technology | Version | Note |
|-------|-----------|---------|------|
| Framework | NestJS | 11.x | Clean Architecture |
| Language | TypeScript (strict) | 5.x | |
| ORM | TypeORM | latest | MySQL adapter |
| Database | MySQL | 8.x | Docker container (`tac-mysql`) |
| Validation | class-validator + class-transformer | latest | Global ValidationPipe |
| API Docs | Swagger (@nestjs/swagger) | latest | `/api/docs` (dev) |
| PG | Toss Payments | Widget SDK v2 | AMA 미경유 직결 |

#### Shared Infrastructure

| Layer | Technology | Version |
|-------|-----------|---------|
| Cache | Redis | 7.x |
| Queue | RabbitMQ | 3.x |
| Storage | S3 Compatible | — |
| Runtime | Node.js | 20.x LTS |
| Container | Docker Compose | — |

### 1.3 Clean Architecture Layers

```
Domain (핵심)  →  Application (유스케이스)  →  Infrastructure (어댑터)  →  Presentation (HTTP)
  ├ entities        ├ use-cases                ├ database/TypeORM        ├ controllers
  ├ repositories    └ dto                      ├ external services       ├ guards/filters
  └ domain services                            └ config                  └ interceptors/pipes
```

- **의존성 방향**: Presentation → Application → Domain ← Infrastructure
- Domain 레이어는 NestJS/TypeORM에 의존하지 않는다.
- Infrastructure가 Domain의 리포지토리 인터페이스를 구현한다 (Dependency Inversion).

### 1.4 Data Flow

```
React (Frontend:3000)
    → fetch /api/*
    → Next.js rewrite proxy
    → NestJS Controller (Backend:4000)
    → Use Case → Domain Service → Repository Interface
    → TypeORM Repository Implementation → MySQL (Docker)
                     ↕
            RabbitMQ (events)
                     ↓
            Workers (Notification, Receipt, TaxInvoice)
```

### 1.5 Amoeba 표준 vs TAC 차이점

| Item | Amoeba Standard (v2) | TAC Project |
|------|---------------------|-------------|
| Frontend | Vue.js / React (SPA) | **React (Next.js 14 App Router)** |
| Backend | Next.js Route Handlers / NestJS DDD | **NestJS Clean Architecture** |
| Architecture | Monolith or Turborepo | **Frontend + Backend 분리 (monorepo)** |
| ORM | TypeORM 0.3.x / Prisma | **TypeORM (latest)** |
| Database | PostgreSQL 15.x | **MySQL 8.x (Docker)** |
| PK Convention | UUID / `{col_prefix}_id` | **`id` (BIGINT AUTO_INCREMENT)** |
| Multi-tenancy | `ent_id` (Entity) | **`academy_id` (Academy)** |
| Queue | Bull (Redis) | **RabbitMQ** |
| API Docs | — | **Swagger (@nestjs/swagger)** |
| Validation | Zod / Joi | **class-validator + class-transformer** |

### 1.6 Key Integration Points

| Service | Scope | Note |
|---------|-------|------|
| AMA Service | Teacher master (Client 1:1 참조) — **read-only** | 결제 미관여 |
| AmoebaTalk | 알림 발송 (상담/결제/환불/MAP/세금계산서) | 발송 채널 한정 |
| Toss Payments | 결제·승인·환불 (Widget + Confirm + Webhook v2) | AMA 경유 X |
| NTS eTax API | 전자세금계산서 자체 발행 | 공동인증서 기반 |

---

## 2. Bilingual Writing Convention (이중 언어 작성 규칙)

All documents follow **English-first with Korean annotations**.
모든 문서는 **영어 우선, 한국어 병기** 방식으로 작성한다.

### Rules

| Rule | Example |
|------|---------|
| Section headers | `## 1. Overview (개요)` — not `## 1. 개요` |
| Table headers | English only: `\| ID \| Requirement \| Priority \|` |
| Table content | English preferred; Korean for domain terms (e.g., 학부모, 수강 등록) |
| Body text | English primary, Korean in parentheses for clarification |
| Code/API/SQL | Always English — variables, comments, columns |
| Filenames | English: `{feature}-requirements.md` |
| Git commit | English: `feat(portal): add contact form` |

### Example

```markdown
# Enrollment Management — Requirements Analysis (수강 등록 관리 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)
- **Feature**: Enrollment Management for Trinity Academy (트리니티 아카데미 수강 등록 관리)
- **Background**: Currently, enrollment is tracked via Excel spreadsheets (수업 확인표.xlsx)...

## 2. Functional Requirements (기능 요구사항)
| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-049 | Create enrollment with program/class selection (프로그램·반 선택 수강 등록 생성) | P0 | |
```

---

## 3. Document Repository Structure (문서 저장 구조)

```
app-academy/
├── docs/
│   ├── analysis/                    # Stage 1 artifacts
│   │   └── {feature}-requirements.md
│   ├── design/                      # Stage 2 artifacts
│   │   ├── {feature}-erd.md
│   │   ├── {feature}-func-definition.md
│   │   ├── {feature}-sequence.md
│   │   ├── {feature}-process.md
│   │   ├── {feature}-screens.md     # UI Specification
│   │   └── screens/                 # HTML mockups
│   ├── implementation/              # Stage 3 artifacts
│   │   ├── {feature}-dev-plan.md
│   │   ├── {feature}-wbs.md
│   │   └── tasks/
│   │       ├── {feature}-task-{n}-plan.md
│   │       └── {feature}-task-{n}-report.md
│   ├── test/                        # Stage 4-5 artifacts
│   │   ├── {feature}-testcase.md
│   │   ├── {feature}-test-report.md
│   │   └── {feature}-final-test-report.md
│   └── bug-fix/                     # Bug fix reports
│       └── FIX-{YYMMDD}-{title}.md
├── sql/
│   └── {feature}-schema.sql
└── CHANGELOG.md
```

### Document Versioning

Every document includes YAML front matter:

```yaml
---
document_id: {FEATURE}-{TYPE}-{VERSION}
version: 1.0.0
status: Draft | Review | Approved | Deprecated
created: 2026-04-20
updated: 2026-04-20
author: {author}
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-20
    author: {author}
    description: Initial draft
---
```

Version numbering follows semver:
- **MAJOR** (1.0.0 → 2.0.0): Scope/requirement changes that break existing design
- **MINOR** (1.0.0 → 1.1.0): Feature additions, new sections
- **PATCH** (1.0.0 → 1.0.1): Typos, clarifications, formatting

---

## 4. SDLC Stages (개발 라이프사이클)

This skill follows a 5-stage development process. Users can jump to any stage directly, or say "full spec" / "처음부터" to proceed sequentially from Stage 1.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 1.Analy- │ →  │ 2.Design │ →  │ 3.Imple- │ →  │ 4.Unit   │ →  │ 5.Final  │
│   sis    │    │          │    │ mentation│    │   Test   │    │   Test   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
 Requirements    Design docs     Dev plan/exec   Per-task verify  Integration
```

### Stage Detection (단계 판별)

| User says… | Stage |
|---|---|
| "요구사항 분석", "requirements analysis", "feature planning" | 1. Analysis |
| "ERD", "기능정의", "시퀀스", "화면기획", "프로세스", "정책정의" | 2. Design |
| "개발계획", "WBS", "작업계획서", "dev plan" | 3. Implementation |
| "테스트케이스", "단위테스트", "test case" | 4. Unit Test |
| "통합테스트", "최종테스트", "QA" | 5. Final Test |
| "버그 리포트", "버그 수정" | Bug Fix Report |
| "처음부터", "full spec" | 1→2→3→4→5 sequential |

If unclear, ask the user which stage they're at and suggest the appropriate entry point.

### Artifacts by Stage (단계별 산출물)

| Stage | Artifact | File Pattern |
|-------|----------|-------------|
| **1. Analysis** | Requirements Analysis (요구사항 분석서) | `{feature}-requirements.md` |
| **2. Design** | Functional Specification (기능 정의서) | `{feature}-func-definition.md` |
| | ERD + SQL DDL | `{feature}-erd.md` + `sql/{feature}-schema.sql` |
| | Sequence Diagram (시퀀스 다이어그램) | `{feature}-sequence.md` |
| | Process Definition (프로세스 정의서) | `{feature}-process.md` |
| | UI Specification (화면 기획서) | `{feature}-screens.md` |
| | Event Scenario (이벤트 시나리오) | `{feature}-event-scenario.md` |
| | Policy Definition (정책 정의서) | `{feature}-policy.md` |
| **3. Implementation** | Development Plan (개발계획서) | `{feature}-dev-plan.md` |
| | WBS | `{feature}-wbs.md` |
| | Task Plan (태스크 작업계획서) | `tasks/{feature}-task-{n}-plan.md` |
| | Task Report (태스크 작업리포트) | `tasks/{feature}-task-{n}-report.md` |
| **4. Unit Test** | Test Cases (테스트 케이스) | `{feature}-testcase.md` |
| | Test Report (테스트 리포트) | `{feature}-test-report.md` |
| **5. Final Test** | Integration Test Plan | `{feature}-integration-test-plan.md` |
| | Final Test Report (최종 테스트 리포트) | `{feature}-final-test-report.md` |
| **Cross-stage** | Bug Fix Report | `FIX-{YYMMDD}-{title}.md` |
| | CHANGELOG | `CHANGELOG.md` |

---

## 5. Workflow Rules (작업 규칙)

### 5.1 작업 시작 전 필수 확인
1. **CLAUDE.md** 프로젝트 지침 확인
2. **SPEC.md** 프로젝트 명세 확인
3. 관련 설계 문서 (`docs/design/`, `docs/analysis/`) 확인
4. Memory (`/memories/`, `/memories/session/`, `/memories/repo/`) 확인
5. 기존 설계 문서의 ID 범위 확인 (§10 참조)

### 5.2 요구사항 작업 시 진행 중단점
- 요구사항 분석서 + 작업 계획서 작성 후 **반드시 사용자 확인을 받은 후** 구현 진행
- 작업 계획서에는 **화면 구성안(UI 레이아웃 목업)** 반드시 포함
- 사용자가 "진행해", "구현해" 등 명시적 지시를 해야만 코드 구현 시작

### 5.3 Conversational Interview (대화형 인터뷰)
- 한 번에 질문을 쏟아붓지 않는다. 2-3개씩 자연스럽게
- "잘 모르겠다" → 합리적 기본값 제안 + `[TBD]` 마크
- 생성 전 목차를 보여주고 확인 → 생성 후 피드백 수렴

### 5.4 Implementation Workflow (구현 작업 흐름)
문서 → 구현 전환 시 Clean Architecture 레이어 기준으로 작업을 분해한다:

```
1. Domain Entity 정의 (backend/src/domain/entities/)
2. Repository Interface 정의 (backend/src/domain/repositories/)
3. DTO 정의 (backend/src/application/dto/)
4. Use Case 구현 (backend/src/application/use-cases/)
5. TypeORM Entity 구현 (backend/src/infrastructure/database/entities/)
6. Repository Implementation (backend/src/infrastructure/database/repositories/)
7. Controller 구현 (backend/src/presentation/controllers/)
8. Frontend 페이지/컴포넌트 구현 (frontend/src/)
```

---

## 6. Document Templates (문서 템플릿)

### 6.1 Requirements Analysis (요구사항 분석서)

```markdown
---
document_id: {FEATURE}-REQ-{VERSION}
version: 1.0.0
status: Draft
created: {date}
updated: {date}
author: {author}
---

# {Feature Name} — Requirements Analysis ({기능명} 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)
- **Project**: Trinity Academy — {Feature Name}
- **Version**: {version}
- **Background and Purpose (배경 및 목적)**: ...
- **Expected Benefits (기대 효과)**: ...

## 2. Stakeholders (이해관계자)
| Role | Person/Team | Responsibility |
|------|-------------|----------------|

## 3. Requirements (요구사항 목록)

### Functional Requirements (기능 요구사항)
| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-{NNN} | ... | P0 | |

### Non-Functional Requirements (비기능 요구사항)
| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-{NNN} | ... | ... |

## 4. Scope Definition (범위 정의)
- **In-Scope**: ...
- **Out-of-Scope**: ...
- **MVP vs Full**: ...

## 5. Constraints and Assumptions (제약사항 및 가정)
| ID | Type | Description |
|----|------|-------------|
| C-{NNN} | Constraint | ... |
| A-{NNN} | Assumption | ... |

## 6. Related Systems (연관 시스템)
- AMA Service: ...
- Toss Payments: ...

## 7. Success Metrics (성공 지표)
| KPI | Measurement | Target |
|-----|-------------|--------|

## 8. Open Questions (미결정 사항)
| ID | Question | Status |
|----|----------|--------|
| Q-{NNN} | ... | TBD |
```

### 6.2 Functional Specification (기능 정의서)

```markdown
---
document_id: {FEATURE}-FUNC-{VERSION}
version: 1.0.0
status: Draft
---

# {Feature Name} — Functional Specification ({기능명} 기능 정의서)

## Module: {Module Name}

### FN-{NNN}: {Function Name}
- **Function ID**: FN-{NNN}
- **Related Requirement**: FR-{NNN}
- **Description**: ...
- **Clean Architecture Layer**: Domain Service / Use Case / Controller
- **Pre-condition**: ...
- **Post-condition**: ...
- **Processing Logic**:
  1. Controller receives request, validates DTO
  2. Use Case orchestrates domain logic
  3. Domain Service applies business rules
  4. Repository persists data
- **Input Parameters**:
  | Parameter | Type | Required | Description |
  |-----------|------|----------|-------------|
- **Output**: ...
- **Error Handling**:
  | Error | HTTP Status | Code | Response |
  |-------|-------------|------|----------|
- **API Endpoint**: `{METHOD} /api/{resource}` (NestJS Controller)
```

### 6.3 Sequence Diagram (시퀀스 다이어그램)

Participant 명은 TAC Clean Architecture에 맞게 표기:

```markdown
---
document_id: {FEATURE}-SEQ-{VERSION}
---

# {Feature Name} — Sequence Diagram ({기능명} 시퀀스 다이어그램)

## Scenario N: {Scenario Name}

​```mermaid
sequenceDiagram
    actor User
    participant FE as React (Next.js:3000)
    participant Ctrl as NestJS Controller
    participant UC as Use Case
    participant Svc as Domain Service
    participant Repo as TypeORM Repository
    participant DB as MySQL (db_tac)
    participant MQ as RabbitMQ
    participant Cache as Redis
    participant Toss as Toss Payments
    participant AMA as AMA Service
    participant NTS as 국세청 eTax

    User->>FE: {action}
    FE->>Ctrl: POST /api/{resource}
    Ctrl->>UC: execute(dto)
    UC->>Svc: {domain logic}
    Svc->>Repo: save(entity)
    Repo->>DB: INSERT INTO tac_{table}
    DB-->>Repo: result
    Repo-->>Svc: entity
    Svc-->>UC: result
    UC-->>Ctrl: response
    Ctrl-->>FE: { data: ... }
    FE-->>User: UI update
​```
```

**Participant selection guide** — 시나리오에 관련된 participant만 포함:
- 기본: User, FE(React), Ctrl(Controller), Repo, DB
- 비즈니스 로직 복잡: + UC(Use Case), Svc(Domain Service)
- 결제: + Toss
- 알림: + MQ, AMA
- 세금계산서: + NTS
- 캐싱: + Cache

### 6.4 ERD

```markdown
---
document_id: {FEATURE}-ERD-{VERSION}
---

# {Feature Name} — ERD

## ER Diagram

​```mermaid
erDiagram
    tac_table_a ||--o{ tac_table_b : "has many"
    tac_table_a {
        bigint id PK
        bigint academy_id FK
        varchar name
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }
​```

## Table Definitions

### tac_{table_name}
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | BIGINT | NO | AUTO_INCREMENT | PK |
| academy_id | BIGINT | NO | | FK → tac_academies.id (multi-tenancy) |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | |
| deleted_at | DATETIME | YES | NULL | Soft delete |

## Index Definitions
| Index | Table | Columns | Type |
|-------|-------|---------|------|
| idx_tac_{table}_{cols} | tac_{table} | {columns} | INDEX |

## Migration Notes (마이그레이션 참고)
- Existing table changes: ...
- Data migration required: Yes / No
```

SQL DDL은 `sql/{feature}-schema.sql`로 별도 생성. Table prefix: `tac_`, sub-domain: `tac_map_`, `tac_pay_`.

### 6.5 Process Definition (프로세스 정의서)

```markdown
---
document_id: {FEATURE}-PRC-{VERSION}
---

# {Feature Name} — Process Definition ({기능명} 프로세스 정의서)

## PRC-{NNN}: {Process Name}
- **Process ID**: PRC-{NNN}
- **Related**: FR-{NNN}, FN-{NNN}
- **Purpose**: ...
- **Trigger (시작 조건)**: ...
- **Completion (종료 조건)**: ...

### Processing Steps
| Step | Actor | Action | Input | Output | Branch |
|------|-------|--------|-------|--------|--------|
| 1 | User | {action} | | | |
| 2 | System (Controller) | Validate request | DTO | | Fail → Error |
| 3 | System (Use Case) | {business logic} | | | |
| 4 | System (Repository) | Persist data | Entity | Saved entity | |

### Exception Handling
| Exception | Step | Response | HTTP Status |
|-----------|------|----------|-------------|
| {exception} | {step} | {response} | {code} |
```

### 6.6 UI Specification (화면 기획서)

```markdown
---
document_id: {FEATURE}-SCR-{VERSION}
---

# {Feature Name} — UI Specification ({기능명} 화면 기획서)

## Screen List
| Screen ID | Screen Name | Route | Layout | Rendering | Note |
|-----------|-------------|-------|--------|-----------|------|
| SCR-{NNN} | {name} | /(portal\|admin)/{path} | PortalLayout / AdminLayout | SSG / SSR | |

## SCR-{NNN}: {Screen Name}

### Layout
(ASCII wireframe — 반드시 포함)

```
┌─────────────────────────────────────────────────┐
│ Header / Sidebar (AdminLayout)                   │
├─────────────────────────────────────────────────┤
│ Page Header: Title + Actions                     │
├───────────────────────┬─────────────────────────┤
│ Filters / Search      │ Summary Stats            │
├───────────────────────┴─────────────────────────┤
│ Data Table / Cards                               │
│ ┌──────┬──────┬──────┬──────┬──────┐            │
│ │ Col1 │ Col2 │ Col3 │ Col4 │ Acts │            │
│ ├──────┼──────┼──────┼──────┼──────┤            │
│ │ ...  │ ...  │ ...  │ ...  │ ...  │            │
│ └──────┴──────┴──────┴──────┴──────┘            │
├─────────────────────────────────────────────────┤
│ Pagination                                       │
└─────────────────────────────────────────────────┘
```

### Components
| Element | Type | Description | Behavior |
|---------|------|-------------|----------|
| {element} | shadcn/{type} | {desc} | {behavior} |

### Data Binding
- API endpoint: `GET /api/{resource}`
- React Query key: `['{resource}', filters]`
- Zustand store: `use{Resource}Store` (if needed)

### State Management
- Loading: Skeleton UI
- Error: Error message + retry button
- Empty: Guidance message

### Responsive Design
- Desktop (≥1024px): Full table layout
- Tablet (768-1023px): Condensed columns
- Mobile (<768px): Card layout
```

### 6.7 Event Scenario (이벤트 시나리오)

```markdown
---
document_id: {FEATURE}-EVT-{VERSION}
---

# {Feature Name} — Event Scenario ({기능명} 이벤트 시나리오)

## Scenario 1: {Scenario Name}
| Step | Actor | Event | System Response | Note |
|------|-------|-------|-----------------|------|
| 1 | User | {action} | {response} | |
| 2 | System | {trigger} | {processing} | |

### Exception Scenarios
| Condition | System Response | HTTP Status |
|-----------|-----------------|-------------|
| {error condition} | {error handling} | {code} |
```

### 6.8 Policy Definition (정책 정의서)

```markdown
---
document_id: {FEATURE}-POL-{VERSION}
---

# {Feature Name} — Policy Definition ({기능명} 정책 정의서)

## POL-{NNN}: {Policy Name}
- **Policy ID**: POL-{NNN}
- **Purpose**: ...
- **Scope**: ...
- **Rules**:
  - Rule 1: {condition} → {result}
  - Rule 2: {condition} → {result}
- **Exceptions**: {exception handling}
- **Change History**: date, change, reason
```

### 6.9 Development Plan (개발계획서)

```markdown
---
document_id: {FEATURE}-DEV-{VERSION}
---

# {Feature Name} — Development Plan ({기능명} 개발계획서)

## 1. Overview (개요)
- **Project**: Trinity Academy — {Feature Name}
- **Development period**: {start} ~ {end}
- **Team members**: {list}
- **Scope**: References to design documents

## 2. Technical Architecture (기술 아키텍처)
- Frontend: React/Next.js 14 components to create
- Backend: NestJS modules/services to create
- Clean Architecture layers affected:
  | Layer | New Files |
  |-------|-----------|
  | Domain Entity | `backend/src/domain/entities/{entity}.entity.ts` |
  | Domain Repository | `backend/src/domain/repositories/{entity}.repository.ts` |
  | Application DTO | `backend/src/application/dto/{module}/` |
  | Application Use Case | `backend/src/application/use-cases/{module}/` |
  | Infrastructure TypeORM | `backend/src/infrastructure/database/entities/{entity}.entity.ts` |
  | Infrastructure Repo | `backend/src/infrastructure/database/repositories/{entity}.repository.ts` |
  | Presentation Controller | `backend/src/presentation/controllers/{module}.controller.ts` |
  | Frontend Page | `frontend/src/app/(admin)/{module}/page.tsx` |
  | Frontend Component | `frontend/src/components/admin/{module}-*.tsx` |

## 3. Development Environment (개발 환경)
- Frontend: `cd frontend && npm run dev` (port 3000)
- Backend: `cd backend && npm run start:dev` (port 4000)
- Database: `docker compose up -d` (MySQL 8.x, port 3306)
- Both: `npm run dev` (root, concurrently)

## 4. Schedule Summary (개발 일정)
| Phase | Duration | Deliverable |
|-------|----------|-------------|

## 5. Risk Management (리스크 관리)
| Risk | Impact | Mitigation |
|------|--------|-----------|
```

### 6.10 WBS (Work Breakdown Structure)

```markdown
---
document_id: {FEATURE}-WBS-{VERSION}
---

# {Feature Name} — WBS

## Task List (태스크 목록)

| ID | Task | Layer | Depends On | Effort | Status |
|----|------|-------|------------|--------|--------|
| T-{NNN} | {task description} | Domain / Infra / Presentation / Frontend | - | {n}d | Backlog |

## Milestones (마일스톤)
| Milestone | Completion Criteria | Target Date |
|-----------|-------------------|-------------|

## Implementation Order (구현 순서)
Backend-first approach recommended:
1. Domain entities + repository interfaces
2. TypeORM entities + repository implementations
3. DTOs + Use Cases
4. Controllers + module registration
5. Frontend pages + components
6. Integration testing
```

### 6.11 Task Plan (태스크 작업계획서)

```markdown
# Task Plan: T-{NNN} {Task Name} (태스크 작업계획서)

## Basic Information (기본 정보)
- **Task ID**: T-{NNN}
- **Assignee**: {person}
- **Estimated effort**: {n} days
- **Depends on**: T-{NNN}

## Task Description (작업 내용)
- Module/feature to implement
- **Reference docs**: FN-{NNN}, Sequence Scenario {N}

## UI Layout (화면 구성안)
(ASCII wireframe — 반드시 포함)

## Implementation Plan (구현 계획)

### Backend
| Step | Layer | File | Action |
|------|-------|------|--------|
| 1 | Domain | `src/domain/entities/{name}.entity.ts` | Create |
| 2 | Domain | `src/domain/repositories/{name}.repository.ts` | Create |
| 3 | Application | `src/application/dto/{module}/{name}.dto.ts` | Create |
| 4 | Application | `src/application/use-cases/{module}/{name}.use-case.ts` | Create |
| 5 | Infrastructure | `src/infrastructure/database/entities/{name}.entity.ts` | Create |
| 6 | Infrastructure | `src/infrastructure/database/repositories/{name}.repository.ts` | Create |
| 7 | Presentation | `src/presentation/controllers/{module}.controller.ts` | Create |

### Frontend
| Step | File | Action |
|------|------|--------|
| 1 | `src/app/(admin)/{module}/page.tsx` | Create |
| 2 | `src/components/admin/{module}-{component}.tsx` | Create |

## Acceptance Criteria (완료 조건)
- [ ] Domain entities defined
- [ ] API endpoints working via Swagger
- [ ] Frontend UI renders correctly
- [ ] Error cases handled
```

### 6.12 Task Report (태스크 작업리포트)

```markdown
# Task Report: T-{NNN} {Task Name} (태스크 작업리포트)

## Basic Information
- **Planned effort**: {n}d → **Actual effort**: {m}d
- **Status**: Complete

## Implementation Summary (구현 내용)
- What was actually implemented
- Deviations from plan and reasons

## Changes (변경 사항)
| File | Layer | Action | Description |
|------|-------|--------|-------------|

## Issues Encountered (이슈 및 해결)
| Issue | Cause | Resolution |
|-------|-------|------------|

## Remaining Items (잔여 사항)
- Incomplete items (if any)
- Required follow-up actions
```

### 6.13 Bug Fix Report (버그 수정 보고서)

```markdown
# FIX-{YYMMDD}-{Title}

## Bug Information
- **Reported**: {date}
- **Severity**: Critical / Major / Minor
- **Affected Module**: {module}
- **Affected Layer**: Domain / Application / Infrastructure / Presentation / Frontend
- **Related FR/FN**: FR-{NNN}, FN-{NNN}

## Bug Description (버그 설명)
## Root Cause Analysis (원인 분석)
## Fix Applied (수정 내용)

### Changed Files
| File | Layer | Change |
|------|-------|--------|

## Verification (검증)
## Prevention Notes (재발 방지)
```

### 6.14 Test Cases (테스트 케이스)

```markdown
---
document_id: {FEATURE}-TC-{VERSION}
---

# {Feature Name} — Test Cases ({기능명} 테스트 케이스)

## Test Scope
- Target tasks: T-{NNN}, T-{NNN}
- Reference docs: Requirements, Functional Spec

## Test Case List

### TC-{NNN}: {Test Name}
- **Related**: FR-{NNN}, FN-{NNN}
- **Pre-condition**: {setup state}
- **Test Steps**:
  1. {step 1}
  2. {step 2}
- **Expected Result**: {expected}
- **Test Data**: {data}
- **API**: `{METHOD} /api/{resource}` (if API test)
- **Priority**: High / Medium / Low
```

### 6.15 Test Report (테스트 리포트)

```markdown
---
document_id: {FEATURE}-TR-{VERSION}
---

# {Feature Name} — Test Report ({기능명} 테스트 리포트)

## Test Summary
- Execution date: {date}
- Total cases: {n}
- Pass: {n} / Fail: {n} / Skip: {n}
- Pass rate: {n}%

## Results

| TC ID | Test Name | Result | Note |
|-------|-----------|--------|------|
| TC-{NNN} | {name} | ✅ PASS | |
| TC-{NNN} | {name} | ❌ FAIL | {cause} |

## Failure Analysis
### TC-{NNN} Failure Detail
- **Expected**: {expected}
- **Actual**: {actual}
- **Root Cause**: {cause}
- **Fix Plan**: {plan}

## Verdict
- [ ] Pass rate ≥ 95%
- [ ] No critical bugs
- [ ] Ready for next stage
```

### 6.16 Final Test Report (최종 테스트 리포트)

```markdown
---
document_id: {FEATURE}-FTR-{VERSION}
---

# {Feature Name} — Final Test Report ({기능명} 최종 테스트 리포트)

## Test Summary
- Period: {start} ~ {end}
- Integration scenarios: {n} — Pass {n} / Fail {n}
- Regression: {n} — Pass {n} / Fail {n}
- Performance: Pass / Fail

## Integration Scenario Results
| ITC ID | Scenario | Result | Note |
|--------|----------|--------|------|

## Regression Results
| Area | Tests | Pass | Fail |
|------|-------|------|------|

## Remaining Issues
| Issue | Severity | Status | Response |
|-------|----------|--------|----------|

## Release Verdict
- [ ] All integration scenarios pass
- [ ] 0 critical/major bugs
- [ ] Performance criteria met
- [ ] Release approved
```

---

## 7. ID Convention (ID 체계)

| Prefix | Purpose | Example |
|--------|---------|---------|
| FR-{NNN} | Functional Requirement (기능 요구사항) | FR-001 |
| NFR-{NNN} | Non-Functional Requirement (비기능 요구사항) | NFR-001 |
| FN-{NNN} | Function Specification (기능 정의) | FN-001 |
| PRC-{NNN} | Process (프로세스) | PRC-001 |
| SCR-{NNN} | Screen (화면) | SCR-001 |
| POL-{NNN} | Policy (정책) | POL-001 |
| T-{NNN} | Task (WBS 태스크) | T-001 |
| TC-{NNN} | Test Case (테스트 케이스) | TC-001 |
| ITC-{NNN} | Integration Test Case (통합 테스트) | ITC-001 |
| A-{NNN} | Assumption (가정) | A-001 |
| C-{NNN} | Constraint (제약) | C-001 |
| Q-{NNN} | Open Question (미결정) | Q-001 |

---

## 8. Git Convention (형상관리 규칙)

### Commit Messages

```
feat(module): description       # 새 기능
fix(module): description        # 버그 수정
docs(stage): description        # 문서
refactor(module): description   # 리팩토링
style(module): description      # 코드 포맷
test(module): description       # 테스트
chore: description              # 빌드/설정
```

Module examples: `portal`, `admin`, `students`, `payments`, `map`, `consultations`

### Branch Naming

```
feature/{description}           # New feature
bugfix/{description}            # Bug fix
enhance/{description}           # Enhancement
docs/{description}              # Documentation only
```

---

## 9. Document Traceability (문서 간 연결)

When running sequentially, each stage's artifacts feed into the next:

```
Requirements Analysis FR-{NNN}
  → Functional Spec: FN-{NNN} (implementation spec)
  → Sequence Diagram: FN-{NNN} (technical flow through Clean Architecture layers)
  → ERD: tables used by FN-{NNN}
  → Process: PRC-{NNN} (business flow)
  → UI Spec: SCR-{NNN} (screen)
  → WBS: T-{NNN} (task)
    → Task Plan: T-{NNN} (detailed plan with UI mockup)
    → Implementation (Domain → Infra → Presentation → Frontend)
    → Task Report: T-{NNN} (completion report)
  → Test Case: TC-{NNN} (verification)
  → Integration Test: ITC-{NNN} (end-to-end)
  → Bug found → FIX-{YYMMDD}-{title} (bug fix report)
```

Maintain consistent ID references across all documents.

---

## 10. Existing Design Documents (기존 설계 문서 참조)

TAC 프로젝트는 v1.3.0 기준 분석·설계 문서가 이미 작성되어 있다. 새 기능 추가 시 기존 문서를 참조하여 일관성을 유지한다.

### Document Inventory

| Document | Path | Version |
|----------|------|---------|
| Requirements | `docs/analysis/academy-management-requirements.md` | v1.3.0 |
| ERD | `docs/design/academy-management-erd.md` | v1.3.0 |
| Functional Spec | `docs/design/academy-management-func-definition.md` | v1.3.0 |
| Process | `docs/design/academy-management-process.md` | v1.3.0 |
| Sequence | `docs/design/academy-management-sequence.md` | v1.3.0 |
| UI Screens | `docs/design/academy-management-screens.md` | v1.3.0 |
| DB Schema SQL | `sql/academy-management-schema.sql` | v1.3.0 |
| Screen Mockups | `docs/design/screens/*.html` | v1.3.0 |

### Key ID Ranges (기존 ID 범위)

| Type | Range | Note |
|------|-------|------|
| FR | FR-001 ~ FR-048 | FR-047/048 are v1.3 new |
| NFR | NFR-001 ~ NFR-013 | NFR-013 is v1.3 new |
| FN | FN-001 ~ FN-115 | FN-106~115 are v1.3 new |
| PRC | PRC-001 ~ PRC-076 | PRC-075/076 are v1.3 new |
| Scenario | 1 ~ 13 | Scenario 12/13 are v1.3 new |
| A | A-001 ~ A-013 | A-011~013 are v1.3 new |
| Q | Q-001 ~ Q-021 | Q-014/015/018 closed at v1.3 |

**새 기능 추가 시 기존 번호 범위 이후부터 부여한다.**

---

## 11. TAC-Specific Code Patterns (TAC 프로젝트 코드 패턴)

### 11.1 Domain Entity Pattern

```typescript
// backend/src/domain/entities/student.entity.ts
// Domain entity — 프레임워크 의존 없음
export class Student {
  id: number;
  academyId: number;
  primaryParentId: number;
  name: string;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  WITHDRAWN = 'WITHDRAWN',
}
```

### 11.2 Repository Interface Pattern

```typescript
// backend/src/domain/repositories/student.repository.interface.ts
import { Student } from '../entities/student.entity';

export interface IStudentRepository {
  findById(id: number): Promise<Student | null>;
  findByAcademyId(academyId: number): Promise<Student[]>;
  save(student: Partial<Student>): Promise<Student>;
  update(id: number, data: Partial<Student>): Promise<Student>;
  softDelete(id: number): Promise<void>;
}

export const STUDENT_REPOSITORY = Symbol('IStudentRepository');
```

### 11.3 TypeORM Entity Pattern

```typescript
// backend/src/infrastructure/database/entities/student.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('tac_students')
export class StudentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'academy_id', type: 'bigint' })
  academyId: number;

  @Column({ name: 'primary_parent_id', type: 'bigint' })
  primaryParentId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'datetime', nullable: true })
  deletedAt: Date | null;
}
```

### 11.4 DTO Pattern (class-validator)

```typescript
// backend/src/application/dto/student/create-student.dto.ts
import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ description: 'Student name (학생 이름)' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Primary parent ID (주 보호자 ID)' })
  @IsNumber()
  primaryParentId: number;
}
```

### 11.5 NestJS Controller Pattern

```typescript
// backend/src/presentation/controllers/students.controller.ts
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateStudentDto } from '../../application/dto/student/create-student.dto';

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepo: IStudentRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List students (학생 목록 조회)' })
  async findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    const students = await this.studentRepo.findByAcademyId(academyId);
    return { data: students, meta: { page, limit, total: students.length } };
  }

  @Post()
  @ApiOperation({ summary: 'Create student (학생 등록)' })
  async create(@Body() dto: CreateStudentDto) {
    const student = await this.studentRepo.save(dto);
    return { data: student };
  }
}
```

### 11.6 Frontend Page Pattern

```typescript
// frontend/src/app/(admin)/students/page.tsx
// Server Component (default)
export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-deep-ink">학생 관리</h1>
        <Button>학생 등록</Button>
      </div>
      <StudentList />
    </div>
  );
}
```

```typescript
// frontend/src/components/admin/student-list.tsx
'use client';
import { useQuery } from '@tanstack/react-query';

export function StudentList() {
  const { data, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => fetch('/api/students').then(r => r.json()),
  });

  if (isLoading) return <Skeleton />;
  return <DataTable data={data?.data ?? []} columns={columns} />;
}
```

### 11.7 Layout Convention

| Route Group | Layout | Auth | Rendering | Port |
|-------------|--------|------|-----------|------|
| `(portal)` | `PortalLayout` — Header + Footer, brand colors | Public | SSG + ISR | 3000 |
| `(admin)` | `AdminLayout` — Sidebar + Header | Required | SSR + CSR | 3000 |
| NestJS API | — | Guard-based | JSON | 4000 |

### 11.8 API Response Format

```typescript
// Success
{ data: T, meta?: { page, limit, total } }

// Error (GlobalExceptionFilter)
{ success: false, error: { code: string, message: string } }
```

### 11.9 Webhook Handler Pattern

```typescript
// backend/src/presentation/controllers/webhooks/toss-webhook.controller.ts
@Controller('webhooks/toss')
export class TossWebhookController {
  @Post()
  async handle(@Req() req: Request) {
    const signature = req.headers['tosspayments-signature'];
    const body = await rawBody(req);
    if (!verifyHMAC(body, signature, secret)) {
      throw new UnauthorizedException('Invalid signature');
    }
    // Process webhook idempotently
    return { ok: true };
  }
}
```

---

## 12. Module Map (모듈 맵)

```
Portal (Public)          Admin Console              Integration           Backend Modules
─────────────────        ──────────────────         ─────────────         ──────────────
Home (SSG)               Dashboard                  AMA Client Sync       AcademyModule
About                    Program Management         AmoebaTalk Notify     StudentModule
Programs Catalog         Consultation Management    Toss Payments         TeacherModule
MAP Test Info            Student/Parent Mgmt        NTS eTax API          ConsultationModule
Contact (Intake)         Teacher Management                               ProgramModule
News                     Class Management                                 ClassModule
                         Timetable View                                   EnrollmentModule
                         Enrollment Management                            TimetableModule
                         Trinity Pay (Payment)                             PaymentModule
                         MAP Question Bank                                MapModule
                         Settings (Refund Policy)                          SettingsModule
```

Each admin module corresponds to a NestJS module with its own controller, use cases, and domain entities.
