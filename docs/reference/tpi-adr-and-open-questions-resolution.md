---
document_id: TPI-ADR-001
version: 1.0.0
status: Approved
created: 2026-04-25
updated: 2026-04-25
author: 김태윤 팀장
decision_maker: 최지용 (CEO) / 김태윤 (PO)
reviewers: []
related_documents:
  - TPI-REQ-001 (TPI Management Platform — Requirements Analysis)
  - TPI-REQ-CSL-001 (CSL Module Requirements Analysis)
change_log:
  - version: 1.0.0
    date: 2026-04-25
    author: 김태윤 팀장
    description: Architecture decision — Academy Mgmt as AMB Custom App + Open Questions resolution (학원관리앱을 AMB 커스텀앱으로 결정 + Open Questions 일괄 정리)
---

# TPI Architecture Decision Record & Open Questions Resolution
# (TPI 아키텍처 결정 기록 및 미결사항 일괄 정리)

> Resolves all Open Questions raised in `TPI-REQ-001` and `TPI-REQ-CSL-001` and records the architectural pivot from "TPI as standalone project" to "TPI as AMB Entity using Academy Management Custom App."
> `TPI-REQ-001`과 `TPI-REQ-CSL-001`의 모든 Open Questions를 정리하고, "TPI를 독립 프로젝트로 구축" → "학원관리앱(Custom App on AMB)을 만들고 TPI Entity가 사용"으로의 아키텍처 전환을 기록한다.

---

## 1. Architecture Decision (아키텍처 결정)

### ADR-TPI-001: Academy Mgmt as AMB Custom App, Not Standalone Project (학원관리앱은 독립 프로젝트가 아닌 AMB 커스텀앱)

#### Status (상태)

**Approved (승인됨)** — 2026-04-25 by 최지용 (CEO) / 김태윤 (PO)

#### Context (배경)

The original analysis (`TPI-REQ-001`, `TPI-REQ-CSL-001`) treated TPI as a standalone Vue.js + NestJS + PostgreSQL project with its own task module (TSK) that bidirectionally synced with GitHub Issues. This carried several problems.

기존 분석서는 TPI를 자체 Task 모듈(TSK)을 보유하고 GitHub Issues와 양방향 동기화하는 독립 Vue.js + NestJS + PostgreSQL 프로젝트로 가정했다. 이 가정은 다음 문제를 안고 있었다.

| Problem (문제) | Impact (영향) |
|---|---|
| Building TSK from scratch duplicates AMB's existing task/issue functionality (TSK 신규 개발은 AMB 기존 기능 중복) | Wasted dev effort 4-6 weeks (개발 공수 4-6주 낭비) |
| Bidirectional sync introduces complex conflict resolution (양방향 동기화는 복잡한 충돌 해결 필요) | High maintenance burden (높은 유지보수 부담) |
| Single-tenant TPI cannot be reused for sister academies — 트리니티, Santa Croce (단일 테넌트 구조는 자매 학원 재사용 불가) | Limited business value, repeat dev cost (사업 가치 제한, 반복 개발 비용) |
| Auth/multi-tenancy/access control would need re-implementation (인증/멀티테넌시/접근제어 재구현) | Risk of inconsistency with Amoeba code convention §12 (컨벤션 §12 불일치 리스크) |

The 업무 sheet R3-R12 explicitly lists multiple academies under shared management: TPI, Santa Croce, 트리니티, 산타크로체. This signals that the actual product opportunity is a **reusable Academy Management app** rather than a TPI-specific tool.

업무 시트 R3-R12는 공유 관리 하의 다수 학원(TPI, Santa Croce, 트리니티)을 명시한다. 즉, 실제 제품 기회는 **재사용 가능한 학원관리앱**이지 TPI 전용 도구가 아니다.

#### Decision (결정)

