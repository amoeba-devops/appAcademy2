---
document_id: ACM-REQ-CSL-001
version: 2.1.0
status: Draft
created: 2026-04-25
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
parent_document: ACM-REQ-001 (Academy Management Custom App — Requirements Analysis)
adr_documents:
  - TPI-ADR-001 (Architecture Decision Record)
  - TPI-ADR-001-A1 (CLS Module Decisions Addendum)
related_documents:
  - ACM-REQ-CLS-001 v1.0 (downstream — Class Management)
product_code: ACM
module_code: CSL
db_table_prefix: amb_acm_csl_
source_data: TPI_Master.xlsx › 신규 sheet (140 active records)
supersedes: TPI-REQ-CSL-001 v1.0.0
change_log:
  - version: 1.0.0
    date: 2026-04-25
    author: 김태윤 팀장
    description: Initial draft as TPI-REQ-CSL-001
  - version: 2.0.0
    date: 2026-04-25
    author: 김태윤 팀장
    description: Re-issued as ACM-REQ-CSL-001 per TPI-ADR-001 — prefix tpi_csl_* → amb_acm_csl_*; Q-CSL-001~010 resolutions applied; ENUM updates for apply_type/cancellation/fee_status (TPI-ADR-001 반영 — prefix 변경 + Q-CSL 결정 반영 + ENUM 업데이트)
  - version: 2.1.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Minor update — §8.2 Outbound integration adds CSL → CLS handoff per TPI-ADR-001-A1 (CSL F-24 cls_started=YES triggers CLS.SCHEDULE_INITIATED event); rate/duration suggestions to CLS (CLS 모듈 신설에 따른 §8.2 보완 — F-24 트리거 + 단가/시간 추천 연계)
---

# CSL — Counseling Management Module Requirements Analysis (신규상담 관리 모듈 요구사항 분석서)

> Module-level deep-dive for **CSL** module of the Academy Management Custom App. All field-level, business-rule, validation, and edge-case detail.
> 학원관리앱(ACM) **CSL** 모듈 심화 분석서. 필드 레벨, 비즈니스 규칙, 검증, 엣지 케이스 전체 정의.
>
> All Open Questions raised in v1.0.0 have been resolved per `TPI-ADR-001`. This v2.0.0 incorporates those resolutions.
> v1.0.0의 모든 미결사항은 `TPI-ADR-001`로 해결되었으며, 본 v2.0.0은 그 결정을 반영한다.

---

## 1. Module Overview (모듈 개요)

### 1.1 Purpose (목적)

The CSL (Counseling Management) module digitizes the new-prospect counseling pipeline currently managed in the `신규` sheet of `TPI_Master.xlsx`. It is the **highest-priority module** in ACM v1.0 and the **single source of truth** for the funnel from initial inquiry to enrolled student.

CSL 모듈은 현재 `TPI_Master.xlsx`의 `신규` 시트에서 관리되는 신규 잠재 고객 상담 파이프라인을 디지털화한다. ACM v1.0의 **최우선 모듈**이며, 최초 문의부터 등록 학생 전환까지의 퍼널에 대한 **단일 진실 공급원**이다.

### 1.2 Scope (범위)

| Item (항목) | Detail (상세) |
|---|---|
| Source sheet (원천 시트) | `신규` (302 rows including header) |
| Active records (활성 레코드) | **140** (verified) |
| Source columns (원천 컬럼) | **25** — all MUST be implemented |
| Pipeline stages (파이프라인 단계) | **6** — INTAKE → MAP_TEST → TRIAL_CLASS → ENROLLMENT_COUNSELING → PAYMENT → CLASS_STARTED |
| Primary users (주요 사용자) | Advisor, Team Lead, Senior Manager (per AMB user model) |

### 1.3 Source Data Funnel (원천 데이터 퍼널 — 실측)

| Stage (단계) | Count (건수) | % of Intake (비율) | Drop (이탈) |
|---|---|---|---|
| INTAKE (접수) | 140 | 100.0% | — |
| MAP_TEST_PAID (응시료 납부) | 37 | 26.4% | -103 |
| MAP_TAKEN (응시 완료) | 47 | 33.6% | (data integrity issue)¹ |
| TRIAL_DONE (체험 수업 완료) | 19 | 13.6% | -28 |
| ENROLL_APPLIED (수강 신청) | 4 | 2.9% | (data integrity issue)² |
| PAID_TUITION (교육비 납부) | 1 | 0.7% | -3 |
| CLASS_STARTED (수강 시작) | 14 | 10.0% | (data integrity issue)² |

¹ MAP_TAKEN(47) > MAP_TEST_PAID(37): 10 records skipped fee field. (응시료 입력 누락)
² CLASS_STARTED(14) >> ENROLL_APPLIED(4): downstream filled, upstream skipped. (단계 건너뛰기)

**Implication:** The current spreadsheet does not enforce stage progression integrity. CSL MUST enforce upstream completion before downstream marking (BR-CSL-006).

### 1.4 Inflow Distribution (유입 채널 분포)

| Channel (채널) | Count | Share |
|---|---|---|
| 홈페이지 (Homepage) | 80 | 57.1% |
| 카카오 채널 (KakaoTalk) | 54 | 38.6% |
| 전화 (Phone) | 6 | 4.3% |

### 1.5 Conversion by Application Purpose (목적별 전환율)

| Purpose | Intake | Class Started | Conversion |
|---|---|---|---|
| 국제학교입학준비 | 70 | 8 | 11.4% |
| MAP TEST 성적향상 | 23 | 5 | **21.7%** |
| GPA 관리 | 5 | 1 | 20.0% |
| 공인시험준비 | 1 | 0 | 0.0% |

---

## 2. Domain Model (도메인 모델)

### 2.1 Core Entity (핵심 엔티티)

