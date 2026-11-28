---
document_id: REQ-261128B-NTF
version: 1.0.0
status: APPROVED
change_log:
  - 2026-11-28 v1.0.0 — 조사 결과 제안, 사용자 확인("제안대로 수정")
---

# REQ-261128B Class-feedback alert shows the student (수업 피드백 알림 학생 이름 표시)

Related plan: [PLN-261128B-NTF](../plan/PLN-261128B-review-alert-student-name.md)

## 1. Findings (조사 결과)
- `REVIEW_OVERDUE` (수업 피드백·숙제 미완료) payload carries only the event title, hours, and missing items. It has no student field.
  알림에는 일정 제목·경과 시간·빠진 항목만 담기고, 학생 정보는 없다.
- Student names showed only when the title itself was the student name (old events).
- Since REQ-261125-CAL (titles = subject, students shown from invitees), new alerts read "영어 · 5h · 피드백" with no student.
- Production, last 30 days: 807 alerts / 66 events. 605 had a student name in the title. All 24 alerts since 11-26 had no name.

## 2. Requirement (요구사항)
| ID | Requirement |
|----|-------------|
| FR-1 | Feedback alerts show `학생 | 제목`, the same rule as the calendar line: registered STUDENT invitees only, title omitted when it repeats the names |
| FR-2 | Applies to the inbox (admin console and teacher portal) and the phone push |
| FR-3 | Alerts already sent are unchanged; old alerts without student data show the title as before |
