---
document_id: ACM-PLAN-001
version: 1.0.0
status: Draft
created: 2026-04-26
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
product_code: ACM
sub_phase: v1.0a
parent_documents:
  - ACM-REQ-001 v3.0 (top-level requirements)
  - ACM-REQ-CSL-001 v2.1
  - ACM-REQ-DSH-001 v1.0
  - ACM-REQ-SCH-001 v1.0
  - ACM-REQ-REF-001 v1.0
  - ACM-REQ-QNA-001 v1.0
  - TPI-ADR-001, TPI-ADR-001-A1
related_documents:
  - ACM-ERD-001 (to be authored — Stage 2)
  - ACM-FN-{module}-001 (to be authored per module — Stage 2)
  - ACM-WBS-001 (to be authored from this plan)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial work plan for ACM v1.0a sub-phase (5 modules — DSH, CSL, SCH, REF, QNA), Vue3 + NestJS + PostgreSQL stack per Amoeba standard.
  - version: 1.0.1
    date: 2026-04-26
    author: 김태윤 팀장
    description: Frontend stack pivot — Vue3/Pinia/vue-i18n → React 18 + Vite + TailwindCSS + shadcn/ui + Zustand + TanStack Query + React Hook Form + Zod + react-i18next. Per PO directive.
---

# ACM v1.0a — Work Plan (학원관리앱 v1.0a 작업계획서)

> **Sub-Phase Scope**: 5 modules (DSH, CSL, SCH, REF, QNA) — excludes CLS (v1.0b) and external integrations (v1.1).
> **Target Entity**: TPI (first AMB Entity). Sister academies in v1.1.
> **Estimated Duration**: 11 weeks (per `ACM-REQ-001 v3.0 §3.5`).
> **Stack**: React 18 + NestJS 10 + PostgreSQL 15 + Redis 7 (Amoeba code convention v2.0). _Frontend pivoted from Vue3 → React per PO directive 2026-04-26._

---

## 1. Plan Overview (계획 개요)

### 1.1 Document Information (문서 정보)

| Item (항목) | Content (내용) |
|---|---|
| **Document Name (문서명)** | ACM v1.0a Work Plan (작업계획서) |
| **Document ID** | ACM-PLAN-001 |
| **Sub-Phase** | v1.0a — Existing 5 modules cut-over |
| **Version** | 1.0.0 |
| **Created** | 2026-04-26 |
| **Author** | 김태윤 팀장 (PO) |

### 1.2 Goal (목표)

Replace the spreadsheet-based operation of 5 functional areas (Dashboard / New Counseling / School Admission / Reference / Regular Counseling) with a normalized, multi-tenant ACM Custom App on AMB. Deliver 100% adoption for new TPI counseling intake within 1 month of go-live (KPI-001).

5개 운영 영역(대시보드/신규상담/학교입학정보/참조자료/정기상담)의 엑셀 기반 운영을 AMB 위 멀티테넌시 ACM Custom App으로 전환. v1.0a 출시 1개월 내 신규 TPI 상담 100% 채택 (KPI-001).

### 1.3 Out of Scope for This Plan (본 계획 제외 범위)

| Item | Target Phase | Reason |
|---|---|---|
| CLS module (수업관리) | v1.0b | Per `TPI-ADR-001-A1 DEC-3` |
| Bodaschool / Google Meet / Google Calendar integrations | v1.1 | External partner readiness |
| Parent portal (CLIENT_LEVEL) | v2.0 | `ACM-REQ-001 §3.4` |
| AMB Payroll integration | v1.1+ | `DEC-4` |
| MKT (Marketing) module | Separate Custom App | `ACM-REQ-001 §3.4` |

### 1.4 Pending Decisions Blocking Start (착수 전 결정 필요 사항)

| ID | Question | Owner | Required by |
|---|---|---|---|
| Q-ACM-001 | ACM Custom App registration in `amb_entity_custom_apps` | Amoeba Platform | M-0 (Week 0) |
| Q-ACM-002 | Custom App API key encryption policy | Amoeba Security | M-0 |
| Q-ACM-003 | TPI Entity provisioning + initial user assignment | Amoeba Ops | M-0 |
| Q-ACM-006 | AMB Issue type for system-generated SLA tasks | 김태윤 (PO) | Sprint 4 (CSL SLA work) |

---

## 2. Architecture Snapshot (아키텍처 스냅샷)

### 2.1 Tech Stack (기술 스택)

| Layer | Technology | Version | Note |
|---|---|---|---|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui | 18.x / 5.x / 5.x / 3.x | Amoeba `amb-spa` shell embeds ACM SPA via Custom App slot |
| State (client) | Zustand | 5.x | Lightweight stores per module |
| State (server) | TanStack Query (React Query) | 5.x | Cache + invalidation for REST calls |
| Form | React Hook Form + Zod | 7.x / 4.x | Form binding + schema validation |
| Routing | React Router | 6.x | Embedded under AMB shell mount path |
| Backend | NestJS | 10.x | DDD modules per `amoeba_basic_Structure_v2` |
| ORM | TypeORM | 0.3.x | UUID PK convention |
| Database | PostgreSQL | 15.x | `db_amb` shared with AMB Core; ACM tables prefix `amb_acm_*` |
| Cache | Redis | 7.x | DSH aggregation cache, REF lookup cache |
| Auth | AMB Core JWT | inherited | `@Auth()` + `OwnEntityGuard` decorators |
| Validation | class-validator + Zod | latest | Server: class-validator; Client: Zod |
| API Docs | Swagger | latest | `/api/docs` (dev) |
| i18n | react-i18next | 14.x | ko (default), en, vi |

