---
document_id: AMOEBATALK-NOTIFY-TASK-1.0.0
version: 1.0.0
status: Draft (Awaiting Approval)
project_code: TAC
stage: Implementation / Phase 2 — P0-3
created: 2026-04-27
author: AI Assistant
reviewers: [김익용]
parent_docs:
  - CLAUDE.md
  - SPEC.md (v1.3.0)
  - docs/analysis/academy-management-requirements.md (FR-019)
  - docs/design/academy-management-func-spec.md (FN-029, FN-076, FN-084, FN-122)
  - docs/implementation/academy-management-dev-plan.md (§AMA 경계, AmoebaTalk publish)
  - docs/implementation/tasks/AMA-INTEGRATION-TASK-1.0.0.md (P0-2 — 완료)
  - sql/030-migration-notification-templates.sql
change_log:
  - version: 1.0.0
    date: 2026-04-27
    author: AI Assistant
    description: AmoebaTalk 알림 채널 (P0-3) 요구사항 분석 + 작업계획서 (화면 구성안 포함) 최초 작성.
---

# P0-3 — AmoebaTalk 알림 채널 (Notification Channel)
## Requirements Analysis & Work Plan

> 본 문서는 CLAUDE.md §9.2 워크플로우에 따라 **사용자 확인을 받은 뒤** 구현(코드)으로 진행한다.

---

## 1. Overview (개요)

### 1.1 Purpose (목적)

P0-2 에서 구축한 AMA 경계(`external/ama/`)의 **두 번째 책임**인 **AmoebaTalk 알림 발송 채널**을 구현한다. 현재 Phase 1 결과:

- `tac_notification_templates` 테이블 + Admin 템플릿 CRUD: ✅ 존재
- 도메인 이벤트 → 알림 발송 파이프라인: ❌ 미구현
- 외부 AmoebaTalk API 호출 어댑터: ❌ 미구현
- 발송 이력/실패 재시도: ❌ 미구현

본 작업은 **이벤트 기반 비동기 파이프라인** 으로 도메인 모듈과 알림 모듈을 분리(ADR-002), AmoebaTalk 미연동 환경에서도 console/mock 으로 동작 가능하도록 구현한다.

### 1.2 Scope (범위)

| 구분 | 내용 |
|------|------|
| **포함** | (a) AmoebaTalk HTTP 어댑터 (Bearer + HMAC, mock/http mode), (b) 알림 발송 도메인 이벤트 7종 (Consultation/Enrollment/Payment/Refund/MAP/Absence/TaxInvoice), (c) `NotificationDispatcher` (이벤트 → 템플릿 매칭 → 변수 바인딩 → 발송), (d) 발송 이력 테이블 `tac_notification_logs` (신규), (e) 단순 즉시 재시도(1회) — RabbitMQ 큐 도입 전 in-process, (f) Admin 콘솔 — 템플릿 미리보기 + 발송 이력 페이지, (g) 수동 테스트 발송 버튼 |
| **제외** | (i) RabbitMQ 도입 (Phase 2 후반 별도 트랙), (ii) 카카오 알림톡 검수 워크플로우 (FN-122 — 별도 트랙), (iii) 다국어 템플릿 본격화 (현 단계는 ko 템플릿만), (iv) Email/SMS 채널 (TALK 만 우선), (v) 결제·세무 PII 의 별도 마스킹 룰 (감사로그 표준 따름) |

### 1.3 Success Criteria (성공 기준)

1. Admin 사용자가 학생을 수강 등록하면, 학부모(parent.phone) 앞으로 `ENROLLMENT_CONFIRMED` 알림이 발송된다 (mock 모드: console 로그, http 모드: AmoebaTalk API).
2. 발송 결과는 `tac_notification_logs` 에 `SENT/FAILED` 상태로 기록되어 Admin 이력 페이지에서 조회 가능하다.
3. AmoebaTalk 장애 시 발송 실패는 도메인 트랜잭션을 롤백하지 **않는다** (after-commit 패턴).
4. 7개 이벤트 모두 템플릿이 매핑되어 있고, Admin 템플릿 페이지에서 **[테스트 발송]** 버튼으로 임의 변수로 발송 가능하다.
5. Admin 이력 페이지에서 실패 건을 선택해 **[재발송]** 가능하다.
6. 단위 테스트: `AmoebaTalkClient`(mock/http), `NotificationDispatcher`(템플릿 매칭/바인딩/이력 기록), `template-render` 유틸.