```
Inquiry (amb_acm_csl_inquiries)
  ├── identity (식별자)
  │   ├── inq_id            : UUID PK
  │   ├── ent_id            : UUID FK → amb_entities (multi-tenant; inherited from AMB)
  │   └── inq_seq_no        : INT (per-entity sequence)
  │
  ├── intake (접수 정보)
  │   ├── inq_registered_at : DATE
  │   ├── inq_followup_at   : DATE (nullable)
  │   ├── inq_followup_memo : TEXT (e.g. "1/9(업무폰)")
  │   ├── inq_name          : VARCHAR(100) — supports "unknown" sentinel
  │   ├── inq_is_anonymous  : BOOLEAN (TRUE when name = "unknown")
  │   ├── inq_phone_*       : ENCRYPTED 3-field per Amoeba §13
  │   ├── inq_phone_status  : ENUM (PROVIDED | DECLINED | UNKNOWN)
  │   ├── inq_consent_basis : ENUM (HOMEPAGE_FORM | KAKAO_TOS | VERBAL | NONE)  — Q-CSL-010
  │   ├── inq_consent_at    : TIMESTAMP (nullable)
  │   ├── inq_consent_recorded_by : UUID FK → amb_users (for VERBAL)
  │   ├── inq_inflow_type   : ENUM (HOMEPAGE | KAKAO_CHANNEL | PHONE)
  │   ├── inq_apply_type    : ENUM (COUNSELING_ONLY | EXAM_ONLY | BOTH)  — Q-CSL-009 (3 values)
  │   ├── inq_apply_purpose : ENUM (INTL_SCHOOL_PREP | MAP_SCORE_UP | STD_TEST_PREP | GPA_MGMT | OTHER)
  │   └── inq_target_school_id : UUID FK → amb_acm_sch_schools (nullable; cross-module link)
  │
  ├── stage_state (단계 상태)
  │   └── inq_current_stage : ENUM (INTAKE | MAP_TEST | TRIAL_CLASS | ENROLLMENT_COUNSELING | PAYMENT | CLASS_STARTED | DROPPED)
  │
  ├── assignment (배정)
  │   └── inq_assigned_user_id : UUID FK → amb_users
  │
  ├── audit (감사) — inherited patterns from AMB
  │   ├── inq_created_at, inq_updated_at, inq_deleted_at
  │   ├── inq_visibility    : ENUM (ENTITY | CELL | PRIVATE) per Amoeba §12
  │   └── inq_sla_breached  : BOOLEAN (computed daily)
```

### 2.2 Stage-Specific Sub-Tables (단계별 서브 테이블)

| Sub-Table | Stage | Source Cols |
|---|---|---|
| `amb_acm_csl_map_tests` | MAP_TEST | C10, C11, C12, C13 |
| `amb_acm_csl_trial_classes` | TRIAL_CLASS | C14, C15 |
| `amb_acm_csl_enrollments` | ENROLLMENT_COUNSELING + PAYMENT | C16-C22 |
| `amb_acm_csl_class_starts` | CLASS_STARTED | C23, C24 |
| `amb_acm_csl_remarks` | (cross-stage) | C25 — N:1 timeline of free-text notes |
| `amb_acm_csl_cancellations` | (cross-stage) | structured cancellation log per Q-CSL-006 |

### 2.3 Stage Transition Audit Table (단계 전이 감사 테이블)

```
amb_acm_csl_stage_transitions
  ├── trn_id            : UUID PK
  ├── ent_id            : UUID FK
  ├── inq_id            : UUID FK
  ├── trn_from_stage    : ENUM (nullable for initial INTAKE)
  ├── trn_to_stage      : ENUM
  ├── trn_at            : TIMESTAMP
  ├── trn_actor_user_id : UUID FK → amb_users
  └── trn_reason        : TEXT (nullable; required for DROPPED and reactivation)
```

> Append-only. Stage reverts create new transition rows; never delete history.
> 추가 전용. 단계 되돌림도 새 전이 행을 추가하며, 이력 삭제 금지.

---

## 3. Field Specifications — All 25 Fields (전체 25개 필드 명세)

### 3.1 Field Detail Table (필드 상세표)