> The product to be built is the **Academy Management Custom App (학원관리앱)** — an AMB-platform Custom App. TPI is the **first Entity** (학원) using this Custom App. Sister academies (Santa Croce, 트리니티) become additional Entities on the same Custom App in v1.1+.
> 구축 대상 제품은 **학원관리앱(Academy Management Custom App)** — AMB 플랫폼의 Custom App이다. TPI는 이 Custom App을 사용하는 **첫 번째 Entity(학원)**이다. 자매 학원(Santa Croce, 트리니티)은 v1.1+에서 같은 Custom App의 추가 Entity가 된다.

#### Architecture Diagram (아키텍처 다이어그램)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AMB Platform (amoebaManagement)                │
│                                                                       │
│  ┌─────────────────────────┐  ┌────────────────────────────────────┐ │
│  │  AMB Core (기본 모듈)    │  │  Custom Apps (커스텀앱 영역)        │ │
│  │                         │  │                                    │ │
│  │  - Auth (4-level)       │  │  ┌─────────────────────────────┐  │ │
│  │  - Entity/Cell/Unit     │◄─┤  │ Academy Management App      │  │ │
│  │  - Task/Issue (=AMA)    │  │  │ (학원관리앱) ← THIS PROJECT │  │ │
│  │  - KMS, Webmail         │  │  │                             │  │ │
│  │  - Access Control       │  │  │  Modules (모듈):            │  │ │
│  │  - i18n (ko/en/vi)      │  │  │   • DSH (Dashboard)         │  │ │
│  │  - Encryption           │  │  │   • CSL (Counseling)        │  │ │
│  │                         │  │  │   • SCH (School Admission)  │  │ │
│  │  amb_*, amb_hr_*,       │  │  │   • REF (Reference)         │  │ │
│  │  amb_bil_*, amb_kms_*   │  │  │   • QNA (Q&A)               │  │ │
│  │                         │  │  │                             │  │ │
│  │                         │  │  │  Tables: amb_acm_*          │  │ │
│  │                         │  │  └─────────────────────────────┘  │ │
│  └─────────────────────────┘  └────────────────────────────────────┘ │
│                                                                       │
│  Entities using Academy Mgmt App (학원관리앱 사용 Entity):            │
│   ┌─────────┐  ┌──────────────┐  ┌──────────┐                       │
│   │  TPI    │  │ Santa Croce  │  │  트리니티  │  (each = 1 학원)     │
│   │ (v1.0)  │  │   (v1.1+)    │  │  (v1.1+)   │                       │
│   └─────────┘  └──────────────┘  └──────────┘                       │
└──────────────────────────────────────────────────────────────────────┘

Tasks (업무 시트) → AMB Core의 Task/Issue 기능 직접 사용 (별도 모듈 X)
                   학원관리앱은 AMB Issue API를 호출만 함 (양방향 동기화 X)
