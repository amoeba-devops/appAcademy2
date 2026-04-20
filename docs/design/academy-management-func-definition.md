---
document_id: ACADEMY-FUNC-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-19
updated: 2026-04-19
author: 김익용
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-19
    author: 김익용
    description: Initial functional specification
  - version: 1.2.0
    date: 2026-04-19
    author: 김익용
    description: |
      Rebranded to Trinity Academy. Added Question Bank (FN-070~079), Timetable (FN-080~084),
      Student Extensions (FN-090~094), Trinity Pay (FN-100~109), Main Portal (FN-110~115) modules.
      Stack updated: Vue.js → React 18 + Next.js 14 (shared portal + admin).
  - version: 1.3.0
    date: 2026-04-19
    author: 김익용
    description: |
      Trinity Pay decisions closed (Toss / 수업일 기준 환불 / 자체 세금계산서):
      FN-100 concretized with refund_policy_version_id snapshot at order creation.
      FN-101 split into Confirm API call and Webhook reconciliation (Toss-specific status mirror).
      FN-102 detailed with session-based elapsed_ratio & tier lookup (학원법 시행령 제18조 default).
      Added FN-106 (Tax Invoice Self-Issuance via NTS Hometax eTax API),
      FN-107 (Refund Policy Administration with versioning).
---

# Trinity Academy — Functional Specification (트리니티 아카데미 기능 정의서)

본 문서는 요구사항 분석서(ACADEMY-REQ-1.2.0)의 FR-xxx를 모듈/기능 단위로 상세화한다.

## Module Map (모듈 구성)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Trinity Academy Management System                          │
├──────────────────────────── Main Portal (Public) ─────────────────────────────┤
│  Home │ About │ Programs │ MAP Test │ Contact │ News        FR-043~046       │
├──────────────────────────── Admin Console ────────────────────────────────────┤
│ Program │ Consultation │ People  │ Class     │ Timetable │ Question Bank     │
│ FR-001~3│ FR-004~006   │FR-007~10│FR-011~016 │ FR-029~033│ FR-021~028        │
├────────┬─────────────┬─────────────┬───────────────┬──────────────────────────┤
│Enroll  │ Attendance  │ Trinity Pay │ Student Ext.  │ Report / Dashboard       │
│FR-014~5│ FR-016      │ FR-039~042  │ FR-034~038    │ FR-018                   │
├──────────────────────────── Integration Adapters ─────────────────────────────┤
│ AMA Sync (Teacher, Notification) │ PG Gateway (Toss/KG/NHN) │ AmoebaTalk      │
│ FR-009~010, FR-019               │ FR-039~040               │ FR-019          │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Module: Program (프로그램 모듈)

### FN-001: Create Program (프로그램 생성)
- **Function ID**: FN-001
- **Related**: FR-001, FR-002
- **Description**: 학원 운영자가 새로운 커리큘럼 프로그램 템플릿을 등록한다.
- **Pre-condition**: 로그인 사용자가 학원장(Admin) 또는 행정 직원(Staff) 권한
- **Post-condition**: `tac_programs` 테이블에 `status=DRAFT` 레코드 생성, `tac_program_settings`에 기본 설정 생성
- **Processing Logic**:
  1. 필수 필드(name, category, duration_weeks) 검증
  2. academy_id 자동 주입 (세션 컨텍스트)
  3. `tac_programs` insert, `tac_program_settings` insert (FK: program_id)
  4. Audit log 기록
- **Input Parameters**:
  - `name: string (required, max 100)`
  - `category: enum (MATH, LANG, MUSIC, ART, PE, OTHER)` [TBD 분류 체계]
  - `description: text`
  - `duration_weeks: int`
  - `target_age_min / target_age_max: int`
  - `level: enum (BEGINNER, INTERMEDIATE, ADVANCED)`
- **Output**: `{ program_id, status: DRAFT }`
- **Error Handling**:
  - 필수 필드 누락 → 400 ValidationError
  - 권한 부족 → 403 Forbidden
  - 동일 academy 내 중복 이름 → 409 Conflict

