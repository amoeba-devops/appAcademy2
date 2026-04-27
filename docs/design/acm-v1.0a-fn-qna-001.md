---
document_id: ACM-FN-QNA-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_requirements:
  - ACM-REQ-QNA-001 v1.0
related_designs:
  - ACM-ERD-001 v1.0.0
  - ACM-PLAN-001 v1.0.1
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial Q&A (정기상담) module functional spec — 3 tables, FAQ promotion, threading, dual-tone (internal/external) responses, cleanse migration per Q-004.
---

# ACM-FN-QNA-001 — Regular Counseling (정기상담) Functional Specification

> **Scope**: REST API for the QNA module — Q&A records (3 tables: records, record_students, categories), threading, FAQ promotion, cross-module quick-links, cleanse migration (Q-004).
> **Module**: `backend/src/modules/acm-qna/`
> **Distinction**: Q&A here = **정기상담** (post-enrollment recurring questions), distinct from CSL **신규상담**.

---

## 1. Overview

### 1.1 Purpose
Structured Q&A repository — per-student timeline + searchable FAQ knowledge base + tone-polishing helper for parent-facing replies.

### 1.2 Module Boundary
- **Owns**: `qna_records`, `qna_record_students`, `qna_categories`. Threads computed dynamically from `qna_thread_parent_id`.
- **Does NOT own**: students (CSL/AMB users), schools (SCH), classes (CLS), benchmarks (REF) — referenced via nullable FK.

---

## 2. REST API Endpoint Catalog

### 2.1 Base Path
```
/api/acm/qna
```

### 2.2 Records (`/records`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| Q-01 | `GET` | `/records` | List with filters/full-text search | `viewer+` |
| Q-02 | `POST` | `/records` | Create new Q&A | `advisor+` |
| Q-03 | `GET` | `/records/{qnaId}` | Detail (with thread) | `viewer+` |
| Q-04 | `PATCH` | `/records/{qnaId}` | Update | `advisor+` (own) |
| Q-05 | `DELETE` | `/records/{qnaId}` | Soft delete | `team_lead+` |
| Q-06 | `POST` | `/records/{qnaId}/respond` | Add response (move OPEN→RESPONDED) | `advisor+` |
| Q-07 | `POST` | `/records/{qnaId}/resolve` | Mark resolved + `resolutionStatus` | `advisor+` |
| Q-08 | `POST` | `/records/{qnaId}/escalate` | Escalate to team-lead | `advisor+` |
| Q-09 | `POST` | `/records/{qnaId}/reply` | Create thread follow-up | `advisor+` |
| Q-10 | `GET` | `/records/{qnaId}/thread` | Full thread chain | `viewer+` |
| Q-11 | `POST` | `/records/{qnaId}/students` | Replace student linkage | `advisor+` |

### 2.3 FAQ (`/faq`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| Q-20 | `GET` | `/faq?category=&q=` | FAQ-only browse + search | `viewer+` |
| Q-21 | `POST` | `/records/{qnaId}/promote-faq` | Promote to FAQ | `team_lead+` |
| Q-22 | `POST` | `/records/{qnaId}/demote-faq` | Demote | `admin` |
| Q-23 | `POST` | `/records/{qnaId}/use-faq` | Tracks usage; returns answer text for clipboard | `advisor+` |

### 2.4 Categories (`/categories`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| Q-30 | `GET` | `/categories` | List | `viewer+` |
| Q-31 | `POST` | `/categories` | Create | `admin` |
| Q-32 | `PATCH` | `/categories/{catId}` | Rename / disable | `admin` |
| Q-33 | `DELETE` | `/categories/{catId}` | Soft delete (rejects if records reference) | `admin` |
| Q-34 | `POST` | `/records/bulk-recategorize` | Bulk re-categorize migration cleanup | `admin` |

### 2.5 Per-Student Timeline (`/students/{userId}/qna`)

