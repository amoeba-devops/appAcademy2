---
document_id: ACM-FN-REF-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_requirements:
  - ACM-REQ-REF-001 v1.0
related_designs:
  - ACM-ERD-001 v1.0.0
  - ACM-PLAN-001 v1.0.1
  - ACM-FN-CSL-001 v1.0.0
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial Reference Materials module functional spec — 5 tables, per-update versioning (Q-003 RESOLVED), date-based historical lookup for CSL/CLS.
---

# ACM-FN-REF-001 — Reference Materials Functional Specification (참조 자료 기능명세서)

> **Scope**: REST API for the REF module — class workflow guidelines (8 exam types), level test guides (ISEE/SSAT), score benchmarks (MAP/ISEE/SSAT) with per-update versioning. Primary consumer = CSL (BR-CSL-010 gap analysis), CLS (v1.0b suggest workflow).
> **Module**: `backend/src/modules/acm-ref/`

---

## 1. Overview

### 1.1 Purpose
Knowledge-base module — curates **versioned** reference data so that historical CSL records remain reproducible (Q-003 resolution): lookup at the time of `inq_registered_at` returns the version effective on that date.

### 1.2 Module Boundary
- **Owns**: `ref_class_guidelines`, `ref_level_test_guides`, `ref_score_benchmarks`, `ref_score_benchmark_grades`, `ref_score_benchmark_modifiers`.
- **Does NOT own**: actual student scores (CSL).

---

## 2. REST API Endpoint Catalog

### 2.1 Base Path
```
/api/acm/ref
```

### 2.2 Class Guidelines (`/guidelines`)
| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| R-01 | `GET` | `/guidelines?examType=&effectiveAt=` | List by exam type, optional date filter | `viewer+` |
| R-02 | `GET` | `/guidelines/{cgdId}` | Detail | `viewer+` |
| R-03 | `POST` | `/guidelines` | Create new version (`version_no=1`) | `team_lead+` |
| R-04 | `POST` | `/guidelines/{cgdId}/new-version` | Create successor (closes prior, opens new) | `team_lead+` |
| R-05 | `PATCH` | `/guidelines/{cgdId}` | In-place edit (allowed only when `effective_to IS NULL` AND no historical lookup yet — else must use R-04) | `team_lead+` |
| R-06 | `DELETE` | `/guidelines/{cgdId}` | Soft delete (only when never effective) | `admin` |
| R-07 | `GET` | `/guidelines/history?code=` | Full version chain by `cgd_code` | `viewer+` |

### 2.3 Level Test Guides (`/level-tests`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| R-10 | `GET` | `/level-tests?examType=&effectiveAt=` | List | `viewer+` |
| R-11 | `GET` | `/level-tests/{lvlId}` | Detail | `viewer+` |
| R-12 | `POST` | `/level-tests` | Create | `team_lead+` |
| R-13 | `POST` | `/level-tests/{lvlId}/new-version` | Versioned successor | `team_lead+` |
| R-14 | `PATCH` | `/level-tests/{lvlId}` | In-place edit (same constraint as R-05) | `team_lead+` |

### 2.4 Score Benchmarks (`/benchmarks`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| R-20 | `GET` | `/benchmarks?examType=&grade=&effectiveAt=` | Lookup matching benchmark | `viewer+` |
| R-21 | `GET` | `/benchmarks/{sbmId}` | Detail with grade list + modifiers | `viewer+` |
| R-22 | `POST` | `/benchmarks` | Create with grade list | `team_lead+` |
| R-23 | `POST` | `/benchmarks/{sbmId}/new-version` | Versioned successor | `team_lead+` |
| R-24 | `PATCH` | `/benchmarks/{sbmId}` | In-place edit (constrained) | `team_lead+` |
| R-25 | `POST` | `/benchmarks/{sbmId}/grades` | Replace grade list (atomic) | `team_lead+` |
| R-26 | `POST` | `/benchmarks/{sbmId}/modifiers` | Add/replace modifier | `team_lead+` |
| R-27 | `GET` | `/benchmarks/gap-analysis?examType=MAP&grade=G3&reading=215&math=222` | Compute gap vs benchmark | `advisor+` |

