---
document_id: ACM-REQ-001
version: 3.0.0
status: Draft
created: 2026-04-25
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
product_code: ACM
db_name: db_amb (shared with AMB Core / AMB 코어와 공유)
table_prefix: amb_acm_
parent_platform: AMB (amoebaManagement)
first_entity_customer: TPI (학원)
source_data:
  - TPI_Master.xlsx (13 sheets)
  - 수업_확인표_*.xlsx (per-teacher monthly attendance — exemplar: 김태윤)
  - 수업 진행 및 업무사항 안내.pdf (operational guide)
supersedes: TPI-REQ-001 v1.0.0; ACM-REQ-001 v2.0.0
related_documents:
  - TPI-ADR-001 (Architecture Decision Record & Open Questions Resolution)
  - TPI-ADR-001-A1 (CLS Module Decisions Addendum)
  - ACM-REQ-CSL-001 v2.1 (Counseling Module — upstream of CLS)
  - ACM-REQ-SCH-001 v1.0 (School Admission Module)
  - ACM-REQ-CLS-001 v1.0 (Class Management Module — NEW)
  - ACM-CHG-001 (Change Impact Assessment — CLS Module)
change_log:
  - version: 1.0.0
    date: 2026-04-25
    author: 김태윤 팀장
    description: Initial draft as TPI-REQ-001
  - version: 2.0.0
    date: 2026-04-25
    author: 김태윤 팀장
    description: Re-issued as ACM-REQ-001 per TPI-ADR-001 — repositioned as AMB Custom App; TSK module removed; prefix tpi_* → amb_acm_*; Q-001~Q-006 resolutions applied
  - version: 3.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Re-issued per TPI-ADR-001-A1 — added CLS (Class Management) as 6th module; phased rollout v1.0a/v1.0b/v1.1; Bodaschool + Google Calendar integrations declared; data sources expanded with 수업_확인표 and AS-IS PDF; new constraints C-009~C-012 (TPI-ADR-001-A1 반영 — CLS 6번째 모듈 추가, v1.0a/b/v1.1 단계 분할, 보다스쿨/구글 캘린더 연동, 새 데이터 출처 + 제약 추가)
---

# Academy Management Custom App — Requirements Analysis (학원관리앱 요구사항 분석서)

> **AMB Custom App** (`amb_acm_*`). First Entity (학원) using this app: **TPI**. Sister academies (Santa Croce, 트리니티) onboard from v1.1.
> AMB 플랫폼의 **Custom App**(`amb_acm_*`). 첫 사용 Entity(학원)는 **TPI**. 자매 학원(Santa Croce, 트리니티)은 v1.1부터 온보딩.
>
> **v3.0 update:** Added CLS (Class Management) module as 6th module per `TPI-ADR-001-A1`. Phased rollout: v1.0a (existing 5 modules) → v1.0b (CLS without external integrations) → v1.1 (Bodaschool + Google Calendar).
> **v3.0 업데이트:** `TPI-ADR-001-A1`에 따라 CLS(수업관리) 모듈 6번째로 추가. 단계 분할: v1.0a(기존 5개) → v1.0b(CLS 내부 기능) → v1.1(보다스쿨 + Google Calendar).

---

## 1. Project Overview (프로젝트 개요)

### 1.1 Document Information (문서 정보)

| Item (항목) | Content (내용) |
|---|---|
| **Product Name (제품명)** | Academy Management Custom App (학원관리앱) |
| **Product Code (제품 코드)** | ACM |
| **Domain (도메인)** | Education / International School Prep Counseling + Class Operations (교육/국제학교 입시 상담 + 수업 운영) |
| **Version (버전)** | v1.0 (split into v1.0a / v1.0b / v1.1 sub-phases) |
| **Date (작성일)** | 2026-04-26 (v3.0 update) |
| **Parent Platform (상위 플랫폼)** | AMB (amoebaManagement) — Auth, Entity, Task/Issue, Access Control inherited (인증/엔티티/작업/접근제어 상속) |
| **External Integrations (외부 연동)** | Bodaschool (video, agreement reached) + Google Meet (deep link) + Google Calendar (one-way push, DEC-2) |
| **Reference Project (기준 프로젝트)** | AMB Management v2.0 (44+ domain modules, 188 tables) |

### 1.2 Background and Purpose (배경 및 목적)

TPI is an academy specializing in international school admission prep, MAP Test, ISEE, SSAT, and overseas boarding application support. Daily operations are currently distributed across:

TPI는 국제학교 입시 준비, MAP Test, ISEE, SSAT, 해외 보딩스쿨 지원 전문 학원으로, 일상 운영이 다음에 분산되어 있다.

- **`TPI_Master.xlsx`** — 13 sheets covering counseling, school admissions, references, Q&A, schedules
- **`수업_확인표_*.xlsx`** — per-teacher monthly attendance and settlement spreadsheets (one file per teacher)
- **Google Calendar + Google Meet** — current operational backbone for class delivery, link distribution, and feedback (per AS-IS PDF "수업 진행 및 업무사항 안내.pdf")

The 업무 sheet R3-R12 reveals shared management of multiple academies — TPI, Santa Croce, 트리니티. The product opportunity is therefore a **reusable Academy Management Custom App** on AMB, with TPI as the **first Entity**.

업무 시트 R3-R12는 다수 학원(TPI, Santa Croce, 트리니티)의 공유 관리 구조를 드러낸다. 따라서 제품 기회는 AMB 위의 **재사용 가능한 학원관리앱(Custom App)**이며, TPI는 **첫 번째 온보딩 Entity**다.

This decision is recorded in `TPI-ADR-001`. The v3.0 expansion adds **Class Management (CLS)** as the 6th module per `TPI-ADR-001-A1`, replacing manual spreadsheet operations for class scheduling, attendance, makeup, feedback, and teacher settlement. Class video delivery is configurable per class — Google Meet OR Bodaschool — chosen by the teacher at class registration (DEC-1 dual-provider). Class schedules are pushed one-way to Google Calendar (DEC-2) so teachers retain their familiar daily view.

이 결정은 `TPI-ADR-001`에 기록되어 있고, v3.0 확장은 `TPI-ADR-001-A1`에 따라 **수업관리(CLS)**를 6번째 모듈로 추가하여 수업 일정/출석/보강/피드백/강사 정산의 수동 운영을 대체한다. 수업 화상은 강사가 수업 등록 시 Google Meet 또는 보다스쿨 중 선택(DEC-1), 일정은 Google Calendar로 단방향 push(DEC-2)되어 강사는 익숙한 일별 뷰를 유지한다.

