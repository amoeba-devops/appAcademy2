---
document_id: TPI-ADR-001-A1
version: 1.0.0
status: Approved
created: 2026-04-26
updated: 2026-04-26
author: 김태윤 팀장
decision_maker: 김태윤 (PO)
type: Addendum to TPI-ADR-001
parent_document: TPI-ADR-001 v1.0.0
related_documents:
  - ACM-CHG-001 (Change Impact Assessment — Class Management Module)
  - ACM-REQ-001 v2.0
  - ACM-REQ-CLS-001 v1.0 (to be authored)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Addendum recording PO decisions DEC-1 ~ DEC-6 from ACM-CHG-001 and resolving Q-CLS-001 ~ Q-CLS-004 (변경 영향 평가서 ACM-CHG-001의 PO 결정 DEC-1~6 기록 및 Q-CLS-001~004 해결)
---

# TPI-ADR-001 Addendum A1 — Class Management Module Decisions
# (TPI-ADR-001 부속서 A1 — 수업관리 모듈 결정사항)

> Records the decisions taken on 2026-04-26 in response to `ACM-CHG-001` (Change Impact Assessment for the new Class Management requirement). This addendum amends `TPI-ADR-001` by adding §3.5.
> `ACM-CHG-001`(수업관리 신규 요구사항 변경 영향 평가서)에 대해 2026-04-26 이루어진 결정사항을 기록한다. 본 부속서는 `TPI-ADR-001`에 §3.5를 추가한다.

---

## 1. ADR Decision — Class Management Module Added (ADR 결정 — 수업관리 모듈 추가)

### ADR-TPI-002: Class Management as 6th ACM Module with Dual-Provider Video and One-Way Calendar Push (수업관리 — 듀얼 화상 제공자 + 단방향 캘린더 push 적용 6번째 ACM 모듈)

#### Status (상태)

**Approved (승인됨)** — 2026-04-26 by 김태윤 (PO)

#### Context (배경)

`ACM-CHG-001` identified that the new Class Management requirement (a) conflicts with the AS-IS operational guide that mandates Google Meet + Google Calendar, (b) introduces ambiguity in "Google Calendar 기능을 참조" (3 interpretations), (c) implies external integration with Bodaschool whose API capability was unconfirmed, and (d) doubles the v1.0 timeline if added monolithically.

`ACM-CHG-001`은 신규 수업관리 요구사항이 (a) Google Meet + Google Calendar를 강제하는 AS-IS 운영 가이드와 충돌하고, (b) "구글 캘린더 기능을 참조"의 3가지 해석을 유발하며, (c) 보다스쿨 외부 통합의 API 가용성이 미확정이고, (d) 모놀리식 추가 시 v1.0 일정이 두 배가 됨을 식별했다.

#### Decision (결정)

> The Class Management (CLS) module is added as the **6th module of ACM**, with the following architectural choices:
> 수업관리(CLS)는 **ACM의 6번째 모듈**로 추가되며, 다음 아키텍처 선택을 따른다.

| Decision ID | Title | Decision (결정) |
|---|---|---|
| **DEC-1** | Video provider model | **Dual-provider option** — both Google Meet AND Bodaschool are supported. Teacher selects per-class (or per-session) at schedule registration time. |
| **DEC-2** | Google Calendar role | **Option C — One-way push** — ACM is the system of record. ACM pushes scheduled classes to teacher (and optionally student) Google Calendar via Google Calendar API. Edits in Google Calendar do NOT flow back to ACM. |
| **DEC-3** | Rollout phasing | **Phased v1.0a / v1.0b / v1.1** per `ACM-CHG-001 §5.5` |
| **DEC-4** | Settlement scope | **Calculation only** in CLS — 시간 합계, 최종 금액, 세후 금액 computed and exposed. Actual payment integration with AMB Payroll deferred to v1.1+ |
| **DEC-5** | Group class data model | **One schedule with N students (capacity ≥ 1)** — single class entity supports group attendance (matches "정윤아, 정윤지" / "병찬, 소율" source patterns) |
| **DEC-6** | Per-hour rate keying | **(Teacher, Student) pair-based** — rate stored on class enrollment record, allowing per-pair variation observed in source data |
| **AGREED** | Bodaschool API | **API integration agreement reached with 새하컴즈** — Q-CLS-004 RESOLVED. Detailed API specification to be obtained from 새하컴즈 during implementation. |

