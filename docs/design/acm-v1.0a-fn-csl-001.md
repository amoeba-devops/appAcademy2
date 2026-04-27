---
document_id: ACM-FN-CSL-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_requirements:
  - ACM-REQ-CSL-001 v2.1
  - ACM-REQ-001 v3.0
related_designs:
  - ACM-ERD-001 v1.0.0
  - ACM-PLAN-001 v1.0.1
related_adrs:
  - TPI-ADR-001
  - TPI-ADR-001-A1
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial CSL functional specification — REST endpoint catalog, DTOs, validation rules, state machine, RBAC, error catalog, performance contracts. Stack — React 18 (frontend) + NestJS 10 (backend, Clean Architecture).
---

# ACM-FN-CSL-001 — Counseling Management Functional Specification (CSL 모듈 기능명세서)

> **Scope**: REST API contract, DTOs, validation, state machine, RBAC, error catalog for the CSL (Counseling) module of ACM v1.0a.
> **Audience**: Backend (NestJS) + Frontend (React) developers, QA, DevOps.
> **Source of Truth**: `ACM-REQ-CSL-001 v2.1` — all FR/BR/VR IDs trace back to that requirements document.

---

## 1. Overview (개요)

### 1.1 Purpose (목적)
Translate the CSL requirements (25 fields, 6-stage pipeline, 16 business rules, 17 validation rules) into an implementable HTTP/JSON contract with explicit DTO shapes, error codes, and authorization gates.

### 1.2 Module Boundary (모듈 경계)
- **Owns**: Inquiry lifecycle (INTAKE → CLASS_STARTED), MAP test record, trial class record, enrollment counseling, payment confirmation, cancellation, remarks, migration import.
- **Does NOT own**: Class scheduling (CLS, v1.0b), score benchmarks (REF), school metadata (SCH), KPI aggregation (DSH), Q&A timeline (QNA), user authentication (AMB Core).
- **Cross-module communication**: in-process `@EventEmitter()` outbound; read-only repository interfaces inbound (no direct DB joins).

### 1.3 Architectural Layers (아키텍처 계층)
```
presentation/ (HTTP)        ←  Controllers, Guards, Pipes, Filters
   ↓
application/  (Use Cases)   ←  CommandHandlers, QueryHandlers, DTOs
   ↓
domain/       (Core)        ←  Entities, Value Objects, Repository Interfaces, Domain Events
   ↑
infrastructure/ (Adapters)  ←  TypeORM Repositories, Crypto Service, Event Bus
```
Module path: `backend/src/modules/acm-csl/`

---

## 2. REST API Endpoint Catalog (API 엔드포인트 카탈로그)

### 2.1 Base Path
```
/api/acm/csl
```
- Global prefix: `/api`
- Module prefix: `/acm/csl`
- All endpoints require `Authorization: Bearer <AMB JWT>` unless explicitly marked **Public Webhook**.
- All endpoints scoped by `ent_id` resolved from JWT via `OwnEntityGuard`.

### 2.2 Inquiry Resource (`/inquiries`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| C-01 | `GET` | `/inquiries` | List with filter/sort/paginate | `advisor+` | FR-CSL-L01..L12 |
| C-02 | `POST` | `/inquiries` | Create new inquiry (manual / phone) | `advisor+` | BR-CSL-003 |
| C-03 | `GET` | `/inquiries/{inqId}` | Detail | `advisor+` (own / team) | FR-CSL-E01 |
| C-04 | `PATCH` | `/inquiries/{inqId}` | Partial update of editable fields | `advisor+` | FR-CSL-E02 |
| C-05 | `DELETE` | `/inquiries/{inqId}` | Soft delete | `team_lead+` | FR-CSL-E04 |
| C-06 | `POST` | `/inquiries/{inqId}/restore` | Restore within 90-day window | `admin` | FR-CSL-E04 |
| C-07 | `POST` | `/inquiries/{inqId}/reveal-phone` | Audited PII reveal | `advisor+` (rate-limited) | UI-CSL-003 / NFR-CSL-S01 |
| C-08 | `POST` | `/inquiries/{inqId}/assign` | Reassign advisor | `team_lead+` | BR-CSL-005 |

### 2.3 Stage Pipeline (`/inquiries/{inqId}/transitions`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| C-10 | `GET` | `/inquiries/{inqId}/transitions` | Stage history (immutable log) | `advisor+` | FR-CSL-P02, AUD-CSL-003 |
| C-11 | `POST` | `/inquiries/{inqId}/transitions` | Forward stage transition | `advisor+` | FR-CSL-P01..P05 |
| C-12 | `POST` | `/inquiries/{inqId}/transitions/backward` | ADMIN-only backward override | `admin` | FR-CSL-P05 |
| C-13 | `POST` | `/inquiries/{inqId}/cancellations` | Drop with reason | `advisor+` | BR-CSL-007, VR-CSL-X06 |
| C-14 | `POST` | `/inquiries/{inqId}/reactivate` | DROPPED → previous_stage | `advisor+` | BR-CSL-008, Q-CSL-004 |