By being a Custom App on AMB rather than a standalone project, ACM inherits multi-tenancy, authentication, access control (AMB ACL Policy), Task/Issue management, KMS, encryption, and i18n for free, and supports sister academy onboarding as "add new Entity" rather than "deploy new project".

독립 프로젝트가 아닌 AMB 위의 Custom App으로 구현함으로써 ACM은 멀티테넌시/인증/접근 제어/Task/KMS/암호화/i18n을 무상 상속하며, 자매 학원 온보딩이 "새 Entity 추가"로 단순화된다.

### 1.3 Architecture Position (아키텍처 위치)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  AMB Platform (amoebaManagement)                                            │
│                                                                             │
│  ┌─────────────────────┐   ┌───────────────────────────────────────────┐   │
│  │ AMB Core (amb_*)    │   │ Custom Apps (amb_<custom>_*)              │   │
│  │  - Auth, Entity     │◄──┤                                           │   │
│  │  - Task/Issue (=AMA)│   │  ┌──────────────────────────────────┐    │   │
│  │  - KMS, Webmail     │   │  │ Academy Mgmt App (amb_acm_*)     │    │   │
│  │  - Access Control   │   │  │                                  │    │   │
│  │  - i18n, Encryption │   │  │  Modules (6):                    │    │   │
│  └─────────────────────┘   │  │   1. DSH — Dashboard             │    │   │
│                            │  │   2. CSL — Counseling            │    │   │
│                            │  │   3. SCH — School Admission      │    │   │
│                            │  │   4. REF — Reference             │    │   │
│                            │  │   5. QNA — Regular Counseling    │    │   │
│                            │  │   6. CLS — Class Mgmt 🆕 v3.0    │    │   │
│                            │  └──────────────────────────────────┘    │   │
│                            └───────────────────────────────────────────┘   │
│                                                                             │
│  Entities: TPI ─ Santa Croce (v1.1) ─ 트리니티 (v1.1)                       │
└────────────────────────────────────────────────────────────────────────────┘
                                            │
                            ┌───────────────┴───────────────────┐
                            │ External Integrations (CLS only)  │
                            │  - Google Meet (deep link)        │
                            │  - Bodaschool (API, agreed)       │
                            │  - Google Calendar (one-way push) │
                            └───────────────────────────────────┘

Tasks (업무 시트) → AMB Core Task/Issue feature directly (one-way API call)
                    ACM modules call AMB Issue API for system-generated tasks
                    (e.g. SLA breach in CSL or CLS)