| F# | Source | Field (KR) | DB Column | Type | Required | Fill % | Domain / Validation |
|---|---|---|---|---|---|---|---|
| F-01 | C1 | No. | `inq_seq_no` | INT | MUST | 100% | Auto-increment per `ent_id`; immutable |
| F-02 | C2 | 등록일 | `inq_registered_at` | DATE | MUST | 100% | Default `now()`; max = today; min = today-365 |
| F-03 | C3 | Follow-up 연락일 | `inq_followup_at` + `inq_followup_memo` | DATE + TEXT | SHOULD | 28.6% | See §3.2.1 |
| F-04 | C4 | 이름 | `inq_name` + `inq_is_anonymous` | VARCHAR(100) + BOOL | MUST | 100% | "unknown" → anonymous flag (§3.2.2) |
| F-05 | C5 | 전화번호 | `inq_phone_encrypted/iv/tag` + `inq_phone_status` | ENCRYPTED + ENUM | SHOULD | 75.0% | "x" → DECLINED (§3.2.3) |
| F-06 | C6 | 유입 유형 | `inq_inflow_type` | ENUM | MUST | 100% | `HOMEPAGE` / `KAKAO_CHANNEL` / `PHONE` |
| F-07 | C7 | 신청 유형 | `inq_apply_type` | ENUM | MUST | 100% | `COUNSELING_ONLY` / `EXAM_ONLY` / `BOTH` (Q-CSL-009) |
| F-08 | C8 | 신청 목적 | `inq_apply_purpose` | ENUM | SHOULD | 70.7% | 4 values + `OTHER` |
| F-09 | C9 | 상담 (수행 여부) | `inq_consult_done` | ENUM | SHOULD | 92.1% | `YES` / `NO` |
| F-10 | C10 | 기존 맵테스트 점수 ? | `mpt_has_prior_score` | BOOLEAN | MUST | 42.1% | YES/NO; gate to F-13 |
| F-11 | C11 | 맵테스트 응시료 | `mpt_fee_status` + `mpt_waiver_*` | ENUM + 부가필드 | MUST (Stage 2) | 27.1% | `PAID` / `UNPAID` / `WAIVED` (Q-CSL-002) |
| F-12 | C12 | 맵테스트 예약일 | `mpt_scheduled_at` + `mpt_scheduled_status` | DATE + ENUM | SHOULD | 35.0% | "x" → `NOT_TAKING` |
| F-13 | C13 | 맵테스트 점수 (R/M/L) | `mpt_score_reading` + `mpt_score_math` + `mpt_score_language` | INT × 3 | SHOULD | 34.3% | NWEA range 100-300 (§3.2.4) |
| F-14 | C14 | 체험 수업일 | `tcl_held_at` | DATE | SHOULD | 13.6% | Sunday/holiday allowed with confirm (Q-CSL-007) |
| F-15 | C15 | 피드백 | `tcl_feedback_status` | ENUM | SHOULD | 27.9% | `SENT` / `PENDING` / `NA` |
| F-16 | C16 | 수납 안내 | `enr_payment_notice_status` | ENUM | SHOULD | 11.4% | `SENT` / `PENDING` / `NA` |
| F-17 | C17 | 수강 상담 | `enr_counsel_done` | ENUM | SHOULD | 4.3% | `YES` / `NO` |
| F-18 | C18 | 수강 신청 | `enr_applied` | BOOLEAN | SHOULD | 2.9% | YES/NO |
| F-19 | C19 | 수납 안내 발송 | `enr_payment_notice_sent` | ENUM | SHOULD | 0.7% | `YES` / `NO` |
| F-20 | C20 | 수강 시간 | `enr_class_minutes` | INT | SHOULD | 2.1% | Parsed from "120분" (§3.2.5) |
| F-21 | C21 | 교육비 | `enr_tuition_amount` | DECIMAL(12,0) | SHOULD | 1.4% | KRW; 0 ≤ x ≤ 50,000,000 (Q-CSL-008) |
| F-22 | C22 | 교육비 납부 | `enr_tuition_paid` | BOOLEAN | SHOULD | 0.7% | YES/NO; requires senior manager (BR-CSL-012) |
| F-23 | C23 | 수강 시작일 | `cls_started_at` | DATE | SHOULD | 2.1% | Must be ≥ enrollment date |
| F-24 | C24 | 수강 시작 | `cls_started` | ENUM | SHOULD | 13.6% | `YES` / `NO` |
| F-25 | C25 | 비고 | `amb_acm_csl_remarks` (1:N) | TEXT | OPTIONAL | 2.9% | Append-only timeline (§3.2.6) |

### 3.2 Field-Specific Edge Cases (필드별 엣지 케이스)

#### 3.2.1 Follow-up 연락일 (F-03) — Mixed Date/Text Sentinel

Observed: dates + channel notes (e.g. `1/9(업무폰)`, `2026-01-12 00:00:00`).
**Resolution:** Two columns — `inq_followup_at` (DATE) + `inq_followup_memo` (TEXT). Migration parses `MM/DD(채널)` patterns, infers year as registration year.

#### 3.2.2 이름 = "unknown" (F-04) — Anonymous Inquiry

3 records (2.1%) anonymous via KakaoTalk channel.
**Resolution:** `inq_is_anonymous` BOOL; UI shows "익명 문의 #{seq_no}". Anonymous CANNOT progress past INTAKE.

#### 3.2.3 전화번호 = "x" (F-05) — Phone Declined Sentinel

25% missing or "x".
**Resolution:** `inq_phone_status` ENUM:
- `PROVIDED` — encrypted phone in `inq_phone_*`
- `DECLINED` — refused; encrypted fields NULL
- `UNKNOWN` — not yet asked

#### 3.2.4 맵테스트 점수 (F-13) — Multiple Input Formats

6+ formats observed (`211, 240` / `220(R), 205(L)` / `211` / `202221.0` / `245253249.0` / `x`).

**Resolution per Q-CSL-001:** 3 separate INT columns `mpt_score_reading/math/language`. Migration:
1. `x` or empty → all NULL
2. `\d+, \d+` → assume Reading + Math (per business confirmation)
3. Labeled `\d+\(R\), \d+\(L\)` → parse by label
4. Single `\d+` → **route to manual review queue** with `MIGRATION_AMBIGUOUS` flag (do NOT guess)
5. Concatenated formats → `MIGRATION_DATA_ERROR`, manual review

UI never accepts free-text score; 3 numeric inputs with NWEA validation (100-300).

#### 3.2.5 수강 시간 (F-20) — Korean Unit Suffix

Source: `120분`, `60분`.
**Resolution:** DB stores INT minutes. UI: numeric input + "분" label. Migration: `re.match(r'(\d+)\s*분', value)` → INT.

#### 3.2.6 비고 (F-25) — Append-Only Timeline

Source has 4 distinct values, all cancellation reasons.
**Resolution:** Two-pronged design.

1. `amb_acm_csl_remarks` (N:1): append-only timeline (free-text + author + timestamp)
2. `amb_acm_csl_cancellations` (1:N): structured log with `cnc_reason_code` ENUM (per Q-CSL-006, 6 values):
   - `ACADEMY_CANCELLED`
   - `STUDENT_ILLNESS`
   - `STUDENT_SCHEDULE_CHANGE`
   - `PAYMENT_DECLINED`
   - `LOST_TO_COMPETITOR`
   - `OTHER` (free-text reason required)

#### 3.2.7 MAP Test Fee Waiver (F-11) — Q-CSL-002 Resolution

`mpt_fee_status = WAIVED` requires structured tracking:

```
amb_acm_csl_map_tests
  ├── mpt_fee_status        : ENUM (PAID | UNPAID | WAIVED)
  ├── mpt_waiver_reason     : ENUM (RETAKE_WITHIN_90D | TRIAL_PROMOTION | SISTER_ACADEMY_TRANSFER | OTHER)
  ├── mpt_waiver_approver_id: UUID FK → amb_users (USER_LEVEL+ required)
  ├── mpt_waiver_approved_at: TIMESTAMP
  └── mpt_waiver_note       : TEXT (required when reason = OTHER)
```

Three confirmed waiver scenarios:
- Re-take within 90 days of paid attempt
- Trial promotion (special campaign)
- Sister-academy reciprocity (Santa Croce/트리니티 transfer)