#### Architecture Diagram (아키텍처 다이어그램)

```
┌────────────────────────────────────────────────────────────────────┐
│  ACM Custom App on AMB                                              │
│                                                                     │
│  ┌────────────┐   CSL.CLASS_STARTED   ┌──────────────────────────┐ │
│  │   CSL      │──────────────────────►│   CLS (NEW MODULE)       │ │
│  │ (counsel)  │                        │   - amb_acm_cls_classes  │ │
│  └────────────┘                        │   - amb_acm_cls_sessions │ │
│                                        │   - amb_acm_cls_attend.  │ │
│                                        │   - amb_acm_cls_feedback │ │
│                                        │   - amb_acm_cls_settle.  │ │
│                                        └────────────┬─────────────┘ │
│                                                     │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                     │
                          ┌──────────────────────────┼──────────────────────┐
                          │                          │                      │
                          ▼                          ▼                      ▼
                  ┌───────────────┐         ┌──────────────────┐    ┌─────────────────┐
                  │ Google Meet   │         │  Bodaschool      │    │ Google Calendar │
                  │ (deep link)   │         │  (API)           │    │ (one-way push)  │
                  │ — DEC-1 opt 1 │         │ — DEC-1 opt 2    │    │ — DEC-2         │
                  └───────────────┘         └──────────────────┘    └─────────────────┘
                  Teacher selects per class         AGREED                ACM → GCal only
                  (cls_video_provider ENUM)
```

#### Rationale (근거)

| Decision | Rationale (근거) |
|---|---|
| DEC-1 (dual-provider) | Avoids forcing immediate change to all teachers; preserves Google Meet workflow during transition; new students/classes can opt into Bodaschool to leverage multi-note/homework features; per-class flexibility recognizes that different student needs justify different platforms |
| DEC-2 (one-way push) | Preserves teacher's Google Calendar daily view (per AS-IS PDF habit); avoids two-way sync complexity (conflict resolution, deletion semantics); ACM remains single source of truth for attendance and feedback |
| DEC-3 (phased) | Avoids doubling v1.0 timeline; lets ACM replace spreadsheet operation first, layer integrations second; reduces risk of total rollout failure |
| DEC-4 (calc only) | Settlement calculation is well-bounded; full payroll integration involves AMB HR/Payroll modules which are out of ACM scope |
| DEC-5 (1×N students) | Matches actual source-data patterns ("정윤아, 정윤지" appears as one slot); simpler join model; group classes are the dominant use case for sibling pairs |
| DEC-6 ((Teacher,Student) rate) | Source data shows per-student rate variation even with the same teacher; this granularity is observable and meaningful |
| Bodaschool API agreed | Procurement track succeeded; removes the largest single risk identified in `ACM-CHG-001` |

#### Consequences (영향)

**Positive (긍정 영향):**

| # | Effect (효과) |
|---|---|
| 1 | Teachers retain Google Calendar habit — adoption friction reduced |
| 2 | Bodaschool's multi-note + homework features unlock immediately for selected classes |
| 3 | v1.0a remains achievable on the original 11-week schedule |
| 4 | CLS module covers attendance/settlement gap left by current spreadsheet operation |
| 5 | Cross-Entity reusability: sister academies (Santa Croce, 트리니티) inherit dual-provider choice |

**Negative / Tradeoffs (부정 영향 / 트레이드오프):**

| # | Effect (효과) | Mitigation (대응) |
|---|---|---|
| 1 | Dual-provider adds UI complexity (provider toggle on every schedule) | Provider default per teacher preference; UI defaults reduce friction |
| 2 | Two integration codepaths to maintain (GMeet, Bodaschool) | Adapter pattern abstracts provider; common interface in code |
| 3 | Google Calendar push fails if teacher revokes OAuth | Graceful degradation — class still saved in ACM; visible warning + retry |
| 4 | v1.0a → v1.0b → v1.1 phased rollout extends total program duration | Accept; clear stage gates document the trade-off |