### FN-002: Update Program Setting (프로그램 설정)
- **Function ID**: FN-002
- **Related**: FR-002
- **Description**: 프로그램별 상세 설정(수강료, 정원, 회차, 교재, 환불 정책)을 업데이트
- **Pre-condition**: Program 존재, 상태 `DRAFT` 또는 `ACTIVE`
- **Processing Logic**:
  1. `tac_program_settings` upsert
  2. 상태 `DRAFT` → `ACTIVE` 승격 시 필수 항목 검증 (fee, capacity, session_count)
- **Input**: `{ program_id, fee_amount, fee_currency, capacity_max, session_count, material_info, refund_policy }`
- **Output**: `{ program_id, settings }`

### FN-003: Publish Program (프로그램 공개)
- **Function ID**: FN-003
- **Related**: FR-003
- **Description**: 학부모 카탈로그에 노출되도록 상태를 `PUBLISHED`로 변경
- **Pre-condition**: `status = ACTIVE`, 필수 설정 완료
- **Post-condition**: Catalog 뷰에서 조회 가능

---

## Module: Consultation (상담 모듈)

### FN-010: Create Consultation (상담 접수)
- **Function ID**: FN-010
- **Related**: FR-004, FR-005
- **Description**: 학부모로부터의 상담 요청을 접수
- **Pre-condition**: 상담 접수 채널에서 유입
- **Post-condition**: `tac_consultations` 레코드 생성 (`status=OPEN`)
- **Processing Logic**:
  1. 전화번호/이메일 기준으로 기존 Parent 조회 (upsert)
  2. 관심 프로그램 (`interested_program_id`) 연결
  3. 상담 담당자(assignee) 자동 또는 수동 배정
  4. 이벤트 발행: `consultation.created` (RabbitMQ)
- **Input**:
  - `parent_contact: { name, phone, email }` (required)
  - `interested_program_id: bigint` (optional)
  - `student_profile_hint: { name, birth_year, note }` (optional)
  - `channel: enum (PHONE, ONLINE, VISIT, REFERRAL)`
  - `note: text`
- **Output**: `{ consultation_id, parent_id, status }`
- **Error Handling**:
  - 전화번호 형식 오류 → 400
  - 동일 학부모 24시간 내 동일 프로그램 중복 상담 → warning (생성은 허용, [TBD])

### FN-011: Record Visit (방문 기록)
- **Function ID**: FN-011
- **Related**: FR-006
- **Description**: 학부모 학원 방문 일정/결과를 이력으로 누적
- **Processing Logic**:
  1. `tac_visit_records` insert (consultation_id FK)
  2. 예약 방문이면 `scheduled_at` 지정, 실제 방문은 `visited_at` 기록
  3. 결과(outcome)에 따라 상담 상태 자동 업데이트 — `CONVERTED`, `LOST`, `FOLLOW_UP`
- **Input**: `{ consultation_id, scheduled_at, visited_at, outcome, handler_user_id, memo }`
- **Output**: `{ visit_id, consultation_status }`

### FN-012: Convert Consultation to Enrollment (상담→등록 전환)
- **Function ID**: FN-012
- **Related**: FR-017
- **Description**: 상담 건을 실제 학생 등록/수강까지 이어지도록 연결
- **Pre-condition**: Consultation `status=OPEN` 또는 `FOLLOW_UP`
- **Processing Logic**:
  1. Parent 엔티티 확정 (temp → permanent)
  2. Student 생성 (FN-022)
  3. Class 선택 및 Enrollment 생성 (FN-042)
  4. Consultation `status=CONVERTED`, `converted_enrollment_id` 업데이트
- **Output**: `{ parent_id, student_id, enrollment_id }`

---

## Module: People (인적 모듈 — Parent / Student / Teacher)

### FN-020: Register Parent (학부모 등록)
- **Function ID**: FN-020
- **Related**: FR-007
- **Processing Logic**:
  1. `tac_parents` upsert (phone/email 기준 unique)
  2. 개인정보 항목(연락처)은 암호화 컬럼 저장 (NFR-005)