---

## 4. Pipeline State Machine (파이프라인 상태머신)

### 4.1 Stage Definitions (단계 정의)

| Stage Code | Korean | Entry Requirements | Exit Requirements |
|---|---|---|---|
| `INTAKE` | 접수 | (initial) | F-01 ~ F-08 entered AND `inq_is_anonymous = FALSE` |
| `MAP_TEST` | 맵테스트 | INTAKE complete | F-10 entered AND F-11 ∈ (`PAID`, `WAIVED`) AND (F-12 ≠ NULL OR F-13.* ≠ NULL) |
| `TRIAL_CLASS` | 체험수업 | MAP_TEST complete OR §4.3 skip allowed | F-14 ≠ NULL AND F-15 = `SENT` |
| `ENROLLMENT_COUNSELING` | 수강상담 | TRIAL_CLASS complete | F-17 = `YES` AND F-18 = TRUE |
| `PAYMENT` | 수납 | ENROLLMENT_COUNSELING complete | F-19 = `YES` AND F-22 = TRUE |
| `CLASS_STARTED` | 수강시작 | PAYMENT complete | F-23 ≠ NULL AND F-24 = `YES` |
| `DROPPED` | 이탈 | from any stage | `trn_reason` MUST be set |

### 4.2 Stage Transition Diagram (단계 전이도)

```
              ┌──────────┐
              │  INTAKE  │
              └────┬─────┘
                   │
                   ▼
              ┌──────────┐
       ┌──────│ MAP_TEST │
       │ skip │          │
       │ §4.3 └────┬─────┘
       │          │
       ▼          ▼
       ┌────────────┐
       │ TRIAL_CLASS│
       └────┬───────┘
            ▼
       ┌────────────────────┐
       │ENROLLMENT_COUNSELING│
       └────┬───────────────┘
            ▼
       ┌──────────┐
       │ PAYMENT  │
       └────┬─────┘
            ▼
       ┌──────────────┐
       │CLASS_STARTED │
       └──────────────┘

  Any → DROPPED (terminal failure with reason)
  DROPPED → previous_stage (reactivation per Q-CSL-004)
```

### 4.3 INTAKE → TRIAL_CLASS Skip Rule (Q-CSL-003 Resolution)

Skip MAP_TEST stage permitted when **ALL** conditions met (auto-allowed):

1. `mpt_has_prior_score = TRUE`
2. Prior R/M scores entered in remarks at INTAKE
3. Prior score within **12 months**

Otherwise manual override required (ADMIN_LEVEL or designated team-lead).

### 4.4 Allowed Transitions (허용 전이)

| From → To | Allowed? | Note |
|---|---|---|
| `INTAKE → MAP_TEST` | ✅ | Default forward |
| `INTAKE → TRIAL_CLASS` | ⚠️ conditional | §4.3 — auto if conditions met, else manual override |
| `MAP_TEST → TRIAL_CLASS` | ✅ | Default forward |
| `TRIAL_CLASS → ENROLLMENT_COUNSELING` | ✅ | Default forward |
| `ENROLLMENT_COUNSELING → PAYMENT` | ✅ | Default forward |
| `PAYMENT → CLASS_STARTED` | ✅ | Default forward |
| any → DROPPED | ✅ | Reason MUST be provided |
| **DROPPED → previous_stage (reactivation)** | ✅ per Q-CSL-004 | New transition `trn_reason = 'REACTIVATION'`. New record only when phone differs (likely different person) |
| backward (e.g. MAP_TEST → INTAKE) | ⚠️ ADMIN only | Audit-flagged; reason required |

### 4.5 SLA Targets (단계별 SLA 목표)

| Transition | Current Avg Lag | Target SLA |
|---|---|---|
| INTAKE → MAP_TEST scheduled | (not measured) | ≤ 3 days |
| INTAKE → TRIAL_CLASS held | **12.1 days** (n=14, range -4 to 32) | ≤ 14 days |
| TRIAL_CLASS → ENROLLMENT_COUNSELING | (not measured) | ≤ 7 days |
| ENROLLMENT_COUNSELING → PAYMENT | (not measured) | ≤ 7 days |
| PAYMENT → CLASS_STARTED | (not measured) | ≤ 14 days |

---

## 5. Functional Requirements (기능 요구사항)

### 5.1 Field-Level Requirements (필드 레벨)

`FR-CSL-F01` ~ `FR-CSL-F25` correspond to the 25 fields in §3.1.

### 5.2 Pipeline Operation Requirements (파이프라인 운영)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CSL-P01 | Track current pipeline stage per record | P0 | `inq_current_stage` reflects most recent transition |
| FR-CSL-P02 | Record every stage transition with actor + timestamp | P0 | `amb_acm_csl_stage_transitions` row created; immutable |
| FR-CSL-P03 | Validate exit requirements per §4.1 | P0 | API rejects with HTTP 422 listing missing fields |
| FR-CSL-P04 | DROPPED transition requires reason | P0 | `trn_reason` non-null; UI prevents save |
| FR-CSL-P05 | Backward transition allowed only for ADMIN_LEVEL | P0 | Authorization + audit flag |
| FR-CSL-P06 | Compute and display per-stage conversion rates on dashboard | P1 | `(count at stage N+1) / (count at stage N)` |
| FR-CSL-P07 | Detect SLA breaches and alert assigned advisor | P1 | Daily batch + AMB notification |
| FR-CSL-P08 | Stage-specific dashboard widgets | P1 | E.g. "MAP_TEST scheduled this week" |

