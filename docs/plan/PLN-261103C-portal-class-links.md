---
document_id: PLN-261103C
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-03 v1.1.0 — decisions applied (keep calendar cards, multiple links, teacher portal entry) and implemented
  - 2026-11-03 v1.0.0 — initial plan with UI mockup
---

# PLN-261103C Portal Class Links (작업 계획)

Ref: [REQ-261103C](../analysis/REQ-261103C-portal-class-links.md)

## 1. UI Mockup (화면 구성안)

### 1.1 학생 포털 — 좌측 메뉴
```
┌ 포털 ─────────┐
│ 🔔 공지사항    │
│ 📅 수업일정    │
│ 🎥 수업링크    │ ← 신규 (학생·학부모)
│ 📁 자료실      │
│ 👤 마이페이지  │
└───────────────┘
```

### 1.2 수업링크 `/portal/links`
```
수업링크
┌ 정성경 ──────────────────────────────────────────────┐
│ 과목 영어 Reading · 교재 Wonders 3                     │
│ https://meet.google.com/abc-defg-hij        [🎥 입장] │
└──────────────────────────────────────────────────────┘
┌ 박강사 ──────────────────────────────────────────────┐
│ 과목 수학                                             │
│ 등록된 링크 없음                                       │
└──────────────────────────────────────────────────────┘
(학부모: 자녀 이름 소제목 아래 같은 목록)
```
- 모바일: 1열, [입장] 버튼 높이 36px 이상, 긴 주소는 줄바꿈.

### 1.3 학생관리 수정 — 수업링크 입력칸
```
수업링크 [zoom.us/j/123                    ]   ← 경고 없이 저장 → https://zoom.us/j/123
```

## 2. Tasks (작업)
| # | 작업 | 위치 |
|---|------|------|
| T1 | 운영 DB 확인(SELECT): 정성경 강사 행·포털 계정 `pac_ref_id`·김익용 배정 행 → 원인별 조치 | 운영 DB(읽기), 필요 시 SQL/코드 |
| T2 | 수업링크 검증 완화: DTO `@IsUrl` 제거 → `normalizeLink()`(앞뒤 공백 제거, 스킴 없으면 `https://`, `javascript:`·`data:` 거부). 화면 `isHttpsUrl` 경고 제거 | `student.dto.ts`, `teacher-class-info.ts`, `std-form.tsx`, `teacher-class-fields.tsx` |
| T3 | 포털 `/portal/links` 페이지 + 메뉴(학생·학부모만, `studentOnly`), 기존 `PortalClassInfo` 재사용 | `portal-shell.tsx`, `router.tsx`, `portal-links-page.tsx` |
| T4 | 수업일정 아래 카드 제거(Q1) | `portal-calendar-page.tsx` |
| T5 | i18n 4개 언어(`portalApp.nav.links`), 통합 테스트 수정(검증 완화·정규화), type-check·build, 로컬 화면 확인 | — |

DB 스키마 변경 없음.

## 3. Changes after decisions (결정 반영)
- 링크 여러 개: 입력칸 = [링크 이름][링크 주소][✕] 행 반복 + [+ 링크 추가](최대 10). 관리자 학생 수정·강사 포털 공용 `components/common/class-links.tsx`.
- 강사 포털 수강생 상세:
```
┌ 김하늘 ──────────────────────────────────────────┐
│ 🔗 내 수업링크                              [수정] │
│ 정규      https://meet.google.com/abc…     [입장] │
│ SAT 특강  https://teams.microsoft.com/…    [입장] │
└──────────────────────────────────────────────────┘
```
  `PUT /api/portal/teacher/students/:stdId/links` — 학생관리 배정 학생만(아니면 403 `NOT_ASSIGNED_STUDENT`).
- 수업일정 아래 카드는 그대로 두고 링크 표시만 목록으로.

## 4. Result (결과)
- 서버: `normalizeLink/normalizeLinks/readLinks`(teacher-class-info.ts), DTO `ClassLinkDto`·`SaveClassLinksDto`, `@IsUrl` 제거, 포털 수업정보 `links`, 강사 포털 상세 `links`·`linksEditable` + 저장 API.
- 화면: 관리자 수정(링크 행 편집)·상세(링크 목록), 포털 `/portal/links` + 메뉴(학생·학부모), 수업일정 카드 링크 목록, 강사 포털 내 수업링크 편집. i18n 4개 언어(`classLinks.*`, `portalApp.nav.links` 등), `std.classInfo.meetingUrlInvalid` 삭제.
- 항목 1: 운영 SELECT 확인 결과 데이터 문제(REQ 3.1) — 코드 변경 없음.
- 확인:
  - 통합 테스트 `it-std-class-info-portal` 6건(여러 링크·빈 줄 제거·https 보정, 숨긴 값 보존, 범위, 위험 주소 거부, 강사 저장·미배정 403), acm-std 단위 56건, backend tsc, frontend type-check·build.
  - 로컬 API: 관리자 저장 → 강사 포털 목록에 학생 표시, `javascript:` 400(배정 롤백 없음), 강사 저장 `zoom.us/j/999` → `https://zoom.us/j/999`, 학생 class-info 반영.
  - 로컬 화면: 학생 포털 수업링크 메뉴·카드, 강사 포털 링크 행 삭제·추가·저장(`teams.microsoft.com/…` → https 보정), 관리자 수정 화면에 강사가 넣은 링크 표시·저장 유지.
  - 로컬 관리자 저장이 다시 약 20초 대기(요청이 Vite 프록시 앞에서 pending, 서버 미도달) 후 완료. 운영은 HTTP/2(연결 수 제한 없음)라 로컬 HTTP/1.1 연결 점유 문제로 판단 — 운영 저장 속도는 사용자 확인 필요.
