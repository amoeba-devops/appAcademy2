---
document_id: PLN-261103D
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-03 v1.1.0 — implemented with decisions (Q1 merge at query, Q2 90 days + upcoming, Q3 links allowed)
  - 2026-11-03 v1.0.0 — initial plan with UI mockup
---

# PLN-261103D Calendar-Assigned Teacher & Student (작업 계획)

Ref: [REQ-261103D](../analysis/REQ-261103D-cal-assigned-teacher-student.md)

## 1. UI Mockup (화면 구성안)

### 1.1 관리자 학생 상세 `/admin/std/:id`
```
수업 정보 (1)                      ← 학생관리 배정 강사(기존)
┌ 정성경 · 수업 정보 ───────────────────┐
│ 과목 영어 · 교재 Wonders · 링크 2개    │
└───────────────────────────────────────┘

수업일정 강사 (2)                  ← 신규
┌──────────────────────────────────────────────────────┐
│ 정성경   일정 12회 · 최근 11/01 · 다음 11/05            │
│ 박강사   일정 3회  · 최근 10/28 · 다음 —   [학생관리 미배정] │
└──────────────────────────────────────────────────────┘
(없으면 "수업일정에 연결된 강사가 없습니다")
```

### 1.2 강사 포털 수강생관리 `/portal/students`
```
수강생관리
┌ 김익용 · 중2 · 영어 ──────── [배정] [수업일정] ┐
┌ 김하늘 · 고1 ─────────────── [반]             ┐
┌ 이민수 · 중3 ─────────────── [수업일정]        ┐   ← 신규로 보이는 학생
```
- 상세 화면은 기존과 같음(최근 수업 10건에 해당 일정 표시).
- 모바일: 출처 배지는 이름 아래 줄로 내려감.

## 2. Tasks (작업)
| # | 작업 | 위치 |
|---|------|------|
| T1 | 수업일정 강사·학생 조합 SQL(공용 상수): 일정 삭제·학생/강사 삭제 제외, 강사 = `evt_assignee_tch_id` ∪ TEACHER 참석자 | `acm-std` application |
| T2 | 강사 포털 `listMyStudents` 에 수업일정 학생 추가 + `sources: ('ASSIGNED'\|'CLASS'\|'CALENDAR')[]` | `portal-teacher-students.service.ts` |
| T3 | 학생 상세 API에 `calendarTeachers: [{tchId, name, eventCount, lastAt, nextAt, assigned}]` | `student.service.ts`, `std/types.ts` |
| T4 | 학생 상세 화면 **수업일정 강사** 묶음, 강사 포털 목록 출처 배지 | `std-detail-page.tsx`, `portal-teacher-students-page.tsx` |
| T5 | (Q3 허용 시) 강사 링크 저장 조건에 수업일정 연결 포함 | `saveMyLinks`·`linkState` |
| T6 | i18n 4개 언어, 통합 테스트(일정 학생 노출·삭제 일정 제외·타 테넌트 제외·상세 강사 목록), type-check·build, 로컬 화면 확인 | — |

DB 스키마 변경 없음.

## 3. Result (결과)
- 서버: `calendar-teachers.ts` `CAL_PAIRS_SQL`(삭제 일정 제외·최근 90일 ~ 앞으로, 강사 = 강사 선택 ∪ TEACHER 참석자) 공용.
  - 강사 포털 목록 `sources`(ASSIGNED·CLASS·CALENDAR), 상세 접근·링크 저장 조건에 수업일정 포함(반 소속만은 여전히 불가).
  - 학생 상세 `calendarTeachers`(일정 수·최근·다음·학생관리 배정 여부).
  - 학생 포털 수업정보 강사 = 학생관리 배정 ∪ 수업일정 강사.
- 화면: 학생 상세 **수업일정 강사** 묶음(미배정 배지), 강사 포털 목록 출처 배지. i18n 4개 언어, 링크 안내문 갱신.
- 확인:
  - 통합 테스트 `it-std-cal-assigned` 3건(상세 강사·출처 배지·90일/삭제/타 테넌트 제외·링크 저장 후 학생 포털 표시·무관 강사 403) + 기존 `it-std-class-info-portal` 6건, acm-std 단위 56건, backend tsc, frontend type-check·build.
  - 로컬 화면: 학생 상세 수업일정 강사(박강사 1회·정성경 2회, 미배정 배지), 강사 포털 김익용 [수업일정]·이준서 [배정][수업일정], 김익용 링크 저장(`meet.google.com/…` → https 보정).
- 운영 영향: 배포 즉시 수업일정 조합(최근 90일 기준) 강사·학생이 서로 보임. 학생 포털 수업정보에도 수업일정 강사 카드가 생김(링크 없으면 "등록된 링크 없음").