- **Input**: `{ name, phone, email, preferred_channel, address_hint }` ([TBD] 주소 보관 수준)

### FN-022: Register Student (학생 등록)
- **Function ID**: FN-022
- **Related**: FR-008
- **Description**: 학생 등록 시 반드시 학부모(`primary_parent_id`)와 연결한다.
- **Pre-condition**: Parent 존재 (FN-020)
- **Processing Logic**:
  1. `tac_students` insert with `primary_parent_id`
  2. 공동 보호자가 있으면 `tac_student_guardians` (M:N) 에 추가
  3. 나이/학년 자동 계산 캐시 컬럼 갱신
- **Input**: `{ primary_parent_id, name, birth_date, gender, school, grade, note }`
- **Output**: `{ student_id }`
- **Error Handling**: 학부모 미존재 → 422 Unprocessable

### FN-030: Register Teacher (교사 등록)
- **Function ID**: FN-030
- **Related**: FR-009
- **Description**: 교사 등록은 **AMA Client ID를 반드시 참조**한다. 본 시스템에 교사 마스터 데이터를 중복 저장하지 않는다.
- **Pre-condition**: AMA에 Client 레코드가 존재해야 함
- **Processing Logic**:
  1. 입력된 `ama_client_id`로 AMA API 호출하여 Client 존재/유형 검증 (`type=INDIVIDUAL` 또는 교사 허용 분류)
  2. `tac_teachers` insert: `{ ama_client_id, academy_id, teaching_subjects, employment_type, status }`
  3. 이름/연락처 등 AMA 원본 필드는 **저장하지 않고 조회 시 proxy**
- **Input**: `{ ama_client_id, teaching_subjects[], employment_type: enum(FULL_TIME, PART_TIME, FREELANCE), hourly_rate_hint }`
- **Output**: `{ teacher_id, ama_client_snapshot }`
- **Error Handling**:
  - AMA API 실패 → 503 with retry guidance
  - Client 미존재 → 404
  - 동일 ama_client_id 중복 등록 → 409

### FN-031: Sync Teacher from AMA (교사 정보 동기화)
- **Function ID**: FN-031
- **Related**: FR-010
- **Description**: AMA의 Client 정보가 바뀌면 로컬 캐시(표시용)를 업데이트한다. 원천은 AMA.
- **Processing Logic** (Webhook 방식 가정, [TBD]):
  1. AMA → `client.updated` Webhook 수신
  2. 매핑된 teacher 레코드의 `last_synced_at` 업데이트
  3. 변경 필드(name, phone 등) 캐시 컬럼 반영
  4. 주요 변경(비활성화 등) 시 `tac_teachers.status=SUSPENDED` 자동 전이

---

## Module: Class (강의 모듈)

### FN-040: Create Class (강의 개설)
- **Function ID**: FN-040
- **Related**: FR-011
- **Description**: Program에서 구체 강의(특정 교사, 요일/시간, 강의실)를 개설한다.
- **Pre-condition**: Program `status=PUBLISHED` 또는 `ACTIVE`, Teacher `status=ACTIVE`
- **Processing Logic**:
  1. `tac_classes` insert: `{ program_id, teacher_id, classroom_id, start_date, end_date, capacity }`
  2. `tac_class_sessions` 자동 생성 — program_setting의 `session_count` × 요일/시간 패턴에 따라 회차 레코드 일괄 생성
  3. 스케줄 충돌 검증 (FN-041)
- **Input**: `{ program_id, teacher_id, classroom_id, schedule: [{ weekday, start_time, end_time }], start_date, capacity }`
- **Output**: `{ class_id, generated_session_count }`

### FN-041: Schedule Conflict Check (스케줄 충돌 검증)
- **Function ID**: FN-041
- **Related**: FR-013
- **Processing Logic**:
  1. 동일 교사의 동일 시간대 강의 존재 여부 검사
  2. 동일 강의실의 동일 시간대 예약 검사
  3. 충돌 시 409 Conflict with detail
