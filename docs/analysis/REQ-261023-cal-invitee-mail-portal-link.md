---
document_id: ACM-CAL-LINK-REQ-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-23
change_log:
  - version: 1.1.0
    date: 2026-10-23
    description: Decisions (assigned teacher, this/later scope, mail only when selected) + teacher feedback mail finding / 결정 사항·강사 피드백 메일 점검 결과
  - version: 1.0.0
    date: 2026-10-23
    description: Invitee mail opt-in check, student portal scope, teacher-managed class link / 참석자 메일 확인·학생 포털 범위·강사 수업 링크 관리
---
# Class Schedule — Invitee Mail, Student Portal, Teacher Class Link (수업 일정 — 참석자 메일·학생 포털·강사 수업 링크)

## 1. Overview (개요)

요청 원문:
1. "수업 일정에서 참석자 지정 후 일정을 저장시 참석자 메일 전송은 선택시에만 전송 해야함"
2. "학생 포털에서 본인이 수업 일정, 링크 확인하고 메일 발송 기능은 피드백 발송만 사용"
3. "수업 링크를 선생님이 관리합니다. 링크가 바뀌는 경우가 있어서, 강사 포털에 수업 일정에서 링크 기입을 선생님도 할 수 있도록 수정"

## 2. Findings (확인 결과, main `bf07c49`, 운영 DB 읽기 전용 2026-10-23)

### 2.1 R1 참석자 메일 — **이미 "선택 시에만" 동작 (REQ-261016E, 배포 완료)**

| 경로 | 동작 | 근거 |
| --- | --- | --- |
| 일정 등록 | "저장 시 참석자에게 메일 보내기" 체크했을 때만 전체 참석자에게 | `cal-event.service.ts:637`, `cal-event-modal.tsx:955` (기본 꺼짐) |
| 일정 수정 | 체크했을 때만 **새로 추가된** 참석자에게 | `cal-event.service.ts:815` |
| 반복 일정 등록 | 체크했을 때만 요약 1회 | `recurrence.service.ts:160` |
| 반복 일정 일괄 변경·자동 연장 | 메일 없음 (체크 칸도 없음) | `recurrence.service.ts change()/extend()` |
| 즉석 수업 | 체크했을 때만 | `instant-event.service.ts:90` |
| 상담 연동 일정 | 메일 없음 | `csl-cal-linker.service.ts` |

남은 문제: 반복 설정 안내 문구가 **"초대자가 있으면 반복 일정 요약을 1회 발송합니다"** 로 자동 발송처럼 읽힘(`ko/cal.json` `repeat.notify`, 4개 언어). → 문구만 수정.

### 2.2 R2 학생 포털 — **이미 요구대로 동작**
- 학생·학부모는 본인(자녀) 수업 일정 목록·상세, 수업 링크(Meet "수업 링크 열기" / 보다스쿨 입장), 피드백·숙제(읽기), 수업 기록, 첨부 다운로드를 본다.
- 포털의 메일 발송은 **강사 → 학부모 피드백 메일 하나뿐**(담당 강사만, `portal-cal.controller.ts:69-107`). 학생·학부모가 보내는 메일 기능은 없다. 포털 사용자는 참석자 메일을 일으킬 수 없다(일정 생성·수정 API 없음).
- → 코드 변경 없음. 확인만.

### 2.3 R3 강사 수업 링크 — **미구현**
- 강사 포털에서 강사가 바꿀 수 있는 것: 피드백·숙제, 숙제 첨부, 피드백 메일. **일정·링크는 수정 불가**(포털 일정 수정 API 없음).
- 링크 저장 위치: `evt_meeting_provider`(NONE / GOOGLE_MEET / BODASCHOOL / OTHER) + `evt_meeting_url`. 정규·데모 수업은 학원 화상 설정(`amb_acm_cal_video_config`)의 방식으로 고정, Meet 링크는 `https://meet.google.com/xxx-xxxx-xxx` 형식 검사(`meeting-url.ts`). 보다스쿨 링크는 자동 생성.
- 반복 수업: 회차는 `amb_acm_cal_recurrence_occurrence`, 원본 값은 `amb_acm_cal_recurrence_series`(자동 연장 시 복사) — 앞으로 회차 전체를 바꾸려면 원본도 바꿔야 한다.
- **운영 실태**: 학원 화상 방식 = **GOOGLE_MEET**. 정규 수업(60일) 월별 — 10월 링크 없음(NONE) 346건 · Meet 40건, 9월 NONE 532 · Meet 21 · 보다 4. 링크 미기입 수업이 대부분 → 강사 기입 기능 필요성 큼.