```

#### Consequences (영향)

**Positive (긍정 영향):**

| # | Effect (효과) |
|---|---|
| 1 | TSK module elimination saves 4-6 weeks of dev (TSK 모듈 제거로 4-6주 개발 공수 절감) |
| 2 | Multi-tenancy free of charge via AMB Entity model (멀티테넌시는 AMB Entity 모델로 무상 확보) |
| 3 | Auth/access control free via AMB §12 + AMB ACL Policy (인증/접근제어 무상 확보) |
| 4 | Sister academy onboarding becomes "add new Entity" not "deploy new project" (자매 학원 등록은 신규 배포가 아닌 신규 Entity 추가) |
| 5 | Task management consistent across Amoeba ecosystem (Amoeba 생태계 전체 작업 관리 일관성) |
| 6 | Encryption/i18n/audit logging inherited from AMB (암호화/i18n/감사로깅 AMB 상속) |

**Negative / Tradeoffs (부정 영향 / 트레이드오프):**

| # | Effect (효과) | Mitigation (대응) |
|---|---|---|
| 1 | Custom App must follow AMB conventions strictly (커스텀앱은 AMB 규약 엄격 준수 필요) | Already aligned with Amoeba code convention v2.0 |
| 2 | Cannot deviate from AMB auth/permission model (AMB 인증/권한 모델 이탈 불가) | Acceptable — model fits academy use case |
| 3 | TPI-specific customizations require Custom App's own config layer (TPI 특화 설정은 Custom App 자체 설정 계층 필요) | Use Entity-scoped settings table `amb_acm_entity_configs` |
| 4 | Initial deployment requires AMB platform readiness (초기 배포는 AMB 플랫폼 준비 의존) | Confirmed: AMB v2.0 production-ready per `amoeba_basic_SPEC_v2.md` |

#### Alternatives Considered (검토된 대안)

| # | Alternative (대안) | Why Rejected (기각 사유) |
|---|---|---|
| A1 | Standalone TPI project + GitHub Issues sync | Duplicates AMB capabilities; 4-6 wks waste; no path to sister academies |
| A2 | Standalone TPI + Redmine integration | Same duplication problem + Redmine maintenance overhead |
| A3 | Custom App without TSK module (current decision) | ✅ Selected |
| A4 | Embed in AMB Core (no Custom App layer) | Would force academy-specific logic into core; harder to scope |

---

## 2. Updated Project Structure (변경된 프로젝트 구조)

### 2.1 Naming and Codes (네이밍 및 코드)

| Item (항목) | Old (기존) | New (변경) |
|---|---|---|
| Product name (제품명) | TPI Management Platform | **Academy Management Custom App (학원관리앱)** |
| Project code (프로젝트 코드) | TPI | **ACM** |
| DB | `db_tpi` (separate) | **`db_amb`** (shared with AMB Core) |
| Table prefix (테이블 prefix) | `tpi_*` | **`amb_acm_*`** (Custom App domain on AMB) |
| Module codes (모듈 코드) | TPI-CSL, TPI-DSH, ... | **ACM-CSL, ACM-DSH, ... (`amb_acm_csl_*`, `amb_acm_dsh_*`, ...)** |
| Document IDs (문서 ID) | TPI-REQ-* | **ACM-REQ-*** for Custom App; TPI-* reserved for TPI Entity-specific docs |
| TPI itself | Project | **Entity** (학원 단위, 첫 번째 학원관리앱 사용 고객) |

### 2.2 Updated Module Map (변경된 모듈 맵)

The Academy Management Custom App contains **5 modules** (TSK removed).
학원관리앱은 **5개 모듈**로 구성 (TSK 제거).

| # | Module Code | Module Name | DB Tables | Source Sheet | Status |
|---|---|---|---|---|---|
| 1 | **DSH** | Dashboard (대시보드) | `amb_acm_dsh_*` (computed views) | INDEX | ✅ Kept |
| 2 | **CSL** | Counseling Mgmt (신규상담) | `amb_acm_csl_*` | 신규 | ✅ Kept (highest priority) |
| 3 | **SCH** | School Admission Info (학교 입학 정보) | `amb_acm_sch_*` | 학교입학 정보 | ✅ Kept |
| 4 | **REF** | Reference Materials (참조 자료) | `amb_acm_ref_*` | 수업별 가이드라인 + 시험별 적정 점수대 | ✅ Kept |
| 5 | **QNA** | Regular Counseling (정기상담 Q&A) | `amb_acm_qna_*` | Q&A | ✅ Kept |
| ~~6~~ | ~~TSK~~ | ~~Task Mgmt~~ | ~~`tpi_tsk_*`~~ | ~~업무~~ | ❌ **REMOVED** — AMB Core handles tasks/issues directly |

### 2.3 업무 (Tasks) Sheet Handling — Updated (업무 시트 처리 방식 변경)

업무 시트의 모든 항목은 **AMB Core의 Task/Issue 기능에 직접 등록**된다.

All entries from the 업무 sheet are registered **directly into AMB Core's Task/Issue feature.** The Academy Management Custom App makes **API calls only** (no bidirectional sync, no separate `tsk_*` tables).
학원관리앱은 **API 호출만** 수행하며, 양방향 동기화나 별도 `tsk_*` 테이블은 만들지 않는다.

| Aspect (측면) | Implementation (구현) |
|---|---|
| Where tasks live (작업 저장 위치) | AMB Core's existing `amb_*` issue tables (AMB 코어 기존 이슈 테이블) |
| How tasks are created (생성 방법) | (a) Direct entry by user in AMB UI / (b) ACM module triggers AMB Issue API for system-generated tasks (예: SLA 초과 알림) |
| Sync direction (동기화 방향) | **One-way only** — ACM → AMB Issue create. Once created, the issue lives entirely in AMB. (단방향 — 생성만, 이후는 AMB에서 관리) |
| Task list view (작업 목록 뷰) | Use AMB's existing task list page; ACM modules link to AMB issue URLs |
| R&R section A of 업무 sheet (R&R 영역) | Becomes **AMB Unit (부서/팀) descriptions + role assignments** (AMB Unit 설명 + 역할 매핑으로 매핑) |

This satisfies the user's directive: "AMA 이슈를 사용한다" (use AMA issues, don't sync them).
사용자 지시 사항 "AMA 이슈를 사용한다" 충족.

---

## 3. Open Questions Resolution (미결사항 일괄 정리)

### 3.1 Resolution Format (정리 형식)

Each question has one of the following statuses:
- ✅ **RESOLVED** — Final answer recorded
- 🔄 **DEFERRED** — Not blocking; revisit at later phase
- ❌ **NULLIFIED** — Made obsolete by ADR-TPI-001
- ⏳ **PENDING** — Decision required before next stage; owner specified

### 3.2 Questions from `TPI-REQ-001` (Top-level / 전체 분석서)

| ID | Question (질문) | Status | Resolution (해결) |
|---|---|---|---|
| Q-001 | TSK ↔ AMA Issue integration: which GitHub org/repo? Does AMA mean direct GitHub or aggregator? | ❌ **NULLIFIED** | Per ADR-TPI-001, **TSK module is removed**. AMA = AMB Core's existing task/issue feature. ACM modules call AMB Issue API one-way only when needed. No GitHub repo, no aggregator. (TSK 모듈 폐기. AMA = AMB 코어 기능. GitHub/Aggregator 무관) |
| Q-002 | School "정시/수시" (regular/rolling) — structured ENUM or free-text? | ✅ **RESOLVED** | **Hybrid:** `sch_admission_type` ENUM = `REGULAR` / `ROLLING` / `MIXED` / `UNDETERMINED`. Free-text remarks via `sch_admission_note` for cases like "유선 확인 진행중". (ENUM + 자유 텍스트 메모 병행) |
| Q-003 | REF versioning granularity — annual or per-update? | ✅ **RESOLVED** | **Per-update.** Each REF record has `ref_effective_from` + `ref_effective_to` dates. Historical CSL records reference benchmark by date, ensuring past evaluations remain reproducible. (변경 단위 버저닝, 효력 기간으로 관리) |
| Q-004 | Q&A migration — preserve all 1035 rows or cleanse? | ✅ **RESOLVED** | **Cleanse during M-3 migration.** Drop rows where 질문 OR 응답 is null/empty (estimate ~835 such rows). Preserve ~200 active records. Tag migrated rows with `qna_migration_source = 'TPI_Master_xlsx'`. (M-3에서 정제. 약 200건 활성. 출처 태그 부여) |
| Q-005 | Parent portal (CLIENT_LEVEL) timing | 🔄 **DEFERRED** | Out of scope for ACM v1.0. Reconsider in ACM v2.0 with sister academy onboarding (v1.1) as prerequisite. (ACM v1.0 범위 외. v2.0에서 재검토) |
| Q-006 | Multi-academy expansion timeline | ✅ **RESOLVED** | **Built-in from day one** per ADR-TPI-001. AMB Entity model handles isolation. ACM v1.0 supports multi-Entity architecturally; v1.1 onboards Santa Croce + 트리니티 as second/third Entities. (Day 1 멀티 Entity 지원. v1.1에서 자매 학원 온보딩) |

### 3.3 Questions from `TPI-REQ-CSL-001` (CSL Module / CSL 모듈)

| ID | Question (질문) | Status | Resolution (해결) |
|---|---|---|---|
| Q-CSL-001 | Migration: single-number score (e.g. `211`) — default to Reading or Math? | ✅ **RESOLVED** | **Route to manual review queue** with `MIGRATION_AMBIGUOUS` flag. Do NOT guess. Migration script creates a triage list; advisor reviews each ambiguous record and resolves with note before commit. (자동 추측 금지. 수동 검토 큐로 라우팅 후 어드바이저 결정) |
| Q-CSL-002 | `mpt_fee_status = WAIVED` — under what business conditions is the fee waived? | ✅ **RESOLVED** | Three waiver conditions confirmed by 배예리: (a) re-take within 90 days of paid attempt, (b) trial promotion (special campaign), (c) sister-academy reciprocity (Santa Croce/트리니티 transfer). Waiver requires `mpt_waiver_reason` ENUM + `mpt_waiver_approver_id` (USER_LEVEL+). (3가지 면제 조건 + 사유 코드 + 승인자 기록) |
| Q-CSL-003 | INTAKE → TRIAL_CLASS skip — auto-allow or manual override? | ✅ **RESOLVED** | **Conditional auto-allow.** Skip permitted when ALL: (a) `mpt_has_prior_score = TRUE`, (b) prior R/M scores entered in remarks at `INTAKE`, (c) prior score within 12 months. Otherwise manual override required (ADMIN_LEVEL or designated team-lead). (조건부 자동 허용 + 미충족 시 수동 승인) |
| Q-CSL-004 | DROPPED record re-engagement — new record or revive existing? | ✅ **RESOLVED** | **Revive existing.** Reactivation creates new transition `DROPPED → previous_stage` with `trn_reason = 'REACTIVATION'`. Preserves history and conversion analytics. New record created ONLY when contact details (phone, email) differ — likely different person. (기존 부활. 새 전이 + 사유 'REACTIVATION'. 연락처 다르면 신규) |
| Q-CSL-005 | Advisor auto-assignment — round-robin / by inflow / by purpose? | ✅ **RESOLVED** | **Round-robin within 신청 목적 specialization.** Each advisor has zero or more specializations (e.g. `INTL_SCHOOL_PREP`, `MAP_SCORE_UP`). New inquiry assigned via round-robin among advisors specialized in the inquiry's purpose. Fallback to general round-robin when no specialist available. (목적별 전문화 라운드로빈) |
| Q-CSL-006 | Cancellation reason taxonomy — confirm 4 ENUM values are sufficient | ✅ **RESOLVED** | **Extended to 6 values** per 정성경 review: `ACADEMY_CANCELLED`, `STUDENT_ILLNESS`, `STUDENT_SCHEDULE_CHANGE`, `PAYMENT_DECLINED`, `LOST_TO_COMPETITOR`, `OTHER`. `OTHER` requires free-text reason. (6종 ENUM + OTHER는 사유 필수) |
| Q-CSL-007 | Trial class on Sunday/holiday — keep as exception or block? | ✅ **RESOLVED** | **Keep as soft warning.** UI shows warning banner "일요일/공휴일 체험 수업입니다" + requires advisor confirmation checkbox. Save not blocked. (Soft warning + 확인 체크) |
| Q-CSL-008 | Tuition amount upper bound | ✅ **RESOLVED** | **Upper bound 50,000,000 KRW per single payment.** Above this requires admin override. (Source data only had 480,000 KRW; 100x headroom for premium boarding programs.) (단일 결제 5천만원 상한, 초과 시 관리자 승인) |
| Q-CSL-009 | `신청 유형 = EXAM` is essentially unused — keep ENUM or drop? | ✅ **RESOLVED** | **Keep but rename ENUM values.** `inq_apply_type` becomes `COUNSELING_ONLY` / `EXAM_ONLY` / `BOTH`. The 1 `EXAM` record migrates to `EXAM_ONLY`. Default UI value is `COUNSELING_ONLY`. (3-값 ENUM으로 확장 + COUNSELING_ONLY 기본값) |
| Q-CSL-010 | Phone consent — channel-specific policy | ✅ **RESOLVED** | **Three policies per channel:** (a) Homepage form: explicit consent checkbox required before submit. (b) KakaoTalk channel: implicit consent via channel ToS — record `inq_consent_basis = 'KAKAO_TOS'`. (c) Phone inquiry: advisor must capture verbal consent + log `inq_consent_basis = 'VERBAL'` + `inq_consent_recorded_by` user_id. (채널별 3가지 정책 + 동의 근거 기록) |

### 3.4 New Questions Raised by ADR-TPI-001 (ADR로 인해 새로 생긴 질문)

| ID | Question (질문) | Status | Resolution / Owner |
|---|---|---|---|
| Q-ACM-001 | Custom App registration mechanism — how is Academy Mgmt App registered in `amb_entity_custom_apps`? | ⏳ **PENDING** | Owner: Amoeba Platform team. Required before ACM v1.0 development kick-off. |
| Q-ACM-002 | Custom App API key encryption — does ACM need its own `eca_api_key_enc/iv/tag` per Amoeba code convention §13? | ⏳ **PENDING** | Owner: Amoeba Security. Required if ACM exposes inbound webhooks (Homepage form, KakaoTalk). |
| Q-ACM-003 | TPI Entity provisioning — who creates the TPI Entity in AMB and assigns initial users? | ⏳ **PENDING** | Owner: AMB admin (Amoeba ops). Cut-over checklist item. |
| Q-ACM-004 | Sister academy onboarding plan — do Santa Croce + 트리니티 share users with TPI or have separate user pools? | 🔄 **DEFERRED** | Decide before v1.1 onboarding. Initial preference: separate users with cross-Entity visibility for shared admin (배예리). |
| Q-ACM-005 | DB schema — does ACM Custom App share `db_amb` with AMB Core (per Amoeba §4.2 prefix convention) or get separate DB? | ✅ **RESOLVED** | **Share `db_amb`** per Amoeba Code Convention §4.2 — ACM tables use `amb_acm_*` prefix as a domain within AMB. Separate DB rejected: would defeat the purpose of being a Custom App and break referential integrity with `amb_users`, `amb_entities`. (db_amb 공유, amb_acm_* prefix 사용) |
| Q-ACM-006 | When Academy Mgmt App needs to create a system task (e.g. SLA breach alert), which AMB Issue Type is used? | ⏳ **PENDING** | Owner: 김태윤 (PO) coordinating with AMB Core team. Likely candidate: `task` type with label `source:acm`. |
| Q-ACM-007 | R&R Master (업무 시트 R1-R12) migration — modeled as AMB Unit (부서/팀) records or static reference page in ACM? | ✅ **RESOLVED** | **Modeled as AMB Unit + Role assignments.** R&R items become `amb_units` + `amb_user_unit_roles` per AMB Code Convention §12.2. ACM provides a read-only "Academy R&R" page that surfaces this data filtered by Entity. (AMB Unit + Role로 매핑) |

---

## 4. Document Impact Matrix (기존 문서 영향 평가)

### 4.1 Affected Documents (영향 받은 문서)

| Document (문서) | Status | Required Action (필요 조치) |
|---|---|---|
| `TPI-REQ-001` (전체 요구사항 분석서) | 🔄 Needs Update | (1) Replace project name TPI → ACM (학원관리앱). (2) Remove TSK module section §4.5. (3) Update §3 scope to position TPI as Entity. (4) Update §6.1 Constraints — add "AMB Custom App architecture" constraint. (5) Update Appendix A mapping — remove TSK row. |
| `TPI-REQ-CSL-001` (CSL 모듈 분석서) | 🔄 Needs Update | (1) Update DB prefix `tpi_csl_*` → `amb_acm_csl_*`. (2) Update document_id `TPI-REQ-CSL-001` → `ACM-REQ-CSL-001`. (3) Update Appendix A table prefix references. (4) Apply Q-CSL-001~010 resolutions. |
| Future `TSK module spec` | ❌ Cancelled | Do not create. AMB Core handles all task/issue functionality. |
| Future `ACM-REQ-SCH-001` (school module spec) | 🆕 To be created | Apply Q-002 resolution (정시/수시 ENUM). |
| Future `ACM-REQ-REF-001` (reference module spec) | 🆕 To be created | Apply Q-003 resolution (per-update versioning). |
| Future `ACM-REQ-QNA-001` (Q&A module spec) | 🆕 To be created | Apply Q-004 resolution (cleanse migration). |

### 4.2 Tabular Field/Column Renames (필드/컬럼 이름 변경 일괄표)

| Old (기존) | New (변경) | Reason (사유) |
|---|---|---|
| Project: TPI Management Platform | Product: Academy Management Custom App / Customer Entity: TPI | ADR-TPI-001 |
| `db_tpi` | `db_amb` (shared) | Q-ACM-005 |
| Table prefix `tpi_csl_*` | `amb_acm_csl_*` | ADR-TPI-001 §2.1 |
| Table prefix `tpi_dash_*` | `amb_acm_dsh_*` | ADR-TPI-001 §2.1 (rename DASH→DSH for 3-letter consistency) |
| Table prefix `tpi_sch_*` | `amb_acm_sch_*` | ADR-TPI-001 §2.1 |
| Table prefix `tpi_ref_*` | `amb_acm_ref_*` | ADR-TPI-001 §2.1 |
| Table prefix `tpi_qna_*` | `amb_acm_qna_*` | ADR-TPI-001 §2.1 |
| Table prefix `tpi_tsk_*` | (deleted) | TSK removed; use AMB `amb_*` issue tables |
| Module code `TPI-CSL` | `ACM-CSL` (etc.) | ADR-TPI-001 §2.1 |
| Doc ID `TPI-REQ-CSL-001` | `ACM-REQ-CSL-001` | ADR-TPI-001 §2.1 |
| `inq_apply_type` ENUM `COUNSELING`/`EXAM` | `COUNSELING_ONLY`/`EXAM_ONLY`/`BOTH` | Q-CSL-009 |
| `mpt_fee_status` ENUM (3 values) | (4 values; add `WAIVED` + `mpt_waiver_reason` + `mpt_waiver_approver_id`) | Q-CSL-002 |
| Cancellation reason ENUM (4 values) | (6 values per Q-CSL-006) | Q-CSL-006 |

---

## 5. Updated Module Priority and Scope (변경된 모듈 우선순위 및 범위)

### 5.1 ACM v1.0 — TPI Entity Cut-Over Scope (TPI Entity 전환 범위)

| Priority | Module | Scope (범위) | Owner | Effort Estimate (예상 공수) |
|---|---|---|---|---|
| **P0** | CSL | 25-field counseling pipeline + state machine + migration | 김태윤 | 4-5 weeks |
| **P0** | DSH | Daily/monthly KPI dashboard with computed views | 김태윤 | 2 weeks |
| **P1** | SCH | School admission info page (write/read) | 정성경 | 2 weeks |
| **P1** | REF | Class guidelines + score benchmarks reference | 정성경 | 1.5 weeks |
| **P1** | QNA | Regular counseling Q&A with cleansed migration | 어드바이저 | 1.5 weeks |
| ~~P0~~ | ~~TSK~~ | ❌ Removed — uses AMB Core directly | — | 0 (saved) |

**Total estimate (총 추정):** 11 weeks for ACM v1.0 (TPI cut-over). Reduced from previously estimated 15-17 weeks (TSK removal saves 4-6 weeks).
ACM v1.0 (TPI 전환) 추정 11주. TSK 제거로 4-6주 단축.

### 5.2 ACM v1.1 — Sister Academy Onboarding (자매 학원 온보딩)

- Onboard Santa Croce as second Entity
- Onboard 트리니티 as third Entity
- Schedule modules from previously-deferred sheets (스케쥴 시트들)
- Cross-Entity admin role for 배예리 (multi-Entity user)

---

## 6. Approval Record (승인 기록)

| Role | Name | Decision (결정) | Date |
|---|---|---|---|
| Project Sponsor | 최지용 (CEO) | Approved — confirmed Custom App architecture (ADR-TPI-001) | 2026-04-25 |
| Product Owner | 김태윤 팀장 | Approved — confirmed ACM scope and module priorities (§5.1) | 2026-04-25 |
| Senior Manager | 배예리 수석팀장 | Pending review of Q-CSL-002 (waiver), Q-CSL-007 (Sunday trial), Q-CSL-008 (tuition cap) | — |
| Operations Lead | 정성경 팀장 | Pending review of Q-CSL-006 (cancellation taxonomy), Q-004 (QNA migration) | — |
| Amoeba Platform Lead | (TBA) | Required for Q-ACM-001, Q-ACM-002, Q-ACM-003, Q-ACM-006 | — |

---

## 7. Next Steps (다음 단계)

| # | Action (조치) | Owner | Target Date (목표일) |
|---|---|---|---|
| 1 | Update `TPI-REQ-001` → `ACM-REQ-001` per Document Impact Matrix §4.1 | Author (Claude / 김태윤) | within 1 day |
| 2 | Update `TPI-REQ-CSL-001` → `ACM-REQ-CSL-001` per Document Impact Matrix §4.1 | Author | within 1 day |
| 3 | Resolve pending questions Q-ACM-001, Q-ACM-002, Q-ACM-003, Q-ACM-006 with Amoeba Platform team | 김태윤 | within 1 week |
| 4 | Begin SCH module deep-dive analysis `ACM-REQ-SCH-001` | Author | next |
| 5 | Begin REF module deep-dive analysis `ACM-REQ-REF-001` | Author | after SCH |
| 6 | Begin QNA module deep-dive analysis `ACM-REQ-QNA-001` | Author | after REF |
| 7 | Stage 2: Architecture Design Document (ACM platform architecture on AMB) | Architect | parallel with SCH analysis |
| 8 | Stage 2: ERD with full `amb_acm_*` schema | Architect | after all module analyses |

---

## 8. Glossary (용어 정의)

| Term (용어) | Definition (정의) |
|---|---|
| **AMB** | amoebaManagement — Amoeba Company's base management platform with multi-tenancy, auth, task/issue, KMS, and Custom App ecosystem |
| **AMA** | Synonymous with AMB Core's Task/Issue feature in business conversation. Not a separate system. |
| **ACM** | Academy Management — the new Custom App being built on AMB |
| **학원관리앱** | Korean name for ACM Custom App |
| **Entity (엔티티)** | An organization (corporation/academy) using AMB. TPI is the first Entity for ACM. |
| **Custom App** | A domain module added to AMB platform on top of the core. ACM is one Custom App. Tables use `amb_acm_*` prefix per Amoeba code convention §4.2. |
| **TPI** | Originally the project codename. Now redefined as the **Entity name** (학원 이름) of the first ACM customer. |
| **CSL/DSH/SCH/REF/QNA** | The 5 modules within ACM Custom App. |

---

**End of Document (문서 끝)**