---

## 2. Open Questions Status Update (미결사항 상태 업데이트)

`ACM-CHG-001 §6` raised Q-CLS-001 ~ Q-CLS-014. Status after this addendum:

`ACM-CHG-001 §6`이 제기한 Q-CLS-001 ~ Q-CLS-014의 본 부속서 적용 후 상태.

| ID | Question (질문) | Status | Resolution (해결) |
|---|---|---|---|
| Q-CLS-001 | Bodaschool migration: full replacement or option? | ✅ **RESOLVED** | **Per-class option** (DEC-1). Both Google Meet and Bodaschool supported; teacher selects at class registration. Field: `cls_video_provider` ENUM (`GOOGLE_MEET` / `BODASCHOOL`) on each class. |
| Q-CLS-002 | Google Calendar interpretation (A/B/C)? | ✅ **RESOLVED** | **Option C — One-way push** (DEC-2). ACM is system of record; Google Calendar receives push only. |
| Q-CLS-003 | Historical Google Calendar feedback data — migrate / archive / abandon? | 🔄 **DEFERRED** | Decide before v1.0b cut-over. Current preference: keep Google Calendar feedback as **read-only archive**; new feedback (post-cut-over) lives in `amb_acm_cls_feedbacks`. |
| Q-CLS-004 | Bodaschool Open API gauge | ✅ **RESOLVED (AGREED)** | API integration **agreement reached** with 새하컴즈. Detailed API spec to be obtained during v1.1 implementation. |
| Q-CLS-005 | Bodaschool's own scheduling — disable or fallback? | ⏳ **PENDING** | Owner: 김태윤 (in coordination with 새하컴즈 API spec). Required before v1.1 detailed design. Default preference: ACM is the single source of truth; Bodaschool scheduling not used. |
| Q-CLS-006 | Bodaschool pricing model | ⏳ **PENDING** | Owner: 최지용 (procurement). Already agreed in principle (Q-CLS-004 RESOLVED). Pricing details captured during contract finalization. |
| Q-CLS-007 | Per-teacher attendance file — how many teachers? Format consistency? | ⏳ **PENDING** | Owner: 김태윤. Required before v1.0b migration. Sample 2-3 teachers' files to validate format. |
| Q-CLS-008 | Settlement scope — CLS calc only vs Payroll integration? | ✅ **RESOLVED** | **Calculation only in CLS** (DEC-4). 시간 합계, 최종 금액, 세후 금액 (3.3% withholding) computed and surfaced. Actual payment via AMB Payroll deferred. |
| Q-CLS-009 | Group classes — 1 schedule × N students vs N parallel | ✅ **RESOLVED** | **1 schedule × N students** (DEC-5). Single class entity with `amb_acm_cls_class_students` join (capacity ≥ 1). |
| Q-CLS-010 | Class modes — ENUM on schedule vs per-session | ✅ **RESOLVED** | **Per-session (회차 단위)**. Source data shows mode varies session-to-session even within same class (e.g. monthly mix of 비대면 / 2인 대면 / 대면). Field on `amb_acm_cls_sessions.ses_mode`. |
| Q-CLS-011 | Makeup — same teacher mandatory or substitute? | ✅ **RESOLVED** | **Same teacher by default; substitute requires team-lead approval.** Substitution recorded in `mkp_substitute_teacher_id` + `mkp_substitution_approver_id`. |
| Q-CLS-012 | Holidays/Sundays — same as CSL Q-CSL-007? | ✅ **RESOLVED** | **Same policy** — soft warning + advisor confirm checkbox. Recurring schedules with Sunday/holiday occurrences flagged at registration. |
| Q-CLS-013 | Per-hour rate keying — pair vs class type | ✅ **RESOLVED** | **(Teacher, Student) pair-based** (DEC-6). Stored on `amb_acm_cls_class_students.cst_hourly_rate`. Default suggested from teacher's standard rate; overridable per pair. |
| Q-CLS-014 | Demo classes — separate flow or `is_demo=TRUE`? | ✅ **RESOLVED** | **`cls_is_demo` BOOLEAN flag on class entity.** Demo classes use the AS-IS PDF's "데모 수업 피드백 양식" (extra fields: 약점 및 발전 방향, 학업 플랜 제안). Otherwise same flow. |

