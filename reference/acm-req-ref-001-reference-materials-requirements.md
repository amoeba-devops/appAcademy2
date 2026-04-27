---
document_id: ACM-REQ-REF-001
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
  - ACM-REQ-CSL-001 v2.1 (Counseling Module — primary consumer)
  - ACM-REQ-CLS-001 v1.0 (Class Management — secondary consumer)
  - ACM-REQ-SCH-001 v1.0 (School Admission Module)
product_code: ACM
module_code: REF
db_table_prefix: amb_acm_ref_
source_data:
  - TPI_Master.xlsx › 수업별 가이드라인 sheet (26 rows × 7 cols)
  - TPI_Master.xlsx › 시험별 적정 점수대 sheet (~32 active rows × 27 cols)
  - 기출_MAP_RC_G2-5_Basic_저용량.pdf (sample exam reference)
  - 기출_MAP_RC_G25_Basic_Answers.pdf (sample answer key)
  - NWEA_MAP_Mock_Test_G25.pdf (mock test)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial draft for Reference Materials module deep-dive (참조 자료 모듈 심층 분석 초안)
---

# REF — Reference Materials Module Requirements Analysis (참조 자료 모듈 요구사항 분석서)

> Module-level deep-dive for **REF** module of the Academy Management Custom App. Defines class workflow guidelines, level test materials, and standardized test score benchmarks (NWEA MAP, ISEE, SSAT) used as **reference data attached to evaluation contexts** in CSL counseling and CLS class management.
> 학원관리앱(ACM) **REF** 모듈 심화 분석서. CSL 상담 및 CLS 수업 관리에서 **평가 시 참조 자료로 첨부되는** 수업 워크플로우 가이드라인, 레벨 테스트 자료, 표준화 시험 합격선(NWEA MAP, ISEE, SSAT)을 정의한다.

---

## 1. Module Overview (모듈 개요)

### 1.1 Purpose (목적)

The REF (Reference Materials) module replaces two reference sheets in `TPI_Master.xlsx` (`수업별 가이드라인`, `시험별 적정 점수대`) with structured, versioned, and cross-linkable data. The module serves as the **knowledge base** that other ACM modules consume:

REF 모듈은 `TPI_Master.xlsx`의 두 참조 시트를 구조화·버전 관리·교차 연결 가능한 데이터로 대체하여, 다른 ACM 모듈이 소비하는 **지식 베이스** 역할을 한다.

| Use Case (사용처) | What REF Provides (REF 제공 내용) |
|---|---|
| **CSL** — MAP score entered at intake or after MAP test | Auto-fetch matching grade benchmark; display gap analysis inline (BR-CSL-010) |
| **CSL** — ISEE/SSAT score entered | Match level + tier classification (일반/명문/Top Boarding) |
| **CLS** — Class created with subject_type | Suggest matching `cls_ref_guideline_id` → workflow steps + responsibility split |
| **CLS** — Level test session for new student | Provide PDF link from level test guide |
| **DSH** — Score distribution dashboard | Aggregate CSL scores against benchmarks |

### 1.2 Scope (범위)

| Item (항목) | Detail (상세) |
|---|---|
| Source — guidelines (원천 — 가이드라인) | `수업별 가이드라인` sheet (26 rows × 7 cols; ~13 active including 8 workflow + 2 level-test sub-blocks of 3 fields each) |
| Source — benchmarks (원천 — 합격선) | `시험별 적정 점수대` sheet (~32 active rows × 27 cols; 3 sub-tables: MAP / ISEE / SSAT) |
| Sample exam content (시험 자료 샘플) | 3 PDF files in project knowledge — exemplars of what level test materials look like |
| Primary writers (주요 작성자) | ADMIN_LEVEL + designated team leads (정성경 / 김태윤) — read-only for advisors and teachers |
| Update cadence (갱신 주기) | Yearly admission policy changes + ad-hoc when curriculum updates; per-update versioning per Q-003 (TPI-ADR-001 §3) |

### 1.3 Source Data Inventory (원천 데이터 인벤토리)

#### 1.3.1 수업별 가이드라인 — Two Distinct Data Sub-Domains

The sheet appears as one table but contains **two distinct sub-domains** that must be modeled separately.
한 시트로 보이지만 **분리된 두 서브 도메인**을 포함하므로 별도 모델링이 필요하다.

**Sub-domain A: Class/Exam Workflow Guidelines (R4-R11)** — 8 exam types

| Exam Type (시험 유형) | Source Row | 내용 Sample (요약) |
|---|---|---|
| MAP Test | R4 | 어드바이저 (초기 상담, 레벨테스트) → 팀장 (리포트 + 학부모 상담) → ... |
| SSAT | R5 | 팀장 (실제 시험 일정 조율 및 신청, 안내) |
| ISEE | R6 | (only label; details elsewhere or TBD) |
| Writing Competition | R7 | 어드바이저 (스케줄/강사 배정/Google Docs 생성) → 담당 강사 (에세이 작성, 최종 접수) |
| Summer Camp | R8 | 팀장 (Application Portal 계정 + Drive 폴더 + Google Docs 생성) → 어드바이저 (...) |
| Junior Boarding Application | R9 | (label only) |
| Boarding Application | R10 | (label only) |
| 국내 국제/외국인학교 Application | R11 | (label only) |

Each row's 내용 column contains numbered workflow steps with role indicators (어드바이저/팀장/담당 강사) separated by " / ". 비고 column contains scheduling notes and external links.

각 행의 내용 컬럼은 슬래시(/)로 구분된 역할별 단계, 비고는 일정/링크 정보.

**Sub-domain B: Level Test Guides (R13-R19)** — 2 exam types

| Exam Type (시험 유형) | Source Rows | Content Fields |
|---|---|---|
| **ISEE Level Test** | R13-R15 | 레벨 배정 기준 ("지원 학년으로 레벨 배정"), Drive 폴더 URL, 활용법 (시험 진행 절차) |
| **SSAT Level Test** | R17-R19 | 레벨 배정 기준 ("현재 학년으로 레벨 배정"), Drive 폴더 URL, 활용법 |

Critical insight: ISEE and SSAT use **opposite leveling conventions** — ISEE by target grade, SSAT by current grade. This MUST be enforced in CSL → REF lookups to avoid wrong level assignments.

**중요 관찰:** ISEE는 지원 학년 기준, SSAT는 현재 학년 기준으로 레벨 배정 — **반대 방향**. CSL → REF 조회 시 학년 매핑 방향을 정확히 강제해야 함.

#### 1.3.2 시험별 적정 점수대 — Three Sub-Tables

**Sub-table 1: NWEA MAP Test (R3-R18)**

