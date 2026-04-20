---
name: trinity-academy-spec-generator
description: >
  Trinity Academy(TAC) 프로젝트 전용 SDLC 문서 생성 스킬.
  Amoeba Company amoeba-spec-generator v3.1 기반, Next.js 14 App Router 풀스택 구조에 맞게 커스터마이징.
  이중 언어(EN/KR) 문서, 단계별 산출물 추적(FR → FN → T → TC), Git 기반 형상관리.
  Triggers: "기획서", "스펙 문서", "API 설계", "DB 스키마", "PRD", "기능 명세",
  "요구사항 분석", "시퀀스다이어그램", "ERD", "WBS", "개발계획서", "테스트케이스",
  "화면기획서", "작업계획서", "작업리포트", "테스트리포트",
  "버그 리포트", "기능 개선", "형상관리" 등의 표현에 트리거한다.
---

# Trinity Academy Spec Generator (트리니티 아카데미 스펙 생성 스킬)

Trinity Academy(TAC) 프로젝트의 SDLC 전체 라이프사이클을 지원하는 **문서 생성 스킬**이다.
Amoeba Company `amoeba-spec-generator v3.1` 기반이며, Next.js 14 App Router 풀스택 구조에 맞게 커스터마이징되었다.

Core principles:
1. **Bilingual documentation** — English-first with Korean annotations (영어 우선, 한국어 병기)
2. **Traceability** — FR → FN → T → TC consistent ID references
3. **Git-native workflow** — 형상관리는 Git 기반
4. **Conversational creation** — 대화형 인터뷰로 점진적 문서 작성

---

## 1. Technical Context (기술 컨텍스트)

### 1.1 Project Info

| Item | Value |
|------|-------|
| Project Code | TAC |
| Database Name | `db_tac` |
| Table Prefix | `tac_` |
| API Base | `/api/{resource}` |

### 1.2 Tech Stack

| Layer | Technology | Note |
|-------|-----------|------|
| **Framework** | Next.js 14 (App Router) | SSG/ISR (Portal) + SSR (Admin) + Route Handlers (API) |
| **UI** | React 18 + TailwindCSS + shadcn/ui | Server Components default, Client Components with `'use client'` |
| **State** | Zustand (client) + React Query (server) | — |
| **Form** | React Hook Form + Zod | Schema validation |
| **Database** | MySQL 8 + Prisma | NOT PostgreSQL, NOT TypeORM |
| **Cache** | Redis 7.x | Cache, session, rate limiting |
| **Queue** | RabbitMQ 3.x | Event-driven workers |
| **Storage** | S3 Compatible | MAP assets, receipts, tax invoice PDF/XML |
| **PG** | Toss Payments | Widget SDK v2 + Confirm API + Webhook v2 |
| **Icons** | Lucide React | `lucide-react` |
| **i18n** | react-i18next (ko default) | — |

### 1.3 Architecture

```
Next.js 14 App Router
├── src/app/(portal)/     # 학부모 포털 — SSG/ISR, Public
├── src/app/(admin)/      # 운영 콘솔 — SSR, Authenticated
├── src/app/api/          # Route Handlers — REST API
├── src/components/       # Shared UI (ui/, layout/, portal/, admin/)
├── src/lib/              # Business logic (db/, auth/, toss/, ama/, rabbitmq/, storage/)
├── src/hooks/            # Custom React hooks
├── src/stores/           # Zustand stores
├── src/types/            # Shared TypeScript types
└── prisma/               # Prisma schema
```

### 1.4 Amoeba 표준 vs TAC 차이점

| Item | Amoeba Standard (v2) | TAC Project |
|------|---------------------|-------------|
| Backend | NestJS 10.x (DDD 4-layer) | **Next.js 14 Route Handlers** |
| ORM | TypeORM 0.3.x | **Prisma** |
| Database | PostgreSQL 15.x | **MySQL 8.x** |
| Structure | Turborepo monorepo (apps/api + apps/web) | **Single Next.js App Router** (route groups) |
| PK Convention | `{col_prefix}_id` (UUID) | **`id`** (BIGINT AUTO_INCREMENT) |
| Column Prefix | `{col_prefix}_{name}` | Standard naming (no prefix) |
| Multi-tenancy | `ent_id` (Entity) | **`academy_id`** (Academy) |
| Queue | Bull (Redis-based) | **RabbitMQ** |
| Frontend | React/Vue.js (Vite SPA) | **React (Next.js integrated)** |