```

### 1.4 Expected Benefits (기대 효과)

| Benefit (효과) | Measurable Indicator (측정 지표) |
|---|---|
| Counseling pipeline visibility (상담 파이프라인 가시화) | New consultation → enrollment conversion rate auto-calculated daily |
| Class operation digitization (수업 운영 디지털화) — **NEW v3.0** | Per-teacher monthly settlement compute time: 30min → 0min (via CLS auto-compute) |
| Reduce manual aggregation (수동 집계 감소) | Daily KPI compilation: 1h → 0min |
| Eliminate data integrity issues (데이터 정합성 보장) | DB-level FK constraints + soft delete |
| Centralize task management on AMB (작업 관리는 AMB로 통합) | All operational tasks tracked in AMB Issue |
| Centralize school admission knowledge (학교 입학 정보 중앙화) | Frontend page replaces shared spreadsheet |
| **Class scheduling continuity (수업 일정 연속성)** — **NEW v3.0** | Teachers retain Google Calendar view via one-way push (DEC-2); zero workflow disruption |
| **Dual-provider video flexibility (듀얼 화상 제공자 유연성)** — **NEW v3.0** | Per-class choice: Google Meet OR Bodaschool (DEC-1); migration not forced |
| **Reusable across sister academies** | New Entity onboarding ≤ 2 days post v1.0 (v1.1+) |
| **Dev cost reduction vs standalone** | -4 to -6 weeks via AMB Core inheritance |

### 1.5 Core Values (핵심 가치)

| Value (가치) | Description (설명) |
|---|---|
| **AMB-native** | Inherit, don't reimplement — auth, multi-tenancy, tasks, encryption all from AMB Core |
| **Data-driven counseling** | Every prospect tracked through 6-stage pipeline from intake to enrollment |
| **Single source of truth** | Replace 13+ cross-linked sheets and per-teacher attendance files with normalized DB |
| **Knowledge accumulation** | Class guidelines, exam score benchmarks, Q&A as reusable reference data attached to evaluations |
| **Workflow preservation (워크플로우 보존)** — **NEW v3.0** | Teachers' familiar Google Calendar habit preserved via one-way push; advisor-mediated parent communication preserved per AS-IS PDF; familiar attendance grid available as xlsx export |

### 1.6 User Types (사용자 유형)

ACM inherits the AMB 4-level user model. ACM does not define its own user system.
ACM은 AMB 4-레벨 사용자 모델을 상속한다.

| AMB Level | TPI Entity Role | Key Permissions (주요 권한) | New v3.0 Permissions |
|---|---|---|---|
| ADMIN_LEVEL | 최지용 (대표) | All — Entity admin, master config | Settlement override, OAuth admin |
| USER_LEVEL (Senior Manager) | 배예리 수석팀장 | Approval of payment, contract, web/domain | **Settlement confirmation (CLS DEC-4)** |
| USER_LEVEL (Team Lead) | 정성경, 김태윤 팀장 | Daily feedback, exam material curation, matching, parent counseling | **Makeup approval, substitute teacher approval (Q-CLS-011)** |
| USER_LEVEL (Advisor) | (충원 예정) | Counseling intake, homepage form, MAP Test ops | **Cancellation approval, makeup proposal coordination (AS-IS PDF rule 6)** |
| USER_LEVEL (Designer) | 디자인 담당 | Blog/SNS posting, design ops | (no change) |
| **USER_LEVEL (Teacher)** — **emphasized in v3.0** | All teachers | View own students/schedule, write feedback | **Primary CLS user — class CRUD, attendance entry, feedback writing, settlement view, OAuth grant for GCal push (FR-CLS-G01)** |
| CLIENT_LEVEL | (future / 향후) | Parent portal v2 | View own child's progress, MAP score, payment status, **class feedback (post-advisor delivery)** |

> **Note:** Roles within USER_LEVEL are managed via AMB Unit + role assignments per Q-ACM-007 in `TPI-ADR-001`.
> USER_LEVEL 내 세부 역할은 AMB Unit + role 할당으로 관리.

> **Out of scope for v1.0:** CLIENT_LEVEL parent portal — defined for future (v2.0).

---

## 2. Stakeholders (이해관계자)

| Role (역할) | Person/Team (담당자/팀) | Responsibility (책임) |
|---|---|---|
| Project Sponsor | 최지용 (CEO) | Final approval, budget, business direction; **Bodaschool contract (Q-CLS-006)** |
| Product Owner | 김태윤 팀장 | Requirements ownership, priority, sign-off per stage; **Bodaschool API spec coordination with 새하컴즈 (Q-CLS-015)** |
| Senior Manager | 배예리 수석팀장 | Workflow validation, payment process review; **settlement scope (DEC-4)** |
| Operations Lead | 정성경 팀장, 어드바이저 | UAT participants, daily operation feedback; **makeup/cancellation policies (Q-CLS-011, Q-CLS-012)** |
| **Teachers (강사진)** — **emphasized v3.0** | All teachers | Primary CLS users — UAT for class workflow; OAuth grants; xlsx-format compatibility validation |
| AMB Platform Lead | (TBA) | Custom App registration, AMB-side integration approval (Q-ACM-001~006) |
| **External — 새하컴즈 (Bodaschool)** — **NEW v3.0** | TBA | API spec exchange, room provisioning, contract |
| Development Team | Amoeba Company internal | Implementation following Amoeba code convention v2.0 |
| QA | Amoeba Company QA | Unit/integration test, UAT support, **Bodaschool integration test** |

---

## 3. Scope Definition (범위 정의)

### 3.1 In-Scope — ACM v1.0 (포함 범위) — Updated v3.0

The Custom App contains **6 modules** (was 5 in v2.0; added CLS).
Custom App은 **6개 모듈** (v2.0의 5개에서 CLS 추가).

| Source | Feature Module | Module Code | DB Table Prefix | Sub-Phase |
|---|---|---|---|---|
| **INDEX** | Dashboard (대시보드) | DSH | `amb_acm_dsh_*` | v1.0a |
| **신규** | Counseling Management — New Intake (신규 상담관리) | CSL | `amb_acm_csl_*` | v1.0a |
| **학교입학 정보** | School Admission Information | SCH | `amb_acm_sch_*` | v1.0a |
| **수업별 가이드라인** + **시험별 적정 점수대** | Reference Materials (참조 자료) | REF | `amb_acm_ref_*` | v1.0a |
| **Q&A** | Regular Counseling — Parent/Student Q&A (정기상담) | QNA | `amb_acm_qna_*` | v1.0a |
| **수업_확인표_*.xlsx + 스케쥴(쌤) + 이윤건 이윤후** | **Class Management (수업관리)** 🆕 | **CLS** | `amb_acm_cls_*` | **v1.0b + v1.1** |

### 3.2 Tasks Sheet — Direct AMB Integration (업무 시트는 AMB 직접 연동)

The 업무 sheet does **not** become an ACM module. Per `TPI-ADR-001`, all tasks are registered directly in AMB Core's Task/Issue feature.

업무 시트는 ACM 모듈로 만들지 **않는다**. 모든 업무는 AMB 코어의 Task/Issue 기능에 직접 등록.

| 업무 sheet section (영역) | Mapping (매핑) |
|---|---|
| Section A: R&R Master (R1-R12) | → AMB `amb_units` + `amb_user_unit_roles` (Q-ACM-007) |
| Section B: Daily Tasks (R15+) | → AMB Core Issue/Task tables |
| New tasks created by ACM modules (CSL/CLS SLA breach etc.) | → ACM modules call AMB Issue API one-way; label `source:acm` |

### 3.3 External Integrations — NEW v3.0 (외부 연동 — v3.0 신규)

Three external integrations are introduced **only by the CLS module**, all in sub-phase v1.1:

| Integration | Type | Purpose | Sub-Phase | Reference |
|---|---|---|---|---|
| **Google Meet** | Deep link generation (no separate API; via GCal event with conference data) | Video session for classes where teacher selects GMeet | v1.1 | DEC-1 option 1 |
| **Bodaschool** | Open API (agreement reached with 새하컴즈) | Video session + multi-note + homework for classes where teacher selects Bodaschool | v1.1 | DEC-1 option 2 + Q-CLS-004 RESOLVED |
| **Google Calendar** | OAuth 2.0 + Calendar API — **one-way push only** | Push class schedule (and feedback) to teacher's GCal; preserves AS-IS workflow | v1.1 | DEC-2 (Option C) |

> External integrations are confined to CLS. CSL/SCH/REF/QNA/DSH have NO external integration.
> 외부 연동은 CLS에 국한. 다른 모듈은 외부 연동 없음.

### 3.4 Out-of-Scope — v1.0 (제외 범위)

| Item (항목) | Reason (사유) | Target Version (대상 버전) |
|---|---|---|
| Parent portal (CLIENT_LEVEL) | Out of scope for v1.0; advisor-mediated parent comm preserved | v2.0 |
| AMB Payroll integration (settlement payment) | DEC-4 — CLS computes only; payment integration deferred | v1.1+ |
| MKT (Marketing) sheets | Marketing as separate Custom App | ACM-MKT v1.0 |
| Two-way Google Calendar sync | Per DEC-2 — one-way only by architectural choice | (not planned) |
| 시트17 | Empty/scratch sheet | N/A |

### 3.5 MVP Definition — Updated v3.0 (MVP 정의)

**v1.0a — Existing 5 modules cut-over (기존 5개 모듈 전환)** — 11 weeks:

1. **CSL (P0)** — full pipeline coverage of all 25 fields
2. **DSH (P0)** — daily/monthly KPI auto-aggregation matching INDEX sheet
3. **SCH (P1)** — read/write page for school admission info
4. **REF (P1)** — class guidelines + exam score benchmarks
5. **QNA (P1)** — search/categorize parent/student Q&A

**v1.0b — CLS internal (CLS 내부 기능)** — +6-8 weeks:

6. **CLS (P0)** — classes, recurrence, sessions, attendance, makeup, feedback, settlement calc — **without** external integrations
   - Provider field `vcf_provider` saved (used in v1.1)
   - GCal push fields exist but disabled
   - xlsx export matches `수업_확인표_*.xlsx` for parallel operation

**v1.1 — CLS external integrations (CLS 외부 연동)** — +3.5-5 weeks:

7. **Bodaschool API integration** — room creation, link generation, attendance webhook (TBD per spec)
8. **Google Meet deep linking** — via GCal event with conference data
9. **Google Calendar one-way push** — sessions + feedback descriptions
10. **OAuth onboarding flow** — per-teacher

**Total program duration: ~21-24 weeks**

---

## 4. Functional Requirements (기능 요구사항)

### 4.1 ID Convention (ID 체계)

`FR-{MODULE}-{NNN}` — `MODULE` is one of `DSH`, `CSL`, `SCH`, `REF`, `QNA`, **`CLS`**. NNN is zero-padded sequence.
For module-level deep-dive, see `ACM-REQ-{MODULE}-001` documents.

### 4.2 Module DSH — Dashboard (대시보드)

**Source:** `INDEX` sheet (1002 rows × 27 cols). Daily rows × 4 metric categories. **v3.0 update**: Class metrics now have real data source via CLS.

| ID | Requirement (요구사항) | Priority | Note (비고) |
|---|---|---|---|
| FR-DSH-001 | Display monthly KPI dashboard with 4 categories: Marketing, CS, Operating, Class | P0 | Replaces INDEX R3 monthly summary |
| FR-DSH-002 | Marketing metrics: Visitor (방문자), Cost (비용), Effect (효율) | P0 | Effect = Visitor / Cost |
| FR-DSH-003 | CS metrics: Counseling, Apply, Beginning, Missing, Trial Class, Complain | P0 | Daily counts |
| FR-DSH-004 | Operating metrics: New St., Out St., # of St., New Tc., Out Tc., # of Tc., Map Test | P0 | Running totals |
| FR-DSH-005 | **Class metrics: Tt. Class, Student, Teacher** + cancellation rate (결강율) + makeup completion rate + teacher monthly hours | P0 | **Now real data via CLS (v1.0b)** |
| FR-DSH-006 | Daily detail table — 1 row per day with 요일/MS for selected month | P0 | Default current month |
| FR-DSH-007 | Auto-compute monthly Average row | P0 | Equivalent to INDEX R4 |
| FR-DSH-008 | Auto-compute monthly Total row | P0 | Equivalent to INDEX R3 |
| FR-DSH-009 | Drill-down to source records on metric click | P1 | Counseling click → CSL filtered; **Class click → CLS filtered** |
| FR-DSH-010 | YoY and MoM comparison | P1 | |
| FR-DSH-011 | Export dashboard as Excel matching INDEX layout | P2 | Continuity |
| FR-DSH-012 | Multi-tenant filter by `ent_id` — own Entity data only | P0 | Inherited from AMB OwnEntityGuard |

### 4.3 Module CSL — Counseling Management (신규 상담관리)

> **See `ACM-REQ-CSL-001` v2.1 for full module-level deep-dive (129 requirement IDs).**
> CSL 모듈 전체 상세는 `ACM-REQ-CSL-001` v2.1 참조.

**Source:** `신규` sheet (302 rows × 25 cols, 140 active records). All 25 fields MUST be implemented.

Pipeline (6 stages): `INTAKE → MAP_TEST → TRIAL_CLASS → ENROLLMENT_COUNSELING → PAYMENT → CLASS_STARTED`

**v2.1 update:** CSL F-24 `cls_started=YES` triggers cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED` (BR-CLS-001).

