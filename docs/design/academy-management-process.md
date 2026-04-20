---
document_id: ACADEMY-PRC-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-19
updated: 2026-04-19
author: 김익용
change_log:
  - version: 1.0.0
    date: 2026-04-19
    description: Initial process definition
  - version: 1.2.0
    date: 2026-04-19
    description: |
      Rebranded to Trinity Academy. Added PRC-050 MAP question bank lifecycle,
      PRC-060 Timetable session recording, PRC-070 Trinity Pay settlement,
      PRC-080 Portal intake→consultation promotion.
  - version: 1.3.0
    date: 2026-04-19
    description: |
      Trinity Pay decisions closed. PRC-070 steps concretized with Toss Payments
      Widget + Confirm API + Webhook v2, and refund_policy snapshot.
      Added PRC-075 Refund Calculation (수업일 기준, 학원법 시행령 제18조 3단계),
      PRC-076 Tax Invoice Issuance (국세청 홈택스 eTax API 직결).
      Cross-Process Policies 에 '법적 준수' 행 추가.
---

# Trinity Academy — Process Definition (트리니티 아카데미 프로세스 정의서)

비즈니스 관점에서 학원 운영의 핵심 프로세스를 정의한다. 시퀀스 다이어그램이 기술적 흐름을 나타낸다면, 본 문서는 업무 흐름과 담당 역할/분기 조건에 초점을 둔다.

---

## Process Map (전체 프로세스 맵)

```
  [Program Design]           [Inbound Funnel]                [Operations]
  ┌──────────────┐          ┌──────────────────┐          ┌──────────────────┐
  │ PRC-001      │          │ PRC-010          │          │ PRC-030          │
  │ Program      │──────▶──▶│ Consultation     │─────▶───▶│ Class Operation  │
  │ Lifecycle    │          │ → Visit → Convert│          │ (Schedule/Attend)│
  └──────────────┘          └──────────────────┘          └──────────────────┘
         │                           │                            ▲
         ▼                           ▼                            │
  ┌──────────────┐          ┌──────────────────┐                 │
  │ PRC-002      │          │ PRC-020          │                 │
  │ Class        │──────────│ Parent-Student   │─────────────────┘
  │ Opening      │          │ Enrollment       │
  └──────────────┘          └──────────────────┘

                  [Master Data]
                  ┌──────────────────┐
                  │ PRC-040          │
                  │ Teacher Sync     │
                  │ (with AMA)       │
                  └──────────────────┘
```

---

## PRC-001: Program Lifecycle (프로그램 라이프사이클)

- **Process ID**: PRC-001
- **Purpose (목적)**: 학원이 제공하는 커리큘럼 프로그램을 기획·활성화·종료하는 전체 라이프사이클 관리
- **Trigger (시작 조건)**: 학원장이 새 프로그램을 기획
- **Completion (종료 조건)**: 프로그램이 `ARCHIVED` 상태로 전이

### Processing Steps

| Step | Actor | Action | Input | Output | Branch |
|------|-------|--------|-------|--------|--------|
| 1 | Academy Admin | 프로그램 초안 작성 | 이름, 분류, 대상 | `tac_programs(status=DRAFT)` | → 2 |
| 2 | Academy Admin | 설정 입력 (수강료, 정원, 회차) | `tac_program_settings` 항목 | `settings` 저장 | 필수 항목 부족 → 2 반복 |
| 3 | System | 필수 항목 검증 (fee/capacity/session_count) | — | pass/fail | fail → 2 / pass → 4 |
| 4 | Academy Admin | `ACTIVE`로 승격 | — | `status=ACTIVE` | → 5 |
| 5 | Academy Admin | 카탈로그 공개 | — | `status=PUBLISHED` | → 6 or 기다림 |
| 6 | Academy Admin | 프로그램 종료 | — | `status=ARCHIVED` | END |

### Exception Handling

| Exception | Step | Response |
|-----------|------|----------|
| 카탈로그 공개 중 중요한 설정 변경 시 | 5 → 2 | PUBLISHED 상태에서 fee/capacity 변경은 승인 워크플로우 필요 [TBD] |
| 개설된 Class가 있는 프로그램 ARCHIVE 시도 | 6 | 활성 Class가 없을 때만 ARCHIVE 허용 (`tac_classes.status != CLOSED` 0건) |

---

