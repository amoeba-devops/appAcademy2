---
document_id: ACM-FN-DSH-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_requirements:
  - ACM-REQ-DSH-001 v1.0
related_designs:
  - ACM-ERD-001 v1.0.0
  - ACM-PLAN-001 v1.0.1
  - ACM-FN-CSL-001 v1.0.0
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial Dashboard module functional spec — 21-metric daily KPI cache, manual input, complaint log, aggregation worker. Stack — React 18 + NestJS 10.
---

# ACM-FN-DSH-001 — Dashboard Functional Specification (대시보드 모듈 기능명세서)

> **Scope**: REST API + aggregation pipeline for the DSH module — 21 daily KPIs across 4 categories (Marketing/CS/Operating/Class), 4 tables, event-driven STALE marking + 03:00 nightly recompute.
> **Source of Truth**: `ACM-REQ-DSH-001 v1.0`.

---

## 1. Overview (개요)

### 1.1 Purpose
Translate DSH requirements into HTTP endpoints, DTOs, and a clear aggregation worker contract. DSH is **not a primary data owner** — it consumes events from CSL/CLS/SCH/REF/QNA and small manual inputs (Marketing × 3, complaints).

### 1.2 Module Boundary
- **Owns**: `dsh_daily_kpi` cache, `dsh_manual_inputs`, `dsh_metric_definitions`, `dsh_complaints`.
- **Does NOT own**: source business records — read-only consumption via cross-module ports.

### 1.3 Architectural Layers
- `presentation/` — Controllers (read-heavy, write only for manual inputs + complaints)
- `application/` — Query handlers + RecomputeKpiUseCase
- `domain/` — KpiAggregationService (per `met_aggregation_type`), MetricDefinitionRegistry
- `infrastructure/` — TypeORM repos, Redis cache, BullMQ scheduler, cross-module clients

Module path: `backend/src/modules/acm-dsh/`

---

## 2. REST API Endpoint Catalog (API 엔드포인트 카탈로그)

### 2.1 Base Path
```
/api/acm/dsh
```

### 2.2 Read Endpoints (대시보드 조회)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| D-01 | `GET` | `/dashboard/monthly?yearMonth=YYYY-MM` | Monthly grid (1..31 + Sum/Aver) | `viewer+` | FR-DSH-001..008 |
| D-02 | `GET` | `/dashboard/cards?yearMonth=YYYY-MM` | Top-of-page summary cards | `viewer+` | FR-DSH-V02 |
| D-03 | `GET` | `/dashboard/trend?metricCode=&from=&to=` | Per-metric line chart series | `viewer+` | FR-DSH-V01 |
| D-04 | `GET` | `/dashboard/compare?yearMonth=` | YoY/MoM delta | `viewer+` | FR-DSH-010 |
| D-05 | `GET` | `/dashboard/funnel?from=&to=` | CSL pipeline funnel widget | `viewer+` | FR-DSH-V03 |
| D-06 | `GET` | `/dashboard/export?yearMonth=&format=xlsx` | Excel export matching INDEX layout | `team_lead+` | FR-DSH-011 |
| D-07 | `GET` | `/dashboard/drilldown?metricCode=&date=` | Source records behind a cell | `advisor+` | FR-DSH-009 |
| D-08 | `GET` | `/dashboard/pending-entries` | Days where manual input missing | `team_lead+` | FR-DSH-M04 |

### 2.3 Manual Input (`/manual-inputs`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| D-10 | `GET` | `/manual-inputs?from=&to=` | List in date range | `team_lead+` | FR-DSH-M03 |
| D-11 | `GET` | `/manual-inputs/{date}` | Single day | `team_lead+` | — |
| D-12 | `PUT` | `/manual-inputs/{date}` | Upsert (Marketing + complain) | `team_lead+` | FR-DSH-M01 |
| D-13 | `POST` | `/manual-inputs/bulk` | CSV preview + commit | `team_lead+` | FR-DSH-M02 |

### 2.4 Complaints (`/complaints`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| D-20 | `GET` | `/complaints` | List with filters | `advisor+` | FR-DSH-C06 |
| D-21 | `POST` | `/complaints` | Log new complaint | `advisor+` | FR-DSH-C01..C04 |
| D-22 | `GET` | `/complaints/{cmpId}` | Detail | `advisor+` | — |
| D-23 | `PATCH` | `/complaints/{cmpId}` | Update workflow / resolution | `advisor+` | FR-DSH-C05 |
| D-24 | `DELETE` | `/complaints/{cmpId}` | Soft delete | `team_lead+` | — |

