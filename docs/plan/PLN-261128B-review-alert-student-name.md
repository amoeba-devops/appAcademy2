---
document_id: PLN-261128B-NTF
version: 1.0.0
status: APPROVED
change_log:
  - 2026-11-28 v1.0.0 — 사용자 확인("제안대로 수정"), 구현
---

# PLN-261128B Class-feedback alert shows the student (수업 피드백 알림 학생 이름 표시)

Related: [REQ-261128B-NTF](../analysis/REQ-261128B-review-alert-student-name.md)

## 1. Screen Layout (화면 구성안)
```
알림함 (관리자 콘솔 / 강사 포털)
 수업 피드백·숙제 미완료
 홍길동 | 영어 · 5h · 피드백, 숙제        ← 기존: 영어 · 5h · 피드백, 숙제

휴대폰 푸시
 ACM
 수업 피드백·숙제 미완료 · 홍길동 | 영어   ← 기존: 수업 피드백·숙제 미완료 · 영어
```

## 2. Tasks (작업)
| Task | Detail |
|------|--------|
| B-1 | `review-reminder.service` — add `students` to the payload: registered STUDENT invitees, non-deleted students, first-invited order, `", "` separated |
| B-2 | `push-text.reviewLine()` + a `REVIEW_OVERDUE` push case |
| F-1 | `components-inbox` Summary — `reviewLine(students, title)` for `REVIEW_OVERDUE` |
| T-1 | `push-text.spec` — student line, duplicate title, old payload without students |

No DB migration. 학생 이름은 알림 payload(사내 DB)에만 저장되고, 외부 전송(AMA 전달)에는 이 알림 종류가 포함되지 않는다.
