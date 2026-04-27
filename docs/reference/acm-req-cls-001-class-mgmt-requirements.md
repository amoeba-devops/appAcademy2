---
document_id: ACM-REQ-CLS-001
version: 1.0.0
status: Draft
created: 2026-04-26
updated: 2026-04-26
author: 김태윤 팀장
reviewers: []
parent_document: ACM-REQ-001 (Academy Management Custom App — Requirements Analysis)
adr_documents:
  - TPI-ADR-001 (Architecture Decision Record)
  - TPI-ADR-001-A1 (CLS Module Decisions Addendum)
related_documents:
  - ACM-CHG-001 (Change Impact Assessment — CLS Module)
  - ACM-REQ-CSL-001 (Counseling Module — upstream)
product_code: ACM
module_code: CLS
db_table_prefix: amb_acm_cls_
source_data:
  - 수업_확인표_김태윤.xlsx (15 monthly sheets, 2025.2 ~ 2026.4 — exemplar; 1 file per teacher)
  - 수업 진행 및 업무사항 안내.pdf (operational guide — feedback templates)
  - TPI_Master.xlsx › 스케쥴(쌤) sheet (deferred from v1.1, now in v1.0b)
  - TPI_Master.xlsx › 이윤건 이윤후 (수업 진행도) sheet (deferred from v1.2, now in v1.0b)
external_integrations:
  - Google Meet (deep link generation)
  - Bodaschool (API — agreement reached)
  - Google Calendar (one-way push per ADR DEC-2)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Initial draft for Class Management module deep-dive — applies TPI-ADR-001-A1 decisions DEC-1~6 and Q-CLS-001~014 resolutions (수업관리 모듈 심층 분석 초안 — DEC-1~6 및 Q-CLS-001~014 결정 적용)
---

# CLS — Class Management Module Requirements Analysis (수업관리 모듈 요구사항 분석서)

> Module-level deep-dive for **CLS** module of the Academy Management Custom App. Defines class scheduling, session occurrence tracking, attendance, makeup classes, video provider selection (Google Meet OR Bodaschool), one-way Google Calendar push, class feedback, and teacher settlement calculation.
> 학원관리앱(ACM) **CLS** 모듈 심화 분석서. 수업 일정, 회차 추적, 출결, 보강, 화상 제공자 선택(Google Meet OR Bodaschool), Google Calendar 단방향 push, 수업 피드백, 강사 정산 계산을 정의한다.

---

## 1. Module Overview (모듈 개요)

### 1.1 Purpose (목적)

The CLS (Class Management) module digitizes the per-teacher attendance spreadsheets (`수업_확인표_*.xlsx`) and the related schedule sheets (`스케쥴(쌤)`, `이윤건 이윤후`) currently managed in spreadsheets. It serves as the **source of truth** for:

CLS 모듈은 강사별로 분산된 수업 확인표 스프레드시트와 관련 스케줄 시트를 디지털화한다. 다음의 **단일 진실 공급원** 역할을 한다.

1. Active classes (active enrollments between teacher and student) — 진행 중인 수업
2. Recurring schedule and per-session occurrences — 반복 일정과 회차
3. Attendance, cancellation, and makeup tracking — 출결, 휴강, 보강
4. Class feedback (per AS-IS PDF templates) — 수업 피드백
5. Video session links (Google Meet OR Bodaschool, per teacher choice) — 화상 세션 링크
6. Teacher monthly settlement calculation (시간 합계, 최종 금액, 세후) — 강사 월간 정산 계산

### 1.2 Scope (범위)

| Item (항목) | Detail (상세) |
|---|---|
| Source — attendance (원천 — 출결) | `수업_확인표_*.xlsx` per teacher (exemplar: 김태윤; 15 monthly sheets verified) |
| Source — schedule (원천 — 일정) | TPI_Master.xlsx › 스케쥴(쌤) (74 rows, deferred from v1.1) |
| Source — progress (원천 — 진행도) | TPI_Master.xlsx › 이윤건 이윤후 (수업 진행도) (deferred from v1.2) |
| Source — operational rules (원천 — 운영 규칙) | 수업 진행 및 업무사항 안내.pdf |
| Primary users (주요 사용자) | Teachers (USER_LEVEL with `teacher` role; primary writer) + Advisors (write/edit cancellations and makeups) + Team leads (settlement review) |
| External integrations | Google Meet (deep link), Bodaschool (API), Google Calendar (one-way push) |
| Phasing (단계) | v1.0b: in-app CLS without external integrations / v1.1: Bodaschool API + Google Calendar push |

### 1.3 Data Volume Snapshot from Source (원천 데이터 볼륨 스냅샷)

From `수업_확인표_김태윤.xlsx` (one teacher, 15 months):

| Aspect (측면) | Value (값) |
|---|---|
| Active monthly slots | Up to 8 students / month |
| Sessions per student / month | 1-16 regular + up to 3 makeup |
| Cancellation reasons observed (휴강 사유) | 학생 사정, 학생 병가, 선생님 사정, 선생님 출장, 컨설팅 준비 대체, 학생 당일 취소, 가족여행 |
| Class modes observed (수업 모드) | 대면수업, 비대면수업, 2인 대면수업 |
| Hour granularity | 0.5h increments (1.0, 1.5, 2.0, 2.5, 3.0) |
| Per-hour rate range | 30,000 — 55,000 KRW (varies by teacher-student pair) |
| Group class examples | "정윤아, 정윤지" (siblings), "병찬, 소율", "이윤건 이윤후" |
| Teacher monthly revenue | 60,000 — 1,567,500 KRW (2025.11 max in sample) |
| Withholding rate (세후) | 3.3% (income tax + local tax) |

### 1.4 Key Operational Rules from AS-IS PDF (AS-IS PDF의 핵심 운영 규칙)

| # | Rule from PDF (PDF 규칙) | CLS Implementation Implication |
|---|---|---|
| 1 | 모든 수업은 Google Meet 통해 진행 (AS-IS) | TO-BE: Google Meet OR Bodaschool per DEC-1 |
| 2 | 수업 시간 1시간 전 학생 메일로 수업 링크 발송 | CLS sends notification 1h before via AMB notification + email |
| 3 | 수업 진행 기간 동안 동일한 링크 사용 | Persistent link per `cls_classes` row (not per-session) |
| 4 | 피드백은 캘린더 일정 하단 회색박스란에 작성 (AS-IS) | TO-BE: feedback in `amb_acm_cls_feedbacks`; pushed to GCal description (DEC-2 push) |
| 5 | 모든 피드백은 수업 당일 작성 완료 원칙 | SLA: feedback `fbk_written_at` ≤ `ses_held_at + 24h`; alert if missed |
| 6 | 결강/보강 조율은 어드바이저 통해 진행 | Cancellation requires advisor approval workflow |
| 7 | 학부모/학생 응대는 어드바이저 통해 (개인 연락처 공유 금지) | CLS does NOT expose student contact info to teachers |
| 8 | 매 수업 종료 후 수업 확인표 기입 | CLS attendance entry replaces this manual step |
| 9 | 수업 자료/교재는 담당 선생님께 사전 요청 | (Out of CLS scope; future material module) |
| 10 | 데모 수업은 별도 피드백 양식 (약점 및 발전 방향, 학업 플랜 제안) | `cls_is_demo` flag triggers extended feedback template |

### 1.5 Feedback Templates from AS-IS PDF (AS-IS PDF의 피드백 양식)

#### Standard Class Feedback (정규 수업)
```
수업 일시: {date} ({weekday})
학생명: {student_name}
{class_subject}

[수업진도]
{progress_text}

[수업피드백]
{feedback_text}

[숙제]
{homework_text}
```

#### Demo Class Feedback (데모 수업) — additional fields

```
수업 일시: {date}
학생명: {student_name}

[수업 진도]
{diagnostic_text — e.g. "Language Arts 진단 평가 - MAP Language Usage Advanced 총 14개 문항풀이"}

[수업 피드백]
{detailed_observation}

[약점 및 발전 방향]
{weakness_and_development_plan}

[학업 플랜 제안]
{academic_plan_proposal}
```

These templates are first-class fields in `amb_acm_cls_feedbacks` (see §3.4).

---

## 2. Domain Model (도메인 모델)

### 2.1 Entity Relationship Overview (엔티티 관계 개요)