### 2.5 Migration

| # | Method | Path | Auth |
|---|---|---|---|
| R-30 | `POST` | `/migration/import` | xlsx upload (guidelines + benchmarks) | `admin` |
| R-31 | `GET` | `/migration/jobs/{jobId}` | Job status | `admin` |
| R-32 | `GET` | `/migration/inherited-rows` | Rows with `sbm_data_status=INHERITED_FROM` for review | `admin` |

### 2.6 Internal Read Service (cross-module DI)
```ts
IRefBenchmarkService.findByGradeBand(entId, examType, grade, effectiveAt): Promise<BenchmarkLookupDto | null>
IRefBenchmarkService.gapAnalysis(entId, request: GapAnalysisRequest): Promise<GapAnalysisDto>
IRefGuidelineService.findByExamType(entId, examType, effectiveAt): Promise<GuidelineDto | null>
```

---

## 3. DTO Catalog

### 3.1 `ClassGuidelineCreateDto`
```ts
class ClassGuidelineCreateDto {
  @IsString() @MaxLength(50) cgdCode!: string;          // e.g. "MAP_TEST"
  @IsEnum(ExamType) cgdExamType!: ExamType;
  @IsString() @MaxLength(200) cgdLabelKr!: string;
  @IsOptional() @MaxLength(200) cgdLabelEn?: string;
  @IsOptional() @IsArray() @ValidateNested({ each:true }) @Type(() => WorkflowStep)
  cgdWorkflowSteps?: WorkflowStep[];
  @IsOptional() @MaxLength(2000) cgdRemark?: string;
  @IsEnum(DataStatus) cgdDataStatus!: DataStatus;       // COMPLETE | PARTIAL | PLACEHOLDER
  @IsDateString() cgdEffectiveFrom!: string;
}
class WorkflowStep {
  @IsInt() stepNum!: number;
  @IsEnum(WorkflowRole) role!: WorkflowRole;            // ADVISOR | TEAM_LEAD | TEACHER
  @IsString() @MaxLength(1000) description!: string;
}
```

### 3.2 `LevelTestGuideCreateDto`
```ts
class LevelTestGuideCreateDto {
  @IsEnum(LevelTestExamType) lvlExamType!: LevelTestExamType;
  // ISEE_LEVEL_TEST | SSAT_LEVEL_TEST | OTHER
  @IsEnum(GradeBasis) lvlGradeBasis!: GradeBasis;
  // TARGET_GRADE (ISEE) | CURRENT_GRADE (SSAT) — DQ #7 critical
  @IsOptional() @MaxLength(1000) lvlAssignmentRuleText?: string;
  @IsOptional() @IsUrl() lvlResourceUrl?: string;
  @IsOptional() @IsEnum(ResourceType) lvlResourceType?: ResourceType;
  @IsOptional() @IsArray() @ValidateNested({ each:true }) @Type(() => ProcedureStep)
  lvlProcedureSteps?: ProcedureStep[];
  @IsOptional() @IsInt() @Min(0) @Max(600) lvlDefaultDurationMin?: number;
  @IsDateString() lvlEffectiveFrom!: string;
}
```