Key data findings (140 active records analyzed):
- Conversion: INTAKE 100% → CLASS_STARTED 10.0%
- Inflow: Homepage 57.1% / KakaoTalk 38.6% / Phone 4.3%
- By purpose: MAP score-up 21.7% (best) > GPA 20.0% > Intl. school prep 11.4% > Std test 0%

### 4.4 Module SCH — School Admission Information (학교 입학 정보)

> **See `ACM-REQ-SCH-001` v1.0 for full module-level deep-dive (85 requirement IDs).**

**Source:** `학교입학 정보` sheet (1000 rows × 8 cols). Active data: 41 rows across **2 categories** — `AUTHORIZED` (인가 7 schools) / `UNAUTHORIZED` (비인가 ~11 schools).

Authorized schools have grade-band sub-rows; unauthorized schools are flat.

### 4.5 Module REF — Reference Materials (참조 자료)

> **See `ACM-REQ-REF-001` (to be authored) for full module-level deep-dive.**

**Source:** `수업별 가이드라인` (26 rows × 7 cols) + `시험별 적정 점수대` (999 rows × 27 cols). Reference data attached to Counseling/Class evaluation contexts.

| ID | Requirement | Priority | Note |
|---|---|---|---|
| FR-REF-001 | Class Guideline master — exam type, responsibility split, workflow steps, remarks | P0 | Source: 수업별 가이드라인 |
| FR-REF-002 | Supported exam types: MAP Test, SSAT, ISEE, Writing Competition, Summer Camp, Junior Boarding, Boarding, 국내 국제/외국인학교 | P0 | |
| FR-REF-003 | Each guideline includes: numbered workflow steps, responsibility per step, external doc links | P0 | |
| FR-REF-004 | Score Benchmark master — NWEA MAP by grade (G1-G12), R/M/L 합격선 | P0 | |
| FR-REF-005 | Score Benchmark for ISEE — Level × target grade × tier | P0 | |
| FR-REF-006 | Score Benchmark for SSAT — Level × target grade × tier | P0 | |
| FR-REF-007 | **Auto-attach reference to evaluation context** — when CSL MAP score entered, fetch matching grade benchmark + display gap analysis | P0 | |
| FR-REF-008 | Tier classification on score entry — show closest matching tier | P0 | |
| FR-REF-009 | Reference data is read-only for advisors; edit restricted to ADMIN_LEVEL + designated team leads | P0 | |
| FR-REF-010 | **Per-update versioning** — `ref_effective_from`/`ref_effective_to`; CSL records reference benchmark by date | P1 | Q-003 |
| FR-REF-011 | **CLS class-type templates linked from REF guidelines** — **NEW v3.0** | P1 | CLS `cls_ref_guideline_id` cross-link |

### 4.6 Module QNA — Regular Counseling (정기상담, 학부모/학생 Q&A)

> **See `ACM-REQ-QNA-001` (to be authored) for full module-level deep-dive.**

