---
document_id: ACM-ERD-001
version: 1.0.0
status: Draft
created: 2026-04-26
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
product_code: ACM
sub_phase: v1.0a
parent_documents:
  - ACM-PLAN-001 v1.0.0 (Work Plan)
  - ACM-REQ-001 v3.0
  - ACM-REQ-CSL-001 v2.1
  - ACM-REQ-DSH-001 v1.0
  - ACM-REQ-SCH-001 v1.0
  - ACM-REQ-REF-001 v1.0
  - ACM-REQ-QNA-001 v1.0
related_documents:
  - ACM-FN-{module}-001 (to author per module)
  - ACM-SEQ-* (to author per cross-module flow)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial ERD for ACM v1.0a — 5 modules (DSH/CSL/SCH/REF/QNA), 22 tables in db_amb under amb_acm_* prefix.
---

# ACM v1.0a — Entity Relationship Diagram (학원관리앱 ERD)

> **Scope**: 5 modules in v1.0a (DSH, CSL, SCH, REF, QNA) — total **22 tables**.
> **Database**: `db_amb` (shared with AMB Core). Prefix: `amb_acm_*`.
> **Tenant boundary**: Every business table carries `ent_id UUID NOT NULL` (FK → `amb_entities.ent_id`); enforced by `OwnEntityGuard`.
> **CLS module**: Out of scope for this ERD (covered in ACM-ERD-CLS-001 for v1.0b).

---

## 1. Overview (개요)

### 1.1 Conventions (규약)

| Item | Rule | Example |
|---|---|---|
| Schema | `db_amb` shared | — |
| Table | `amb_acm_{module}_{plural}` | `amb_acm_csl_inquiries` |
| PK | `{prefix}_id UUID v4` | `inq_id` (CHAR(36)) |
| FK | matching parent column name | `inq_id` in child tables |
| Tenant | `ent_id UUID NOT NULL` (every business table) | indexed, OwnEntityGuard enforced |
| Audit | `{prefix}_created_at`, `{prefix}_updated_at` (TIMESTAMP NOT NULL DEFAULT now()) | — |
| Soft-delete | `{prefix}_deleted_at` (TIMESTAMP NULL) | NFR-013 |
| ENUM | Stored as `VARCHAR(40)` with CHECK constraint; UPPER_SNAKE values | `INTAKE`, `MAP_TEST` |
| Encryption | 3-field: `*_encrypted` (BYTEA) + `*_iv` (BYTEA) + `*_auth_tag` (BYTEA) | `inq_phone_encrypted` |
| Versioning | `{prefix}_version_no` + `{prefix}_effective_from/to` (REF only) | `cgd_version_no` |
| JSONB | for flexible/array structures | `cgd_workflow_steps` |

### 1.2 Module → Table Map

| Module | Tables | Count |
|---|---|---|
| **CSL** | inquiries, map_tests, trial_classes, enrollments, stage_transitions, cancellations, remarks | 7 |
| **DSH** | daily_kpi, manual_inputs, metric_definitions, complaints | 4 |
| **SCH** | schools, grade_bands, schedules | 3 |
| **REF** | class_guidelines, level_test_guides, score_benchmarks, score_benchmark_grades, score_benchmark_modifiers | 5 |
| **QNA** | records, record_students, categories | 3 |
| **Total** | — | **22** |

### 1.3 External References (외부 참조)

| FK | Refers to | Module |
|---|---|---|
| `ent_id` | `amb_entities.ent_id` (AMB Core) | All tables |
| `*_user_id` | `amb_users.user_id` (AMB Core) | actor / advisor / approver fields |
| (future) `cls_*_id` | `amb_acm_cls_*` (v1.0b) | CSL.F-24 trigger; placeholder column only in v1.0a |

---

## 2. High-Level Cross-Module ERD (모듈 간 통합 다이어그램)