- **Output**: `{ conflicts: [{ type, existing_class_id, time }] }`

### FN-042: Create Enrollment (수강 등록)
- **Function ID**: FN-042
- **Related**: FR-014, FR-015
- **Description**: 학부모가 자녀(학생)를 특정 Class에 등록
- **Pre-condition**:
  - Student 존재 (FN-022)
  - Class `status=OPEN_FOR_ENROLLMENT`
  - Class 정원 미충족 (`enrolled_count < capacity`)
- **Processing Logic**:
  1. Enrollment insert: `{ class_id, student_id, status=PENDING, applied_by_parent_id }`
  2. 정원 여유 확인 후 `status=CONFIRMED`으로 자동 전이 (혹은 결제 완료 후, [TBD])
  3. 이벤트 발행: `enrollment.created`
  4. 정원 초과 시 `status=WAITLIST`
- **Output**: `{ enrollment_id, status }`
- **Error Handling**:
  - 중복 등록 (동일 student_id + class_id) → 409
  - Student-Parent 불일치 (applied_by_parent_id가 student의 primary_parent도 공동보호자도 아님) → 403

### FN-043: Manage Enrollment Status (수강 상태 관리)
- **Function ID**: FN-043
- **Related**: FR-015
- **State Machine**:
  ```
  PENDING ─▶ CONFIRMED ─▶ IN_PROGRESS ─▶ COMPLETED
     │           │              │
     ▼           ▼              ▼
  CANCELED   CANCELED      WITHDRAWN
                │
                ▼
           WAITLIST (if capacity exceeded)
  ```
- **Business Rules**:
  - `CONFIRMED` 전이는 정원 여유 필수
  - `CANCELED`로 전이 시 환불 정책(FN-002의 refund_policy) 참조 필요 [TBD]
  - `COMPLETED`는 마지막 session 완료 후 배치 작업으로 자동 전이

### FN-050: Teacher Schedule View (교사 스케줄 조회)
- **Function ID**: FN-050
- **Related**: FR-012
- **Description**: 교사별 담당 강의/세션을 캘린더 형태로 조회
- **Input**: `{ teacher_id, date_from, date_to }`
- **Output**:
  ```json
  {
    "teacher_id": 123,
    "sessions": [
      { "session_id": 9001, "class_id": 501, "program_name": "초등 수학 심화",
        "start_at": "2026-04-22T15:00:00+09:00", "end_at": "2026-04-22T16:30:00+09:00",
        "classroom": "A-2", "enrolled_count": 8, "capacity": 10 }
    ]
  }
  ```

### FN-060: Attendance (출석 체크)
- **Function ID**: FN-060
- **Related**: FR-016
- **Description**: 강의 회차별 학생 출결 기록
- **Processing Logic**:
  1. `tac_attendances` upsert: `{ session_id, student_id, status: enum(PRESENT, ABSENT, LATE, EARLY_LEAVE) }`
  2. 연속 결석 N회 시 Parent 알림 트리거 ([TBD] 임계값)
- **Input**: `{ session_id, entries: [{ student_id, status, memo }] }`
- **Output**: `{ session_id, recorded_count }`

---

## Module: Question Bank — MAP (문제은행 모듈)

### FN-070: Register Passage (지문 등록)
- **Function ID**: FN-070
- **Related**: FR-023
- **Description**: MAP RC 지문을 등록한다. 단일 지문 또는 Passage 1/2 쌍 구조 지원.
- **Pre-condition**: 콘텐츠 담당자 권한(`role=CONTENT_EDITOR` 또는 상위)
- **Processing Logic**:
  1. `tac_map_passages` insert — `title, body, source, grade_level, pair_group_id(nullable)`
  2. 이미지/삽화는 Object Storage 업로드 후 `tac_map_passage_assets`에 FK
  3. 버전 `version=1`, `status=DRAFT`
- **Input**: `{ title, body, grade_level, domain: 'RC', pair_group_id?, assets?: [{ url, alt }] }`
- **Output**: `{ passage_id, version }`