**Summary:** 11 RESOLVED, 1 DEFERRED, 2 PENDING (operational tasks not blocking design).

---

## 3. Updated Module Map (업데이트된 모듈 맵)

| # | Code | Name | Status | DB Prefix | Source |
|---|---|---|---|---|---|
| 1 | DSH | Dashboard | ✅ | `amb_acm_dsh_*` | INDEX |
| 2 | CSL | Counseling (신규상담) | ✅ | `amb_acm_csl_*` | 신규 |
| 3 | SCH | School Admission | ✅ | `amb_acm_sch_*` | 학교입학 정보 |
| 4 | REF | Reference | ✅ | `amb_acm_ref_*` | 수업별 가이드라인 + 시험별 적정 점수대 |
| 5 | QNA | Regular Counseling (정기상담) | ✅ | `amb_acm_qna_*` | Q&A |
| 6 | **CLS** | **Class Management (수업관리)** | 🆕 | `amb_acm_cls_*` | 수업_확인표_*.xlsx + 스케쥴(쌤) + 이윤건 이윤후 |

ACM v1.0 modules: 5 → **6**.

---

## 4. Updated Phasing (업데이트된 단계 분할)

| Phase | Scope | Estimated Duration |
|---|---|---|
| **v1.0a** | Existing 5 modules (DSH/CSL/SCH/REF/QNA) | **11 weeks** |
| **v1.0b** | CLS module — in-app schedule + attendance + makeup + settlement calc; no external integrations | **+6-8 weeks** |
| **v1.1** | Bodaschool API integration + Google Calendar one-way push | **+3.5-5 weeks** |

Total program duration: **~21-24 weeks** for full ACM scope.

> v1.0a delivers immediate value (5 modules), v1.0b digitizes attendance/settlement, v1.1 layers in external integrations.

---

## 5. Document Update Plan (문서 업데이트 계획)

| Document | Status After This Addendum |
|---|---|
| `TPI-ADR-001` v1.0 | Logically extended by this addendum (`TPI-ADR-001-A1`). Future merge into v2.0 may consolidate. |
| `ACM-REQ-001` v2.0 | Needs update to v3.0 — add CLS module to §3.1, §4 summary, §5 NFR, §6 constraints, §7 data volume. To be authored. |
| `ACM-REQ-CSL-001` v2.0 | Needs minor update — add §8.2 cross-module event `CSL.CLASS_STARTED → CLS.SCHEDULE_INITIATED`. |
| `ACM-CHG-001` v1.0 | Now historical record; resolutions captured in this addendum. |
| `ACM-REQ-CLS-001` v1.0 | **To be authored next** — module-level deep-dive applying all decisions above. |

---

## 6. Approval Record (승인 기록)

| Role | Name | Decision (결정) | Date |
|---|---|---|---|
| Product Owner | 김태윤 팀장 | Approved DEC-1 ~ DEC-6 + Bodaschool API agreement | 2026-04-26 |
| Project Sponsor | 최지용 (CEO) | Pending sign-off on phased rollout (DEC-3) and Bodaschool contract (Q-CLS-006) | — |
| Senior Manager | 배예리 수석팀장 | Pending review of settlement scope (DEC-4) | — |
| Operations Lead | 정성경 팀장 | Pending review of Q-CLS-005, Q-CLS-007, makeup substitution rule (Q-CLS-011) | — |
| External | 새하컴즈 (Bodaschool) | API integration agreement reached; technical spec exchange in progress | 2026-04-26 |

---

**End of Document (문서 끝)**