### 2.4 Stage-Specific Sub-Resources

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| C-20 | `POST` | `/inquiries/{inqId}/map-test` | Upsert MAP test record | `advisor+` | FR-CSL-F12..F13, BR-CSL-010 |
| C-21 | `POST` | `/inquiries/{inqId}/map-test/waiver` | Set waiver (requires approver) | `team_lead+` | BR-CSL-016, Q-CSL-002 |
| C-22 | `POST` | `/inquiries/{inqId}/trial-class` | Schedule / mark held | `advisor+` | FR-CSL-F14..F17, BR-CSL-011 |
| C-23 | `POST` | `/inquiries/{inqId}/enrollment` | Counseling outcome (F-18..F-21) | `advisor+` | FR-CSL-F18..F21 |
| C-24 | `POST` | `/inquiries/{inqId}/payment-confirmation` | Confirm tuition paid (F-22) | `senior_manager+` | BR-CSL-012 |
| C-25 | `POST` | `/inquiries/{inqId}/class-start` | Confirm class started (F-23..F-25) | `advisor+` | BR-CSL-013 |
| C-26 | `POST` | `/inquiries/{inqId}/remarks` | Append timeline note | `advisor+` | FR-CSL-F11 |
| C-27 | `GET` | `/inquiries/{inqId}/remarks` | List timeline notes | `advisor+` | FR-CSL-F11 |

### 2.5 Migration (`/migration`)

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| C-30 | `POST` | `/migration/import` | Upload xlsx, parse rows | `admin` | FR-CSL-M01..M06 |
| C-31 | `GET` | `/migration/jobs/{jobId}` | Import job status + report | `admin` | FR-CSL-M06 |
| C-32 | `GET` | `/migration/review-queue` | List `MIGRATION_AMBIGUOUS` rows | `admin` | FR-CSL-M03 |
| C-33 | `POST` | `/migration/review-queue/{rowId}/resolve` | Resolve and commit a row | `admin` | FR-CSL-M03 |

### 2.6 Webhooks (`/webhooks`) — Public, HMAC-signed

| # | Method | Path | Use Case | Auth | FR Trace |
|---|---|---|---|---|---|
| C-40 | `POST` | `/webhooks/homepage-form` | Inbound homepage submission | HMAC | BR-CSL-001 |
| C-41 | `POST` | `/webhooks/kakao-channel` | Inbound KakaoTalk message | HMAC | BR-CSL-002 |

### 2.7 Internal Read-Only Service (cross-module)
Exposed as a NestJS provider, NOT HTTP. Other modules import token `IAcmCslInquiryService`.
```ts
findById(entId, inqId): Promise<InquiryDto | null>
findByPhone(entId, phone): Promise<InquiryDto[]>
countByStage(entId, range): Promise<StageCountDto>
findOverdueByAdvisor(entId, userId): Promise<InquiryDto[]>
```

---

## 3. DTO Catalog (DTO 카탈로그)

> All DTOs use `class-validator` + `class-transformer` decorators. Korean comment after each field maps to spreadsheet column. Error codes correspond to §6.

### 3.1 `CreateInquiryDto`
```ts
class CreateInquiryDto {
  @IsDateString()  // VR-CSL-001
  inqRegisteredAt!: string;                 // F-01 등록일

  @IsEnum(InflowType)
  inqInflowType!: InflowType;               // F-02 유입경로

  @IsOptional() @IsEnum(InquirerType)
  inqInquirerType?: InquirerType;           // F-03 문의주체

  @IsBoolean()
  inqIsAnonymous!: boolean;                 // F-04 익명여부

  @IsOptional() @Length(1, 100) @Matches(NAME_REGEX)  // VR-CSL-003
  inqName?: string;                         // F-05 이름

  @IsEnum(PhoneStatus)
  inqPhoneStatus!: PhoneStatus;             // PROVIDED | DECLINED | UNKNOWN

  @ValidateIf(o => o.inqPhoneStatus === 'PROVIDED')
  @Matches(KR_MOBILE_REGEX)                 // VR-CSL-004
  inqPhone?: string;                        // F-06 연락처 (cleartext input → encrypted at infra)

  @IsOptional() @IsDateString()             // VR-CSL-002
  inqFollowupAt?: string;                   // F-07 콜백/팔로업

  @IsOptional() @IsEnum(ContactMethod)
  inqPreferredContactMethod?: ContactMethod;

  @IsOptional() @IsUUID()
  inqTargetSchoolId?: string;               // F-08 학교 (FK to SCH)

  @IsOptional() @IsEnum(GradeBand)
  inqGradeBand?: GradeBand;                 // F-09 학년

  @IsEnum(ApplyType)
  inqApplyType!: ApplyType;                 // F-10 신청유형 (REGULAR | EXAM_ONLY)

  @IsOptional() @IsEnum(ApplyPurpose)
  inqApplyPurpose?: ApplyPurpose;           // F-11 신청목적

  @IsOptional() @IsEnum(ConsentBasis)
  inqConsentBasis?: ConsentBasis;           // VERBAL | HOMEPAGE_FORM | KAKAO_TOS

  @ValidateIf(o => o.inqConsentBasis === 'VERBAL')
  @IsUUID()
  inqConsentRecordedBy?: string;            // BR-CSL-003

  @IsOptional() @MaxLength(2000)
  inqInitialRemark?: string;                // optional first remark
}
```