### FN-071: Register Item (문항 등록)
- **Function ID**: FN-071
- **Related**: FR-021, FR-022, FR-024
- **Description**: MAP 문항(단일/복수 정답, Part A-B) 등록
- **Processing Logic**:
  1. `tac_map_items` insert — `{ domain(RC/Math/Language), grade_level, difficulty, type(SINGLE/MULTI/PART_AB), passage_id?, parent_item_id?(Part B), stem, options, answer_keys[], explanation, points, tags[] }`
  2. `answer_keys`는 JSON 배열로 복수 정답 지원 (A-006)
  3. Taxonomy 태그는 `tac_map_item_tags` M:N 연결
- **Input**: 위 필드
- **Output**: `{ item_id, version }`

### FN-072: Version Item (문항 버전 관리)
- **Function ID**: FN-072
- **Related**: FR-028
- **Description**: 문항 수정 시 기존 배정된 시험지의 스냅샷을 보존하고 새 버전 생성
- **Processing Logic**:
  1. 기존 `tac_map_items`의 `status='ARCHIVED'`, 신규 row `version+1` 생성
  2. `tac_map_test_set_items` 스냅샷(`item_version_snapshot`)은 이전 버전을 참조 유지

### FN-073: Compose Test Set (시험지 구성)
- **Function ID**: FN-073
- **Related**: FR-025
- **Description**: 고정 배열 또는 조건 기반(영역·학년·난이도) 자동 생성으로 Test Set 구성
- **Input (auto mode)**: `{ name, filters: { domain, grade_level, difficulty, tags[] }, target_count, seed? }`
- **Output**: `{ test_set_id, item_count }`

### FN-074: Assign Test Set (시험지 배정)
- **Function ID**: FN-074
- **Related**: FR-026
- **Description**: 특정 Class 또는 개별 Student에게 응시 기한 지정하여 배정
- **Processing Logic**:
  1. `tac_map_assignments` insert per target — `{ test_set_id, target_type: CLASS|STUDENT, target_id, due_at }`
  2. 학부모 알림 트리거(AmoebaTalk)

### FN-075: Submit & Grade (응시 및 자동 채점)
- **Function ID**: FN-075
- **Related**: FR-027
- **Processing Logic**:
  1. `tac_map_responses` insert per item
  2. `answer_keys` 비교 — 복수 정답/Part A-B 모두 일치해야 정답
  3. 영역별 점수 집계 → `tac_map_scores` 이력 insert (FR-034)
- **Output**: `{ assignment_id, score_by_domain, item_correctness[] }`

### FN-076: MAP Score History (MAP 성적 이력 조회)
- **Function ID**: FN-076
- **Related**: FR-034
- **Description**: 학생별 시계열 MAP 점수 (Reading/Math/Language) 조회

---

## Module: Timetable (수업시간표 모듈)

> **Note**: 별도 테이블 없음. `tac_classes + tac_class_sessions`의 파생 뷰로 구현 (C-006).

### FN-080: Academy Timetable View (학원 전체 시간표)
- **Function ID**: FN-080
- **Related**: FR-029
- **Description**: 요일×시간 그리드. 강의실/교사 필터
- **Input**: `{ academy_id, week_of_date, filter?: { teacher_id?, classroom? } }`
- **Output**: 2D 그리드 JSON — cell당 `{ class_id, program_name, teacher, classroom, status }`

### FN-081: Teacher Timetable View (교사 시간표)
- **Function ID**: FN-081
- **Related**: FR-030
- **Description**: 교사 단위 주간/월간. 색상 코드: 초록=진행, 빨강=결강, 보강은 별도 marker
- **Output**: `sessions[]` with `status_color`, `actual_duration_hours`, `memo`

### FN-082: Record Session (회차 기록)
- **Function ID**: FN-082
- **Related**: FR-032
- **Processing Logic**:
  1. `tac_class_sessions` upsert — `{ class_id, session_date, planned_duration, actual_duration(0.5h 단위, A-007), status(HELD/CANCELLED/MAKEUP), memo }`
  2. 결강 시 `cancel_reason` 필수
