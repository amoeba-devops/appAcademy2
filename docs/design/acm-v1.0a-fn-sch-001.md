---
document_id: ACM-FN-SCH-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_designs:
  - ACM-ERD-001 v1.0.0
  - ACM-PLAN-001 v1.0.1
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial School module functional spec — 3 tables (schools, grade_bands, schedules), CSL FK consumption.
---

# ACM-FN-SCH-001 — School Master Functional Specification (학교 마스터 기능명세서)

> **Scope**: REST API for the SCH module — school catalog, grade bands, admission schedules. Source = `학교입학 정보` sheet (41 rows: 7 authorized + 11+ unauthorized + others).
> **Module**: `backend/src/modules/acm-sch/`

---

## 1. Overview

### 1.1 Purpose
Manage school metadata (international/foreign/boarding/etc.), grade bands (Authorized only), and admission schedules — used as FK target by `csl_inquiries.inq_target_school_id` and `qna_records.qna_related_school_id`.

### 1.2 Module Boundary
- **Owns**: `sch_schools`, `sch_grade_bands`, `sch_schedules`.
- **Does NOT own**: which inquiry references which school.

---

## 2. REST API Endpoint Catalog

### 2.1 Base Path
```
/api/acm/sch
```

### 2.2 Schools (`/schools`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| S-01 | `GET` | `/schools` | List with filters (region/category/auth status) | `viewer+` |
| S-02 | `GET` | `/schools/{schId}` | Detail w/ grade bands + schedules | `viewer+` |
| S-03 | `POST` | `/schools` | Create | `team_lead+` |
| S-04 | `PATCH` | `/schools/{schId}` | Update | `team_lead+` |
| S-05 | `DELETE` | `/schools/{schId}` | Soft delete (rejects if referenced by active CSL) | `admin` |
| S-06 | `GET` | `/schools/search?q=` | Autocomplete (CSL form) | `advisor+` |

### 2.3 Grade Bands (`/schools/{schId}/grade-bands`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| S-10 | `GET` | `/schools/{schId}/grade-bands` | List | `viewer+` |
| S-11 | `POST` | `/schools/{schId}/grade-bands` | Add (Authorized schools only) | `team_lead+` |
| S-12 | `PATCH` | `/schools/{schId}/grade-bands/{gbdId}` | Update | `team_lead+` |
| S-13 | `DELETE` | `/schools/{schId}/grade-bands/{gbdId}` | Remove | `team_lead+` |

### 2.4 Schedules (`/schools/{schId}/schedules`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| S-20 | `GET` | `/schools/{schId}/schedules` | List (filter by year/admission_type) | `viewer+` |
| S-21 | `POST` | `/schools/{schId}/schedules` | Add | `team_lead+` |
| S-22 | `PATCH` | `/schools/{schId}/schedules/{scdId}` | Update | `team_lead+` |
| S-23 | `DELETE` | `/schools/{schId}/schedules/{scdId}` | Remove | `team_lead+` |

### 2.5 Migration

| # | Method | Path | Auth |
|---|---|---|---|
| S-30 | `POST` | `/migration/import` | xlsx upload | `admin` |
| S-31 | `GET` | `/migration/jobs/{jobId}` | Job status | `admin` |

### 2.6 Internal Read-Only Service (cross-module DI)
```ts
ISchSchoolService.findById(entId, schId): Promise<SchoolDto | null>
ISchSchoolService.findByName(entId, name): Promise<SchoolDto[]>
ISchSchoolService.search(entId, query): Promise<SchoolDto[]>
```

---

## 3. DTO Catalog

### 3.1 `CreateSchoolDto`
```ts
class CreateSchoolDto {
  @IsString() @MinLength(1) @MaxLength(200) schName!: string;
  @IsOptional() @IsString() @MaxLength(200) schNameEn?: string;
  @IsEnum(SchoolCategory) schCategory!: SchoolCategory;
  // INTERNATIONAL_KR | FOREIGN_SCHOOL | BOARDING | OTHER
  @IsEnum(AuthStatus) schAuthorizationStatus!: AuthStatus;
  // AUTHORIZED | UNAUTHORIZED
  @IsOptional() @IsString() @MaxLength(50) schRegion?: string;
  @IsEnum(CurriculumSystem) schCurriculumSystem!: CurriculumSystem;
  // US_GRADE | UK_GRADE | IB | MIXED | OTHER
  @IsOptional() @MaxLength(2000) schAdmissionNote?: string;
  @IsOptional() @IsUrl() schHomepageUrl?: string;
  @IsOptional() @MaxLength(500) schAddress?: string;
}
class UpdateSchoolDto extends PartialType(CreateSchoolDto) {
  @IsInt() version!: number;
}
```