### 3.2 `UpdateInquiryDto`
- Partial of `CreateInquiryDto` excluding `inqIsAnonymous` (immutable after creation), `inqInflowType` (immutable), `inqConsentBasis` (immutable — replace via dedicated `/consent` endpoint in v1.1).
- Adds optimistic locking field: `@IsInt() version: number` — server returns `409 CONFLICT` with code `OPT_LOCK_FAILED` if mismatch (FR-CSL-E06).

### 3.3 `StageTransitionDto`
```ts
class StageTransitionDto {
  @IsEnum(PipelineStage)
  trnToStage!: PipelineStage;               // INTAKE..CLASS_STARTED | DROPPED

  @IsOptional() @MaxLength(500)
  trnReason?: string;                       // required when trnToStage = DROPPED OR backward

  @IsOptional() @IsBoolean()
  trnSkipMapTestAck?: boolean;              // §4.3 — required if INTAKE → TRIAL_CLASS auto-skip

  @IsOptional() @IsString()
  trnIdempotencyKey?: string;               // dedupe replays
}
```

### 3.4 `CancellationDto`
```ts
class CancellationDto {
  @IsEnum(CancellationReason)               // Q-CSL-006
  cncReasonCode!: CancellationReason;
  // ACADEMY_CANCELLED | STUDENT_ILLNESS | STUDENT_SCHEDULE_CHANGE
  // | PAYMENT_DECLINED | LOST_TO_COMPETITOR | OTHER

  @ValidateIf(o => o.cncReasonCode === 'OTHER')  // VR-CSL-X06
  @IsString() @MinLength(5) @MaxLength(500)
  cncNote?: string;

  @IsOptional() @IsUUID()
  cncCompetitorAcademyId?: string;          // when LOST_TO_COMPETITOR
}
```

### 3.5 `MapTestDto`
```ts
class MapTestDto {
  @IsBoolean()
  mptHasPriorScore!: boolean;               // §4.3 prerequisite

  @IsOptional() @IsDateString()
  mptScheduledAt?: string;                  // F-12

  @IsOptional() @IsDateString()
  mptHeldAt?: string;

  @IsOptional() @IsInt() @Min(100) @Max(300)  // VR-CSL-005
  mptScoreReading?: number;                 // F-13.R

  @IsOptional() @IsInt() @Min(100) @Max(300)
  mptScoreMath?: number;                    // F-13.M

  @IsOptional() @IsInt() @Min(100) @Max(300)
  mptScoreLanguage?: number;                // F-13.L

  @IsEnum(MapFeeStatus)
  mptFeeStatus!: MapFeeStatus;              // PAID | WAIVED | UNPAID
}

class MapTestWaiverDto {                    // POST /map-test/waiver
  @IsEnum(WaiverScenario)                   // Q-CSL-002
  mptWaiverScenario!: WaiverScenario;
  // RETAKE_WITHIN_90D | TRIAL_PROMOTION | SISTER_ACADEMY_TRANSFER

  @IsUUID()
  mptWaiverApproverId!: string;             // BR-CSL-016 — must be USER_LEVEL+

  @IsOptional() @MaxLength(500)
  mptWaiverNote?: string;
}
```

### 3.6 `TrialClassDto`
```ts
class TrialClassDto {
  @IsDateString()                           // VR-CSL-006
  tclScheduledAt!: string;                  // F-14

  @IsOptional() @IsDateString()
  tclHeldAt?: string;

  @IsOptional() @IsEnum(TrialOutcome)
  tclOutcome?: TrialOutcome;                // F-15 ATTENDED | NO_SHOW | RESCHEDULED

  @IsOptional() @IsBoolean()
  tclSundayHolidayAck?: boolean;            // BR-CSL-011 / UI-CSL-009 — required if scheduled on Sun/holiday

  @IsOptional() @IsUUID()
  tclTeacherId?: string;
}
```

### 3.7 `EnrollmentDto`
```ts
class EnrollmentDto {
  @IsEnum(EnrollmentDecision)
  enrDecision!: EnrollmentDecision;         // F-18 ENROLLED | DECLINED | PENDING

  @IsOptional() @IsInt() @Min(1) @Max(480)  // VR-CSL-007
  enrClassMinutes?: number;                 // F-20

  @IsOptional() @IsNumber() @Min(0) @Max(50_000_000)  // VR-CSL-008
  enrTuitionAmount?: number;                // F-21 (KRW)

  @IsOptional() @IsEnum(BillingCycle)
  enrBillingCycle?: BillingCycle;           // F-19

  @IsOptional() @MaxLength(500)
  enrCounselingNote?: string;
}
```