### 3.3 `BenchmarkCreateDto`
```ts
class BenchmarkCreateDto {
  @IsString() @MaxLength(50) sbmCode!: string;          // e.g. "MAP_G3"
  @IsEnum(BenchmarkExamType) sbmExamType!: BenchmarkExamType;  // MAP | ISEE | SSAT
  @IsString() @MaxLength(50) sbmLevelLabel!: string;

  // MAP fields (required when sbmExamType=MAP)
  @ValidateIf(o => o.sbmExamType === 'MAP')
  @IsNumber() @Min(0) @Max(400) sbmMapReadingScore?: number;
  @ValidateIf(o => o.sbmExamType === 'MAP')
  @IsNumber() @Min(0) @Max(400) sbmMapMathScore?: number;
  @ValidateIf(o => o.sbmExamType === 'MAP')
  @IsBoolean() sbmMapNoUpperBound?: boolean;            // "X 이상" flag (DQ #1)

  // ISEE/SSAT fields
  @ValidateIf(o => o.sbmExamType !== 'MAP')
  @IsNumber() @Min(0) @Max(100) sbmGeneralPct?: number;
  @ValidateIf(o => o.sbmExamType === 'ISEE')
  @IsString() @Matches(/^\d{1,2}(-\d{1,2})?$/) sbmGeneralStanine?: string;
  @ValidateIf(o => o.sbmExamType !== 'MAP')
  @IsNumber() sbmPremiumPrivatePct?: number;
  @ValidateIf(o => o.sbmExamType === 'ISEE')
  @IsString() sbmPremiumPrivateStanine?: string;
  @ValidateIf(o => o.sbmExamType !== 'MAP')
  @IsNumber() sbmTopBoardingPct?: number;
  @ValidateIf(o => o.sbmExamType === 'ISEE')
  @IsString() sbmTopBoardingStanine?: string;

  @IsEnum(BenchmarkDataStatus) sbmDataStatus!: BenchmarkDataStatus;
  // COMPLETE | INHERITED_FROM | PLACEHOLDER
  @ValidateIf(o => o.sbmDataStatus === 'INHERITED_FROM')
  @IsUUID() sbmInheritsFromSbmId?: string;

  @IsArray() @ValidateNested({ each:true }) @Type(() => BenchmarkGrade)
  grades!: BenchmarkGrade[];                           // M:N — at least 1

  @IsOptional() @IsArray() @ValidateNested({ each:true }) @Type(() => BenchmarkModifier)
  modifiers?: BenchmarkModifier[];

  @IsDateString() sbmEffectiveFrom!: string;
}

class BenchmarkGrade {
  @IsString() @MaxLength(10) gradeLabel!: string;       // "G3" / "G5"
  @IsInt() @Min(0) @Max(20) gradeMin!: number;
  @IsInt() @Min(0) @Max(20) gradeMax!: number;
  @IsEnum(CurriculumSystem) curriculumSystem!: CurriculumSystem;
}

class BenchmarkModifier {
  @IsEnum(ModifierType) sbfModifierType!: ModifierType;
  // FOREIGN_SCHOOL | INTERNATIONAL_BOARDING | OTHER
  @IsNumber() sbfAdjustmentMin!: number;
  @IsNumber() sbfAdjustmentMax!: number;
  @IsEnum(ModifierUnit) sbfUnit!: ModifierUnit;         // POINTS | PERCENTILE
  @IsString() @MaxLength(500) sbfDescription!: string;
}
```

### 3.4 `BenchmarkLookupQueryDto`
```ts
class BenchmarkLookupQueryDto {
  @IsEnum(BenchmarkExamType) examType!: BenchmarkExamType;
  @IsString() grade!: string;                            // "G3"
  @IsOptional() @IsDateString() effectiveAt?: string;    // default = now
}
```