| # | Method | Path | Use Case | Auth |
|---|---|---|---|---|
| Q-40 | `GET` | `/students/{userId}/qna` | Per-student timeline | `advisor+` |
| Q-41 | `GET` | `/students/{userId}/qna/export` | PDF export for handoff | `team_lead+` |

### 2.6 Migration

| # | Method | Path | Auth |
|---|---|---|---|
| Q-50 | `POST` | `/migration/import` | xlsx upload (cleanse rule) | `admin` |
| Q-51 | `GET` | `/migration/jobs/{jobId}` | Job status + report | `admin` |
| Q-52 | `GET` | `/migration/review-queue` | `MIGRATION_AMBIGUOUS` rows | `admin` |
| Q-53 | `POST` | `/migration/review-queue/{rowId}/resolve` | Resolve + commit | `admin` |

### 2.7 Internal Read-Only Service (cross-module DI)
```ts
IQnaSearchService.findRelatedToSchool(entId, schId): Promise<QnaSummaryDto[]>
IQnaSearchService.findRelatedToInquiry(entId, inqId): Promise<QnaSummaryDto[]>
IQnaSearchService.findRelatedToClass(entId, classId): Promise<QnaSummaryDto[]>
IQnaSearchService.findRelatedToBenchmark(entId, sbmId): Promise<QnaSummaryDto[]>
```

---

## 3. DTO Catalog

### 3.1 `CreateQnaDto`
```ts
class CreateQnaDto {
  @IsOptional() @IsDateString() qnaConsultedAt?: string;     // default = now()

  @IsOptional() @MaxLength(5000) qnaQuestionText?: string;   // optional if reply (thread)
  @IsOptional() @MaxLength(200) qnaQuestionSummary?: string; // auto-generated if absent
  @IsEnum(QnaChannel) qnaChannel!: QnaChannel;
  // KAKAO_CHANNEL | PHONE | EMAIL | IN_PERSON | OTHER

  @IsOptional() @MaxLength(10000) qnaResponseInternal?: string;
  @IsOptional() @MaxLength(10000) qnaResponseExternal?: string;
  @IsEnum(ResponseStatus) qnaResponseStatus!: ResponseStatus;
  // DRAFT | INTERNAL_ONLY | EXTERNAL_READY | DELIVERED

  @IsUUID() qnaCategoryId!: string;
  @IsOptional() @IsArray() @IsString({ each:true }) qnaSubcategoryTags?: string[];
  @IsBoolean() qnaIsGeneral!: boolean;

  @IsOptional() @IsArray() @ValidateNested({ each:true }) @Type(() => StudentLink)
  students?: StudentLink[];                                  // empty if qnaIsGeneral=true

  @IsOptional() @IsUUID() qnaRelatedSchoolId?: string;
  @IsOptional() @IsUUID() qnaRelatedInquiryId?: string;
  @IsOptional() @IsUUID() qnaRelatedClassId?: string;
  @IsOptional() @IsUUID() qnaRelatedRefBenchmarkId?: string;

  @IsOptional() @IsUUID() qnaThreadParentId?: string;
}

class StudentLink {
  @IsUUID() qrsStudentUserId!: string;
  @IsString() @MaxLength(100) qrsStudentNameSnapshot!: string;
  @IsOptional() @IsUUID() qrsInquiryId?: string;
}
```

### 3.2 `UpdateQnaDto`
- Partial of `CreateQnaDto` excluding `qnaThreadParentId` (immutable).
- Adds `version: int` for optimistic locking.

### 3.3 `RespondDto`
```ts
class RespondDto {
  @IsString() @MinLength(1) @MaxLength(10000) qnaResponseInternal!: string;
  @IsOptional() @MaxLength(10000) qnaResponseExternal?: string;
  @IsEnum(ResponseStatus) qnaResponseStatus!: ResponseStatus;
}
```