### 3.8 `PaymentConfirmationDto`
```ts
class PaymentConfirmationDto {
  @IsBoolean()
  payTuitionPaid!: boolean;                 // F-22 — true requires senior_manager (BR-CSL-012)

  @IsOptional() @IsDateString()
  payPaidAt?: string;

  @IsOptional() @MaxLength(200)
  payReference?: string;                    // bank txn ref / receipt no
}
```

### 3.9 `ClassStartDto`
```ts
class ClassStartDto {
  @IsDateString()                           // VR-CSL-009
  clsStartedAt!: string;                    // F-23

  @IsEnum(ClassStartedFlag)
  clsStarted!: ClassStartedFlag;            // F-24 YES | NO | PENDING

  @IsOptional() @IsUUID()
  clsAssignedClassId?: string;              // F-25 (FK to CLS, v1.0b)
}
```

### 3.10 `RemarkDto`
```ts
class RemarkDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  rmkBody!: string;

  @IsOptional() @IsEnum(RemarkType)
  rmkType?: RemarkType;                     // GENERAL | PRIOR_SCORE | OBJECTION | INTERNAL
}
```

### 3.11 `InquiryListQueryDto` (GET /inquiries)
```ts
class InquiryListQueryDto {
  @IsOptional() @IsDateString() registeredFrom?: string;       // L03
  @IsOptional() @IsDateString() registeredTo?: string;
  @IsOptional() @IsArray() @IsEnum(InflowType, { each: true }) inflowType?: InflowType[];          // L04
  @IsOptional() @IsArray() @IsEnum(ApplyPurpose, { each: true }) applyPurpose?: ApplyPurpose[];    // L05
  @IsOptional() @IsArray() @IsEnum(PipelineStage, { each: true }) currentStage?: PipelineStage[];  // L06
  @IsOptional() @IsUUID() assignedUserId?: string;             // L07
  @IsOptional() @IsBoolean() slaBreached?: boolean;            // L08
  @IsOptional() @IsString() nameLike?: string;                 // L09 (LIKE prefix)
  @IsOptional() @Matches(KR_MOBILE_REGEX) phoneExact?: string; // L10 — server decrypt-and-match
  @IsOptional() @IsString() sort?: string;                     // e.g. "-inq_registered_at,inq_seq_no"
  @IsOptional() @IsInt() @Min(1) @Max(200) limit: number = 50; // L12
  @IsOptional() @IsString() cursor?: string;                   // opaque cursor
}
```

### 3.12 `ImportRequestDto` & `ImportResultDto`
```ts
// multipart/form-data
class ImportRequestDto {
  @IsString() filename!: string;
  @IsBoolean() dryRun: boolean = false;
}

class ImportResultDto {
  jobId!: string;
  totalRows!: number;
  byStage!: Record<PipelineStage, number>;
  byQuality!: {
    MIGRATION_OK: number;
    MIGRATION_AMBIGUOUS: number;
    MIGRATION_DATA_ERROR: number;
    MIGRATION_STAGE_INCONSISTENT: number;
  };
  ambiguousQueueCount!: number;             // requires manual review
  durationMs!: number;
}
```

### 3.13 Response DTOs (Output)
```ts
class InquiryDto {
  inqId: string;
  inqSeqNo: number;                         // per-tenant sequence
  inqRegisteredAt: string;
  inqInflowType: InflowType;
  inqIsAnonymous: boolean;
  inqName: string | null;
  inqPhoneMasked: string | null;            // "010-****-7743"
  inqPhoneStatus: PhoneStatus;
  inqGradeBand: GradeBand | null;
  inqApplyType: ApplyType;
  inqApplyPurpose: ApplyPurpose | null;
  inqCurrentStage: PipelineStage;
  inqAssignedUserId: string | null;
  inqSlaBreached: boolean;
  inqTargetSchoolId: string | null;
  inqCreatedAt: string;
  inqUpdatedAt: string;
  inqDeletedAt: string | null;
  version: number;                          // optimistic lock
  // sub-records included only on detail GET:
  mapTest?: MapTestDto;
  trialClass?: TrialClassDto;
  enrollment?: EnrollmentDto;
  remarks?: RemarkDto[];
}
```

---

## 4. State Machine (상태 머신)

### 4.1 Service: `StageTransitionService`
Single domain service owns transition validation. Controllers MUST NOT mutate stage directly.

