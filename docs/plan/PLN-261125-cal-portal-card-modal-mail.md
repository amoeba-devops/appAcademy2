---
document_id: PLN-261125-CAL2
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-26 v1.1.0 — 사용자 확인("이대로 진행"), 구현
  - 2026-11-25 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261125-CAL2 Calendar title hint · portal card/modal · parent mail progress · materials tabs

Related: [REQ-261125-CAL2](../analysis/REQ-261125-cal-portal-card-modal-mail.md)

## 1. Screen Layout (화면 구성안)
```
① /admin/cal 일정 작성·수정 — 제목
 제목 *
 ┌──────────────┬───────────────────────────────┐
 │ [홍길동]  |   │ 영어                           │   ← 회색 고정 칩 = 자동 표시(참석 학생)
 └──────────────┴───────────────────────────────┘     학생 없으면 [참석자]
 ⓘ 참석 학생은 달력에 자동으로 표시됩니다. 제목에는 과목만 입력하세요.
 달력 표시: 17:00 | 홍길동 | 영어
 (제목 = 학생 이름이면) ⚠ 제목이 참석 학생 이름과 같습니다 — 달력에선 한 번만 보입니다.

② /portal/calendar 카드 (월·주·일)            ③ 일정 모달
 ┌──────────────────────┐                      영어
 │ 17:00 | 홍길동 | 영어  │                      일시      11/23(월) 17:00–18:00
 │ 정규수업              │  ← 과목(일정 구분)     과목      정규수업            (신규)
 └──────────────────────┘                      강의링크  홍길동 · Zoom ↗      (신규, 학생관리 수업 링크)
                                                장소 / 설명 …
                                                [전체내용보기]

④ /portal/calendar/:id 학부모 메일 발송 모달
 [발송] 클릭 → ▓▓▓▓▓░░░ 발송 중… (진행 표시줄, 버튼 잠금)
 완료 → "발송완료되었습니다" 안내 → 모달 자동 닫힘
 페이지의 [학부모 메일 발송] 버튼 아래:
   발송 이력
   11/25 18:20  홍OO 학부모 · 발송됨
   11/24 19:05  홍OO 학부모 · 실패

⑤ 강사 포털 문서/자료실 탭
  공유받은 게시물   내 게시물          ← 수강생관리와 같은 밑줄 탭 (파란 배경 버튼 제거)
  ━━━━━━━━━━━━
```

## 2. Implementation (구현)
| # | 대상 | 변경 |
|---|---|---|
| 1 | `cal/components/cal-event-modal.tsx` | 제목 입력 앞 자동 표시 칩(참석 학생), 안내·미리보기(eventLine)·중복 경고 |
| 2 | `portal-app/pages/portal-calendar-page.tsx` | 월 칸 카드 2줄(문구 + 일정 구분), 더보기·리스트도 구분 표시, 모달에 과목·강의링크 |
| 3 | backend `cal-event.service.getForPortal` | 강사 포털이면 `classLinks: {stdName, links}[]` (참석 학생 × 이 강사의 수업정보 링크) |
| 4 | `portal-app/components/teacher-feedback-email.tsx` | 진행 표시줄, 완료 안내·자동 닫기, 이력을 버튼 아래(페이지)로 이동, 발송 후 이력 새로고침 |
| 5 | `portal-app/pages/portal-materials-page.tsx` | 탭 버튼 인라인 배경 클래스 제거 → `.portal-tabs` 밑줄 스타일 |
| 6 | i18n 4개 | 안내·경고·과목·강의링크·발송완료·발송 이력 |

## 3. Verification (검증)
- tsc·CI, 운영 배포 후 관리자 일정 작성 화면·포털 달력/모달·메일 발송·자료실 탭 확인