```
amb_acm_cls_classes (수업)
  │
  ├── 1:N → amb_acm_cls_class_students (수업 학생 매핑) ──→ amb_users (학생)
  │                                                            (or future Student master)
  │   - cst_hourly_rate (학생별 단가, DEC-6)
  │   - cst_capacity_role (PRIMARY | GROUP_PEER)
  │
  ├── 1:1 → amb_users (강사) via cls_teacher_user_id
  │
  ├── 1:N → amb_acm_cls_sessions (개별 회차)
  │           │
  │           ├── 1:N → amb_acm_cls_attendance (출결, 학생당 1행)
  │           ├── 0:1 → amb_acm_cls_makeups (보강 회차이면)
  │           ├── 1:N → amb_acm_cls_feedbacks (피드백)
  │           └── 0:1 → amb_acm_cls_video_links (실제 사용된 화상 링크)
  │
  ├── 1:1 → amb_acm_cls_video_config (수업 단위 화상 설정)
  │           - vcf_provider (GOOGLE_MEET | BODASCHOOL)
  │           - vcf_persistent_link (재사용 가능한 링크)
  │
  └── 1:N → amb_acm_cls_recurrence (반복 패턴, 1주일 단위 요일/시간)

amb_acm_cls_settlements (정산, 월×강사 단위)
  ├── stl_teacher_user_id, stl_year_month
  ├── computed from amb_acm_cls_attendance
  └── stl_hours_total, stl_amount_gross, stl_amount_after_tax
```

### 2.2 Core Entity — Class (`amb_acm_cls_classes`)

A "class" is a long-running enrollment between one teacher and one or more students for a specific subject. It generates many sessions over its lifetime.

수업(Class)은 한 강사와 한 명 이상의 학생 사이의, 특정 과목에 대한 장기 등록이다. 수명 동안 다수의 회차를 생성한다.

```
amb_acm_cls_classes
  ├── identity (식별자)
  │   ├── cls_id            : UUID PK
  │   ├── ent_id            : UUID FK → amb_entities
  │   └── cls_code          : VARCHAR(50) UK per ent (e.g. "CLS-2026-001")
  │
  ├── linkage (연계)
  │   ├── cls_inq_id        : UUID FK → amb_acm_csl_inquiries (origin counseling — nullable for direct enrollment)
  │   └── cls_started_from  : ENUM (CSL_PIPELINE | DIRECT_ENROLLMENT | MIGRATION)
  │
  ├── subject (과목)
  │   ├── cls_subject_type  : ENUM (MAP_TEST | SSAT | ISEE | WRITING | LANGUAGE_ARTS | MATH | INTL_PREP | DEMO | OTHER)
  │   ├── cls_subject_label : VARCHAR(200) (free-text — supplement)
  │   └── cls_ref_guideline_id : UUID FK → amb_acm_ref_class_guidelines (per REF module)
  │
  ├── teacher (강사)
  │   └── cls_teacher_user_id : UUID FK → amb_users (USER_LEVEL with `teacher` role)
  │
  ├── flags (플래그)
  │   ├── cls_is_demo       : BOOLEAN (DEC: extended feedback template — Q-CLS-014)
  │   ├── cls_is_group      : BOOLEAN (computed: TRUE if N students > 1, DEC-5)
  │   └── cls_is_in_person_default : BOOLEAN (default mode at session creation)
  │
  ├── status & lifecycle (상태/생애주기)
  │   ├── cls_status        : ENUM (PROPOSED | ACTIVE | PAUSED | COMPLETED | CANCELLED)
  │   ├── cls_started_at    : DATE (first session date)
  │   ├── cls_ended_at      : DATE (nullable; planned end)
  │   └── cls_completed_at  : DATE (nullable; actually completed)
  │
  ├── audit
  │   ├── cls_created_at, cls_updated_at, cls_deleted_at
  │   └── cls_visibility    : ENUM (ENTITY | CELL | PRIVATE) per Amoeba §12 (default ENTITY)
```

### 2.3 Class-Student Mapping (`amb_acm_cls_class_students`)

DEC-5: one schedule × N students. DEC-6: per-pair hourly rate.

```
amb_acm_cls_class_students
  ├── cst_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── cls_id              : UUID FK
  ├── cst_student_user_id : UUID FK → amb_users (or future Student master)
  ├── cst_hourly_rate     : DECIMAL(10,0) — per-pair rate (DEC-6)
  ├── cst_capacity_role   : ENUM (PRIMARY | GROUP_PEER) — distinguishes primary student in group
  ├── cst_enrolled_at     : DATE
  ├── cst_left_at         : DATE (nullable; if student leaves group mid-class)
  └── cst_inq_id          : UUID FK → amb_acm_csl_inquiries (the CSL record that brought this student)
```

### 2.4 Recurrence Pattern (`amb_acm_cls_recurrence`)

Defines weekly recurrence pattern for auto-generation of sessions.

```
amb_acm_cls_recurrence
  ├── rec_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── cls_id              : UUID FK
  ├── rec_day_of_week     : ENUM (MON | TUE | WED | THU | FRI | SAT | SUN)
  ├── rec_start_time      : TIME (e.g. 16:30:00)
  ├── rec_duration_min    : INT (e.g. 90 = 1.5h)
  ├── rec_default_mode    : ENUM (IN_PERSON | ONLINE | TWO_PERSON_IN_PERSON)
  ├── rec_effective_from  : DATE
  ├── rec_effective_to    : DATE (nullable)
  └── rec_exceptions      : JSONB (specific dates to skip, e.g. holidays — Q-CLS-012)
```

> Multiple recurrence rows per class allowed (e.g. Mon + Wed). Sessions auto-generated via daily batch with 30-day look-ahead.
> 한 수업에 다수 반복 행 허용 (예: 월·수). 일별 배치로 30일치 회차 자동 생성.

### 2.5 Session Occurrence (`amb_acm_cls_sessions`)

Each individual class meeting. Source: per-row of `수업_확인표_*.xlsx` 1회차 ~ 16회차.

```
amb_acm_cls_sessions
  ├── identity
  │   ├── ses_id            : UUID PK
  │   ├── ent_id            : UUID FK
  │   ├── cls_id            : UUID FK
  │   └── ses_seq_no        : INT (1, 2, 3, ... per cls_id)
  │
  ├── timing
  │   ├── ses_scheduled_at  : TIMESTAMP (scheduled start)
  │   ├── ses_duration_min  : INT (default from recurrence; overridable)
  │   ├── ses_held_at       : TIMESTAMP (nullable; actual start when status=HELD)
  │   └── ses_actual_minutes: INT (nullable; actual duration; default = scheduled)
  │
  ├── status
  │   └── ses_status        : ENUM (SCHEDULED | HELD | CANCELLED | RESCHEDULED | NO_SHOW | MAKEUP_REPLACEMENT)
  │
  ├── mode (Q-CLS-010)
  │   └── ses_mode          : ENUM (IN_PERSON | ONLINE | TWO_PERSON_IN_PERSON | HYBRID)
  │
  ├── cancellation (휴강) — non-null when status=CANCELLED or NO_SHOW
  │   ├── ses_cancel_reason : ENUM (STUDENT_ABSENCE | STUDENT_ILLNESS | TEACHER_ABSENCE | TEACHER_BUSINESS_TRIP | TEACHER_CONSULTING_PREP | STUDENT_DAY_OF_CANCEL | FAMILY_TRAVEL | HOLIDAY | OTHER)
  │   ├── ses_cancel_note   : TEXT (required when reason = OTHER)
  │   ├── ses_cancelled_by  : UUID FK → amb_users
  │   ├── ses_cancelled_at  : TIMESTAMP
  │   └── ses_cancel_disposition : ENUM (MAKEUP_PLANNED | CARRYOVER_TO_NEXT_MONTH | NO_MAKEUP)
  │
  ├── flags
  │   ├── ses_is_makeup     : BOOLEAN (TRUE if this session itself is a makeup)
  │   └── ses_replaces_ses_id : UUID FK (the cancelled session this makeup replaces; nullable)
  │
  ├── video link (resolved at session level)
  │   ├── ses_video_provider : ENUM (GOOGLE_MEET | BODASCHOOL | NONE) — defaults from cls_video_config
  │   ├── ses_video_url     : VARCHAR(500) (nullable until generated)
  │   └── ses_video_link_sent_at : TIMESTAMP (nullable; 1h-before notification)
  │
  ├── google calendar (DEC-2 — one-way push)
  │   ├── ses_gcal_event_id : VARCHAR(200) (nullable; populated after push)
  │   ├── ses_gcal_pushed_at: TIMESTAMP
  │   └── ses_gcal_push_status : ENUM (NOT_REQUESTED | PUSHED | FAILED | OUTDATED)
  │
  └── audit
      ├── ses_created_at, ses_updated_at, ses_deleted_at
      └── ses_modification_count : INT (tracks reschedule frequency)
```