### 2.2 Module Boundary (모듈 경계)

```
┌──────────────────────────────────────────────────────────────────┐
│  ACM Custom App on AMB (db_amb shared, amb_acm_* prefix)         │
│                                                                  │
│   ┌──────┐    CRUD events       ┌─────────────────────────────┐ │
│   │ CSL  │──────────────────────▶│  DSH (Aggregation Worker)   │ │
│   └──┬───┘                       │   - daily_kpi STALE marking │ │
│      │ findBenchmark()           │   - 03:00 nightly recompute │ │
│      ▼                           └─────────────────────────────┘ │
│   ┌──────┐                                                       │
│   │ REF  │◀──── lookup ──── CSL F-13 MAP score entry            │
│   └──────┘                                                       │
│                                                                  │
│   ┌──────┐    qna_related_school_id                              │
│   │ QNA  │────────────────▶  ┌──────┐                            │
│   └──────┘                   │ SCH  │                            │
│                              └──────┘                            │
└──────────────────────────────────────────────────────────────────┘
                          │
                          ▼ one-way HTTP
            ┌──────────────────────────────┐
            │  AMB Core (inherited)        │
            │   - Auth / Entity / Unit     │
            │   - Issue API (SLA breach)   │
            │   - KMS / Encryption / i18n  │
            └──────────────────────────────┘
```

### 2.3 Naming Convention (명명 규칙)

| Item | Rule | Example |
|---|---|---|
| Schema | `db_amb` (shared) | — |
| Table | `amb_acm_{module}_{plural}` | `amb_acm_csl_inquiries` |
| Column prefix (3-letter) | `{table_short}_{name}` | `inq_phone_encrypted`, `dkp_date` |
| PK | `{prefix}_id` UUID | `inq_id` (CHAR(36) UUID v4) |
| FK | `{prefix}_id` matching parent | `inq_id` in child tables |
| ENUM | UPPER_SNAKE | `INTAKE`, `MAP_TEST`, `DROPPED` |
| Soft-delete | `{prefix}_deleted_at` | NFR-013 |
| Timestamp | `{prefix}_created_at`, `{prefix}_updated_at` | NOT NULL DEFAULT now() |
| Tenant | `ent_id UUID NOT NULL` on every business table | NFR-008 |

---

## 3. Module Inventory (모듈 인벤토리)

| # | Module | Source | FR Count | Tables | Sprint Span | Effort |
|---|---|---|---|---|---|---|
| 1 | **DSH** Dashboard | INDEX (132 active rows) | ~40 | 4 | S5-S6 (parallel) | 2 wk |
| 2 | **CSL** Counseling (신규) | 신규 (140 active) | 42 | 7 | S2-S5 | 4 wk |
| 3 | **SCH** School Admission | 학교입학 정보 (41 active) | 85 | 3 | S6-S7 | 2 wk |
| 4 | **REF** Reference | 가이드라인 + 점수대 (~45 active) | ~30 | 5 | S6-S7 (parallel) | 1.5 wk |
| 5 | **QNA** Regular Counseling | Q&A (83 active after cleanse) | ~45 | 3 | S8-S9 | 1.5 wk |

> **Note**: SCH FR count of 85 is from `ACM-REQ-SCH-001`; many are P1/P2 — only P0 is in v1.0a critical path.

---

## 4. WBS — Work Breakdown Structure (작업 분해 구조)

### 4.1 Sprint Plan (스프린트 계획)

11-week timeline using 1-week sprints. Foundation/migration sprints bookend module development.

| Sprint | Week | Theme (테마) | Key Deliverables |
|---|---|---|---|
| **S0** | W0 | Pre-flight / Decisions | Q-ACM-001/002/003/006 resolved; AMB Custom App registered; TPI Entity provisioned |
| **S1** | W1 | Foundation (스캐폴딩) | NestJS modules scaffolded; React Custom App shell (Vite + RR6); ENUM tables seeded; OwnEntityGuard wired |
| **S2** | W2 | CSL — schema + Field-level CRUD | `amb_acm_csl_*` migrations; 25 fields; encryption helper |
| **S3** | W3 | CSL — pipeline state machine | 6-stage transitions; transition log; cancellation log; remarks timeline |
| **S4** | W4 | CSL — SLA + assignment + UI list | SLA batch; round-robin advisor assignment; list+filter UI; AMB Issue trigger |
| **S5** | W5 | CSL migration + DSH schema/aggregation | 140-row migrate w/ quality flags; `amb_acm_dsh_*` tables; 21-metric aggregation worker |
| **S6** | W6 | DSH UI + REF schema/CRUD + SCH schema | DSH daily KPI table UI; REF guidelines/benchmarks; SCH schools/grade-bands |
| **S7** | W7 | REF lookup API + SCH UI + CSL↔REF integration | `findBenchmark()` API; CSL F-13 inline gap analysis; SCH browse/edit UI; REF migration (~45 rows) |
| **S8** | W8 | QNA schema + CRUD + SCH migration | `amb_acm_qna_*` tables; thread support; tone transformation helper; SCH 41-row migrate |
| **S9** | W9 | QNA UI + cross-module + FAQ | Q&A list/detail/timeline; cross-module attach (CSL/CLS/SCH/REF); FAQ promotion; QNA migrate (83 active) |
| **S10** | W10 | DSH manual input + complaints + drill-down | Marketing manual input; complaint log+severity; metric drill-down; final aggregation tuning |
| **S11** | W11 | UAT + parallel operation cut-over prep | i18n review; perf tuning (NFR-002); UAT with 김태윤/정성경/배예리; xlsx export per module |

