---
document_id: CAL-REQ-260902
version: 1.1.0
status: CONFIRMED (2026-09-02 사용자 확정)
date: 2026-09-02
change_log:
  - 2026-09-02 v1.1.0 사용자 확정 반영 — Q-A 허용 / Q-B 피드백만 포함(숙제 제외) / Q-C SMTP 설정 완료 / Q-D 제안대로
  - 2026-09-02 v1.0.0 최초 작성 (Claude Code)
---

# REQ-260902 — 수업 피드백 확인·복사·학부모 메일 발송 / Class Feedback Review, Copy & Parent Email Delivery

## 1. Overview (개요)

강사가 작성한 수업 피드백을 운영관리자가 수업일정(캘린더)에서 확인하고, 이를 **복사(메신저 전달용)** 하거나 **등록 학생의 학부모에게 이메일로 발송**할 수 있게 한다. 학부모가 아직 연결되지 않은 학생은 발송 화면에서 바로 **학부모 찾기·매칭**할 수 있어야 한다.

## 2. Current State (현행 분석)

### 2.1 피드백 저장 모델 (live)
- 강사 피드백의 실사용 모델은 **`amb_acm_cal_event_review`** (이벤트당 1건, `UNIQUE(ent_id, evt_id)`).
  - `rvw_feedback_html` TEXT (100KiB 제한), `rvw_homework_status`, `rvw_homework_html`, `rvw_author_tch_id`.
  - 작성: 강사 포털 `/portal/calendar/:evtId` — 담당 강사만 (`assertAssignee`).
  - 피드백은 현재 **"관리자 확인용"** — 포털에서 학생/학부모에게는 숨김 처리됨 (`portal-cal.controller.ts:101`).
- 관리자 확인 UI는 **이미 존재** (읽기 전용):
  - 캘린더 월뷰 📝 배지 (`cal-month-page.tsx`), 일정 모달 `AdminReviewView` (`cal-event-modal.tsx:1063`), 일정 상세 페이지 (`cal-event-detail-page.tsx:327-355`).
- 참고: 구모델 `amb_acm_cls_feedbacks`(학생별)와 체험수업 `tcl_feedback_*`는 본 건 범위 외.

### 2.2 학생–학부모 연결
- N:M 조인 테이블 **`amb_acm_std_student_parent`** (`std_id`, `par_id`, `sp_is_primary` — 학생당 대표 1명 partial unique).
- 학부모 이메일: `amb_acm_std_parent.par_email` VARCHAR(200) **평문** (암호화 미적용 — 기존 상태 유지).
- 매칭 UI/API 기존 보유: `GET /api/acm/std/parents?q=` (검색), `POST /api/acm/std/students/:stdId/parents` (연결/신규생성), 프론트 `parent-pick-or-create-dialog.tsx` — **재사용 가능**.

### 2.3 이메일 인프라
- `MailerService` (nodemailer/SMTP, `@Global()`) 보유. env: `SMTP_HOST/PORT/USER/PASS/SECURE/FROM`. 미설정 시 NO-OP(`SMTP_NOT_CONFIGURED`).
- 유일한 기존 사용처: 캘린더 초대 메일 `InviteeNotifierService` (수신자별 SENT/SKIPPED/FAILED 기록) — **본 건의 모델 패턴**.
- `acm-notification` 로그 테이블(`amb_acm_notification_log`, `recipient_kind='PARENT'` 지원)과 관리자 로그 조회 API 존재 — 발송 이력 기록에 활용.

### 2.4 이벤트–학생 연결
- 수업일정의 참여 학생 = `amb_acm_cal_invitee` (`inv_kind='STUDENT'`). 수신 대상 학부모는 **이벤트의 학생 초대자 → student_parent → parent** 경로로 해석한다.

## 3. Requirements (요구사항)

| ID | 요구사항 | 비고 |
|----|---------|------|
| FR-1 | 관리자가 수업일정(모달·상세페이지)에서 작성된 피드백을 확인 | 기존 기능 — 액션 버튼 추가로 보강 |
| FR-2 | **피드백 내용 복사** 버튼 — 서식 포함(text/html) + 평문(text/plain) 동시 클립보드 복사, 메신저 붙여넣기용 | 숙제 내용 포함 여부는 옵션 |
| FR-3 | **학부모 메일 발송** — 이벤트 참여 학생의 연결 학부모 이메일로 피드백 발송. 수신자 선택(체크박스), 수신자별 발송 결과 표시(SENT/NO_EMAIL/FAILED) | InviteeNotifier 패턴 |
| FR-4 | **학부모 미연결 학생 매칭** — 발송 화면에서 해당 학생에 대해 학부모 검색→연결(또는 신규 생성) 후 즉시 수신자 목록 갱신 | 기존 std 컴포넌트 재사용 |
| FR-5 | 발송 이력 기록 — `amb_acm_notification_log` (`channel=EMAIL`, `recipient_kind=PARENT`) | 기존 로그 조회 API로 열람 |
| FR-6 | 강사 작성 화면 개선 — 피드백이 학부모에게 전달될 수 있음을 안내 문구로 표시 | 범위 최소 (§5 Q-A 참조) |
| NFR | i18n 4 locale(ko/en/vi/zh-CN) 동시 반영, 신규 문자열 하드코딩 금지 | 프로젝트 필수 규칙 |

## 4. Out of Scope (범위 외)

- `amb_acm_cls_feedbacks`(구 학생별 피드백)·체험수업 피드백 흐름 변경.
- 학부모 이메일 암호화 전환(NFR-005 gap — 별도 과제).
- AmoebaTalk/SMS 채널 발송, 발송 큐·재시도 워커(동기 발송만).
- 이메일 수신 학부모의 포털 계정 연동.

## 5. Resolved Questions (확정 사항 — 2026-09-02 사용자 확인)

| Q | 내용 | 확정 |
|---|------|------|
| Q-A | 피드백의 학부모 대면 전환 | **허용** — 콘솔 내부에서 관리자가 확인·선택 후 발송 |
| Q-B | 메일 본문 숙제 포함 여부 | **피드백만 포함** (숙제 제외, 포함 옵션 없음) |
| Q-C | SMTP env 설정 | **설정 완료** (staging/production) |
| Q-D | 학부모 다수 연결 시 기본 수신자 | **제안대로** — 이메일 보유자 전원 기본 체크, 대표 우선 표시 |