### 4.2 Transition Table
| From | To | Allowed? | Guard | Code on Reject |
|---|---|---|---|---|
| INTAKE | MAP_TEST | ✅ | name+phone OR anonymous→name capture | `STAGE_REQ_NAME` |
| INTAKE | TRIAL_CLASS | ⚠️ | §4.3 prerequisites OR ADMIN override | `STAGE_SKIP_NOT_ALLOWED` |
| MAP_TEST | TRIAL_CLASS | ✅ | `mpt_held_at` set | `STAGE_REQ_MAP_HELD` |
| TRIAL_CLASS | ENROLLMENT_COUNSELING | ✅ | `tcl_outcome != NO_SHOW` (or ADMIN override) | `STAGE_REQ_TRIAL_HELD` |
| ENROLLMENT_COUNSELING | PAYMENT | ✅ | `enr_decision = ENROLLED` | `STAGE_REQ_ENROLLED` |
| PAYMENT | CLASS_STARTED | ✅ | `pay_tuition_paid = true` | `STAGE_REQ_PAID` |
| any | DROPPED | ✅ | `trn_reason` non-null | `STAGE_REQ_REASON` |
| DROPPED | previous_stage | ✅ | `trn_reason='REACTIVATION'` | — |
| backward (any) | upstream | ⚠️ | `admin` only + reason | `STAGE_BACKWARD_FORBIDDEN` |

### 4.3 Skip MAP_TEST Auto-Allow (BR-CSL-006 / Q-CSL-003)
Auto-permit `INTAKE → TRIAL_CLASS` when ALL true:
1. `mptHasPriorScore = true`
2. Prior R/M scores present in `csl_remarks` with `rmkType = PRIOR_SCORE`
3. Remark recorded ≤ 12 months ago

Else require `trn_skip_map_test_ack = true` AND caller has role `team_lead+`.

### 4.4 Persistence
Each transition appends a row to `amb_acm_csl_stage_transitions` (immutable). The `inq_current_stage` column is updated atomically in the same transaction.

---

## 5. Validation Rule Catalog (검증 규칙 카탈로그)

| ID | Implementation | Layer | Error Code | HTTP |
|---|---|---|---|---|
| VR-CSL-001 | `@IsDateString` + `@MaxDate(today)` + `@MinDate(today-365)` | DTO | `VAL_REG_DATE_RANGE` | 400 |
| VR-CSL-002 | `@MaxDate(today+365)` | DTO | `VAL_FOLLOWUP_RANGE` | 400 |
| VR-CSL-003 | `@Matches(NAME_REGEX)` | DTO | `VAL_NAME_FORMAT` | 400 |
| VR-CSL-004 | `@Matches(KR_MOBILE_REGEX)` conditional | DTO | `VAL_PHONE_FORMAT` | 400 |
| VR-CSL-005 | `@Min(100) @Max(300)` per axis | DTO | `VAL_MAP_SCORE_RANGE` | 400 |
| VR-CSL-006 | Cross-field: `tclScheduledAt >= inqRegisteredAt - 14d` (warn only) | UseCase | `WARN_TRIAL_DATE_EARLY` | 200 + warn |
| VR-CSL-007 | `@Min(1) @Max(480)` | DTO | `VAL_CLASS_MINUTES` | 400 |
| VR-CSL-008 | `@Min(0) @Max(50_000_000)` | DTO | `VAL_TUITION_RANGE` | 400 |
| VR-CSL-009 | UseCase check: `clsStartedAt >= enrCreatedAt` | UseCase | `VAL_CLASS_START_ORDER` | 422 |
| VR-CSL-010 | If `mptFeeStatus=WAIVED` then waiver fields all required | UseCase | `VAL_WAIVER_FIELDS` | 422 |
| VR-CSL-X01 | Warn if `mptHasPriorScore=true` w/o PRIOR_SCORE remark | UseCase | `WARN_PRIOR_SCORE_MISSING` | 200 + warn |
| VR-CSL-X02 | Warn if `mptFeeStatus=PAID` and no `mptScheduledAt` within 7d | Cron | `WARN_MAP_NOT_SCHEDULED` | event |
| VR-CSL-X03 | If `inqIsAnonymous=true` then `inqPhoneStatus != PROVIDED` | UseCase | `VAL_ANON_NO_PHONE` | 422 |
| VR-CSL-X04 | Deny `CLASS_STARTED` without upstream completion | StageTransitionService | `VAL_STAGE_SKIP` | 422 |
| VR-CSL-X05 | If `clsStarted=YES` then `clsStartedAt <= today` | UseCase | `VAL_FUTURE_START` | 422 |
| VR-CSL-X06 | If `cncReasonCode=OTHER` then `cncNote` required | DTO `@ValidateIf` | `VAL_OTHER_REASON_NOTE` | 400 |
| VR-CSL-X07 | If `inqApplyType=EXAM_ONLY` skip ENROLL/PAY/START stages | StageTransitionService | `INFO_EXAM_ONLY_FLOW` | 200 + info |

### 5.1 Constants
```ts
export const KR_MOBILE_REGEX = /^010-\d{4}-\d{4}$/;
export const NAME_REGEX = /^[가-힣A-Za-z0-9\- ]{1,100}$/;
export const NAME_PHONE_NORMALIZE_DECLINED = ['x', 'X', '거부', '없음'];
```

---

## 6. Error Catalog (에러 카탈로그)