### 4.2 Detailed WBS by Module (모듈별 상세 WBS)

#### 4.2.1 Foundation (S0-S1) — 1.0 week

| Task ID | Task | Layer | Output | Dependencies |
|---|---|---|---|---|
| F-01 | Resolve Q-ACM-001/002/003/006 | — | Decision memo | Amoeba Platform team |
| F-02 | Register ACM in `amb_entity_custom_apps` | Infra | Custom App ID + API key | F-01 |
| F-03 | Provision TPI Entity + assign initial users | Infra | TPI ent_id; 6 users seeded | F-01 |
| F-04 | NestJS module scaffolding (5 modules empty) | Backend | `src/modules/{dsh,csl,sch,ref,qna}` | — |
| F-05 | React Custom App shell (Vite + React Router slot, layout) | Frontend | `apps/acm/` shell | — |
| F-06 | Common: encryption helper (AES-256-GCM 3-field) | Backend | `@trinity/encryption` decorator | NFR-006 |
| F-07 | Common: OwnEntityGuard wired into all controllers | Backend | Global guard | NFR-008 |
| F-08 | Common: AMB Issue HTTP client (one-way) | Backend | `AmbIssueClient` service | TPI-ADR-001 §3.3 |
| F-09 | i18n bootstrap (ko/en/vi) | Frontend | locale files per module | NFR-016 |
| F-10 | Swagger setup | Backend | `/api/docs` accessible | NFR-019 |

#### 4.2.2 CSL — Counseling Management (S2-S5, M-2 migration) — 4.0 weeks

| Task ID | Task | Output | FR / BR Ref |
|---|---|---|---|
| CSL-01 | Schema migration — 7 tables, ENUMs, indexes | SQL migration file | F-01 ~ F-25 |
| CSL-02 | Entity + Repository (TypeORM) | 7 entities + 7 repos | — |
| CSL-03 | Inquiry Create/Read/Update use-case (25 fields) | DTO + Service | F-01..25 |
| CSL-04 | Phone encryption integration (3-field) | encrypted save/decrypt | NFR-006, BR-CSL-001 |
| CSL-05 | Score multi-format parser (6 formats → structured) | `parseMapScore()` helper | F-13, Q-CSL-001 |
| CSL-06 | Stage transition state machine (6 stages) | `StageTransitionService` | P01-P08, BR-CSL-006 |
| CSL-07 | Transition log (append-only) | `amb_acm_csl_stage_transitions` | Audit |
| CSL-08 | Cancellation log (6 ENUM reasons) | `cancellation` POST endpoint | F-25, Q-CSL-006 |
| CSL-09 | Remarks timeline (N:1) | `remarks` GET/POST | F-19 |
| CSL-10 | MAP Test waiver workflow (3 conditions) | `mapTestWaiver` use-case | Q-CSL-002 |
| CSL-11 | Stage skip logic (12-month prior score) | `canSkipMapTest()` | Q-CSL-003 |
| CSL-12 | Reactivation transition (DROPPED → prev) | `reactivate()` use-case | Q-CSL-004 |
| CSL-13 | Auto advisor assignment (purpose-specialized round-robin) | `AssignmentService` | BR-CSL-005 |
| CSL-14 | SLA monitoring batch (daily 02:00) | `SlaCheckCron` + AMB Issue creation | NFR-009 |
| CSL-15 | Channel-specific consent recording | `inq_consent_basis` ENUM | Q-CSL-010 |
| CSL-16 | Sunday/holiday soft warning (trial class) | UI hint + flag | Q-CSL-007 |
| CSL-17 | Senior-manager-only payment confirmation guard | Role check on F-22 | BR-CSL-012 |
| CSL-18 | List page with 13 filters + 25-column toggle | React page `<CslListView />` | L01-L12 |
| CSL-19 | Detail page with 6 stage tabs | React page `<CslDetailView />` | E01-E06 |
| CSL-20 | Bulk migration importer (140 rows, quality flags) | CLI script `csl:migrate` | M01-M06 |
| CSL-21 | Manual review queue UI (ambiguous rows) | React page `<CslMigrationReview />` | Q-CSL-001 |
| CSL-22 | Cross-module event publisher (`CSL.CLASS_STARTED`) | Event emitter (CLS subscribes in v1.0b) | F-24 stub |
| CSL-23 | Unit tests (state machine, parser, encryption) | Jest specs ≥ 80% coverage | NFR-017 |