### 3.5 `GapAnalysisRequest` / `GapAnalysisDto`
```ts
class GapAnalysisRequest {
  @IsEnum(BenchmarkExamType) examType!: BenchmarkExamType;
  @IsString() grade!: string;
  @IsOptional() @IsNumber() reading?: number;
  @IsOptional() @IsNumber() math?: number;
  @IsOptional() @IsNumber() language?: number;
  @IsOptional() @IsNumber() percentile?: number;
  @IsOptional() @IsString() stanine?: string;
  @IsOptional() @IsBoolean() isForeignSchool?: boolean;  // applies modifier
  @IsOptional() @IsDateString() effectiveAt?: string;
}

interface GapAnalysisDto {
  benchmark: BenchmarkLookupDto;
  axes: Array<{
    name: 'READING'|'MATH'|'LANGUAGE'|'PERCENTILE';
    studentScore: number;
    benchmarkScore: number;
    delta: number;             // student - benchmark (positive = above)
    status: 'ABOVE'|'AT'|'BELOW'|'NO_DATA';
    tier: 'GENERAL'|'PREMIUM'|'TOP_BOARDING'|'NONE';
  }>;
  modifierApplied: BenchmarkModifierDto | null;
  warning: string | null;       // e.g. "Benchmark INHERITED_FROM another level"
}
```

---

## 4. Versioning Semantics (per Q-003)

### 4.1 Lifecycle
1. `POST /benchmarks` → creates `version_no=1`, `effective_from=<input>`, `effective_to=NULL`, `supersedes_id=NULL`.
2. `POST /benchmarks/{sbmId}/new-version` with `effectiveFrom=X`:
   - Sets prior version's `effective_to = X` (atomic transaction)
   - Creates new row with `version_no = prior+1`, `supersedes_id = priorId`, `effective_to = NULL`
3. `PATCH /benchmarks/{sbmId}` allowed only if:
   - `effective_to IS NULL` (currently active), AND
   - No `csl_inquiries.inq_registered_at >= effective_from` exists (no historical reference yet)
   - Else → 422 `BIZ_VERSION_LOCKED` with hint to use new-version endpoint

### 4.2 Lookup Algorithm (`findByGradeBand`)
```sql
SELECT sbm.* FROM ref_score_benchmarks sbm
JOIN ref_score_benchmark_grades sbg ON sbg.sbm_id = sbm.sbm_id
WHERE sbm.ent_id = $entId
  AND sbm.sbm_exam_type = $examType
  AND sbg.sbg_grade_min <= $gradeNum
  AND sbg.sbg_grade_max >= $gradeNum
  AND sbm.sbm_effective_from <= $effectiveAt
  AND (sbm.sbm_effective_to IS NULL OR sbm.sbm_effective_to > $effectiveAt)
  AND sbm.sbm_deleted_at IS NULL
ORDER BY sbm.sbm_effective_from DESC
LIMIT 1;
```

---

## 5. Validation & Business Rules