### 2.6 Attendance per Student (`amb_acm_cls_attendance`)

Critical for group classes — one row per session per student.

```
amb_acm_cls_attendance
  ├── att_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── ses_id              : UUID FK
  ├── cst_id              : UUID FK → amb_acm_cls_class_students
  ├── att_status          : ENUM (PRESENT | ABSENT_EXCUSED | ABSENT_UNEXCUSED | LATE | LEFT_EARLY)
  ├── att_billable_hours  : DECIMAL(3,1) (hours billed regardless of physical presence; matches "시간" column in source)
  ├── att_recorded_by     : UUID FK → amb_users (teacher entering attendance)
  ├── att_recorded_at     : TIMESTAMP
  └── att_remark          : TEXT (e.g. 비고 column content from source)
```

> Note: `att_billable_hours` is per-student. For group class, two students may have different billable hours if one left early. Source data shows `시간` row per session — for groups, this implicitly represents per-student hours (mostly identical but not always).
> 그룹 수업의 두 학생이 다른 청구 시간을 가질 수 있도록 학생별 컬럼 분리. 원천 데이터에서 시간 행은 회차당 한 줄이지만, 본 모델은 학생별로 보존하여 조퇴 등을 정확히 반영한다.

### 2.7 Makeup Class (`amb_acm_cls_makeups`)

Separate table to track makeup metadata (Q-CLS-011: substitute teacher allowed with approval).

```
amb_acm_cls_makeups
  ├── mkp_id                  : UUID PK
  ├── ent_id                  : UUID FK
  ├── mkp_original_ses_id     : UUID FK (the cancelled session being made up)
  ├── mkp_makeup_ses_id       : UUID FK (the new session that serves as makeup)
  ├── mkp_substitute_teacher_id   : UUID FK → amb_users (nullable; if substitute used)
  ├── mkp_substitution_approver_id: UUID FK → amb_users (USER_LEVEL+ team-lead; required if substitute used)
  ├── mkp_proposed_at         : TIMESTAMP
  ├── mkp_proposed_by         : UUID FK → amb_users (advisor or teacher)
  ├── mkp_status              : ENUM (PROPOSED | APPROVED | COMPLETED | CARRIED_OVER | REJECTED)
  ├── mkp_advisor_id          : UUID FK → amb_users (advisor coordinating, per AS-IS PDF rule 6)
  └── mkp_remark              : TEXT
```

### 2.8 Class Feedback (`amb_acm_cls_feedbacks`)

Stores both standard and demo class feedback per AS-IS PDF templates (§1.5).

```
amb_acm_cls_feedbacks
  ├── identity
  │   ├── fbk_id              : UUID PK
  │   ├── ent_id              : UUID FK
  │   ├── ses_id              : UUID FK
  │   └── fbk_student_user_id : UUID FK (per-student in group class)
  │
  ├── content (per template — §1.5)
  │   ├── fbk_progress        : TEXT  ([수업진도])
  │   ├── fbk_feedback        : TEXT  ([수업피드백])
  │   ├── fbk_homework        : TEXT  ([숙제] — null when cls_is_demo=TRUE)
  │   ├── fbk_weakness_dev    : TEXT  ([약점 및 발전 방향] — only when cls_is_demo=TRUE)
  │   └── fbk_academic_plan   : TEXT  ([학업 플랜 제안] — only when cls_is_demo=TRUE)
  │
  ├── status (SLA tracking — AS-IS PDF rule 5)
  │   ├── fbk_written_at      : TIMESTAMP (nullable)
  │   ├── fbk_written_by      : UUID FK → amb_users
  │   ├── fbk_status          : ENUM (DRAFT | SUBMITTED | DELIVERED_TO_PARENT)
  │   ├── fbk_sla_breached    : BOOLEAN (TRUE if not written within 24h of session)
  │   └── fbk_delivered_to_parent_at : TIMESTAMP (when advisor forwards to parent)
  │
  └── audit
      ├── fbk_created_at, fbk_updated_at, fbk_deleted_at
      └── fbk_gcal_synced_at  : TIMESTAMP (nullable; when pushed to GCal description per DEC-2)
```

### 2.9 Video Configuration (`amb_acm_cls_video_config`)

Per-class default video provider; resolved per-session if needed.

```
amb_acm_cls_video_config
  ├── vcf_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── cls_id              : UUID FK UK (one config per class)
  ├── vcf_provider        : ENUM (GOOGLE_MEET | BODASCHOOL) — DEC-1
  ├── vcf_persistent_link : VARCHAR(500) (nullable; reusable URL for whole class lifetime, per AS-IS PDF rule 3)
  ├── vcf_bodaschool_room_id : VARCHAR(100) (nullable; populated from Bodaschool API)
  ├── vcf_gmeet_event_id    : VARCHAR(200) (nullable; if generated from a recurring GCal event)
  └── vcf_changed_at      : TIMESTAMP (last provider change)
```

### 2.10 Settlement (`amb_acm_cls_settlements`)

Monthly per-teacher settlement, computed from attendance (DEC-4: calculation only).

```
amb_acm_cls_settlements
  ├── stl_id              : UUID PK
  ├── ent_id              : UUID FK
  ├── stl_teacher_user_id : UUID FK
  ├── stl_year_month      : VARCHAR(7) (YYYY-MM)
  ├── computed values
  │   ├── stl_hours_total       : DECIMAL(6,1) (sum of att_billable_hours for HELD sessions)
  │   ├── stl_amount_gross      : DECIMAL(12,0) (sum of att_billable_hours × cst_hourly_rate)
  │   ├── stl_withholding_rate  : DECIMAL(5,4) (default 0.0330)
  │   ├── stl_amount_withheld   : DECIMAL(12,0) (computed)
  │   └── stl_amount_after_tax  : DECIMAL(12,0) (computed: gross × (1 - withholding_rate))
  ├── stl_status          : ENUM (DRAFT | CONFIRMED | EXPORTED_TO_PAYROLL | PAID)
  ├── stl_confirmed_by    : UUID FK → amb_users (USER_LEVEL+ — senior manager review per BR-CSL-012 pattern)
  ├── stl_confirmed_at    : TIMESTAMP
  └── stl_payroll_export_id : UUID (nullable; reference to AMB Payroll export when DEC-4 v1.1 integration arrives)
```

---

## 3. Field Specifications (필드 명세)

### 3.1 Class (`amb_acm_cls_classes`) — 16 fields

| F# | Field (KR) | DB Column | Type | Required | Source / Derivation |
|---|---|---|---|---|---|
| C-01 | 수업 코드 | `cls_code` | VARCHAR(50) UK | MUST | Auto-generated `CLS-{YYYY}-{seq}` per ent |
| C-02 | 출처 (오리진) | `cls_started_from` | ENUM | MUST | `CSL_PIPELINE` (linked from CSL F-24) / `DIRECT_ENROLLMENT` / `MIGRATION` |
| C-03 | 상담 연결 | `cls_inq_id` | UUID FK | SHOULD | From CSL trigger; nullable for direct enrollment |
| C-04 | 과목 유형 | `cls_subject_type` | ENUM | MUST | 9-value ENUM (see §2.2) |
| C-05 | 과목 라벨 | `cls_subject_label` | VARCHAR(200) | OPTIONAL | Free-text supplement |
| C-06 | REF 가이드라인 | `cls_ref_guideline_id` | UUID FK | OPTIONAL | Cross-module link to REF |
| C-07 | 강사 | `cls_teacher_user_id` | UUID FK | MUST | Teacher with `teacher` role |
| C-08 | 데모 수업 여부 | `cls_is_demo` | BOOLEAN | MUST | Default FALSE; drives feedback template (Q-CLS-014) |
| C-09 | 그룹 수업 여부 | `cls_is_group` | BOOLEAN | (computed) | TRUE if N students > 1 |
| C-10 | 기본 대면 여부 | `cls_is_in_person_default` | BOOLEAN | MUST | Default for new sessions |
| C-11 | 상태 | `cls_status` | ENUM | MUST | `PROPOSED` / `ACTIVE` / `PAUSED` / `COMPLETED` / `CANCELLED` |
| C-12 | 시작일 | `cls_started_at` | DATE | MUST | First session date |
| C-13 | 종료 예정일 | `cls_ended_at` | DATE | OPTIONAL | Planned end |
| C-14 | 실제 완료일 | `cls_completed_at` | DATE | OPTIONAL | Actually completed |
| C-15 | 가시성 | `cls_visibility` | ENUM | MUST | Default `ENTITY` |
| C-16 | 비고 | `cls_remark` | TEXT | OPTIONAL | Free-text |