#### 4.2.3 DSH — Dashboard (S5-S6, S10) — 2.0 weeks

| Task ID | Task | Output | FR Ref |
|---|---|---|---|
| DSH-01 | Schema migration — 4 tables (daily_kpi, manual_inputs, metric_definitions, complaints) | SQL migration | DSH §entities |
| DSH-02 | Seed 21 metric definitions | Seed script | FR-DSH-002~005 |
| DSH-03 | Aggregation engine — 5 aggregation types | `MetricAggregator` service | A01-A08 |
| DSH-04 | STALE marking event listeners (CSL/CLS CRUD) | Domain event subscribers | BR-DSH-002 |
| DSH-05 | Nightly recompute cron (03:00) | `KpiRecomputeCron` | A05 |
| DSH-06 | Daily KPI table view (month grid + Sum/Average) | React `<DshDailyKpiView />` | FR-DSH-001/006/007/008 |
| DSH-07 | Mobile read-only responsive | CSS media queries | NFR-015 |
| DSH-08 | Manual input form (Marketing 3 + complaint) | React `<DshManualInputForm />` (RHF + Zod) | M01-M06 |
| DSH-09 | Complaint log (6 categories, 4 severity) | React `<DshComplaintList />` | C01-C07 |
| DSH-10 | Drill-down navigation (metric → CSL/CLS filtered list) | Router param passing | FR-DSH-009 |
| DSH-11 | Marketing-input-missing AMB Issue trigger (3 days) | Cron job | BR-DSH-010 |
| DSH-12 | Status-vs-count aggregation rule (Sum = last day for status metrics) | aggregation logic | BR-DSH-003 |
| DSH-13 | INDEX 132-row back-fill migration | CLI `dsh:migrate` | MG01-MG07 |
| DSH-14 | Excel export matching INDEX layout | export endpoint | FR-DSH-011 (P2 — defer if behind) |
| DSH-15 | Unit + integration tests | Jest specs | NFR-017 |

#### 4.2.4 SCH — School Admission (S6-S8) — 2.0 weeks

| Task ID | Task | Output | Note |
|---|---|---|---|
| SCH-01 | Schema migration — 3 tables (schools, grade_bands, schedules) | SQL | 41 active rows |
| SCH-02 | Entity + Repository | TypeORM | — |
| SCH-03 | School CRUD use-case (AUTHORIZED/UNAUTHORIZED ENUM) | service | — |
| SCH-04 | Grade-band sub-rows (authorized only) | service | — |
| SCH-05 | Admission schedule (REGULAR/ROLLING/MIXED/UNDETERMINED) | service | Q-002 |
| SCH-06 | Free-text fallback `sch_admission_note` | textarea | C-105 |
| SCH-07 | Browse list page (filter: type/category) | React `<SchListView />` | — |
| SCH-08 | School detail page (grade-bands + schedules) | React `<SchDetailView />` | — |
| SCH-09 | Edit form (admin only) | role-guarded | — |
| SCH-10 | 41-row migration (7 인가 + ~11 비인가 + grade-bands) | CLI `sch:migrate` | — |
| SCH-11 | Q&A cross-module link surface (`qna_related_school_id`) | API for QNA | QNA cross-ref |
| SCH-12 | Tests | Jest | — |

> **Note**: P1/P2 SCH features (advanced search, deadline alerts, etc.) deferred to v1.0b/v1.1 unless blocking.

#### 4.2.5 REF — Reference Materials (S6-S7) — 1.5 weeks

| Task ID | Task | Output | FR Ref |
|---|---|---|---|
| REF-01 | Schema — 5 tables (guidelines, level_test_guides, score_benchmarks, benchmark_grades, modifiers) | SQL | — |
| REF-02 | Versioning fields (`version_no`, `effective_from/to`) | TypeORM entity | Q-003 |
| REF-03 | Class guideline CRUD (admin/team-lead only) | service | FR-REF-001~003 |
| REF-04 | Level test guide (ISEE TARGET / SSAT CURRENT — opposite!) | service + UI badge | BR-REF-003 |
| REF-05 | Score benchmark for MAP (G1-G12, R/M, no-upper-bound flag) | service | FR-REF-004 |
| REF-06 | Score benchmark for ISEE (Level × Grade × tier) | service | FR-REF-005 |
| REF-07 | Score benchmark for SSAT | service | FR-REF-006 |
| REF-08 | Score benchmark inherits-from-above auto-backfill | service + flag | DQ |
| REF-09 | Modifiers (외국인학교 +5~+7) | service | DQ |
| REF-10 | **Critical: `findBenchmark(exam_type, grade, asOfDate)` lookup API + Redis cache** | service + cache | FR-REF-007, BR-CSL-010 |
| REF-11 | CSL F-13 inline gap analysis component | React component | FR-REF-008 |
| REF-12 | Browse pages (guideline / level test / benchmark matrix) | React pages | FR-REF-001/004 |
| REF-13 | Migration (~13 guidelines + ~35 benchmarks + 5 modifiers) | CLI `ref:migrate` | MG01-MG12 |
| REF-14 | Tests (lookup determinism by date) | Jest | — |

#### 4.2.6 QNA — Regular Counseling (S8-S9) — 1.5 weeks