```
Header (R5-R6):  학년 | Reading 합격선 | Math 합격선
Annotation (R4): 국내 인가/비인가 국제학교 기준, 외국인 학교는 합격선이 +5~+7점 정도 더 필요
```

| 학년 | Reading | Math |
|---|---|---|
| G1 | 189 | 199 |
| G2 | 199 | 205 |
| G3 | 210 | 220 |
| G4 | 220 | 225 |
| G5 | 225 | 230 |
| G6 | 230 | 240 |
| G7 | 235 | 245 |
| G8 | 237 | 250 |
| G9 | 240 이상 | 255 이상 |
| G10 | 240 이상 | 255 이상 |
| G11 | (empty) | (empty) |
| G12 | (empty) | (empty) |

Two data quality findings:
1. **G9, G10 use "X 이상" text** instead of numeric — implies "minimum, no upper" semantic; structured as `>= 240`
2. **G11, G12 empty** — international schools usually end at G10/G12 boundary; expected per business
3. **Foreign school modifier** — `+5~+7` adjustment as a separate `sbm_modifier_*` field

**Sub-table 2: ISEE (R20-R32, columns C1-C5)**

| Level | 지원학년 | 일반 합격선 | 명문 사립 합격선 | Top Boarding 합격선 |
|---|---|---|---|---|
| Primary 2 | G2 | 75% 이상, Stanine 6-7 | 85% 이상, Stanine 7-8 | 94% 이상, Stanine 8-9 |
| Primary 3 | G3 | (inherit?) | | |
| Primary 4 | G4 | | | |
| Lower Level | G5, G6 | | | |
| Middle Level | G7, G8 | | | |
| Upper Level | G9, G10, G11, G12 | | | |

Source has Primary 2 row fully populated; subsequent rows assume same scoring. Migration must either:
- (a) infer "inherit from above" pattern → backfill all rows with Primary 2 values, OR
- (b) flag for manual completion → routes to manual review

ISEE uses **dual scoring system**: Percentile (%) + Stanine. Both surfaced; comparison against either available.

**Sub-table 3: SSAT (R20-R30, columns C7-C11)**

| Level | 현재학년 | 일반 합격선 | 명문 사립 합격선 | Top Boarding 합격선 |
|---|---|---|---|---|
| Elementary G3 | G3 | 75% 이상 | 85% 이상 | 94% 이상 |
| Elementary G4 | G4 | (inherit) | | |
| Middle Level | G5, G6, G7 | | | |
| Upper Level | G8, G9, G10, G11 | | | |

SSAT uses **percentile only** (no Stanine). Same inherit-from-above pattern.

**Important** — Level coverage is many-to-many with grade:
- ISEE: Primary {2,3,4} → 1 grade each; Lower → 2 grades; Middle → 2 grades; Upper → 4 grades
- SSAT: Elementary {G3, G4} → 1 grade each; Middle → 3 grades; Upper → 4 grades

This drives a `level_grades` join — see §2.4.

### 1.4 Key Data Quality Findings (주요 데이터 품질 발견)

| # | Finding (발견) | Implication for REF |
|---|---|---|
| 1 | MAP G9-G10 use "X 이상" text | Structured field `sbm_min_score` + `sbm_no_upper_bound` BOOLEAN |
| 2 | MAP G11-G12 empty in source | Acceptable; CSL must handle missing-benchmark gracefully (warning, not error) |
| 3 | ISEE/SSAT Level → Grade is many-to-many | Separate `ref_score_benchmark_grades` join table |
| 4 | ISEE benchmarks are detailed only for Primary 2 (R22); other rows inherit | Migration logic: backfill from previous non-empty Level row |
| 5 | ISEE uses Percentile + Stanine; SSAT uses Percentile only | Separate scoring fields by exam type |
| 6 | Foreign-school adjustment "+5~+7" is text, not structured | Modeled as `ref_score_benchmark_modifiers` (explicit modifier records) |
| 7 | ISEE level uses **target grade** but SSAT uses **current grade** | Critical UX hint — `lvl_grade_basis` ENUM (`TARGET_GRADE` / `CURRENT_GRADE`) on level test guide |
| 8 | Workflow content (R4-R11) often has only the label populated (e.g. R6 ISEE has only "ISEE") | Acceptable; mark `cgd_data_status=PLACEHOLDER` |
| 9 | Drive folder URLs in level-test guides are external links | Stored as `lvl_resource_url`; not migrated as files |
| 10 | "활용법" describes operational procedure (시험 진행 단계) | Stored as TEXT; preserves multi-line structure |

---

## 2. Domain Model (도메인 모델)

### 2.1 Schema Overview (스키마 개요)

REF module uses **5 tables** to represent two source-data sub-domains correctly:

| Table | Purpose |
|---|---|
| `amb_acm_ref_class_guidelines` | 수업/시험별 워크플로우 가이드라인 (Sub-domain A) |
| `amb_acm_ref_level_test_guides` | 레벨 테스트 가이드 (Sub-domain B) |
| `amb_acm_ref_score_benchmarks` | 합격선 마스터 (multi-exam unified record) |
| `amb_acm_ref_score_benchmark_grades` | 합격선 ↔ 학년 매핑 (Level은 many-to-many grades) |
| `amb_acm_ref_score_benchmark_modifiers` | 외국인학교 등 합격선 보정 |

### 2.2 Class Guideline Master (`amb_acm_ref_class_guidelines`)

Models Sub-domain A — workflow guidelines for 8 exam types.

```
amb_acm_ref_class_guidelines
  ├── identity (식별자)
  │   ├── cgd_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   └── cgd_code          : VARCHAR(50) UK per ent (e.g. "MAP_TEST", "WRITING_COMP")
  │
  ├── classification (분류)
  │   ├── cgd_exam_type     : ENUM (MAP_TEST | SSAT | ISEE | WRITING_COMP | SUMMER_CAMP 
  │   │                              | JUNIOR_BOARDING | BOARDING | INTL_SCHOOL_APP | OTHER)
  │   ├── cgd_label_kr      : VARCHAR(200) (e.g. "MAP Test")
  │   └── cgd_label_en      : VARCHAR(200) (e.g. "NWEA MAP Test") nullable
  │
  ├── content (내용)
  │   ├── cgd_workflow_steps : JSONB
  │   │     [ { "step_num": 1, "role": "ADVISOR", "description": "초기 상담, 학생 목표 확인, 레벨테스트 진행" },
  │   │       { "step_num": 2, "role": "TEAM_LEAD", "description": "성적 리포트 및 커리큘럼 제안서 작성, 학부모 상담" },
  │   │       { "step_num": 3, "role": "TEACHER", "description": "..." } ]
  │   ├── cgd_remark         : TEXT (비고 — scheduling notes, external links)
  │   └── cgd_data_status    : ENUM (COMPLETE | PARTIAL | PLACEHOLDER)
  │
  ├── versioning (per Q-003 — per-update versioning)
  │   ├── cgd_version_no     : INT (incremented on each material change; UK with cgd_code)
  │   ├── cgd_effective_from : DATE
  │   ├── cgd_effective_to   : DATE (nullable; NULL = currently in force)
  │   └── cgd_supersedes_id  : UUID FK (previous version's cgd_id; null for first)
  │
  └── audit
      ├── cgd_created_at, cgd_updated_at, cgd_deleted_at
      ├── cgd_last_reviewed_at : TIMESTAMP
      └── cgd_last_reviewed_by : UUID FK → amb_users
```