### 6.1 Response Shape
```jsonc
{
  "error": {
    "code": "VAL_PHONE_FORMAT",
    "message": "Phone must match Korean mobile format 010-XXXX-XXXX.",
    "messageKo": "휴대폰 번호 형식이 올바르지 않습니다.",
    "details": [
      { "field": "inqPhone", "rule": "matches", "value": "010-1234" }
    ],
    "traceId": "req-7f3a..."
  }
}
```

### 6.2 Error Code Index
| Prefix | Layer | Examples |
|---|---|---|
| `VAL_*` | Field validation (DTO) | `VAL_REG_DATE_RANGE`, `VAL_PHONE_FORMAT` |
| `STAGE_*` | State machine | `STAGE_REQ_PAID`, `STAGE_BACKWARD_FORBIDDEN` |
| `AUTH_*` | Authorization | `AUTH_ROLE_REQUIRED`, `AUTH_PHONE_REVEAL_LIMIT` |
| `CONFLICT_*` | Concurrency | `OPT_LOCK_FAILED`, `DUP_INQUIRY_PHONE` |
| `MIG_*` | Migration | `MIG_AMBIGUOUS_SCORE`, `MIG_DUPLICATE_SEQ` |
| `WARN_*` | Soft warning (200 + warn[]) | `WARN_TRIAL_DATE_EARLY`, `WARN_PRIOR_SCORE_MISSING` |
| `INFO_*` | Informational | `INFO_EXAM_ONLY_FLOW` |

---

## 7. Authorization Matrix (권한 매트릭스)

Roles inherited from AMB Core: `viewer < advisor < team_lead < senior_manager < admin`.

| Endpoint | viewer | advisor | team_lead | senior_manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /inquiries` (own) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /inquiries` (all) | — | — | ✅ | ✅ | ✅ |
| `POST /inquiries` | — | ✅ | ✅ | ✅ | ✅ |
| `PATCH /inquiries/{id}` | — | ✅ (own) | ✅ | ✅ | ✅ |
| `DELETE /inquiries/{id}` | — | — | ✅ | ✅ | ✅ |
| `POST /restore` | — | — | — | — | ✅ |
| `POST /reveal-phone` | — | ✅ (rate-limited) | ✅ | ✅ | ✅ |
| `POST /transitions` (forward) | — | ✅ | ✅ | ✅ | ✅ |
| `POST /transitions/backward` | — | — | — | — | ✅ |
| `POST /map-test/waiver` | — | — | ✅ | ✅ | ✅ |
| `POST /payment-confirmation` | — | — | — | ✅ | ✅ |
| `POST /migration/import` | — | — | — | — | ✅ |
| `POST /webhooks/*` | HMAC only | | | | |

**Implementation**: `@Roles('team_lead')` decorator + `RolesGuard` + `OwnEntityGuard` (multi-tenant) + `OwnRecordGuard` (advisor-own filter).

---

## 8. Cross-Module Integration (모듈 간 연동)

### 8.1 Outbound Domain Events
Emitted via NestJS `EventEmitter2` on the `acm.csl.*` namespace. Consumers subscribe; no FK across modules.

| Event | Payload | Consumers |
|---|---|---|
| `acm.csl.inquiry.created` | `{ entId, inqId, inflowType }` | DSH (KPI STALE), AMB Notification |
| `acm.csl.inquiry.stage_changed` | `{ entId, inqId, fromStage, toStage, actorId }` | DSH, QNA, AMB Issue API |
| `acm.csl.inquiry.dropped` | `{ entId, inqId, reasonCode }` | DSH |
| `acm.csl.inquiry.reactivated` | `{ entId, inqId, toStage }` | DSH |
| `acm.csl.map_score.recorded` | `{ entId, inqId, R, M, L, gradeBand }` | REF (benchmark fetch trigger), DSH |
| `acm.csl.class_started` | `{ entId, inqId, clsAssignedClassId, suggestedHourlyRate }` | CLS (v1.0b — suggest schedule) |
| `acm.csl.sla_breached` | `{ entId, inqId, currentStage, breachedSlaId }` | AMB Issue API (auto-create with `source:acm`) |
| `acm.csl.payment_confirmed` | `{ entId, inqId, amount, payPaidAt }` | DSH, AMB Notification |

### 8.2 Inbound Calls (Read-Only)
```ts
// Injected via DI tokens
IRefBenchmarkService.findByGradeBand(entId, gradeBand): Promise<BenchmarkDto>
ISchSchoolService.findById(entId, schoolId): Promise<SchoolDto>
IAmbUserService.findById(userId): Promise<AmbUserDto>
```

### 8.3 Webhook Payload Contracts
```ts
// POST /webhooks/homepage-form
interface HomepageFormPayload {
  submittedAt: string;
  name: string;
  phone: string;
  gradeBand: string;
  applyPurpose: string;
  consentChecked: boolean;
  recaptchaToken: string;
}
// HMAC: header `X-Trinity-Signature: sha256=<hex>`

// POST /webhooks/kakao-channel
interface KakaoChannelPayload {
  channelId: string;
  conversationId: string;
  receivedAt: string;
  // No name/phone — anonymous record (BR-CSL-002)
}
// HMAC: header `X-Kakao-Signature`
```