- **Validation**: `actual_duration % 0.5 == 0`

### FN-083: Makeup Session (보강 연결)
- **Function ID**: FN-083
- **Related**: FR-033
- **Description**: 결강 회차에 보강 세션을 연결. Q-013 미해결 시 N:N 허용

### FN-084: Student Timetable (학생 개인 시간표)
- **Function ID**: FN-084
- **Related**: FR-031
- **Description**: v1.2 이후. 학생이 등록된 모든 Class의 회차 통합 뷰

---

## Module: Student Extensions (학생 마스터 확장)

### FN-090: External Test Scores (외부 시험 점수 관리)
- **Function ID**: FN-090
- **Related**: FR-035
- **Description**: SSAT/ISEE/GPA 등 점수를 `tac_external_test_scores` 테이블에 저장

### FN-091: Counseling Record (상담 이력)
- **Function ID**: FN-091
- **Related**: FR-036
- **Description**: 학생별 상담 누적 이력 `tac_counseling_records`

### FN-092: Student Lifecycle (학생 라이프사이클 전이)
- **Function ID**: FN-092
- **Related**: FR-037
- **Processing Logic**: `tac_students.lifecycle_status`: CONSULTING → ENROLLED → ACTIVE → TERMINATED. 전이 시 이벤트 로그

### FN-094: Excel Import (엑셀 일괄 마이그레이션)
- **Function ID**: FN-094
- **Related**: FR-038
- **Description**: TPI xlsx / 수업 확인표 xlsx 업로드 → 매핑 미리보기 → 검증 → 커밋
- **Processing Logic**:
  1. Upload to Object Storage, parse with SheetJS
  2. Row 검증 (필수 필드, FK), 실패율 표시
  3. 관리자 승인 후 일괄 insert (transaction)

---

## Module: Trinity Pay (결제/정산 모듈)

### FN-100: Create Payment Order (결제 주문 생성)
- **Function ID**: FN-100
- **Related**: FR-039, A-011
- **Pre-condition**: Enrollment `status=PENDING_PAYMENT`
- **Processing Logic**:
  1. `order_no` 채번 (학원별 연월-일련번호), `idempotency_key` UUID 생성
  2. **현재 활성 `tac_pay_refund_policies.id`** (WHERE academy_id=? AND effective_from ≤ TODAY AND (effective_to IS NULL OR effective_to > TODAY)) 를 **snapshot**  으로 참조
  3. `tac_pay_orders` insert — `{ enrollment_id, amount, currency='KRW', idempotency_key, order_no, pg_provider='TOSS', status='READY', refund_policy_version_id }`
  4. Toss Widget 로드에 필요한 정보 반환: `{ order_no, amount, clientKey, customerKey }` (customerKey = 학부모 식별 해시)

### FN-101: Handle Toss Confirm & Webhook (결제 승인 + Webhook 수신)
- **Function ID**: FN-101
- **Related**: FR-040, A-011
- **Two entry points**:
  1. **Confirm API (동기)**:
     - successUrl 리다이렉트 수신 → `POST /v1/payments/confirm` (Basic Auth: `secretKey`)
     - 응답의 `totalAmount` 과 `tac_pay_orders.amount` 일치 검증 (위변조 방어)
     - `status='DONE'`, `pg_payment_key=paymentKey`, `approved_at` 저장
     - `tac_pay_ledger` CHARGE insert, `enrollments.status='CONFIRMED'`
     - RabbitMQ `payment.approved` publish
  2. **Webhook v2 (비동기 reconcile)**:
     - 서명 헤더 `TossPayments-Signature` HMAC 검증
     - `idempotency_key` / `pg_payment_key` 기준 `SELECT ... FOR UPDATE`
     - Toss status (DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED) 를 그대로 mirror
     - Confirm 에서 이미 DONE 이면 멱등 처리, 불일치 시 drift 보정
- **Criteria**: Webhook 수신 → 수강 상태 반영 P95 < 5초 (KPI)