### 3.2 Class-Student Mapping (`amb_acm_cls_class_students`) — 7 fields

| F# | Field (KR) | DB Column | Type | Required | Source |
|---|---|---|---|---|---|
| CST-01 | 학생 | `cst_student_user_id` | UUID FK | MUST | |
| CST-02 | 시간당 단가 (DEC-6) | `cst_hourly_rate` | DECIMAL(10,0) | MUST | Per-pair rate |
| CST-03 | 역할 | `cst_capacity_role` | ENUM | MUST | `PRIMARY` (group lead) / `GROUP_PEER` |
| CST-04 | 등록일 | `cst_enrolled_at` | DATE | MUST | |
| CST-05 | 이탈일 | `cst_left_at` | DATE | OPTIONAL | |
| CST-06 | 출처 상담 | `cst_inq_id` | UUID FK | OPTIONAL | CSL inquiry |

### 3.3 Session (`amb_acm_cls_sessions`) — 18 fields (see §2.5 schema)

Key fields with validation:

| Field | Validation |
|---|---|
| `ses_scheduled_at` | Must be ≥ `cls_started_at` AND ≤ `cls_ended_at` (or future indefinitely if `cls_ended_at` NULL) |
| `ses_duration_min` | 30 ≤ x ≤ 480; in 30-min increments per source data granularity |
| `ses_status` transitions | `SCHEDULED → HELD` (forward); `SCHEDULED → CANCELLED` (cancel); `SCHEDULED → RESCHEDULED` (date change). Cannot revert HELD → SCHEDULED. |
| `ses_mode` | Defaults from `cls_recurrence.rec_default_mode`; overridable per session |
| `ses_video_provider` | Defaults from `cls_video_config.vcf_provider`; overridable per session for ad-hoc fallback |
| `ses_cancel_reason` required when `ses_status` ∈ (`CANCELLED`, `NO_SHOW`) | |
| `ses_replaces_ses_id` required when `ses_is_makeup=TRUE` | |

### 3.4 Feedback (`amb_acm_cls_feedbacks`) — content fields per template (§1.5)

| Template | Fields Required |
|---|---|
| Standard (`cls_is_demo=FALSE`) | `fbk_progress`, `fbk_feedback`, `fbk_homework` |
| Demo (`cls_is_demo=TRUE`) | `fbk_progress`, `fbk_feedback`, `fbk_weakness_dev`, `fbk_academic_plan` (no homework) |

SLA: feedback `fbk_status='SUBMITTED'` within 24 hours of `ses_held_at` (per AS-IS PDF rule 5).

---

## 4. Functional Requirements (기능 요구사항)

### 4.1 Class CRUD (수업 관리)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-C01 | Create class — single-student or group | P0 | Required: teacher, student(s), subject, started_at, recurrence pattern. Auto-generates `cls_code` |
| FR-CLS-C02 | List classes — filter by teacher / student / status / subject / month | P0 | URL-shareable; default current month |
| FR-CLS-C03 | Class detail view — students, recurrence, sessions list, video config, feedbacks | P0 | Tab structure |
| FR-CLS-C04 | Edit class — change recurrence prospectively (existing sessions preserved) | P0 | Edit creates new `cls_recurrence` row with `rec_effective_from` = today |
| FR-CLS-C05 | Pause / resume class | P1 | `cls_status` transition; future sessions auto-cancelled |
| FR-CLS-C06 | Complete class | P0 | `cls_completed_at` set; final settlement triggered |
| FR-CLS-C07 | Add student to existing class (mid-stream) | P1 | New `cst_*` row with `cst_enrolled_at = today` |
| FR-CLS-C08 | Remove student (mid-stream) | P1 | `cst_left_at = today`; future sessions exclude student |
| FR-CLS-C09 | Auto-link from CSL — when CSL `F-24 cls_started=YES`, prompt CLS class creation | P0 | Cross-module event handler (BR-CLS-001) |
| FR-CLS-C10 | Demo class flag — controls feedback template throughout lifecycle | P0 | `cls_is_demo` immutable after first session |

### 4.2 Schedule and Session (스케줄 및 회차)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-S01 | Auto-generate sessions from recurrence — 30-day look-ahead, daily batch | P0 | Idempotent; respects `rec_exceptions` |
| FR-CLS-S02 | Calendar view — month / week / day grids per teacher / per student | P0 | Inspired by Google Calendar UI; navigates by month-arrow |
| FR-CLS-S03 | Drag-and-drop reschedule on calendar (week view) | P1 | Optimistic UI; server validates conflicts |
| FR-CLS-S04 | Single-session reschedule modal — change date/time without affecting recurrence | P0 | Creates new `ses_status=RESCHEDULED` log; `ses_modification_count` increments |
| FR-CLS-S05 | Conflict detection — teacher / student double-booking | P0 | Block save with explicit error; show conflicting class link |
| FR-CLS-S06 | Holiday / Sunday warning (Q-CLS-012) | P0 | Soft warning + advisor confirm checkbox (matches BR-CSL-011 pattern) |
| FR-CLS-S07 | Session list per class with attendance status colored | P0 | Green = HELD, red = CANCELLED, gray = SCHEDULED |
| FR-CLS-S08 | Filter sessions by date range, status, mode | P0 | |
| FR-CLS-S09 | Export sessions as xlsx matching `수업_확인표_*.xlsx` format | P1 | Backward compatibility for parallel operation |
| FR-CLS-S10 | "1-hour-before" link delivery (AS-IS PDF rule 2) | P0 | Daily batch + per-session timer; sends via AMB notification |

### 4.3 Attendance (출결)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-A01 | Teacher records attendance per session per student after class | P0 | Form: status + billable_hours + remark |
| FR-CLS-A02 | Bulk attendance entry — multiple sessions in one screen for teacher's monthly view | P1 | Productivity: replaces 수업확인표 grid input |
| FR-CLS-A03 | Attendance status taxonomy: PRESENT / ABSENT_EXCUSED / ABSENT_UNEXCUSED / LATE / LEFT_EARLY | P0 | |
| FR-CLS-A04 | Cancellation reason taxonomy (9 ENUM values per §2.5) | P0 | OTHER requires note |
| FR-CLS-A05 | Cancellation requires advisor approval (AS-IS PDF rule 6) | P0 | Workflow: teacher proposes → advisor approves → status changes |
| FR-CLS-A06 | "Day-of cancel" handling — STUDENT_DAY_OF_CANCEL captured separately | P0 | Often billable per business rule |
| FR-CLS-A07 | Carryover (이월) marking — separate from makeup | P0 | `ses_cancel_disposition = CARRYOVER_TO_NEXT_MONTH` |
| FR-CLS-A08 | Per-student attendance in group class | P0 | Two students may differ (e.g. one left early) |
| FR-CLS-A09 | Attendance edit history — append-only audit per change | P0 | Inherited from AMB audit |
| FR-CLS-A10 | Daily attendance reminder — teachers with HELD sessions but no attendance entry | P0 | Notification at end of day |

### 4.4 Makeup (보강)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-M01 | Propose makeup — advisor selects cancelled session + new datetime | P0 | Creates `cls_makeups` with `PROPOSED` |
| FR-CLS-M02 | Approve makeup — team-lead approval | P0 | Status `APPROVED`; new session auto-created with `is_makeup=TRUE` |
| FR-CLS-M03 | Same-teacher default; substitute requires extra approval (Q-CLS-011) | P0 | `mkp_substitute_teacher_id` and `mkp_substitution_approver_id` both required |
| FR-CLS-M04 | Up to 3 makeups per student per month — matches source 보강 1~3회차 | P0 | Soft limit with override |
| FR-CLS-M05 | Makeup completion auto-marks original session disposition | P0 | `ses_cancel_disposition` updates |
| FR-CLS-M06 | Carryover to next month — alternative to makeup | P0 | Visible in next month's settlement adjustment |
| FR-CLS-M07 | Makeup search/list view per teacher per month | P1 | Reconciliation aid |

