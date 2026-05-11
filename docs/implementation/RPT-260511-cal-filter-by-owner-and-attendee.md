# RPT-260511-cal-filter-by-owner-and-attendee

## 개요
- **요구사항**: 캘린더에서 작성자(강사)별 보기, 참석자(학생)별 보기 기능 구현
- **참고 문서**:
  - [REQ-260511-cal-filter-by-owner-and-attendee.md](../analysis/REQ-260511-cal-filter-by-owner-and-attendee.md)
  - [PLN-260511-cal-filter-by-owner-and-attendee.md](../plan/PLN-260511-cal-filter-by-owner-and-attendee.md)
  - [TC-260511-cal-filter-by-owner-and-attendee.md](../test/TC-260511-cal-filter-by-owner-and-attendee.md)
- **배포 SHA**: `48da045` (스테이징, 2026-05-11 16:16 KST)
- **이전 SHA**: `e7d7eb2` → 컬럼명 오류로 500 발생 → 핫픽스 후 `48da045` 재배포

## 변경 파일

### Backend
- [backend/src/modules/acm-cal/application/dto/cal-event.dto.ts](../../backend/src/modules/acm-cal/application/dto/cal-event.dto.ts) — `ListCalEventsQueryDto`에 `attendeeKind?`, `attendeeRefId?` 추가 (UUID 검증, enum 검증)
- [backend/src/modules/acm-cal/application/cal-event.service.ts](../../backend/src/modules/acm-cal/application/cal-event.service.ts) — `list()` ADMIN 분기에 `EXISTS` 서브쿼리 + 부분 입력 시 `400 INVALID_ATTENDEE_FILTER`. TEACHER 분기는 변경 없음 (보안)

### Frontend
- [frontend-acm/src/modules/cal/types.ts](../../frontend-acm/src/modules/cal/types.ts) — `ListCalEventsQuery`에 두 필드 추가
- [frontend-acm/src/modules/cal/components/attendee-filter.tsx](../../frontend-acm/src/modules/cal/components/attendee-filter.tsx) — 신규: 학생 검색-콤보박스 (250ms debounce, 외부 클릭 닫기, 기존 `useInviteeCandidates` 재사용)
- [frontend-acm/src/modules/cal/pages/cal-month-page.tsx](../../frontend-acm/src/modules/cal/pages/cal-month-page.tsx) — ADMIN 전용 필터 row 추가, 강사 select + 참석자 콤보 + 초기화 버튼

### Auth (role 노출)
- [backend는 변경 없음] — 기존 응답에 이미 `role` 포함
- [frontend-acm/src/modules/auth/api/auth-api.ts](../../frontend-acm/src/modules/auth/api/auth-api.ts) — `AuthUserDTO`에 `role`
- [frontend-acm/src/stores/auth.store.ts](../../frontend-acm/src/stores/auth.store.ts) — `AcmUser`에 `role`
- [frontend-acm/src/modules/auth/pages/login-page.tsx](../../frontend-acm/src/modules/auth/pages/login-page.tsx) — login + ama-exchange 두 경로 모두 `role` 저장

### i18n (4 locale × 5 키)
- [frontend-acm/src/i18n/locales/ko/cal.json](../../frontend-acm/src/i18n/locales/ko/cal.json)
- [frontend-acm/src/i18n/locales/en/cal.json](../../frontend-acm/src/i18n/locales/en/cal.json)
- [frontend-acm/src/i18n/locales/vi/cal.json](../../frontend-acm/src/i18n/locales/vi/cal.json)
- [frontend-acm/src/i18n/locales/zh-CN/cal.json](../../frontend-acm/src/i18n/locales/zh-CN/cal.json)
- 키: `filter.label` / `filter.allOwners` / `filter.allAttendees` / `filter.searchStudent` / `filter.reset`

## 빌드 결과
- Backend `npm run build` ✅
- Frontend-acm `npm run build` ✅ (1923 modules, 867KB → 248KB gzip)

## 스테이징 스모크 테스트 결과 (8 TCs)

| TC | 시나리오 | 기대 | 결과 |
|----|----------|------|------|
| TC-01 | `?ownerUserId=<fremdung>` | fremdung 강사 일정만 | ✅ count=1, owners=['김익용'] |
| TC-02 | `?attendeeKind=STUDENT&attendeeRefId=<김민>` | 김민 참석 일정만 | ✅ count=1 (시드 invitee 등록 후) |
| TC-03 | owner+attendee 동시 | 두 조건 모두 충족 | ✅ count=1 |
| TC-04 | 다른 학생 refId | 0건 | ✅ count=0 |
| TC-05 | 로그인 응답 role 노출 | `role: ADMIN` | ✅ |
| TC-06 | `?attendeeKind=STUDENT` (refId 없음) | 400 `INVALID_ATTENDEE_FILTER` | ✅ |
| TC-07 | refId가 invalid uuid | 400 (class-validator) | ✅ `attendeeRefId must be a UUID` |
| TC-08 | 필터 없음 (baseline) | 전체 일정 | ✅ count=2 |

## 회귀 영향
- **TEACHER/STAFF**: 서비스 분기 변경 없음. attendee 파라미터를 보내도 무시됨 (보안: ownerUserId=self 강제 유지)
- **응답 스키마**: 기존 필드 그대로 유지, 추가 필드 없음
- **DB 스키마**: 마이그레이션 없음. 기존 unique index `uq_acm_cal_invitee_evt_kind_ref(evt_id, inv_kind, inv_ref_id)`가 EXISTS 서브쿼리 인덱스로 활용됨
- **i18n**: 신규 키만 추가, 기존 키 미변경

## 사고 / 수정 이력
- **`e7d7eb2`**: EXISTS 서브쿼리에서 `i.kind`, `i.ref_id` 사용 → 실제 컬럼은 `inv_kind`, `inv_ref_id` → PG `column does not exist` 500
- **`48da045`**: 물리 컬럼명으로 수정 후 모든 TC 통과
- **메모리 갱신**: `/memories/repo/trinity-academy-project.md`에 `amb_acm_cal_invitee` 컬럼명 주의사항 기록

## 후속 작업 / 알려진 한계
- 강사 수가 200명을 초과할 경우 select가 truncate됨 → 추후 검색형 콤보박스로 업그레이드 권장 (현재 limit=200 client-side filter)
- 참석자 필터는 `STUDENT` kind만 UI 노출. PARENT/TEACHER 필터는 백엔드 지원 완료, UI 미노출 (요구사항에 없음)
- 다중 선택 미지원 (한 번에 강사 1명, 학생 1명) — 추후 multi-select 확장 가능