### FN-102: Refund — Session-based (환불 계산/집행)
- **Function ID**: FN-102
- **Related**: FR-041, PRC-075, A-012, NFR-013
- **Pre-condition**: 관리자 승인 (`role=ACADEMY_ADMIN` 이상), `tac_pay_orders.status IN ('DONE','PARTIAL_CANCELED')`
- **Processing Logic**:
  1. `elapsed_ratio = held_session_count / total_session_count` 계산 (holds by tac_class_sessions.status='HELD' AND ended_at ≤ NOW)
  2. `tac_pay_refund_policy_tiers` 에서 `policy_id = tac_pay_orders.refund_policy_version_id` 조건으로 해당 tier 조회 — `min < elapsed_ratio ≤ max`
  3. `refund_amount = FLOOR(tac_pay_orders.amount × tier.refund_rate)`
  4. 관리자 UI에 `{ elapsed_ratio, tier_note, refund_amount, remaining }` 제시
  5. 승인 후 Toss `POST /v1/payments/{paymentKey}/cancel` 호출 (`cancelAmount`, `cancelReason`)
  6. `tac_pay_orders.status` 를 Toss 응답의 `status` 로 mirror
  7. `tac_pay_ledger` insert — `{ entry_type='REFUND', amount=-refund_amount, refund_tier_id, elapsed_ratio_at_refund }`
  8. 전액 취소 시 `tac_enrollments.status='WITHDRAWN'`, 세금계산서 발행분이면 FN-106 (수정 세금계산서) 호출
- **Default tiers (학원법 시행령 제18조)**: `0→100%`, `≤1/3→66.67%`, `≤1/2→50%`, `>1/2→0%`

### FN-103: Issue Cash Receipt (간이/현금영수증 발급)
- **Function ID**: FN-103
- **Related**: FR-042
- **Description**: 결제 완료 시 간이영수증 PDF 생성 또는 현금영수증(국세청 발급번호) 기록. 세금계산서는 FN-106 으로 분리.

### FN-104: Payment Ledger Query (결제 원장 조회)
- **Function ID**: FN-104
- **Related**: FR-042
- **Description**: 기간별·학생별·프로그램별 결제 원장(ledger) 집계 조회. 환불 내역은 `refund_tier_id` + `elapsed_ratio_at_refund` 로 감사 가능.

### FN-106: Issue Tax Invoice (세금계산서 자체 발행) ★ v1.3 신규
- **Function ID**: FN-106
- **Related**: FR-048, PRC-076, A-013, NFR-013
- **Pre-condition**: `tac_pay_orders.status='DONE'`, 공급받는자 정보 확보
- **Processing Logic**:
  1. `tac_pay_tax_invoices` DRAFT insert — invoice_no 채번, 공급가액/부가세(10%) 산정
  2. 국세청 표준 스키마에 맞춘 전자세금계산서 XML 생성
  3. 서버 HSM/KMS 에 격리된 공동인증서로 XML 전자서명 (XMLDSig)
  4. `POST /etax/issueTaxInvoice` (국세청 홈택스 eTax API) 호출
  5. 승인 응답 `ntsIssueNo` / `approvedAt` 수령 → `status='APPROVED'`
  6. 구매자용 PDF 렌더링 후 S3 업로드, 이메일/AmoebaTalk 전송
  7. 반려(`REJECTED`) 시 `nts_error_code/message` 저장, Staff 재시도 큐
- **Legal Deadline (NFR-013)**: `approved_at` 익월 10일까지 NTS 전송 완료. 배치 5일 경고.
- **수정 세금계산서**: 환불(FN-102) 시 공급가액 음수 건을 추가로 발행.