---

## 9. Performance & SLO Contracts (성능 / SLO)

| ID | Endpoint | Target | Verification |
|---|---|---|---|
| NFR-CSL-P01 | `GET /inquiries` (50 rows × 25 cols) | < 800ms p95 | k6 load test 100 RPS |
| NFR-CSL-P02 | `GET /inquiries?phoneExact=*` (100k corpus) | < 2s p95 | Redis-backed decrypt cache |
| NFR-CSL-P03 | `POST /inquiries/{id}/transitions` | < 300ms p95 | k6 + APM |
| NFR-CSL-P04 | `POST /migration/import` (302 rows) | < 30s end-to-end | integration test |
| NFR-CSL-S01 | `POST /reveal-phone` | 100/min/user, alert at 200/min | Redis token bucket |
| NFR-CSL-A01 | All read endpoints | 99.5% monthly uptime | uptime monitor |

---

## 10. Audit & PII Hooks (감사 / PII)

| Hook | Trigger | Implementation |
|---|---|---|
| AUD-CSL-001 | Any `PATCH /inquiries/{id}` field change | AMB Audit interceptor — diff before/after |
| AUD-CSL-002 | `POST /reveal-phone` | Dedicated PII access log table; alert at threshold |
| AUD-CSL-003 | All transition writes | append-only `amb_acm_csl_stage_transitions` |
| AUD-CSL-004 | Backward transition + bulk edit | `is_admin_action=true` flag on audit row |
| AUD-CSL-005 | Soft delete | preserve full payload; nightly purge after 90d |
| PII-CSL-001 | Phone storage | AES-256-GCM 3-field (`*_encrypted` `*_iv` `*_auth_tag`) via `CryptoService` |
| PII-CSL-002 | Logging | Pino redact paths: `req.body.inqPhone`, `res.body.*.inqPhone` |
| PII-CSL-003 | List response | `inqPhone` always replaced with `inqPhoneMasked` |
| PII-CSL-004 | Bulk export | requires `admin` + reason capture + audit row |
| PII-CSL-005 | Consent capture | per-channel: `HOMEPAGE_FORM` / `KAKAO_TOS` / `VERBAL` |

---

## 11. Frontend Component Map (프론트엔드 컴포넌트 매핑)

> Stack: React 18 + Vite + TailwindCSS + shadcn/ui + Zustand + TanStack Query + React Hook Form + Zod + react-i18next + React Router 6.

| Route | Component | API Calls | RBAC | Trace |
|---|---|---|---|---|
| `/acm/csl` | `<CslListView />` | C-01 | advisor+ | UI-CSL-001/004/007 |
| `/acm/csl/new` | `<CslCreateForm />` | C-02 | advisor+ | UI-CSL-010 |
| `/acm/csl/:inqId` | `<CslDetailView />` (6 stage tabs) | C-03 | advisor+ | UI-CSL-002 |
| `/acm/csl/:inqId/transition` | `<StageTransitionDialog />` | C-11 | advisor+ | — |
| `/acm/csl/:inqId/cancel` | `<CancellationModal />` | C-13 | advisor+ | UI-CSL-006 |
| `/acm/csl/:inqId/map-test` | `<MapTestPanel />` | C-20/C-21 | advisor+ | UI-CSL-005 |
| `/acm/csl/:inqId/trial-class` | `<TrialClassPanel />` | C-22 | advisor+ | UI-CSL-009 |
| `/acm/csl/migration` | `<CslMigrationImport />` | C-30/C-31 | admin | — |
| `/acm/csl/migration/review` | `<CslMigrationReview />` | C-32/C-33 | admin | — |

### 11.1 Shared Hooks
```ts
useInquiryList(query: InquiryListQuery)      // TanStack useQuery
useInquiry(inqId: string)
useStageTransition()                          // useMutation
useRevealPhone(inqId)                         // useMutation, rate-limit aware
```

### 11.2 Zustand Stores
- `useCslListPrefsStore` — column visibility, saved filters (FR-CSL-L02)
- `useCslSelectionStore` — multi-select for bulk edit (FR-CSL-E03, deferred to v1.0b)

### 11.3 Form Schemas (Zod)
```ts
export const CreateInquirySchema = z.object({
  inqRegisteredAt: z.string().datetime(),
  inqInflowType: InflowTypeEnum,
  inqIsAnonymous: z.boolean(),
  inqPhoneStatus: PhoneStatusEnum,
  inqPhone: z.string().regex(KR_MOBILE_REGEX).optional(),
  // ... mirrors CreateInquiryDto field-for-field
}).refine(
  (d) => !d.inqIsAnonymous || d.inqPhoneStatus !== 'PROVIDED',
  { message: 'VAL_ANON_NO_PHONE', path: ['inqPhoneStatus'] },  // VR-CSL-X03
);
```

---

## 12. NestJS Module Skeleton (모듈 골격)