| Task ID | Task | Output | FR Ref |
|---|---|---|---|
| QNA-01 | Schema — 3 tables (records, record_students, categories) | SQL | — |
| QNA-02 | Q&A CRUD with internal/external response separation | service | FR-QNA-001-009 |
| QNA-03 | Category seed (6 initial: MAP_TEST_LOGISTICS, etc.) | seed | C01-C06 |
| QNA-04 | Threading (parent_id, root_id denormalized) | service | T01-T05 |
| QNA-05 | Per-student junction (group student support) | service | — |
| QNA-06 | Tone transformation helper (emoji/greeting/closing) | client component | P01-P06 |
| QNA-07 | Full-text search (PostgreSQL `tsvector`) | search endpoint | S01-S10 |
| QNA-08 | FAQ promotion (team-lead+, status=RESOLVED only) | guarded endpoint | F01-F08, BR-QNA-002/003 |
| QNA-09 | Cross-module attach (`qna_related_*_id`) | service + UI | X01-X05 |
| QNA-10 | UNSATISFIED escalation prompt | UI workflow | BR-QNA-011 |
| QNA-11 | List / detail / timeline / FAQ browser pages | React pages | — |
| QNA-12 | Migration (1035 → ~83 active, drop empty, thread reconstruction) | CLI `qna:migrate` | MG01-MG13, Q-004 |
| QNA-13 | Auto-categorization heuristic (keyword) + manual review queue | importer logic | — |
| QNA-14 | Tests | Jest | — |

### 4.3 Cross-Cutting Tasks (공통 작업)

| Task ID | Task | Owner | Sprint |
|---|---|---|---|
| X-01 | i18n: extract all strings, ko/en/vi locale files | Frontend | Continuous |
| X-02 | RBAC mapping (AMB roles → ACM permissions) | Backend | S1, refined S4/S6/S8 |
| X-03 | AMB Issue API client (used by CSL/DSH for SLA) | Backend | S4 |
| X-04 | Audit logging (all CSL/QNA CRUD via interceptor) | Backend | S2 |
| X-05 | Performance test — DSH monthly aggregate < 2s (NFR-003) | QA | S10 |
| X-06 | Migration data quality dashboard (counts/queues across modules) | Frontend | S9 |
| X-07 | UAT scripts per role (advisor / team-lead / senior-manager / admin) | PO + QA | S10 |

---

## 5. Migration Plan (마이그레이션 계획)

Aligned with `ACM-REQ-001 §7.2`. v1.0a covers M-0 ~ M-4.

| Phase | Timing | Owner | Activity | Expected Output |
|---|---|---|---|---|
| M-0 | S0 (W0) | Amoeba Platform | Custom App registration; TPI Entity provision | ent_id; 6 users seeded |
| M-1 | S6 (W6) | Dev + 김태윤 | REF + SCH master data + R&R → AMB Units | ~13 guidelines + ~35 benchmarks + 41 schools |
| M-2 | S5 (W5) | Dev + 어드바이저 | CSL bulk import + manual review | ~140 rows + 5-10 in review queue |
| M-3 | S9 (W9) | Dev + 정성경 | QNA cleansing + threading | ~83 active + 5-10 ambiguous |
| M-4 | S0/S11 (W0+W11) | Dev + 김태윤 | Tasks (Section B) → AMB Core Issue (historical) | ~85 issues with `source:acm-migration` label |
| M-10 | S11 (W11) onward | All | Parallel operation (xlsx + ACM) — minimum 1 month | — |
| M-11 | Post v1.0a | All | Cut-over — xlsx archived read-only | — |

### 5.1 Migration Quality Gate (마이그레이션 품질 게이트)

