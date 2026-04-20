---
document_id: ACADEMY-SEQ-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-19
updated: 2026-04-19
author: 김익용
change_log:
  - version: 1.0.0
    date: 2026-04-19
    description: Initial 7 scenarios
  - version: 1.2.0
    date: 2026-04-19
    description: |
      Rebranded to Trinity Academy; FE switched to React/Next.js.
      Added Scenario 8 (Portal Intake → Consultation),
      Scenario 9 (MAP Assignment & Grading),
      Scenario 10 (Trinity Pay — PG Webhook, no AMA involvement),
      Scenario 11 (Session Recording with color code).
  - version: 1.3.0
    date: 2026-04-19
    description: |
      Trinity Pay decisions closed. Scenario 10 specialized to Toss Payments
      (Widget + Confirm API + Webhook v2, Toss status enum).
      Added Scenario 12 (Refund — session-based, 학원법 시행령 제18조 tiers),
      Scenario 13 (Tax Invoice — 국세청 홈택스 eTax API 직결 발행).
---

# Trinity Academy — Sequence Diagrams (트리니티 아카데미 시퀀스 다이어그램)

본 문서는 주요 시나리오의 컴포넌트 간 상호작용을 Mermaid `sequenceDiagram`으로 정의한다.
Frontend는 **React 18 + Next.js 14 App Router** (포털 + 관리 콘솔 공통), Backend는 **Next.js Route Handlers**, Queue는 **RabbitMQ**, DB는 **MySQL 8**, Storage는 **S3 호환**을 사용한다.

> **AMA 경계 원칙**: 아래 시퀀스에서 AMA는 교사 마스터 참조(Scenario 3, 7) 와 알림(AmoebaTalk, 여러 시나리오)에만 등장한다. **결제(Scenario 10)에는 AMA가 등장하지 않는다.**

---

## Scenario 1: Consultation Intake (학부모 상담 접수) — FN-010

```mermaid
sequenceDiagram
    actor Staff as Academy Staff
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ
    participant Notify as Notification Worker

    Staff->>FE: 상담 접수 화면 입력<br/>(학부모 연락처, 관심 프로그램)
    FE->>BE: POST /api/consultations
    BE->>DB: SELECT tac_parents WHERE phone = ?<br/>(upsert 판정)
    alt 기존 학부모 없음
        BE->>DB: INSERT INTO tac_parents (...)
    end
    BE->>DB: INSERT INTO tac_consultations (status='OPEN')
    DB-->>BE: consultation_id
    BE->>MQ: publish event<br/>consultation.created
    BE-->>FE: 201 { consultation_id, parent_id }
    FE-->>Staff: 접수 완료 표시

    MQ->>Notify: consume consultation.created
    Notify->>Notify: 담당 직원 자동 배정 규칙 적용<br/>(Round-robin / 지역)
    Notify->>DB: UPDATE tac_consultations SET assignee_user_id = ?
    Notify->>Notify: 담당자 알림 발송 (내부 메신저)
```

---

## Scenario 2: Visit Record & Conversion (방문→등록 전환) — FN-011, FN-012

```mermaid
sequenceDiagram
    actor Staff as Academy Staff
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ

    Staff->>FE: 상담 상세 화면 → 방문 결과 입력
    FE->>BE: POST /api/consultations/{id}/visits<br/>{ visited_at, outcome=INTERESTED }
    BE->>DB: INSERT INTO tac_visit_records
    BE->>DB: UPDATE tac_consultations SET status='FOLLOW_UP'
    BE-->>FE: 201 visit_record

    Staff->>FE: "수강 등록으로 전환" 클릭
    FE->>BE: POST /api/consultations/{id}/convert<br/>{ student_profile, class_id }
    BE->>DB: BEGIN TRANSACTION
    BE->>DB: INSERT INTO tac_students (primary_parent_id=consultation.parent_id)
    BE->>DB: SELECT capacity, enrolled_count FROM tac_classes WHERE id=? FOR UPDATE
    alt 정원 여유 있음
        BE->>DB: INSERT INTO tac_enrollments (status='CONFIRMED')
        BE->>DB: UPDATE tac_classes SET enrolled_count = enrolled_count + 1
    else 정원 초과
        BE->>DB: INSERT INTO tac_enrollments (status='WAITLIST')
    end
    BE->>DB: UPDATE tac_consultations SET status='CONVERTED',<br/>converted_enrollment_id=?
    BE->>DB: COMMIT
    BE->>MQ: publish event enrollment.created
    BE-->>FE: 201 { student_id, enrollment_id, status }
```

