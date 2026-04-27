---
document_id: ACM-REQ-QNA-001
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
  - ACM-REQ-CSL-001 v2.1 (Counseling Module — distinguished as 신규상담)
  - ACM-REQ-CLS-001 v1.0 (Class Management — student linkage)
  - ACM-REQ-SCH-001 v1.0 (School Admission — school-specific Q&A)
  - ACM-REQ-REF-001 v1.0 (Reference Materials — overlap with FAQ)
product_code: ACM
module_code: QNA
db_table_prefix: amb_acm_qna_
source_data: TPI_Master.xlsx › Q&A sheet (1035 rows × 27 cols; 83 active records; ~952 empty)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial draft for Regular Counseling (정기상담) Q&A module deep-dive — applies Q-004 cleanse migration resolution from TPI-ADR-001 (정기상담 Q&A 모듈 심층 분석 초안 — TPI-ADR-001 Q-004 정제 마이그레이션 적용)
---

# QNA — Regular Counseling (정기상담) Module Requirements Analysis (정기상담 Q&A 모듈 요구사항 분석서)

> Module-level deep-dive for **QNA** module of the Academy Management Custom App. Captures **regular counseling (정기상담)** — recurring questions and answers exchanged between advisors and existing students/parents during the active enrollment lifecycle. Distinct from **CSL (신규상담)** which covers new prospects entering the funnel.
> 학원관리앱(ACM) **QNA** 모듈 심화 분석서. 등록 후 진행되는 **정기상담** — 어드바이저와 기존 학생/학부모 간의 반복적 질의응답을 다룬다. 신규 잠재고객 퍼널을 다루는 **CSL(신규상담)**과 구분된다.

---

## 1. Module Overview (모듈 개요)

### 1.1 Purpose (목적)

The QNA module replaces the `Q&A` sheet in `TPI_Master.xlsx` with a structured, searchable, categorizable Q&A repository. It serves three concurrent functions:

QNA 모듈은 `TPI_Master.xlsx`의 `Q&A` 시트를 구조화·검색 가능·분류 가능한 Q&A 저장소로 대체하며, 동시에 세 기능을 수행한다.

| Function (기능) | Detail (상세) |
|---|---|
| **Per-student Q&A log (학생별 Q&A 로그)** | Track all questions exchanged with a specific student/parent over time — context for the next consultation |
| **FAQ knowledge base (FAQ 지식 베이스)** | Common questions reusable across students — first-line reference for advisors during live consultation |
| **Operational handoff (운영 인계)** | When advisor rotates or escalates, full Q&A history available — preserves continuity per AS-IS PDF rule 6 (advisor mediates communication) |

### 1.2 User-Defined Distinction: 신규상담 vs 정기상담 (CSL vs QNA)

The user explicitly requested QNA be modeled as **정기상담** (regular counseling), distinct from CSL's **신규상담** (new counseling).

사용자는 QNA를 CSL의 **신규상담**과 구분되는 **정기상담**으로 분류 요청.

| Aspect | CSL (신규상담) | QNA (정기상담) |
|---|---|---|
| Subject (대상) | New prospects (not yet enrolled) | Active students/parents (post-enrollment) |
| Lifecycle | Pipeline-driven (6-stage state machine) | Continuous (no terminal state) |
| Cardinality (학생당 건수) | 1:1 (one inquiry per student until DROPPED or CLASS_STARTED) | 1:N (many Q&A entries per student over their tenure) |
| Anonymous? | Allowed (`inq_is_anonymous`) | Not typical (student known post-enrollment) |
| Channel (채널) | Homepage form / KakaoTalk / Phone (per inflow ENUM) | KakaoTalk channel / phone / email / in-person (per AS-IS PDF — advisor mediates) |
| Outcome (결과) | Conversion to enrollment | Knowledge accumulation; FAQ promotion |

### 1.3 Scope (범위)

| Item (항목) | Detail (상세) |
|---|---|
| Source sheet (원천 시트) | `Q&A` (1035 rows × 27 cols) |
| Active records (활성 레코드) | **83 active** (verified by direct sheet analysis; 952 empty rows) |
| Header row (헤더 행) | R2 (No. / 상담 학생 이름 / 질문 / 응답) — R1 is operational guide note |
| Operational guide in R1 | Embeds **response tone guideline**: "건조한 텍스트 → 적절한 이모지/이모티콘으로 학부모가 편안히 읽을 수 있도록 수정" — must be preserved as displayable hint |
| Primary writers (주요 작성자) | Advisors (primary), Team leads (review + FAQ promotion) |
| Primary readers (주요 사용자) | All advisors (for live consultation reference), Senior managers (for category trend analysis) |

### 1.4 Source Data Volume Reality Check (원천 데이터 볼륨 — 실측)

The original `ACM-REQ-001 v2.0` estimated "~200 active records" based on row count assumptions. Direct analysis reveals:

원래 `ACM-REQ-001 v2.0`은 행 수 추정으로 ~200건을 산정했으나, 직접 분석 결과:

| Metric | Original Estimate | **Actual** |
|---|---|---|
| Total source rows | 1035 | 1035 ✓ |
| Active records (any of 학생/질문/응답 populated) | ~200 | **83** |
| Records with both 질문 AND 응답 populated | ~200 | **~79** (97.6% completion among active) |
| Records with 학생 이름 populated | (not estimated) | 73 (88.0% — 10 anonymized or unspecified) |
| Empty rows | (not estimated) | **952 (92%)** |

**Implication:** Migration is much smaller than originally scoped — 83 records, of which ~79 are fully complete. Cleansing per Q-004 still applies but the volume is modest.

**시사점:** 마이그레이션 규모가 대폭 축소 — 약 79건의 완전 레코드 중심. Q-004 정제 정책은 그대로 적용되나 볼륨은 작음.

### 1.5 Source Data Pattern Findings (원천 데이터 패턴 발견)

