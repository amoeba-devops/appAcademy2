---
document_id: REQ-261125-CAL
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-25 v1.1.0 — 사용자 확인("이대로 진행"), 구현
  - 2026-11-25 v1.0.0 — initial
---

# REQ-261125-CAL Unified calendar event line (관리자 달력·강사 포털 일정 문구 통일)

## 1. Overview (개요)
관리자 달력은 "시간 | 학생 | 제목", 강사 포털은 "시간 학생"(이전엔 "시간 제목")으로 서로 달랐다.
제목을 학생 이름으로 쓰면 관리자 달력에 이름이 두 번 보였다 (예: `18:00 | 김학생 | 김학생`).

## 2. Requirements (요구사항)
| ID | Requirement |
|---|---|
| FR-1 | 관리자 달력과 강사 포털이 같은 문구: `시간 \| 학생 \| 제목` |
| FR-2 | 학생 이름은 일정 참석자로 등록된 시스템 학생만 (제목 파싱·외부 이름 추정 폐지), 여러 명이면 쉼표 |
| FR-3 | 제목이 학생 이름과 같으면 제목 생략 → `18:00 \| 김학생` |
| FR-4 | 학생 없음 → `17:00 \| 영어`, 시간은 24시간 `17:00` (한국시간) |
| FR-5 | 월·주·일·리스트 보기 모두 적용. 관리자 카드의 구분·담당 강사 줄은 유지 |

## 3. Screen (화면)
```
              관리자 달력 = 강사 포털
제목=과목      17:00 | 홍길동 | 영어
제목=학생      18:00 | 김학생            (제목 생략)
학생 미연결    17:00 | 영어
학생 2명       19:00 | 홍길동, 김학생 | 수학
```

## 4. Implementation (구현)
- Backend `cal-invitee.service` `studentNamesByEvent` (등록 학생 전원), `cal-event.service` 목록·상세 응답 `studentNames`, `primaryStudentName`=첫 학생 (제목/외부 이름 fallback 제거)
- Frontend 공통 `modules/cal/lib/event-line.ts` — 관리자 `cal-month-page` 카드·리스트, 포털 `portal-calendar-page` 월 칸·더보기·리스트, 포털 시간 `hour12:false`
- 영향: Demo/Level Test 제목에서 추정하던 학생명은 참석자 연결이 없으면 빠짐 → `/admin/cal/link-students` 로 연결. 운영 외부 학생 일정 0건