**Source:** `Q&A` sheet (1035 rows × 27 cols). Per Q-004 resolution: cleansed during M-3 migration; expected ~200 active records. User explicitly requested classification as **정기상담**, separate from CSL ("신규상담").

### 4.7 Module CLS — Class Management (수업관리) — NEW v3.0

> **See `ACM-REQ-CLS-001` v1.0 for full module-level deep-dive (174 requirement IDs).**
> CLS 모듈 전체 상세는 `ACM-REQ-CLS-001` v1.0 참조 (174개 요구사항 ID).

**Source:**
- `수업_확인표_*.xlsx` per teacher (exemplar: 김태윤 — 15 monthly sheets, 2025.2 ~ 2026.4)
- `TPI_Master.xlsx › 스케쥴(쌤)` (74 rows, deferred from v1.1, now in v1.0b)
- `TPI_Master.xlsx › 이윤건 이윤후 (수업 진행도)` (deferred from v1.2, now in v1.0b)
- AS-IS PDF "수업 진행 및 업무사항 안내.pdf" — operational rules + feedback templates

Summary by sub-category:

| Sub-category | Range | Count | Sub-Phase |
|---|---|---|---|
| Class CRUD | FR-CLS-C01 ~ C10 | 10 | v1.0b |
| Schedule & Session | FR-CLS-S01 ~ S10 | 10 | v1.0b |
| Attendance | FR-CLS-A01 ~ A10 | 10 | v1.0b |
| Makeup | FR-CLS-M01 ~ M07 | 7 | v1.0b |
| Video Provider | FR-CLS-V01 ~ V09 | 9 | v1.0b (field) + v1.1 (integration) |
| Google Calendar | FR-CLS-G01 ~ G09 | 9 | v1.1 |
| Feedback | FR-CLS-F01 ~ F08 | 8 | v1.0b (form) + v1.1 (GCal sync) |
| Settlement | FR-CLS-T01 ~ T08 | 8 | v1.0b |
| Migration | FR-CLS-MG01 ~ MG10 | 10 | v1.0b |

**Key architectural decisions** (per `TPI-ADR-001-A1`):

| ID | Decision |
|---|---|
| DEC-1 | Dual-provider video — Google Meet OR Bodaschool, teacher chooses per class |
| DEC-2 | Google Calendar — one-way push only (Option C); ACM is system of record |
| DEC-4 | Settlement = calculation only in CLS; AMB Payroll integration deferred |
| DEC-5 | Group classes = one schedule × N students |
| DEC-6 | Per-hour rate = (Teacher, Student) pair-based |

Data observations (from `수업_확인표_김태윤.xlsx`):
- Up to 8 students/teacher/month, up to 16 sessions + 3 makeups per student
- Class modes: 대면 / 비대면 / 2인 대면 (per-session, Q-CLS-010)
- Cancellation reasons: 9 ENUM values
- Hourly rate: 30,000 — 55,000 KRW per (teacher, student) pair
- 3.3% withholding for teacher settlement (세후)

---

## 5. Non-Functional Requirements (비기능 요구사항)

| ID | Category (분류) | Requirement (요구사항) | Criteria (기준) |
|---|---|---|---|
| NFR-001 | Performance | Page load time | First contentful paint < 1.5s, full load < 3s on 4G |
| NFR-002 | Performance | API response time | p95 < 200ms, p99 < 500ms (read); < 500ms / < 1s (write) |
| NFR-003 | Performance | Dashboard aggregation | Monthly view < 2s for 31 days × 21 metrics |
| NFR-004 | Scalability | Concurrent users per Entity | 50 for v1.0; scalable to 500 across all Entities for v2 |
| NFR-005 | Scalability | Records per Entity | Up to 100k CSL, 100k Q&A, **500+ active classes, 10k+ sessions/month per ent_id** (v3.0) |
| NFR-006 | Security | Phone number encryption | AES-256-GCM 3-field per Amoeba §13 |
| NFR-007 | Security | Authentication | AMB JWT-based; @Auth() guard inherited |
| NFR-008 | Security | Multi-tenant isolation | OwnEntityGuard + ent_id FK on every table |
| NFR-009 | Security | Audit logging | All CRUD on CSL, QNA, **CLS** logged via AMB audit |
| NFR-010 | Compliance | PIPA (개인정보보호법) | Phone encrypted at rest; channel-specific consent (Q-CSL-010); **Bodaschool data residency disclosure (Q-CLS for v1.1)** |
| NFR-011 | Reliability | Uptime | 99.5% inheriting from AMB SLA |
| NFR-012 | Reliability | Backup | Daily AMB backup covers ACM tables |
| NFR-013 | Reliability | Soft delete | All ACM business tables include `{prefix}_deleted_at` |
| NFR-014 | Compatibility | Browser support | Chrome 100+, Edge 100+, Safari 15+ |
| NFR-015 | Compatibility | Mobile responsive | Dashboard read-only on mobile; CSL editing optimized for ≥ 1280px; **CLS attendance entry mobile-optimized (UI-CLS-007)** |
| NFR-016 | i18n | UI languages | Korean (default), English, Vietnamese per Amoeba §14 |
| NFR-017 | Maintainability | Code convention | Amoeba code convention v2.0 strictly followed |
| NFR-018 | Maintainability | DB schema | Tables: `amb_acm_{domain}_{plural}`, columns: `{3letter}_{name}` |
| NFR-019 | Observability | Logging | Structured JSON logs; correlation ID per request |
| NFR-020 | Observability | Monitoring | AMB platform health check + Cloud monitoring |
| NFR-021 | Migration | Initial data import | One-time bulk import for CSL, SCH, REF, QNA in single business day; **CLS migration in 2-3 days due to per-teacher xlsx variance (Q-CLS-007)** |
| **NFR-022** | **External Integration (v1.1)** | **Bodaschool API latency** | **< 2s p95 (depends on partner SLA)** |
| **NFR-023** | **External Integration (v1.1)** | **GCal push latency** | **< 5s p95 (eventually consistent)** |
| **NFR-024** | **External Integration (v1.1)** | **Bodaschool / GCal degraded mode** | **Class still saves; warning shown if external API down** |

---

## 6. Constraints and Assumptions (제약사항 및 가정)

### 6.1 Technical Constraints (기술 제약)