### 2.5 Aggregation Admin (`/admin`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| D-30 | `POST` | `/admin/recompute` | On-demand recompute date range | `admin` | FR-DSH-A02 |
| D-31 | `GET` | `/admin/recompute/jobs/{jobId}` | Job status | `admin` | — |
| D-32 | `GET` | `/admin/metrics` | Metric definition registry | `admin` | — |
| D-33 | `PATCH` | `/admin/metrics/{metId}` | Toggle visibility / customize | `admin` | — |

---

## 3. DTO Catalog (DTO 카탈로그)

### 3.1 `MonthlyDashboardQueryDto`
```ts
class MonthlyDashboardQueryDto {
  @Matches(/^\d{4}-\d{2}$/) yearMonth!: string;     // "2026-04"
  @IsOptional() @IsArray() @IsString({each:true}) metricCodes?: string[]; // filter subset
  @IsOptional() @IsBoolean() includeAggregateRows?: boolean = true;        // Sum/Aver
}
```

### 3.2 `MonthlyDashboardResponseDto`
```ts
interface MonthlyDashboardResponseDto {
  yearMonth: string;
  metricsByCategory: {
    MARKETING: MetricColumn[];
    CS: MetricColumn[];
    OPERATING: MetricColumn[];
    CLASS: MetricColumn[];
  };
  rows: Array<{
    rowType: 'DAY' | 'SUM' | 'AVERAGE';
    date?: string;                         // null for SUM/AVERAGE rows
    dayOfMonth?: number;
    dayOfWeekKr?: '월'|'화'|'수'|'목'|'금'|'토'|'일';
    completeness?: 'COMPLETE'|'PARTIAL_PENDING_MANUAL'|'PARTIAL_FUTURE';
    values: Record<string /*metric code*/, number | null>;
  }>;
  computedAt: string;
}

interface MetricColumn {
  metCode: string;
  metLabelKr: string;
  metLabelEn: string;
  metAggregationType: 'VOLUME_COUNT'|'STATUS_SNAPSHOT'|'DAILY_DISTINCT'|'NET_DELTA'|'COMPUTED';
  metFormat: string;
  metUnit: string;
  metSupportsDrillDown: boolean;
}
```

### 3.3 `ManualInputUpsertDto`
```ts
class ManualInputUpsertDto {
  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  minMarketingVisitor?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100_000_000)
  minMarketingCost?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100_000)
  minMarketingEffect?: number;

  @IsOptional() @IsString() @MaxLength(100)
  minVisitorSource?: string;

  @IsOptional() @IsString() @MaxLength(100)
  minCostSource?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  minInputNote?: string;
}
```

### 3.4 `BulkManualInputDto` (CSV)
```ts
class BulkManualInputDto {
  @IsBoolean() dryRun!: boolean;
  @IsArray() @ValidateNested({each:true}) @Type(() => BulkRow)
  rows!: BulkRow[];
}
class BulkRow extends ManualInputUpsertDto {
  @IsDateString() date!: string;
}
```

### 3.5 `ComplaintCreateDto`
```ts
class ComplaintCreateDto {
  @IsDateString() cmpLoggedAt!: string;
  @IsEnum(ComplaintCategory) cmpCategory!: ComplaintCategory;
  // INSTRUCTOR | SCHEDULING | PAYMENT | CONTENT_QUALITY | COMMUNICATION | OTHER
  @IsEnum(ComplaintSeverity) cmpSeverity!: ComplaintSeverity;
  // LOW | MEDIUM | HIGH | CRITICAL
  @IsString() @MinLength(5) @MaxLength(2000) cmpDescription!: string;

  @IsOptional() @IsUUID() cmpStudentUserId?: string;
  @IsOptional() @IsUUID() cmpQnaId?: string;
  @IsOptional() @IsUUID() cmpClassId?: string;
  @IsOptional() @IsUUID() cmpInquiryId?: string;
}

class ComplaintUpdateDto {
  @IsOptional() @IsEnum(ComplaintStatus) cmpStatus?: ComplaintStatus;
  // LOGGED | INVESTIGATING | RESOLVED | UNRESOLVED
  @IsOptional() @MaxLength(2000) cmpResolution?: string;
  @IsOptional() @IsDateString() cmpResolvedAt?: string;
}
```

### 3.6 `RecomputeRequestDto`
```ts
class RecomputeRequestDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsString() reason?: string;     // logged in dkp_last_recompute_reason
  @IsOptional() @IsBoolean() forceFullRecompute?: boolean = false;
}
```