### 5.3 List, Search, and Filter (목록/검색/필터)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CSL-L01 | List view defaults to all 25 fields visible | P0 | Column show/hide preference saved |
| FR-CSL-L02 | Per-user column preferences saved | P0 | LocalStorage + server-side sync |
| FR-CSL-L03 | Filter by registration date range | P0 | Default current month; presets last 7d, 30d, custom |
| FR-CSL-L04 | Filter by inflow type (multi-select) | P0 | URL-shareable |
| FR-CSL-L05 | Filter by application purpose (multi-select) | P0 | |
| FR-CSL-L06 | Filter by current stage (multi-select) | P0 | |
| FR-CSL-L07 | Filter by assigned advisor | P1 | "내 건만" toggle |
| FR-CSL-L08 | Filter by SLA breach flag | P1 | Boolean filter |
| FR-CSL-L09 | Search by name (partial match) | P0 | LIKE with prefix index |
| FR-CSL-L10 | Search by phone — server-side decrypt-and-match | P0 | Per-record decrypt; result-cached |
| FR-CSL-L11 | Sort by any column with secondary sort by `inq_seq_no` | P1 | |
| FR-CSL-L12 | Pagination — server-side, default 50/page | P0 | Cursor-based for large datasets |

### 5.4 Edit and State Management (편집 및 상태 관리)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CSL-E01 | Detail view groups fields by stage | P0 | Tab or accordion |
| FR-CSL-E02 | Inline edit for status fields on list | P1 | F-15, F-16, F-17, F-19, F-22, F-24 |
| FR-CSL-E03 | Bulk edit — multi-select + apply | P2 | |
| FR-CSL-E04 | Soft delete with restoration window | P0 | `inq_deleted_at`; auto-purge after 90 days; ADMIN restore |
| FR-CSL-E05 | Audit log per-record | P0 | Side panel; field-by-field diff (inherited from AMB audit) |
| FR-CSL-E06 | Concurrent edit detection | P1 | Optimistic locking; 409 on conflict |

### 5.5 Migration (마이그레이션)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CSL-M01 | One-time bulk import from existing 신규 sheet | P0 | xlsx upload; processes 302 rows; row-by-row report |
| FR-CSL-M02 | Parse all edge cases per §3.2 | P0 | Phone "x" → DECLINED; scores parsed per §3.2.4; followup parsed per §3.2.1 |
| FR-CSL-M03 | Ambiguous data routes to manual review | P0 | `MIGRATION_AMBIGUOUS` flag; UI for resolve+commit |
| FR-CSL-M04 | Idempotent migration | P0 | Dedup by (`ent_id`, `inq_seq_no`); update or skip |
| FR-CSL-M05 | Preserve source row reference | P0 | `inq_migration_source_row` INT |
| FR-CSL-M06 | Migration report by stage and quality | P0 | Total, by stage, by quality flag, ambiguous count |

---

## 6. Business Rules (비즈니스 규칙)

| ID | Rule (규칙) | Trigger | Action |
|---|---|---|---|
| BR-CSL-001 | Homepage form auto-creates CSL record | Homepage submit | `inq_inflow_type=HOMEPAGE`, `inq_consent_basis=HOMEPAGE_FORM` |
| BR-CSL-002 | KakaoTalk channel creates anonymous CSL | KakaoTalk webhook | `inq_is_anonymous=TRUE`, `inq_inflow_type=KAKAO_CHANNEL`, `inq_consent_basis=KAKAO_TOS` |
| BR-CSL-003 | Phone inquiry created manually by advisor | Advisor entry | `inq_inflow_type=PHONE`; advisor MUST capture verbal consent → `inq_consent_basis=VERBAL` + `inq_consent_recorded_by` |
| BR-CSL-004 | Anonymous record cannot progress past INTAKE | Stage transition attempt | Reject; require name capture |
| BR-CSL-005 | **Auto-assign advisor — round-robin within purpose specialization** (Q-CSL-005) | New record | Each advisor has 0+ specializations (`amb_users_acm_specializations`). Round-robin among advisors specialized in inquiry's purpose. Fallback to general round-robin |
| BR-CSL-006 | Stage progression requires upstream completion | Stage transition | Validate per §4.1 |
| BR-CSL-007 | Cancellation triggers DROPPED + reason | Cancel event | Create `amb_acm_csl_cancellations` + DROPPED transition |
| BR-CSL-008 | Re-engagement of DROPPED revives existing (Q-CSL-004) | Advisor restarts | New transition `DROPPED → prev_stage` with `trn_reason='REACTIVATION'`. New record ONLY when phone differs |
| BR-CSL-009 | Phone DECLINED → read-only "거부됨" UI | DECLINED set | Cannot edit unless status changed |
| BR-CSL-010 | MAP score entry triggers REF benchmark fetch | F-13 entered | Cross-module call to REF; gap analysis displayed inline |
| BR-CSL-011 | Trial class on Sunday/holiday — soft warning (Q-CSL-007) | F-14 set on Sunday/holiday | UI shows warning + advisor confirm checkbox; save not blocked |
| BR-CSL-012 | Tuition payment confirmation requires senior manager | F-22 = TRUE | Authorization: only USER_LEVEL with `senior_manager` role |
| BR-CSL-013 | Class started auto-creates Student master | F-24 = `YES` | Cross-module call (deferred until Student module v1.1) |
| BR-CSL-014 | Follow-up reminder at INTAKE + 3 business days if stage unchanged | Daily batch | AMB notification to assigned advisor |
| BR-CSL-015 | SLA breach flag set if stage time > target per §4.5 | Daily batch | `inq_sla_breached` BOOLEAN; auto-creates AMB Issue with `source:acm` label |
| BR-CSL-016 | MAP fee waiver requires approval (Q-CSL-002) | `mpt_fee_status=WAIVED` set | `mpt_waiver_approver_id` MUST be USER_LEVEL+ user; approval logged |

---

## 7. Validation Rules (검증 규칙)

### 7.1 Field-Level Validations