### 1.5 Key Integration Points

| Service | Scope | Note |
|---------|-------|------|
| AMA Service | Teacher master (Client 1:1 참조) — **read-only** | 결제 미관여 |
| AmoebaTalk | 알림 발송 (상담/결제/환불/MAP/세금계산서) | 발송 채널 한정 |
| Toss Payments | 결제·승인·환불 (Widget + Confirm + Webhook v2) | AMA 경유 X |
| NTS eTax API | 전자세금계산서 자체 발행 | 공동인증서 기반 |

---

## 2. Bilingual Writing Convention (이중 언어 작성 규칙)

All documents follow **English-first with Korean annotations**.

| Rule | Example |
|------|---------|
| Section headers | `## 1. Overview (개요)` |
| Table headers | English only: `| ID | Requirement | Priority |` |
| Table content | English preferred; Korean for domain terms |
| Code/API/SQL | Always English |
| Filenames | English: `{feature}-requirements.md` |
| Git commit | English: `feat(portal): add contact form` |

---

## 3. Document Repository Structure (문서 저장 구조)

```
app-academy/
├── docs/
│   ├── analysis/                    # Stage 1
│   │   └── {feature}-requirements.md
│   ├── design/                      # Stage 2
│   │   ├── {feature}-erd.md
│   │   ├── {feature}-func-definition.md
│   │   ├── {feature}-sequence.md
│   │   ├── {feature}-process.md
│   │   ├── {feature}-screens.md     # UI Specification
│   │   └── screens/                 # HTML mockups
│   ├── implementation/              # Stage 3
│   │   ├── {feature}-dev-plan.md
│   │   ├── {feature}-wbs.md
│   │   └── tasks/
│   │       ├── {feature}-task-{n}-plan.md
│   │       └── {feature}-task-{n}-report.md
│   ├── test/                        # Stage 4-5
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
created: 2026-04-19
updated: 2026-04-19
author: {author}
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-19
    author: {author}
    description: Initial draft
---
```

---

## 4. SDLC Stages (개발 라이프사이클)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 1.Analy- │ →  │ 2.Design │ →  │ 3.Imple- │ →  │ 4.Unit   │ →  │ 5.Final  │
│   sis    │    │          │    │ mentation│    │   Test   │    │   Test   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Stage Detection (단계 판별)

| User says… | Stage |
|---|---|
| "요구사항 분석", "requirements analysis" | 1. Analysis |
| "ERD", "기능정의", "시퀀스", "화면기획", "프로세스" | 2. Design |
| "개발계획", "WBS", "작업계획서" | 3. Implementation |
| "테스트케이스", "단위테스트" | 4. Unit Test |
| "통합테스트", "최종테스트" | 5. Final Test |
| "버그 리포트", "버그 수정" | Bug Fix Report |

### Artifacts by Stage (단계별 산출물)

| Stage | Artifact | File Pattern |
|-------|----------|-------------|
| **1. Analysis** | Requirements Analysis (요구사항 분석서) | `{feature}-requirements.md` |
| **2. Design** | Functional Specification (기능 정의서) | `{feature}-func-definition.md` |
| | ERD + SQL DDL | `{feature}-erd.md` + `sql/{feature}-schema.sql` |
| | Sequence Diagram (시퀀스 다이어그램) | `{feature}-sequence.md` |
| | Process Definition (프로세스 정의서) | `{feature}-process.md` |
| | UI Specification (화면 기획서) | `{feature}-screens.md` |
| **3. Implementation** | Development Plan (개발계획서) | `{feature}-dev-plan.md` |
| | WBS | `{feature}-wbs.md` |
| | Task Plan (태스크 작업계획서) | `tasks/{feature}-task-{n}-plan.md` |
| | Task Report (태스크 작업리포트) | `tasks/{feature}-task-{n}-report.md` |
| **4. Unit Test** | Test Cases (테스트 케이스) | `{feature}-testcase.md` |
| | Test Report (테스트 리포트) | `{feature}-test-report.md` |
| **5. Final Test** | Final Test Report (최종 테스트 리포트) | `{feature}-final-test-report.md` |
| **Cross-stage** | Bug Fix Report | `FIX-{YYMMDD}-{title}.md` |
| | CHANGELOG | `CHANGELOG.md` |