| ID | Rule | Layer | Error | HTTP |
|---|---|---|---|---|
| VR-REF-001 | Guideline `cgd_code` unique within `ent_id` per active version | DB UK + UseCase | `CONFLICT_DUP_CODE` | 409 |
| VR-REF-002 | `cgdEffectiveFrom > prior version's effective_from` | UseCase | `VAL_EFFECTIVE_ORDER` | 400 |
| VR-REF-003 | Workflow step `stepNum` unique within array, sequential ≥ 1 | DTO refine | `VAL_STEP_NUM` | 400 |
| VR-REF-004 | MAP benchmark — at least one of (reading, math) populated unless `noUpperBound=true` | DTO refine | `VAL_MAP_SCORE` | 400 |
| VR-REF-005 | ISEE `*_stanine` required when ISEE; SSAT must NOT have stanine | DTO `@ValidateIf` | `VAL_STANINE_PRESENCE` | 400 |
| VR-REF-006 | Benchmark must have ≥ 1 grade in `grades[]` | DTO | `VAL_GRADES_REQUIRED` | 400 |
| VR-REF-007 | `sbmInheritsFromSbmId` must reference same `examType` | UseCase | `VAL_INHERIT_TYPE` | 422 |
| VR-REF-008 | Modifier `adjustmentMin <= adjustmentMax` | DTO | `VAL_RANGE` | 400 |
| BR-REF-001 | `PATCH` rejected once historical references exist (force new-version) | UseCase | `BIZ_VERSION_LOCKED` | 422 |
| BR-REF-002 | New-version creation closes prior atomically | UseCase TX | — | — |
| BR-REF-003 | Soft-delete only allowed on never-effective rows | UseCase | `BIZ_DELETE_FORBIDDEN` | 422 |
| BR-REF-004 | ISEE `lvlGradeBasis=TARGET_GRADE`, SSAT `=CURRENT_GRADE` enforced (DQ #7) | UseCase | `BIZ_GRADE_BASIS_MISMATCH` | 422 |
| BR-REF-005 | Gap analysis applies modifier if `isForeignSchool=true` and matching modifier exists | Service | — | — |

---

## 6. Error Catalog

Standard envelope. Prefixes: `VAL_*`, `BIZ_*`, `CONFLICT_*`, `MIG_*` (e.g. `MIG_AMBIGUOUS_INHERIT`).

---

## 7. Authorization Matrix

| Endpoint | viewer | advisor | team_lead | senior_manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /guidelines*`, `/level-tests*`, `/benchmarks*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /benchmarks/gap-analysis` | — | ✅ | ✅ | ✅ | ✅ |
| `POST /*` (create) | — | — | ✅ | ✅ | ✅ |
| `POST /*/new-version` | — | — | ✅ | ✅ | ✅ |
| `PATCH /*` | — | — | ✅ | ✅ | ✅ |
| `DELETE /*` | — | — | — | — | ✅ |
| `POST /migration/import` | — | — | — | — | ✅ |

---

## 8. Cross-Module Integration

### 8.1 Inbound (events)
| Event | Effect |
|---|---|
| `acm.csl.map_score.recorded` | trigger gap analysis cache pre-warm (optional optimization) |

### 8.2 Outbound
| Event | Payload | Consumers |
|---|---|---|
| `acm.ref.benchmark.versioned` | `{ entId, sbmId, version_no, effectiveFrom }` | DSH (score distribution refresh), CSL (cache invalidate) |
| `acm.ref.guideline.versioned` | `{ entId, cgdId, version_no }` | CLS (v1.0b workflow suggestion refresh) |

### 8.3 DI Read Ports (REF consumes from others)
- None required (REF is purely reference data; no inbound queries to other modules).

### 8.4 Caching
- Redis key: `ref:benchmark:{entId}:{examType}:{grade}:{effectiveAt::date}` — TTL 1 hour.
- Invalidated on `acm.ref.benchmark.versioned`.

---

## 9. Performance & SLO

| ID | Endpoint | Target |
|---|---|---|
| NFR-REF-P01 | `GET /benchmarks?...` (lookup) | < 100ms p95 (cache hit), < 300ms (miss) |
| NFR-REF-P02 | `GET /benchmarks/gap-analysis` | < 200ms p95 |
| NFR-REF-P03 | `GET /guidelines?effectiveAt=` | < 200ms p95 |

---

## 10. Audit & Privacy
| Hook | Trigger |
|---|---|
| AUD-REF-001 | Any version creation/edit | full diff + actor |
| AUD-REF-002 | `last_reviewed_at/by` updated on `PATCH` | automatic |
| AUD-REF-003 | Migration `INHERITED_FROM` rows logged for review queue | `admin` UI |

No PII — purely reference data.

---

## 11. Frontend Component Map (React)

| Route | Component | API | RBAC |
|---|---|---|---|
| `/acm/ref/guidelines` | `<RefGuidelineList />` | R-01 | viewer+ |
| `/acm/ref/guidelines/:cgdId` | `<RefGuidelineDetail />` (workflow steps) | R-02, R-07 | viewer+ |
| `/acm/ref/guidelines/new` | `<RefGuidelineForm />` (RHF + Zod, dynamic step list) | R-03 | team_lead+ |
| `/acm/ref/level-tests` | `<RefLevelTestList />` | R-10 | viewer+ |
| `/acm/ref/level-tests/:lvlId` | `<RefLevelTestDetail />` | R-11 | viewer+ |
| `/acm/ref/benchmarks` | `<RefBenchmarkMatrix />` (matrix view: exam × level × tier) | R-20 | viewer+ |
| `/acm/ref/benchmarks/:sbmId` | `<RefBenchmarkDetail />` (grades + modifiers) | R-21 | viewer+ |
| `/acm/ref/benchmarks/new` | `<RefBenchmarkForm />` (multi-step: exam → tiers → grades → modifiers) | R-22 | team_lead+ |
| `/acm/ref/migration` | `<RefMigrationImport />` + `<InheritedRowsReview />` | R-30..R-32 | admin |

### 11.1 Shared Components
- `<RefGapAnalysisInline />` — embedded in CSL detail page `<CslDetailView />` MAP score panel. Calls R-27. Fulfills BR-CSL-010.

### 11.2 Hooks
```ts
useGuidelineList(filters)
useGuideline(cgdId)
useBenchmark(examType, grade, effectiveAt)
useGapAnalysis(req)                    // useQuery, cached 5min
useUpsertGuideline(); useNewVersionBenchmark();
```

---

## 12. NestJS Module Skeleton

```
backend/src/modules/acm-ref/
├─ presentation/
│  ├─ guideline.controller.ts        // R-01..R-07
│  ├─ level-test.controller.ts       // R-10..R-14
│  ├─ benchmark.controller.ts        // R-20..R-27
│  └─ migration.controller.ts        // R-30..R-32
├─ application/
│  ├─ use-cases/
│  │  ├─ create-guideline.usecase.ts
│  │  ├─ new-version-guideline.usecase.ts
│  │  ├─ create-level-test.usecase.ts
│  │  ├─ create-benchmark.usecase.ts
│  │  ├─ new-version-benchmark.usecase.ts
│  │  ├─ replace-benchmark-grades.usecase.ts
│  │  ├─ import-migration.usecase.ts
│  │  └─ resolve-inherited-row.usecase.ts
│  └─ queries/
│     ├─ lookup-benchmark.query.ts
│     └─ gap-analysis.query.ts
├─ domain/
│  ├─ entities/
│  ├─ services/
│  │  ├─ versioning.service.ts        // §4
│  │  ├─ gap-analysis.service.ts
│  │  └─ benchmark-lookup.service.ts
│  └─ repositories/
├─ infrastructure/
│  ├─ typeorm/
│  └─ cache/
│     └─ benchmark-cache.service.ts
└─ acm-ref.module.ts
```

---

## 13. Acceptance Criteria

| AC | Description |
|---|---|
| AC-FN-REF-01 | All 3 sub-tables (MAP/ISEE/SSAT) imported with correct grade mappings |
| AC-FN-REF-02 | Inherit-from-above rows tagged `INHERITED_FROM` with `inheritsFromSbmId` populated |
| AC-FN-REF-03 | `PATCH` rejected when historical CSL reference exists |
| AC-FN-REF-04 | Date-based lookup returns correct version for any `effectiveAt` |
| AC-FN-REF-05 | Gap analysis applies foreign-school modifier when flag set |
| AC-FN-REF-06 | ISEE/SSAT `gradeBasis` enforced (TARGET vs CURRENT) |
| AC-FN-REF-07 | RBAC matrix enforced |

---

## 14. Open Items

| ID | Item |
|---|---|
| Q-FN-REF-01 | Cache eviction granularity — per-key vs global flush |
| Q-FN-REF-02 | UI for editing `workflowSteps` JSONB — sortable list vs JSON editor |
| Q-FN-REF-03 | Migration auto-resolution of "X 이상" text → `noUpperBound` flag |

---

## 15. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Backend Lead | TBD | — |
| Frontend Lead | TBD | — |

_End of ACM-FN-REF-001 v1.0.0._
