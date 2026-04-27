---
document_id: ACM-REQ-DSH-001
version: 1.0.0
status: Draft
created: 2026-04-26
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
parent_document: ACM-REQ-001 v3.0 (Academy Management Custom App — Requirements Analysis)
adr_documents:
  - TPI-ADR-001 (Architecture Decision Record)
  - TPI-ADR-001-A1 (CLS Module Decisions Addendum)
related_documents:
  - ACM-REQ-CSL-001 v2.1 (Counseling — primary data feed)
  - ACM-REQ-CLS-001 v1.0 (Class Management — primary data feed)
  - ACM-REQ-SCH-001 v1.0 (School Admission — secondary data feed)
  - ACM-REQ-REF-001 v1.0 (Reference Materials — secondary data feed)
  - ACM-REQ-QNA-001 v1.0 (Q&A — secondary data feed)
product_code: ACM
module_code: DSH
db_table_prefix: amb_acm_dsh_
source_data: TPI_Master.xlsx › INDEX sheet (1002 rows × 27 cols; 132 active rows; 5 months 2025.12 ~ 2026.4)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial draft for Dashboard module deep-dive — aggregates KPIs across 5 modules + manual-input marketing/complaint metrics; 21-metric daily grid replicates INDEX sheet exactly (대시보드 모듈 심층 분석 초안 — 5개 모듈 KPI 집계 + Marketing/불만 수동 입력; 21개 일별 메트릭 INDEX 시트 정확 복제)
---

# DSH — Dashboard Module Requirements Analysis (대시보드 모듈 요구사항 분석서)

> Module-level deep-dive for **DSH** module of the Academy Management Custom App. DSH is **not a primary data owner** but an **aggregation and visualization layer** that consumes data from CSL, CLS, SCH, REF, QNA modules plus a small set of manually-input metrics (Marketing data from external platforms, customer complaints).
> 학원관리앱(ACM) **DSH** 모듈 심화 분석서. DSH는 **1차 데이터 소유자가 아닌** CSL/CLS/SCH/REF/QNA의 데이터 + 소수의 수동 입력 메트릭(Marketing 외부 플랫폼 데이터, 불만 사례)을 소비하는 **집계 및 시각화 계층**이다.

---

## 1. Module Overview (모듈 개요)

### 1.1 Purpose (목적)

The DSH (Dashboard) module replaces the `INDEX` sheet in `TPI_Master.xlsx` with an automated, real-time dashboard. It aggregates 21 daily KPIs across 4 categories (Marketing, CS, Operating, Class) into a single view that mirrors the INDEX sheet structure exactly — preserving stakeholder familiarity while eliminating manual aggregation.

DSH 모듈은 `TPI_Master.xlsx`의 `INDEX` 시트를 자동화된 실시간 대시보드로 대체한다. 4개 카테고리(Marketing, CS, Operating, Class)에 걸친 21개 일별 KPI를 INDEX 시트 구조와 정확히 일치하는 단일 뷰로 집계하여, 이해관계자 친숙도를 유지하면서 수동 집계를 제거한다.

### 1.2 Distinction from Other Modules (다른 모듈과의 차별점)

DSH is fundamentally different from CSL/CLS/SCH/REF/QNA:

| Aspect | Other Modules | DSH |
|---|---|---|
| Data ownership | Primary owner of business data | Mostly consumer; small-set primary owner for manual inputs |
| Source data | Actual business records (inquiries, classes, etc.) | INDEX sheet historical values + module aggregates going forward |
| Migration | Bulk import of records | INDEX historical values for reference; live data sourced from other modules from cut-over |
| Storage | Normalized tables with full history | Aggregation cache + small input tables |
| Primary user action | Create/Edit records | View, drill-down, export |

### 1.3 Scope (범위)