---

## Scenario 3: Teacher Registration via AMA (교사 등록 — AMA Client 참조) — FN-030

```mermaid
sequenceDiagram
    actor Admin as Academy Admin
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant AMA as AMA Service
    participant DB as MySQL

    Admin->>FE: 교사 등록 화면 → AMA Client 검색
    FE->>BE: GET /api/ama/clients?query=홍길동
    BE->>AMA: GET /clients?q=홍길동
    AMA-->>BE: [{ client_id, name, phone, type }]
    BE-->>FE: 검색 결과 리스트
    FE-->>Admin: 후보 선택 UI

    Admin->>FE: Client 선택 + 담당 과목/고용형태 입력
    FE->>BE: POST /api/teachers<br/>{ ama_client_id, teaching_subjects, employment_type }
    BE->>AMA: GET /clients/{ama_client_id}
    AMA-->>BE: { client_id, name, phone, status, type }
    alt type 허용되지 않음 or status=INACTIVE
        BE-->>FE: 422 Unprocessable
    else 정상
        BE->>DB: SELECT tac_teachers WHERE ama_client_id=? AND academy_id=?
        alt 이미 등록됨
            BE-->>FE: 409 Conflict
        else 신규
            BE->>DB: INSERT INTO tac_teachers (cached_profile=snapshot)
            BE-->>FE: 201 { teacher_id }
        end
    end
```

---

## Scenario 4: Class Creation + Session Generation (강의 개설 & 회차 자동 생성) — FN-040

```mermaid
sequenceDiagram
    actor Admin as Academy Admin
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant Scheduler as Session Generator

    Admin->>FE: 강의 개설 (프로그램/교사/강의실/<br/>요일·시간/시작일/정원)
    FE->>BE: POST /api/classes
    BE->>DB: SELECT session_count FROM tac_program_settings<br/>WHERE program_id=?
    BE->>BE: Conflict Check (FN-041)<br/>- 교사 시간 중복<br/>- 강의실 시간 중복
    BE->>DB: SELECT tac_classes WHERE<br/>(teacher_id=? OR classroom_id=?)<br/>AND overlapping time
    alt 충돌 있음
        BE-->>FE: 409 Conflict { conflicts[] }
    else 충돌 없음
        BE->>DB: BEGIN TRANSACTION
        BE->>DB: INSERT INTO tac_classes
        BE->>Scheduler: generate(class_id, start_date,<br/>schedule_pattern, session_count)
        Scheduler->>Scheduler: 요일·시간 × 회차수만큼<br/>start_at/end_at 계산
        Scheduler->>DB: INSERT INTO tac_class_sessions (bulk)
        BE->>DB: COMMIT
        BE-->>FE: 201 { class_id, generated_session_count }
    end
```

---

## Scenario 5: Teacher Schedule View (교사 스케줄 조회) — FN-050

```mermaid
sequenceDiagram
    actor Teacher as Teacher (or Admin)
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant Cache as Redis

    Teacher->>FE: 내 스케줄 캘린더 (주간)
    FE->>BE: GET /api/teachers/{id}/schedule?from=&to=
    BE->>Cache: GET schedule:{teacher_id}:{week}
    alt cache hit
        Cache-->>BE: cached sessions
    else cache miss
        BE->>DB: SELECT cs.*, c.program_id, cr.name<br/>FROM tac_class_sessions cs<br/>JOIN classes c ON cs.class_id = c.id<br/>LEFT JOIN classrooms cr ON c.classroom_id = cr.id<br/>WHERE c.teacher_id = ?<br/>AND cs.start_at BETWEEN ? AND ?
        DB-->>BE: session rows
        BE->>Cache: SET schedule:{teacher_id}:{week} TTL 60s
    end
    BE-->>FE: { teacher_id, sessions[] }
    FE-->>Teacher: 캘린더 렌더링
```

---

## Scenario 6: Parent Enrolls Student to Class (학부모 수강 등록) — FN-042