| ID | Field | Rule | Error Code |
|---|---|---|---|
| VR-CSL-001 | `inq_registered_at` | ≤ today AND ≥ today - 365 | `VAL_REG_DATE_RANGE` |
| VR-CSL-002 | `inq_followup_at` | Future allowed up to today + 365 | `VAL_FOLLOWUP_RANGE` |
| VR-CSL-003 | `inq_name` | Length 1-100; Korean/English/numbers; allow hyphen and space | `VAL_NAME_FORMAT` |
| VR-CSL-004 | `inq_phone` (PROVIDED) | KR mobile: `^010-\d{4}-\d{4}$` | `VAL_PHONE_FORMAT` |
| VR-CSL-005 | `mpt_score_*` | Integer 100-300 (NWEA) | `VAL_MAP_SCORE_RANGE` |
| VR-CSL-006 | `tcl_held_at` | ≥ `inq_registered_at - 14 days` (warn if <) | `VAL_TRIAL_DATE` |
| VR-CSL-007 | `enr_class_minutes` | Integer 0 < x ≤ 480 | `VAL_CLASS_MINUTES` |
| VR-CSL-008 | `enr_tuition_amount` | Decimal 0 ≤ x ≤ 50,000,000 KRW (Q-CSL-008) | `VAL_TUITION_RANGE` |
| VR-CSL-009 | `cls_started_at` | ≥ enrollment date | `VAL_CLASS_START_ORDER` |
| VR-CSL-010 | `mpt_waiver_*` | If `mpt_fee_status=WAIVED`, all `mpt_waiver_*` required | `VAL_WAIVER_FIELDS` |

### 7.2 Cross-Field Validations

| ID | Rule | Error Code |
|---|---|---|
| VR-CSL-X01 | If `mpt_has_prior_score=TRUE` then prior scores SHOULD be in remarks (Q-CSL-003 prerequisite) | `WARN_PRIOR_SCORE_MISSING` |
| VR-CSL-X02 | If `mpt_fee_status=PAID` then `mpt_scheduled_at` SHOULD be set within 7 days | `WARN_MAP_NOT_SCHEDULED` |
| VR-CSL-X03 | If `inq_is_anonymous=TRUE` then `inq_phone_status` cannot be `PROVIDED` | `VAL_ANON_NO_PHONE` |
| VR-CSL-X04 | Stage `CLASS_STARTED` requires upstream completion (no skipping) | `VAL_STAGE_SKIP` |
| VR-CSL-X05 | If F-24 = `YES` then F-23 ≤ today | `VAL_FUTURE_START` |
| VR-CSL-X06 | If `cnc_reason_code='OTHER'` then `cnc_note` required (Q-CSL-006) | `VAL_OTHER_REASON_NOTE` |
| VR-CSL-X07 | `inq_apply_type=EXAM_ONLY` skips ENROLLMENT_COUNSELING/PAYMENT/CLASS_STARTED stages | `INFO_EXAM_ONLY_FLOW` |

### 7.3 Migration Quality Flags

| Flag | Trigger | Action |
|---|---|---|
| `MIGRATION_OK` | All fields parsed cleanly | None |
| `MIGRATION_AMBIGUOUS` | Score format ambiguous (single number) | Manual review queue |
| `MIGRATION_DATA_ERROR` | Concatenated score, future registration date, etc. | Manual correction required |
| `MIGRATION_STAGE_INCONSISTENT` | Downstream filled but upstream empty | Backfill or accept "as-is" with admin override |

---

## 8. Cross-Module Integration (모듈 간 연동)

### 8.1 Inbound

| From | Trigger | Effect on CSL |
|---|---|---|
| Homepage Form (external) | Form submit | New INTAKE record (BR-CSL-001) |
| KakaoTalk Channel (external) | New conversation | Anonymous INTAKE (BR-CSL-002) |
| AMB User/Auth | User assignment | `inq_assigned_user_id` updated |
| ACM REF | Score benchmark fetched | Embed gap analysis (BR-CSL-010) |
| ACM SCH | Target school selected | `inq_target_school_id` updated |

### 8.2 Outbound

| To | Trigger | Payload |
|---|---|---|
| ACM DSH (Dashboard) | Any CSL CRUD | Daily/monthly aggregation refresh |
| **AMB Core Issue API** (one-way per ADR) | SLA breach detected | Auto-create AMB Issue with `source:acm` label, assignee = `inq_assigned_user_id` |
| ACM QNA | Counselor links Q&A to CSL note | Bidirectional reference |
| ACM SCH | Target school selected | School prospect count update |
| **ACM CLS (Class Management)** | F-24 `cls_started=YES` set (added per TPI-ADR-001-A1) | Cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED`. Triggers UI prompt to create CLS class pre-filled with student + suggested teacher. Maps to BR-CLS-001 in `ACM-REQ-CLS-001`. |
| **ACM CLS (Class Management)** | F-21 `enr_tuition_amount` paid + F-20 `enr_class_minutes` set | Default suggestions for new class — recommended `cst_hourly_rate` derivable from (tuition / expected hours), recommended `rec_duration_min` from `enr_class_minutes` |
| AMB Notification | SLA breach, stage transitions | Slack/email/SMS via AMB |
| Future: Student Module | F-24 = YES | Create Student master |

### 8.3 Module Interface Contract

```typescript
// Public interface for cross-module use (encapsulated within CSL domain)
export interface IAcmCslInquiryService {
  findById(entId: UUID, inqId: UUID): Promise<InquiryDto | null>;
  findByPhone(entId: UUID, phone: string): Promise<InquiryDto[]>;
  countByStage(entId: UUID, dateRange: DateRange): Promise<StageCountDto>;
  findOverdueByAdvisor(entId: UUID, userId: UUID): Promise<InquiryDto[]>;
  // No direct write access from other modules — events only
}