**Why `cgd_workflow_steps` as JSONB (not separate table):**

- The workflow is a tightly bound triplet (step + role + description) and changes always atomic per guideline version
- Step count varies (2-5) and order is meaningful
- No reporting query needs to slice across individual steps
- JSONB matches AMB convention §4.5 for "structured but homogeneous nested data"

### 2.3 Level Test Guide (`amb_acm_ref_level_test_guides`)

Models Sub-domain B — ISEE/SSAT level test reference materials and procedures.

```
amb_acm_ref_level_test_guides
  ├── identity
  │   ├── lvl_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   └── lvl_exam_type     : ENUM (ISEE_LEVEL_TEST | SSAT_LEVEL_TEST | OTHER)
  │
  ├── leveling rule (레벨 배정 규칙) — KEY differentiator (DQ finding #7)
  │   ├── lvl_grade_basis   : ENUM (TARGET_GRADE | CURRENT_GRADE)  
  │   │     -- ISEE: TARGET_GRADE (지원 학년)
  │   │     -- SSAT: CURRENT_GRADE (현재 학년)
  │   └── lvl_assignment_rule_text : TEXT (free-text for nuance)
  │
  ├── resources (자료)
  │   ├── lvl_resource_url   : VARCHAR(500) (Google Drive folder link or other)
  │   ├── lvl_resource_type  : ENUM (DRIVE_FOLDER | EXTERNAL_LINK | INTERNAL_DOC)
  │   └── lvl_resource_note  : TEXT
  │
  ├── usage procedure (활용법)
  │   ├── lvl_procedure_steps : JSONB
  │   │     [ { "step_num": 1, "description": "답안 제외 문제지만 배부" },
  │   │       { "step_num": 2, "description": "VR, QR 이후 10분 휴식, RC, MA 진행" },
  │   │       { "step_num": 3, "description": "Writing 수업도 희망할 경우 Essay 추가" } ]
  │   └── lvl_default_duration_min : INT (nullable; total expected test duration)
  │
  ├── versioning (same pattern as guidelines)
  │   ├── lvl_version_no, lvl_effective_from, lvl_effective_to, lvl_supersedes_id
  │
  └── audit
      ├── lvl_created_at, lvl_updated_at, lvl_deleted_at
      ├── lvl_last_reviewed_at, lvl_last_reviewed_by
```

### 2.4 Score Benchmark Master (`amb_acm_ref_score_benchmarks`)

Unified table for MAP / ISEE / SSAT benchmarks.

```
amb_acm_ref_score_benchmarks
  ├── identity
  │   ├── sbm_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   └── sbm_code          : VARCHAR(50) UK per ent (e.g. "MAP_G3", "ISEE_PRIMARY_2", "SSAT_MIDDLE_LEVEL")
  │
  ├── classification (분류)
  │   ├── sbm_exam_type     : ENUM (MAP | ISEE | SSAT)
  │   └── sbm_level_label   : VARCHAR(50) (e.g. "G3", "Primary 2", "Middle Level")
  │
  ├── tier benchmarks (합격선 — 시험 유형별 차이)
  │   ├── -- MAP fields (only when sbm_exam_type=MAP)
  │   ├── sbm_map_reading_score  : DECIMAL(5,1) (nullable)
  │   ├── sbm_map_math_score     : DECIMAL(5,1) (nullable)
  │   ├── sbm_map_no_upper_bound : BOOLEAN (TRUE for "X 이상" cases like G9-G10)
  │   │
  │   ├── -- ISEE/SSAT fields
  │   ├── sbm_general_pct        : DECIMAL(5,2) (일반 합격선 %)
  │   ├── sbm_general_stanine    : VARCHAR(20) (e.g. "6-7"; ISEE only — null for SSAT)
  │   ├── sbm_premium_private_pct      : DECIMAL(5,2) (명문 사립 합격선 %)
  │   ├── sbm_premium_private_stanine  : VARCHAR(20) (ISEE only)
  │   ├── sbm_top_boarding_pct         : DECIMAL(5,2) (Top Boarding 합격선 %)
  │   └── sbm_top_boarding_stanine     : VARCHAR(20) (ISEE only)
  │
  ├── data quality (데이터 품질)
  │   ├── sbm_data_status   : ENUM (COMPLETE | INHERITED_FROM | PLACEHOLDER) 
  │   │     -- INHERITED_FROM means "values copied from another record per inherit-from-above"
  │   ├── sbm_inherits_from_sbm_id : UUID FK (nullable; points to source if INHERITED_FROM)
  │
  ├── versioning
  │   ├── sbm_version_no, sbm_effective_from, sbm_effective_to, sbm_supersedes_id
  │
  └── audit
      ├── sbm_created_at, sbm_updated_at, sbm_deleted_at
      ├── sbm_last_reviewed_at, sbm_last_reviewed_by
```