```
backend/src/modules/acm-csl/
├─ presentation/
│  ├─ inquiry.controller.ts            // C-01..C-08
│  ├─ stage-transition.controller.ts   // C-10..C-14
│  ├─ stage-subresource.controller.ts  // C-20..C-27
│  ├─ migration.controller.ts          // C-30..C-33
│  ├─ webhook.controller.ts            // C-40..C-41
│  └─ guards/
│     ├─ own-record.guard.ts
│     └─ phone-reveal-rate-limit.guard.ts
├─ application/
│  ├─ use-cases/
│  │  ├─ create-inquiry.usecase.ts
│  │  ├─ update-inquiry.usecase.ts
│  │  ├─ transition-stage.usecase.ts
│  │  ├─ cancel-inquiry.usecase.ts
│  │  ├─ reactivate-inquiry.usecase.ts
│  │  ├─ record-map-test.usecase.ts
│  │  ├─ approve-map-waiver.usecase.ts
│  │  ├─ schedule-trial.usecase.ts
│  │  ├─ record-enrollment.usecase.ts
│  │  ├─ confirm-payment.usecase.ts
│  │  ├─ start-class.usecase.ts
│  │  ├─ append-remark.usecase.ts
│  │  ├─ list-inquiries.query.ts
│  │  ├─ reveal-phone.usecase.ts
│  │  ├─ assign-advisor.usecase.ts
│  │  ├─ import-migration.usecase.ts
│  │  └─ resolve-ambiguous-row.usecase.ts
│  └─ dto/                             // §3 DTOs
├─ domain/
│  ├─ entities/
│  │  ├─ inquiry.entity.ts
│  │  ├─ stage-transition.entity.ts
│  │  ├─ cancellation.entity.ts
│  │  ├─ map-test.entity.ts
│  │  ├─ trial-class.entity.ts
│  │  ├─ enrollment.entity.ts
│  │  └─ remark.entity.ts
│  ├─ services/
│  │  ├─ stage-transition.service.ts   // §4
│  │  ├─ round-robin-assignment.service.ts  // BR-CSL-005
│  │  └─ migration-parser.service.ts
│  ├─ events/
│  │  └─ csl-events.ts                 // §8.1 event constants
│  └─ repositories/                    // interfaces (ports)
│     ├─ inquiry.repository.ts
│     ├─ stage-transition.repository.ts
│     └─ ...
├─ infrastructure/
│  ├─ typeorm/
│  │  ├─ entities/                     // ORM entities mapped to amb_acm_csl_*
│  │  └─ repositories/                 // implementations
│  ├─ crypto/
│  │  └─ phone-cipher.service.ts       // AES-256-GCM 3-field
│  └─ external/
│     ├─ ref.client.ts                 // IRefBenchmarkService
│     ├─ sch.client.ts
│     └─ amb-issue.client.ts
└─ acm-csl.module.ts
```

---

## 13. Acceptance Criteria (수용 기준)

| AC | Description | Verified by |
|---|---|---|
| AC-FN-CSL-01 | All §2 endpoints respond per OpenAPI spec | Swagger contract test |
| AC-FN-CSL-02 | Every VR-CSL-* rule rejects/warns with documented error code | Jest unit tests (DTO + UseCase) |
| AC-FN-CSL-03 | State machine rejects illegal transitions per §4.2 | Jest test matrix |
| AC-FN-CSL-04 | Phone field never appears in plaintext in list/log/audit | E2E + log scan |
| AC-FN-CSL-05 | Migration import (302 rows) completes under 30s with ≥95% MIGRATION_OK | Integration test fixture |
| AC-FN-CSL-06 | Cross-module events emitted with correct payload | Event subscriber spy |
| AC-FN-CSL-07 | RBAC matrix enforced — 5 roles × 20 endpoints = 100 cases | RBAC test suite |
| AC-FN-CSL-08 | NFR-CSL-P01..P04 met under k6 load | Performance test report |

---

## 14. Open Items (미결 사항)

| ID | Item | Owner | Target |
|---|---|---|---|
| Q-FN-CSL-01 | Optimistic lock — `version` int vs `updated_at` timestamp | Backend lead | Sprint 2 design review |
| Q-FN-CSL-02 | `OPTIONS /inquiries` CORS for AMB shell embed | DevOps | Sprint 1 |
| Q-FN-CSL-03 | Soft delete cascade to sub-records (map_test, trial_class) — cascade vs orphan | Backend lead | Sprint 3 |
| Q-FN-CSL-04 | Webhook idempotency — header `X-Idempotency-Key` vs body `messageId` | Backend lead | Sprint 4 |
| Q-FN-CSL-05 | TanStack Query cache invalidation strategy after stage transition (selective vs full) | Frontend lead | Sprint 2 |

---

## 15. Approval (승인)

| Role | Name | Status | Date |
|---|---|---|---|
| PO | 김태윤 팀장 | _Pending_ | — |
| Backend Lead | TBD | — | — |
| Frontend Lead | TBD | — | — |
| QA Lead | TBD | — | — |

---

_End of ACM-FN-CSL-001 v1.0.0._
