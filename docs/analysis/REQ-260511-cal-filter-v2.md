# REQ-260511-cal-filter-v2

> 작성일: 2026-05-11
> 선행: [REQ-260511-cal-filter-by-owner-and-attendee.md](./REQ-260511-cal-filter-by-owner-and-attendee.md), [RPT-260511-cal-filter-by-owner-and-attendee.md](../implementation/RPT-260511-cal-filter-by-owner-and-attendee.md)
> 대상 화면: `/admin/cal` (캘린더 월 보기, ADMIN 전용 필터 row)

---

## 1. 배경 (Background)
1차 구현(`b3c16e4`)에서 ADMIN 전용 필터 row를 추가했지만 다음 한계가 남아있다:
- 강사 select 가 단순 native `<select>` → 강사 수가 많아질 경우 검색 불가, UX 저하
- 참석자 필터는 `STUDENT` 한 종류만 노출, `TEACHER` / `PARENT` 참석자 필터 불가
- 조건이 모두 단일 선택 → 여러 명의 강사 또는 학생을 동시에 보고 싶다는 요구 충족 불가

## 2. 목표 (Goals)
1. **강사 검색 콤보**: 강사 select 를 검색-as-you-type 콤보박스로 교체. 200명 이상에서도 사용 가능.
2. **참석자 종류 선택**: 학생/강사/학부모 중 어떤 종류를 검색할지 선택 가능.
3. **다중 선택**: 강사 N명, 참석자 N명을 OR 조건으로 동시 필터.

## 3. 비목표 (Non-goals)
- 카테고리 필터 UI 노출 (백엔드는 이미 지원, 본 작업 범위 외)
- 일/주/년 보기 추가
- 강사 ↔ 학생 교차 매트릭스
- TEACHER 역할 사용자에게 동일 필터 노출 (보안: TEACHER 는 본인 일정만 보도록 유지)

## 4. 기능 요구사항 (Functional Requirements)

### FR-01 강사 검색 콤보 (Owner combobox)
- ADMIN 화면 필터 row의 native select → 검색 입력 + 결과 드롭다운으로 교체
- 입력 시 250ms debounce 후 `GET /api/acm/tch/teachers?q={input}&limit=50` 호출 (기존 `q` 파라미터 활용)
- 선택된 강사는 chip 형태로 표시, X 버튼으로 개별 제거
- 다중 선택 가능 (최대 10명, UX 안전장치)

### FR-02 참석자 종류 선택 + 다중 선택
- 참석자 필터 옆에 kind 선택 (STUDENT / TEACHER / PARENT, default STUDENT)
- kind 변경 시 기존 선택은 초기화 (서로 다른 ref 공간이므로)
- 참석자 검색 콤보는 선택된 kind 의 후보만 표시 (기존 `useInviteeCandidates` 재사용, kind 파라미터 변경)
- 다중 선택 가능 (최대 10명), chip 표시 + 개별 제거

### FR-03 백엔드 다중 ID 지원
- `ListCalEventsQueryDto`:
  - `ownerUserId?: string` → `ownerUserIds?: string[]` 로 확장 (단수 형 deprecate, 호환 유지)
  - `attendeeRefId?: string` → `attendeeRefIds?: string[]` 로 확장
- 단수 형도 당분간 받아주되 내부에서 array 로 normalize (기존 호출자 호환)
- ADMIN 전용 처리 유지. 부분 입력(`attendeeKind` 만 / `attendeeRefIds` 만) → 400 `INVALID_ATTENDEE_FILTER`
- TypeORM: `ownerUserId IN (:...ids)` + EXISTS 서브쿼리 `inv_kind = :ak AND inv_ref_id = ANY(:refIds)` (또는 `IN (:...refIds)`)
- 빈 배열은 "필터 없음"으로 취급 (전체 노출)

### FR-04 i18n (4 locale)
신규 키 (cal namespace):
- `filter.kindLabel` "참석자 종류"
- `filter.kindStudent` "학생" / `filter.kindTeacher` "강사" / `filter.kindParent` "학부모"
- `filter.searchTeacher` "강사 이름 검색"
- `filter.searchAttendee` "이름·이메일 검색"
- `filter.maxSelected` "최대 {{n}}명까지 선택할 수 있습니다."

## 5. 비기능 요구사항 (NFRs)
- **성능**: 콤보 검색은 debounce 250ms + react-query 캐시. 최대 10명 OR 조건은 EXISTS + IN 으로 인덱스(`uq_acm_cal_invitee_evt_kind_ref`, `idx_acm_cal_inv_ref`) 활용.
- **보안**: ADMIN 분기에서만 활성. TEACHER/STAFF 는 무시 (기존과 동일).
- **호환성**: 기존 단수 `ownerUserId` / `attendeeRefId` 쿼리 파라미터도 동작 (당분간).

## 6. 인수 기준 (Acceptance Criteria)

| ID | 시나리오 | 기대 |
|----|----------|------|
| AC-01 | 강사 콤보에 "fre" 입력 후 결과 클릭 | 강사 1명 chip 추가, 캘린더가 해당 강사 일정만 표시 |
| AC-02 | 강사 콤보에서 2명 선택 | 두 강사의 일정 합집합(OR) 표시 |
| AC-03 | 강사 chip 의 X 클릭 | 해당 강사 제거, 결과 갱신 |
| AC-04 | 참석자 종류를 TEACHER 로 변경 | 참석자 검색 결과가 강사 후보로 바뀜, 기존 학생 선택 초기화 |
| AC-05 | 참석자 콤보에서 학생 2명 선택 | 두 학생 중 한 명이라도 invitee 인 일정 표시 |
| AC-06 | 강사 1명 + 학생 1명 동시 선택 | 양쪽 모두 만족하는 일정만 (AND) |
| AC-07 | `attendeeKind=STUDENT` 만 단독 호출 | HTTP 400, `INVALID_ATTENDEE_FILTER` |
| AC-08 | TEACHER 로그인 시 화면 진입 | 필터 row 미노출, 기존처럼 본인 일정만 |
| AC-09 | 11번째 선택 시도 | 토스트/알림 "최대 10명" 안내, 추가 차단 |
| AC-10 | 4개 locale 전환 | 모든 신규 키 번역 노출 (한·영·베·중) |

## 7. 영향 모듈 (Impact)
- Backend: `acm-cal` (DTO + service 만)
- Frontend: `cal` 모듈 (filter row 컴포넌트 재구성), `tch` hook 활용
- DB 마이그레이션: 없음 (기존 인덱스 재사용)