```mermaid
erDiagram
    AMB_ENTITIES ||--o{ CSL_INQUIRIES : "owns (ent_id)"
    AMB_ENTITIES ||--o{ DSH_DAILY_KPI : "owns"
    AMB_ENTITIES ||--o{ SCH_SCHOOLS : "owns"
    AMB_ENTITIES ||--o{ REF_CLASS_GUIDELINES : "owns"
    AMB_ENTITIES ||--o{ QNA_RECORDS : "owns"

    CSL_INQUIRIES ||--o{ CSL_MAP_TESTS : "1..N"
    CSL_INQUIRIES ||--o{ CSL_TRIAL_CLASSES : "1..N"
    CSL_INQUIRIES ||--o{ CSL_ENROLLMENTS : "1..1 logical"
    CSL_INQUIRIES ||--o{ CSL_STAGE_TRANSITIONS : "1..N (audit)"
    CSL_INQUIRIES ||--o{ CSL_CANCELLATIONS : "1..N"
    CSL_INQUIRIES ||--o{ CSL_REMARKS : "1..N (timeline)"

    SCH_SCHOOLS ||--o{ SCH_GRADE_BANDS : "1..N (authorized only)"
    SCH_SCHOOLS ||--o{ SCH_SCHEDULES : "1..N"

    REF_CLASS_GUIDELINES ||--o{ REF_CLASS_GUIDELINES : "supersedes (version)"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARK_GRADES : "1..N"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARK_MODIFIERS : "0..N"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARKS : "inherits_from"

    QNA_RECORDS ||--o{ QNA_RECORD_STUDENTS : "1..N (group)"
    QNA_CATEGORIES ||--o{ QNA_RECORDS : "categorizes"
    QNA_RECORDS ||--o{ QNA_RECORDS : "thread_parent_id"

    %% Cross-module logical references (no FK, soft links via lookup)
    CSL_MAP_TESTS }o..o{ REF_SCORE_BENCHMARKS : "lookup (asOfDate)"
    QNA_RECORDS }o..o{ SCH_SCHOOLS : "qna_related_school_id (nullable)"
    QNA_RECORDS }o..o{ CSL_INQUIRIES : "qna_related_inquiry_id (nullable)"
    QNA_RECORDS }o..o{ REF_SCORE_BENCHMARKS : "qna_related_benchmark_id (nullable)"

    %% Async event flow (no FK)
    CSL_INQUIRIES }o..o{ DSH_DAILY_KPI : "STALE marking event"
```

### 2.1 Key Cross-Module Relationships