### 3.2 `GradeBandDto`
```ts
class GradeBandDto {
  @IsString() @MaxLength(50) gbdLabel!: string;       // e.g. "Lower Level"
  @IsInt() @Min(0) @Max(20) gbdGradeMin!: number;
  @IsInt() @Min(0) @Max(20) gbdGradeMax!: number;
  @IsOptional() @MaxLength(500) gbdNote?: string;
}
```

### 3.3 `ScheduleDto`
```ts
class ScheduleDto {
  @IsEnum(AdmissionType) scdAdmissionType!: AdmissionType;
  // REGULAR | ROLLING | MIXED | UNDETERMINED
  @IsString() @Matches(/^\d{4}$/) scdAcademicYear!: string;

  @ValidateIf(o => !o.scdIsFreetextFallback)
  @IsDateString() scdApplyOpenAt?: string;

  @ValidateIf(o => !o.scdIsFreetextFallback)
  @IsDateString() scdApplyCloseAt?: string;

  @IsBoolean() scdIsFreetextFallback!: boolean;

  @ValidateIf(o => o.scdIsFreetextFallback)
  @IsString() @MinLength(5) scdScheduleNote?: string;     // C-105 fallback
}
```

### 3.4 `SchoolListQueryDto`
```ts
class SchoolListQueryDto {
  @IsOptional() @IsArray() @IsEnum(SchoolCategory, { each:true }) category?: SchoolCategory[];
  @IsOptional() @IsEnum(AuthStatus) authStatus?: AuthStatus;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsEnum(CurriculumSystem) curriculumSystem?: CurriculumSystem;
  @IsOptional() @IsString() nameLike?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) limit: number = 50;
  @IsOptional() @IsString() cursor?: string;
}
```

### 3.5 Response
```ts
interface SchoolDto {
  schId: string;
  schName: string;
  schNameEn: string | null;
  schCategory: SchoolCategory;
  schAuthorizationStatus: AuthStatus;
  schRegion: string | null;
  schCurriculumSystem: CurriculumSystem;
  schAdmissionNote: string | null;
  schHomepageUrl: string | null;
  schAddress: string | null;
  activeInquiryCount?: number;          // computed for list/detail
  gradeBands?: GradeBandDto[];          // detail only
  schedules?: ScheduleDto[];            // detail only
  version: number;
}
```

---

## 4. Validation & Business Rules

| ID | Rule | Layer | Error Code | HTTP |
|---|---|---|---|---|
| VR-SCH-001 | `schAuthorizationStatus=UNAUTHORIZED` ⇒ `grade_bands` count MAY be 0 (allowed flat) | UseCase | `INFO_FLAT_SCHEDULE` | 200 + info |
| VR-SCH-002 | `gbdGradeMin <= gbdGradeMax` | DTO | `VAL_GRADE_RANGE` | 400 |
| VR-SCH-003 | Cannot add grade band if `schAuthorizationStatus=UNAUTHORIZED` | UseCase | `BIZ_GRADE_BAND_AUTHORIZED_ONLY` | 422 |
| VR-SCH-004 | `scdApplyOpenAt <= scdApplyCloseAt` | DTO/UseCase | `VAL_DATE_ORDER` | 400 |
| VR-SCH-005 | If `scdIsFreetextFallback=true` then `scdScheduleNote` required (C-105) | DTO `@ValidateIf` | `VAL_SCHEDULE_NOTE_REQUIRED` | 400 |
| VR-SCH-006 | Soft-delete rejects if referenced by `csl_inquiries.inq_target_school_id` (active) | UseCase | `BIZ_SCHOOL_REFERENCED` | 409 |
| VR-SCH-007 | Schedule unique on (`sch_id`, `scd_academic_year`, `scd_admission_type`) | DB UK + Pipe | `CONFLICT_DUP_SCHEDULE` | 409 |
| BR-SCH-001 | `activeInquiryCount` updated via CSL event (`acm.csl.inquiry.created` with `inq_target_school_id`) | EventHandler | — | — |
| BR-SCH-002 | School search results boost frequently-referenced schools (descending `activeInquiryCount`) | Service | — | — |

---

## 5. Error Catalog

Standard envelope. Prefixes: `VAL_*` (DTO), `BIZ_*` (rules), `CONFLICT_*`.

---

## 6. Authorization Matrix