```mermaid
sequenceDiagram
    actor Parent as Parent
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ

    Parent->>FE: 자녀 선택 + 강의 선택 → 수강 신청
    FE->>BE: POST /api/enrollments<br/>{ class_id, student_id }
    BE->>DB: SELECT primary_parent_id, tac_student_guardians.*<br/>WHERE student_id=?
    BE->>BE: 권한 검증:<br/>parent is primary_parent OR guardian
    alt 권한 없음
        BE-->>FE: 403 Forbidden
    else 권한 있음
        BE->>DB: BEGIN TRANSACTION
        BE->>DB: SELECT capacity, enrolled_count<br/>FROM tac_classes WHERE id=? FOR UPDATE
        BE->>DB: SELECT 1 FROM tac_enrollments<br/>WHERE class_id=? AND student_id=?
        alt 이미 등록됨
            BE->>DB: ROLLBACK
            BE-->>FE: 409 Duplicate enrollment
        else enrolled_count < capacity
            BE->>DB: INSERT INTO tac_enrollments (status='CONFIRMED')
            BE->>DB: UPDATE tac_classes SET enrolled_count = enrolled_count + 1
            BE->>DB: COMMIT
            BE->>MQ: publish enrollment.created
            BE-->>FE: 201 { enrollment_id, status='CONFIRMED' }
        else capacity 초과
            BE->>DB: INSERT INTO tac_enrollments (status='WAITLIST')
            BE->>DB: COMMIT
            BE-->>FE: 201 { enrollment_id, status='WAITLIST' }
        end
    end
```

---

## Scenario 7: AMA Teacher Sync via Webhook (교사 정보 동기화) — FN-031

```mermaid
sequenceDiagram
    participant AMA as AMA Service
    participant Hook as Sync Webhook Endpoint
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ

    Note over AMA: AMA Client 정보 수정 이벤트 발생
    AMA->>Hook: POST /api/webhooks/ama<br/>{ event: "client.updated", client_id, changes }
    Hook->>Hook: HMAC 서명 검증
    alt 서명 불일치
        Hook-->>AMA: 401 Unauthorized
    else 정상
        Hook->>MQ: publish ama.client.updated
        Hook-->>AMA: 202 Accepted
        MQ->>BE: consume ama.client.updated
        BE->>DB: SELECT id FROM tac_teachers<br/>WHERE ama_client_id=?
        alt 매핑된 teacher 없음
            BE->>BE: skip (로그만 남김)
        else 있음
            BE->>AMA: GET /clients/{client_id} (최신 full profile)
            AMA-->>BE: full client data
            BE->>DB: UPDATE tac_teachers<br/>SET cached_profile=?, last_synced_at=NOW()<br/>WHERE id=?
            opt Client 비활성화된 경우
                BE->>DB: UPDATE tac_teachers SET status='SUSPENDED'
            end
        end
    end
```

---

## Scenario 8: Portal Intake → Consultation Promotion (포털 상담 승격) — FN-114, PRC-080

```mermaid
sequenceDiagram
    actor Parent
    participant Portal as Trinity Portal<br/>(trinityacademy.kr)
    participant FE as Next.js (portal)
    participant BE as Next.js Route Handler
    participant DB as MySQL
    participant MQ as RabbitMQ
    participant Notify as AmoebaTalk Worker
    actor Staff as Academy Staff

    Parent->>Portal: Contact 폼 입력 (연락처, 관심 프로그램, 자녀 학년, 메시지)
    Parent->>Portal: 개인정보 동의 체크 + 제출
    Portal->>FE: reCAPTCHA v3 토큰 획득
    FE->>BE: POST /api/portal/intake<br/>(폼 + captcha_token)
    BE->>BE: captcha 검증 + rate limit
    alt captcha_score < 0.3
        BE->>DB: INSERT tac_consultation_intake_form (status=SPAM)
        BE-->>FE: 200 (silently accepted)
    else 정상
        BE->>DB: INSERT tac_consultation_intake_form (status=NEW)
        BE->>MQ: publish intake.created
        BE-->>FE: 201 Created
        FE-->>Parent: "상담 신청이 접수되었습니다"
        MQ->>Notify: consume intake.created
        Notify->>Notify: AmoebaTalk → 담당 Staff
    end

    Note over Staff: 관리 콘솔에서 intake 검토
    Staff->>FE: Intake 목록 조회 (관리 콘솔)
    Staff->>BE: POST /api/intake/{id}/promote
    BE->>DB: SELECT/UPSERT tac_parents (phone 매칭)
    BE->>DB: INSERT tac_consultations (parent_id, interested_program_id, ...)
    BE->>DB: UPDATE tac_consultation_intake_form<br/>SET status='PROMOTED', promoted_consultation_id=?
    BE-->>FE: { consultation_id }
```

---

## Scenario 9: MAP Assignment & Grading (MAP 시험지 배정 및 채점) — FN-074, FN-075

