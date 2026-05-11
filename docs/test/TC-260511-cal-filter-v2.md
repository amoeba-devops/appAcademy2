# TC-260511-cal-filter-v2

> 선행: [REQ-260511-cal-filter-v2.md](../analysis/REQ-260511-cal-filter-v2.md), [PLN-260511-cal-filter-v2.md](../plan/PLN-260511-cal-filter-v2.md)

---

## 1. Test Strategy
- **Unit/Integration**: 수동 + curl 기반 API 검증 (백엔드 normalize/validation)
- **E2E**: 스테이징 UI 수동 (`https://acm-stg.amoeba.site/admin/cal`)
- **Manual i18n**: 4 locale 토글

## 2. Test Cases

| ID | AC | 분류 | 우선순위 | 전제 | 입력 | 기대 결과 |
|----|----|------|----------|------|------|-----------|
| TC-01 | AC-01 | E2E | P0 | ADMIN 로그인, 강사 fremdung 일정 ≥1 | TeacherCombo "fre" 입력 → 김익용 클릭 | 김익용 일정만 캘린더 노출, chip "김익용 ✕" 표시 |
| TC-02 | AC-02 | API | P0 | 강사 2명 일정 존재 | `GET /api/acm/cal/events?from=…&to=…&ownerUserIds=<id1>&ownerUserIds=<id2>` | 두 강사 일정 합집합. count = id1건 + id2건 |
| TC-03 | AC-03 | E2E | P1 | TC-02 상태 | chip X 클릭 | 해당 강사 제거, query 자동 갱신 |
| TC-04 | AC-04 | E2E | P0 | TC-01 상태 (학생 1명 선택) | 참석자 종류 → TEACHER 변경 | 기존 학생 chip 비워짐, 검색 결과가 강사 후보 |
| TC-05 | AC-05 | API | P0 | 학생 2명 invitee 시드 | `GET …&attendeeKind=STUDENT&attendeeRefIds=<s1>&attendeeRefIds=<s2>` | 두 학생 중 하나라도 invitee 인 일정 합집합 |
| TC-06 | AC-06 | API | P0 | 강사 + 학생 동시 시드 | `GET …&ownerUserIds=<t>&attendeeKind=STUDENT&attendeeRefIds=<s>` | 강사 = t AND 학생 s invitee 인 일정만 |
| TC-07 | AC-07 | API | P0 | — | `GET …&attendeeKind=STUDENT` (refIds 비움) | HTTP 400, code `INVALID_ATTENDEE_FILTER` |
| TC-07b | AC-07 | API | P1 | — | `GET …&attendeeRefIds=<s>` (kind 비움) | HTTP 400 |
| TC-08 | AC-08 | E2E | P1 | TEACHER 로그인 (fremdung) | `/admin/cal` 진입 | 필터 row 미노출, 본인 일정만 표시 |
| TC-09 | AC-09 | E2E | P2 | ADMIN | TeacherCombo 에서 11명째 클릭 시도 | 토스트/inline 메시지 "최대 10명까지", chip 추가 안됨 |
| TC-10 | AC-10 | Manual | P1 | 4 locale 전환 | 언어 ko / en / vi / zh-CN 변경 | filter.kindLabel 등 신규 키 모두 번역 노출 |
| TC-11 | FR-04 | API | P1 | — | 단수 호환: `?ownerUserId=<t>` | 정상 200, 해당 강사 필터 적용 (deprecated 경로 호환) |
| TC-12 | FR-03 | API | P2 | invalid uuid | `?ownerUserIds=not-a-uuid` | HTTP 400 (class-validator) |
| TC-13 | FR-03 | API | P2 | 11개 ID | `?ownerUserIds=` 11번 반복 | HTTP 400 (`@ArrayMaxSize(10)`) |

## 3. 회귀 (Regression Smoke)
- TC-R1: 필터 미사용 baseline `?from&to` → 전체 일정 (이전 동작과 동일)
- TC-R2: TEACHER 가 본인 일정만 보는 기존 가드 동작 유지
- TC-R3: invitee-candidates 엔드포인트 정상 (TEACHER/PARENT kind 도 결과 반환)