### FN-107: Refund Policy Administration (환불 규정 관리) ★ v1.3 신규
- **Function ID**: FN-107
- **Related**: FR-047, A-012
- **Role**: `ACADEMY_ADMIN` 이상
- **Processing Logic**:
  1. 학원 생성 시 `is_default_template=1` 인 학원법 시행령 제18조 기본 정책이 자동 seed (version=1)
  2. 관리자가 새 버전 생성 → `tac_pay_refund_policies` insert (version = MAX+1, `effective_from = 미래 일자`)
  3. tier 편집 UI — `elapsed_ratio_min/max` 가 겹치지 않도록 검증, `refund_rate` 는 학원법 하한보다 낮게 설정 불가 (NFR-013)
  4. 활성화 시 직전 버전의 `effective_to` 자동 세팅
  5. 과거 결제에는 소급되지 않음 — `tac_pay_orders.refund_policy_version_id` 가 발행 시점 snapshot
  6. 감사 로그: version 생성/활성/비활성 이벤트는 `audit_log` 에 기록

---

## Module: Main Portal (Trinity Academy 메인 포털)

### FN-110: Portal Home (메인 홈)
- **Function ID**: FN-110
- **Related**: FR-043
- **Description**: Trinity Heraldic hero + Programs 하이라이트 + MAP Test CTA + News 3건. SSG + ISR 60s.

### FN-111: About Page
- **Function ID**: FN-111
- **Description**: 학원 소개, 교훈(OMNIBUS OMNIA), 연혁, 교사진 프로필(AMA Client에서 `is_public=true` 필터)

### FN-112: Programs Public Catalog
- **Function ID**: FN-112
- **Related**: FR-046, FR-003
- **Description**: 공개 프로그램 카탈로그 + 상세 + 수강 신청 CTA → Enrollment Flow 진입

### FN-113: MAP Test Info Page
- **Function ID**: FN-113
- **Related**: FR-045
- **Description**: MAP Test 소개, 응시 절차, 샘플 문항 미리보기, 등급표

### FN-114: Contact (Consultation Request)
- **Function ID**: FN-114
- **Related**: FR-044, FR-004
- **Description**: 학부모 상담 신청 폼 제출 → `tac_consultations` insert + AmoebaTalk 알림
- **Input**: `{ parent_name, phone, child_grade, program_interest, preferred_date, message, consent_pi }`
- **Validation**: reCAPTCHA v3, 개인정보 동의 필수

### FN-115: News / Announcements
- **Function ID**: FN-115
- **Description**: 공지·뉴스 게시판 (헤드리스 CMS 또는 자체 `tac_posts` — Q-017 미해결)

---

## Cross-Reference Matrix (요구사항 ↔ 기능 매트릭스)

| FR | FN |
|----|----|
| FR-001 | FN-001 |
| FR-002 | FN-001, FN-002 |
| FR-003 | FN-003, FN-112 |
| FR-004 | FN-010, FN-114 |
| FR-005 | FN-010 |
| FR-006 | FN-011 |
| FR-007 | FN-020 |
| FR-008 | FN-022 |
| FR-009 | FN-030 |
| FR-010 | FN-031 |
| FR-011 | FN-040 |
| FR-012 | FN-050 |
| FR-013 | FN-041 |
| FR-014 | FN-042 |
| FR-015 | FN-043 |
| FR-016 | FN-060 |
| FR-017 | FN-012 |
| FR-021~024 | FN-070, FN-071 |
| FR-025 | FN-073 |
| FR-026 | FN-074 |
| FR-027 | FN-075 |
| FR-028 | FN-072 |
| FR-029 | FN-080 |
| FR-030 | FN-081 |
| FR-031 | FN-084 |
| FR-032 | FN-082 |
| FR-033 | FN-083 |
| FR-034 | FN-075, FN-076 |
| FR-035 | FN-090 |
| FR-036 | FN-091 |
| FR-037 | FN-092 |
| FR-038 | FN-094 |
| FR-039 | FN-100 |
| FR-040 | FN-101 |
| FR-041 | FN-102 |
| FR-042 | FN-103, FN-104 |
| FR-043 | FN-110, FN-111, FN-115 |
| FR-044 | FN-114 |
| FR-045 | FN-113 |
| FR-046 | FN-112 |
| FR-047 | FN-107 |
| FR-048 | FN-106 |