## PRC-002: Class Opening (강의 개설)

- **Process ID**: PRC-002
- **Purpose**: 프로그램에서 구체 강의(반)를 개설하고 회차 스케줄을 확정
- **Trigger**: Program `status=PUBLISHED`
- **Completion**: Class `status=OPEN_FOR_ENROLLMENT`

### Processing Steps

| Step | Actor | Action | Branch |
|------|-------|--------|--------|
| 1 | Academy Admin | 교사 선택 (AMA Client 기반 등록된 Teacher) | — |
| 2 | Academy Admin | 강의실/요일·시간/시작일/정원 입력 | — |
| 3 | System | 스케줄 충돌 검증 (교사·강의실 시간 겹침) | 충돌 → 2 재입력 |
| 4 | System | `tac_class_sessions` 자동 생성 (session_count × 패턴) | — |
| 5 | Academy Admin | 개설 확정 → `OPEN_FOR_ENROLLMENT` | END |

---

## PRC-010: Consultation → Visit → Conversion (상담→방문→전환)

- **Process ID**: PRC-010
- **Purpose**: 학부모의 문의를 실제 수강 등록까지 연결
- **Trigger**: 학부모 문의 (전화/온라인/방문)
- **Completion**: Consultation `status=CONVERTED` 또는 `LOST`

### Processing Steps

| Step | Actor | Action | Input | Output | Branch |
|------|-------|--------|-------|--------|--------|
| 1 | Parent | 문의 제기 | 연락처, 관심 프로그램 | — | → 2 |
| 2 | Staff | 상담 접수 (FN-010) | 문의 내용 | `tac_consultations(status=OPEN)` | → 3 |
| 3 | Staff | 학부모 프로필 확인/보완 | — | Parent 확정 or 임시 | → 4 |
| 4 | System | 담당자 자동 배정 | 규칙(라운드로빈) | `assignee_user_id` | → 5 |
| 5 | Staff | 학부모 연락 및 상담 | — | 상세 니즈 파악 | 방문 희망 → 6, 즉시 포기 → 10 |
| 6 | Staff | 방문 예약 (`tac_visit_records.scheduled_at`) | 일정 | 예약 레코드 | → 7 |
| 7 | Parent | 방문 | — | `visited_at` 기록 | → 8 |
| 8 | Staff | 방문 결과 기록 (outcome) | INTERESTED/DECLINED/PENDING | `tac_consultations.status` 업데이트 | INTERESTED → 9, DECLINED → 10, PENDING → 6 |
| 9 | Staff or Parent | 수강 등록 전환 (FN-012) | 학생 정보, 강의 선택 | Student + Enrollment 생성 | CONVERTED → END |
| 10 | Staff | 상담 종료 | — | `status=LOST` + 사유 | END |

### Key Business Rules

- 상담은 **학부모 중심**으로 누적된다. 동일 학부모의 반복 문의는 `parent_id` 기준으로 history view 제공.
- Visit record는 **한 건의 consultation에 N건** 누적 가능. 예약만 하고 방문하지 않아도(`visited_at IS NULL`) 이력으로 남김.
- `CONVERTED` 되면 converted_enrollment_id 가 반드시 채워진다 (감사 추적).

### Exception Handling

| Exception | Step | Response |
|-----------|------|----------|
| 방문 노쇼 (예약 후 미방문) | 7 | 스케줄러가 24시간 후 자동 `outcome=PENDING` + staff 알림 |
| 전환 시도 중 정원 초과 | 9 | Waitlist로 수강 등록, Consultation `status=CONVERTED`는 유지 |
| 24시간 내 동일 프로그램 중복 문의 | 2 | 경고 표시, 기존 consultation에 추가 note 권고 (신규 생성은 허용) |

---

## PRC-020: Parent-Student Enrollment (학부모의 학생 수강 등록)

- **Process ID**: PRC-020
- **Purpose**: 학부모가 자녀를 특정 강의에 등록
- **Trigger**: 학부모 직접 or Staff 대행 신청
- **Completion**: Enrollment `status ∈ {CONFIRMED, WAITLIST, CANCELED}`

### Processing Steps