## 3. Functional Requirements (기능 요구사항, R3)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 강사 포털 수업 일정 상세에 **"수업 링크" 입력·수정** (링크 없음이면 "링크 등록", 있으면 "링크 수정") |
| FR-2 | 수정 권한: 그 수업의 **담당 강사**(피드백 작성 권한과 동일) — Q1 |
| FR-3 | 대상 수업: 정규·데모 수업 등 일정 중 학원 화상 방식이 Google Meet 인 것. 보다스쿨 일정은 자동 링크라 수정 불가(안내만). 링크 없음(NONE) 일정에 등록하면 방식이 학원 방식(GOOGLE_MEET)으로 바뀜 |
| FR-4 | 입력 검사: Meet 형식(`meet.google.com/xxx-xxxx-xxx`), 앞뒤 공백 제거. 빈 값 저장 = 링크 삭제 |
| FR-5 | 적용 범위 선택(반복 수업): **이 수업만** / **이 수업과 이후 같은 반복 수업 전체**(반복 원본도 갱신 → 자동 연장 회차에도 적용) — Q2 |
| FR-6 | 변경 기록: 일정 수정 이력(`amb_acm_cal_event_revision`, 수정자=강사, 사유 "강사 링크 변경")과 감사 활동 로그에 남김 |
| FR-7 | 저장 시 **"참석자에게 링크 변경 메일 보내기"를 선택한 경우에만** 일정 참석자(편집한 강사 제외)에게 메일. 기본 꺼짐. 학생·학부모는 포털에 바로 반영된 새 링크를 봄 — Q3 |
| FR-8 | 운영 콘솔 일정 화면에도 바뀐 링크가 그대로 보임(같은 데이터) |
| FR-9 | 4개 언어, 모바일(입력 16px·터치 36px) |
| FR-R1 | 반복 설정 안내 문구를 "선택 시 반복 일정 요약을 1회 발송" 으로 수정(4개 언어) |

## 4. Decisions (결정, 2026-10-23 사용자)
- Q1 수정 권한: **수업 담당 강사**
- Q2 반복 수업 범위: **권장안** — 저장 시 "이 수업만 / 이 수업과 이후 전체" 선택, 기본 "이 수업만"
- Q3 학생 알림: **선택 시 발송** (체크한 경우에만 참석자에게 링크 변경 메일)

## 5. Additional Check — Teacher Feedback Parent Mail (추가 확인: 강사 피드백 "학부모 메일 발송")
요청: "강사 포털에서 피드백 '학부모 메일 발송'은 작업 되어있나 확인"
- **구현됨**: 강사 포털 일정 상세 → 피드백 아래 "학부모 메일 발송"(수신자 선택·발송 이력). 담당 강사만. `portal-cal.controller.ts` `review/recipients · email-history · send-email`, `feedback-mailer.service.ts`.
- **운영 사용 0건**(`amb_acm_cal_feedback_send` 0행). 메일 서버 설정은 활성.
- **실제로는 대부분 수업에서 보낼 대상이 없음**:
  - 수신자 = 일정 **참석자(STUDENT)** 의 연결 학부모만. 10월 정규 수업 386건 중 학생이 참석자로 들어간 수업 **8건**(나머지는 반 수강생 `evt_cls_id` 로만 연결).
  - 학부모 이메일이 등록된 재원생 **6명 / 50명**(학부모 7명 중 이메일 5명).
- 개선안(별도 요청 시): 수신자에 반 수강생(`amb_acm_cls_class_students`, 퇴원 전) 학부모 포함 + 학부모 이메일 미등록 안내. 데이터 측면은 학부모 이메일 입력 필요.

## 6. Out of Scope (범위 외)
- 강사의 일정 시간·제목·참석자 변경
- 보다스쿨 링크 수동 변경
- 학생·학부모 피드백 회신 기능(현재 없음, 요청 없음)