| ID | Constraint (제약) | Source (출처) |
|---|---|---|
| C-001 | Tech stack fixed to Amoeba standard: Vue.js 3 + NestJS 10 + PostgreSQL 15 + Redis 7 | Amoeba code convention v2.0 |
| C-002 | **AMB Custom App architecture** — ACM registered in `amb_entity_custom_apps`; cannot deviate from AMB auth/permission model | TPI-ADR-001 |
| C-003 | All ACM tables MUST use `amb_acm_*` prefix sharing `db_amb` | TPI-ADR-001 §2.1 (Q-ACM-005) |
| C-004 | All business tables MUST have `ent_id` FK and OwnEntityGuard | Amoeba §12 |
| C-005 | Sensitive fields (phone, OAuth tokens) MUST use 3-field encryption | Amoeba §13 |
| C-006 | All UI text MUST go through i18n (no hardcoded strings) | Amoeba §14 |
| C-007 | Git branches: `production` / `main` / `feature/*` / `hotfix/*` | Amoeba §15 |
| C-008 | **Tasks managed in AMB Core, not in ACM** — ACM may create tasks via AMB Issue API (one-way) | TPI-ADR-001 |
| **C-009** | **CLS module: dual-provider video architecture** — both Google Meet and Bodaschool MUST be supported via `IVideoProvider` adapter pattern | **TPI-ADR-001-A1 DEC-1** |
| **C-010** | **CLS module: Google Calendar one-way push only** — code MUST NOT read from Google Calendar; enforced by code review | **TPI-ADR-001-A1 DEC-2** |
| **C-011** | **CLS module: settlement is calculation only** — no payroll execution within CLS in v1.0; xlsx export to AMB Payroll for v1.1+ | **TPI-ADR-001-A1 DEC-4** |
| **C-012** | **CLS module: phased delivery — v1.0b (internal) before v1.1 (external integrations)** — Bodaschool/GCal must NOT block v1.0b release | **TPI-ADR-001-A1 DEC-3** |

### 6.2 Business Constraints (업무 제약)

| ID | Constraint (제약) |
|---|---|
| C-101 | Existing `TPI_Master.xlsx` and `수업_확인표_*.xlsx` must remain readable during transition (parallel operation: 1 month minimum per module) |
| C-102 | Phone numbers in source data may contain "x" or be missing — system MUST accept these via `inq_phone_status` ENUM (Q-CSL-010) |
| C-103 | The 신규 sheet has cases where 이름 = "unknown" (anonymous) — `inq_is_anonymous` flag |
| C-104 | Score entry format in source is non-standard — system parses on import (Q-CSL-001) |
| C-105 | Application schedule data may be free-text fallback — accepted via `sch_admission_note` (Q-002) |
| **C-106** | **AS-IS PDF rule 7 — student/parent contact NOT exposed to teachers; advisor mediates all parent communication** | **AS-IS PDF + PII-CLS-001** |
| **C-107** | **CLS migration: per-teacher xlsx format variance assumed** — sample 2-3 files before final migration design (Q-CLS-007) | **TPI-ADR-001-A1** |

### 6.3 Assumptions (가정)

| ID | Assumption (가정) |
|---|---|
| A-001 | TPI is the first Entity in v1.0; sister academies (Santa Croce, 트리니티) onboard in v1.1 |
| A-002 | All staff have Google accounts — SSO via Google OAuth acceptable |
| A-003 | AMB platform is production-ready and accepts new Custom App registration |
| A-004 | Q&A sheet's 1035 rows include many template/empty rows; cleansing during M-3 (Q-004) |
| A-005 | School admission deadline data is mixed structured + free-text (Q-002) |
| **A-006** | **Bodaschool API agreement reached with 새하컴즈 (2026-04-26); detailed spec exchange in progress** | **Q-CLS-004 RESOLVED** |
| **A-007** | **Teachers will grant Google Calendar OAuth `calendar.events` scope at v1.1 onboarding** | **DEC-2** |
| **A-008** | **Per-teacher attendance xlsx uses consistent triplet structure (학생명 / 시간 / 비고) across all teachers** | **Verified for 김태윤; to be validated for 2-3 more teachers in M-2** |

---

## 7. Data Volume and Migration Plan (데이터 볼륨 및 마이그레이션 계획)

### 7.1 Source Data Volume — Updated v3.0 (원천 데이터 볼륨)

| Source | Active Rows | Target Module | Notes |
|---|---|---|---|
| INDEX | ~31 days × 12 months | DSH (computed) | Recomputed from CSL/Tasks; INDEX is read-only reference |
| 신규 | **140 active** (verified) | CSL | Migrate per ACM-REQ-CSL-001 §5.5 |
| 학교입학 정보 | ~25 schools × ~2-7 grade-bands = **41 active** | SCH | 7 인가 + 11+ 비인가 |
| 업무 (Section A) | ~30 R&R entries | AMB `amb_units` + role assignments | Master data via AMB |
| 업무 (Section B) | ~85 daily tasks | AMB Core Issue tables | Migrate as historical with `source:acm-migration` label |
| 수업별 가이드라인 | ~10 exam types | REF | Master data |
| 시험별 적정 점수대 | ~30 score rows | REF | Master data |
| Q&A | ~1030 raw → **~200 active** after cleanse | QNA | Drop rows missing 질문 OR 응답 |
| **수업_확인표_김태윤.xlsx** | **15 monthly sheets, ~120 sessions per month at peak (~1,800 sessions over 15 months)** | **CLS** | **Per-teacher; teacher count TBD (Q-CLS-007)** |
| **수업_확인표_*.xlsx (others)** | **TBD per teacher; assume 5-10 teachers active** | **CLS** | **Multiplied volume; consistent format expected (A-008)** |
| **스케쥴(쌤)** (was deferred) | 74 rows | **CLS** | `cls_recurrence` rows |
| **이윤건 이윤후 (수업 진행도)** (was deferred) | 1002 × 26 | **CLS** | Historical sessions for sibling pair |

### 7.2 Migration Phases — Updated v3.0 (마이그레이션 단계)