| Step | Actor | Action | Branch |
|------|-------|--------|--------|
| 1 | Parent/Staff | 학부모 등록 확인 (없으면 FN-020) | Parent 미등록 → 1a |
| 1a | Staff | 학부모 등록 완료 | → 2 |
| 2 | Parent/Staff | 학생 등록 확인/생성 (FN-022, `primary_parent_id` 필수) | → 3 |
| 3 | Parent/Staff | 수강할 Class 선택 | → 4 |
| 4 | System | 권한 검증 (신청 주체가 학생의 primary_parent 또는 guardian) | 실패 → 종료 |
| 5 | System | 중복 등록 검사 (`class_id + student_id`) | 중복 → 종료 |
| 6 | System | 정원 검사 (`enrolled_count < capacity`) | 초과 → 7b |
| 7a | System | `CONFIRMED` 등록 + enrolled_count 증가 | → 8 |
| 7b | System | `WAITLIST` 등록 | → 8 |
| 8 | System | `enrollment.created` 이벤트 발행 | → 9 |
| 9 | Notification | 학부모에게 등록 결과 알림 | END |

### Key Business Rules
- **한 학생은 동일 Class에 한 번만 등록** (unique `class_id + student_id`).
- **신청 주체는 학생의 보호자여야 함** — primary_parent 또는 tac_student_guardians에 등록된 parent.
- **결제 연동은 별도** (Out-of-Scope). 결제 확인 후 `CONFIRMED` 전이하도록 확장 가능.

---

## PRC-030: Class Operation (강의 운영 — 스케줄/출결)

- **Process ID**: PRC-030
- **Purpose**: 개설된 강의의 회차별 운영 및 출결 관리
- **Trigger**: Class `status=OPEN_FOR_ENROLLMENT` → Class 시작일 도래
- **Completion**: 모든 session `status=COMPLETED`, Class `status=CLOSED`

### Processing Steps

| Step | Actor | Action | Branch |
|------|-------|--------|--------|
| 1 | System (Cron) | Class 시작일 도래 → `status=IN_PROGRESS`로 자동 전이 | — |
| 2 | Teacher | 회차 스케줄 캘린더 조회 (FN-050) | — |
| 3 | Teacher | 회차 진행 | — |
| 4 | Teacher/Staff | 출결 입력 (FN-060) | — |
| 5 | System | 연속 결석 N회 감지 시 학부모 알림 트리거 (N=2 가정, [TBD]) | — |
| 6 | System | 마지막 session `COMPLETED` → Class `status=CLOSED` 자동 전이 | END |
| 7 | System | 모든 Enrollment `status=IN_PROGRESS → COMPLETED` 배치 | END |

### Exception Handling

| Exception | Response |
|-----------|----------|
| Session 휴강 | Teacher/Staff가 `status=CANCELED`로 변경, 보강 회차(`RESCHEDULED`) 생성 |
| 교사 변경 | 남은 session의 `class.teacher_id` 업데이트 + 충돌 재검증 |
| 학생 중도 포기 (Withdraw) | Enrollment `status=WITHDRAWN`, 남은 session attendance 생성 중지 |

---

## PRC-040: Teacher Sync with AMA (AMA 교사 동기화)

- **Process ID**: PRC-040
- **Purpose**: AMA Client(거래처)의 단일 진실 원천성을 유지하며 학원 시스템의 표시 캐시를 일관성 있게 반영
- **Trigger**: AMA에서 `client.updated` / `client.deactivated` 이벤트 발생
- **Completion**: 로컬 `tac_teachers.cached_profile` 및 `status` 동기화 완료

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | AMA | Client 변경 → Webhook 발송 |
| 2 | Sync Service | HMAC 서명 검증 및 이벤트 접수 |
| 3 | Sync Service | RabbitMQ에 이벤트 publish (내구 큐) |
| 4 | Teacher Sync Worker | consume → AMA Client 전체 프로필 조회 |
| 5 | Worker | `tac_teachers.cached_profile` + `last_synced_at` 업데이트 |
| 6 | Worker | Client `INACTIVE` → `tac_teachers.status=SUSPENDED` |

### Fallback (Webhook 실패 대비)

- 매일 02:00 KST 배치로 최근 30일 내 수정된 AMA Client를 polling하여 보정 (drift 방지)
- `last_synced_at`이 7일 이상 경과한 teacher는 warning 리포트 대상

---

## PRC-050: MAP Question Bank Lifecycle (MAP 문제은행 라이프사이클)