| Item (항목) | Detail (상세) |
|---|---|
| Source sheet (원천 시트) | `INDEX` (1002 rows × 27 cols) |
| Active rows (활성 행) | **132 rows** (5 months: 2025.12 ~ 2026.4) — verified by analysis |
| Daily metrics (일별 메트릭) | **21 metrics** across 4 categories (§1.4) |
| Aggregation rows (집계 행) | Per-month: Sum + Aver. rows |
| Primary users | Senior managers (배예리), team leads (정성경 / 김태윤), CEO (최지용) |
| Update frequency | Real-time for module-derived; daily for manually-input; daily batch refresh of caches |
| Sub-phase | v1.0a (existing 5 modules' aggregations) + v1.0b (CLS metrics now real data) |

### 1.4 21 Metric Inventory — From INDEX Sheet (21개 메트릭 목록)

The header row R2 of INDEX defines exactly these columns (verified by direct sheet analysis):

| Cat | Col | Metric Name | Source / Computation |
|---|---|---|---|
| Day | C1 | **Day** | Day-of-month (1-31) |
| Day | C2 | **MS** (요일) | Day-of-week label (월/화/수/목/금/토/일) |
| **Marketing** | C3 | **Visitor** | Manual input — homepage visitor count from external analytics |
| Marketing | C4 | **Cost** | Manual input — daily ad spend (KRW) from Naver/Google ads platforms |
| Marketing | C5 | **Effect** | Manual input — observed daily ad effect (clicks/conversions; meaning per Q-DSH-001) |
| **CS** | C6 | **Counseling** | Auto from CSL — count of `inq_registered_at = day` |
| CS | C7 | **Apply** | Auto from CSL — count of CSL records with `enr_applied=TRUE` AND application date = day |
| CS | C8 | **Beginning** | Auto from CSL — count of `cls_started_at = day` (CSL F-23 / `inq_current_stage` transitioned to CLASS_STARTED on this day) |
| CS | C9 | **Missing** | Auto from CSL — count of stage transitions to DROPPED with reason indicating no-response on this day |
| CS | C10 | **Trial Class** | Auto from CSL — count of `tcl_held_at = day` |
| CS | C11 | **Complain** | Manual input — customer complaints recorded that day (with optional link to QNA `qna_resolution_status=UNSATISFIED`) |
| **Operating** | C12 | **New St.** | Auto from CLS — count of new students added (cst_enrolled_at = day) |
| Operating | C13 | **Out St.** | Auto from CLS — count of students leaving (cst_left_at = day) |
| Operating | C14 | **# of St.** (status) | Auto from CLS — distinct active students at day-end (`COUNT DISTINCT cst_student_user_id WHERE cst_left_at IS NULL OR cst_left_at > day`) |
| Operating | C15 | **New Tc.** | Auto — new teacher added (created_at = day for `amb_users` with `teacher` role) |
| Operating | C16 | **Out Tc.** | Auto — teacher left (typically tracked in AMB user lifecycle) |
| Operating | C17 | **# of Tc.** (status) | Auto — distinct active teachers at day-end |
| **Class** | C18 | **Map Test** | Auto from CSL — count of `mpt_scheduled_at = day` (or `mpt_taken_at`; see Q-DSH-002) |
| Class | C19 | **Tt. Class** | Auto from CLS — count of `cls_sessions WHERE ses_held_at::date = day AND ses_status=HELD` (or sum of attended hours; see Q-DSH-003) |
| Class | C20 | **Student** | Auto from CLS — distinct students in HELD sessions on day |
| Class | C21 | **Teacher** | Auto from CLS — distinct teachers with HELD sessions on day |

> **Status vs Count distinction (§1.4 critical insight):** Metrics like `# of St.` and `# of Tc.` represent **state at day-end**, not day-count. Monthly Sum row therefore shows the **last day's value**, not arithmetic sum. This is verified in source — R36 (1월 Sum) shows C14=26 which equals R35 (Jan 31) C14=26, NOT a monthly sum.
> **상태 vs 카운트 구분 — 핵심 통찰:** `# of St.`, `# of Tc.` 같은 메트릭은 **그 날의 상태값**이며, 월간 Sum 행은 **마지막 일자 값**(누적 합계 X). R36의 C14=26은 31일 합계가 아닌 1월 31일 시점 값.

### 1.5 Source Data Findings (원천 데이터 발견)

| # | Finding (발견) | Implication for DSH |
|---|---|---|
| 1 | 5 months of operational data observed (2025.12 ~ 2026.4) | Sufficient seed for YoY/MoM comparison (FR-DSH-010) once 12 months accumulate |
| 2 | April (R101-R116) shows **work-in-progress** state — only 16 days entered, R117+ empty, but R131 Sum row already populated (with partial values) | DSH must support partial-month views and clearly indicate "data through day N" |
| 3 | Day-1 (R5) has **Effect=0** even though Visitor=25, Cost=5335 — Effect is NOT computed from Visitor/Cost | Effect is independent manual input (Q-DSH-001) |
| 4 | R34-R35 (Jan 30-31) **C5 Effect column empty** but counseling data populated | Marketing data input lags or is incomplete some days |
| 5 | R109+ (Mar 9 onward) **C3 Visitor and C4 Cost both empty** | Marketing data entry lapsed Mar onward — operational concern |
| 6 | Numbers stored as `1.0`, `5335.0` etc. (Excel float) for integers | Migration converts to INT properly |
| 7 | Group student attendance — one CLS session may have 2-3 students (sibling pairs); `Student` metric is DISTINCT, not sum-of-attendance-rows | Aggregation must use COUNT DISTINCT |
| 8 | Sum row sometimes truncates trailing zeros (e.g. R36 C7:16 vs source which had 16.0) | Cosmetic; not a data issue |
| 9 | "Aver." row C12 (Operating column) is sparse — only some columns averaged | Aver. is **selective** — NOT all metrics get an average; only volume metrics make sense to average |
| 10 | INDEX sheet has annotation/formula in C1 R3 ("12월") — month label as first cell | Schema needs distinct row types: DAY (1-31), SUM (month label "1월"/"Sum"), AVERAGE ("Aver.") |

### 1.6 Aggregation Logic — Selective Per Metric (메트릭별 차등 집계 로직)

Direct observation from source: not all metrics support both Sum and Average meaningfully. The DSH module formalizes this:

| Metric Type | Sum Behavior | Average Behavior | Examples |
|---|---|---|---|
| **Volume Count** (event-based) | Sum = arithmetic sum across days | Aver. = sum / day count | Visitor, Cost, Counseling, Apply, Beginning, Missing, Trial Class, Complain, Map Test, Tt. Class |
| **Status Snapshot** (state-based) | Sum = last day's value | Aver. = (no meaningful average) — display blank or "—" | # of St., # of Tc. |
| **Daily Distinct** (count of unique entities) | Sum = sum across days (NOT distinct over month — that would require separate computation) | Aver. = sum / day count | Student, Teacher (per-day distinct, summed) |
| **Computed** (no direct sum) | (per-day computed) | (per-day computed) | Effect — per Q-DSH-001 |
| **Net Delta** | Sum = arithmetic sum | Aver. = sum / day count | New St., Out St., New Tc., Out Tc. |

This taxonomy is captured in the metric definition (§2.4) as `met_aggregation_type` ENUM.

---

## 2. Domain Model (도메인 모델)

### 2.1 Schema Overview (스키마 개요)

DSH uses **4 tables** — minimal data ownership, mostly aggregation cache:

| Table | Purpose |
|---|---|
| `amb_acm_dsh_metric_definitions` | Metric registry (21 metric defs + future expansions) |
| `amb_acm_dsh_daily_kpi` | Daily KPI snapshot (1 row per day per Entity); cache table populated by daily batch |
| `amb_acm_dsh_manual_inputs` | Manual-input metrics (Marketing Visitor/Cost/Effect, Complain) |
| `amb_acm_dsh_complaints` | Detailed complaint log feeding `Complain` metric (sub-domain expansion) |

### 2.2 Daily KPI Cache (`amb_acm_dsh_daily_kpi`)

The core table — one row per (Entity, day). Materialized via daily batch + on-demand recompute.

```
amb_acm_dsh_daily_kpi
  ├── identity
  │   ├── dkp_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   ├── dkp_date          : DATE
  │   └── (UK: ent_id + dkp_date)
  │
  ├── derived day attributes (파생 일자 속성)
  │   ├── dkp_year_month    : VARCHAR(7) (YYYY-MM, indexed for monthly aggregation)
  │   ├── dkp_day_of_month  : INT (1-31)
  │   ├── dkp_day_of_week   : ENUM (MON | TUE | WED | THU | FRI | SAT | SUN)
  │   └── dkp_day_of_week_kr : VARCHAR(2) (월/화/수/목/금/토/일 — for direct UI use)
  │
  ├── Marketing metrics (manual-input — sourced from amb_acm_dsh_manual_inputs, copied here for query simplicity)
  │   ├── dkp_marketing_visitor : INT
  │   ├── dkp_marketing_cost    : DECIMAL(10,0) (KRW)
  │   └── dkp_marketing_effect  : INT
  │
  ├── CS metrics (auto from CSL + manual)
  │   ├── dkp_cs_counseling     : INT
  │   ├── dkp_cs_apply          : INT
  │   ├── dkp_cs_beginning      : INT
  │   ├── dkp_cs_missing        : INT
  │   ├── dkp_cs_trial_class    : INT
  │   └── dkp_cs_complain       : INT (manual)
  │
  ├── Operating metrics (auto from CLS + AMB users)
  │   ├── dkp_ops_new_st        : INT
  │   ├── dkp_ops_out_st        : INT
  │   ├── dkp_ops_count_st      : INT (status — at day-end)
  │   ├── dkp_ops_new_tc        : INT
  │   ├── dkp_ops_out_tc        : INT
  │   └── dkp_ops_count_tc      : INT (status — at day-end)
  │
  ├── Class metrics (auto from CSL + CLS)
  │   ├── dkp_class_map_test    : INT
  │   ├── dkp_class_tt_class    : DECIMAL(5,1) (allows half-class hours per source observation)
  │   ├── dkp_class_student     : INT (distinct on day)
  │   └── dkp_class_teacher     : INT (distinct on day)
  │
  ├── computation metadata (계산 메타)
  │   ├── dkp_computed_at       : TIMESTAMP (last refresh)
  │   ├── dkp_computation_status: ENUM (FRESH | STALE | RECOMPUTING | FAILED)
  │   ├── dkp_data_completeness : ENUM (COMPLETE | PARTIAL_PENDING_MANUAL | PARTIAL_FUTURE)
  │   │     -- COMPLETE: all 21 metrics populated
  │   │     -- PARTIAL_PENDING_MANUAL: auto-metrics done; manual inputs (marketing/complain) missing
  │   │     -- PARTIAL_FUTURE: day is in future or current day with day not yet over
  │   └── dkp_source_versions   : JSONB
  │         -- e.g. { "csl_max_id": "...", "cls_max_session_id": "..." }
  │         -- used for staleness detection
  │
  └── audit
      ├── dkp_created_at, dkp_updated_at
      └── dkp_last_recompute_reason : VARCHAR(100) (e.g. "daily_batch", "csl_event", "manual_refresh")
```

> **Why a cache table instead of computed view:** (a) 21-metric query against 5+ source tables would be expensive at 50+ concurrent dashboard loads; (b) historical days are immutable except for backfill — caching is safe; (c) chart rendering across months needs sub-second response.
> 캐시 테이블 사용 이유 — 동시 대시보드 로드, 과거 일자 불변, 차트 응답 속도.

### 2.3 Manual Input Records (`amb_acm_dsh_manual_inputs`)

Source of truth for the 4 manually-input metrics. The `daily_kpi` table copies from here.

```
amb_acm_dsh_manual_inputs
  ├── identity
  │   ├── min_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   ├── min_date          : DATE
  │   └── (UK: ent_id + min_date)
  │
  ├── values
  │   ├── min_marketing_visitor : INT (nullable)
  │   ├── min_marketing_cost    : DECIMAL(10,0) (nullable)
  │   ├── min_marketing_effect  : INT (nullable)
  │   └── min_cs_complain       : INT (nullable; mirrors complaint count for the day)
  │
  ├── input metadata
  │   ├── min_input_status      : ENUM (PENDING | PARTIAL | COMPLETE)
  │   ├── min_visitor_source    : VARCHAR(100) (e.g. "Naver Analytics", "Google Analytics") nullable
  │   ├── min_cost_source       : VARCHAR(100) (e.g. "Naver Ads", "Google Ads") nullable
  │   └── min_input_note        : TEXT (nullable)
  │
  └── audit
      ├── min_input_by         : UUID FK → amb_users
      ├── min_input_at         : TIMESTAMP
      ├── min_updated_at, min_deleted_at
```

> Marketing data is currently entered by 디자인 담당 (per AS-IS R&R). Once `ACM-MKT` Custom App is built, this table may be deprecated in favor of MKT auto-feed. v1.0 keeps as manual input.
> Marketing 데이터는 현재 디자인 담당이 입력. ACM-MKT 별도 Custom App 도입 후 자동 피드로 대체. v1.0은 수동.

### 2.4 Metric Definitions (`amb_acm_dsh_metric_definitions`)

Registry of all metrics — drives UI rendering and aggregation logic. Seed with 21 metrics; extensible.

```
amb_acm_dsh_metric_definitions
  ├── met_id              : UUID PK
  ├── ent_id              : UUID FK (per-Entity to allow customization)
  ├── met_code            : VARCHAR(50) UK per ent
  │     (e.g. "MKT_VISITOR", "CS_COUNSELING", "OPS_COUNT_ST", "CLS_MAP_TEST")
  ├── met_category        : ENUM (MARKETING | CS | OPERATING | CLASS)
  ├── met_label_kr        : VARCHAR(50)
  ├── met_label_en        : VARCHAR(50)
  ├── met_aggregation_type : ENUM (VOLUME_COUNT | STATUS_SNAPSHOT | DAILY_DISTINCT | NET_DELTA | COMPUTED)
  ├── met_data_source     : ENUM (MANUAL | CSL | CLS | SCH | REF | QNA | AMB_USERS | EXTERNAL)
  ├── met_source_query_template : TEXT (parameterized SQL or query plan reference; null for MANUAL)
  ├── met_unit            : VARCHAR(20) (e.g. "건", "명", "원", "%")
  ├── met_format          : VARCHAR(50) (e.g. "INT", "DECIMAL(5,1)", "CURRENCY_KRW", "PERCENT_2DP")
  ├── met_display_order_in_category : INT
  ├── met_dashboard_visible : BOOLEAN (default TRUE)
  ├── met_supports_drill_down : BOOLEAN (TRUE if click reveals source records)
  └── met_active          : BOOLEAN
```

### 2.5 Complaint Detail Log (`amb_acm_dsh_complaints`)

Backs the `Complain` metric with structured records (rather than just a count). Useful for trend analysis and root cause discovery.

```
amb_acm_dsh_complaints
  ├── identity
  │   ├── cmp_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   └── cmp_logged_at     : TIMESTAMP
  │
  ├── source linkage
  │   ├── cmp_student_user_id : UUID FK (nullable)
  │   ├── cmp_qna_id        : UUID FK → amb_acm_qna_records (nullable; if originated from QNA)
  │   ├── cmp_class_id      : UUID FK → amb_acm_cls_classes (nullable; if class-related)
  │   └── cmp_inquiry_id    : UUID FK → amb_acm_csl_inquiries (nullable; if CSL-related)
  │
  ├── content
  │   ├── cmp_category      : ENUM (INSTRUCTOR | SCHEDULING | PAYMENT | CONTENT_QUALITY | COMMUNICATION | OTHER)
  │   ├── cmp_severity      : ENUM (LOW | MEDIUM | HIGH | CRITICAL)
  │   ├── cmp_description   : TEXT
  │   └── cmp_resolution    : TEXT (nullable; how it was addressed)
  │
  ├── workflow
  │   ├── cmp_status        : ENUM (LOGGED | INVESTIGATING | RESOLVED | UNRESOLVED)
  │   ├── cmp_resolved_at   : TIMESTAMP (nullable)
  │   └── cmp_resolved_by   : UUID FK (nullable)
  │
  └── audit
      ├── cmp_logged_by, cmp_created_at, cmp_updated_at, cmp_deleted_at
```

The `dkp_cs_complain` count is derived: `COUNT(cmp_id WHERE cmp_logged_at::date = day)`.

---

## 3. Field Specifications (필드 명세)

(Schemas defined in §2; this section consolidates validation rules.)

### 3.1 Daily KPI Cache — Computation Coverage

Each of the 21 metrics has a defined source and computation rule. Summary table:

| Metric Category | Auto / Manual | Source Module | Aggregation Rule |
|---|---|---|---|
| Marketing × 3 | Manual | DSH `manual_inputs` | Direct copy from manual input row |
| CS × 5 (excl. Complain) | Auto | CSL | Day-bounded count of CSL events |
| CS — Complain | Manual + Detail | DSH `complaints` | COUNT of complaint records logged that day |
| Operating × 4 (excl. # of) | Auto | CLS + AMB users | Day-bounded count of student/teacher add/leave events |
| Operating — # of St., # of Tc. | Auto (status) | CLS + AMB users | DISTINCT active count at day-end |
| Class × 4 | Auto | CSL + CLS | See §1.4 metric inventory |

### 3.2 Manual Input — Required vs Optional

| Field | Required when entered? |
|---|---|
| `min_marketing_visitor` | Optional individually; SHOULD be paired with cost |
| `min_marketing_cost` | Optional individually |
| `min_marketing_effect` | Optional |
| `min_cs_complain` | (auto-computed from `complaints` table; not directly input) |

> Operational reality (DQ #5): Marketing data entry lapsed Mar 2026 onward in source. DSH must accept this gracefully — `min_input_status=PENDING` records remain editable indefinitely; dashboard shows "—" for missing values.

---

## 4. Functional Requirements (기능 요구사항)

### 4.1 Daily KPI Dashboard View (일별 KPI 대시보드 뷰)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-001 | Display monthly KPI dashboard with 4 categories: Marketing, CS, Operating, Class | P0 | Replicates INDEX R3 monthly summary structure |
| FR-DSH-002 | Marketing metrics: Visitor (방문자), Cost (비용), Effect (효율) | P0 | 3 columns per day |
| FR-DSH-003 | CS metrics: Counseling, Apply, Beginning, Missing, Trial Class, Complain | P0 | 6 columns per day |
| FR-DSH-004 | Operating metrics: New St., Out St., # of St., New Tc., Out Tc., # of Tc. | P0 | 6 columns per day |
| FR-DSH-005 | Class metrics: Map Test, Tt. Class, Student, Teacher | P0 | 4 columns per day; CLS metrics use real data per v1.0b |
| FR-DSH-006 | Daily detail table — 1 row per day with Day/MS columns + 21 metrics for selected month | P0 | Default current month |
| FR-DSH-007 | Auto-compute monthly Average row | P0 | Per metric `met_aggregation_type` rules (§1.6) |
| FR-DSH-008 | Auto-compute monthly Total/Sum row | P0 | Status metrics show last-day value, count metrics show arithmetic sum |
| FR-DSH-009 | Drill-down to source records on metric click | P1 | Counseling click → CSL filtered list; Tt. Class click → CLS sessions list; etc. |
| FR-DSH-010 | YoY (전년 대비) and MoM (전월 대비) comparison | P1 | Once 12 months data accumulated; placeholder until then |
| FR-DSH-011 | Export dashboard as Excel matching INDEX layout | P2 | Continuity for stakeholders accustomed to xlsx |
| FR-DSH-012 | Multi-tenant filter by `ent_id` — own Entity data only | P0 | Inherited from AMB OwnEntityGuard |

### 4.2 Visualization (시각화) — beyond the daily grid

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-V01 | Trend charts — line chart per metric across selected date range | P1 | Default 30/90/180-day toggle |
| FR-DSH-V02 | Category overview cards — top of page summary cards (one per category) showing month-to-date totals + delta from prior month | P1 | At-a-glance status |
| FR-DSH-V03 | CSL pipeline funnel widget (cross-module) — showing INTAKE → MAP_TEST → TRIAL_CLASS → ENROLLMENT_COUNSELING → PAYMENT → CLASS_STARTED for selected period | P1 | Reuses CSL aggregations |
| FR-DSH-V04 | Class cancellation rate (결강율) widget | P1 | From CLS — `cancelled_sessions / total_sessions` |
| FR-DSH-V05 | Makeup completion rate widget | P1 | From CLS |
| FR-DSH-V06 | Top schools by inquiry count (cross-module SCH/CSL) | P2 | From SCH `sch_active_inquiries_count` |
| FR-DSH-V07 | FAQ usage trends (cross-module QNA) | P2 | Top-10 referenced FAQs |
| FR-DSH-V08 | Score distribution dashboard — student MAP/ISEE/SSAT scores against REF benchmarks | P2 | Histogram with benchmark line |
| FR-DSH-V09 | Teacher monthly hours leaderboard (cross-module CLS) | P2 | From `cls_settlements` |

### 4.3 Manual Data Entry (수동 데이터 입력)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-M01 | Manual entry form for daily Marketing metrics — Visitor, Cost, Effect | P0 | Single form per day; allow multi-day grid edit |
| FR-DSH-M02 | Bulk entry — paste from external analytics export (CSV) → preview → save | P1 | Productivity for batch backfill |
| FR-DSH-M03 | Edit history per manual entry | P0 | Per FR-DSH-M04 below + AMB audit |
| FR-DSH-M04 | "Pending entries" reminder dashboard widget — list days where manual inputs missing | P0 | Operational compliance |
| FR-DSH-M05 | Daily reminder notification at 09:00 next day | P1 | Reminder to designate person to enter prior day |
| FR-DSH-M06 | Source attribution — capture which platform (Naver/Google) the values came from | P1 | Audit trail |

### 4.4 Complaint Logging (불만 사례 입력)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-C01 | Complaint log form — manual entry by advisor or team-lead | P0 | Triggers `Complain` metric increment |
| FR-DSH-C02 | Categorize complaint (6 ENUM values per §2.5) | P0 | |
| FR-DSH-C03 | Severity selection | P0 | |
| FR-DSH-C04 | Cross-reference — link to QNA / CLS / CSL / Student | P0 | Strengthens trend analysis |
| FR-DSH-C05 | Resolution tracking — workflow LOGGED → INVESTIGATING → RESOLVED/UNRESOLVED | P0 | |
| FR-DSH-C06 | Complaint trend by category over time | P1 | Identifies systemic issues |
| FR-DSH-C07 | Auto-promote — `qna_resolution_status=UNSATISFIED` Q&A prompts user to log a complaint | P1 | Cross-module hint |

### 4.5 Aggregation Computation (집계 계산)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-A01 | Daily batch — recompute previous day's `daily_kpi` row at 03:00 nightly | P0 | Idempotent |
| FR-DSH-A02 | On-demand recompute — admin trigger to recompute date range | P0 | Backfill scenario |
| FR-DSH-A03 | Event-driven invalidation — when CSL/CLS/QNA/SCH/REF emits modifying event, mark affected `daily_kpi` row `STALE` | P0 | Per `dkp_computation_status` |
| FR-DSH-A04 | Lazy recompute — when STALE row is requested, recompute synchronously (with timeout) | P0 | < 2s p95 |
| FR-DSH-A05 | Daily recompute logs the source versions (`dkp_source_versions`) | P0 | Staleness detection precision |
| FR-DSH-A06 | Aggregation rule per metric type follows `met_aggregation_type` | P0 | Status metrics use last value; count metrics sum; etc. |
| FR-DSH-A07 | Time zone — Asia/Seoul fixed for v1.0; future Entities may override | P0 | Day boundaries unambiguous |
| FR-DSH-A08 | Future-day rows pre-created as `PARTIAL_FUTURE` for dashboard navigation continuity | P1 | Avoids broken UI when navigating to current week |

### 4.6 Migration (마이그레이션)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-DSH-MG01 | Import 5 months of INDEX historical data as `daily_kpi` rows | P0 | 132 active rows → ~150 day rows (some empty days) |
| FR-DSH-MG02 | Migrated rows marked `dkp_data_completeness=COMPLETE` for documented values; `PARTIAL_PENDING_MANUAL` if marketing data missing (DQ #5) | P0 | Per DQ findings |
| FR-DSH-MG03 | Migration excludes Sum and Aver. rows (R36, R37, R131, R132, etc.) — these computed from day rows | P0 | Avoid double-counting |
| FR-DSH-MG04 | Marketing manual inputs back-filled to `manual_inputs` table for migrated days | P0 | |
| FR-DSH-MG05 | Source row reference preserved — `dkp_migration_source_row` INT field | P0 | Traceability |
| FR-DSH-MG06 | Post-migration validation — recompute derived metrics from CSL/CLS migrated data, compare against INDEX values, flag discrepancies | P0 | Reconciliation report |
| FR-DSH-MG07 | Discrepancies handled — keep INDEX value as `dkp_*_imported` field, flag for review; live data source becomes truth from cut-over | P0 | |

---

## 5. Business Rules (비즈니스 규칙)

| ID | Rule (규칙) | Trigger | Action |
|---|---|---|---|
| BR-DSH-001 | Daily KPI for current day is always STALE (data not final until day ends) | View today's row | UI shows "오늘 (진행 중)" badge |
| BR-DSH-002 | Daily KPI for past days is FRESH unless source events arrive late | CSL/CLS event with date in past | Mark `dkp_computation_status=STALE`; lazy recompute |
| BR-DSH-003 | Status metrics computed at midnight | Daily batch | `dkp_ops_count_st` = active students at 23:59:59 |
| BR-DSH-004 | Distinct counts use ent_id-scoped DISTINCT | Aggregation query | Per Amoeba §12 multi-tenancy |
| BR-DSH-005 | Marketing manual entry triggers `daily_kpi` update | Save manual input | Update `daily_kpi.dkp_marketing_*` from `manual_inputs` |
| BR-DSH-006 | Complaint logging triggers `daily_kpi.dkp_cs_complain` increment | New complaint record | Recompute count; update `daily_kpi` |
| BR-DSH-007 | Drill-down respects access scope | Click metric | Show only records visible to current user per AMB §12 |
| BR-DSH-008 | Export to xlsx includes all 21 metrics + Sum/Aver. rows matching INDEX layout | Export action | Backward compatibility |
| BR-DSH-009 | Recompute failure does not block dashboard load | Compute timeout | Show last `FRESH` value with "갱신 필요" indicator; background retry |
| BR-DSH-010 | Marketing data missing > 3 consecutive days creates AMB Issue with `source:acm` | Daily batch | Operational alert |
| BR-DSH-011 | Cross-Entity dashboard view (multi-academy admin) — DEFERRED to v1.1 | View attempt | v1.0 = single Entity only |

---

## 6. Validation Rules (검증 규칙)

### 6.1 Field-Level

| ID | Field | Rule | Error Code |
|---|---|---|---|
| VR-DSH-001 | `min_marketing_visitor` | 0 ≤ x ≤ 10000 (sanity bound) | `VAL_VISITOR_RANGE` |
| VR-DSH-002 | `min_marketing_cost` | 0 ≤ x ≤ 10,000,000 (10M KRW per day max) | `VAL_COST_RANGE` |
| VR-DSH-003 | `min_marketing_effect` | 0 ≤ x ≤ 1000 | `VAL_EFFECT_RANGE` |
| VR-DSH-004 | `min_date` | ≤ today + 1 (no future entry beyond tomorrow) | `VAL_DATE_FUTURE` |
| VR-DSH-005 | `cmp_severity` | One of 4 ENUM | `VAL_SEVERITY` |
| VR-DSH-006 | `cmp_category` | One of 6 ENUM | `VAL_CATEGORY` |
| VR-DSH-007 | `met_aggregation_type` | One of 5 ENUM | `VAL_AGG_TYPE` |
| VR-DSH-008 | `dkp_*` count fields | Non-negative INT | `VAL_NEGATIVE_COUNT` |

### 6.2 Cross-Field

| ID | Rule | Error Code |
|---|---|---|
| VR-DSH-X01 | `cmp_status=RESOLVED` requires `cmp_resolved_at` and `cmp_resolved_by` | `VAL_RESOLUTION_FIELDS` |
| VR-DSH-X02 | `min_input_status=COMPLETE` requires all 3 marketing values (visitor + cost + effect) populated | `VAL_INPUT_COMPLETE_FIELDS` |
| VR-DSH-X03 | `dkp_data_completeness=COMPLETE` requires all 21 metrics non-null | `VAL_KPI_COMPLETE_FIELDS` |
| VR-DSH-X04 | `daily_kpi` and `manual_inputs` for same date MUST be ent_id-consistent | `VAL_ENT_CONSISTENCY` |

### 6.3 Migration Quality Flags

| Flag | Trigger | Action |
|---|---|---|
| `MIGRATION_DSH_OK` | All 21 columns parsed | None |
| `MIGRATION_DSH_PARTIAL_MARKETING` | Marketing columns missing | Set `dkp_data_completeness=PARTIAL_PENDING_MANUAL` |
| `MIGRATION_DSH_DISCREPANCY` | INDEX value disagrees with recomputed value | Flag for review; preserve both |
| `MIGRATION_DSH_AGGREGATION_ROW` | Source row is Sum/Aver., not day | Skip; aggregation computed live |

---

## 7. Cross-Module Integration (모듈 간 연동)

### 7.1 Inbound — DSH consumes from all 5 sibling modules (수신)

| From | Trigger | Effect on DSH |
|---|---|---|
| **CSL** | Inquiry created / stage transition / dropped | Mark relevant `daily_kpi` row STALE; lazy recompute |
| **CSL** | F-13 MAP score entered | Class metric `Map Test` increments |
| **CLS** | Session HELD / CANCELLED / created / completed | Mark relevant `daily_kpi` row STALE |
| **CLS** | Class created / student added/removed | Operating metrics affected |
| **CLS** | Settlement confirmed | Teacher leaderboard widget refreshed |
| **SCH** | School updated / inquiry count changed | "Top schools" widget refreshed (FR-DSH-V06) |
| **REF** | Score benchmark version change | Score distribution widget refreshed (FR-DSH-V08) |
| **QNA** | `qna_resolution_status=UNSATISFIED` set | Prompt to log complaint (FR-DSH-C07) |
| **QNA** | FAQ promoted / used | FAQ usage widget (FR-DSH-V07) |
| AMB Users | Teacher created / disabled | Operating teacher counts affected |

### 7.2 Outbound — DSH emits very little (발신)

DSH is mostly a sink. Only outbound is to AMB Issue:

| To | Trigger | Payload |
|---|---|---|
| **AMB Core Issue API** (one-way) | Marketing data missing > 3 consecutive days (BR-DSH-010) | "[ACM-DSH] 마케팅 데이터 입력 누락 — {dates}" assigned to designer |
| **AMB Core Issue API** | Complaint logged with `cmp_severity=CRITICAL` | "[ACM-DSH] CRITICAL 불만 사례 — {student}" assigned to senior manager |
| **AMB Core Issue API** | Compute failure repeated > 3 times | "[ACM-DSH] KPI 집계 반복 실패 — {date}" assigned to admin |

### 7.3 Module Interface Contract

```typescript
// Internal DSH services
export interface IAcmDshService {
  // Read
  findDailyKpi(entId: UUID, date: Date): Promise<DailyKpiDto | null>;
  findKpiRange(entId: UUID, fromDate: Date, toDate: Date): Promise<DailyKpiDto[]>;
  computeMonthlyAggregation(entId: UUID, yearMonth: string): Promise<MonthlyAggregationDto>;
  
  // Manual input
  upsertManualInput(entId: UUID, date: Date, dto: ManualInputDto): Promise<ManualInputDto>;
  findPendingManualInputs(entId: UUID, daysBack: number): Promise<Date[]>;
  
  // Complaints
  logComplaint(entId: UUID, dto: ComplaintDto): Promise<ComplaintDto>;
  findComplaintsByCategory(entId: UUID, category: ComplaintCategory, dateRange: DateRange): Promise<ComplaintDto[]>;
  
  // Recompute
  recomputeDailyKpi(entId: UUID, date: Date): Promise<DailyKpiDto>;
  recomputeRange(entId: UUID, fromDate: Date, toDate: Date): Promise<{ recomputed: number; failed: number }>;
}

// Event handlers — listening to other modules
export interface IDshEventHandlers {
  onCslEvent(event: AcmCslInquiryEvent): Promise<void>;  // marks daily_kpi STALE
  onClsEvent(event: AcmClsEvent): Promise<void>;
  onSchEvent(event: AcmSchEvent): Promise<void>;
  onRefEvent(event: AcmRefEvent): Promise<void>;
  onQnaEvent(event: AcmQnaEvent): Promise<void>;
}
```

---

## 8. UI/UX Considerations (UI/UX 고려사항)

| ID | Consideration | Rationale |
|---|---|---|
| UI-DSH-001 | Default view = current month, daily grid matching INDEX sheet layout (Day / MS / 21 metrics) | Stakeholder familiarity |
| UI-DSH-002 | Sticky column headers + Day/MS columns when horizontal-scrolling 21-metric grid | Long table usability |
| UI-DSH-003 | Status metrics (`# of St.`, `# of Tc.`) displayed in distinct background color (light gray) to indicate "snapshot, not sum" | DQ-derived insight |
| UI-DSH-004 | Today row highlighted (yellow background); future rows muted (light gray) | Time orientation |
| UI-DSH-005 | "Pending Manual" badge on rows where marketing data missing | Operational alert |
| UI-DSH-006 | Aver. row only shows averages for `met_aggregation_type IN (VOLUME_COUNT, NET_DELTA, DAILY_DISTINCT)`; status metric averages = "—" | Per §1.6 selective rule |
| UI-DSH-007 | Sum row visually distinct (bold + gray background) | Match INDEX style |
| UI-DSH-008 | Click metric value → drill-down modal shows source records (Counseling click → CSL list filtered to that day) | FR-DSH-009 |
| UI-DSH-009 | Category headers (Marketing / CS / Operating / Class) span columns matching INDEX R1 grouping | Visual structure |
| UI-DSH-010 | YoY/MoM comparison rendered as colored arrows (▲ green, ▼ red) next to monthly totals | Quick scan |
| UI-DSH-011 | Cards row at top — 4 category KPIs (e.g. "이번 달 신규 상담 21건 / 전월 +5") | At-a-glance |
| UI-DSH-012 | Mobile read-only — daily grid → vertical card list per day | Per NFR-015 |
| UI-DSH-013 | Recompute progress indicator — small spinner on STALE row | Transparency |
| UI-DSH-014 | "Last updated 5 min ago" timestamp at dashboard footer | Data freshness |
| UI-DSH-015 | Date navigation — month picker + arrow buttons + "go to today" | Convenience |

---

## 9. Audit, Compliance & Security (감사, 컴플라이언스, 보안)

### 9.1 Audit (Inherited from AMB)

| ID | Requirement |
|---|---|
| AUD-DSH-001 | Manual input edits logged with actor + timestamp + before/after via AMB audit |
| AUD-DSH-002 | Complaint CRUD logged |
| AUD-DSH-003 | Recompute events logged with `dkp_last_recompute_reason` |
| AUD-DSH-004 | Drill-down access logged (PII access — student data may be revealed) |
| AUD-DSH-005 | Export action logged with date range and recipient |

### 9.2 Access Control

| ID | Requirement |
|---|---|
| ACL-DSH-001 | View access — all USER_LEVEL within Entity |
| ACL-DSH-002 | Manual input access — designated user (디자인 담당, advisor) |
| ACL-DSH-003 | Complaint logging — advisor + team-lead |
| ACL-DSH-004 | Drill-down access — respects target module's access scope (CSL drill-down respects CSL ACL etc.) |
| ACL-DSH-005 | Export — team-lead+ only (potential PII exposure) |

### 9.3 Multi-Tenant Isolation

| ID | Requirement |
|---|---|
| MT-DSH-001 | All queries scoped by `ent_id` via OwnEntityGuard |
| MT-DSH-002 | Per-Entity dashboard — TPI and sister academies have separate KPI grids |
| MT-DSH-003 | Cross-Entity dashboard for shared admin (배예리) — DEFERRED to v1.1 (per BR-DSH-011) |

---

## 10. Non-Functional Requirements (Module-Specific)

| ID | Category | Requirement | Criteria |
|---|---|---|---|
| NFR-DSH-P01 | Performance | Daily KPI grid load (1 month, 31 days × 21 metrics) | < 800ms p95 from cache |
| NFR-DSH-P02 | Performance | Drill-down to source records | < 1s p95 |
| NFR-DSH-P03 | Performance | Lazy recompute (1 day) | < 2s p95 |
| NFR-DSH-P04 | Performance | YoY comparison (24 months) | < 2s p95 from cache |
| NFR-DSH-P05 | Performance | xlsx export (12 months) | < 10s |
| NFR-DSH-S01 | Scalability | Years of cached data per Entity | 5+ years (~1825 daily rows) supported |
| NFR-DSH-S02 | Scalability | Concurrent dashboard viewers per Entity | 20+ |
| NFR-DSH-A01 | Availability | Read | 99.5% — leadership depends on it |
| NFR-DSH-R01 | Reliability | Recompute idempotency | Same inputs → same outputs always |
| NFR-DSH-R02 | Reliability | Cache eventual consistency | At most 5 min stale during business hours |

---

## 11. Risks (Module-Specific)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-DSH-001 | Manual input lapses (Marketing data missing) — pattern observed Mar-Apr 2026 in source | High | Medium | FR-DSH-M04 reminder widget; BR-DSH-010 auto-issue after 3-day gap |
| R-DSH-002 | Effect metric definition unclear (Q-DSH-001) — UI may misrepresent | Medium | Low | Default = manual input passthrough; document semantics post-clarification |
| R-DSH-003 | INDEX vs recomputed discrepancies during migration (FR-DSH-MG06) | Medium | Medium | Reconciliation report; prefer migrated-INDEX for historical, prefer live for going-forward |
| R-DSH-004 | Aggregation cache staleness — if event invalidation misses cases | Medium | Medium | Daily nightly recompute as safety net (FR-DSH-A01) |
| R-DSH-005 | Status metric Sum interpretation — users may expect arithmetic sum | High | Low | UI distinction (UI-DSH-003) + tooltip explanation |
| R-DSH-006 | Group student attendance double-counting in Class metrics | Medium | Medium | DISTINCT enforced; covered by NFR-DSH-R01 idempotency tests |
| R-DSH-007 | Marketing module (ACM-MKT) future split causes data redundancy | Low | Low | DSH manual_inputs deprecated cleanly when MKT lands |
| R-DSH-008 | Complaint logging adoption resistance (advisors fail to log) | High | High | UI-DSH-014 prompts from QNA UNSATISFIED; periodic review with senior manager |
| R-DSH-009 | Time zone edge cases — late-night events on day boundary | Low | Low | All timestamps Asia/Seoul fixed (FR-DSH-A07) |

---

## 12. Open Questions (확인 필요 사항)

| ID | Question (질문) | Owner | Required by (필요 시점) |
|---|---|---|---|
| Q-DSH-001 | "Effect" metric semantics — clarify with 디자인 담당. Is it (a) ad clicks, (b) ad-driven inquiries, (c) ad conversion count, or (d) some other measure? Affects UI label and validation range. | 김태윤 / 디자인 담당 | Before v1.0a UAT |
| Q-DSH-002 | Map Test metric — should it count `mpt_scheduled_at` (예약일) or `mpt_taken_at` (실 응시일)? Source data ambiguous. | 정성경 | Before FR-DSH-005 implementation |
| Q-DSH-003 | Tt. Class metric — should it count sessions (HELD count) or sum of session hours? Source values like 15.5, 20.5 suggest hours. | 김태윤 | Before FR-DSH-005 implementation |
| Q-DSH-004 | Missing metric — currently undefined; source data shows small values (0-5/day). Likely "missed follow-up" or "no-shows"? Need precise definition. | 정성경 | Before FR-DSH-003 implementation |
| Q-DSH-005 | Apply metric — should it count CSL records that newly become `enr_applied=TRUE` on the day, or all active applications? | 정성경 | Before FR-DSH-003 implementation |
| Q-DSH-006 | INDEX historical migration scope — import full 5 months as-is, or only after data quality check? Some Marketing values are missing (Mar+ in 2026). | 김태윤 | Before migration M-1 |
| Q-DSH-007 | `Complain` count — should it equal complaints **logged** that day, or complaints **about events** that day? Affects aggregation rule. | 배예리 | Before BR-DSH-006 implementation |
| Q-DSH-008 | Cross-Entity dashboard for 배예리 (multi-academy admin) — desired in v1.1 onboarding of Santa Croce / 트리니티? | 배예리 / 최지용 | Before v1.1 |
| Q-DSH-009 | Daily reminder time (FR-DSH-M05) — 09:00 next day appropriate, or different cadence? | 디자인 담당 | Before v1.0a UAT |
| Q-DSH-010 | Sum row for Marketing Cost — sum across days, but what if day had 광고 안 함? Is `null` ≠ 0 treated correctly? | 김태윤 | Before BR-DSH-008 |
| Q-DSH-011 | Mobile dashboard — read-only acceptable for v1.0, or should mobile entry of complaint be supported? | 김태윤 | Before v1.0a UI design |

---

## 13. Acceptance Criteria for Module Sign-Off

DSH module is **DONE for ACM v1.0a** when ALL true:

- [ ] All 4 tables implemented per §2 with proper FK constraints + indexes
- [ ] 21 metric definitions seeded in `metric_definitions` per §1.4
- [ ] Daily KPI grid view replicates INDEX sheet structure (4 categories × daily rows + Sum + Aver.)
- [ ] All P0 functional requirements pass UAT with 배예리 + 정성경 + 김태윤
- [ ] Aggregation rules per metric type (`met_aggregation_type`) verified — status metrics show last-day, count metrics sum, daily-distinct correct
- [ ] Migration of 5 months historical data complete with reconciliation report < 5% discrepancy after fixes
- [ ] Manual input form for Marketing functional with reminder widget
- [ ] Complaint logging functional with QNA cross-link
- [ ] Drill-down to source records works for all auto-computed metrics
- [ ] Daily batch + event-driven invalidation tested
- [ ] All Q-DSH-001 ~ 011 either resolved or explicitly deferred with owner
- [ ] xlsx export matches INDEX layout

DSH module is **DONE for ACM v1.0b** when additionally:

- [ ] CLS metrics (Class category — Tt. Class, Student, Teacher) populated from real CLS data
- [ ] Operating CLS-derived metrics (New St., Out St., # of St.) accurate against CLS migration baseline
- [ ] Class cancellation rate widget functional
- [ ] Settlement leaderboard widget (FR-DSH-V09) functional

---

## Appendix A: Source Sheet → DB Quick Reference

### A.1 INDEX → daily_kpi mapping

| Source Col | Header | Target Field |
|---|---|---|
| C1 | Day | `dkp_day_of_month` (parsed from int 1-31) |
| C2 | MS | `dkp_day_of_week_kr` |
| C3 | Visitor | `dkp_marketing_visitor` ← `manual_inputs.min_marketing_visitor` |
| C4 | Cost | `dkp_marketing_cost` ← `manual_inputs.min_marketing_cost` |
| C5 | Effect | `dkp_marketing_effect` ← `manual_inputs.min_marketing_effect` |
| C6 | Counseling | `dkp_cs_counseling` (auto from CSL) |
| C7 | Apply | `dkp_cs_apply` (auto from CSL) |
| C8 | Beginning | `dkp_cs_beginning` (auto from CSL) |
| C9 | Missing | `dkp_cs_missing` (auto from CSL) |
| C10 | Trial Class | `dkp_cs_trial_class` (auto from CSL) |
| C11 | Complain | `dkp_cs_complain` (auto from `complaints` table count) |
| C12 | New St. | `dkp_ops_new_st` (auto from CLS) |
| C13 | Out St. | `dkp_ops_out_st` (auto from CLS) |
| C14 | # of St. | `dkp_ops_count_st` (auto, status) |
| C15 | New Tc. | `dkp_ops_new_tc` (auto from AMB users) |
| C16 | Out Tc. | `dkp_ops_out_tc` (auto from AMB users) |
| C17 | # of Tc. | `dkp_ops_count_tc` (auto, status) |
| C18 | Map Test | `dkp_class_map_test` (auto from CSL) |
| C19 | Tt. Class | `dkp_class_tt_class` (auto from CLS) |
| C20 | Student | `dkp_class_student` (auto from CLS) |
| C21 | Teacher | `dkp_class_teacher` (auto from CLS) |

### A.2 Aggregation Rows — Computed at Display Time

| Source Row Pattern | Computed | Target |
|---|---|---|
| R3, R36, R131, etc. (월 라벨 + Sum) | Computed live | Per `met_aggregation_type` rules per metric |
| R4, R37, R132 (Aver.) | Computed live | Per `met_aggregation_type` rules; selective per §1.6 |

These rows are **NOT stored in the database** — computed at display time from `daily_kpi` for the requested month. Avoids data duplication and update anomalies.

---

## Appendix B: Requirement ID Index

| Prefix | Category | Count |
|---|---|---|
| FR-DSH-001~012 | Daily KPI Dashboard View | 12 |
| FR-DSH-V* | Visualization (charts/widgets) | 9 |
| FR-DSH-M* | Manual Data Entry | 6 |
| FR-DSH-C* | Complaint Logging | 7 |
| FR-DSH-A* | Aggregation Computation | 8 |
| FR-DSH-MG* | Migration | 7 |
| BR-DSH-* | Business Rules | 11 |
| VR-DSH-* | Validation (field) | 8 |
| VR-DSH-X* | Validation (cross-field) | 4 |
| AUD-DSH-* | Audit | 5 |
| ACL-DSH-* | Access Control | 5 |
| MT-DSH-* | Multi-tenancy | 3 |
| NFR-DSH-* | Non-functional | 9 |
| R-DSH-* | Risks | 9 |
| Q-DSH-* | Open Questions | 11 |
| **Total** | | **114** |

---

**End of Document (문서 끝)**