| Phase | Activity (활동) | Owner | Duration | Sub-Phase |
|---|---|---|---|---|
| M-0 | Register ACM as AMB Custom App; provision TPI Entity | Amoeba Platform | 0.5 day | v1.0a |
| M-1 | Master data migration (REF, SCH, R&R → AMB Units) | Dev + 김태윤 | 1 day | v1.0a |
| M-2 | CSL bulk import (140 active records) + validation | Dev + 어드바이저 | 1 day | v1.0a |
| M-3 | QNA import + cleansing (1035 → ~200 active) | Dev + 정성경 | 2 days | v1.0a |
| M-4 | Tasks (Section B) bulk import to AMB Core | Dev + 김태윤 | 0.5 day | v1.0a |
| **M-5** | **CLS sample teacher xlsx validation (2-3 teachers)** | **Dev + 김태윤** | **1 day** | **v1.0b prep** |
| **M-6** | **CLS bulk import — all teachers' 수업_확인표 + 스케쥴(쌤) + 이윤건 이윤후** | **Dev + each teacher** | **2-3 days** | **v1.0b** |
| **M-7** | **CLS settlement reconciliation — first-month parallel** | **Dev + 배예리** | **1 month parallel** | **v1.0b** |
| **M-8** | **OAuth onboarding (teachers grant GCal scope)** | **김태윤 + each teacher** | **1 week ramp** | **v1.1** |
| **M-9** | **Bodaschool room provisioning (per-class for new opt-in classes)** | **Dev + 새하컴즈 + each teacher** | **As needed** | **v1.1** |
| M-10 | Parallel operation (xlsx + ACM) | All | 1 month | All sub-phases |
| M-11 | Cut-over — xlsx becomes read-only archive | All | — | All sub-phases |

---

## 8. Success Metrics — Updated v3.0 (성공 지표)

| ID | Metric (지표) | Target (목표) | Measurement (측정) |
|---|---|---|---|
| KPI-001 | Adoption — % of new counseling intake entered in ACM vs xlsx | 100% within 1 month of v1.0a go-live | CSL records / xlsx new rows |
| KPI-002 | Pipeline visibility — % of CSL records with stage tracked | 100% | Auto-computed |
| KPI-003 | Daily aggregation effort | 0 minutes manual | User survey |
| KPI-004 | Conversion rate visibility — INTAKE → CLASS_STARTED rate visible | Available within 5 clicks | UAT |
| KPI-005 | School admission deadline miss rate | 0 missed deadlines per month | Audit log |
| KPI-006 | Sister academy onboarding time (v1.1+) | ≤ 2 days per Entity | Onboarding playbook execution |
| **KPI-007** | **CLS adoption — % of class sessions recorded in CLS vs xlsx** | **100% within 1 month of v1.0b go-live** | **CLS sessions / xlsx 회차 entries** |
| **KPI-008** | **Settlement compute time per teacher per month** | **30 min → 0 min (auto-compute)** | **Time logged by team-lead** |
| **KPI-009** | **Feedback SLA compliance — % of feedbacks submitted within 24h** | **≥ 90%** | **Daily batch flag** |
| **KPI-010** | **Cancellation/makeup audit trail completeness** | **100% of cancellations have approver + reason** | **Per-record audit** |
| **KPI-011** | **Bodaschool integration uptime (v1.1)** | **≥ 99% of scheduled sessions have valid video link 1h before class** | **Daily batch check** |
| **KPI-012** | **GCal push success rate (v1.1)** | **≥ 95% on first attempt; 100% within 3 retries** | **`ses_gcal_push_status` distribution** |

---

## 9. Risks and Mitigations — Updated v3.0 (리스크 및 대응)

| ID | Risk (리스크) | Probability | Impact | Mitigation (대응) |
|---|---|---|---|---|
| R-001 | Resistance to leaving spreadsheet workflow | High | High | 1-month parallel operation per sub-phase; xlsx export per module; per-role training |
| R-002 | Phone data quality | Medium | Low | `inq_phone_status` ENUM; backfill during M-2 |
| R-003 | Q&A migration data noise | High | Medium | Cleansing in M-3; reject rows missing 질문 or 응답 |
| R-004 | AMB Custom App registration delay | Medium | High | Engage Amoeba Platform team early; M-0 buffer |
| R-005 | Score benchmark drift (yearly admission policy changes) | High | Low | Per-update versioning per Q-003 |
| R-006 | Schema gap — implicit conventions in xlsx | High | Medium | Validators in M-2; documented per ACM-REQ-CSL-001 §3.2 |
| **R-007** | **CLS per-teacher xlsx format variance (Q-CLS-007)** | **Medium** | **High** | **Sample 2-3 teachers in M-5 before designing M-6 importer** |
| **R-008** | **Bodaschool API spec arrives late or has gaps** | **Medium** | **High** | **v1.1 split from v1.0b ensures CLS internal works regardless; deep-link fallback (I-2)** |
| **R-009** | **Teacher resistance to Bodaschool migration** | **High** | **Medium** | **Per-class teacher choice (DEC-1) — no forced migration; GMeet remains valid** |
| **R-010** | **OAuth scope changes by Google break GCal push** | **Low** | **High** | **Documented runbook; alert + re-grant flow** |
| **R-011** | **Settlement disputes due to migration data** | **Medium** | **High** | **First-month parallel reconciliation (M-7); team-lead review** |
| **R-012** | **Google Calendar event clutter — too many events for active teacher** | **Medium** | **Low** | **Per-teacher GCal calendar dedicated to ACM (separate calendar object) — recommendation** |

---

## 10. Document Traceability — Updated v3.0 (문서 추적성)

```
TPI-ADR-001 (Architecture Decision Record + Open Questions Resolution)
TPI-ADR-001-A1 (CLS Module Decisions Addendum)
ACM-REQ-001 v3.0 (this doc — top-level requirements)
  ├─ ACM-REQ-CSL-001 v2.1 (Counseling — upstream of CLS)
  ├─ ACM-REQ-DSH-001 (Dashboard — TBA)
  ├─ ACM-REQ-SCH-001 v1.0 (School Admission)
  ├─ ACM-REQ-REF-001 (Reference — TBA)
  ├─ ACM-REQ-QNA-001 (Q&A — TBA)
  └─ ACM-REQ-CLS-001 v1.0 (Class Management — NEW v3.0)
       │
       ├─ ACM-FN-* (Functional Specification per module)
       ├─ ACM-UI-* (UI Specification per page)
       ├─ ACM-SEQ-* (Sequence Diagrams)
       ├─ ACM-ERD-001 (ERD covering amb_acm_* — TBA Stage 2)
       └─ ACM-WBS-001 (WBS — mapped to AMB Issues with source:acm label)

ACM-CHG-001 (Change Impact Assessment — historical record of CLS addition)
```

---

## 11. Open Questions — Updated v3.0 (확인 필요 사항)