- **Process ID**: PRC-050
- **Purpose**: MAP 지문·문항의 등록·검수·배정·채점·성적 이력화 일관성 보장
- **Trigger**: 콘텐츠 담당자 등록 요청 또는 시험지 배정 요청
- **Completion**: 학생 MAP Score 이력 업데이트

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Content Editor | 지문·문항 DRAFT 등록 (FN-070/071) — 복수 정답/Part A-B 지원 |
| 2 | Content Editor | 버전 `v1` → 검수 요청 |
| 3 | Academy Admin | 검수 승인 → `status=ACTIVE` |
| 4 | Academy Admin | Test Set 구성 (고정/자동) (FN-073) |
| 5 | Academy Admin | Class/Student 배정 (FN-074) — `tac_map_test_set_items.item_version_snapshot` 고정 |
| 6 | Student | 응시 — Response 기록 (FN-075) |
| 7 | System | 자동 채점 → 영역별 점수 집계 |
| 8 | System | `tac_map_scores` insert (FR-034) + 학부모 알림 (AmoebaTalk) |

### Branch Conditions
- 문항 수정 시: `version++` 신규 row, 기존 배정은 스냅샷으로 보존 (FR-028)
- 공용 풀(Q-006) 사용 여부에 따라 `academy_id=NULL` 문항 조회 필터 분기

---

## PRC-060: Timetable Session Recording (수업 회차 기록)

- **Process ID**: PRC-060
- **Purpose**: 수업 확인표 엑셀의 운영 관행을 시스템에서 손실 없이 재현
- **Trigger**: 수업 당일 교사/행정 직원이 회차 완료 기록
- **Completion**: `tac_class_sessions` 회차의 `session_status` 및 실제 수업 시간 확정

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Teacher (또는 Staff) | Teacher Timetable View에서 오늘 세션 선택 |
| 2 | Teacher | 수업 실시 → `session_status=HELD`, `actual_duration_hours` 입력 (0.5h 단위, A-007) |
| 2' | Teacher | 결강 시 `session_status=CANCELLED`, `cancel_reason` 필수 — **빨강 표시** |
| 3 | Staff | 보강 생성 시 새 session insert + `makeup_of_session_id` 연결 (FR-033) |
| 4 | System | KPI 업데이트: 수업 당일 출결 기록 완료율 집계 |

### Color Code (수업 확인표 규약)
- **초록(Green)** = HELD (정상 진행)
- **빨강(Red)** = CANCELLED (결강)
- **파랑/보라(옵션)** = MAKEUP (보강)

---

## PRC-070: Trinity Pay Settlement (결제 승인)

- **Process ID**: PRC-070
- **Purpose**: 수강료 결제를 Trinity Academy 내부에서 **Toss Payments**와 직접 처리 (C-003 revised, A-009, A-011)
- **Trigger**: Enrollment 상태 `PENDING_PAYMENT` 진입
- **Completion**: 결제 승인 → Enrollment `CONFIRMED` / 실패 → `CANCELED_UNPAID`
- **Critical**: AMA는 이 프로세스에 관여하지 않는다 (Out-of-Scope)

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Enrollment Service | `tac_pay_orders` 생성 (idempotency_key, order_no 생성) — FN-100. `refund_policy_version_id` 를 현재 활성 정책으로 snapshot |
| 2 | Enrollment Service | 학부모에게 결제 페이지 링크/딥링크 제공 (AmoebaTalk/이메일) |
| 3 | Parent (Browser) | Toss Payments Widget 로드 (`@tosspayments/payment-widget-sdk`) — `clientKey` + `customerKey` + `amount` |
| 4 | Parent | 결제수단 선택 (카드/계좌이체/가상계좌/간편결제) → `requestPayment()` 호출 |
| 5 | Toss | 결제창 처리 후 `successUrl` 리다이렉트 (`paymentKey`, `orderId`, `amount`) |
| 6 | Trinity Pay Gateway | `POST /v1/payments/confirm` 호출 (Basic Auth: secretKey) → 승인 응답 수령 |
| 7 | Trinity Pay Gateway | `tac_pay_orders.status=DONE`, `pg_payment_key`, `approved_at` 저장. `tac_pay_ledger.entry_type=CHARGE` (amount=+total) insert |
| 8 | Trinity Pay Gateway | RabbitMQ `payment.approved` publish |
| 9 | Enrollment Worker | `tac_enrollments.status=CONFIRMED`, `confirmed_at=now` |
| 10 | Receipt Worker | (현금결제/간이영수증 요청시) `tac_pay_receipts` insert + PDF S3 업로드. 사업자 요청시 PRC-076 트리거 |
| 11 | Notification Worker | AmoebaTalk/이메일 알림 발송 (학부모 + 학원장) |