### 3.7 `TrendQueryDto`
```ts
class TrendQueryDto {
  @IsString() metricCode!: string;
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsEnum(TrendGranularity) granularity?: 'DAY'|'WEEK'|'MONTH' = 'DAY';
}
```

### 3.8 `DrilldownQueryDto`
```ts
class DrilldownQueryDto {
  @IsString() metricCode!: string;
  @IsDateString() date!: string;
  @IsOptional() @IsInt() limit?: number = 100;
}
// Response: array of { sourceModule, sourceId, summary, link } records
```

---

## 4. Aggregation Pipeline (집계 파이프라인)

### 4.1 Recompute Strategy (per FR-DSH-A01..A06)

| Mode | Trigger | Behavior |
|---|---|---|
| **Nightly batch** | Cron `0 3 * * *` Asia/Seoul | Recompute previous day + any STALE rows in last 90 days |
| **Event-driven** | NestJS event from CSL/CLS/QNA/SCH/REF | Mark `dkp_computation_status=STALE` for affected (`ent_id`, date) |
| **Lazy-on-read** | `GET /dashboard/monthly` hits STALE row | Synchronous recompute with 2s timeout (NFR); fallback to cached value + warn |
| **On-demand** | `POST /admin/recompute` | Enqueue BullMQ job; client polls D-31 |

### 4.2 `KpiAggregationService` (Domain Service)
```ts
class KpiAggregationService {
  async recomputeDay(entId: string, date: Date): Promise<DkpRow>;
  async markStale(entId: string, date: Date, reason: string): Promise<void>;
  async detectStale(entId: string, date: Date): Promise<boolean>;  // compare dkp_source_versions
}
```

Each metric is computed via its `met_source_query_template` (per `dsh_metric_definitions`). For event-driven STALE marking, the registry maps source module → affected metrics.

### 4.3 Aggregation Rules (per `met_aggregation_type`)
| Type | Daily | Sum row | Average row |
|---|---|---|---|
| `VOLUME_COUNT` | event count for day | `Σ daily` | `Σ / activeDays` |
| `STATUS_SNAPSHOT` | state at day-end | **last day's value** | `—` (blank) |
| `DAILY_DISTINCT` | DISTINCT count for day | `Σ daily` (NOT distinct over month) | `Σ / activeDays` |
| `NET_DELTA` | net change for day | `Σ daily` | `Σ / activeDays` |
| `COMPUTED` | per-day computed | per-day computed | per-day computed |

> `activeDays` = days with `dkp_data_completeness != PARTIAL_FUTURE`.

### 4.4 Cross-Module Read Ports (DI tokens)
```ts
ICslAggregationPort.countByEvent(entId, date, eventType): Promise<number>
ICslAggregationPort.countTrialClassHeld(entId, date): Promise<number>
ICslAggregationPort.countMapTestsScheduled(entId, date): Promise<number>
IClsAggregationPort.countSessionsHeld(entId, date): Promise<number>
IClsAggregationPort.countDistinctStudentsOnDay(entId, date): Promise<number>
IClsAggregationPort.countDistinctTeachersOnDay(entId, date): Promise<number>
IAmbUserPort.countActiveTeachersAt(entId, dateEnd): Promise<number>
// ... etc.
```
v1.0a: CLS/QNA/SCH/REF events not yet emitted → corresponding metrics return 0 with `dkp_data_completeness='PARTIAL_PENDING_MANUAL'`.

---

## 5. Validation & Business Rules (검증/비즈니스 규칙)

| ID | Rule | Layer | Error Code | HTTP |
|---|---|---|---|---|
| VR-DSH-001 | `yearMonth` matches `YYYY-MM`, ≥ 2025-12 (data start) | DTO | `VAL_YEAR_MONTH` | 400 |
| VR-DSH-002 | `from <= to`, range ≤ 366 days for trend | UseCase | `VAL_DATE_RANGE` | 400 |
| VR-DSH-003 | Cost ≥ 0; Visitor ≥ 0; Effect ≥ 0 | DTO | `VAL_RANGE` | 400 |
| VR-DSH-004 | Bulk CSV — max 366 rows per request | DTO | `VAL_BULK_SIZE` | 400 |
| VR-DSH-005 | Recompute range ≤ 90 days unless `admin` + `forceFullRecompute=true` | UseCase | `VAL_RECOMPUTE_RANGE` | 422 |
| VR-DSH-006 | Complaint `cmpLoggedAt` ≤ today + 0 (no future) | DTO | `VAL_COMPLAINT_DATE` | 400 |
| BR-DSH-001 | Manual input upsert triggers STALE marking on `dsh_daily_kpi` for that date | UseCase | — | — |
| BR-DSH-002 | Complaint create/delete triggers STALE marking | UseCase | — | — |
| BR-DSH-003 | STATUS_SNAPSHOT Sum row = last day with `COMPLETE` data (per ERD aggregation rule) | Service | — | — |
| BR-DSH-004 | Future days pre-created as `PARTIAL_FUTURE` rows on month navigation | Service | — | — |