---

## 5. Workflow Rules (작업 규칙)

### 5.1 작업 시작 전 필수 확인
1. **CLAUDE.md** 프로젝트 지침 확인
2. **SPEC.md** 프로젝트 명세 확인
3. 관련 설계 문서 (`docs/design/`, `docs/analysis/`) 확인
4. Memory (`/memories/`, `/memories/session/`, `/memories/repo/`) 확인

### 5.2 요구사항 작업 시 진행 중단점
- 요구사항 분석서 + 작업 계획서 작성 후 **반드시 사용자 확인을 받은 후** 구현 진행
- 작업 계획서에는 **화면 구성안(UI 레이아웃 목업)** 반드시 포함
- 사용자가 "진행해", "구현해" 등 명시적 지시를 해야만 코드 구현 시작

### 5.3 Conversational Interview (대화형 인터뷰)
- 한 번에 질문을 쏟아붓지 않는다. 2-3개씩 자연스럽게
- "잘 모르겠다" → 합리적 기본값 제안 + `[TBD]` 마크
- 생성 전 목차를 보여주고 확인 → 생성 후 피드백 수렴

---

## 6. Document Templates (문서 템플릿)

### 6.1 Requirements Analysis (요구사항 분석서)

```markdown
---
document_id: {FEATURE}-REQ-{VERSION}
version: 1.0.0
status: Draft
---

# {Feature Name} — Requirements Analysis ({기능명} 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)
- **Project**: {name} / Version / Date
- **Background and Purpose (배경 및 목적)**: ...
- **Expected Benefits (기대 효과)**: ...

## 2. Stakeholders (이해관계자)
| Role | Person/Team | Responsibility |

## 3. Requirements (요구사항 목록)
### Functional Requirements (기능 요구사항)
| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-001 | ... | P0 | |

### Non-Functional Requirements (비기능 요구사항)
| ID | Requirement | Criteria |

## 4. Scope Definition (범위 정의)
- **In-Scope / Out-of-Scope / MVP vs Full**

## 5. Constraints and Assumptions (제약사항 및 가정)
## 6. Related Systems (연관 시스템)
## 7. Success Metrics (성공 지표)
## 8. Open Questions (미결정 사항)
```

### 6.2 Functional Specification (기능 정의서)

```markdown
---
document_id: {FEATURE}-FUNC-{VERSION}
---

# {Feature Name} — Functional Specification ({기능명} 기능 정의서)

## Module: {Module Name}

### FN-001: {Function Name}
- **Function ID**: FN-001
- **Related**: FR-001
- **Description**: ...
- **Pre-condition**: ...
- **Post-condition**: ...
- **Processing Logic**:
  1. ...
- **Input Parameters**: ...
- **Output**: ...
- **Error Handling**: ...
```

### 6.3 Sequence Diagram (시퀀스 다이어그램)

Participant 명은 TAC 기술 스택에 맞게 표기:

```markdown
## Scenario N: {Scenario Name}

​```mermaid
sequenceDiagram
    actor User
    participant FE as Next.js (React)
    participant BE as Next.js Route Handler
    participant DB as MySQL (Prisma)
    participant MQ as RabbitMQ
    participant Cache as Redis
    participant Toss as Toss Payments
    participant AMA as AMA Service
    participant NTS as 국세청 eTax

    User->>FE: {action}
    FE->>BE: POST /api/{resource}
    BE->>DB: Prisma query
    ...
​```
```

### 6.4 ERD