| From | To | Type | Purpose |
|---|---|---|---|
| `csl_map_tests` (F-13 score) | `ref_score_benchmarks` | Soft lookup by (exam_type, grade, asOfDate) | Inline gap analysis (BR-CSL-010) |
| `csl_inquiries` (F-24 class_started) | `cls_classes` (v1.0b) | Cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED` | v1.0a: emits event only, no FK |
| `csl_*` (any CRUD) | `dsh_daily_kpi` | Domain event → STALE marking | Lazy recompute |
| `qna_records` | `sch_schools` / `csl_inquiries` / `ref_score_benchmarks` | Optional FK (nullable) | Cross-module Q&A attach |
| Any module SLA breach | AMB Core Issue API | One-way HTTP | `source:acm` labeled tasks |

---

## 3. CSL — Counseling Management (신규상담)

### 3.1 Module ERD

```mermaid
erDiagram
    CSL_INQUIRIES ||--o{ CSL_MAP_TESTS : "1..N"
    CSL_INQUIRIES ||--o{ CSL_TRIAL_CLASSES : "1..N"
    CSL_INQUIRIES ||--o{ CSL_ENROLLMENTS : "1..N"
    CSL_INQUIRIES ||--o{ CSL_STAGE_TRANSITIONS : "1..N append-only"
    CSL_INQUIRIES ||--o{ CSL_CANCELLATIONS : "1..N"
    CSL_INQUIRIES ||--o{ CSL_REMARKS : "1..N timeline"

    CSL_INQUIRIES {
        uuid inq_id PK
        uuid ent_id FK
        int inq_seq_no
        timestamp inq_registered_at
        varchar inq_name
        bool inq_is_anonymous
        bytea inq_phone_encrypted
        bytea inq_phone_iv
        bytea inq_phone_auth_tag
        varchar inq_phone_status
        varchar inq_inflow_channel
        varchar inq_apply_type
        varchar inq_apply_purpose
        varchar inq_consent_basis
        uuid inq_assigned_user_id
        varchar inq_current_stage
        timestamp inq_last_stage_at
        timestamp inq_followup_at
        text inq_followup_memo
        varchar inq_migration_quality_flag
        timestamp inq_created_at
        timestamp inq_updated_at
        timestamp inq_deleted_at
    }

    CSL_MAP_TESTS {
        uuid mpt_id PK
        uuid ent_id FK
        uuid inq_id FK
        varchar mpt_status
        varchar mpt_fee_status
        timestamp mpt_scheduled_at
        timestamp mpt_held_at
        int mpt_score_reading
        int mpt_score_math
        int mpt_score_language
        text mpt_score_raw_text
        bool mpt_is_waived
        varchar mpt_waiver_reason_code
        uuid mpt_waiver_approver_id
        text mpt_waiver_note
        varchar mpt_migration_quality_flag
        timestamp mpt_created_at
        timestamp mpt_updated_at
    }

    CSL_TRIAL_CLASSES {
        uuid tcl_id PK
        uuid ent_id FK
        uuid inq_id FK
        timestamp tcl_scheduled_at
        timestamp tcl_held_at
        varchar tcl_status
        text tcl_feedback
        bool tcl_sunday_holiday_warning_ack
        timestamp tcl_created_at
        timestamp tcl_updated_at
    }

    CSL_ENROLLMENTS {
        uuid enr_id PK
        uuid ent_id FK
        uuid inq_id FK
        int enr_class_minutes_per_week
        decimal enr_tuition_amount
        bool enr_tuition_paid
        timestamp enr_payment_confirmed_at
        uuid enr_payment_confirmed_by
        text enr_program_note
        timestamp enr_created_at
        timestamp enr_updated_at
    }

    CSL_STAGE_TRANSITIONS {
        uuid trn_id PK
        uuid ent_id FK
        uuid inq_id FK
        varchar trn_from_stage
        varchar trn_to_stage
        timestamp trn_at
        uuid trn_actor_user_id
        text trn_reason
        timestamp trn_created_at
    }

    CSL_CANCELLATIONS {
        uuid cnc_id PK
        uuid ent_id FK
        uuid inq_id FK
        varchar cnc_reason_code
        text cnc_note
        uuid cnc_approver_id
        timestamp cnc_at
        timestamp cnc_created_at
    }

    CSL_REMARKS {
        uuid rmk_id PK
        uuid ent_id FK
        uuid inq_id FK
        text rmk_text
        uuid rmk_created_by
        timestamp rmk_created_at
    }
```

### 3.2 ENUM Catalog (CSL)

| ENUM | Values | Source |
|---|---|---|
| `inq_phone_status` | `VALID`, `DECLINED`, `INVALID`, `MISSING` | Q-CSL-010 |
| `inq_inflow_channel` | `HOMEPAGE`, `KAKAOTALK`, `PHONE`, `REFERRAL`, `OTHER` | F-02 |
| `inq_apply_type` | `COUNSELING_ONLY`, `EXAM_ONLY`, `BOTH` | Q-CSL-009 |
| `inq_apply_purpose` | `MAP_SCORE_UP`, `GPA`, `INTL_SCHOOL_PREP`, `STD_TEST`, `BOARDING`, `OTHER` | F-08 |
| `inq_consent_basis` | `HOMEPAGE_FORM`, `KAKAO_TOS`, `PHONE_VERBAL`, `MIGRATION_LEGACY` | Q-CSL-010 |
| `inq_current_stage` | `INTAKE`, `MAP_TEST`, `TRIAL_CLASS`, `ENROLLMENT_COUNSELING`, `PAYMENT`, `CLASS_STARTED`, `DROPPED` | Pipeline |
| `inq_migration_quality_flag` | `NONE`, `MIGRATION_OK`, `AMBIGUOUS`, `STAGE_INCONSISTENT`, `ERROR` | M03-M06 |
| `mpt_status` | `SCHEDULED`, `HELD`, `WAIVED`, `NO_SHOW`, `CANCELLED` | — |
| `mpt_fee_status` | `PAID`, `WAIVED`, `OVERDUE`, `REFUNDED` | F-12 |
| `mpt_waiver_reason_code` | `RECENT_RETEST_90D`, `TRIAL_PROMOTION`, `SISTER_ACADEMY_TRANSFER` | Q-CSL-002 |
| `tcl_status` | `SCHEDULED`, `HELD`, `NO_SHOW`, `CANCELLED` | — |
| `cnc_reason_code` | `ACADEMY`, `STUDENT_ILLNESS`, `SCHEDULE_CHANGE`, `PAYMENT_DECLINED`, `LOST_TO_COMPETITOR`, `OTHER` | Q-CSL-006 |

### 3.3 Index Strategy (CSL)

| Index | Columns | Purpose |
|---|---|---|
| `idx_csl_inq_ent_stage` | `(ent_id, inq_current_stage)` | List filter by stage |
| `idx_csl_inq_ent_registered` | `(ent_id, inq_registered_at DESC)` | Default sort |
| `idx_csl_inq_assigned` | `(ent_id, inq_assigned_user_id, inq_current_stage)` | "내가 담당하는 진행 중" |
| `uq_csl_inq_seq` | `(ent_id, inq_seq_no)` UNIQUE | Per-tenant sequence |
| `idx_csl_trn_inq` | `(inq_id, trn_at DESC)` | Stage history view |
| `idx_csl_rmk_inq` | `(inq_id, rmk_created_at DESC)` | Timeline view |

### 3.4 Constraints (CSL)

- `inq_is_anonymous=TRUE` ⇒ `inq_name = 'unknown'` enforced at app layer
- `inq_current_stage` transition validated by `StageTransitionService` (only allowed transitions per state machine BR-CSL-006)
- `enr_payment_confirmed_by` MUST be a user with `senior_manager` role (BR-CSL-012, app layer check)
- `enr_tuition_amount > 50,000,000` ⇒ requires `admin` role override (Q-CSL-008)

---

## 4. DSH — Dashboard

### 4.1 Module ERD

```mermaid
erDiagram
    DSH_METRIC_DEFINITIONS ||--o{ DSH_DAILY_KPI : "defines columns"
    DSH_COMPLAINTS }o..o{ DSH_DAILY_KPI : "Complain count source"
    DSH_MANUAL_INPUTS }o..o{ DSH_DAILY_KPI : "Marketing input source"

    DSH_DAILY_KPI {
        uuid dkp_id PK
        uuid ent_id FK
        date dkp_date
        varchar dkp_year_month
        int dkp_day_of_month
        varchar dkp_day_of_week_kr
        int dkp_marketing_visitor
        decimal dkp_marketing_cost
        decimal dkp_marketing_effect
        int dkp_cs_counseling
        int dkp_cs_apply
        int dkp_cs_beginning
        int dkp_cs_missing
        int dkp_cs_trial_class
        int dkp_cs_complain
        int dkp_ops_new_st
        int dkp_ops_out_st
        int dkp_ops_active_st
        int dkp_ops_new_tc
        int dkp_ops_out_tc
        int dkp_ops_active_tc
        int dkp_class_map_test
        int dkp_class_total_class
        int dkp_class_active_student
        int dkp_class_active_teacher
        varchar dkp_data_completeness
        varchar dkp_computation_status
        timestamp dkp_computed_at
        timestamp dkp_created_at
        timestamp dkp_updated_at
    }

    DSH_MANUAL_INPUTS {
        uuid min_id PK
        uuid ent_id FK
        date min_date
        int min_marketing_visitor
        decimal min_marketing_cost
        decimal min_marketing_effect
        uuid min_input_by
        timestamp min_input_at
        varchar min_input_status
    }

    DSH_METRIC_DEFINITIONS {
        uuid met_id PK
        uuid ent_id FK
        varchar met_code
        varchar met_category
        varchar met_label_kr
        varchar met_label_en
        varchar met_aggregation_type
        varchar met_data_source
        text met_description
        bool met_is_active
        int met_display_order
        timestamp met_created_at
        timestamp met_updated_at
    }

    DSH_COMPLAINTS {
        uuid cmp_id PK
        uuid ent_id FK
        timestamp cmp_logged_at
        varchar cmp_category
        varchar cmp_severity
        text cmp_description
        varchar cmp_status
        uuid cmp_student_user_id
        uuid cmp_qna_id
        uuid cmp_class_id
        uuid cmp_logged_by
        uuid cmp_resolved_by
        timestamp cmp_resolved_at
        text cmp_resolution_note
        timestamp cmp_created_at
        timestamp cmp_updated_at
    }
```

### 4.2 ENUM Catalog (DSH)

| ENUM | Values |
|---|---|
| `dkp_data_completeness` | `COMPLETE`, `PARTIAL_PENDING_MANUAL`, `PARTIAL_FUTURE`, `STALE`, `ERROR` |
| `dkp_computation_status` | `FRESH`, `STALE`, `RECOMPUTING`, `FAILED` |
| `met_category` | `MARKETING`, `CS`, `OPERATING`, `CLASS` |
| `met_aggregation_type` | `VOLUME_COUNT`, `STATUS_SNAPSHOT`, `DAILY_DISTINCT`, `NET_DELTA`, `COMPUTED` |
| `met_data_source` | `CSL_INQUIRIES`, `CSL_MAP_TESTS`, `CSL_TRIAL_CLASSES`, `CLS_SESSIONS`, `CLS_CLASSES`, `DSH_MANUAL_INPUTS`, `DSH_COMPLAINTS`, `EXTERNAL_ANALYTICS` |
| `min_input_status` | `DRAFT`, `SUBMITTED`, `LOCKED` |
| `cmp_category` | `CLASS_QUALITY`, `INSTRUCTOR`, `SCHEDULING`, `PAYMENT`, `FACILITIES`, `OTHER` |
| `cmp_severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `cmp_status` | `LOGGED`, `INVESTIGATING`, `RESOLVED`, `UNRESOLVED` |

### 4.3 Index Strategy (DSH)

| Index | Columns | Purpose |
|---|---|---|
| `uq_dsh_dkp_ent_date` | `(ent_id, dkp_date)` UNIQUE | One row per day per tenant |
| `idx_dsh_dkp_ent_ym` | `(ent_id, dkp_year_month)` | Monthly view |
| `idx_dsh_dkp_status` | `(dkp_computation_status)` partial WHERE `STALE` | Recompute batch |
| `uq_dsh_min_ent_date` | `(ent_id, min_date)` UNIQUE | One marketing input per day |
| `idx_dsh_cmp_ent_logged` | `(ent_id, cmp_logged_at DESC)` | Complaint feed |
| `uq_dsh_met_code` | `(ent_id, met_code)` UNIQUE | Metric definitions |

### 4.4 Aggregation Rules (DSH)

| Aggregation Type | Sum Behavior | Average Behavior |
|---|---|---|
| `VOLUME_COUNT` | Σ daily values | Σ / day count |
| `STATUS_SNAPSHOT` | **Last day's value** (NOT sum) | Average across days |
| `DAILY_DISTINCT` | Σ daily distinct counts | Σ / day count |
| `NET_DELTA` | Σ (positive - negative) | — |
| `COMPUTED` | Defined per metric (e.g., Effect = Visitor / Cost) | Defined per metric |

> Critical rule (BR-DSH-003): `dkp_ops_active_st` and `dkp_ops_active_tc` use `STATUS_SNAPSHOT` aggregation — monthly Sum row shows the value of the last day of the month, NOT cumulative sum.

---

## 5. SCH — School Admission Information (학교 입학 정보)

### 5.1 Module ERD

```mermaid
erDiagram
    SCH_SCHOOLS ||--o{ SCH_GRADE_BANDS : "1..N (authorized only)"
    SCH_SCHOOLS ||--o{ SCH_SCHEDULES : "1..N"

    SCH_SCHOOLS {
        uuid sch_id PK
        uuid ent_id FK
        varchar sch_name
        varchar sch_name_en
        varchar sch_category
        varchar sch_authorization_status
        varchar sch_region
        varchar sch_curriculum_system
        text sch_admission_note
        varchar sch_homepage_url
        text sch_address
        timestamp sch_created_at
        timestamp sch_updated_at
        timestamp sch_deleted_at
    }

    SCH_GRADE_BANDS {
        uuid gbd_id PK
        uuid ent_id FK
        uuid sch_id FK
        varchar gbd_label
        int gbd_grade_min
        int gbd_grade_max
        text gbd_note
        timestamp gbd_created_at
        timestamp gbd_updated_at
    }

    SCH_SCHEDULES {
        uuid scd_id PK
        uuid ent_id FK
        uuid sch_id FK
        uuid gbd_id FK
        varchar scd_admission_type
        varchar scd_academic_year
        date scd_apply_open_at
        date scd_apply_close_at
        text scd_schedule_note
        bool scd_is_freetext_fallback
        timestamp scd_created_at
        timestamp scd_updated_at
    }
```

### 5.2 ENUM Catalog (SCH)

| ENUM | Values |
|---|---|
| `sch_category` | `INTERNATIONAL_KR`, `FOREIGN_SCHOOL`, `BOARDING`, `OTHER` |
| `sch_authorization_status` | `AUTHORIZED`, `UNAUTHORIZED` |
| `sch_curriculum_system` | `US_GRADE`, `UK_GRADE`, `IB`, `MIXED`, `OTHER` |
| `scd_admission_type` | `REGULAR`, `ROLLING`, `MIXED`, `UNDETERMINED` |

### 5.3 Constraints (SCH)

- `sch_authorization_status='UNAUTHORIZED'` ⇒ `sch_grade_bands` count MAY be 0 (flat schedule allowed)
- `scd_is_freetext_fallback=TRUE` ⇒ `scd_apply_open_at`, `scd_apply_close_at` MAY be NULL (`scd_schedule_note` required) — C-105

### 5.4 Index Strategy (SCH)

| Index | Columns |
|---|---|
| `idx_sch_ent_auth` | `(ent_id, sch_authorization_status)` |
| `idx_sch_ent_name` | `(ent_id, sch_name)` |
| `idx_sch_gbd_school` | `(sch_id, gbd_grade_min)` |
| `idx_sch_scd_dates` | `(sch_id, scd_apply_close_at)` partial WHERE NOT NULL |

---

## 6. REF — Reference Materials (참조 자료)

### 6.1 Module ERD

```mermaid
erDiagram
    REF_CLASS_GUIDELINES ||--o{ REF_CLASS_GUIDELINES : "supersedes_id"
    REF_LEVEL_TEST_GUIDES ||--o{ REF_LEVEL_TEST_GUIDES : "supersedes_id"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARK_GRADES : "1..N"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARK_MODIFIERS : "0..N (or global)"
    REF_SCORE_BENCHMARKS ||--o{ REF_SCORE_BENCHMARKS : "inherits_from_sbm_id"

    REF_CLASS_GUIDELINES {
        uuid cgd_id PK
        uuid ent_id FK
        varchar cgd_code
        varchar cgd_exam_type
        varchar cgd_label_kr
        jsonb cgd_workflow_steps
        text cgd_remark
        varchar cgd_data_status
        int cgd_version_no
        date cgd_effective_from
        date cgd_effective_to
        uuid cgd_supersedes_id
        timestamp cgd_created_at
        timestamp cgd_updated_at
    }

    REF_LEVEL_TEST_GUIDES {
        uuid lvl_id PK
        uuid ent_id FK
        varchar lvl_exam_type
        varchar lvl_grade_basis
        text lvl_assignment_rule_text
        varchar lvl_resource_url
        varchar lvl_resource_type
        jsonb lvl_procedure_steps
        int lvl_version_no
        date lvl_effective_from
        date lvl_effective_to
        uuid lvl_supersedes_id
        timestamp lvl_created_at
        timestamp lvl_updated_at
    }

    REF_SCORE_BENCHMARKS {
        uuid sbm_id PK
        uuid ent_id FK
        varchar sbm_code
        varchar sbm_exam_type
        varchar sbm_level_label
        decimal sbm_map_reading_score
        decimal sbm_map_math_score
        bool sbm_map_no_upper_bound
        decimal sbm_general_pct
        varchar sbm_general_stanine
        decimal sbm_premium_private_pct
        varchar sbm_premium_private_stanine
        decimal sbm_top_boarding_pct
        varchar sbm_top_boarding_stanine
        varchar sbm_data_status
        uuid sbm_inherits_from_sbm_id
        int sbm_version_no
        date sbm_effective_from
        date sbm_effective_to
        timestamp sbm_created_at
        timestamp sbm_updated_at
    }

    REF_SCORE_BENCHMARK_GRADES {
        uuid sbg_id PK
        uuid sbm_id FK
        varchar sbg_grade_label
        int sbg_grade_min
        int sbg_grade_max
        varchar sbg_curriculum_system
        timestamp sbg_created_at
    }

    REF_SCORE_BENCHMARK_MODIFIERS {
        uuid sbf_id PK
        uuid ent_id FK
        uuid sbm_id FK
        varchar sbf_modifier_type
        decimal sbf_adjustment_min
        decimal sbf_adjustment_max
        varchar sbf_unit
        text sbf_description
        date sbf_effective_from
        date sbf_effective_to
        timestamp sbf_created_at
        timestamp sbf_updated_at
    }
```

### 6.2 ENUM Catalog (REF)

| ENUM | Values |
|---|---|
| `cgd_exam_type` / `lvl_exam_type` / `sbm_exam_type` | `MAP`, `SSAT`, `ISEE`, `WRITING_COMPETITION`, `SUMMER_CAMP`, `JUNIOR_BOARDING`, `BOARDING`, `INTL_SCHOOL_KR`, `FOREIGN_SCHOOL_KR` |
| `cgd_data_status` / `sbm_data_status` | `COMPLETE`, `INHERITED_FROM`, `PARTIAL`, `PLACEHOLDER` |
| `lvl_grade_basis` | `TARGET_GRADE` (ISEE), `CURRENT_GRADE` (SSAT) — **opposite!** (BR-REF-003) |
| `lvl_resource_type` | `DRIVE_FOLDER`, `DRIVE_FILE`, `EXTERNAL_URL` |
| `sbf_modifier_type` | `FOREIGN_SCHOOL`, `INTL_BOARDING`, `OTHER` |
| `sbf_unit` | `POINTS`, `PERCENTILE` |

### 6.3 Versioning Strategy (REF)

- All REF tables follow **per-update versioning** (Q-003 RESOLVED).
- New version: insert new row with `version_no = max+1`, `effective_from = today`; update previous row's `effective_to = today - 1 day`.
- Lookup pattern (BR-REF-001):
  ```sql
  SELECT * FROM amb_acm_ref_score_benchmarks
  WHERE ent_id = :ent_id
    AND sbm_exam_type = :exam
    AND sbm_effective_from <= :asOfDate
    AND (sbm_effective_to IS NULL OR sbm_effective_to >= :asOfDate)
  ```
- Inherited benchmarks: when a row has `sbm_data_status='INHERITED_FROM'`, resolver follows `sbm_inherits_from_sbm_id` chain.

### 6.4 Index Strategy (REF)

| Index | Columns |
|---|---|
| `uq_ref_cgd_code_version` | `(ent_id, cgd_code, cgd_version_no)` UNIQUE |
| `idx_ref_cgd_lookup` | `(ent_id, cgd_exam_type, cgd_effective_from, cgd_effective_to)` |
| `uq_ref_sbm_code_version` | `(ent_id, sbm_code, sbm_version_no)` UNIQUE |
| `idx_ref_sbm_lookup` | `(ent_id, sbm_exam_type, sbm_effective_from, sbm_effective_to)` |
| `idx_ref_sbg_sbm` | `(sbm_id, sbg_grade_min)` |

> Lookup result cached in Redis with key `ref:bm:{ent_id}:{exam}:{grade}:{date}`, TTL 1h, invalidated on REF write.

---

## 7. QNA — Regular Counseling (정기상담 Q&A)

### 7.1 Module ERD

```mermaid
erDiagram
    QNA_CATEGORIES ||--o{ QNA_RECORDS : "categorizes"
    QNA_CATEGORIES ||--o{ QNA_CATEGORIES : "parent_cat_id"
    QNA_RECORDS ||--o{ QNA_RECORD_STUDENTS : "1..N"
    QNA_RECORDS ||--o{ QNA_RECORDS : "thread_parent_id"

    QNA_RECORDS {
        uuid qna_id PK
        uuid ent_id FK
        int qna_seq_no
        timestamp qna_consulted_at
        timestamp qna_responded_at
        text qna_question_text
        text qna_response_internal
        text qna_response_external
        varchar qna_response_status
        uuid qna_category_id FK
        bool qna_is_general
        varchar qna_status
        varchar qna_resolution_status
        bool qna_is_faq
        bool qna_faq_visible_external
        uuid qna_thread_parent_id
        uuid qna_thread_root_id
        uuid qna_related_school_id
        uuid qna_related_inquiry_id
        uuid qna_related_class_id
        uuid qna_related_benchmark_id
        uuid qna_created_by
        uuid qna_responded_by
        uuid qna_promoted_to_faq_by
        varchar qna_migration_quality_flag
        timestamp qna_created_at
        timestamp qna_updated_at
        timestamp qna_deleted_at
    }

    QNA_RECORD_STUDENTS {
        uuid qrs_id PK
        uuid ent_id FK
        uuid qna_id FK
        uuid qrs_student_user_id
        varchar qrs_student_name_snapshot
        uuid qrs_inquiry_id
        timestamp qrs_created_at
    }

    QNA_CATEGORIES {
        uuid cat_id PK
        uuid ent_id FK
        varchar cat_code
        varchar cat_label_kr
        text cat_description
        varchar cat_color_hex
        uuid cat_parent_cat_id
        bool cat_active
        int cat_display_order
        timestamp cat_created_at
        timestamp cat_updated_at
    }
```

### 7.2 ENUM Catalog (QNA)

| ENUM | Values |
|---|---|
| `qna_response_status` | `DRAFT`, `INTERNAL_ONLY`, `EXTERNAL_READY`, `DELIVERED` |
| `qna_status` | `OPEN`, `IN_PROGRESS`, `RESPONDED`, `RESOLVED`, `CLOSED` |
| `qna_resolution_status` | `UNCONFIRMED`, `CONFIRMED`, `UNSATISFIED` |
| `qna_migration_quality_flag` | `NONE`, `MIGRATED_OK`, `AUTO_CATEGORIZED`, `THREAD_RECONSTRUCTED`, `MIGRATION_AMBIGUOUS` |
| `cat_code` (seed) | `MAP_TEST_LOGISTICS`, `SCHOOL_ADMISSION_CRITERIA`, `PAYMENT_AND_SCHEDULING`, `CURRICULUM_AND_PRACTICE`, `INSTRUCTOR_MANAGEMENT`, `OTHER` |

### 7.3 Constraints (QNA)

- `qna_is_faq=TRUE` ⇒ `qna_status IN ('RESOLVED','CLOSED')` (BR-QNA-002)
- `qna_is_general=TRUE` ⇒ `qna_record_students` count MAY be 0
- `qna_thread_root_id` denormalized — set to root's `qna_id` (or self if root)
- Full-text search index on `(qna_question_text, qna_response_internal, qna_response_external)` via `tsvector` generated column

### 7.4 Index Strategy (QNA)

| Index | Columns |
|---|---|
| `uq_qna_seq` | `(ent_id, qna_seq_no)` UNIQUE |
| `idx_qna_ent_consulted` | `(ent_id, qna_consulted_at DESC)` |
| `idx_qna_ent_status` | `(ent_id, qna_status, qna_resolution_status)` |
| `idx_qna_faq` | `(ent_id, qna_is_faq, qna_category_id)` partial WHERE `qna_is_faq=TRUE` |
| `idx_qna_thread_root` | `(qna_thread_root_id)` |
| `idx_qna_related_school` | `(qna_related_school_id)` partial WHERE NOT NULL |
| `idx_qna_related_inq` | `(qna_related_inquiry_id)` partial WHERE NOT NULL |
| `idx_qna_fts` | GIN on tsvector | Full-text search S01-S10 |
| `idx_qrs_qna` | `(qna_id)` |
| `idx_qrs_student` | `(qrs_student_user_id, qrs_created_at DESC)` |

---

## 8. Cross-Cutting Patterns (공통 패턴)

### 8.1 Multi-Tenancy Enforcement (멀티테넌시 강제)

Every business table has `ent_id` as **first column after PK** with:

```sql
ent_id UUID NOT NULL REFERENCES amb_entities(ent_id),
```

Every query path goes through `OwnEntityGuard` which injects `WHERE ent_id = :session.entId` (NFR-008). Lint rule rejects raw queries without `ent_id` filter.

### 8.2 Encryption (암호화)

3-field pattern (NFR-006) for personally identifiable data:

| Logical Field | Storage Columns |
|---|---|
| `inq_phone` | `inq_phone_encrypted BYTEA`, `inq_phone_iv BYTEA(16)`, `inq_phone_auth_tag BYTEA(16)` |

Algorithm: AES-256-GCM. Key managed via AMB KMS. `*_status` ENUM (`VALID`/`DECLINED`/etc.) stored in clear for filtering without decryption.

### 8.3 Audit Logging (감사 로깅)

NestJS `AuditInterceptor` writes to AMB Core's `amb_audit_logs` table for all CSL/QNA/CLS CRUD (NFR-009). Schema (AMB-managed):

```
amb_audit_logs {
  audit_id UUID PK,
  ent_id UUID,
  audit_actor_user_id UUID,
  audit_action VARCHAR (CREATE|UPDATE|DELETE|VIEW),
  audit_entity_type VARCHAR ('csl_inquiry', 'qna_record', ...),
  audit_entity_id UUID,
  audit_payload JSONB,
  audit_at TIMESTAMP
}
```

### 8.4 Soft Delete (소프트 삭제)

`{prefix}_deleted_at TIMESTAMP NULL` on:
- `amb_acm_csl_inquiries`
- `amb_acm_sch_schools`
- `amb_acm_qna_records`

(DSH/REF tables excluded — daily KPIs and reference data are immutable historical records; "delete" = new version with effective_to.)

Repository default: `WHERE {prefix}_deleted_at IS NULL`.

### 8.5 Cross-Module Event Bus (크로스 모듈 이벤트)

In-process event emitter (NestJS `@EventEmitter()`) for:

| Event | Publisher | Subscribers |
|---|---|---|
| `csl.inquiry.created` | CSL | DSH (STALE mark) |
| `csl.inquiry.stage_changed` | CSL | DSH (STALE mark), QNA (suggest related Q&A) |
| `csl.class_started` | CSL | **CLS (v1.0b — schedule init)**, DSH |
| `csl.dropped` | CSL | DSH |
| `cls.session.created` (v1.0b) | CLS | DSH |
| `qna.faq_promoted` | QNA | DSH (FAQ usage widget v1.2) |
| `dsh.marketing_input_missing_3d` | DSH cron | AMB Issue API |
| `csl.sla_breached` | CSL cron | AMB Issue API |

---

## 9. Migration Impact Map (마이그레이션 영향 맵)

| Source | Target Tables | Active Rows | Quality Strategy |
|---|---|---|---|
| `신규` sheet | `csl_inquiries` (+ child tables) | 140 | Field-level validators; ambiguous score → manual review queue (Q-CSL-001) |
| `INDEX` sheet | `dsh_daily_kpi` + `dsh_manual_inputs` | 132 | Mar marketing missing → `PARTIAL_PENDING_MANUAL`; status metrics from last day value |
| `학교입학 정보` sheet | `sch_schools` + `sch_grade_bands` + `sch_schedules` | 41 | 7 인가 + grade-bands; 11+ 비인가 flat with note |
| `수업별 가이드라인` + `시험별 적정 점수대` sheets | `ref_class_guidelines` + `ref_score_benchmarks` (+ grades, modifiers) | ~45 | Inherit-from-above auto backfill; placeholder rows flagged |
| `Q&A` sheet | `qna_records` + `qna_record_students` | 83 (from 1035) | Drop empty (Q-004); thread reconstruction; auto-categorization heuristic |

---

## 10. Out-of-Scope Tables (v1.0b/v1.1 — Reference Only)

For traceability — these will be added in subsequent ERD documents:

| Sub-Phase | Module | Tables |
|---|---|---|
| v1.0b | CLS | `amb_acm_cls_classes`, `cls_class_students`, `cls_recurrence`, `cls_sessions`, `cls_attendance`, `cls_makeups`, `cls_feedbacks`, `cls_video_config`, `cls_settlements` (9 tables) |
| v1.1 | CLS external | OAuth tokens (per-user GCal scope), `cls_gcal_push_log`, `cls_bodaschool_room_log` |

CSL F-24 (`cls_started=YES`) emits `csl.class_started` event with payload `{inq_id, student_info, suggested_class_minutes, suggested_tuition}` for CLS to consume in v1.0b.

---

## 11. DDL Generation Plan (DDL 생성 계획)

| File | Content |
|---|---|
| `sql/acm-v1.0a/000-extensions.sql` | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pg_trgm"; CREATE EXTENSION IF NOT EXISTS "btree_gin";` |
| `sql/acm-v1.0a/010-csl-tables.sql` | 7 CSL tables + indexes + ENUM CHECK constraints |
| `sql/acm-v1.0a/020-dsh-tables.sql` | 4 DSH tables + indexes + metric definition seeds |
| `sql/acm-v1.0a/030-sch-tables.sql` | 3 SCH tables + indexes |
| `sql/acm-v1.0a/040-ref-tables.sql` | 5 REF tables + indexes |
| `sql/acm-v1.0a/050-qna-tables.sql` | 3 QNA tables + tsvector generated column + GIN index + category seeds |
| `sql/acm-v1.0a/099-cross-module-views.sql` | Read-only views for drill-down (DSH metric → CSL filtered list etc.) |

> DDL files to be authored in Stage 3 (Implementation). This ERD is the source of truth for those scripts.

---

## 12. Approval (승인)

| Role | Name | Status |
|---|---|---|
| Product Owner | 김태윤 팀장 | Pending review |
| Backend Lead | TBA | Pending |
| Database Reviewer | TBA | Pending |
| Amoeba Platform Lead | TBA | Pending (FK to `amb_entities` / `amb_users` confirmation) |

---

**End of Document (문서 끝)**

> 이 ERD는 v1.0a 5개 모듈 22 테이블을 다룬다. CLS 9 테이블은 ACM-ERD-CLS-001 (v1.0b)에서 별도 문서화한다.
> Next document: `ACM-FN-CSL-001` (CSL functional specification — endpoint signatures, request/response DTOs, validation rules per FR ID).