### 3.4 `ResolveDto`
```ts
class ResolveDto {
  @IsEnum(ResolutionStatus) qnaResolutionStatus!: ResolutionStatus;
  // CONFIRMED_RESOLVED | UNCONFIRMED | UNSATISFIED | NA

  @ValidateIf(o => o.qnaResolutionStatus === 'UNSATISFIED')
  @IsBoolean() promptComplaintLog?: boolean;             // if true → UI prompts to log DSH complaint (FR-DSH-C07)
}
```

### 3.5 `EscalateDto`
```ts
class EscalateDto {
  @IsUUID() qnaAssignedTo!: string;
  @IsString() @MaxLength(500) reason!: string;
}
```

### 3.6 `PromoteFaqDto`
```ts
class PromoteFaqDto {
  @IsEnum(FaqVisibility) qnaFaqVisibility!: FaqVisibility;
  // ADVISOR_ONLY | ALL_USER | INCLUDE_TEACHER
}
```

### 3.7 `QnaListQueryDto`
```ts
class QnaListQueryDto {
  @IsOptional() @IsString() q?: string;                       // full-text (FR-QNA-S01)
  @IsOptional() @IsArray() @IsUUID('4', { each:true }) categoryIds?: string[];
  @IsOptional() @IsUUID() studentUserId?: string;
  @IsOptional() @IsDateString() consultedFrom?: string;
  @IsOptional() @IsDateString() consultedTo?: string;
  @IsOptional() @IsBoolean() isFaq?: boolean;
  @IsOptional() @IsArray() @IsEnum(QnaStatus, { each:true }) status?: QnaStatus[];
  @IsOptional() @IsEnum(QnaChannel) channel?: QnaChannel;
  @IsOptional() @IsUUID() respondedBy?: string;
  @IsOptional() @IsEnum(MigrationQualityFlag) migrationQualityFlag?: MigrationQualityFlag;
  @IsOptional() @IsString() sort?: string;                    // default "-qna_consulted_at"
  @IsOptional() @IsInt() @Min(1) @Max(200) limit: number = 50;
  @IsOptional() @IsString() cursor?: string;
}
```

### 3.8 `BulkRecategorizeDto`
```ts
class BulkRecategorizeDto {
  @IsArray() @IsUUID('4', { each:true }) qnaIds!: string[];   // max 500
  @IsUUID() targetCategoryId!: string;
  @IsOptional() @MaxLength(500) reason?: string;
}
```

### 3.9 Response
```ts
interface QnaRecordDto {
  qnaId: string;
  qnaSeqNo: number;
  qnaConsultedAt: string;
  qnaRespondedAt: string | null;
  qnaQuestionText: string | null;
  qnaQuestionSummary: string;
  qnaChannel: QnaChannel;
  qnaResponseInternal: string;
  qnaResponseExternal: string | null;       // null if NOT promoted/polished
  qnaResponseStatus: ResponseStatus;
  qnaCategoryId: string;
  qnaCategoryLabelKr: string;
  qnaSubcategoryTags: string[];
  qnaIsGeneral: boolean;
  qnaIsFaq: boolean;
  qnaFaqVisibility: FaqVisibility | null;
  qnaStatus: QnaStatus;
  qnaResolutionStatus: ResolutionStatus | null;
  qnaThreadParentId: string | null;
  qnaThreadRootId: string | null;
  students: StudentLinkDto[];                // empty if isGeneral=true
  related: {
    schoolId: string | null;
    inquiryId: string | null;
    classId: string | null;
    refBenchmarkId: string | null;
  };
  qnaRespondedBy: string | null;
  qnaAssignedTo: string | null;
  qnaCreatedAt: string;
  qnaUpdatedAt: string;
  version: number;
}
```

---

## 4. Validation & Business Rules