> All previously-listed Open Questions resolved or assigned in `TPI-ADR-001` and `TPI-ADR-001-A1`. Refer to those documents for individual resolutions.
> 종전 미결사항은 `TPI-ADR-001`과 `TPI-ADR-001-A1`에서 모두 해결 또는 담당자 할당 완료.

| Status (상태) | Count | Resolution Document |
|---|---|---|
| ✅ RESOLVED | 14 (Q-002, 003, 004, 006 + Q-CSL-001~010) | TPI-ADR-001 §3 |
| ❌ NULLIFIED | 1 (Q-001 — TSK module removed) | TPI-ADR-001 §3.2 |
| 🔄 DEFERRED | 2 (Q-005 parent portal, Q-ACM-004) | TPI-ADR-001 §3.2 / §3.4 |
| ⏳ PENDING | 4 (Q-ACM-001, 002, 003, 006) | Owner: Amoeba Platform team |
| **✅ RESOLVED (CLS)** | **11 (Q-CLS-001, 002, 004, 008, 009, 010, 011, 012, 013, 014 + Q-SCH-006-class-mode-related)** | **TPI-ADR-001-A1 §1, §2** |
| **🔄 DEFERRED (CLS)** | **1 (Q-CLS-003 — historical GCal feedback)** | **TPI-ADR-001-A1 §2** |
| **⏳ PENDING (CLS)** | **3 (Q-CLS-005, 006, 007)** | **Operational; not blocking design** |
| **⏳ NEW PENDING (CLS module spec)** | **6 (Q-CLS-015 ~ 020)** | **ACM-REQ-CLS-001 §12** |
| **⏳ PENDING (SCH module spec)** | **8 (Q-SCH-001 ~ 008)** | **ACM-REQ-SCH-001 §12** |

---

## 12. Approval — Updated v3.0 (승인)

| Role | Name | Status (v3.0) | Date |
|---|---|---|---|
| Project Sponsor | 최지용 (CEO) | Approved per TPI-ADR-001; pending Bodaschool contract finalization (Q-CLS-006) | 2026-04-25 / 2026-04-26 |
| Product Owner | 김태윤 팀장 | Approved per TPI-ADR-001 + TPI-ADR-001-A1 (DEC-1~6) | 2026-04-26 |
| Senior Manager | 배예리 수석팀장 | Pending settlement scope review (DEC-4) | — |
| Operations Lead | 정성경 팀장 | Pending CLS makeup/cancellation policy review | — |
| **Teachers (강사진)** — **NEW v3.0** | All teachers | Pending UAT for CLS workflow | — |
| Amoeba Platform Lead | TBA | Pending Q-ACM-001, 002, 003, 006 | — |
| **External — 새하컴즈** | TBA | API integration **AGREED**; detailed spec exchange in progress | 2026-04-26 |

---

## Appendix A: Source Sheet → Module Mapping Summary — Updated v3.0 (부록 A)

| # | Source | Rows × Cols | Module | DB Tables (예상) | Sub-Phase |
|---|---|---|---|---|---|
| 1 | INDEX | 1002 × 27 | DSH | `amb_acm_dsh_daily_kpi` (computed view) | v1.0a |
| 2 | 신규 | 302 × 25 (140 active) | **CSL** | `amb_acm_csl_inquiries`, `amb_acm_csl_map_tests`, `amb_acm_csl_trial_classes`, `amb_acm_csl_enrollments`, `amb_acm_csl_class_starts`, `amb_acm_csl_remarks`, `amb_acm_csl_cancellations`, `amb_acm_csl_stage_transitions` | v1.0a |
| 3 | 학교입학 정보 | 1000 × 8 (41 active) | **SCH** | `amb_acm_sch_schools`, `amb_acm_sch_grade_bands`, `amb_acm_sch_schedules` | v1.0a |
| 4 | 업무 | 99 × 10 | (no module — AMB direct) | AMB Core: `amb_units`, `amb_user_unit_roles`, AMB Issue tables | v1.0a |
| 5 | 수업별 가이드라인 | 26 × 7 | REF | `amb_acm_ref_class_guidelines` | v1.0a |
| 6 | 시험별 적정 점수대 | 999 × 27 | REF | `amb_acm_ref_score_benchmarks_*` | v1.0a |
| 7 | Q&A | 1035 × 27 (~200 after cleanse) | **QNA** | `amb_acm_qna_records`, `amb_acm_qna_categories` | v1.0a (정기상담) |
| 8 | **스케쥴(쌤)** (no longer deferred) | 74 × 7 | **CLS** | `amb_acm_cls_recurrence` | **v1.0b** |
| 9 | **이윤건 이윤후 (수업 진행도)** (no longer deferred) | 1002 × 26 | **CLS** | `amb_acm_cls_sessions` (historical) | **v1.0b** |
| 10 | **수업_확인표_*.xlsx** (per teacher) | 15 monthly sheets × N teachers | **CLS** | `amb_acm_cls_classes`, `amb_acm_cls_class_students`, `amb_acm_cls_sessions`, `amb_acm_cls_attendance`, `amb_acm_cls_makeups`, `amb_acm_cls_settlements` | **v1.0b** |
| 11 | **수업 진행 및 업무사항 안내.pdf** (operational rules) | n/a | **CLS** | `amb_acm_cls_feedbacks` (template fields), business rules embedded in BR-CLS-* | **v1.0b** |
| 12 | 스케쥴(테스트체험) | 33 × 7 | (still deferred) | — | v1.1+ |
| 13 | MKT index | 1002 × 34 | (separate Custom App) | — | ACM-MKT |
| 14 | MKT 스케쥴 | 61 × 20 | (separate Custom App) | — | ACM-MKT |
| 15 | 시트17 | 16 × 8 | (empty) | — | N/A |

### Appendix A.2: External Integrations — NEW v3.0

| # | Integration | Module | Sub-Phase | Reference |
|---|---|---|---|---|
| E-1 | Google Meet (deep link via GCal event conference data) | CLS | v1.1 | DEC-1 option 1 |
| E-2 | Bodaschool (Open API; agreement reached with 새하컴즈) | CLS | v1.1 | DEC-1 option 2 + Q-CLS-004 RESOLVED |
| E-3 | Google Calendar (OAuth + Calendar API one-way push) | CLS | v1.1 | DEC-2 (Option C) |
| E-4 | AMB Core Issue API (one-way for SLA breaches and system tasks) | CSL, CLS, SCH | v1.0a/b | TPI-ADR-001 |

---

**End of Document (문서 끝)**