### 4.5 Video Provider Choice — DEC-1 (화상 제공자 선택)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-V01 | At class registration, teacher selects video provider — Google Meet OR Bodaschool | P0 (v1.0b for ENUM; v1.1 for actual integration) | Field: `vcf_provider` |
| FR-CLS-V02 | Default suggestion — teacher's preferred provider (saved in user preferences) | P1 | Reduces friction |
| FR-CLS-V03 | Persistent link generation — created once per class lifetime (AS-IS PDF rule 3) | P0 (v1.1) | Stored in `vcf_persistent_link` |
| FR-CLS-V04 | Bodaschool: API call creates room; URL stored | P0 (v1.1) | Per Bodaschool API agreement; details TBA |
| FR-CLS-V05 | Google Meet: deep link generated via Google Calendar event creation | P0 (v1.1) | Tied to GCal push (DEC-2) |
| FR-CLS-V06 | Per-session override of provider (ad-hoc fallback) | P1 (v1.1) | E.g. Bodaschool outage → temporary GMeet |
| FR-CLS-V07 | Link delivery — student email 1h before via AMB notification (AS-IS PDF rule 2) | P0 (v1.0b for shell; v1.1 for actual) | |
| FR-CLS-V08 | Provider-specific UI badges in calendar view | P1 | Quick visual identification |
| FR-CLS-V09 | Fallback alerting — if Bodaschool API unreachable at session time, alert teacher with manual link option | P0 (v1.1) | Resilience |

### 4.6 Google Calendar Push — DEC-2 (구글 캘린더 단방향 push)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-G01 | OAuth onboarding for teachers — grant Google Calendar API access | P0 (v1.1) | Per-teacher; revocable |
| FR-CLS-G02 | Auto-push session as GCal event upon scheduling | P0 (v1.1) | Within 1 minute of save; status `PUSHED` |
| FR-CLS-G03 | Re-push on session edit (date/time/duration/cancellation) | P0 (v1.1) | `ses_gcal_pushed_at` updates |
| FR-CLS-G04 | Push feedback into GCal event description (preserves AS-IS workflow) | P0 (v1.1) | Per AS-IS PDF rule 4; ACM is source of truth, GCal mirrors |
| FR-CLS-G05 | Optional student GCal push — student grants OAuth scope | P1 (v1.1) | Default OFF |
| FR-CLS-G06 | Failure handling — show warning in ACM UI; retry button | P0 (v1.1) | Status `FAILED` |
| FR-CLS-G07 | OAuth token refresh — automatic background renewal | P0 (v1.1) | |
| FR-CLS-G08 | NEVER read from GCal (one-way only per DEC-2) | P0 (v1.1) | Architectural constraint; enforced by code review |
| FR-CLS-G09 | OAuth revocation handling — graceful: class still saved; warning shown | P0 (v1.1) | |

### 4.7 Feedback (피드백)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-F01 | Feedback form per session — template differs by `cls_is_demo` | P0 | §1.5 templates as field structure |
| FR-CLS-F02 | Per-student feedback in group classes | P0 | One row per student per session |
| FR-CLS-F03 | Save-as-draft + submit | P0 | Status `DRAFT` / `SUBMITTED` |
| FR-CLS-F04 | 24-hour SLA reminder (AS-IS PDF rule 5) | P0 | Daily batch; `fbk_sla_breached` flag set; AMB Issue created with `source:acm` |
| FR-CLS-F05 | Advisor delivers feedback to parent — marks `DELIVERED_TO_PARENT` | P0 | Delegation per AS-IS PDF rule 7 (no direct teacher-parent) |
| FR-CLS-F06 | Feedback push to GCal event description (DEC-2) | P0 (v1.1) | After `SUBMITTED` status |
| FR-CLS-F07 | Search feedback by student / teacher / date range / keyword | P1 | Useful for parent reports |
| FR-CLS-F08 | Bulk export feedbacks as PDF for parent communication | P2 | |

### 4.8 Settlement (정산) — DEC-4 (계산만)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-T01 | Compute monthly per-teacher settlement | P0 | `stl_hours_total = SUM(att_billable_hours WHERE HELD)`; `stl_amount_gross = SUM(att_billable_hours × cst_hourly_rate)` |
| FR-CLS-T02 | Apply 3.3% withholding | P0 | Configurable per Entity (some teachers may be 사업자 — 0%) |
| FR-CLS-T03 | Settlement preview during month (running total) | P1 | Helps teacher track earnings |
| FR-CLS-T04 | Confirm settlement at month-end — team-lead/senior-manager approval | P0 | `stl_status = CONFIRMED`; immutable thereafter |
| FR-CLS-T05 | Settlement detail breakdown — per student × per session × hours × rate | P0 | Source of truth for any payout dispute |
| FR-CLS-T06 | Export settlement as xlsx | P0 | For payroll until DEC-4 v1.1 Payroll integration |
| FR-CLS-T07 | Withholding rate configurable per teacher | P1 | Some teachers may be on different tax basis |
| FR-CLS-T08 | Carryover (이월) impact on settlement | P0 | Carried-over sessions count in destination month, not source |

### 4.9 Migration (마이그레이션)

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| FR-CLS-MG01 | Bulk import from `수업_확인표_*.xlsx` per teacher | P0 (v1.0b) | xlsx upload; per-teacher batch |
| FR-CLS-MG02 | Parse monthly sheet structure — student row + 시간 row + 비고 row triplet | P0 | 3-row pattern detection |
| FR-CLS-MG03 | Recognize cancellation pattern — `시간 = 0.0` AND non-empty `비고` | P0 | Auto-classify as cancelled session |
| FR-CLS-MG04 | Parse cancellation reason from `비고` — best-effort match to ENUM | P0 | "학생 사정" → STUDENT_ABSENCE; etc. |
| FR-CLS-MG05 | Detect class mode from `비고` — "대면수업"/"비대면수업"/"2인 대면수업" | P0 | Default ONLINE if unspecified (matches PDF AS-IS) |
| FR-CLS-MG06 | Detect group classes — multi-name slot (e.g. "정윤아, 정윤지") | P0 | Split by comma; create N students under one class |
| FR-CLS-MG07 | Detect makeups — "보강 1회차"/"보강 2회차"/"보강 3회차" columns | P0 | Create `cls_makeups` records |
| FR-CLS-MG08 | Recover hourly rate from settlement amount (when present) | P0 | `rate = 최종 금액 / 시간 합계`; route to manual review when ambiguous |
| FR-CLS-MG09 | Idempotent — dedup by (teacher_user_id, year_month, student_name, session_date) | P0 | Re-run safe |
| FR-CLS-MG10 | Migration report — by teacher × month × class × quality | P0 | |

---

## 5. Business Rules (비즈니스 규칙)

| ID | Rule | Trigger | Action |
|---|---|---|---|
| BR-CLS-001 | CSL `cls_started=YES` triggers CLS class creation prompt | CSL F-24 set | Show "Create class" modal pre-filled with student + suggested teacher |
| BR-CLS-002 | Session 1h-before link delivery | Daily batch + per-session timer | Email + AMB notification with `ses_video_url` |
| BR-CLS-003 | Cancellation requires advisor approval | Teacher cancels session | Status remains SCHEDULED; advisor notification; advisor confirms → CANCELLED |
| BR-CLS-004 | Makeup requires team-lead approval | Advisor proposes makeup | `mkp_status=PROPOSED` → team-lead review → `APPROVED` |
| BR-CLS-005 | Substitute teacher in makeup requires team-lead approval | Substitute selected | `mkp_substitution_approver_id` required |
| BR-CLS-006 | Sunday/holiday session triggers warning (Q-CLS-012) | Save session with weekend or holiday date | Soft warning + confirm checkbox (matches BR-CSL-011) |
| BR-CLS-007 | Group class — students share session but attendance per-student | New session created | One `cls_attendance` row per student in `cst_capacity_role IN (PRIMARY, GROUP_PEER)` and `cst_left_at IS NULL` |
| BR-CLS-008 | Feedback SLA — 24h from session end | Daily batch | `fbk_sla_breached=TRUE` if no `SUBMITTED` feedback; auto-create AMB Issue with `source:acm` and assignee = teacher |
| BR-CLS-009 | Demo class enforces extended feedback template | First session of `cls_is_demo=TRUE` class | Feedback form shows `weakness_dev` and `academic_plan` fields, hides `homework` |
| BR-CLS-010 | Settlement auto-confirm at month-end if no manual review by 5th of next month | Daily batch on 5th | `stl_status=CONFIRMED` with `stl_confirmed_by=SYSTEM` and audit log |
| BR-CLS-011 | Teacher conflict — same teacher cannot have overlapping sessions | Save session | Reject with conflict detail |
| BR-CLS-012 | Student conflict — same student cannot have overlapping sessions across classes | Save session | Reject with conflict detail |
| BR-CLS-013 | GCal push retries on transient failure | Push fails | Up to 3 retries with exponential backoff; on permanent fail mark `FAILED` |
| BR-CLS-014 | Bodaschool room reuse — persistent link generated once per class | First session save where `vcf_provider=BODASCHOOL` | Bodaschool API called; link stored in `vcf_persistent_link` |
| BR-CLS-015 | Provider switch mid-class — re-generate links from new session forward | `vcf_provider` changed | Existing past sessions retain their original URL; future sessions get new |
| BR-CLS-016 | Carryover (이월) does not double-count in settlement | Cancellation with `CARRYOVER_TO_NEXT_MONTH` | Original session billable_hours = 0; replacement session in next month bills normally |
| BR-CLS-017 | "Day-of cancel" billable per Entity policy | `ses_cancel_reason=STUDENT_DAY_OF_CANCEL` | `att_billable_hours` may be non-zero per business rule (configurable) |