export interface AcmCslInquiryEvent {
  type: 'CREATED' | 'STAGE_TRANSITIONED' | 'DROPPED' | 'REACTIVATED';
  entId: UUID;
  inqId: UUID;
  occurredAt: Date;
  payload: Record<string, unknown>;
}
```

---

## 9. UI/UX Considerations (UI/UX 고려사항)

| ID | Consideration | Rationale |
|---|---|---|
| UI-CSL-001 | 25-column list requires horizontal scroll on 1920px | Per current screen budget |
| UI-CSL-002 | Stage indicator color-coded with current stage highlighted | Cognitive load |
| UI-CSL-003 | Phone field masked (010-****-7743); click to reveal with audit log | PII protection |
| UI-CSL-004 | Anonymous records visually flagged in list (ghost icon + "익명") | Critical for advisor workflow |
| UI-CSL-005 | MAP score input is 3 separate numeric fields (R/M/L) | Replaces ambiguous freetext |
| UI-CSL-006 | Cancellation modal — reason ENUM selection BEFORE save | Enforces BR-CSL-007 |
| UI-CSL-007 | SLA-breached records highlighted (red row) | Immediate visual signal |
| UI-CSL-008 | Mobile read-only view for advisors checking pipeline | Per NFR-015 |
| UI-CSL-009 | Sunday/holiday trial date — yellow warning banner + confirm checkbox | Q-CSL-007 |
| UI-CSL-010 | Phone consent capture UI per channel (form checkbox / KakaoTalk auto / verbal log) | Q-CSL-010 |

---

## 10. Audit, Compliance & Security (감사, 컴플라이언스, 보안)

### 10.1 Audit (Inherited from AMB)

| ID | Requirement |
|---|---|
| AUD-CSL-001 | Every field change recorded with user_id + timestamp + before/after via AMB audit |
| AUD-CSL-002 | Phone reveal action logged separately (PII access log) |
| AUD-CSL-003 | Stage transitions append-only, never deleted |
| AUD-CSL-004 | Backward stage transitions and bulk edits flagged in admin audit dashboard |
| AUD-CSL-005 | Soft delete preserves all data; hard delete only by admin after 90-day retention |

### 10.2 PII Compliance

| ID | Requirement | Reference |
|---|---|---|
| PII-CSL-001 | Phone encrypted at rest (AES-256-GCM 3-field) | Amoeba §13 |
| PII-CSL-002 | Phone never logged in application logs in plaintext | Logger redaction |
| PII-CSL-003 | Phone never returned in list API; only masked unless explicit reveal | Service layer mask |
| PII-CSL-004 | Bulk export of phone requires ADMIN_LEVEL + audit per export | Amoeba §12 |
| PII-CSL-005 | **Channel-specific consent capture** (Q-CSL-010): Homepage explicit checkbox / KakaoTalk channel ToS / Phone verbal log | New |
| PII-CSL-006 | Anonymous records bypass encryption overhead (no PII to protect) | Optimization |

### 10.3 Multi-Tenant Isolation (Inherited from AMB)

| ID | Requirement | Reference |
|---|---|---|
| MT-CSL-001 | All queries scoped by `ent_id` via OwnEntityGuard | Amoeba §12 |
| MT-CSL-002 | `inq_seq_no` per-`ent_id`, not global | Per-entity uniqueness |
| MT-CSL-003 | Visibility levels (`ENTITY` / `CELL` / `PRIVATE`) supported but default `ENTITY` for v1.0 | Amoeba §12 |

---

## 11. Non-Functional Requirements (Module-Specific)

| ID | Category | Requirement | Criteria |
|---|---|---|---|
| NFR-CSL-P01 | Performance | List view load (25 cols × 50 rows) | < 800ms p95 |
| NFR-CSL-P02 | Performance | Phone search across 100k records | < 2s with caching |
| NFR-CSL-P03 | Performance | Stage transition API | < 300ms p95 |
| NFR-CSL-P04 | Performance | Bulk migration (302 rows) | < 30s end-to-end |
| NFR-CSL-S01 | Security | Phone decryption rate-limited per user | Max 100/min; alert at 200/min |
| NFR-CSL-S02 | Security | Phone bulk export 2-step confirmation | Re-auth + reason capture |
| NFR-CSL-A01 | Availability | Module read | 99.5% uptime |
| NFR-CSL-A02 | Availability | Module write | 99.0% (relaxed for maintenance) |

---

## 12. Risks (Module-Specific)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-CSL-001 | Migration data quality blocking go-live | High | High | Run M-2 1 week before; manual review queue staffed by 어드바이저 |
| R-CSL-002 | Stage state machine too restrictive for actual workflow | Medium | Medium | ADMIN backward escape; collect 1-month feedback; relax in v1.1 |
| R-CSL-003 | Phone encryption key rotation breaks search | Low | High | Dual-key support during rotation; documented runbook |
| R-CSL-004 | Homepage/KakaoTalk webhook outage drops inbound | Medium | High | Webhook retry queue (RabbitMQ); dead-letter alerting |
| R-CSL-005 | Conversion dashboards mislead due to stage-skip | High | Medium | Display data quality indicator; gradual enforcement of BR-CSL-006 |
| R-CSL-006 | Advisor adoption resistance | High | High | Read-only export to xlsx during 1-month parallel; daily reconciliation |
| R-CSL-007 | Channel-specific consent capture not legally adequate (Q-CSL-010) | Low | High | Legal review during M-1 |

---

## 13. Open Questions (확인 필요 사항)

> **All previously-listed Open Questions Q-CSL-001 ~ Q-CSL-010 are RESOLVED in `TPI-ADR-001` §3.3.**
> 종전 Q-CSL-001 ~ Q-CSL-010는 모두 `TPI-ADR-001` §3.3에서 해결.

| ID | Status | Resolution Summary | Reference |
|---|---|---|---|
| Q-CSL-001 | ✅ RESOLVED | Manual review queue with `MIGRATION_AMBIGUOUS` flag (no auto-guess) | TPI-ADR-001 §3.3 |
| Q-CSL-002 | ✅ RESOLVED | 3 waiver scenarios + `mpt_waiver_*` fields | §3.2.7 above |
| Q-CSL-003 | ✅ RESOLVED | Conditional auto-allow with 3 conditions (§4.3) | §4.3 above |
| Q-CSL-004 | ✅ RESOLVED | Revive existing record; new only when phone differs | §4.4 above |
| Q-CSL-005 | ✅ RESOLVED | Round-robin within purpose specialization | BR-CSL-005 |
| Q-CSL-006 | ✅ RESOLVED | 6-value cancellation ENUM | §3.2.6 above |
| Q-CSL-007 | ✅ RESOLVED | Soft warning + confirm checkbox | BR-CSL-011 |
| Q-CSL-008 | ✅ RESOLVED | 50,000,000 KRW upper bound | VR-CSL-008 |
| Q-CSL-009 | ✅ RESOLVED | 3-value ENUM `COUNSELING_ONLY`/`EXAM_ONLY`/`BOTH` | F-07 |
| Q-CSL-010 | ✅ RESOLVED | Channel-specific 3 policies + `inq_consent_basis` | PII-CSL-005, BR-CSL-001/002/003 |

No new open questions raised in this v2.0.0 revision.
v2.0.0 개정에서 신규 미결사항 없음.

### v2.1.0 Update — CLS Cross-Module Handoff (CSL → CLS 연동)

The v2.1.0 update reflects the addition of the CLS (Class Management) module per `TPI-ADR-001-A1`. CSL § 8.2 Outbound now includes:

v2.1.0 업데이트는 `TPI-ADR-001-A1`에 따른 CLS(수업관리) 모듈 추가를 반영. CSL §8.2 Outbound에 다음 연동이 추가됨.

| Trigger from CSL | Effect on CLS |
|---|---|
| F-24 `cls_started=YES` set | Cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED` (BR-CLS-001) — UI prompts class creation pre-filled with student + suggested teacher |
| F-21 tuition + F-20 class minutes paid | Default rate / duration suggestions to CLS class creation |