| Gate | Criterion | Action if fail |
|---|---|---|
| G-1 | CSL: 100% of 25 fields populated for activated rows | Manual review queue blocks cut-over |
| G-2 | DSH: status metrics (# of St., # of Tc.) match xlsx INDEX last-day values exactly | Reconcile w/ team-lead |
| G-3 | REF: `findBenchmark()` returns deterministic result for any (exam, grade, date) tuple in 2025-2026 range | Add missing rows |
| G-4 | QNA: zero rows missing both question AND response | Drop them per Q-004 |
| G-5 | SCH: all 7 인가 schools have ≥ 1 grade-band; all 11 비인가 have schedule note | Fill via 김태윤 |

---

## 6. UI Layout Mockups (화면 구성안)

> ASCII wireframes — primary screen per module (Detail/Edit views in `ACM-UI-{module}-001` follow-up docs).

### 6.1 CSL — Counseling List (신규상담 목록)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AMB ▸ ACM ▸ Counseling (신규상담)                          [+ 신규 등록] [Export]│
├──────────────────────────────────────────────────────────────────────────────────┤
│  Filters: [등록일: 2026-04-01 ~ 04-26 ▾] [유입: All ▾] [목적: All ▾]             │
│           [단계: All ▾] [담당자: All ▾] [SLA: ⚠ 초과 only ☐]   [🔍 검색...]      │
├──────────────────────────────────────────────────────────────────────────────────┤
│  □│등록일      │이름     │유입  │목적     │단계         │담당   │SLA│비고    │ … │
│  ─┼───────────┼─────────┼──────┼─────────┼─────────────┼───────┼───┼────────┤   │
│  □│2026-04-25 │김XX     │홈피  │MAP점수  │MAP_TEST     │정성경 │   │        │   │
│  □│2026-04-24 │이XX     │카톡  │GPA      │INTAKE       │어드바 │ ⚠ │        │   │
│  □│2026-04-23 │unknown  │카톡  │외국학교 │TRIAL_CLASS  │김태윤 │   │annon.  │   │
│  □│2026-04-22 │박XX     │전화  │보딩     │ENROLLMENT   │김태윤 │   │        │   │
│  …                                                                               │
│  [컬럼 표시 설정: ⚙ 13 of 25 active]              ◀ 1 2 3 4 5 ▶  Total 140      │
└──────────────────────────────────────────────────────────────────────────────────┘
                                                                                    
Side-panel actions: [선택 행 → 단계 일괄 변경] [선택 행 → 담당자 재배정]            
```

### 6.2 DSH — Daily KPI Dashboard (대시보드)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AMB ▸ ACM ▸ Dashboard                  Month: [2026-04 ▾]   ⓘ 진행 중 (April)   │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Marketing ──┐ ┌── CS ──────────────┐ ┌── Operating ────────┐ ┌── Class ───┐│
│  │ Visitor 1,234│ │ Counsel  18  Apply 5│ │ NewSt  4  OutSt  1  │ │ MAP   12   ││
│  │ Cost   180k │ │ Begin     3  Miss  2│ │ #St 26  NewTc 0     │ │ Class 84   ││
│  │ Effect 6.85 │ │ Trial     7  Compl 1│ │ OutTc 0  #Tc 5      │ │ Stu 23 Tc 5││
│  └─────────────┘ └────────────────────┘ └─────────────────────┘ └────────────┘│
├──────────────────────────────────────────────────────────────────────────────────┤
│  Day│요일│Visitor│Cost  │Eff │Counsel│Apply│Begin│Miss│Trial│Compl│NewSt│… │MAP  │
│  ───┼────┼───────┼──────┼────┼───────┼─────┼─────┼────┼─────┼─────┼─────┼──┼─────│
│   1 │수  │   42  │ 6,000│7.0 │   1   │  0  │  0  │  0 │  0  │  0  │  0  │…│  1  │
│   2 │목  │   38  │ 6,000│6.3 │   2   │  1  │  0  │  0 │  1  │  0  │  1  │…│  0  │
│   3 │금  │   55  │ 8,000│6.9 │   0   │  0  │  0  │  0 │  0  │  0  │  0  │…│  0  │
│   ⋮ │ ⋮  │       │      │    │       │     │     │    │     │     │     │  │     │
│  16 │금  │   29  │ 5,000│5.8 │   1   │  0  │  0  │  1 │  0  │  1  │  0  │…│  0  │
│  17 │토  │  ─    │  ─   │ ─  │       │     │     │    │     │     │     │  │     │← STALE
│  ───┼────┼───────┼──────┼────┼───────┼─────┼─────┼────┼─────┼─────┼─────┼──┼─────│
│  Sum│    │ 1,234 │180,00│ —  │  18   │  5  │  3  │  2 │  7  │  1  │  4  │…│ 12  │
│  Avg│    │   77  │11,250│6.4 │  1.1  │ 0.3 │ 0.2 │ 0.1│ 0.4 │ 0.1 │ 0.3 │…│ 0.8 │
│                                                                                  │
│  [Marketing 입력 ✏]  [Complaint 등록 ⚠]      Last recompute: 2026-04-26 03:01    │
└──────────────────────────────────────────────────────────────────────────────────┘
                                                                                    
* 메트릭 셀 클릭 → 드릴다운 (해당 일자 CSL/CLS 레코드 필터 목록)                    
* "# of St." 행 합계는 31일 마지막 값 (status snapshot, 누적합 X)                  
```

### 6.3 SCH — School Admission Browse (학교 입학 정보)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AMB ▸ ACM ▸ School Admission                              [+ 신규 등록]         │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Filter:  [구분: 인가 ☑ 비인가 ☑]  [정시 ☑ 수시 ☑ 혼합 ☑ 미정 ☐]  [🔍...]        │
├──────────────────────────────────────────────────────────────────────────────────┤
│   📚 인가 학교 (Authorized) — 7                                                  │
│   ┌──────────────────────────────────────────────────────────────────┐          │
│   │ 채드윅 송도   ▸  G1-G5 │ G6-G8 │ G9-G12     수시  Open 5/15 ~ 6/30 │          │
│   │ 덜위치 서울   ▸  G1-G5 │ G6-G8                정시  마감 11/30      │          │
│   │ NLCS 제주     ▸  G1-G6 │ G7-G12               혼합  TBA              │          │
│   │ ⋮                                                                 │          │
│   └──────────────────────────────────────────────────────────────────┘          │
│   🏫 비인가 학교 (Unauthorized) — 11+                                            │
│   ┌──────────────────────────────────────────────────────────────────┐          │
│   │ 학교명          │ 정시/수시 │ 일정 비고             │ Q&A     │          │   │
│   │ 학교 A          │ ROLLING   │ 연중 (note)           │ 3 건    │          │   │
│   │ 학교 B          │ 미정      │ 학기 시작 전 문의     │ 1 건    │          │   │
│   │ ⋮                                                                 │          │
│   └──────────────────────────────────────────────────────────────────┘          │
│                                                                                  │
│  ⓘ Q&A 링크 클릭 → QNA 모듈에서 해당 학교 관련 Q&A 표시 (cross-module)           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 REF — Score Benchmark Matrix (참조자료 — 합격선 매트릭스)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AMB ▸ ACM ▸ Reference ▸ Score Benchmarks       [Effective: 2026-04-26 ▾] [편집]│
├──────────────────────────────────────────────────────────────────────────────────┤
│  Tab: ( MAP )  ( ISEE )  ( SSAT )                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  MAP — NWEA RIT Score (NeST 합격선)                                      │    │
│  │  Grade │ Reading 합격선 │ Math 합격선 │ Note                              │    │
│  │  ──────┼────────────────┼──────────────┼──────────────────────────────── │    │
│  │  G1    │     180        │     185      │                                 │    │
│  │  G2    │     190        │     195      │                                 │    │
│  │  ⋮     │     ⋮          │      ⋮       │                                 │    │
│  │  G8    │     225        │     235      │                                 │    │
│  │  G9    │  X 이상 235    │  X 이상 245  │ no-upper-bound                  │    │
│  │  G10   │  X 이상 240    │  X 이상 250  │ no-upper-bound                  │    │
│  │  G11   │     ─          │      ─       │ ⚠ 미설정 (placeholder)          │    │
│  │  G12   │     ─          │      ─       │ ⚠ 미설정                         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│  Modifiers (수정자):  🏷 외국인학교 +5 ~ +7점 (POINTS)                            │
│                                                                                  │
│  ⓘ CSL F-13 MAP 점수 입력 시 이 매트릭스 자동 조회 → 갭 분석 inline 표시         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 QNA — Q&A List + Detail (정기상담)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  AMB ▸ ACM ▸ Q&A (정기상담)                    [+ 신규 Q&A] [FAQ 브라우저]      │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Filter: [카테고리 ▾] [학생 ▾] [상태: All ☑]  [FAQ ☐]  [🔍 전문검색...]          │
├──────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┬──────────────────────────────────────────────────┐    │
│  │ 목록 (83 active)    │ 상세 — Q&A #042                                   │    │
│  │                     │ ───────────────────────────────────────────────── │    │
│  │ ▸ #042 김XX (MAP)   │ 학생: 김XX (G5)         카테고리: MAP_TEST_LOG   │    │
│  │ ▸ #041 박XX (학교)  │ 등록: 2026-04-22 정성경                          │    │
│  │ ▸ #040 일반 Q&A     │ ───────────────────────────────────────────────── │    │
│  │ ▸ #039 김XX (수업)  │ 질문 (Q):                                         │    │
│  │ ▸ #038 ⋮            │   "MAP 시험 점수가 합격선보다 낮은데 어떻게…"     │    │
│  │   (thread #042-1)   │ ───────────────────────────────────────────────── │    │
│  │ ▸ #037 ⋮            │ 내부 응답 (A — internal):                         │    │
│  │ ⋮                   │   "현재 R210/M215, G5 합격선 R225/M230. 갭 15/15"│    │
│  │                     │ ───────────────────────────────────────────────── │    │
│  │                     │ 외부 응답 (학부모용 polished):     [Tone 변환 ✨] │    │
│  │                     │   "안녕하세요 어머니 😊 OO 학생의 현재 MAP …"     │    │
│  │                     │   상태: EXTERNAL_READY  [학부모에게 전송 →]      │    │
│  │                     │ ───────────────────────────────────────────────── │    │
│  │                     │ Cross-ref: 🔗 학교: 채드윅 송도  🔗 CSL #102     │    │
│  │                     │            🔗 REF: MAP G5 벤치마크                │    │
│  │                     │ [⭐ FAQ로 승격 (team-lead+)]  [⚠ Unsatisfied]    │    │
│  └─────────────────────┴──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Effort & Resourcing (공수 및 인력)

### 7.1 Effort Estimate (Person-Weeks)

| Module | BE | FE | QA | PO/Domain | Total |
|---|---|---|---|---|---|
| Foundation | 1.0 | 0.5 | — | — | 1.5 |
| CSL | 2.5 | 1.5 | 0.5 | 0.5 | 5.0 |
| DSH | 1.0 | 1.0 | 0.25 | 0.25 | 2.5 |
| SCH | 0.75 | 0.75 | 0.25 | 0.25 | 2.0 |
| REF | 0.75 | 0.5 | 0.25 | 0.25 | 1.75 |
| QNA | 0.75 | 0.75 | 0.25 | 0.25 | 2.0 |
| Cross-cutting (i18n, RBAC, perf, UAT) | 0.5 | 0.5 | 0.5 | 0.25 | 1.75 |
| **Total** | **7.25** | **5.5** | **2.0** | **1.75** | **16.5 PW** |

> Allocated to 11 calendar weeks via 2 BE + 1 FE + 0.5 QA + 0.25 PO concurrent work.

### 7.2 Team

| Role | Person | Allocation |
|---|---|---|
| PO / Domain | 김태윤 팀장 | 25% |
| Backend | TBA × 2 | 100% |
| Frontend | TBA × 1 | 100% |
| QA | TBA × 0.5 | 50% |
| Domain UAT | 정성경, 배예리, 어드바이저 | as needed |

---

## 8. Risks & Mitigations (리스크 및 대응)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-P01 | Q-ACM-001/002/003/006 미해결로 S0 지연 | High | High | W-1주차 PO가 Amoeba Platform 협의 사전 착수 |
| R-P02 | CSL 25 필드 마이그레이션 ambiguous 행 과다 | High | Medium | 수동 검토 큐 UI를 S2에 우선 구현 (CSL-21) |
| R-P03 | DSH 메트릭 정의 해석 차이 (status vs count) | Medium | High | M-1 전 PO 검수 체크포인트 (Sum 계산 룰 BR-DSH-003) |
| R-P04 | REF 벤치마크 placeholder/inherited 행 운영 혼선 | Medium | Medium | UI 명시 뱃지 + 가이드 문서; CSL 갭분석 시 graceful 메시지 |
| R-P05 | QNA 1035→83 마이그레이션 정확도 | High | Medium | M-3에서 정성경 수동 검토 1주 버퍼 |
| R-P06 | i18n (en/vi) 번역 리소스 지연 | Medium | Low | ko-only 출시 허용 (NFR-016 점진 적용) |
| R-P07 | 멀티테넌시 누락 (ent_id 미적용 endpoint) | Low | Critical | OwnEntityGuard 글로벌 + lint 룰; PR 체크리스트 |
| R-P08 | 평행 운영 1개월 동안 데이터 이중 입력 부담 | High | Medium | 모듈별 xlsx 익스포트 (FR-DSH-011 등) 우선 보장 |

---

## 9. Acceptance Criteria for v1.0a Cut-Over (v1.0a 완료 기준)

| ID | Criterion | Verification |
|---|---|---|
| AC-01 | 5 modules deployed to TPI Entity | URL access by PO |
| AC-02 | 140 CSL rows + 132 DSH rows + ~83 QNA rows + 41 SCH + ~13 REF guidelines migrated | DB count = expected ± 5% |
| AC-03 | NFR-002 met (p95 < 200ms read, < 500ms write) | Load test report |
| AC-04 | NFR-003 met (DSH monthly < 2s) | Perf test |
| AC-05 | OwnEntityGuard prevents cross-tenant leak | Pen test (separate test entity) |
| AC-06 | All CSL/QNA CRUD audit-logged | Sample audit query |
| AC-07 | UAT signed by 김태윤, 정성경, 배예리 | UAT report |
| AC-08 | 1 month parallel operation completed without data divergence > 2% | Reconciliation report |
| AC-09 | xlsx export available per module | Manual test |
| AC-10 | i18n (ko) covers 100% UI strings (en/vi 80%+) | Translation coverage report |

---

## 10. Document Traceability (문서 추적성)

```
ACM-PLAN-001 (this document)
  ├─ Stage 1 (Analysis):
  │   ├─ ACM-REQ-001 v3.0
  │   ├─ ACM-REQ-CSL-001 v2.1
  │   ├─ ACM-REQ-DSH-001 v1.0
  │   ├─ ACM-REQ-SCH-001 v1.0
  │   ├─ ACM-REQ-REF-001 v1.0
  │   └─ ACM-REQ-QNA-001 v1.0
  │
  ├─ Stage 2 (Design — to author next per PO go-ahead):
  │   ├─ ACM-ERD-001 (covering amb_acm_* across 5 modules — 22 tables)
  │   ├─ ACM-FN-CSL-001 / DSH-001 / SCH-001 / REF-001 / QNA-001
  │   ├─ ACM-SEQ-* (CSL→REF, CSL→DSH, CSL→AMB Issue)
  │   └─ ACM-UI-{module}-001 (HTML mockups in docs/design/screens/)
  │
  ├─ Stage 3 (Implementation):
  │   ├─ ACM-WBS-001 (Sprint-by-sprint task tracker — derived from §4.2)
  │   └─ Per-task plans: docs/implementation/tasks/acm-{module}-task-{n}-plan.md
  │
  └─ Stage 4-5 (Test):
      ├─ ACM-TC-{module}-001
      └─ ACM-TR-001 (final test report)
```

---

## 11. Approval (승인)

| Role | Name | Status | Date |
|---|---|---|---|
| Product Owner | 김태윤 팀장 | Pending review | — |
| Project Sponsor | 최지용 (CEO) | Pending | — |
| Senior Manager | 배예리 수석팀장 | Pending | — |
| Operations Lead | 정성경 팀장 | Pending | — |
| Amoeba Platform Lead | TBA | Pending Q-ACM-001/002/003/006 | — |

---

**End of Document (문서 끝)**

> 본 작업계획서는 PO 검토 및 명시적 진행 지시 후 Stage 2 (설계) 및 Stage 3 (구현)로 진행한다.
> Per project workflow rule, this work plan requires PO review and explicit "proceed" instruction before Stage 2 (design) and Stage 3 (implementation) begin.