---

## 6. Validation Rules (검증 규칙)

### 6.1 Field-Level

| ID | Field | Rule | Error Code |
|---|---|---|---|
| VR-CLS-001 | `cls_code` | Pattern `CLS-\d{4}-\d{3,}`; UK per ent | `VAL_CLS_CODE_FORMAT` |
| VR-CLS-002 | `cls_teacher_user_id` | User MUST have `teacher` role | `VAL_NOT_TEACHER_ROLE` |
| VR-CLS-003 | `cls_started_at` | ≤ today + 365 (no far-future creation) | `VAL_CLS_START_RANGE` |
| VR-CLS-004 | `ses_scheduled_at` | Within `cls_started_at` and `cls_ended_at` | `VAL_SES_OUTSIDE_CLASS` |
| VR-CLS-005 | `ses_duration_min` | 30 ≤ x ≤ 480; multiple of 30 | `VAL_DURATION_RANGE` |
| VR-CLS-006 | `att_billable_hours` | 0.0 ≤ x ≤ ses_duration_min/60 + 0.5 (small buffer) | `VAL_HOURS_RANGE` |
| VR-CLS-007 | `cst_hourly_rate` | 0 < x ≤ 500,000 KRW (sanity bound; far above source max) | `VAL_RATE_RANGE` |
| VR-CLS-008 | `stl_withholding_rate` | 0.0 ≤ x ≤ 0.5 (50% upper bound) | `VAL_WITHHOLDING_RANGE` |
| VR-CLS-009 | `vcf_provider` | One of `GOOGLE_MEET`, `BODASCHOOL` | `VAL_VIDEO_PROVIDER` |
| VR-CLS-010 | `ses_status` transitions | Per state machine §3.3 | `VAL_SES_STATUS_TRANSITION` |

### 6.2 Cross-Field

| ID | Rule | Error Code |
|---|---|---|
| VR-CLS-X01 | `ses_cancel_reason` required when `ses_status` ∈ (CANCELLED, NO_SHOW) | `VAL_CANCEL_REASON_REQUIRED` |
| VR-CLS-X02 | `ses_cancel_note` required when `ses_cancel_reason=OTHER` | `VAL_OTHER_NOTE_REQUIRED` |
| VR-CLS-X03 | `ses_replaces_ses_id` required when `ses_is_makeup=TRUE` | `VAL_MAKEUP_LINK_REQUIRED` |
| VR-CLS-X04 | `mkp_substitution_approver_id` required when `mkp_substitute_teacher_id` non-null | `VAL_SUBSTITUTE_APPROVAL` |
| VR-CLS-X05 | Demo feedback (`cls_is_demo=TRUE`) requires `fbk_weakness_dev` and `fbk_academic_plan` | `VAL_DEMO_FEEDBACK_FIELDS` |
| VR-CLS-X06 | Standard feedback (`cls_is_demo=FALSE`) requires `fbk_homework` | `VAL_STANDARD_FEEDBACK_FIELDS` |
| VR-CLS-X07 | Settlement `CONFIRMED` immutable | `VAL_SETTLEMENT_FROZEN` |
| VR-CLS-X08 | At least one `cst_capacity_role=PRIMARY` per class | `VAL_NO_PRIMARY_STUDENT` |
| VR-CLS-X09 | Bodaschool provider requires successful API connectivity at session creation (v1.1) | `WARN_BODASCHOOL_UNREACHABLE` |
| VR-CLS-X10 | GCal push requires teacher OAuth grant | `VAL_GCAL_OAUTH_REQUIRED` |

### 6.3 Migration Quality Flags

| Flag | Trigger | Action |
|---|---|---|
| `MIGRATION_CLS_OK` | All fields parsed cleanly | None |
| `MIGRATION_CLS_RATE_AMBIGUOUS` | Hourly rate could not be unambiguously derived from settlement amount | Manual review required |
| `MIGRATION_CLS_MODE_UNKNOWN` | `비고` does not match known mode keywords | Default to ONLINE; flag for review |
| `MIGRATION_CLS_CANCEL_REASON_UNKNOWN` | `비고` text doesn't match cancellation ENUM | Set to OTHER + note |
| `MIGRATION_CLS_GROUP_AMBIGUOUS` | Multi-name slot but unclear who is PRIMARY | Set first-listed name as PRIMARY |

---

## 7. Cross-Module Integration (모듈 간 연동)

### 7.1 With CSL (Counseling Management) — Upstream

| Direction | Trigger | Effect |
|---|---|---|
| CSL → CLS | CSL F-24 `cls_started=YES` set | Cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED`. UI prompts to create CLS class. |
| CSL → CLS | CSL F-21 `enr_tuition_amount` paid | Default rate suggestion for new class (tuition / expected hours) |
| CLS → CSL | First class session held | Optional update to CSL "ongoing student" status (informational only) |
| CLS → CSL | Class `COMPLETED` or `CANCELLED` after starting | CSL record visibility — no CSL state change but timeline updated |

### 7.2 With REF (Reference Materials)

| Direction | Trigger | Effect |
|---|---|---|
| CLS ← REF | Class subject_type | Suggests `cls_ref_guideline_id` from REF guidelines |
| CLS ← REF | Setting expected progress milestones | Reference benchmarks attached to feedback context |

### 7.3 With QNA (Regular Counseling)

| Direction | Trigger | Effect |
|---|---|---|
| QNA ← CLS | Q&A categorized `SCHEDULING` and tagged with class | Cross-link from class detail to FAQ |

### 7.4 With DSH (Dashboard)

| Metric | Computation Source |
|---|---|
| Tt. Class | Active `cls_classes WHERE cls_status=ACTIVE` |
| Student | DISTINCT `cst_student_user_id WHERE cst_left_at IS NULL` |
| Teacher | DISTINCT `cls_teacher_user_id WHERE cls_status=ACTIVE` |
| Cancellation rate (결강율) | `cancelled_sessions / total_sessions` per month |
| Makeup completion rate | `mkp WHERE status=COMPLETED / mkp WHERE status=APPROVED` |
| Teacher monthly hours | from `cls_settlements` |

### 7.5 With AMB Core (One-way per ADR)

| Trigger | AMB Issue Created (label `source:acm`) |
|---|---|
| Feedback SLA breach (BR-CLS-008) | "[ACM-CLS] 피드백 미작성 — {teacher} {student} {date}" |
| Bodaschool API failure (BR-CLS-013 fallback) | "[ACM-CLS] 보다스쿨 API 응답 실패 — {class} {session_time}" |
| GCal push permanent failure | "[ACM-CLS] GCal push failed — {teacher} {date}" |
| Settlement awaiting confirmation past 5th | "[ACM-CLS] 정산 미확인 — {teacher} {month}" |

### 7.6 External Integrations

#### 7.6.1 Google Meet (DEC-1 option 1)

- Strategy: deep link generation via Google Calendar event creation (since GCal already integrated per DEC-2)
- No separate Google Meet API needed; link auto-generated when GCal event has conference data
- Persistent link tied to recurring GCal event series

#### 7.6.2 Bodaschool (DEC-1 option 2 + Q-CLS-004 AGREED)

- Strategy: Open API integration (agreement reached)
- API responsibilities (TBD pending spec exchange):
  - Create persistent room per class
  - Generate per-session join URL (or reuse persistent)
  - Receive webhook for attendance events (학생 입장/퇴장)
  - Handle recording metadata
- Adapter pattern in code — `IVideoProvider` interface implemented by `GoogleMeetProvider` and `BodaschoolProvider`

#### 7.6.3 Google Calendar (DEC-2 — one-way push)

- OAuth 2.0 — teachers grant `calendar.events` scope
- Per-teacher refresh token stored encrypted (per Amoeba §13)
- Push on save / edit / cancel; never read

### 7.7 Module Interface Contract

```typescript
export interface IAcmClsService {
  findClassById(entId: UUID, clsId: UUID): Promise<ClassDto | null>;
  findClassesByTeacher(entId: UUID, teacherId: UUID, dateRange: DateRange): Promise<ClassDto[]>;
  findClassesByStudent(entId: UUID, studentId: UUID, dateRange: DateRange): Promise<ClassDto[]>;
  findUpcomingSessions(entId: UUID, hoursAhead: number): Promise<SessionDto[]>;
  findFeedbacksByStudent(entId: UUID, studentId: UUID, limit?: number): Promise<FeedbackDto[]>;
  computeMonthlySettlement(entId: UUID, teacherId: UUID, yearMonth: string): Promise<SettlementDto>;
}