---

## 2. Requirements (요구사항)

### 2.1 Functional (기능 요구)

| ID | 요구사항 | 근거 | 우선 |
|----|---------|------|:--:|
| FR-NTF-01 | AmoebaTalk REST 어댑터: `POST /api/v1/messages` (`{ to, templateCode, variables }`) — Bearer + HMAC 헤더 (P0-2 패턴 재사용) | NFR-012 | P0 |
| FR-NTF-02 | `AMA_MODE=mock` 일 때 console 로그 + 인메모리 큐로 동작 (개발/CI) | DX | P0 |
| FR-NTF-03 | 7개 도메인 이벤트 정의: `tac.consultation.received`, `tac.enrollment.confirmed`, `tac.payment.done`, `tac.refund.done`, `tac.map.score.published`, `tac.class.absent`, `tac.tax.invoice.approved` | FR-019 | P0 |
| FR-NTF-04 | `NotificationDispatcher` (`@OnEvent('tac.**')`) — 이벤트 수신 → `tac_notification_templates` 에서 (`acd_id`, `ntf_event`) 매칭 → 변수 바인딩 → AmoebaTalk 발송 | FR-019 | P0 |
| FR-NTF-05 | `tac_notification_logs` 테이블 — 발송 시점/대상/템플릿/렌더본문/상태/에러/응답ID/시도횟수 | NFR-Audit | P0 |
| FR-NTF-06 | 도메인 트랜잭션 commit 후 발송 (`@OnEvent({async: true})` + queueMicrotask) — 트랜잭션 안전성 | NFR | P0 |
| FR-NTF-07 | 템플릿 본문은 `{{variable}}` 형태 단순 보간. 미정의 변수는 빈 문자열 + WARN 로그 | UX | P0 |
| FR-NTF-08 | Admin 템플릿 상세에 **[테스트 발송]** 버튼 — 미리보기 후 임의 수신자에게 발송 | UX | P0 |
| FR-NTF-09 | Admin **알림 이력** 페이지 (`/admin/notifications`) — 기간/이벤트/상태 필터, 테이블, 본문 미리보기 모달 | FR-019 | P0 |
| FR-NTF-10 | 실패 건 **[재발송]** 액션 (단건/다중 선택) | UX | P1 |
| FR-NTF-11 | 발송 1회 즉시 재시도 (transient HTTP 5xx/timeout 만, 4xx 는 재시도 안 함) | NFR | P0 |
| FR-NTF-12 | `NotificationModule` 은 도메인 모듈을 **import 하지 않는다** — 오직 EventEmitter 만 사용 (ADR-002 경계) | C | P0 |

### 2.2 Non-functional

| ID | 요구사항 |
|----|---------|
| NFR-NTF-01 | AmoebaTalk 호출은 `infrastructure/external/ama/notify/` 외부에서 직접 사용 금지 (ESLint boundaries) |
| NFR-NTF-02 | 발송 본문은 PII(연락처) 의 **마지막 4 자리 외 마스킹** 후 로그 기록 (`010-****-5678`) |
| NFR-NTF-03 | 발송 호출은 5초 timeout, 1회 재시도 (P0-2 패턴 재사용) |
| NFR-NTF-04 | Cron/이벤트 핸들러 실패가 도메인 트랜잭션에 영향 없도록 try-catch 격리 |
| NFR-NTF-05 | 알림 이력은 90일 보관 후 archive (현 단계는 보관만, archive job 은 향후 트랙) |

### 2.3 Constraints (제약)

- **C-003 (재확인)**: AmoebaTalk 어댑터는 결제/세무 도메인 코드를 import 하지 않는다. 오직 도메인이 emit 한 이벤트만 구독.
- **C-NTF-01**: 알림 발송 실패는 절대 도메인 트랜잭션 롤백을 유발하지 않는다 (best-effort).
- **C-NTF-02**: 학부모 동의 없는 마케팅성 메시지 금지 — 본 트랙은 **거래성 알림** 만 다룬다.