---

## 6. Error Catalog (에러 카탈로그)

Same envelope shape as CSL (§6 of ACM-FN-CSL-001). DSH-specific prefixes:

| Prefix | Usage |
|---|---|
| `VAL_*` | DTO validation |
| `RECOMP_*` | Recompute job — `RECOMP_TIMEOUT`, `RECOMP_LOCKED`, `RECOMP_RANGE_TOO_LARGE` |
| `STALE_*` | Lazy recompute timeout — `STALE_FALLBACK_USED` (warn) |
| `EXPORT_*` | Excel export — `EXPORT_NO_DATA`, `EXPORT_TOO_MANY_MONTHS` |

---

## 7. Authorization Matrix (권한 매트릭스)

| Endpoint | viewer | advisor | team_lead | senior_manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /dashboard/*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /drilldown` | — | ✅ | ✅ | ✅ | ✅ |
| `GET /export` | — | — | ✅ | ✅ | ✅ |
| `PUT /manual-inputs/{date}` | — | — | ✅ | ✅ | ✅ |
| `POST /complaints` | — | ✅ | ✅ | ✅ | ✅ |
| `PATCH /complaints/{id}` | — | ✅ (own) | ✅ | ✅ | ✅ |
| `POST /admin/recompute` | — | — | — | — | ✅ |
| `PATCH /admin/metrics/{id}` | — | — | — | — | ✅ |

---

## 8. Cross-Module Integration (모듈 간 연동)

### 8.1 Inbound Event Subscriptions
| Source Event | Effect on DSH |
|---|---|
| `acm.csl.inquiry.created` | STALE mark for `dkp_date = inq_registered_at::date` |
| `acm.csl.inquiry.stage_changed` | STALE mark for transition date |
| `acm.csl.map_score.recorded` | STALE mark |
| `acm.csl.payment_confirmed` | STALE mark |
| `acm.csl.class_started` | STALE mark |
| `acm.cls.session.held` (v1.0b) | STALE mark |
| `acm.qna.record.created` | STALE mark (if linked to complaint flow) |

### 8.2 Outbound Events
| Event | Payload | Consumers |
|---|---|---|
| `acm.dsh.complaint.logged` | `{ entId, cmpId, severity, category }` | AMB Notification (HIGH/CRITICAL only) |
| `acm.dsh.kpi.recomputed` | `{ entId, date, durationMs }` | Internal observability |
| `acm.dsh.manual_input.missing` | `{ entId, date }` | AMB Notification (FR-DSH-M05) |

---

## 9. Performance & SLO Contracts (성능 / SLO)

| ID | Endpoint | Target |
|---|---|---|
| NFR-DSH-P01 | `GET /dashboard/monthly` | < 600ms p95 (cache-warm) |
| NFR-DSH-P02 | Lazy recompute on STALE | < 2s p95 |
| NFR-DSH-P03 | Nightly batch | complete < 5 min for 30-day backfill |
| NFR-DSH-P04 | Trend chart (90 days) | < 800ms p95 |
| NFR-DSH-A01 | Read uptime | 99.5% |

---

## 10. Audit & Privacy

| Hook | Trigger | Implementation |
|---|---|---|
| AUD-DSH-001 | All `PUT /manual-inputs` | AMB audit + `min_input_by/min_input_at` |
| AUD-DSH-002 | Complaint create/update | full diff |
| AUD-DSH-003 | Recompute job | `dkp_last_recompute_reason` |
| PII-DSH-001 | Drilldown response respects source module's PII rules (e.g. CSL phone masked) | Service layer | 

---

## 11. Frontend Component Map (React)

| Route | Component | API Calls | RBAC |
|---|---|---|---|
| `/acm/dsh` | `<DshDashboardView />` | D-01, D-02 | viewer+ |
| `/acm/dsh/trend/:metricCode` | `<DshTrendChart />` | D-03 | viewer+ |
| `/acm/dsh/manual-inputs` | `<DshManualInputGrid />` | D-10..D-13 | team_lead+ |
| `/acm/dsh/complaints` | `<DshComplaintList />` | D-20 | advisor+ |
| `/acm/dsh/complaints/new` | `<DshComplaintForm />` (RHF + Zod) | D-21 | advisor+ |
| `/acm/dsh/admin/recompute` | `<DshRecomputeAdmin />` | D-30, D-31 | admin |

### 11.1 Hooks
```ts
useMonthlyDashboard(yearMonth)         // TanStack useQuery, cache 5min
useDashboardCards(yearMonth)
useTrend(metricCode, range)
useManualInput(date)
useUpsertManualInput()                 // useMutation → invalidate monthly
useComplaintList(filters)
```

### 11.2 Zustand Stores
- `useDshFilterStore` — selected month, category collapse state
- `useDshDrilldownStore` — currently-open drilldown panel context

---

## 12. NestJS Module Skeleton

```
backend/src/modules/acm-dsh/
├─ presentation/
│  ├─ dashboard.controller.ts        // D-01..D-08
│  ├─ manual-input.controller.ts     // D-10..D-13
│  ├─ complaint.controller.ts        // D-20..D-24
│  └─ admin.controller.ts            // D-30..D-33
├─ application/
│  ├─ queries/
│  │  ├─ get-monthly-dashboard.query.ts
│  │  ├─ get-trend.query.ts
│  │  ├─ get-funnel.query.ts
│  │  ├─ get-pending-entries.query.ts
│  │  └─ get-drilldown.query.ts
│  ├─ use-cases/
│  │  ├─ upsert-manual-input.usecase.ts
│  │  ├─ bulk-import-manual-input.usecase.ts
│  │  ├─ log-complaint.usecase.ts
│  │  ├─ update-complaint.usecase.ts
│  │  ├─ recompute-range.usecase.ts
│  │  └─ export-monthly-xlsx.usecase.ts
│  └─ event-handlers/
│     ├─ csl-events.handler.ts
│     ├─ cls-events.handler.ts
│     └─ qna-events.handler.ts
├─ domain/
│  ├─ entities/ (daily-kpi, manual-input, metric-definition, complaint)
│  ├─ services/
│  │  ├─ kpi-aggregation.service.ts       // §4.2
│  │  └─ metric-registry.service.ts
│  └─ repositories/
├─ infrastructure/
│  ├─ typeorm/
│  ├─ scheduler/
│  │  └─ nightly-recompute.cron.ts
│  ├─ bullmq/
│  │  └─ recompute.processor.ts
│  └─ external-ports/
│     ├─ csl-aggregation.client.ts
│     ├─ cls-aggregation.client.ts
│     └─ amb-user.client.ts
└─ acm-dsh.module.ts
```

---

## 13. Acceptance Criteria

| AC | Description | Verified by |
|---|---|---|
| AC-FN-DSH-01 | All 21 metrics return correct values for known fixture month (Jan 2026) | Integration test against seeded data |
| AC-FN-DSH-02 | STATUS_SNAPSHOT Sum row equals last day's value, NOT arithmetic sum | Unit test of KpiAggregationService |
| AC-FN-DSH-03 | Event-driven STALE marking triggers within 1s of source event | Event subscriber test |
| AC-FN-DSH-04 | Lazy recompute on STALE returns < 2s | k6 load test |
| AC-FN-DSH-05 | Excel export matches INDEX layout column-for-column | snapshot test |
| AC-FN-DSH-06 | RBAC enforced for manual-input write (team_lead+) | RBAC test suite |
| AC-FN-DSH-07 | Recompute job idempotent for same (entId, date) | repeated-call test |

---

## 14. Open Items

| ID | Item | Target |
|---|---|---|
| Q-FN-DSH-01 | Effect metric (Q-DSH-001) — confirm semantic (clicks vs conversions) | Sprint 2 |
| Q-FN-DSH-02 | YoY chart placeholder UX until 12 months data | Sprint 6 |
| Q-FN-DSH-03 | Drilldown — embed page vs navigate to source module list | Sprint 4 |
| Q-FN-DSH-04 | BullMQ vs in-process worker for recompute | Sprint 2 |

---

## 15. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Backend Lead | TBD | — |
| Frontend Lead | TBD | — |

_End of ACM-FN-DSH-001 v1.0.0._