> **Migration policy for inherit-from-above (DQ #4):** During migration, when ISEE/SSAT row has empty 합격선 cells but a prior-row Level had populated cells, we DO populate the new row's `sbm_*_pct/stanine` values copied from the source, AND set `sbm_data_status='INHERITED_FROM'` with `sbm_inherits_from_sbm_id` pointing to the source. This makes inherits explicit AND provides usable values immediately. If the business confirms different actual values for sub-levels later, an admin updates them and `sbm_data_status` becomes `COMPLETE`.

### 2.5 Score Benchmark Grade Mapping (`amb_acm_ref_score_benchmark_grades`)

Many-to-many between benchmark and grade — handles ISEE/SSAT level → multiple grades.

```
amb_acm_ref_score_benchmark_grades
  ├── sbg_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── sbm_id              : UUID FK → amb_acm_ref_score_benchmarks
  ├── sbg_grade_label     : VARCHAR(10) (e.g. "G2", "G5", "G6")
  ├── sbg_grade_min       : INT (numeric — for sorting and matching CSL student grade)
  ├── sbg_grade_max       : INT (= sbg_grade_min for single-grade rows; > for ranges)
  └── sbg_curriculum_system : ENUM (UK_YEAR | US_GRADE | KOREAN | MIXED)  
        -- typically US_GRADE for these exam types
```

Examples:
- MAP `sbm_code=MAP_G3` → 1 row in `sbg_*` with `sbg_grade_label='G3'`, `sbg_grade_min=3`, `sbg_grade_max=3`
- ISEE `sbm_code=ISEE_LOWER_LEVEL` → 2 rows: `G5/5/5` and `G6/6/6`
- SSAT `sbm_code=SSAT_UPPER_LEVEL` → 4 rows: `G8`, `G9`, `G10`, `G11`

### 2.6 Score Benchmark Modifier (`amb_acm_ref_score_benchmark_modifiers`)

Captures the "+5~+7 for foreign school" rule (DQ #6) and similar future modifiers.

```
amb_acm_ref_score_benchmark_modifiers
  ├── sbf_id            : UUID PK
  ├── ent_id            : UUID FK
  ├── sbm_id            : UUID FK (the benchmark this modifier applies to; nullable for global modifiers)
  ├── sbf_modifier_type : ENUM (FOREIGN_SCHOOL | INTERNATIONAL_BOARDING | OTHER)
  ├── sbf_adjustment_min : DECIMAL(5,1) (e.g. +5)
  ├── sbf_adjustment_max : DECIMAL(5,1) (e.g. +7)
  ├── sbf_unit         : ENUM (POINTS | PERCENTILE)
  ├── sbf_description  : TEXT (e.g. "외국인 학교는 합격선이 +5~+7점 정도 더 필요")
  └── sbf_effective_from, sbf_effective_to
```

### 2.7 Per-Update Versioning Pattern (Q-003 Resolution)

Per `TPI-ADR-001 §3` Q-003 RESOLVED — all REF tables use the same versioning pattern:

| Field | Behavior |
|---|---|
| `*_version_no` | INT, unique with logical key (`cgd_code`, `lvl_exam_type`, `sbm_code`) — incremented on each material change |
| `*_effective_from` | DATE — when this version takes effect |
| `*_effective_to` | DATE — when superseded; NULL means currently active |
| `*_supersedes_id` | UUID FK — points to the prior version's row |

CSL records lookup REF by **date** — at the time `inq_registered_at` (for benchmarks) or `cls_started_at` (for guidelines), find the version where `effective_from <= date < (effective_to OR now)`.

CSL은 등록일·수강 시작일 기준으로 그 시점에 유효했던 버전을 조회 — 과거 평가의 재현 가능성 보장.

This ensures historical CSL records remain reproducible even after the benchmark policy changes mid-year.

---

## 3. Field Specifications (필드 명세)

### 3.1 Class Guideline (`amb_acm_ref_class_guidelines`) — 13 active fields

| F# | Field (KR) | DB Column | Type | Required | Source |
|---|---|---|---|---|---|
| CGD-01 | 가이드라인 코드 | `cgd_code` | VARCHAR(50) UK | MUST | Auto-generated from exam_type |
| CGD-02 | 시험 유형 | `cgd_exam_type` | ENUM | MUST | 9-value enum |
| CGD-03 | 라벨 (한글) | `cgd_label_kr` | VARCHAR(200) | MUST | C1 of 수업별 가이드라인 |
| CGD-04 | 라벨 (영문) | `cgd_label_en` | VARCHAR(200) | OPTIONAL | (None in source; future bilingual) |
| CGD-05 | 워크플로우 단계 | `cgd_workflow_steps` | JSONB | SHOULD | Parsed from C2 (slash-separated → array) |
| CGD-06 | 비고 | `cgd_remark` | TEXT | OPTIONAL | C3 |
| CGD-07 | 데이터 상태 | `cgd_data_status` | ENUM | MUST | Inferred (PLACEHOLDER if only label populated) |
| CGD-08 | 버전 번호 | `cgd_version_no` | INT | MUST | Default 1 at migration |
| CGD-09 | 적용 시작일 | `cgd_effective_from` | DATE | MUST | Default = migration date |
| CGD-10 | 적용 종료일 | `cgd_effective_to` | DATE | OPTIONAL | NULL when active |
| CGD-11 | 이전 버전 ID | `cgd_supersedes_id` | UUID FK | OPTIONAL | NULL for v1 |
| CGD-12 | 최근 검토일 | `cgd_last_reviewed_at` | TIMESTAMP | OPTIONAL | |
| CGD-13 | 검토자 | `cgd_last_reviewed_by` | UUID FK → amb_users | OPTIONAL | |

### 3.2 Level Test Guide (`amb_acm_ref_level_test_guides`) — 11 fields

| F# | Field (KR) | DB Column | Type | Required | Source |
|---|---|---|---|---|---|
| LVL-01 | 시험 유형 | `lvl_exam_type` | ENUM | MUST | `ISEE_LEVEL_TEST` / `SSAT_LEVEL_TEST` |
| LVL-02 | 학년 기준 | `lvl_grade_basis` | ENUM | MUST | `TARGET_GRADE` (ISEE) / `CURRENT_GRADE` (SSAT) — DQ #7 |
| LVL-03 | 배정 규칙 (자유 텍스트) | `lvl_assignment_rule_text` | TEXT | SHOULD | C2 of R13/R17 |
| LVL-04 | 자료 URL | `lvl_resource_url` | VARCHAR(500) | SHOULD | C2 of R14/R18 (Drive 폴더) |
| LVL-05 | 자료 유형 | `lvl_resource_type` | ENUM | MUST | Inferred — `DRIVE_FOLDER` for source data |
| LVL-06 | 자료 메모 | `lvl_resource_note` | TEXT | OPTIONAL | |
| LVL-07 | 활용법 단계 | `lvl_procedure_steps` | JSONB | SHOULD | C2 of R15/R19 (slash-separated) |
| LVL-08 | 기본 소요 시간 | `lvl_default_duration_min` | INT | OPTIONAL | Computed from procedure if known |
| LVL-09 | 버전 번호 | `lvl_version_no` | INT | MUST | |
| LVL-10 | 적용 시작일 | `lvl_effective_from` | DATE | MUST | |
| LVL-11 | 적용 종료일 | `lvl_effective_to` | DATE | OPTIONAL | |

### 3.3 Score Benchmark (`amb_acm_ref_score_benchmarks`) — 22 fields

(Structure per §2.4; key validations:)

| Validation | Rule |
|---|---|
| MAP-only fields are NULL when `sbm_exam_type ≠ MAP` | Enforced by check constraint or service-layer validator |
| ISEE/SSAT % fields ranged 0-100 | `0 ≤ x ≤ 100` |
| Stanine fields populated only when `sbm_exam_type=ISEE` | (SSAT has no Stanine in source) |
| `sbm_inherits_from_sbm_id` non-null only when `sbm_data_status=INHERITED_FROM` | |

---

## 4. Functional Requirements (기능 요구사항)

### 4.1 Reference Data Browse and Search (참조 자료 조회/검색)

| ID | Requirement (요구사항) | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-REF-001 | Class Guideline list view — grouped by exam_type | P0 | Replaces 수업별 가이드라인 sheet |
| FR-REF-002 | Class Guideline detail view — workflow steps as numbered list with role badge | P0 | Preserve 다중 라인 렌더링 |
| FR-REF-003 | Level Test Guide list — ISEE / SSAT side-by-side | P0 | Quick reference for advisors |
| FR-REF-004 | Level Test Guide detail — leveling rule **prominently displayed** with grade basis indicator | P0 | DQ #7 — prevents wrong level assignment |
| FR-REF-005 | Resource URL displays as clickable external link with provider icon | P0 | Drive folder identifiable |
| FR-REF-006 | Score Benchmark — MAP grade matrix view (G1-G12 × R/M) | P0 | Source structure preserved |
| FR-REF-007 | Score Benchmark — ISEE level table view (Level × tier) with grade column | P0 | |
| FR-REF-008 | Score Benchmark — SSAT level table view (Level × tier) with grade column | P0 | |
| FR-REF-009 | Search by exam_type / level / grade / score range | P1 | |
| FR-REF-010 | Bilingual (Ko/En) labels where available | P1 | i18n inherited |
| FR-REF-011 | Modifier display — foreign-school adjustment shown alongside benchmarks | P0 | DQ #6 |

### 4.2 Cross-Module Score Lookup (교차 모듈 점수 조회) — Core Value

The most important feature of REF — auto-fetch benchmark when score is entered.

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-REF-L01 | Service API `findBenchmark(examType, grade, asOfDate)` returns active benchmark for given context | P0 | < 100ms p95 |
| FR-REF-L02 | When CSL F-13 MAP score entered, fetch MAP benchmark for student's grade | P0 | BR-CSL-010 implementation |
| FR-REF-L03 | Display gap analysis inline — "현재 점수 211 / 합격선 220 / 차이 -9점" | P0 | Color-coded: green if meets, red if below, yellow if marginal |
| FR-REF-L04 | When ISEE score entered, classify into tier (일반 / 명문 / Top Boarding) | P0 | "일반 합격선 충족, 명문 사립 부족 (-3%)" |
| FR-REF-L05 | When SSAT score entered, classify into tier | P0 | Same pattern as ISEE |
| FR-REF-L06 | Apply foreign-school modifier when target school is foreign-residents-priority | P0 | Cross-module check via SCH `sch_remark` keywords like "외국인 학교" |
| FR-REF-L07 | When CLS class created with subject_type, suggest matching `cgd_id` | P0 | `cls_ref_guideline_id` auto-populated |
| FR-REF-L08 | When level test session scheduled in CLS, attach level test guide URL | P0 | One-click access to Drive folder |
| FR-REF-L09 | Historical lookup uses `effective_from <= asOfDate < effective_to` | P0 | Q-003 reproducibility |
| FR-REF-L10 | Missing benchmark (e.g. MAP G11) → graceful warning, not error | P0 | Per DQ #2 |

### 4.3 Editing and Versioning (편집 및 버전 관리)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-REF-E01 | Class Guideline edit — workflow steps editor (add/remove/reorder steps) | P0 | ADMIN_LEVEL + designated team-lead only |
| FR-REF-E02 | Edit creates new version row — old version `effective_to=today`, new `effective_from=today+1 OR custom date` | P0 | Per Q-003 versioning |
| FR-REF-E03 | Bulk edit benchmarks — single form for multiple grades when annual policy change | P1 | Productivity |
| FR-REF-E04 | Preview before save — diff view of changes | P1 | |
| FR-REF-E05 | Effective-from date can be future-dated (scheduled change) | P1 | Useful for upcoming admission cycle |
| FR-REF-E06 | Edit history per record — visible to admin/team-lead | P0 | Inherited from AMB audit + versioning chain |
| FR-REF-E07 | "Mark Reviewed" action sets `*_last_reviewed_*` (no version bump if no content change) | P0 | Distinguishes content edit from review |
| FR-REF-E08 | Concurrent edit detection — optimistic locking | P1 | |

### 4.4 Annual Policy Refresh (연간 정책 갱신)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-REF-A01 | Annual review reminder — flag benchmarks not updated in 180 days | P1 | Dashboard widget + AMB Issue auto-creation |
| FR-REF-A02 | Bulk update workflow for new admission cycle | P1 | Import CSV with new values; preview → apply |
| FR-REF-A03 | "Stale" indicator on benchmarks — yellow badge | P1 | Surfaces obligation |
| FR-REF-A04 | Notification to dependent CSL records when benchmark version changes mid-cycle | P1 | Informational; no auto re-evaluation |

### 4.5 Migration (마이그레이션)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-REF-MG01 | Bulk import from `수업별 가이드라인` sheet | P0 | xlsx upload; 26 rows |
| FR-REF-MG02 | Parse two sub-domains by section pattern (R4-R11 vs R13-R19) | P0 | Section detection |
| FR-REF-MG03 | Parse workflow steps from slash-separated text into JSONB array | P0 | Pattern: `(\d+)\)\s*(역할):\s*(설명)` |
| FR-REF-MG04 | Map role names to ENUM (어드바이저→ADVISOR, 팀장→TEAM_LEAD, 담당 강사→TEACHER) | P0 | Best-effort + manual review |
| FR-REF-MG05 | Workflow rows with only label (R6, R9-R11) imported with `cgd_data_status=PLACEHOLDER` | P0 | DQ #8 |
| FR-REF-MG06 | Bulk import from `시험별 적정 점수대` sheet | P0 | Three sub-tables parsed |
| FR-REF-MG07 | MAP G9-G10 "X 이상" parsed as `sbm_map_*_score=X`, `sbm_map_no_upper_bound=TRUE` | P0 | DQ #1 |
| FR-REF-MG08 | MAP G11-G12 empty rows skipped (no record created) | P0 | DQ #2 |
| FR-REF-MG09 | ISEE/SSAT inherit-from-above — populate values + mark `sbm_data_status=INHERITED_FROM` | P0 | DQ #4 |
| FR-REF-MG10 | Foreign-school annotation (R4) parsed into `score_benchmark_modifiers` row | P0 | DQ #6 |
| FR-REF-MG11 | All migrated records get `*_version_no=1`, `*_effective_from=migration_date` | P0 | |
| FR-REF-MG12 | Migration report by sub-domain × data status | P0 | |

---

## 5. Business Rules (비즈니스 규칙)

| ID | Rule (규칙) | Trigger | Action |
|---|---|---|---|
| BR-REF-001 | Benchmark lookup respects effective-date | Cross-module fetch | Find version active at `asOfDate` |
| BR-REF-002 | Editing existing record creates new version, never overwrites | Edit save | Old row `effective_to=today`; new row inserted |
| BR-REF-003 | Foreign-school modifier applied when target school flagged | CSL F-13 score entered AND CSL `inq_target_school_id` references foreign-school | Adjusted benchmark used in gap analysis |
| BR-REF-004 | Inherit-from-above honored on lookup | Benchmark fetch | If `sbm_data_status=INHERITED_FROM`, transparently return inherited values |
| BR-REF-005 | Level test grade-basis enforced in CSL UX | CSL pre-MAP level assignment | UI shows "현재 학년 기준" or "지원 학년 기준" badge per `lvl_grade_basis` |
| BR-REF-006 | Missing benchmark returns INFO, not ERROR | Lookup fails | Logged as informational; CSL displays warning "해당 학년 합격선 데이터 없음" |
| BR-REF-007 | Edit-to-active-version not allowed during in-flight CSL evaluations | Edit save | Soft warning + confirm if active CSL evaluations exist |
| BR-REF-008 | Future-dated effective-from supported | Schedule change | Old version remains active until effective_to; new version activates per schedule |
| BR-REF-009 | Modifier records honor versioning too | Modifier change | Same versioning pattern as benchmarks |
| BR-REF-010 | "Mark Reviewed" without content change does NOT bump version | Review action | Only `last_reviewed_*` updates |

---

## 6. Validation Rules (검증 규칙)

### 6.1 Field-Level

| ID | Field | Rule | Error Code |
|---|---|---|---|
| VR-REF-001 | `cgd_code`, `sbm_code` | Length 3-50; alphanumeric + underscore; UK with version | `VAL_REF_CODE_FORMAT` |
| VR-REF-002 | `cgd_workflow_steps[].step_num` | Sequential starting from 1 | `VAL_STEP_SEQUENCE` |
| VR-REF-003 | `cgd_workflow_steps[].role` | One of `ADVISOR`, `TEAM_LEAD`, `TEACHER`, `SENIOR_MANAGER`, `ADMIN`, `OTHER` | `VAL_STEP_ROLE` |
| VR-REF-004 | `lvl_resource_url` | Valid HTTPS URL when present | `VAL_URL_FORMAT` |
| VR-REF-005 | `sbm_map_reading_score`, `sbm_map_math_score` | NWEA range 100-300 | `VAL_MAP_SCORE_RANGE` |
| VR-REF-006 | `sbm_general_pct`, `sbm_premium_private_pct`, `sbm_top_boarding_pct` | 0 ≤ x ≤ 100 | `VAL_PCT_RANGE` |
| VR-REF-007 | `sbm_*_stanine` | Format `\d-\d` (e.g. "6-7") OR single digit `\d` | `VAL_STANINE_FORMAT` |
| VR-REF-008 | `sbg_grade_min`, `sbg_grade_max` | -2 ≤ x ≤ 12 (Reception=-2, K=0, G1-G12); min ≤ max | `VAL_GRADE_RANGE` |
| VR-REF-009 | `*_effective_from` | Cannot be more than 365 days in past at insert | `VAL_EFFECTIVE_PAST` |
| VR-REF-010 | `*_effective_to` | When set, MUST be > `*_effective_from` | `VAL_EFFECTIVE_ORDER` |

### 6.2 Cross-Field

| ID | Rule | Error Code |
|---|---|---|
| VR-REF-X01 | MAP fields populated only when `sbm_exam_type=MAP`; ISEE/SSAT fields populated only otherwise | `VAL_FIELD_TYPE_MISMATCH` |
| VR-REF-X02 | Stanine fields populated only when `sbm_exam_type=ISEE` | `VAL_STANINE_NOT_FOR_SSAT` |
| VR-REF-X03 | `sbm_data_status=INHERITED_FROM` requires `sbm_inherits_from_sbm_id` non-null | `VAL_INHERIT_REF_REQUIRED` |
| VR-REF-X04 | `sbm_map_no_upper_bound=TRUE` requires `sbm_map_*_score` non-null (the floor value) | `VAL_NO_UPPER_FLOOR_REQUIRED` |
| VR-REF-X05 | Among versions of same `code`, periods cannot overlap | `VAL_VERSION_OVERLAP` |
| VR-REF-X06 | Workflow steps array must have at least 1 step when `cgd_data_status=COMPLETE` | `VAL_STEPS_REQUIRED` |
| VR-REF-X07 | Modifier `sbf_adjustment_min ≤ sbf_adjustment_max` | `VAL_MODIFIER_RANGE_ORDER` |

### 6.3 Migration Quality Flags

| Flag | Trigger | Action |
|---|---|---|
| `MIGRATION_REF_OK` | Clean parse | None |
| `MIGRATION_REF_PLACEHOLDER` | Workflow row has only label | Set `cgd_data_status=PLACEHOLDER`; flag for content backfill |
| `MIGRATION_REF_INHERITED` | Score benchmark row inherits values | Set `sbm_data_status=INHERITED_FROM` |
| `MIGRATION_REF_NO_UPPER` | "X 이상" parsed | Set `sbm_map_no_upper_bound=TRUE` |
| `MIGRATION_REF_ROLE_UNKNOWN` | Workflow step role not in ENUM | Set role to `OTHER`; flag for review |

---

## 7. Cross-Module Integration (모듈 간 연동)

### 7.1 Inbound (수신)

| From | Trigger | Effect on REF |
|---|---|---|
| (none) | (none) | REF is read-mostly; no inbound writes |

### 7.2 Outbound (발신)

| To | Trigger | Payload |
|---|---|---|
| **CSL** | F-13 MAP score entered (BR-CSL-010) | Benchmark + gap analysis returned via `findBenchmark()` |
| **CSL** | F-08 `inq_apply_purpose` + grade input | Suggested level test guide based on purpose |
| **CSL** | Score linked to target school (FR-REF-L06) | Modifier-adjusted benchmark when target is foreign school |
| **CLS** | Class created with subject_type | Suggested `cls_ref_guideline_id` returned |
| **CLS** | Level test session scheduled | Resource URL returned (Drive folder) |
| **DSH** | Score distribution dashboard | Benchmark used as reference line in charts |

### 7.3 Module Interface Contract

```typescript
export interface IAcmRefService {
  // Class guideline lookup (CLS calls)
  findGuidelineByExamType(entId: UUID, examType: ExamType, asOfDate: Date): Promise<ClassGuidelineDto | null>;
  
  // Level test guide lookup (CSL/CLS call when level test scheduled)
  findLevelTestGuide(entId: UUID, examType: 'ISEE_LEVEL_TEST' | 'SSAT_LEVEL_TEST', asOfDate: Date): Promise<LevelTestGuideDto | null>;
  
  // Score benchmark lookup (CSL calls — core API)
  findMapBenchmark(entId: UUID, grade: number, asOfDate: Date): Promise<MapBenchmarkDto | null>;
  findIseeBenchmark(entId: UUID, targetGrade: number, asOfDate: Date): Promise<IseeBenchmarkDto | null>;
  findSsatBenchmark(entId: UUID, currentGrade: number, asOfDate: Date): Promise<SsatBenchmarkDto | null>;
  
  // Gap analysis (CSL calls — convenience)
  analyzeGap(entId: UUID, examType: ExamType, score: ScoreInput, grade: number, asOfDate: Date, modifierContext?: ModifierContext): Promise<GapAnalysisDto>;
  
  // Modifier application (used internally by analyzeGap)
  applyModifiers(benchmark: BenchmarkDto, modifierContext: ModifierContext): Promise<BenchmarkDto>;
  
  // No write methods exposed cross-module — REF writes only via REF UI
}

export interface GapAnalysisDto {
  benchmark: BenchmarkDto;
  studentScore: ScoreInput;
  gap: number | { reading: number; math: number };  // negative if below
  tier: 'BELOW_GENERAL' | 'GENERAL' | 'PREMIUM_PRIVATE' | 'TOP_BOARDING';
  modifierApplied: boolean;
  asOfBenchmarkVersion: number;
}

export interface ModifierContext {
  isForeignSchoolTarget?: boolean;
  // Future: other modifier triggers
}
```

---

## 8. UI/UX Considerations (UI/UX 고려사항)

| ID | Consideration | Rationale |
|---|---|---|
| UI-REF-001 | Class Guideline detail — workflow steps as numbered timeline with role badges (color-coded: Advisor blue, Team Lead purple, Teacher green) | Visual scan; reflects PDF guide structure |
| UI-REF-002 | Level Test Guide — leveling-rule banner prominently at top: "ISEE: 지원 학년 기준" / "SSAT: 현재 학년 기준" | DQ #7 — prevents wrong level assignment |
| UI-REF-003 | Score Benchmark MAP grid — heatmap-style with grade rows × R/M columns; color intensity by score | Quick comparison |
| UI-REF-004 | Score Benchmark ISEE/SSAT — tier columns clearly differentiated (general/premium/top), with both pct and stanine for ISEE | |
| UI-REF-005 | Inherit-from-above visualization — small "↑inherited" badge on rows where data was copied during migration | DQ #4 transparency |
| UI-REF-006 | Modifier explanation — small info icon next to applicable benchmarks; tooltip shows "외국인 학교: +5~+7점 합격선 추가" | DQ #6 awareness |
| UI-REF-007 | Effective period chip on each record — "유효: 2026-01-01 ~ 현재" | Versioning visibility |
| UI-REF-008 | Edit modal preview — side-by-side current vs new before save | FR-REF-E04 |
| UI-REF-009 | Score gap analysis (rendered in CSL but data from REF) — color codes (green/yellow/red) + numeric delta + tier label | Critical UX value |
| UI-REF-010 | Search bar at module top — single field searches across guidelines + level tests + benchmarks | |

---

## 9. Audit, Compliance & Security (감사, 컴플라이언스, 보안)

### 9.1 Audit (Inherited from AMB + Versioning)

| ID | Requirement |
|---|---|
| AUD-REF-001 | Every edit creates new version row + AMB audit log entry |
| AUD-REF-002 | Version chain (`*_supersedes_id`) provides full history without separate audit table |
| AUD-REF-003 | "Mark Reviewed" actions logged (no content change) |
| AUD-REF-004 | Cross-module reads logged with `referrer_module` (CSL/CLS/DSH) for analytics |
| AUD-REF-005 | Soft delete preserves all versions; hard delete only by admin after 90-day retention |

### 9.2 Compliance & Access Control

| ID | Requirement |
|---|---|
| ACL-REF-001 | Read access — all USER_LEVEL within Entity |
| ACL-REF-002 | Write access — ADMIN_LEVEL + designated team leads (via AMB Unit role assignment) |
| ACL-REF-003 | No PII in REF data — safe for broad read access |
| ACL-REF-004 | Modifier values affecting admission decisions — change events trigger team-wide notification |

### 9.3 Multi-Tenant Isolation

| ID | Requirement |
|---|---|
| MT-REF-001 | All queries scoped by `ent_id` via OwnEntityGuard |
| MT-REF-002 | Per-Entity reference data — TPI and sister academies maintain separate REF catalogs in v1.0 |
| MT-REF-003 | Cross-Entity REF sharing (future) — DEFERRED to v2.0 if business confirms shared benchmarks across academies |

---

## 10. Non-Functional Requirements (Module-Specific)

| ID | Category | Requirement | Criteria |
|---|---|---|---|
| NFR-REF-P01 | Performance | `findBenchmark()` — single lookup | < 50ms p95 (cached) / < 100ms p95 (cold) |
| NFR-REF-P02 | Performance | List view (~100 records across all sub-tables) | < 500ms p95 |
| NFR-REF-P03 | Performance | Migration of all source rows | < 30s |
| NFR-REF-S01 | Scalability | Versions per logical record | 50+ supported (years of edits) |
| NFR-REF-S02 | Scalability | Cross-module lookups per second | 100+ (CSL is bursty) |
| NFR-REF-A01 | Availability | Read | 99.9% (advisors depend on it) |
| NFR-REF-C01 | Cacheability | Active versions cached at service layer | 1-hour TTL with cache invalidation on edit |

---

## 11. Risks (Module-Specific)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-REF-001 | Annual policy update missed → CSL evaluations use stale benchmarks | Medium | High | FR-REF-A01 stale-data alerts; FR-REF-A03 visual indicator |
| R-REF-002 | Migration's inherit-from-above incorrectly applies values that don't actually inherit | Medium | Medium | Manual review of `INHERITED_FROM` records during M-1 by 정성경 |
| R-REF-003 | Workflow steps role-name parsing fails on edge cases (e.g. "어드바이저 + 팀장 공동") | Medium | Low | Fallback to `OTHER` + manual review queue |
| R-REF-004 | Foreign-school modifier missed for relevant target schools | Medium | Medium | SCH integration (FR-REF-L06) flags via `sch_remark` keywords; periodic audit |
| R-REF-005 | Drive URL link rot — Google folder moved or permission revoked | Medium | Low | Periodic link health check; alert on 404 |
| R-REF-006 | Future-dated effective_from creates confusion ("why is benchmark different tomorrow?") | Low | Low | UI clearly shows scheduled changes |
| R-REF-007 | Cross-Entity onboarding (v1.1) — sister academies need separate REF data per v2.0 deferred decision | Low | Low | Per-Entity isolation already enforced |

---

## 12. Open Questions (확인 필요 사항)

| ID | Question (질문) | Owner | Required by (필요 시점) |
|---|---|---|---|
| Q-REF-001 | Score benchmark inheritance — is the "Primary 2 only populated, others inherit" pattern actually intentional, or is it just an unfilled spreadsheet? Need confirmation from 정성경 to decide migration strategy. | 정성경 | Before migration (M-1) |
| Q-REF-002 | "외국인학교 +5~+7" modifier — which specific schools in SCH `sch_*` qualify? Need a flagging convention (e.g. `sch_remark` keyword "내국인 30%" or explicit `sch_is_foreign_residents_priority` BOOLEAN field on SCH). | 정성경 / 김태윤 | Before BR-REF-003 implementation |
| Q-REF-003 | MAP G11-G12 benchmarks — are they intentionally absent because TPI students rarely target this level, or are they pending? If TPI may serve G11+ in future, flagging strategy needed. | 김태윤 | Before v1.0a go-live |
| Q-REF-004 | ISEE 활용법 mentions Writing — is Writing optional or mandatory? Affects level test session scheduling in CLS. | 정성경 | Before v1.0b CLS go-live |
| Q-REF-005 | Sample exam PDFs (기출_MAP_RC_*, NWEA_MAP_Mock_Test_*) — should these be migrated as REF resources (e.g. `lvl_resource_url` extended to multi-resource), or kept external? Currently project files; not in TPI_Master.xlsx. | 김태윤 | Before v1.0a (decide migration scope) |
| Q-REF-006 | "Mark Reviewed" cadence — is 6 months too long? Some benchmarks may shift quarterly per international school admission cycle. | 정성경 | Before FR-REF-A01 alert threshold |
| Q-REF-007 | Workflow steps role taxonomy — sufficient with 5 values (`ADVISOR`/`TEAM_LEAD`/`TEACHER`/`SENIOR_MANAGER`/`ADMIN`/`OTHER`), or need finer? Source mentions "담당 강사" specifically. | 김태윤 | Before VR-REF-003 finalization |
| Q-REF-008 | Multi-language reference content — Korean now; English/Vietnamese for v1.1+? Current source is Korean-only. | 김태윤 | Before v1.1 |

---

## 13. Acceptance Criteria for Module Sign-Off

REF module is **DONE for ACM v1.0a** when ALL true:

- [ ] All 5 tables implemented per §2 with proper FK constraints
- [ ] Migration of `수업별 가이드라인` (8 workflow + 2 level test guides) complete with appropriate `*_data_status` flags
- [ ] Migration of `시험별 적정 점수대` (MAP G1-G10 + ISEE Primary 2-Upper + SSAT Elementary-Upper) complete with `INHERITED_FROM` flags applied
- [ ] Foreign-school modifier record created from R4 annotation
- [ ] `findBenchmark()` and `analyzeGap()` services functional and tested with CSL integration
- [ ] All P0 functional requirements pass UAT with 정성경 + 어드바이저
- [ ] Edit + versioning workflow tested — old version preserved, new version active
- [ ] All Q-REF-001 ~ 008 either resolved or explicitly deferred with owner
- [ ] Cross-module integration with CSL exercised in integration tests (BR-CSL-010 → REF lookup → gap displayed)
- [ ] 1-month parallel xlsx + ACM operation completed without data divergence

---

## Appendix A: Source Sheet → DB Quick Reference

### A.1 수업별 가이드라인 → REF Tables

| Source Row | Source Cell | Target Table | Target Field |
|---|---|---|---|
| R4 (MAP Test) | C1 → cgd_label_kr; C2 → parsed cgd_workflow_steps; C3 → cgd_remark | `amb_acm_ref_class_guidelines` (cgd_exam_type=MAP_TEST) | |
| R5-R11 | (same pattern, varying populated cells) | `amb_acm_ref_class_guidelines` (with `cgd_data_status=PLACEHOLDER` when only label) | |
| R13 (ISEE Level Test header) | C1 → lvl_exam_type; C2 → lvl_assignment_rule_text | `amb_acm_ref_level_test_guides` | lvl_grade_basis=`TARGET_GRADE` |
| R14 (ISEE PDF link) | C2 → lvl_resource_url | (continue same row) | lvl_resource_type=`DRIVE_FOLDER` |
| R15 (ISEE 활용법) | C2 → parsed lvl_procedure_steps | (continue same row) | |
| R17-R19 | (same pattern for SSAT) | `amb_acm_ref_level_test_guides` (lvl_exam_type=SSAT_LEVEL_TEST, lvl_grade_basis=`CURRENT_GRADE`) | |

### A.2 시험별 적정 점수대 → REF Tables

| Source Range | Sub-table | Target |
|---|---|---|
| R4 annotation | Foreign school modifier | `amb_acm_ref_score_benchmark_modifiers` (sbf_modifier_type=`FOREIGN_SCHOOL`, sbf_adjustment_min=5, sbf_adjustment_max=7) |
| R7-R16 (G1-G10) | MAP benchmarks | `amb_acm_ref_score_benchmarks` (sbm_exam_type=MAP); 1 row per grade + 1 row per `score_benchmark_grades` |
| R15-R16 (G9, G10) "X 이상" | (same row) | sbm_map_no_upper_bound=TRUE |
| R17-R18 (G11, G12 empty) | (skip — no record) | DQ #2 |
| R22-R32 C1-C5 | ISEE benchmarks | `amb_acm_ref_score_benchmarks` (sbm_exam_type=ISEE); 6 rows (Primary 2/3/4 + Lower/Middle/Upper) |
| R22-R30 C7-C11 | SSAT benchmarks | `amb_acm_ref_score_benchmarks` (sbm_exam_type=SSAT); 4 rows (Elementary G3/G4 + Middle/Upper) |

---

## Appendix B: Requirement ID Index

| Prefix | Category | Count |
|---|---|---|
| FR-REF-001~011 | Browse and Search | 11 |
| FR-REF-L* | Cross-Module Lookup | 10 |
| FR-REF-E* | Editing and Versioning | 8 |
| FR-REF-A* | Annual Policy Refresh | 4 |
| FR-REF-MG* | Migration | 12 |
| BR-REF-* | Business Rules | 10 |
| VR-REF-* | Validation (field) | 10 |
| VR-REF-X* | Validation (cross-field) | 7 |
| AUD-REF-* | Audit | 5 |
| ACL-REF-* | Access control | 4 |
| MT-REF-* | Multi-tenancy | 3 |
| NFR-REF-* | Non-functional | 7 |
| R-REF-* | Risks | 7 |
| Q-REF-* | Open Questions | 8 |
| **Total** | | **106** |

---

**End of Document (문서 끝)**