| Endpoint | viewer | advisor | team_lead | senior_manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /schools*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /schools/search` | — | ✅ | ✅ | ✅ | ✅ |
| `POST /schools` | — | — | ✅ | ✅ | ✅ |
| `PATCH /schools/{id}` | — | — | ✅ | ✅ | ✅ |
| `DELETE /schools/{id}` | — | — | — | — | ✅ |
| `*/grade-bands` | — | — | ✅ | ✅ | ✅ |
| `*/schedules` | — | — | ✅ | ✅ | ✅ |
| `POST /migration/import` | — | — | — | — | ✅ |

---

## 7. Cross-Module Integration

### 7.1 Inbound (events)
| Event | Effect |
|---|---|
| `acm.csl.inquiry.created` (with `inqTargetSchoolId`) | increment school's `activeInquiryCount` cache |
| `acm.csl.inquiry.dropped` | decrement |

### 7.2 Outbound
| Event | Payload | Consumers |
|---|---|---|
| `acm.sch.school.created` | `{ entId, schId }` | DSH (no immediate consumer in v1.0a) |
| `acm.sch.school.updated` | `{ entId, schId, changedFields[] }` | QNA (related Q&As re-validate link) |
| `acm.sch.school.deleted` | `{ entId, schId }` | QNA, CSL (orphan check) |

### 7.3 DI Read Ports (consumed by SCH from others)
```ts
ICslAggregationPort.countActiveInquiriesBySchool(entId, schId): Promise<number>
```

---

## 8. Performance & SLO

| ID | Endpoint | Target |
|---|---|---|
| NFR-SCH-P01 | `GET /schools` (list, 41 rows) | < 200ms p95 |
| NFR-SCH-P02 | `GET /schools/search?q=` | < 150ms p95 (typeahead) |
| NFR-SCH-P03 | `GET /schools/{id}` (with bands+schedules) | < 300ms p95 |

---

## 9. Audit & Privacy
| Hook | Trigger |
|---|---|
| AUD-SCH-001 | Any PATCH/POST/DELETE | AMB audit (full diff) |
| AUD-SCH-002 | Migration import job | log row count + quality flags |

No PII — schools are public reference data.

---

## 10. Frontend Component Map (React)

| Route | Component | API | RBAC |
|---|---|---|---|
| `/acm/sch` | `<SchListView />` | S-01 | viewer+ |
| `/acm/sch/:schId` | `<SchDetailView />` | S-02, S-10, S-20 | viewer+ |
| `/acm/sch/new` | `<SchSchoolForm />` (RHF + Zod) | S-03 | team_lead+ |
| `/acm/sch/:schId/edit` | `<SchSchoolForm />` (edit mode) | S-04 | team_lead+ |
| `/acm/sch/:schId/grade-bands` | `<SchGradeBandsPanel />` (inline editor) | S-10..S-13 | team_lead+ |
| `/acm/sch/:schId/schedules` | `<SchSchedulesPanel />` (inline editor) | S-20..S-23 | team_lead+ |

### Shared Component
- `<SchoolAutocomplete />` — used in CSL form (`inqTargetSchoolId`), QNA quick-link (FR-QNA-X01). Calls S-06.

### Hooks
```ts
useSchoolList(query)
useSchool(schId)                       // includes bands + schedules
useSchoolAutocomplete(q)               // 200ms debounce, TanStack
useUpsertSchool(); useUpsertGradeBand(); useUpsertSchedule();
```

---

## 11. NestJS Module Skeleton

```
backend/src/modules/acm-sch/
├─ presentation/
│  ├─ school.controller.ts          // S-01..S-06
│  ├─ grade-band.controller.ts      // S-10..S-13
│  ├─ schedule.controller.ts        // S-20..S-23
│  └─ migration.controller.ts       // S-30..S-31
├─ application/
│  ├─ use-cases/
│  │  ├─ create-school.usecase.ts
│  │  ├─ update-school.usecase.ts
│  │  ├─ delete-school.usecase.ts
│  │  ├─ upsert-grade-band.usecase.ts
│  │  ├─ upsert-schedule.usecase.ts
│  │  ├─ search-schools.query.ts
│  │  └─ import-migration.usecase.ts
│  └─ event-handlers/
│     └─ csl-inquiry.handler.ts      // active count updates
├─ domain/
│  ├─ entities/ (school, grade-band, schedule)
│  ├─ services/
│  │  └─ school-search.service.ts
│  └─ repositories/
├─ infrastructure/typeorm/
└─ acm-sch.module.ts
```

---

## 12. Acceptance Criteria

| AC | Description |
|---|---|
| AC-FN-SCH-01 | All 41 source schools migrated with correct authorization status split (7 authorized, others unauthorized) |
| AC-FN-SCH-02 | Authorized school MUST have ≥ 1 grade band before save |
| AC-FN-SCH-03 | Schedule freetext-fallback path saves without dates |
| AC-FN-SCH-04 | Soft-delete rejects when active CSL references school |
| AC-FN-SCH-05 | School autocomplete returns < 150ms p95 |

---

## 13. Open Items
| ID | Item |
|---|---|
| Q-FN-SCH-01 | Tagging / synonym for school search (e.g. "NLCS" matches "North London Collegiate School Jeju")? |
| Q-FN-SCH-02 | Multi-year schedule view UX |

---

## 14. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Backend Lead | TBD | — |
| Frontend Lead | TBD | — |

_End of ACM-FN-SCH-001 v1.0.0._