### Webhook Reconciliation
- Toss Payment Webhook v2 를 별도로 수신하여 `status` 재확인 (DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED)
- HMAC `TossPayments-Signature` 검증, `idempotency_key` 중복 차단
- Confirm API 타임아웃 시: Webhook 또는 배치(주기 30분) Reconcile로 상태 일치화

### Error Handling
- Confirm API 실패: `status=ABORTED` 기록, 학부모에게 재결제 유도
- 가상계좌 미입금: `expires_at` 초과 → `status=EXPIRED` 배치 전환
- 결제 금액 위변조: `amount !== Toss 응답 totalAmount` → 즉시 거부 + 보안 로그

---

## PRC-075: Refund Calculation & Execution (환불 계산 및 집행) ★ v1.3 신규

- **Process ID**: PRC-075
- **Purpose**: 수업일(회차) 경과 기준 환불 규정 적용, Toss 결제 취소 API 연동 (A-012, FR-041, FR-047, NFR-013)
- **Trigger**: 학부모 환불 요청 또는 학원 측 수강 중단
- **Completion**: Toss 취소 승인 + tac_pay_ledger 역분개 + enrollment `WITHDRAWN`

### Refund Calculation Formula

```
elapsed_ratio = held_session_count / total_session_count
  (held_session_count = tac_class_sessions WHERE status='HELD' AND ended_at <= NOW())
  (total_session_count = enrollment 의 class.total_sessions)

tier = SELECT * FROM tac_pay_refund_policy_tiers
       WHERE policy_id = tac_pay_orders.refund_policy_version_id
         AND elapsed_ratio_min < :elapsed_ratio
         AND elapsed_ratio   <= :elapsed_ratio_max
       ORDER BY tier_order LIMIT 1

refund_amount = FLOOR(tac_pay_orders.amount × tier.refund_rate)
```

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Parent / Staff | 환불 요청 접수 → `tac_counseling_records` (topic='REFUND_REQUEST') |
| 2 | Admin | 환불 승인 UI 진입 — 시스템이 경과율·해당 tier·환불액·잔여액을 자동 제시 (FN-102) |
| 3 | Admin | 환불 사유·금액 확인 후 승인 (조정 금액 기재 가능, 학원법 하한은 못 내림) |
| 4 | Refund Service | Toss `POST /v1/payments/{paymentKey}/cancel` 호출 — `cancelAmount`, `cancelReason` |
| 5 | Toss | 승인 → 응답에 `cancels[]` 배열 반환 |
| 6 | Refund Service | `tac_pay_orders.status` 갱신 (`PARTIAL_CANCELED` or `CANCELED`) |
| 7 | Refund Service | `tac_pay_ledger` insert (`entry_type=REFUND`, `amount=-refund_amount`, `refund_tier_id`, `elapsed_ratio_at_refund`) |
| 8 | Refund Service | 세금계산서 발행분이면 PRC-076 취소/수정 트리거 |
| 9 | Enrollment Worker | 전액취소 시 `tac_enrollments.status=WITHDRAWN`, 부분취소는 상태 유지 |
| 10 | Notification Worker | 학부모에게 환불 내역(경과율/적용 tier/금액) 명시 알림 |

### Branch: 환불 불가 구간
- 경과율 > 1/2 이면 `refund_rate=0` → Toss 취소 호출하지 않고 거부 응답, 사유 로그만 기록
- 학원이 정책 버전을 자체 개정해도 **해당 결제는 발행 당시 snapshot** 으로 계산됨 (FR-047)

---

## PRC-076: Tax Invoice Issuance (세금계산서 자체 발행) ★ v1.3 신규