export interface AcmClsEvent {
  type: 'CLASS_CREATED' | 'CLASS_COMPLETED' | 'SESSION_HELD' | 'SESSION_CANCELLED' 
      | 'MAKEUP_PROPOSED' | 'FEEDBACK_SUBMITTED' | 'SETTLEMENT_CONFIRMED';
  entId: UUID;
  clsId: UUID;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

// Provider abstraction (DEC-1)
export interface IVideoProvider {
  readonly providerType: 'GOOGLE_MEET' | 'BODASCHOOL';
  createPersistentRoom(class: ClassDto): Promise<{ url: string; roomId: string }>;
  generateSessionUrl(session: SessionDto, room: { url: string; roomId: string }): Promise<string>;
  fetchAttendance(session: SessionDto): Promise<AttendanceEventDto[] | null>;  // null if not supported
}
```

---

## 8. UI/UX Considerations (UI/UX 고려사항)

| ID | Consideration | Rationale |
|---|---|---|
| UI-CLS-001 | Calendar view (month/week/day) inspired by Google Calendar but native | DEC-2 Option C — preserves familiar pattern; Google Calendar functionality referenced |
| UI-CLS-002 | Sessions color-coded by status: green=HELD, red=CANCELLED, gray=SCHEDULED, purple=MAKEUP, yellow=RESCHEDULED | Quick visual scan |
| UI-CLS-003 | Provider badge on each session — Google Meet G icon or Bodaschool icon | DEC-1 visibility |
| UI-CLS-004 | Group class single block with student initials list | Compact display |
| UI-CLS-005 | Demo class visually distinct (gold border) | `cls_is_demo=TRUE` |
| UI-CLS-006 | Teacher monthly view replicates `수업_확인표_*.xlsx` layout for familiarity | Adoption aid; export available |
| UI-CLS-007 | Attendance entry mobile-optimized — teacher records on phone after class | Field reality |
| UI-CLS-008 | Feedback editor uses template form with placeholders | Reduces blank-page anxiety |
| UI-CLS-009 | Settlement summary card — 시간, 금액, 세후 prominently displayed | Daily reassurance for teacher |
| UI-CLS-010 | Cancellation modal includes advisor selector (BR-CLS-003) | Workflow embodiment |
| UI-CLS-011 | Sunday/holiday warning banner — yellow callout + confirm | BR-CLS-006 / Q-CLS-012 |
| UI-CLS-012 | "1-hour-before" link delivery status visible in session card | Operational confidence |

---

## 9. Audit, Compliance & Security (감사, 컴플라이언스, 보안)

### 9.1 Audit (Inherited from AMB)

| ID | Requirement |
|---|---|
| AUD-CLS-001 | All CRUD on classes, sessions, attendance, feedback logged with actor + timestamp + before/after |
| AUD-CLS-002 | Session status transitions append-only |
| AUD-CLS-003 | Settlement confirmations logged (DEC-4 financial trail) |
| AUD-CLS-004 | Substitute teacher assignment + approver explicitly logged (Q-CLS-011) |
| AUD-CLS-005 | OAuth grant/revoke events for GCal/Bodaschool logged |

### 9.2 Compliance & PII

| ID | Requirement | Reference |
|---|---|---|
| PII-CLS-001 | Student names/contacts NEVER exposed to teachers via direct email/phone (AS-IS PDF rule 7) | Per teacher view: shows only name; advisor mediates contact |
| PII-CLS-002 | Feedback content treated as student PII; access scoped (teacher who wrote, advisor, team-lead, parent post-delivery) | |
| PII-CLS-003 | Settlement is teacher PII; visible to teacher + senior manager + payroll-authorized user | |
| PII-CLS-004 | OAuth tokens encrypted (AES-256-GCM 3-field per Amoeba §13) | |
| PII-CLS-005 | Bodaschool data residency disclosure to students/parents (KT-Cloud) | Per Bodaschool agreement; consent flow extension for v1.1 |
| PII-CLS-006 | GCal push to teacher's calendar = personal Google account; informed consent at OAuth grant | |

### 9.3 Multi-Tenant Isolation

| ID | Requirement |
|---|---|
| MT-CLS-001 | All queries scoped by `ent_id` via OwnEntityGuard |
| MT-CLS-002 | OAuth tokens scoped per (`ent_id`, `user_id`) |
| MT-CLS-003 | Bodaschool API calls include `ent_id` context; rooms created under per-Entity Bodaschool account (TBD with 새하컴즈) |
| MT-CLS-004 | Cross-Entity teacher (e.g. teaches at TPI + Santa Croce) — separate class records per Entity; settlement per Entity |

---

## 10. Non-Functional Requirements (Module-Specific)

| ID | Category | Requirement | Criteria |
|---|---|---|---|
| NFR-CLS-P01 | Performance | Calendar view month load (~200 sessions) | < 1s p95 |
| NFR-CLS-P02 | Performance | Attendance bulk entry (50 students × month) | < 2s save p95 |
| NFR-CLS-P03 | Performance | Settlement compute per teacher per month | < 3s |
| NFR-CLS-P04 | Performance | Bodaschool API call latency | < 2s p95 (depends on partner SLA) |
| NFR-CLS-P05 | Performance | GCal push latency | < 5s p95 (eventually consistent) |
| NFR-CLS-S01 | Scalability | Active classes per Entity | 500+ |
| NFR-CLS-S02 | Scalability | Sessions per month per Entity | 10,000+ |
| NFR-CLS-A01 | Availability | Module read | 99.5% (matches AMB SLA) |
| NFR-CLS-A02 | Availability | Bodaschool integration degraded mode | Class still saves; warning shown if API down |
| NFR-CLS-R01 | Reliability | GCal push retry up to 3 with backoff | Per BR-CLS-013 |

---

## 11. Risks (Module-Specific)

| ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-CLS-001 | Migration parsing of `수업_확인표_*.xlsx` fails on per-teacher format variation (Q-CLS-007) | High | High | Sample 2-3 teachers' files before migration design; manual review queue with `MIGRATION_CLS_*` flags |
| R-CLS-002 | Bodaschool API spec arrives late / has gaps | Medium | High | Parallel adapter implementation for GMeet first (v1.0b); Bodaschool integration only in v1.1 |
| R-CLS-003 | Teacher resistance to new attendance entry workflow | High | Medium | xlsx export matches source format (FR-CLS-S09); 1-month parallel operation |
| R-CLS-004 | OAuth scope changes by Google break GCal push | Low | High | Documented runbook; alert + manual re-grant flow |
| R-CLS-005 | Group class billing edge cases — student leaves early but other stays | Medium | Medium | Per-student `att_billable_hours` resolves this (§2.6) |
| R-CLS-006 | Settlement disputes due to migration data | Medium | High | Pre-migration validation against source; team-lead review for first month post-migration |
| R-CLS-007 | Bodaschool's own scheduling conflicts with ACM (Q-CLS-005) | Medium | Medium | Q-CLS-005 to be resolved with 새하컴즈; ACM-as-source-of-truth preference |
| R-CLS-008 | Student PII leakage if GCal events shared too broadly | Medium | High | Default GCal event access = teacher's calendar only; student push opt-in (FR-CLS-G05) |
| R-CLS-009 | Recurrence pattern doesn't capture irregular schedules in source | Medium | Medium | Allow ad-hoc session creation outside recurrence; manual entry path |
| R-CLS-010 | Withholding rate variation per teacher (사업자 vs 개인) not captured initially | Low | Medium | `stl_withholding_rate` per-teacher configurable (FR-CLS-T07) |

---

## 12. Open Questions (확인 필요 사항)

> Per `TPI-ADR-001-A1`, Q-CLS-001 ~ Q-CLS-014 are mostly RESOLVED. Status reproduced for completeness:
> `TPI-ADR-001-A1`에 따라 Q-CLS-001 ~ Q-CLS-014 대부분 해결됨. 완성성을 위해 상태 재기재.

| ID | Status | Reference |
|---|---|---|
| Q-CLS-001 | ✅ RESOLVED (per-class option) | TPI-ADR-001-A1 §1 DEC-1 |
| Q-CLS-002 | ✅ RESOLVED (Option C) | TPI-ADR-001-A1 §1 DEC-2 |
| Q-CLS-003 | 🔄 DEFERRED (read-only archive likely) | TPI-ADR-001-A1 §2 |
| Q-CLS-004 | ✅ RESOLVED (API agreement) | TPI-ADR-001-A1 §1 |
| Q-CLS-005 | ⏳ PENDING (with 새하컴즈) | TPI-ADR-001-A1 §2 |
| Q-CLS-006 | ⏳ PENDING (procurement) | TPI-ADR-001-A1 §2 |
| Q-CLS-007 | ⏳ PENDING (sample teachers' files) | TPI-ADR-001-A1 §2 |
| Q-CLS-008 | ✅ RESOLVED (calc only) | TPI-ADR-001-A1 §1 DEC-4 |
| Q-CLS-009 | ✅ RESOLVED (1×N) | TPI-ADR-001-A1 §1 DEC-5 |
| Q-CLS-010 | ✅ RESOLVED (per-session) | TPI-ADR-001-A1 §2 |
| Q-CLS-011 | ✅ RESOLVED (substitute with approval) | TPI-ADR-001-A1 §2 |
| Q-CLS-012 | ✅ RESOLVED (soft warning) | TPI-ADR-001-A1 §2 |
| Q-CLS-013 | ✅ RESOLVED (pair-based) | TPI-ADR-001-A1 §1 DEC-6 |
| Q-CLS-014 | ✅ RESOLVED (cls_is_demo flag) | TPI-ADR-001-A1 §2 |

### New Open Questions raised by this module spec (본 분석서에서 새로 제기)

| ID | Question | Owner | Required by |
|---|---|---|---|
| Q-CLS-015 | Bodaschool API spec — when can detailed API documentation be exchanged with 새하컴즈? Determines v1.1 detailed design start. | 김태윤 | Before v1.1 design |
| Q-CLS-016 | Per-Entity Bodaschool account — does TPI have one Bodaschool tenant, or shared across academies? Affects MT-CLS-003. | 김태윤 / 새하컴즈 | Before v1.1 |
| Q-CLS-017 | "STUDENT_DAY_OF_CANCEL" billing policy (BR-CLS-017) — billable or not? Source data shows mixed treatment. | 배예리 | Before settlement go-live |
| Q-CLS-018 | Teacher OAuth onboarding flow — is per-teacher manual (each teacher logs in to grant), or admin-bulk? | 김태윤 | Before v1.1 |
| Q-CLS-019 | Recurrence end date default — is "no end date" allowed, or all classes have planned end? Source shows continuous flow. | 정성경 | Before scheduling go-live |
| Q-CLS-020 | Mode default — when migration cannot detect mode from `비고`, default to ONLINE (matches AS-IS PDF) — confirm. | 정성경 | Before migration |

---

## 13. Acceptance Criteria for Module Sign-Off

CLS module is **DONE for ACM v1.0b** when ALL true:

- [ ] All 5 source data sources migrated (`수업_확인표_*.xlsx` per teacher × 15+ months, 스케쥴(쌤), 이윤건 이윤후, plus AS-IS PDF rules captured)
- [ ] Class CRUD, schedule recurrence, session CRUD, attendance entry — all functional per FR-CLS-C/S/A
- [ ] Makeup workflow with advisor + team-lead approval (FR-CLS-M)
- [ ] Feedback templates (standard + demo) functional with 24h SLA tracking (FR-CLS-F)
- [ ] Settlement calculation with 3.3% withholding, monthly confirm, xlsx export (FR-CLS-T)
- [ ] Provider field `vcf_provider` saved per class (Bodaschool integration deferred to v1.1)
- [ ] Conflict detection for teacher / student double-booking (BR-CLS-011, BR-CLS-012)
- [ ] All P0 functional requirements pass UAT with teacher + advisor + team-lead roles
- [ ] All Q-CLS-* RESOLVED items implemented and verified
- [ ] 1-month parallel xlsx + ACM operation completed

CLS module is **DONE for ACM v1.1** when additionally:

- [ ] Bodaschool API integration functional per FR-CLS-V01 ~ V09
- [ ] Google Calendar one-way push functional per FR-CLS-G01 ~ G09
- [ ] OAuth onboarding flow tested with teachers
- [ ] Provider switch mid-class behavior verified (BR-CLS-015)
- [ ] Failure modes (BR-CLS-013, AMB Issue creation) verified

---

## Appendix A: Source File → DB Quick Reference

### A.1 `수업_확인표_*.xlsx` per teacher per month

| Source | Target | Notes |
|---|---|---|
| Sheet name (e.g. "2026.4") | `stl_year_month` | Format `YYYY-MM`; teacher inferred from filename |
| C2 (number) | (display only) | Not migrated |
| C3 학생 이름 | `cst_student_user_id` (lookup or create) | Group: split by comma → multiple `cst_*` rows under one `cls_*` |
| C4-C19 (1회차~16회차) dates | `ses_scheduled_at` (date) per session | One `cls_sessions` row per non-empty cell |
| C20-C22 (보강 1회차~3회차) dates | `ses_scheduled_at` with `ses_is_makeup=TRUE` | Plus `cls_makeups` row |
| 시간 row (per 회차 column) | `att_billable_hours` | 0.0 → status CANCELLED |
| 비고 row (per 회차 column) | `ses_cancel_reason` (parsed) + `att_remark` | Best-effort ENUM match |
| 시간 합계 (C23) | `stl_hours_total` (computed; cross-validate at migration) | |
| 최종 금액 (C24) | `stl_amount_gross` (computed; cross-validate) | |
| 세후 (R29 footer) | `stl_amount_after_tax` (validation only) | |

### A.2 AS-IS PDF Feedback Templates

Templates in §1.5 mapped to `amb_acm_cls_feedbacks` fields (§3.4).

### A.3 TPI_Master.xlsx › 스케쥴(쌤)

→ Migrate to `cls_recurrence` rows (one per teacher × day-of-week).

### A.4 TPI_Master.xlsx › 이윤건 이윤후 (수업 진행도)

→ Migrate as historical sessions for student "이윤건/이윤후" with class `cls_is_group=TRUE` (sibling pair).

---

## Appendix B: Requirement ID Index

| Prefix | Category | Count |
|---|---|---|
| FR-CLS-C* | Class CRUD | 10 |
| FR-CLS-S* | Schedule and Session | 10 |
| FR-CLS-A* | Attendance | 10 |
| FR-CLS-M* | Makeup | 7 |
| FR-CLS-V* | Video Provider | 9 |
| FR-CLS-G* | Google Calendar | 9 |
| FR-CLS-F* | Feedback | 8 |
| FR-CLS-T* | Settlement | 8 |
| FR-CLS-MG* | Migration | 10 |
| BR-CLS-* | Business Rules | 17 |
| VR-CLS-* | Validation (field) | 10 |
| VR-CLS-X* | Validation (cross-field) | 10 |
| AUD-CLS-* | Audit | 5 |
| PII-CLS-* | PII | 6 |
| MT-CLS-* | Multi-tenancy | 4 |
| NFR-CLS-* | Non-functional | 10 |
| R-CLS-* | Risks | 10 |
| Q-CLS-* | Open Questions (existing+new) | 14 + 6 = 20 |
| **Total** | | **174** |

---

**End of Document (문서 끝)**