| # | Finding (발견) | Implication for QNA |
|---|---|---|
| 1 | **Group student names** (e.g. "김규민, 김리나", "신승민, 신승윤", "이윤건, 이윤후") — sibling pairs in same Q&A | Q&A links to N students (not 1) — `qna_record_students` junction table. Same pattern as CLS DEC-5. |
| 2 | **R6 has 응답 only, no 질문** — likely follow-up message context-bound to R5 | Allow optional `qna_question_text` when `qna_parent_qna_id` (thread parent) is set — supports threaded responses |
| 3 | **R34 has 질문 + 응답 but no 학생** — anonymous or general-information Q&A | Allow `qna_is_general` flag (not student-specific); excluded from per-student lookups |
| 4 | **Multi-line responses with "/" separator** (e.g. R9 "계좌입금 요청 / 현금영수증 발행 가능") — multiple independent points in one response | Stored as single TEXT preserving newlines; not split into separate records |
| 5 | **Multi-question entries** (e.g. R23 question contains 2 questions: "10분 전 종료 / 선생님 변경 가능?") | Stored as single record; advisor decision; not auto-split |
| 6 | **No category column in source** — 100% free-text content | Migration applies post-hoc categorization (heuristic + manual review); structured ENUM going forward |
| 7 | **No timestamp column in source** — order implies recency but exact dates lost | Migration assigns approximate `qna_at` based on row order + first-known operation date (best-effort); structured timestamp going forward |
| 8 | **No respondent identification** — sheet doesn't record who answered | Advisor identity inferred from operational context (often 정성경 / 김태윤); migration sets `qna_responded_by=MIGRATION_UNKNOWN` for all imported records |
| 9 | **Topic clustering observed** in active records: MAP test logistics (~25%), school admission criteria (~20%), payment/scheduling (~15%), curriculum/practice (~15%), instructor management (~10%), other (~15%) | Drives initial 6-value `qna_category` ENUM proposal (§2.4) |
| 10 | **Cross-references to other modules** are pervasive — questions about specific schools (SCH), specific exam scores (REF), specific counseling stages (CSL), specific classes (CLS) | Strong cross-module integration design (§7) |
| 11 | **R1 tone guideline** — "건조한 텍스트를 학부모 친화적으로" — production-vs-internal answer formats | UI distinguishes `qna_response_internal` (verbatim from advisor) vs `qna_response_external` (parent-ready, polished) — migration stores all as internal initially |
| 12 | **No outcome/resolution column** — whether the answer satisfied the parent is not tracked | Adds `qna_resolution_status` ENUM going forward |

### 1.6 AS-IS PDF Operational Rules Affecting QNA

From `수업 진행 및 업무사항 안내.pdf` (also referenced in CLS spec):

| # | Rule | QNA Implementation |
|---|---|---|
| 1 | 학부모/학생 응대는 어드바이저 통한 응대 (개인 연락처 공유 금지) | All QNA records logged by advisor; teachers do NOT write QNA; QNA does NOT expose teacher contact to parent |
| 2 | 메일 문의 → 어드바이저에게 사전 공유 후 직접 회신 X | New email-channel Q&A flow integrates with AMB Webmail (future v1.1 enhancement) |
| 3 | 응답 톤 — 학부모 친화적 (이모지/이모티콘 적절히 사용) | UI editor offers tone-polish helper (template + emoji palette) |

---

## 2. Domain Model (도메인 모델)

### 2.1 Schema Overview (스키마 개요)

QNA module uses **4 tables** to handle records, student links, categories, and threading:

| Table | Purpose |
|---|---|
| `amb_acm_qna_records` | Q&A 마스터 (질문 + 응답 + 메타데이터 + 톤 변형) |
| `amb_acm_qna_record_students` | Q&A ↔ 학생 다대다 매핑 (그룹 학생 지원) |
| `amb_acm_qna_categories` | 카테고리 마스터 (관리 가능한 분류 체계) |
| `amb_acm_qna_threads` | 스레드 — 후속 질의응답 연결 (R6-style follow-up) |

### 2.2 Q&A Record Master (`amb_acm_qna_records`)

```
amb_acm_qna_records
  ├── identity (식별자)
  │   ├── qna_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   └── qna_seq_no        : INT (per-entity sequence; replaces source No. column)
  │
  ├── timing (시점)
  │   ├── qna_consulted_at  : TIMESTAMP (when question was asked / consultation occurred)
  │   ├── qna_responded_at  : TIMESTAMP (nullable; when response was given)
  │   └── qna_migration_source_row : INT (nullable; source row reference for traceability)
  │
  ├── content — question (질문)
  │   ├── qna_question_text     : TEXT (nullable — null allowed when qna_thread_parent_id is set per finding #2)
  │   ├── qna_question_summary  : VARCHAR(200) (auto-generated short summary for list view)
  │   └── qna_channel       : ENUM (KAKAO_CHANNEL | PHONE | EMAIL | IN_PERSON | OTHER)
  │
  ├── content — response — dual format per finding #11
  │   ├── qna_response_internal : TEXT (verbatim advisor response — internal record)
  │   ├── qna_response_external : TEXT (nullable; parent-ready polished version with emoji)
  │   └── qna_response_status   : ENUM (DRAFT | INTERNAL_ONLY | EXTERNAL_READY | DELIVERED)
  │
  ├── classification (분류)
  │   ├── qna_category_id   : UUID FK → amb_acm_qna_categories
  │   ├── qna_subcategory_tags : TEXT[] (free-text tags for cross-cutting topics)
  │   └── qna_is_general    : BOOLEAN (TRUE if not tied to specific student — finding #3)
  │
  ├── linkage (교차 참조) — populated when answer references other modules
  │   ├── qna_related_school_id     : UUID FK → amb_acm_sch_schools (nullable)
  │   ├── qna_related_inquiry_id    : UUID FK → amb_acm_csl_inquiries (nullable)
  │   ├── qna_related_class_id      : UUID FK → amb_acm_cls_classes (nullable)
  │   └── qna_related_ref_benchmark_id : UUID FK → amb_acm_ref_score_benchmarks (nullable)
  │
  ├── FAQ promotion (FAQ 승격)
  │   ├── qna_is_faq        : BOOLEAN (default FALSE; promoted when reusable across students)
  │   ├── qna_faq_promoted_at : TIMESTAMP
  │   ├── qna_faq_promoted_by : UUID FK → amb_users
  │   └── qna_faq_visibility  : ENUM (ADVISOR_ONLY | ALL_USER | INCLUDE_TEACHER)
  │
  ├── threading (스레드 — finding #2)
  │   ├── qna_thread_parent_id  : UUID FK → amb_acm_qna_records (nullable)
  │   └── qna_thread_root_id    : UUID FK → amb_acm_qna_records (denormalized for fast root lookup)
  │
  ├── workflow (워크플로우)
  │   ├── qna_status        : ENUM (OPEN | RESPONDED | RESOLVED | ESCALATED | DEFERRED)
  │   ├── qna_responded_by  : UUID FK → amb_users (advisor or team-lead who answered)
  │   ├── qna_assigned_to   : UUID FK → amb_users (when ESCALATED to team-lead)
  │   └── qna_resolution_status : ENUM (CONFIRMED_RESOLVED | UNCONFIRMED | UNSATISFIED | NA)
  │
  └── audit
      ├── qna_created_at, qna_updated_at, qna_deleted_at
      ├── qna_visibility    : ENUM (ENTITY | CELL | PRIVATE) per Amoeba §12 (default ENTITY)
      └── qna_migration_quality_flag : ENUM (MIGRATION_OK | MIGRATION_AMBIGUOUS | MIGRATION_UNKNOWN_RESPONDENT | etc.)
```