### 2.4 Assumptions (가정 — 사용자 확인 필요)

| # | 가정 | 영향 |
|---|------|------|
| **B-01** | AmoebaTalk API 엔드포인트는 `POST {AMOEBATALK_API_URL}/api/v1/messages`, 인증은 `Bearer ${AMOEBATALK_API_KEY}` + HMAC (P0-2 와 동일 시그니처 알고리즘 재사용) | 어댑터 구현 |
| **B-02** | 요청 본문 스키마: `{ to: string(E.164 또는 010-XXXX-XXXX), templateCode: string, variables: Record<string,string> }` 응답: `{ messageId, status }` | DTO |
| **B-03** | 카카오 알림톡 검수된 `templateCode` 가 별도 운영되며, TAC 의 `tac_notification_templates.ntf_event` 와 1:1 매핑된다. **현 단계에서는 검수 단계 시뮬레이션을 위해 `templateCode = ntf_event` 를 그대로 사용** | 단순화 |
| **B-04** | 알림 수신자는 `tac_parents.phone` (현재 평문). 본 트랙에서는 평문 가정 — Phase 2 후반 PII 암호화 트랙(P0-Sec-1)에서 복호화 어댑터 추가 | 단순화 |
| **B-05** | 첫 단계에서는 RabbitMQ 미사용 — `EventEmitter2` async + in-process 1회 재시도. 부하 증가 시 RabbitMQ 로 마이그레이션 (Adapter 패턴이라 변경 영향 작음) | 인프라 단순화 |
| **B-06** | 7개 이벤트 중 일부는 현재 emit 지점이 없음 → 본 트랙에서 emit 코드 추가 (`CreateEnrollmentUseCase`, `ExecuteRefundUseCase` 등) | 작업량 |

> **사용자 확인 요망**: B-01/B-02 의 AmoebaTalk 실제 API 스펙. 스펙이 다를 경우 어댑터 시그니처만 변경되며, Dispatcher/이벤트는 영향 없음. 현재 알 수 없으면 **mock 모드를 기본값**으로 두고 추후 http 모드 도입.

---

## 3. Architecture (아키텍처)