- **Process ID**: PRC-076
- **Purpose**: 결제 건에 대해 국세청 홈택스 eTax API 직결로 자체 발행 (A-013, FR-048, NFR-013)
- **Trigger**: 결제 DONE + 사업자 발행 요청 OR 월말 배치
- **Completion**: 국세청 발급승인번호(`nts_issue_no`) 수령, `tac_pay_tax_invoices.status=APPROVED`

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Parent / Staff | 세금계산서 발행 요청 (사업자번호, 대표자, 담당자 이메일 입력) |
| 2 | Tax Invoice Service | `tac_pay_tax_invoices` DRAFT insert — invoice_no 채번, 공급가액/부가세 자동 산정 |
| 3 | Tax Invoice Service | 전자세금계산서 XML 생성 (국세청 표준 스키마) |
| 4 | Tax Invoice Service | 서버 HSM/KMS 에서 공동인증서로 XML 전자서명 |
| 5 | Tax Invoice Service | 홈택스 eTax `전자세금계산서 즉시발급 API` 호출 |
| 6 | NTS Hometax | 심사 후 `nts_issue_no` + `nts_approved_at` 응답 |
| 7 | Tax Invoice Service | `tac_pay_tax_invoices.status=APPROVED`, `xml_payload_url` + `pdf_url` S3 업로드 |
| 8 | Notification Worker | 구매자 이메일로 PDF 전송 + AmoebaTalk 알림 |

### Legal Deadline (NFR-013)
- 공급 시점(`tac_pay_orders.approved_at`) 익월 10일까지 NTS 전송 완료
- 배치: 익월 5일에 `status != APPROVED AND supply_month = prev_month` 쿼리 → 알림

### Branch: 전송 실패 / 취소
- `nts_error_code` 수신 → `status=REJECTED`, 관리자 재시도 큐에 적재
- 결제 취소시(PRC-075) `tac_pay_tax_invoices` **수정 세금계산서** 발행 (공급가액 (-) 음수 건 추가)

---

## PRC-080: Portal Intake → Consultation Promotion (포털 상담 승격)

- **Process ID**: PRC-080
- **Purpose**: Trinity Academy 메인 포털 Contact 폼 제출을 운영 콘솔 Consultation으로 손실 없이 승격
- **Trigger**: `FN-114` 폼 제출

### Processing Steps

| Step | Actor | Action |
|------|-------|--------|
| 1 | Parent | 포털 Contact 폼 제출 — reCAPTCHA v3 + 개인정보 동의 확인 |
| 2 | Portal API | `tac_consultation_intake_form` insert (`status=NEW`) |
| 3 | Portal API | AmoebaTalk 알림 → 상담 담당자 (assignee) |
| 4 | Staff | 관리 콘솔에서 intake 검토 → Parent 엔티티 매칭/생성 |
| 5 | Staff | `tac_consultations` insert + `intake.status=PROMOTED`, `promoted_consultation_id` 세팅 |
| 6 | System | KPI 집계: 포털 상담 전환율 (target 95% 이상) |

### Branch: Spam / Duplicate
- captcha_score < 0.3 → `status=SPAM`
- 24시간 내 동일 phone 반복 제출 → `status=DUPLICATE`

---

## Cross-Process Policies

| Policy | Description |
|--------|-------------|
| **권한 분리** | Admin(학원장) = 전체 / Staff(행정) = 프로그램·상담·등록·결제 / Teacher = 자기 스케줄·출결·MAP 채점 |
| **Tenant 격리** | 모든 SELECT/INSERT는 `academy_id` 세션 컨텍스트 자동 주입 |
| **감사로그** | 등록/취소/수강상태/결제/환불 변경은 `audit_log` 별도 테이블에 기록 |
| **개인정보** | 학부모 연락처는 암호화 저장, 조회 시 권한별 마스킹 |
| **결제 보안** | 카드 PAN 절대 미저장. Toss `paymentKey` (`pg_payment_key`)만 사용. PCI-DSS SAQ-A (NFR-011) |
| **AMA 경계** | AMA는 교사 마스터·알림 전용. **결제·수강·성적 데이터는 AMA로 흐르지 않는다** |
| **법적 준수 (NFR-013)** | 환불: 학원법 시행령 제18조 기본 3단계 (수업일 경과 기준, 정책 snapshot 불변). 세금계산서: 공급 익월 10일까지 홈택스 전송. 공동인증서: 만료 30일 전 알림/갱신. |
| **환불 정책 snapshot** | `tac_pay_orders.refund_policy_version_id` 는 주문 생성 시점 정책에 고정되며, 정책 버전 개정이 과거 결제 환불액에 소급되지 않음 (FR-047, A-012) |