```markdown
---
document_id: {FEATURE}-ERD-{VERSION}
---

# {Feature Name} — ERD

## ER Diagram

​```mermaid
erDiagram
    TAC_TABLE_A ||--o{ TAC_TABLE_B : "has many"
    TAC_TABLE_A {
        bigint id PK
        bigint academy_id FK
        varchar name
        datetime created_at
        datetime updated_at
    }
​```

## Table Definitions

### tac_{table_name}
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | BIGINT | NO | AUTO_INCREMENT | PK |
| academy_id | BIGINT | NO | | FK tac_academies.id (multi-tenancy) |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP ON UPDATE | |
```

SQL DDL은 `sql/{feature}-schema.sql`로 별도 생성.

### 6.5 Process Definition (프로세스 정의서)

```markdown
---
document_id: {FEATURE}-PRC-{VERSION}
---

# {Feature Name} — Process Definition ({기능명} 프로세스 정의서)

## PRC-001: {Process Name}
- **Process ID**: PRC-001
- **Purpose**: ...
- **Trigger**: ...
- **Completion**: ...

### Processing Steps
| Step | Actor | Action | Input | Output | Branch |
|------|-------|--------|-------|--------|--------|

### Exception Handling
| Exception | Step | Response |
|-----------|------|----------|
```

### 6.6 UI Specification (화면 기획서)

```markdown
---
document_id: {FEATURE}-SCR-{VERSION}
---

# {Feature Name} — UI Specification ({기능명} 화면 기획서)

## Screen List
| Screen ID | Screen Name | Route | Layout | Note |
|-----------|-------------|-------|--------|------|
| SCR-001 | {name} | /(portal or admin)/{path} | PortalLayout / AdminLayout | |

## SCR-001: {Screen Name}

### Layout
(ASCII wireframe)

### Components
| Element | Type | Description | Behavior |
|---------|------|-------------|----------|

### State Management
- Loading: Skeleton UI
- Error: Error message + retry
- Empty: Guidance message

### Responsive
- Desktop (≥1024px): ...
- Mobile (<768px): ...
```

### 6.7 Task Plan (태스크 작업계획서)

```markdown
# Task Plan: T-001 {Task Name}

## Basic Information (기본 정보)
- **Task ID**: T-001
- **Assignee**: {person}
- **Estimated effort**: {n} days
- **Depends on**: T-000

## Task Description (작업 내용)
- Reference docs: FN-001, Sequence Scenario 1

## Implementation Plan (구현 계획)
### UI Layout (화면 구성안)
(ASCII wireframe — 반드시 포함)

### Implementation Steps
1. ...

## Files to Change (변경 파일)
| Path | Action | Description |
|------|--------|-------------|
| src/app/(admin)/... | Create | ... |

## Acceptance Criteria (완료 조건)
- [ ] ...
```

### 6.8 Task Report (태스크 작업리포트)

```markdown
# Task Report: T-001 {Task Name}

## Basic Information
- **Planned effort**: {n}d → **Actual effort**: {m}d
- **Status**: Complete

## Implementation Summary
## Changes
## Issues Encountered
| Issue | Cause | Resolution |
## Remaining Items
```

### 6.9 Bug Fix Report (버그 수정 보고서)

```markdown
# FIX-{YYMMDD}-{Title}

## Bug Information
- **Reported**: {date}
- **Severity**: Critical / Major / Minor
- **Affected Module**: {module}
- **Related FR/FN**: FR-001, FN-001

## Bug Description
## Root Cause Analysis
## Fix Applied
### Changed Files
| Path | Change |
## Verification
## Prevention Notes
```

---

## 7. ID Convention (ID 체계)

| Prefix | Purpose | Example |
|--------|---------|---------|
| FR-{NNN} | Functional Requirement | FR-001 |
| NFR-{NNN} | Non-Functional Requirement | NFR-001 |
| FN-{NNN} | Function (Spec) | FN-001 |
| PRC-{NNN} | Process | PRC-001 |
| SCR-{NNN} | Screen | SCR-001 |
| T-{NNN} | Task (WBS) | T-001 |
| TC-{NNN} | Test Case | TC-001 |
| ITC-{NNN} | Integration Test Case | ITC-001 |
| A-{NNN} | Assumption | A-001 |
| C-{NNN} | Constraint | C-001 |
| Q-{NNN} | Open Question | Q-001 |

---

## 8. Git Convention

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

### Branch Naming

```
feature/{description}           # New feature
bugfix/{description}            # Bug fix
enhance/{description}           # Enhancement
docs/{description}              # Documentation only
```

---

## 9. Existing Design Documents (기존 설계 문서 참조)

TAC 프로젝트는 v1.3.0 기준 분석·설계 문서가 이미 작성되어 있다. 새 기능 추가 시 기존 문서를 참조하여 일관성을 유지한다.

| Document | Path | Version |
|----------|------|---------|
| Requirements | `docs/analysis/academy-management-requirements.md` | v1.3.0 |
| ERD | `docs/design/academy-management-erd.md` | v1.3.0 |
| Functional Spec | `docs/design/academy-management-func-definition.md` | v1.3.0 |
| Process | `docs/design/academy-management-process.md` | v1.3.0 |
| Sequence | `docs/design/academy-management-sequence.md` | v1.3.0 |
| DB Schema SQL | `sql/academy-management-schema.sql` | v1.3.0 |
| Screen Mockups | `docs/design/screens/*.html` | v1.3.0 |

### Key ID Ranges (기존 ID 범위)

| Type | Range | Note |
|------|-------|------|
| FR | FR-001 ~ FR-048 | FR-047/048 are v1.3 new |
| NFR | NFR-001 ~ NFR-013 | NFR-013 is v1.3 new |
| FN | FN-001 ~ FN-115 | FN-106/107 are v1.3 new |
| PRC | PRC-001 ~ PRC-076 | PRC-075/076 are v1.3 new |
| Scenario | 1 ~ 13 | Scenario 12/13 are v1.3 new |
| A | A-001 ~ A-013 | A-011~013 are v1.3 new |
| Q | Q-001 ~ Q-021 | Q-014/015/018 closed at v1.3 |

새 기능 추가 시 기존 번호 범위 이후부터 부여한다.

---

## 10. TAC-Specific Patterns (TAC 프로젝트 고유 패턴)

### 10.1 Route Handler Pattern (API)

```typescript
// src/app/api/{resource}/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createSchema = z.object({ /* ... */ });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validated = createSchema.parse(body);
  // academy_id from session middleware
  const result = await prisma.tableName.create({ data: validated });
  return NextResponse.json({ data: result }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const results = await prisma.tableName.findMany({
    where: { academy_id: session.academyId },
  });
  return NextResponse.json({ data: results });
}
```

### 10.2 Component Pattern

```typescript
// Server Component (default)
// src/app/(admin)/{module}/page.tsx
export default async function ModulePage() {
  const data = await prisma.tableName.findMany();
  return <ModuleList data={data} />;
}

// Client Component
// src/components/admin/{module}-form.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function ModuleForm() {
  const form = useForm({ resolver: zodResolver(schema) });
  // ...
}
```

### 10.3 Prisma Schema Pattern

```prisma
model TacStudents {
  id              BigInt    @id @default(autoincrement())
  academyId       BigInt    @map("academy_id")
  primaryParentId BigInt    @map("primary_parent_id")
  name            String    @db.VarChar(100)
  status          String    @default("ACTIVE") @db.VarChar(20)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  academy         TacAcademies @relation(fields: [academyId], references: [id])
  primaryParent   TacParents   @relation(fields: [primaryParentId], references: [id])

  @@map("tac_students")
  @@index([academyId, status])
}
```

### 10.4 Portal Layout Convention

| Route Group | Layout | Auth | Rendering |
|-------------|--------|------|-----------|
| `(portal)` | `PortalLayout` — Header + Footer, brand colors | Public | SSG + ISR |
| `(admin)` | `AdminLayout` — Sidebar + Header | Required | SSR + CSR |

### 10.5 Webhook Handler Pattern

```typescript
// src/app/api/webhooks/toss/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get('TossPayments-Signature');
  // HMAC verification
  const body = await request.text();
  if (!verifyHMAC(body, signature, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Process webhook idempotently
  const payload = JSON.parse(body);
  // ...
  return NextResponse.json({ ok: true }, { status: 200 });
}
```