```
┌─────────────────────────────────────────────────────────────────┐
│  Domain Use Cases (Enrollment/Payment/Refund/MAP/...)           │
│   ─ commits TX ─▶ events.emit('tac.enrollment.confirmed', {…})  │
└──────────────────────────┬──────────────────────────────────────┘
                           │  (after-commit, async)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  presentation/notification/  (NotificationModule)               │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  NotificationDispatcher  @OnEvent('tac.**', async)     │    │
│   │   1. Lookup template by (acd_id, ntf_event)            │    │
│   │   2. Resolve recipients (phones)                       │    │
│   │   3. Render body (renderTemplate util)                 │    │
│   │   4. Call AmoebaTalkClient.send()                      │    │
│   │   5. Persist NotificationLog (SENT/FAILED)             │    │
│   └─────────────────────┬──────────────────────────────────┘    │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  infrastructure/external/ama/notify/                            │
│   ┌─────────────────────┐    ┌─────────────────────────────┐    │
│   │ AmoebaTalkClient    │◀───│ AMOEBATALK_CLIENT (DI tok)  │    │
│   │  Mock | Http        │    │  selected by env AMA_MODE   │    │
│   └─────────────────────┘    └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Boundary (C-003)**: NotificationDispatcher 는 도메인 모듈을 **import 하지 않는다**. 이벤트 페이로드는 자체 인터페이스 (`NotificationContext`) 로 정의되며 도메인 모듈은 emit 시 이를 채운다.

---

## 4. Data Model (데이터 모델)

### 4.1 신규 테이블 — `tac_notification_logs`

```sql
CREATE TABLE IF NOT EXISTS tac_notification_logs (
    nlg_id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    acd_id              BIGINT UNSIGNED NOT NULL,
    nlg_event           VARCHAR(50)     NOT NULL,
    nlg_template_id     BIGINT UNSIGNED NULL,
    nlg_channel         VARCHAR(20)     NOT NULL DEFAULT 'TALK',
    nlg_recipient       VARCHAR(40)     NOT NULL COMMENT 'Phone (masked in log views)',
    nlg_recipient_kind  VARCHAR(20)     NOT NULL DEFAULT 'PARENT',
    nlg_subject_id      BIGINT UNSIGNED NULL COMMENT 'Domain entity id (enrollment/payment/...)',
    nlg_subject_kind    VARCHAR(30)     NULL,
    nlg_body            TEXT            NOT NULL COMMENT 'Rendered body sent to AmoebaTalk',
    nlg_variables       JSON            NULL,
    nlg_status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING|SENT|FAILED|RETRYING',
    nlg_provider_msg_id VARCHAR(100)    NULL,
    nlg_error_code      VARCHAR(50)     NULL,
    nlg_error_message   VARCHAR(500)    NULL,
    nlg_attempts        INT UNSIGNED    NOT NULL DEFAULT 0,
    nlg_sent_at         DATETIME        NULL,
    nlg_created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    nlg_updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tac_nlg_academy_event (acd_id, nlg_event, nlg_created_at),
    INDEX idx_tac_nlg_status (nlg_status, nlg_created_at),
    INDEX idx_tac_nlg_subject (nlg_subject_kind, nlg_subject_id),
    CONSTRAINT fk_tac_nlg_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id),
    CONSTRAINT fk_tac_nlg_template FOREIGN KEY (nlg_template_id) REFERENCES tac_notification_templates(ntf_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4.2 기존 시드 — `tac_notification_templates`

이미 5개 템플릿 (`ENROLLMENT_CONFIRMED`, `PAYMENT_DONE`, `MAP_SCORE`, `CLASS_ABSENT`, `CONSULTATION_RECEIVED`) 존재.    
**추가 시드 2개**: `REFUND_DONE`, `TAX_INVOICE_APPROVED` — 본 트랙 마이그레이션에 포함.

---

## 5. API & Module Map (API · 모듈)

### 5.1 신규 / 변경 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/notifications/logs?event=&status=&from=&to=&page=&limit=` | 발송 이력 (admin) |
| `GET` | `/api/notifications/logs/:id` | 단건 상세 (본문 미리보기) |
| `POST` | `/api/notifications/logs/:id/resend` | 실패/임의 건 재발송 |
| `POST` | `/api/notification-templates/:id/test-send` | 템플릿 테스트 발송 (`{ to, variables }`) |

### 5.2 신규 디렉터리

```
backend/src/
├── infrastructure/external/ama/notify/        # NEW
│   ├── dto/
│   │   └── amoebatalk-message.dto.ts
│   ├── interfaces/
│   │   └── amoebatalk-client.interface.ts    # AMOEBATALK_CLIENT, IAmoebaTalkClient
│   ├── amoebatalk-client.service.ts          # http impl (P0-2 patterns)
│   ├── amoebatalk-mock.service.ts            # console mock
│   ├── amoebatalk.module.ts                  # provider factory by env
│   └── amoebatalk.exceptions.ts
├── presentation/notification/                # EXTEND existing notification.module
│   ├── notification-dispatcher.service.ts    # NEW — @OnEvent 핸들러
│   ├── notification-log.controller.ts        # NEW — 이력 조회/재발송
│   └── template-test-send.controller.ts      # NEW — 테스트 발송
├── infrastructure/database/entities/
│   └── notification-log.entity.ts            # NEW
├── application/notification/                 # NEW (utils)
│   ├── render-template.util.ts
│   └── notification-context.types.ts         # 이벤트 페이로드 인터페이스
```

### 5.3 도메인 모듈 변경 (이벤트 emit 추가)

| 파일 | 변경 |
|------|------|
| `application/use-cases/enrollment/create-enrollment.use-case.ts` | commit 후 `events.emit('tac.enrollment.confirmed', ctx)` |
| `application/use-cases/payment/...complete-payment.use-case.ts` | `tac.payment.done` |
| `application/use-cases/payment/execute-refund.use-case.ts` | `tac.refund.done` |
| `application/use-cases/consultation/create-consultation.use-case.ts` | `tac.consultation.received` |
| `application/use-cases/map/publish-score.use-case.ts` (있을 경우) | `tac.map.score.published` |
| `application/use-cases/attendance/mark-absent.use-case.ts` (있을 경우) | `tac.class.absent` |
| `infrastructure/external/nts/tax-invoice-batch.service.ts` | NTS 승인 처리 후 `tac.tax.invoice.approved` (기존 TODO 자리) |

> **Note**: 일부 use-case 가 아직 emit 지점이 없을 수 있음 → 본 트랙에서 emit 1줄씩만 추가, 도메인 로직 변경 없음.

---

## 6. 화면 구성안 (UI Mockup)

### 6.1 알림 이력 페이지 (`/admin/notifications`) — NEW

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 알림 발송 이력                                            [재발송 (선택)] [↻] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 기간 [2026-04-01 ~ 2026-04-27]  이벤트 [전체 ▼]  상태 [전체 ▼]  [검색]       │
├──┬────────┬───────────────────────┬──────────────┬──────────────┬───────────┤
│☐ │ 발송   │ 이벤트                │ 수신자        │ 상태          │ 액션      │
├──┼────────┼───────────────────────┼──────────────┼──────────────┼───────────┤
│☐ │ 14:23  │ ENROLLMENT_CONFIRMED  │ 010-****-5678│ 🟢 SENT       │ 보기      │
│☐ │ 14:21  │ PAYMENT_DONE          │ 010-****-5678│ 🟢 SENT       │ 보기      │
│☑ │ 14:20  │ MAP_SCORE             │ 010-****-1111│ 🔴 FAILED (1) │ 보기·재발송│
│☐ │ 14:15  │ CONSULTATION_RECEIVED │ 010-****-9999│ 🟢 SENT       │ 보기      │
│  │ ...                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                       ◀ 1 / 12 ▶  (총 234건)                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 단건 미리보기 모달 (보기 클릭)

```
┌──────────────────────────────────────────────────────┐
│ 알림 상세                                       [✕]  │
├──────────────────────────────────────────────────────┤
│ 이벤트 : ENROLLMENT_CONFIRMED                        │
│ 수신자 : 010-****-5678 (학부모: 김학부모)             │
│ 발송   : 2026-04-27 14:23:11                         │
│ 상태   : 🟢 SENT  (provider msg-id: ABC-123)         │
│ 시도   : 1회                                          │
├──────────────────────────────────────────────────────┤
│ 본문 (렌더됨)                                         │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 김학생 학생의 중3 영어 RC 수강 등록이 완료되었습 │ │
│ │ 니다.                                              │ │
│ │ 시작일: 2026-05-01                                │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ 변수 (JSON)                                           │
│ { "studentName": "김학생",                           │
│   "programName": "중3 영어 RC",                       │
│   "startDate": "2026-05-01" }                        │
├──────────────────────────────────────────────────────┤
│                            [재발송]   [닫기]         │
└──────────────────────────────────────────────────────┘
```

### 6.2 템플릿 페이지 — [테스트 발송] 버튼 (EXTEND 기존)

```
┌─────────────────────────────────────────────────────────────────┐
│ 템플릿 편집 — ENROLLMENT_CONFIRMED                              │
├─────────────────────────────────────────────────────────────────┤
│ 제목 : [수강 등록 완료                                       ]  │
│ 본문 : ┌─────────────────────────────────────────────────────┐ │
│        │ {{studentName}} 학생의 {{programName}} 수강 등록이  │ │
│        │ 완료되었습니다.                                     │ │
│        │ 시작일: {{startDate}}                                │ │
│        └─────────────────────────────────────────────────────┘ │
│ 변수 : studentName, programName, startDate                      │
│                                                                  │
│ ─── 미리보기 ───                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [샘플 학생] 학생의 [샘플 프로그램] 수강 등록이 완료되었습니다│ │
│ │ 시작일: 2026-05-01                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ─── 테스트 발송 ───                                              │
│ 수신 번호 [010-1234-5678         ]   [테스트 발송]               │
│   ⓘ mock 모드에서는 console 로그로만 출력됩니다.                 │
│                                                                  │
│                                              [취소]   [저장]    │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 사이드바 (좌측 네비) 변경

```
TRINITY ACADEMY
├ Dashboard
├ Programs
├ Consultations
├ Students
├ Teachers
├ Classes
├ Timetable
├ Enrollments
├ Payments
├ Notifications        ← NEW (이력)
│   └ Templates        ← (기존, 하위 메뉴로 이동)
└ Settings
```

---

## 7. Implementation Order (구현 순서)

```
[1] 백엔드 기반
    BE-1 env vars (AMOEBATALK_*, AMA_MODE 재사용)
    BE-2 SQL 마이그레이션 — tac_notification_logs + 시드 2개
    BE-3 Entity + Repository
    BE-4 amoebatalk-mock/http client + module
    BE-5 render-template.util + tests

[2] 디스패처
    BE-6 NotificationDispatcher (@OnEvent('tac.**'))
    BE-7 NotificationContext 인터페이스 + 7개 이벤트 타입
    BE-8 도메인 use-cases 에 emit 1줄씩 추가 (after-commit)

[3] 컨트롤러
    BE-9  GET /notifications/logs (필터/페이징)
    BE-10 GET /notifications/logs/:id
    BE-11 POST /notifications/logs/:id/resend
    BE-12 POST /notification-templates/:id/test-send

[4] 프론트엔드
    FE-1 useNotificationLogs / useResendNotification / useTestSendTemplate hooks
    FE-2 /admin/notifications 페이지 (테이블 + 필터 + 멀티 선택 재발송)
    FE-3 단건 보기 모달 (마스킹 표시 + 본문)
    FE-4 템플릿 편집 페이지에 [테스트 발송] 패널 추가
    FE-5 사이드바 메뉴 추가 + i18n 4개 locale 키

[5] 검증
    BE-13 단위 테스트 (Dispatcher / Client mock·http / render util)
    BE-14 통합 테스트 (이벤트 emit → 로그 row INSERT)
    Manual Acceptance Checklist (§11)
```

총 백엔드 14건 + 프론트엔드 5건 + 테스트.

---

## 8. Tests (테스트)

### 8.1 단위 테스트 (목표 ≥ 12 케이스)

| # | 대상 | 시나리오 |
|---|------|----------|
| T-1 | `renderTemplate` | `{{var}}` 보간, 미정의 변수는 빈 문자열 + WARN |
| T-2 | `renderTemplate` | 동일 변수 다회 등장, escape 없음(plain text) |
| T-3 | `AmoebaTalkMockService` | send → 콘솔 로그 + `{ messageId: 'mock-...' }` 반환 |
| T-4 | `AmoebaTalkHttpService` | 200 OK → DTO 파싱, HMAC 헤더 형식 검증 |
| T-5 | `AmoebaTalkHttpService` | 5xx → 1회 재시도 후 `AmoebaTalkServiceUnavailableException` |
| T-6 | `AmoebaTalkHttpService` | 4xx → 즉시 throw, 재시도 없음 |
| T-7 | `NotificationDispatcher` | 이벤트 수신 → 템플릿 매칭 실패 → WARN + log INSERT (status=FAILED, code=TEMPLATE_NOT_FOUND) |
| T-8 | `NotificationDispatcher` | 정상 경로 → 본문 렌더 + send 호출 + log INSERT (SENT) |
| T-9 | `NotificationDispatcher` | send 실패 → 로그 FAILED + 재시도 1회 후 종료 |
| T-10 | `NotificationLogController` | 필터 + 페이징 |
| T-11 | resend | FAILED 만 재시도 가능 (SENT 는 409) |
| T-12 | test-send | mock 모드에서 200 + provider msg id 응답 |

### 8.2 통합 테스트 (1 케이스, jest-int)

- enrollment 생성 → `@OnEvent` async 처리 후 `tac_notification_logs` 1행 INSERT 검증.

---

## 9. Risks & Mitigations (리스크)

| 리스크 | 완화 |
|--------|------|
| AmoebaTalk 실 API 스펙 미확정 | 초기 mock 모드 기본, http 스펙 확정 시 어댑터만 교체 (B-01/B-02) |
| 도메인 모듈에 emit 코드 추가하다 회귀 발생 | emit 은 1줄, try-catch 로 격리, 기존 단위 테스트 영향 없음 검증 |
| RabbitMQ 미사용으로 발송 부하 누적 | in-process async 가정. 일일 발송량 1000 이하 가정. 초과 시 큐 도입 (별 트랙) |
| 학부모 PII (전화번호) 평문 저장 | NFR-NTF-02 마스킹으로 로그 노출 최소화. 본격 PII 암호화는 P0-Sec-1 |
| 카카오 알림톡 미검수 메시지 발송 | 본 단계는 거래성 알림만, B-03 templateCode 매핑 가정. 검수 워크플로우는 별 트랙 |
| 동일 이벤트 중복 발송 | NotificationLog 의 (subject_kind, subject_id, event) UNIQUE 가능 — Phase B 도입 검토 (현 단계는 단순화) |

---

## 10. Out of Scope (제외)

- RabbitMQ Worker 도입
- 카카오 알림톡 검수 상태 동기화 (FN-122)
- 다국어 알림 본문 (`ntf_body_ko/en/vi/zh`) — 현 단계는 ko 단일
- Email/SMS 채널 (TALK 만)
- 학부모 수신 동의 관리 (별 트랙 — Privacy)
- 결제 영수증 첨부 발송

---

## 11. Acceptance Checklist (수동 검증)

```
[ ] 1. mock 모드: 학생 수강 등록 → 콘솔에 "[AmoebaTalk] to=010-****-5678 ..." 로그
[ ] 2. /admin/notifications 페이지에 1행 SENT 로 표시
[ ] 3. 단건 보기 모달에서 본문 렌더본 + 변수 JSON 확인
[ ] 4. 템플릿 [테스트 발송] 버튼 → 임의 번호로 mock 발송 성공
[ ] 5. AMOEBATALK_API_URL 을 잘못된 값으로 두고 http 모드 실행 → 발송 FAILED 기록 (도메인 트랜잭션은 정상)
[ ] 6. FAILED 로그 [재발송] → 신규 row 또는 동일 row 시도횟수 증가 (구현 결정에 따름)
[ ] 7. Swagger /api/docs 에 신규 4개 엔드포인트 표시
[ ] 8. 이벤트 7종 모두 dev 시뮬레이터(템플릿 테스트 발송)로 발송 가능
```

---

## 12. Open Questions (미결 — 사용자 결정 필요)

| Q | 내용 | 기본 가정 |
|---|------|----------|
| Q-NTF-1 | AmoebaTalk 실제 API 엔드포인트/인증 (B-01/B-02) | mock 우선, http 스펙 확정 시 1주 내 적용 |
| Q-NTF-2 | 알림 수신자 — 학부모만? 학생도 포함? | **학부모만** (현 시점) |
| Q-NTF-3 | 동일 이벤트 중복 발송 방지 (UNIQUE 제약) | 단순화 — Phase B 검토 |
| Q-NTF-4 | 재발송 시 신규 row vs 기존 row 시도횟수 증가 | **신규 row 생성** (감사 추적 명확) |
| Q-NTF-5 | 알림 이력 90일 보관 후 처리 | archive 테이블 vs hard-delete — 별 트랙 |

---

## 13. Effort Estimate (작업 규모 — 참고)

| 영역 | 분량 |
|------|------|
| 백엔드 (어댑터 + Dispatcher + 컨트롤러 + emit 추가) | 中 |
| 프론트엔드 (이력 페이지 + 모달 + 테스트 발송) | 中 |
| 테스트 (단위 12 + 통합 1) | 小 |
| 문서/i18n | 小 |

> 본 트랙 완료 후 P0-2 + P0-3 가 결합되어 **AMA 경계 (`external/ama/`) 의 두 책임이 모두 활성** 상태가 된다.

---

## 14. Approval (승인)

본 작업계획서에 대해 다음 중 하나를 선택해 주십시오:

1. **그대로 진행** — 기본 가정(B-01 ~ B-06) 모두 채택, mock 모드 기본
2. **수정 후 진행** — 어떤 항목을 수정할지 알려 주십시오
3. **보류** — 선결 항목(예: AmoebaTalk API 스펙) 확정 후 재개

> 승인 후 §7 의 BE-1 부터 순차 구현합니다.