```mermaid
sequenceDiagram
    actor Admin as Academy Admin
    actor Student
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ
    participant Notify as AmoebaTalk Worker

    Admin->>FE: Test Set 선택 → Class에 배정 (due_at 지정)
    FE->>BE: POST /api/assignments<br/>{ test_set_id, target_type=CLASS, target_id, due_at }
    BE->>DB: INSERT assignments<br/>(snapshot은 tac_map_test_set_items.item_version_snapshot 사용)
    BE->>MQ: publish assignment.created
    MQ->>Notify: consume
    Notify->>Notify: AmoebaTalk → 학부모 "MAP 시험이 배정되었습니다"

    Note over Student: 응시 (오프라인 OMR 또는 v1.3 온라인)
    Student->>FE: 답안 제출 (관리자 입력 대행 가능)
    FE->>BE: POST /api/assignments/{id}/submit<br/>{ student_id, responses: [{item_id, answer}] }
    BE->>DB: SELECT tac_map_items.answer_keys (복수정답 배열)
    BE->>BE: 채점 (answer == answer_keys 배열 매칭)
    BE->>DB: INSERT tac_map_responses (is_correct, points_earned)
    BE->>BE: 영역별 집계 (reading/math/language)
    BE->>DB: INSERT tac_map_scores<br/>(student_id, assessed_at, reading/math/language, source='SYSTEM')
    BE->>MQ: publish map.graded
    BE-->>FE: { score_by_domain }
    MQ->>Notify: consume
    Notify->>Notify: AmoebaTalk → 학부모 "MAP 성적이 발표되었습니다"
```

---

## Scenario 10: Trinity Pay — Enrollment Payment (Toss 직결) — FN-100, FN-101, PRC-070

> **중요**: 이 시나리오에 **AMA는 등장하지 않는다.** 결제는 Trinity ↔ **Toss Payments** ↔ 학부모 사이에서만 이루어진다 (C-003 revised, A-009, A-011).

```mermaid
sequenceDiagram
    actor Parent
    participant FE as Next.js (React)<br/>+ Toss Widget SDK
    participant BE as Next.js Backend
    participant Toss as Toss Payments<br/>(Confirm + Webhook v2)
    participant DB as MySQL
    participant MQ as RabbitMQ
    participant Receipt as Receipt Worker
    participant Storage as S3 Object Storage
    participant Notify as AmoebaTalk Worker

    Parent->>FE: 수강 신청 → 결제 진행
    FE->>BE: POST /api/enrollments/{id}/pay
    BE->>BE: idempotency_key + order_no 생성
    BE->>DB: SELECT 활성 tac_pay_refund_policies.id (snapshot)
    BE->>DB: INSERT tac_pay_orders<br/>(idempotency_key, order_no, amount,<br/>refund_policy_version_id, pg_provider='TOSS', status='READY')
    BE-->>FE: { order_no, amount, clientKey, customerKey }

    FE->>FE: Toss Widget 로드<br/>@tosspayments/payment-widget-sdk
    FE->>Parent: 결제 위젯 (카드/계좌이체/가상계좌/간편결제)
    Parent->>Toss: requestPayment() → 결제창 처리
    Toss-->>FE: successUrl 리다이렉트<br/>(paymentKey, orderId, amount)

    FE->>BE: POST /api/payments/confirm<br/>{ paymentKey, orderId, amount }
    BE->>DB: SELECT tac_pay_orders<br/>WHERE order_no=? FOR UPDATE
    BE->>BE: amount 일치 검증 (위변조 방어)
    BE->>Toss: POST /v1/payments/confirm<br/>(Basic Auth: secretKey)
    Toss-->>BE: 200 { status:'DONE', method, approvedAt, ... }
    BE->>DB: UPDATE tac_pay_orders<br/>SET status='DONE', pg_payment_key=paymentKey, approved_at=?
    BE->>DB: INSERT tac_pay_ledger<br/>(entry_type='CHARGE', amount=+total)
    BE->>DB: UPDATE tac_enrollments SET status='CONFIRMED'
    BE->>MQ: publish payment.approved
    BE-->>FE: 200 OK

    Note over Toss,BE: Webhook v2 is an additional reconciliation channel
    Toss->>BE: POST /api/webhooks/toss<br/>(TossPayments-Signature)
    BE->>BE: HMAC 서명 검증
    BE->>DB: SELECT tac_pay_orders WHERE pg_payment_key=? FOR UPDATE
    alt 이미 DONE (idempotent)
        BE-->>Toss: 200 OK
    else status drift (Confirm 미성공/PG 변경)
        BE->>DB: UPDATE status to match Toss
        BE->>MQ: publish payment.{approved|canceled|expired}
        BE-->>Toss: 200 OK
    end

    MQ->>Receipt: consume payment.approved
    Receipt->>Receipt: 간이/현금영수증 요청 시 PDF 생성
    Receipt->>Storage: PUT /receipts/{order_no}.pdf
    Receipt->>DB: INSERT tac_pay_receipts (receipt_type='CASH_RECEIPT'|'SIMPLE')

    MQ->>Notify: consume payment.approved
    Notify->>Notify: AmoebaTalk → 학부모<br/>"결제가 완료되었습니다"
```