### 2.3 Q&A Record ↔ Student (`amb_acm_qna_record_students`)

Many-to-many — handles group student Q&A (finding #1).

```
amb_acm_qna_record_students
  ├── qrs_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── qna_id              : UUID FK
  ├── qrs_student_user_id : UUID FK → amb_users (or future Student master)
  ├── qrs_student_name_snapshot : VARCHAR(100)
  │       (snapshot at record time; preserves history if student record name changes)
  ├── qrs_inquiry_id      : UUID FK → amb_acm_csl_inquiries (nullable; if asker came from CSL)
  └── qrs_added_at        : TIMESTAMP
```

> Special case: when `qna_is_general=TRUE`, no rows in `qrs_*` exist. Lookup respects this distinction.
> 특수 케이스: `qna_is_general=TRUE`인 경우 `qrs_*` 행 없음. 조회 시 구분.

### 2.4 Category Master (`amb_acm_qna_categories`)

Initial 6-value ENUM per finding #9, but stored as a manageable table to allow ongoing taxonomy evolution without schema migration.

```
amb_acm_qna_categories
  ├── cat_id          : UUID PK
  ├── ent_id          : UUID FK
  ├── cat_code        : VARCHAR(50) UK per ent (e.g. "MAP_TEST_LOGISTICS")
  ├── cat_label_kr    : VARCHAR(100)
  ├── cat_label_en    : VARCHAR(100) (nullable)
  ├── cat_description : TEXT (nullable)
  ├── cat_display_order : INT
  ├── cat_color_hex   : VARCHAR(7) (UI badge color)
  ├── cat_parent_cat_id : UUID FK (nullable; supports 2-level hierarchy in future)
  └── cat_active      : BOOLEAN
```

**Initial seed categories** (proposed; finalize per Q-QNA-001):

| cat_code | cat_label_kr | Description |
|---|---|---|
| `MAP_TEST_LOGISTICS` | 맵테스트 응시 절차 | 응시 환경, 시간 체크, 휴식, 도구, 음성, IXL 연습 등 |
| `SCHOOL_ADMISSION_CRITERIA` | 학교별 합격 기준 | 학교별 합격선, 인가 여부, 학력 인정, TO 등 |
| `PAYMENT_AND_SCHEDULING` | 결제 및 일정 | 카드/계좌 입금, 환불, 현금영수증, 수업 일정 변경 |
| `CURRICULUM_AND_PRACTICE` | 커리큘럼 및 연습 | IXL/연습 문제집, 과제, 진도, 학습 방법 |
| `INSTRUCTOR_MANAGEMENT` | 강사 관리 | 강사 변경, 시간 관리, 수업 만족도 |
| `OTHER` | 기타 | 위 분류에 해당하지 않는 사항 |

### 2.5 Thread Linking (`amb_acm_qna_threads`) — Optional Audit Log

When R6-style follow-up patterns occur (response added to prior question without new question text), the thread chain is captured in `qna_records.qna_thread_parent_id`. An optional dedicated table tracks thread metadata if needed for analytics:

```
amb_acm_qna_threads (optional — derived view by default)
  ├── thr_id, ent_id, thr_root_qna_id, thr_total_records, thr_first_at, thr_last_at, thr_resolved_at
```

For v1.0, threads are computed dynamically from `qna_records.qna_thread_parent_id`. The dedicated table is introduced only if performance requires it.
v1.0에서는 동적 계산. 성능 요구가 발생하면 도입.

---

## 3. Field Specifications (필드 명세)

### 3.1 Q&A Record (`amb_acm_qna_records`) — 27 fields

(See §2.2 for full schema. Required vs optional summary:)

| Category | Required Fields |
|---|---|
| Identity | `qna_seq_no` |
| Timing | `qna_consulted_at` (default `now()`) |
| Question | `qna_question_text` (unless thread-followup with `qna_thread_parent_id` non-null), `qna_channel` |
| Response | `qna_response_internal` (unless `qna_status=OPEN`), `qna_response_status` |
| Classification | `qna_category_id`, `qna_is_general` |
| Workflow | `qna_status` (default `OPEN`) |

### 3.2 Migration-Specific Fields

These three fields are populated only during migration and exposed as filters in the admin UI for cleanup:

| Field | Migration Use |
|---|---|
| `qna_migration_source_row` | INT — source xlsx row number for traceability |
| `qna_migration_quality_flag` | ENUM — outcome of automated parsing |
| `qna_responded_by = MIGRATION_UNKNOWN` | Sentinel value indicating respondent unidentified (per finding #8) |

---

## 4. Functional Requirements (기능 요구사항)

### 4.1 Q&A CRUD (Q&A 관리)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-001 | Create Q&A record — link to one or more students (or `qna_is_general=TRUE`) | P0 | Student autocomplete from CSL or future Student master |
| FR-QNA-002 | Question and response field with rich-text-lite (preserve newlines, bold/italic, but no images for v1.0) | P0 | |
| FR-QNA-003 | Channel selection — KakaoTalk default, with single-click switch to phone/email/in-person/other | P0 | |
| FR-QNA-004 | Category selection — single category required + optional free-text tags for cross-cutting topics | P0 | |
| FR-QNA-005 | Save as draft (status `OPEN`) before responding; advisor returns later to add response | P0 | |
| FR-QNA-006 | Mark resolved — sets `qna_status=RESOLVED` and prompts `qna_resolution_status` | P0 | Required for FAQ promotion |
| FR-QNA-007 | Edit Q&A record — full edit log inherited from AMB audit | P0 | |
| FR-QNA-008 | Delete Q&A record — soft delete with 90-day restore window | P0 | |
| FR-QNA-009 | Anonymous Q&A — `qna_is_general=TRUE` mode for general-knowledge questions not tied to a specific student | P0 | Per finding #3 |

### 4.2 Search and Filter (검색 및 필터)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-S01 | Full-text search across `qna_question_text` + `qna_response_internal` + `qna_response_external` | P0 | PostgreSQL GIN index; debounced |
| FR-QNA-S02 | Filter by category (multi-select) | P0 | |
| FR-QNA-S03 | Filter by student (single-select with autocomplete) | P0 | |
| FR-QNA-S04 | Filter by date range (`qna_consulted_at`) | P0 | Defaults to "all time" since dataset is small |
| FR-QNA-S05 | Filter by `qna_is_faq=TRUE` | P0 | FAQ-only browse mode |
| FR-QNA-S06 | Filter by `qna_status` (OPEN / RESPONDED / RESOLVED / ESCALATED / DEFERRED) | P0 | |
| FR-QNA-S07 | Filter by channel | P1 | |
| FR-QNA-S08 | Filter by responding advisor | P1 | |
| FR-QNA-S09 | Filter by `qna_migration_quality_flag` | P0 | Admin cleanup tool — find ambiguous migrations |
| FR-QNA-S10 | Sort by date DESC default; secondary sort by category | P0 | |

### 4.3 Per-Student Q&A History (학생별 Q&A 이력)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-H01 | Per-student Q&A timeline view — chronological list of all Q&As tied to that student | P0 | Visible from student profile (CSL detail or future Student master) |
| FR-QNA-H02 | Group student linkage — Q&A linked to "김규민, 김리나" appears in BOTH 김규민 timeline AND 김리나 timeline | P0 | Junction table query (finding #1) |
| FR-QNA-H03 | Cross-reference panel — show related school / inquiry / class / benchmark links inline | P0 | One-click navigation |
| FR-QNA-H04 | Quick-add Q&A from student profile (pre-fills student) | P0 | Productivity shortcut |
| FR-QNA-H05 | Export per-student Q&A as PDF for internal handoff | P1 | Continuity when advisor rotates |

### 4.4 FAQ Promotion and Reuse (FAQ 승격 및 재사용)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-F01 | Promote Q&A to FAQ — `qna_is_faq=TRUE` set by team-lead+ role | P0 | Captures `qna_faq_promoted_by` + timestamp |
| FR-QNA-F02 | FAQ list view — separate menu, browse by category | P0 | |
| FR-QNA-F03 | FAQ search bar — accessible from anywhere via global hotkey | P1 | Live consultation aid |
| FR-QNA-F04 | "Use this answer" — copy `qna_response_internal` (or `qna_response_external` if available) to clipboard | P0 | Reduces typing during call |
| FR-QNA-F05 | "Quick-attach to CSL note" — link FAQ answer to a CSL `inq_remark` | P1 | Cross-module link (matches CSL FR-QNA-008 originally proposed) |
| FR-QNA-F06 | FAQ visibility — `qna_faq_visibility` controls who can see (ADVISOR_ONLY / ALL_USER / INCLUDE_TEACHER) | P0 | |
| FR-QNA-F07 | Demote FAQ — `qna_is_faq=FALSE` revert when no longer relevant | P1 | Admin-level only |
| FR-QNA-F08 | FAQ usage count — track how often each FAQ is referenced in CSL notes | P2 | Analytics for category trends |

### 4.5 Threading and Follow-up (스레드 및 후속 응답)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-T01 | Reply to existing Q&A — creates new record with `qna_thread_parent_id` set | P0 | Per finding #2 |
| FR-QNA-T02 | Threaded view — show full conversation chain in chronological order | P0 | Visible on detail page |
| FR-QNA-T03 | Thread root marker — first record in thread auto-marked as root | P0 | `qna_thread_root_id = qna_id` for root |
| FR-QNA-T04 | Resolve thread — closes all records in chain | P1 | |
| FR-QNA-T05 | Thread search treats chain as one unit — match in any record returns root | P1 | |

### 4.6 Tone Polishing Helper — Per Finding #11 (응답 톤 변환 도우미)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-P01 | Editor offers two-pane view: Internal (verbatim) | External (parent-ready) | P0 | Side-by-side |
| FR-QNA-P02 | One-click "Polish for parent" template — adds default greeting + closing phrases | P1 | E.g. "안녕하세요 어머님 :) ... 감사합니다 :)" wrapper |
| FR-QNA-P03 | Emoji palette — common emojis used in TPI parent communication (😊, 🙂, 👍, 📚, ✏️, 📝) | P1 | |
| FR-QNA-P04 | Tone-guideline reference — display R1 source rule "건조한 톤 → 친근한 톤" inline | P0 | Per AS-IS PDF + source R1 |
| FR-QNA-P05 | "Send to parent" stub action — marks `qna_response_status=DELIVERED` with timestamp | P0 | v1.0 manual; v1.1 may integrate AMB Webmail |
| FR-QNA-P06 | NEVER expose response_internal directly to parent UI/portal (v2.0+) — only external version | P0 | Architectural constraint (PII-QNA-002) |

### 4.7 Categorization and Tagging (분류 및 태깅)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-C01 | Category required at save — UI prevents save with no category | P0 | |
| FR-QNA-C02 | Category management UI — admin can add/rename/disable categories without schema change | P0 | Per §2.4 design |
| FR-QNA-C03 | Subcategory tags — free-text array, advisor adds during entry | P1 | Cross-cutting topics |
| FR-QNA-C04 | Tag autocomplete — suggests existing tags from prior Q&As | P1 | Reduces tag drift |
| FR-QNA-C05 | Bulk re-categorize — admin tool to fix migration-time mis-categorization | P0 | M-3 cleanup |
| FR-QNA-C06 | Category usage report — count per category over time | P1 | Trend analysis for senior manager |

### 4.8 Cross-Module Integration UI (교차 모듈 연동 UI)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-X01 | Quick-link to school — when answer mentions "제주 NLCS" etc., advisor can attach SCH school link | P0 | Powers FR-QNA-H03 |
| FR-QNA-X02 | Quick-link to CSL inquiry — when Q&A relates to a specific recent inquiry | P0 | |
| FR-QNA-X03 | Quick-link to CLS class — when Q&A is class-related (instructor change, schedule, feedback) | P0 | Per finding #10 |
| FR-QNA-X04 | Quick-link to REF benchmark — when Q&A discusses score targets | P0 | Per finding #10 |
| FR-QNA-X05 | Inverse — from SCH/CSL/CLS/REF detail, "Related Q&As" tab shows Q&As linked to that record | P0 | Cross-module discoverability |

### 4.9 Migration (마이그레이션) — Per Q-004 Resolution

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-QNA-MG01 | One-time bulk import from existing Q&A sheet | P0 | xlsx upload during M-3 phase |
| FR-QNA-MG02 | **Cleanse rule per Q-004**: drop rows where BOTH `질문` and `응답` are empty | P0 | ~952 such rows expected |
| FR-QNA-MG03 | **Question-only rows** (질문 present, 응답 empty) — imported with `qna_status=OPEN` | P0 | Allows incomplete records |
| FR-QNA-MG04 | **Response-only rows** (응답 present, 질문 empty) — imported as thread follow-up if prior row has same student; else `MIGRATION_AMBIGUOUS` | P0 | Per finding #2 |
| FR-QNA-MG05 | **Group student parsing** — split comma-separated names into junction rows | P0 | Per finding #1 |
| FR-QNA-MG06 | **Auto-categorization** — best-effort heuristic match per finding #9 keyword set | P0 | Set `qna_migration_quality_flag=AUTO_CATEGORIZED` for review |
| FR-QNA-MG07 | **Tone storage** — all imported responses go to `qna_response_internal` (never `external`); `qna_response_status=INTERNAL_ONLY` | P0 | Per finding #11 |
| FR-QNA-MG08 | **Timestamp inference** — `qna_consulted_at` set to migration date or earlier known date; cannot be precise | P0 | Per finding #7 |
| FR-QNA-MG09 | **Respondent unknown** — set `qna_responded_by=MIGRATION_UNKNOWN` (special user_id sentinel) | P0 | Per finding #8 |
| FR-QNA-MG10 | **General questions** — rows without student name but with content imported with `qna_is_general=TRUE` | P0 | Per finding #3 |
| FR-QNA-MG11 | Idempotent migration — dedup by (`ent_id`, `qna_migration_source_row`) | P0 | Re-run safe |
| FR-QNA-MG12 | Migration report — by category × quality flag × completeness | P0 | Hand to 정성경 for cleanup pass |
| FR-QNA-MG13 | Post-migration cleanup tool — admin filters by `qna_migration_quality_flag` to manually fix | P0 | |

---

## 5. Business Rules (비즈니스 규칙)

| ID | Rule (규칙) | Trigger | Action |
|---|---|---|---|
| BR-QNA-001 | Q&A creation always logs author | Create event | `qna_created_at` + AMB audit log entry |
| BR-QNA-002 | Q&A linked to student requires student exists in CSL or Student master | Create with student | Validate FK; reject if not found |
| BR-QNA-003 | FAQ promotion requires `qna_status=RESOLVED` | Promote attempt | Reject if OPEN/RESPONDED only |
| BR-QNA-004 | FAQ promotion requires team-lead+ role | Promote attempt | Authorization check |
| BR-QNA-005 | Q&A delete preserves thread integrity | Delete root | Soft-delete entire chain; reactivation restores chain |
| BR-QNA-006 | "Send to parent" requires `qna_response_external` populated | Action attempt | Reject if only `qna_response_internal`; prompt to polish first |
| BR-QNA-007 | Cross-module link write — Q&A `qna_related_*` FK set | Save with linkage | Validates referenced record exists in own ent |
| BR-QNA-008 | Threading — child inherits parent's category by default; override allowed | Create reply | UX pre-fills; advisor can change |
| BR-QNA-009 | Auto-suggest existing FAQ — when advisor types question, search existing FAQs and suggest matches | Real-time during typing | UI hint, not auto-fill |
| BR-QNA-010 | Empty `qna_response_internal` cannot exit `OPEN` status | Status transition | Reject |
| BR-QNA-011 | Resolution status `UNSATISFIED` triggers escalation prompt | Set UNSATISFIED | Suggests assigning to team-lead via `qna_assigned_to` |
| BR-QNA-012 | Anonymous (`qna_is_general=TRUE`) record cannot be promoted to FAQ unless explicit team-lead override (rare case) | Promote attempt on general | Warn but allow with confirmation |

---

## 6. Validation Rules (검증 규칙)

### 6.1 Field-Level

| ID | Field | Rule | Error Code |
|---|---|---|---|
| VR-QNA-001 | `qna_question_text` | Length ≤ 5000 chars when present | `VAL_QUESTION_LENGTH` |
| VR-QNA-002 | `qna_response_internal` | Length ≤ 10000 chars when present | `VAL_RESPONSE_LENGTH` |
| VR-QNA-003 | `qna_response_external` | Length ≤ 10000 chars when present | `VAL_EXTERNAL_RESPONSE_LENGTH` |
| VR-QNA-004 | `qna_consulted_at` | ≤ today + 1 (allow same-day timezone slack) | `VAL_CONSULTED_FUTURE` |
| VR-QNA-005 | `qna_responded_at` | ≥ `qna_consulted_at` when both present | `VAL_RESPONSE_BEFORE_QUESTION` |
| VR-QNA-006 | `qna_channel` | One of 5 ENUM values | `VAL_CHANNEL_ENUM` |
| VR-QNA-007 | `qna_status` | One of 5 ENUM values | `VAL_STATUS_ENUM` |
| VR-QNA-008 | `qna_subcategory_tags` | Each tag length ≤ 50 chars; max 10 tags | `VAL_TAG_LIMITS` |

### 6.2 Cross-Field

| ID | Rule | Error Code |
|---|---|---|
| VR-QNA-X01 | `qna_question_text` required UNLESS `qna_thread_parent_id` non-null (follow-up reply allowed) | `VAL_QUESTION_OR_PARENT_REQUIRED` |
| VR-QNA-X02 | `qna_status=RESPONDED` requires `qna_response_internal` non-null | `VAL_RESPONSE_REQUIRED_FOR_RESPONDED` |
| VR-QNA-X03 | `qna_response_status=DELIVERED` requires `qna_response_external` non-null | `VAL_EXTERNAL_REQUIRED_FOR_DELIVERED` |
| VR-QNA-X04 | `qna_is_general=TRUE` requires no rows in `qna_record_students` | `VAL_GENERAL_NO_STUDENTS` |
| VR-QNA-X05 | `qna_is_general=FALSE` requires at least one row in `qna_record_students` | `VAL_NON_GENERAL_REQUIRES_STUDENT` |
| VR-QNA-X06 | `qna_is_faq=TRUE` requires `qna_status=RESOLVED` (BR-QNA-003) | `VAL_FAQ_REQUIRES_RESOLVED` |
| VR-QNA-X07 | `qna_thread_parent_id` non-null requires same-Entity parent | `VAL_THREAD_CROSS_ENTITY` |
| VR-QNA-X08 | `qna_thread_root_id` consistency — must equal root of chain through parent links | `VAL_THREAD_ROOT_INCONSISTENT` |

### 6.3 Migration Quality Flags

| Flag | Trigger | Action |
|---|---|---|
| `MIGRATION_QNA_OK` | All fields parsed cleanly + categorized | None |
| `MIGRATION_QNA_AMBIGUOUS` | Response-only row could not be linked to parent thread | Manual review; default to `qna_status=OPEN` |
| `MIGRATION_QNA_AUTO_CATEGORIZED` | Heuristic-assigned category | Review queue for 정성경 |
| `MIGRATION_QNA_GENERAL` | No student name; imported with `qna_is_general=TRUE` | None |
| `MIGRATION_QNA_GROUP_STUDENT` | Comma-separated names parsed | None (informational) |
| `MIGRATION_QNA_RESPONDENT_UNKNOWN` | All migrated; sentinel `MIGRATION_UNKNOWN` user | Cleanup pass to assign respondent if recoverable |

---

## 7. Cross-Module Integration (모듈 간 연동)

### 7.1 Inbound (수신)

| From | Trigger | Effect on QNA |
|---|---|---|
| CSL | Inquiry detail → "Add Q&A" button | Pre-fills `qrs_inquiry_id` and student |
| CLS | Class detail → "Add Q&A" button | Pre-fills `qna_related_class_id` and student(s) |
| SCH | School detail → "Add Q&A" button | Pre-fills `qna_related_school_id`; usually `qna_is_general=TRUE` |
| REF | Score benchmark → "Add Q&A" button | Pre-fills `qna_related_ref_benchmark_id` |
| AMB User Auth | All QNA writes scoped to authenticated advisor | `qna_responded_by` auto-populated |

### 7.2 Outbound (발신)

| To | Trigger | Payload |
|---|---|---|
| **CSL** | Q&A linked via `qna_related_inquiry_id` | CSL detail "Related Q&As" tab populated |
| **CLS** | Q&A linked via `qna_related_class_id` | CLS detail "Related Q&As" tab |
| **SCH** | Q&A linked via `qna_related_school_id` | School detail "Related FAQ count + link" |
| **REF** | Q&A linked via `qna_related_ref_benchmark_id` | Benchmark detail "Related Q&As" tab |
| **DSH** | Category trends, FAQ usage counts | Dashboard analytics widget |
| **CSL** (insertion) | Advisor uses "Quick-attach to CSL note" | CSL `inq_remark` insert with QNA reference |
| **AMB Webmail** (v1.1) | "Send to parent" with `qna_response_external` | Outbound email composed |

### 7.3 Module Interface Contract

```typescript
export interface IAcmQnaService {
  // CRUD
  findById(entId: UUID, qnaId: UUID): Promise<QnaRecordDto | null>;
  create(entId: UUID, dto: CreateQnaDto): Promise<QnaRecordDto>;
  
  // Search
  search(entId: UUID, query: QnaSearchQuery): Promise<PaginatedResult<QnaRecordDto>>;
  findByStudent(entId: UUID, studentId: UUID, limit?: number): Promise<QnaRecordDto[]>;
  findFaqsByCategory(entId: UUID, catId: UUID): Promise<QnaRecordDto[]>;
  findRelatedToSchool(entId: UUID, schId: UUID): Promise<QnaRecordDto[]>;
  findRelatedToInquiry(entId: UUID, inqId: UUID): Promise<QnaRecordDto[]>;
  findRelatedToClass(entId: UUID, clsId: UUID): Promise<QnaRecordDto[]>;
  
  // FAQ helpers
  findSimilarFaqs(entId: UUID, questionText: string, limit?: number): Promise<QnaRecordDto[]>;
  
  // Categorization
  listCategories(entId: UUID): Promise<CategoryDto[]>;
  
  // Threading
  findThread(entId: UUID, rootQnaId: UUID): Promise<QnaRecordDto[]>;
  
  // No direct write access from other modules — events only
}

export interface AcmQnaEvent {
  type: 'CREATED' | 'RESPONDED' | 'RESOLVED' | 'PROMOTED_TO_FAQ' | 'DELIVERED_TO_PARENT';
  entId: UUID;
  qnaId: UUID;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface QnaSearchQuery {
  keyword?: string;
  categoryIds?: UUID[];
  studentId?: UUID;
  channelTypes?: ChannelType[];
  status?: QnaStatus[];
  isFaq?: boolean;
  isGeneral?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  migrationQualityFlag?: MigrationFlag;
}
```

---

## 8. UI/UX Considerations (UI/UX 고려사항)

| ID | Consideration | Rationale |
|---|---|---|
| UI-QNA-001 | Two-pane editor — internal (left, raw) | external (right, polished) — preview before "send" | Per finding #11 / FR-QNA-P01 |
| UI-QNA-002 | Category badge with color (per `cat_color_hex`) on every Q&A list item | Visual scan |
| UI-QNA-003 | Group-student tag — Q&A linked to multiple students shows all names with comma | Per finding #1 |
| UI-QNA-004 | FAQ marker — gold star icon on `is_faq=TRUE` records | Quick identification |
| UI-QNA-005 | Cross-reference chips — clickable badges showing linked SCH/CSL/CLS/REF | Per finding #10 / FR-QNA-X01-X04 |
| UI-QNA-006 | Live consultation mode — search bar pinned at top with keyboard shortcut (Ctrl+K) | Per FR-QNA-F03 |
| UI-QNA-007 | Tone-polish helper — emoji picker + template phrases pinned in editor toolbar | Per FR-QNA-P02-P03 |
| UI-QNA-008 | "Use this answer" copy button on FAQ list — copies external (if available) else internal | FR-QNA-F04 |
| UI-QNA-009 | Migration cleanup view — admin filter `qna_migration_quality_flag=AUTO_CATEGORIZED` highlighted with warning banner | M-3 cleanup |
| UI-QNA-010 | Threaded conversation — indented chat-style display showing parent → reply chain | FR-QNA-T02 |
| UI-QNA-011 | Anonymous (`qna_is_general=TRUE`) records visually flagged with "일반" badge | Per finding #3 |
| UI-QNA-012 | Tone-guideline helper text — small inline note "💡 학부모 친화적 톤으로 작성: 이모지/친근한 어조 사용 권장" | Per source R1 |

---

## 9. Audit, Compliance & Security (감사, 컴플라이언스, 보안)

### 9.1 Audit (Inherited from AMB)

| ID | Requirement |
|---|---|
| AUD-QNA-001 | Every Q&A CRUD logged with actor + timestamp + before/after diff |
| AUD-QNA-002 | FAQ promotion / demotion explicitly logged with reason field |
| AUD-QNA-003 | "Send to parent" logged with timestamp + recipient (parent identification) |
| AUD-QNA-004 | Status transitions append-only (OPEN → RESPONDED → RESOLVED) |
| AUD-QNA-005 | Soft delete preserves all data; hard delete only by admin after 90-day retention |

### 9.2 PII Compliance

| ID | Requirement | Reference |
|---|---|---|
| PII-QNA-001 | Student names within Q&A treated as student PII; access scoped (advisor + team-lead + senior-manager) | |
| PII-QNA-002 | `qna_response_internal` MUST NEVER be exposed to parent/student-facing UI (parent portal v2.0) — only `qna_response_external` | Per BR-QNA-006 + finding #11 — internal advisor notes may include candid assessments |
| PII-QNA-003 | Parent contact info (if mentioned in Q&A text) — flag for manual review during migration | Avoid plain-text storage of phone/email |
| PII-QNA-004 | Q&A export to PDF (FR-QNA-H05) — admin permission required; logged | |
| PII-QNA-005 | Search results respect access scope — advisors not on case may not see student-specific Q&As (depends on `qna_visibility`) | Per Amoeba §12 visibility model |

### 9.3 Multi-Tenant Isolation

| ID | Requirement |
|---|---|
| MT-QNA-001 | All queries scoped by `ent_id` via OwnEntityGuard |
| MT-QNA-002 | Categories per Entity — TPI and sister academies maintain separate category taxonomies |
| MT-QNA-003 | FAQ visibility never crosses Entity boundary — even if same question appears in another Entity, no auto-share |
| MT-QNA-004 | `qna_seq_no` per-`ent_id`, not global |

---

## 10. Non-Functional Requirements (Module-Specific)

| ID | Category | Requirement | Criteria |
|---|---|---|---|
| NFR-QNA-P01 | Performance | Full-text search across 10k records | < 800ms p95 (PostgreSQL GIN) |
| NFR-QNA-P02 | Performance | Per-student timeline (typically <100 records) | < 300ms p95 |
| NFR-QNA-P03 | Performance | FAQ similarity suggestion (real-time during typing) | < 500ms (debounced 300ms) |
| NFR-QNA-P04 | Performance | Migration of all 83 active source rows | < 30s |
| NFR-QNA-S01 | Scalability | Records per Entity | 50k+ supported (years of accumulated Q&As) |
| NFR-QNA-S02 | Scalability | Categories per Entity | 50+ supported |
| NFR-QNA-A01 | Availability | Read | 99.5% (advisors depend during live consultation) |

---

## 11. Risks (Module-Specific)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-QNA-001 | Auto-categorization mis-classifies → cleanup burden on 정성경 | High | Medium | Conservative heuristics; manual review queue (FR-QNA-S09 + FR-QNA-MG13) |
| R-QNA-002 | Migration timestamp inference — historical Q&A dates lost | Certain | Low | Document the limitation; new Q&As capture precise time |
| R-QNA-003 | Migration respondent unknown — accountability for past answers unclear | Certain | Low | Sentinel `MIGRATION_UNKNOWN`; cleanup-pass to assign where known |
| R-QNA-004 | Tone-polish helper produces unintended canned responses → loss of personalization | Medium | Medium | Helper provides starter, advisor must edit; explicit "polish" not "auto-send" |
| R-QNA-005 | FAQ misuse — advisor copy-pastes external response without review for context | Medium | Medium | "Copy" button shows preview; advisor responsibility documented |
| R-QNA-006 | Search across short dataset (~80 records initially) returns too few matches → advisor falls back to memory | Low | Low | Acceptable; FAQ accumulation grows the base over time |
| R-QNA-007 | PII leakage if `qna_response_internal` accidentally exposed to parent portal v2.0 | Low | High | Architectural enforcement (PII-QNA-002); separate fields prevent accidental display |
| R-QNA-008 | Group-student parsing misses comma variations (e.g. "김규민/김리나" with slash) | Medium | Low | Fallback parsing rules; manual review queue |
| R-QNA-009 | Cross-module FK drift — when SCH/CSL/CLS/REF record deleted, QNA links break | Medium | Low | Soft-delete preserves FKs; UI shows "(삭제됨)" badge for stale references |
| R-QNA-010 | Categorization taxonomy stalemates — categories that don't fit force "OTHER" | Medium | Low | Admin can add categories anytime (§2.4); periodic taxonomy review |

---

## 12. Open Questions (확인 필요 사항)

| ID | Question (질문) | Owner | Required by (필요 시점) |
|---|---|---|---|
| Q-QNA-001 | Initial category seed — confirm 6 proposed categories (§2.4) match advisor mental model, or refine? | 정성경 | Before migration M-3 |
| Q-QNA-002 | Auto-categorization keyword set — finalize keyword → category mapping for migration heuristic | 정성경 | Before migration M-3 |
| Q-QNA-003 | "MIGRATION_UNKNOWN" sentinel user — should it be a real `amb_users` row in AMB Core (so FK valid), or NULL FK with separate flag? Affects schema. | 김태윤 | Before migration M-3 |
| Q-QNA-004 | Threading detection in migration (R5-R6 pattern) — is row order in source meaningful enough to assume same-student response-only follows immediately? | 정성경 | Before migration M-3 |
| Q-QNA-005 | Cross-module link write-back — when QNA links to a CSL/CLS record, should that record also display the QNA in its detail panel (bi-directional read), or QNA-only (one-way)? | 김태윤 | Before v1.0a UI design |
| Q-QNA-006 | Tone-polish: should we provide a simple template-based helper for v1.0, or defer entirely to v1.1+ (manual editing only in v1.0)? Adds dev cost in v1.0. | 김태윤 | Before v1.0a sprint planning |
| Q-QNA-007 | "Send to parent" — v1.0 ends at marking DELIVERED, parent communication remains via current external channel (KakaoTalk). v1.1 may integrate AMB Webmail or KakaoTalk API. Confirm v1.0 scope. | 김태윤 | Before v1.0a sprint planning |
| Q-QNA-008 | FAQ visibility default — should newly-promoted FAQs default to `ADVISOR_ONLY` or `ALL_USER` (visible to teachers too)? | 정성경 / 배예리 | Before v1.0a go-live |
| Q-QNA-009 | Anonymous Q&A (`qna_is_general=TRUE`) acceptance — reasonable to allow by all advisors, or admin-only? Could become noisy if abused. | 김태윤 | Before v1.0a go-live |
| Q-QNA-010 | Per finding #12, source has no `qna_resolution_status` data — for v1.0 migration, default all imported records to `UNCONFIRMED` or `NA`? | 정성경 | Before migration M-3 |

---

## 13. Acceptance Criteria for Module Sign-Off

QNA module is **DONE for ACM v1.0a** when ALL true:

- [ ] All 4 tables implemented per §2 with proper FK constraints
- [ ] Migration of 83 active source rows complete with `qna_migration_quality_flag` distribution reported
- [ ] Group-student linkage tested (e.g. "김규민, 김리나" appears in both timelines)
- [ ] Auto-categorization run + 정성경 manual cleanup pass complete (≥ 90% records have non-OTHER category post-cleanup)
- [ ] Full-text search functional with NFR-QNA-P01 met
- [ ] FAQ promotion + reuse workflow tested with team-lead role
- [ ] Cross-module integration tested — QNA-to-CSL, QNA-to-CLS, QNA-to-SCH, QNA-to-REF all bi-directional UI links exercised
- [ ] All P0 functional requirements pass UAT with 정성경 + 어드바이저
- [ ] All Q-QNA-001 ~ 010 either resolved or explicitly deferred with owner
- [ ] Tone-polish helper functional (or deferred per Q-QNA-006)
- [ ] 1-month parallel xlsx + ACM operation completed without data divergence

---

## Appendix A: Source Sheet → DB Quick Reference

| Source Cell | Target Table | Target Field |
|---|---|---|
| R1 | (operational guide — surfaced as UI hint via UI-QNA-012) | (not migrated) |
| R2 (header row) | (skipped — schema definition) | (not migrated) |
| R3+ C1 (No.) | `amb_acm_qna_records.qna_seq_no` | (or auto-generate) |
| R3+ C2 (상담 학생 이름) | `amb_acm_qna_record_students` (parsed; may produce N rows for "A, B" comma-separated) | qrs_student_name_snapshot + qrs_student_user_id (lookup) |
| R3+ C3 (질문) | `amb_acm_qna_records.qna_question_text` | (Empty + thread-context → qna_thread_parent_id) |
| R3+ C4 (응답) | `amb_acm_qna_records.qna_response_internal` | qna_response_status=`INTERNAL_ONLY` |

### Special handling per finding #2-3:

| Source Pattern | Migration Decision |
|---|---|
| C2+C3+C4 all populated | Standard import |
| C2+C4 only (no question) | Thread follow-up to prior row IF same student, ELSE `MIGRATION_AMBIGUOUS` |
| C3+C4 only (no student) | `qna_is_general=TRUE`, no junction row |
| Only C4 with no immediate parent | `MIGRATION_AMBIGUOUS` flag, manual review |
| All empty | Skip (counts toward 952 dropped) |

---

## Appendix B: Requirement ID Index

| Prefix | Category | Count |
|---|---|---|
| FR-QNA-001~009 | CRUD | 9 |
| FR-QNA-S* | Search and Filter | 10 |
| FR-QNA-H* | Per-Student History | 5 |
| FR-QNA-F* | FAQ Promotion | 8 |
| FR-QNA-T* | Threading | 5 |
| FR-QNA-P* | Tone Polishing Helper | 6 |
| FR-QNA-C* | Categorization | 6 |
| FR-QNA-X* | Cross-Module Integration | 5 |
| FR-QNA-MG* | Migration | 13 |
| BR-QNA-* | Business Rules | 12 |
| VR-QNA-* | Validation (field) | 8 |
| VR-QNA-X* | Validation (cross-field) | 8 |
| AUD-QNA-* | Audit | 5 |
| PII-QNA-* | PII Compliance | 5 |
| MT-QNA-* | Multi-tenancy | 4 |
| NFR-QNA-* | Non-functional | 7 |
| R-QNA-* | Risks | 10 |
| Q-QNA-* | Open Questions | 10 |
| **Total** | | **136** |

---

**End of Document (문서 끝)**