No CSL-internal field or rule changes in v2.1.0; this is a downstream-effect documentation update only. All v2.0.0 requirements remain valid.
v2.1.0에서 CSL 내부 필드/규칙 변경 없음. 다운스트림 효과 문서화만 업데이트. v2.0.0 요구사항 모두 유효.

---

## 14. Acceptance Criteria for Module Sign-Off

CSL module is **DONE for v1.0** when ALL true:

- [ ] All 25 fields from §3.1 implemented and editable in detail view
- [ ] Pipeline state machine §4 enforces transitions per §4.1, §4.4
- [ ] Bulk migration of all 302 source rows completes with ≤ 5% routed to MIGRATION_AMBIGUOUS
- [ ] All P0 functional requirements pass UAT with all 4 reviewer roles
- [ ] All validation rules raise correct error codes
- [ ] All cross-module integration touchpoints exercised in integration tests
- [ ] Phone encryption verified by security review
- [ ] Performance NFRs met in staging
- [ ] All Q-CSL-* resolutions implemented and verified
- [ ] 1-month parallel xlsx + ACM operation completed without data divergence

---

## Appendix A: Source Field → DB Column Quick Reference

| Source Col | Source Header | DB Table | DB Column |
|---|---|---|---|
| C1 | No. | amb_acm_csl_inquiries | inq_seq_no |
| C2 | 등록일 | amb_acm_csl_inquiries | inq_registered_at |
| C3 | Follow-up 연락일 | amb_acm_csl_inquiries | inq_followup_at + inq_followup_memo |
| C4 | 이름 | amb_acm_csl_inquiries | inq_name + inq_is_anonymous |
| C5 | 전화번호 | amb_acm_csl_inquiries | inq_phone_encrypted/iv/tag + inq_phone_status |
| C6 | 유입 유형 | amb_acm_csl_inquiries | inq_inflow_type |
| C7 | 신청 유형 | amb_acm_csl_inquiries | inq_apply_type (3-value) |
| C8 | 신청 목적 | amb_acm_csl_inquiries | inq_apply_purpose |
| C9 | 상담 | amb_acm_csl_inquiries | inq_consult_done |
| C10 | 기존 맵테스트 점수 ? | amb_acm_csl_map_tests | mpt_has_prior_score |
| C11 | 맵테스트 응시료 | amb_acm_csl_map_tests | mpt_fee_status + mpt_waiver_* |
| C12 | 맵테스트 예약일 | amb_acm_csl_map_tests | mpt_scheduled_at + mpt_scheduled_status |
| C13 | 맵테스트 점수 | amb_acm_csl_map_tests | mpt_score_reading + mpt_score_math + mpt_score_language |
| C14 | 체험 수업일 | amb_acm_csl_trial_classes | tcl_held_at |
| C15 | 피드백 | amb_acm_csl_trial_classes | tcl_feedback_status |
| C16 | 수납 안내 | amb_acm_csl_enrollments | enr_payment_notice_status |
| C17 | 수강 상담 | amb_acm_csl_enrollments | enr_counsel_done |
| C18 | 수강 신청 | amb_acm_csl_enrollments | enr_applied |
| C19 | 수납 안내 발송 | amb_acm_csl_enrollments | enr_payment_notice_sent |
| C20 | 수강 시간 | amb_acm_csl_enrollments | enr_class_minutes |
| C21 | 교육비 | amb_acm_csl_enrollments | enr_tuition_amount |
| C22 | 교육비 납부 | amb_acm_csl_enrollments | enr_tuition_paid |
| C23 | 수강 시작일 | amb_acm_csl_class_starts | cls_started_at |
| C24 | 수강 시작 | amb_acm_csl_class_starts | cls_started |
| C25 | 비고 | amb_acm_csl_remarks (1:N) | rmk_text + rmk_at + rmk_author_id |

(Plus `amb_acm_csl_cancellations` for structured cancellation log per Q-CSL-006.)

---

## Appendix B: Requirement ID Index

| Prefix | Category | Count |
|---|---|---|
| FR-CSL-F* | Field-level | 25 |
| FR-CSL-P* | Pipeline operation | 8 |
| FR-CSL-L* | List/Search/Filter | 12 |
| FR-CSL-E* | Edit/State management | 6 |
| FR-CSL-M* | Migration | 6 |
| BR-CSL-* | Business rules | 16 |
| VR-CSL-* | Validation (field) | 10 |
| VR-CSL-X* | Validation (cross-field) | 7 |
| AUD-CSL-* | Audit | 5 |
| PII-CSL-* | PII compliance | 6 |
| MT-CSL-* | Multi-tenancy | 3 |
| NFR-CSL-* | Non-functional | 8 |
| R-CSL-* | Risks | 7 |
| Q-CSL-* | Open questions | 10 (all resolved) |
| **Total** | | **129** |

---

**End of Document (문서 끝)**