---

## Scenario 11: Session Recording with Color Code (수업 회차 기록 — 초록/빨강) — FN-082, PRC-060

```mermaid
sequenceDiagram
    actor Teacher
    participant FE as Frontend (React/Next.js)
    participant BE as Next.js Backend
    participant DB as MySQL
    participant MQ as RabbitMQ

    Teacher->>FE: Teacher Timetable 화면 진입
    FE->>BE: GET /api/timetable/teacher/{id}?week=2026-04-19
    BE->>DB: SELECT tac_class_sessions + tac_classes + tac_students<br/>WHERE teacher_id=? AND week=?
    BE-->>FE: sessions[] (status/color/duration)
    FE-->>Teacher: 그리드 렌더링<br/>🟢 HELD / 🔴 CANCELLED / 🟣 MAKEUP

    alt 수업 정상 진행
        Teacher->>FE: 세션 '진행 완료' + actual_duration 입력 (0.5h 단위)
        FE->>BE: PATCH /api/sessions/{id}<br/>{ session_status=HELD, actual_duration_hours=2.0 }
        BE->>BE: actual_duration % 0.5 == 0 검증 (A-007)
        BE->>DB: UPDATE tac_class_sessions
        BE-->>FE: 🟢 (green)
    else 결강
        Teacher->>FE: '결강' 체크 + cancel_reason 입력
        FE->>BE: PATCH /api/sessions/{id}<br/>{ session_status=CANCELLED, cancel_reason }
        BE->>DB: UPDATE tac_class_sessions (actual_duration=0)
        BE->>MQ: publish session.cancelled
        BE-->>FE: 🔴 (red)
    end

    opt 보강 생성
        Teacher->>FE: 보강 세션 추가
        FE->>BE: POST /api/sessions<br/>{ class_id, start_at, end_at, session_status=MAKEUP, makeup_of_session_id }
        BE->>DB: INSERT tac_class_sessions (FK makeup_of_session_id)
        BE-->>FE: 🟣 (purple, MAKEUP)
    end
```

---

## Scenario 12: Refund — Session-based (수업일 기준 환불) — FN-102, PRC-075

> 환불율은 결제 시점 snapshot 된 `tac_pay_orders.refund_policy_version_id` 의 tier table 로 계산한다 (A-012).
> 학원법 시행령 제18조 3단계 기본값: `0 → 100%`, `≤1/3 → 66.67%`, `≤1/2 → 50%`, `>1/2 → 0%`.