| ID | Rule | Layer | Error | HTTP |
|---|---|---|---|---|
| VR-QNA-001 | Either `qnaQuestionText` OR `qnaThreadParentId` must be present | UseCase | `VAL_QUESTION_OR_THREAD` | 422 |
| VR-QNA-002 | If `qnaIsGeneral=false` then `students[]` non-empty | UseCase | `VAL_STUDENTS_REQUIRED` | 422 |
| VR-QNA-003 | If `qnaIsGeneral=true` then `students[]` empty | UseCase | `VAL_GENERAL_NO_STUDENTS` | 422 |
| VR-QNA-004 | `qnaCategoryId` exists & active | UseCase | `VAL_CATEGORY_INVALID` | 422 |
| VR-QNA-005 | `qnaThreadParentId` belongs to same `entId` | UseCase | `VAL_THREAD_TENANT` | 422 |
| VR-QNA-006 | Promote-FAQ requires `qnaStatus=RESOLVED` | UseCase | `BIZ_FAQ_NOT_RESOLVED` | 422 |
| VR-QNA-007 | Bulk recategorize ≤ 500 records | DTO | `VAL_BULK_SIZE` | 400 |
| VR-QNA-008 | `qnaResponseExternal` cannot be set when `qnaResponseStatus=DRAFT` | DTO refine | `VAL_EXTERNAL_DRAFT` | 400 |
| BR-QNA-001 | Group student split — comma-separated names → multiple `qrs_*` rows on migration (finding #1) | Service | — | — |
| BR-QNA-002 | Migration cleanse — drop rows where both 질문 & 응답 empty (Q-004 / FR-QNA-MG02) | Service | — | — |
| BR-QNA-003 | Response-only row migration — auto-link to prior row's student as thread follow-up if same student; else `MIGRATION_AMBIGUOUS` | Service | — | — |
| BR-QNA-004 | All migrated responses go to `qnaResponseInternal` (never external); status=`INTERNAL_ONLY` (finding #11) | Service | — | — |
| BR-QNA-005 | `qnaResponseExternal` NEVER appears via parent portal — internal field only (PII boundary) | Service | — | — |
| BR-QNA-006 | Resolution status `UNSATISFIED` triggers DSH complaint-log prompt (FR-DSH-C07 cross-link) | EventEmitter | — | — |
| BR-QNA-007 | FAQ promotion captures `qnaFaqPromotedBy` + timestamp | UseCase | — | — |
| BR-QNA-008 | `qnaThreadRootId` denormalized: equals self for root, equals parent's root otherwise | Service | — | — |

---

## 5. Error Catalog

Standard envelope. Prefixes: `VAL_*`, `BIZ_*`, `CONFLICT_*` (`OPT_LOCK_FAILED`), `MIG_*`.

---

## 6. Authorization Matrix

| Endpoint | viewer | advisor | team_lead | senior_manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /records*`, `/faq*`, `/categories*` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /records` | — | ✅ | ✅ | ✅ | ✅ |
| `PATCH /records/{id}` | — | ✅ (own) | ✅ | ✅ | ✅ |
| `DELETE /records/{id}` | — | — | ✅ | ✅ | ✅ |
| `POST /respond` `/resolve` `/escalate` `/reply` | — | ✅ | ✅ | ✅ | ✅ |
| `POST /promote-faq` | — | — | ✅ | ✅ | ✅ |
| `POST /demote-faq` | — | — | — | — | ✅ |
| `POST /categories*` | — | — | — | — | ✅ |
| `POST /bulk-recategorize` | — | — | — | — | ✅ |
| `POST /migration/*` | — | — | — | — | ✅ |
| FAQ visibility filter | per `qna_faq_visibility` ENUM | | | | |

---

## 7. Cross-Module Integration

### 7.1 Inbound (events / DI)
| Source | Effect |
|---|---|
| `acm.csl.inquiry.dropped` (with reactivation) | Q&A history accessible from CSL detail (read-only) |
| `acm.dsh.complaint.logged` (linked to qnaId) | mark `qna_resolution_status=UNSATISFIED` if not already |
| `acm.sch.school.deleted` | warn if any QNA references; do not auto-null |

### 7.2 Outbound Events
| Event | Payload | Consumers |
|---|---|---|
| `acm.qna.record.created` | `{ entId, qnaId, isFaq }` | DSH (counts), AMB Notification |
| `acm.qna.record.resolved` | `{ entId, qnaId, resolutionStatus }` | DSH |
| `acm.qna.faq.promoted` | `{ entId, qnaId }` | DSH |
| `acm.qna.unsatisfied` | `{ entId, qnaId, studentIds[] }` | DSH (auto-prompt complaint) |

### 7.3 DI Read Ports (consumed by QNA)
```ts
ISchSchoolService.findById(entId, schId)
ICslInquiryService.findById(entId, inqId)
IRefBenchmarkService.findById(entId, sbmId)
IAmbUserService.findById(userId)
```

### 7.4 Full-Text Search
- PostgreSQL GIN index on `to_tsvector('simple', coalesce(qna_question_text,'') || ' ' || coalesce(qna_response_internal,'') || ' ' || coalesce(qna_response_external,''))`.
- Korean tokenization via `pg_bigm` extension (workspace standard).

---

## 8. Performance & SLO

| ID | Endpoint | Target |
|---|---|---|
| NFR-QNA-P01 | `GET /records?q=` (full-text, 1k corpus) | < 400ms p95 |
| NFR-QNA-P02 | `GET /students/{id}/qna` (timeline) | < 300ms p95 |
| NFR-QNA-P03 | `POST /records` | < 250ms p95 |
| NFR-QNA-P04 | Migration import (~83 rows) | < 10s end-to-end |

---

## 9. Audit & Privacy

| Hook | Trigger | Implementation |
|---|---|---|
| AUD-QNA-001 | Any PATCH/DELETE | full diff |
| AUD-QNA-002 | FAQ promote/demote | dedicated audit row |
| AUD-QNA-003 | Bulk recategorize | log all affected `qnaId`s + actor |
| PII-QNA-001 | `qnaResponseInternal` may contain PII (parent statements) | `qna_visibility` ENUM enforced; default `ENTITY` |
| PII-QNA-002 | `qnaResponseExternal` is parent-facing — `qnaResponseInternal` MUST NEVER appear in any parent-portal response (architectural; v2.0+) | Service layer guard |

---

## 10. Frontend Component Map (React)

| Route | Component | API | RBAC |
|---|---|---|---|
| `/acm/qna` | `<QnaListView />` (search bar + filters) | Q-01 | viewer+ |
| `/acm/qna/new` | `<QnaCreateForm />` (RHF + Zod, dual-pane internal/external editor) | Q-02 | advisor+ |
| `/acm/qna/:qnaId` | `<QnaDetailView />` (with thread, related panel) | Q-03, Q-10 | viewer+ |
| `/acm/qna/:qnaId/reply` | `<QnaReplyForm />` (thread follow-up) | Q-09 | advisor+ |
| `/acm/qna/faq` | `<QnaFaqBrowse />` | Q-20 | viewer+ |
| `/acm/qna/categories` | `<QnaCategoryAdmin />` | Q-30..Q-33 | admin |
| `/acm/qna/migration` | `<QnaMigrationImport />` + `<QnaMigrationReview />` | Q-50..Q-53 | admin |

### 10.1 Embedded Components (cross-module)
- `<QnaQuickAddButton />` — embedded in CSL student detail; pre-fills student + opens modal
- `<QnaRelatedPanel />` — embedded in SCH/CSL/CLS/REF detail pages; shows related Q&As (cross-module FR-QNA-X05)
- `<QnaTimelinePanel />` — per-student timeline embed (FR-QNA-H01)
- `<TonePolisher />` — text editor add-on with emoji palette + greeting/closing template (FR-QNA-P01..P04)

### 10.2 Hooks
```ts
useQnaList(query)
useQna(qnaId)
useQnaThread(rootId)
useStudentQnaTimeline(userId)
useFaqBrowse(query)
useCreateQna(); useRespond(); useResolve(); useEscalate(); usePromoteFaq();
```

### 10.3 Zustand Stores
- `useQnaFilterStore` — saved filter presets (per-user, server-synced)
- `useQnaTagAutocompleteStore` — recent tags cache for FR-QNA-C04

### 10.4 Global FAQ Hotkey (FR-QNA-F03)
- `Ctrl+K` opens `<QnaFaqQuickSearch />` modal (Cmdk-style); pulls Q-20.

---

## 11. NestJS Module Skeleton

```
backend/src/modules/acm-qna/
├─ presentation/
│  ├─ record.controller.ts             // Q-01..Q-11
│  ├─ faq.controller.ts                // Q-20..Q-23
│  ├─ category.controller.ts           // Q-30..Q-34
│  ├─ student-timeline.controller.ts   // Q-40..Q-41
│  └─ migration.controller.ts          // Q-50..Q-53
├─ application/
│  ├─ use-cases/
│  │  ├─ create-qna.usecase.ts
│  │  ├─ update-qna.usecase.ts
│  │  ├─ respond-qna.usecase.ts
│  │  ├─ resolve-qna.usecase.ts
│  │  ├─ escalate-qna.usecase.ts
│  │  ├─ reply-qna.usecase.ts
│  │  ├─ promote-faq.usecase.ts
│  │  ├─ demote-faq.usecase.ts
│  │  ├─ use-faq.usecase.ts            // tracks usage count
│  │  ├─ link-students.usecase.ts
│  │  ├─ bulk-recategorize.usecase.ts
│  │  ├─ import-migration.usecase.ts
│  │  └─ resolve-ambiguous-row.usecase.ts
│  ├─ queries/
│  │  ├─ search-qna.query.ts            // GIN + pg_bigm
│  │  ├─ list-faq.query.ts
│  │  └─ student-timeline.query.ts
│  └─ event-handlers/
│     ├─ csl-events.handler.ts
│     └─ dsh-complaint.handler.ts
├─ domain/
│  ├─ entities/ (qna-record, qna-record-student, qna-category)
│  ├─ services/
│  │  ├─ thread.service.ts              // BR-QNA-008 root computation
│  │  ├─ tone-polisher.service.ts       // optional template/emoji helper API
│  │  └─ migration-parser.service.ts
│  └─ repositories/
├─ infrastructure/
│  ├─ typeorm/
│  └─ search/
│     └─ pg-fulltext.adapter.ts
└─ acm-qna.module.ts
```

---

## 12. Acceptance Criteria

| AC | Description |
|---|---|
| AC-FN-QNA-01 | Migration cleanse drops rows where both 질문 & 응답 empty (~952 expected) |
| AC-FN-QNA-02 | Group student names split into multiple `qrs_*` rows |
| AC-FN-QNA-03 | Response-only rows linked as thread follow-up where unambiguous; else flagged |
| AC-FN-QNA-04 | FAQ promotion blocked unless `qnaStatus=RESOLVED` |
| AC-FN-QNA-05 | Per-student timeline includes Q&As where student is in junction table (group support) |
| AC-FN-QNA-06 | Full-text search returns < 400ms p95 with Korean tokenization |
| AC-FN-QNA-07 | `qnaResponseInternal` never returned via portal endpoints (architectural — verified via lint rule) |
| AC-FN-QNA-08 | `UNSATISFIED` resolution emits `acm.qna.unsatisfied` event consumed by DSH |

---

## 13. Open Items

| ID | Item |
|---|---|
| Q-FN-QNA-01 | Initial seed of 6 categories (§2.4 of REQ) — finalize naming with PO |
| Q-FN-QNA-02 | `pg_bigm` vs `pg_trgm` for Korean full-text — confirm DBA preference |
| Q-FN-QNA-03 | Tone-polisher v2 — LLM-based suggestion vs static template only |
| Q-FN-QNA-04 | Threading depth limit (1 level vs unlimited) |
| Q-FN-QNA-05 | FAQ usage analytics — per-record vs per-category aggregation |

---

## 14. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Backend Lead | TBD | — |
| Frontend Lead | TBD | — |

_End of ACM-FN-QNA-001 v1.0.0._