```mermaid
sequenceDiagram
    actor Parent
    actor Admin
    participant FE as Next.js Admin
    participant BE as Refund Service
    participant DB as MySQL
    participant Toss as Toss Payments
    participant MQ as RabbitMQ
    participant TaxSvc as Tax Invoice Service
    participant Notify as AmoebaTalk Worker

    Parent->>Admin: 환불 요청 (전화/방문)
    Admin->>FE: 환불 요청 접수 → tac_counseling_records (topic=REFUND_REQUEST)
    Admin->>FE: 환불 심사 화면 진입<br/>(payment_order_id)
    FE->>BE: GET /api/refunds/calc?paymentOrderId=
    BE->>DB: SELECT po.*, enrollment, tac_class_sessions<br/>→ held_count, total_count
    BE->>BE: elapsed_ratio = held / total
    BE->>DB: SELECT tac_pay_refund_policy_tiers<br/>WHERE policy_id = po.refund_policy_version_id<br/>AND min < :r AND :r <= max
    DB-->>BE: tier { refund_rate, tier_order, note }
    BE-->>FE: { elapsed_ratio, tier, refund_amount, remaining }

    Admin->>FE: 금액 확인/조정 후 승인
    FE->>BE: POST /api/refunds<br/>{ paymentOrderId, refundAmount, reason }
    BE->>DB: BEGIN TX + SELECT tac_pay_orders FOR UPDATE
    BE->>Toss: POST /v1/payments/{paymentKey}/cancel<br/>{ cancelAmount, cancelReason }
    alt 승인
        Toss-->>BE: 200 { status:'CANCELED'|'PARTIAL_CANCELED', cancels:[...] }
        BE->>DB: UPDATE tac_pay_orders SET status=?
        BE->>DB: INSERT tac_pay_ledger<br/>(entry_type='REFUND', amount=-refund,<br/>refund_tier_id, elapsed_ratio_at_refund)
        alt 전액 취소
            BE->>DB: UPDATE tac_enrollments SET status='WITHDRAWN'
        end
        BE->>MQ: publish payment.refunded
        BE-->>FE: 200 { ledger_id }
    else 거부 (경과 > 1/2, refund_rate=0)
        BE-->>FE: 422 "refund_rate=0, 환불 불가"
    end

    opt 세금계산서 발행 건
        MQ->>TaxSvc: consume payment.refunded
        TaxSvc->>TaxSvc: 수정 세금계산서 생성 (공급가 음수)
        TaxSvc->>Toss: (No-op, Tax side only)
        Note over TaxSvc: Scenario 13 의 수정 발행 플로우 재사용
    end

    MQ->>Notify: consume payment.refunded
    Notify->>Parent: AmoebaTalk "환불 처리 완료<br/>(경과 {ratio}, 적용 {tier}, 금액 {amount})"
```

---

## Scenario 13: Tax Invoice Issuance — NTS Hometax eTax 직결 — FN-106, PRC-076

> 팝빌/바로빌 등 SaaS 중계 없이 **국세청 홈택스 전자세금계산서 발급 API** 에 직접 제출한다 (A-013).
> 공동인증서는 서버 HSM/KMS 에 보관하고 XML 전자서명 시에만 언커버된다.

```mermaid
sequenceDiagram
    actor Staff
    actor Buyer as 학부모/사업자
    participant FE as Next.js Admin
    participant BE as Tax Invoice Service
    participant DB as MySQL
    participant HSM as HSM/KMS<br/>(공동인증서)
    participant NTS as 국세청 홈택스<br/>eTax API
    participant Storage as S3 Object Storage
    participant Notify as AmoebaTalk/Email Worker

    Staff->>FE: 세금계산서 발행 요청<br/>(paymentOrderId, 공급받는자 정보)
    FE->>BE: POST /api/tax-invoices<br/>{ payment_order_id, buyer_biz_no, buyer_email, ... }
    BE->>DB: SELECT tac_pay_orders WHERE status='DONE'
    BE->>DB: INSERT tac_pay_tax_invoices (status='DRAFT',<br/>invoice_no, supply, tax, total, issue_date)
    BE->>BE: 전자세금계산서 XML 생성<br/>(NTS 표준 스키마)
    BE->>HSM: sign(xml, certKey)
    HSM-->>BE: signedXml (XMLDSig)

    BE->>Storage: PUT /tax/{invoice_no}.xml (signed)
    Storage-->>BE: xml_url
    BE->>DB: UPDATE tac_pay_tax_invoices SET status='SUBMITTED', xml_payload_url=?, nts_submitted_at=NOW()

    BE->>NTS: POST /etax/issueTaxInvoice<br/>(signedXml)
    alt 승인
        NTS-->>BE: 200 { ntsIssueNo, approvedAt }
        BE->>DB: UPDATE tac_pay_tax_invoices<br/>SET status='APPROVED', nts_issue_no=?, nts_approved_at=?
        BE->>BE: PDF 렌더링 (구매자 교부용)
        BE->>Storage: PUT /tax/{invoice_no}.pdf
        BE->>DB: UPDATE tac_pay_tax_invoices SET pdf_url=?
        BE->>Notify: enqueue tax.issued
        Notify->>Buyer: 이메일 + AmoebaTalk<br/>"세금계산서 발행 ({nts_issue_no})"
    else 반려
        NTS-->>BE: 4xx/5xx { errorCode, errorMessage }
        BE->>DB: UPDATE tac_pay_tax_invoices<br/>SET status='REJECTED', nts_error_code/message
        BE->>Notify: enqueue tax.failed → Staff 재시도 큐
    end

    Note over BE,NTS: 배치: 매월 5일 status != APPROVED<br/>AND supply_month = prev_month 조회 → 경고 (NFR-013)
```

