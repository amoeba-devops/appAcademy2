# RPT-260511-cal-filter-v2

> 선행: [REQ-260511-cal-filter-v2.md](../analysis/REQ-260511-cal-filter-v2.md), [PLN-260511-cal-filter-v2.md](../plan/PLN-260511-cal-filter-v2.md), [TC-260511-cal-filter-v2.md](../test/TC-260511-cal-filter-v2.md)
> 배포: staging `fa475b7` (deployed_at=2026-05-11T23:32:48+09:00)

---

## 1. 요약
캘린더 필터 v2 구현 완료. 강사 검색 콤보 도입, 참석자 종류(STUDENT/TEACHER/PARENT) 선택 + 다중 선택 지원, 백엔드 다중 ID 쿼리 지원. 단수형 파라미터 호환 유지. API 스모크 8건 PASS.

## 2. 변경 파일

### Backend
- [backend/src/modules/acm-cal/application/dto/cal-event.dto.ts](../../backend/src/modules/acm-cal/application/dto/cal-event.dto.ts) — `ownerUserIds`, `attendeeRefIds` (UUID, max 10) 추가. `@Transform` 으로 query string 단일/배열 둘 다 normalize.
- [backend/src/modules/acm-cal/application/cal-event.service.ts](../../backend/src/modules/acm-cal/application/cal-event.service.ts) — ADMIN 분기에서 단수 + 배열 형태를 union/dedup 후 `IN (:...ids)` 또는 EXISTS+`IN` 으로 적용.

### Frontend
- [frontend-acm/src/lib/api-client.ts](../../frontend-acm/src/lib/api-client.ts) — `paramsSerializer: { indexes: null }` 로 `?ownerUserIds=a&ownerUserIds=b` 형태 직렬화.
- [frontend-acm/src/modules/cal/types.ts](../../frontend-acm/src/modules/cal/types.ts) — `ownerUserIds`, `attendeeRefIds` 추가.
- [frontend-acm/src/modules/cal/components/teacher-multi-combo.tsx](../../frontend-acm/src/modules/cal/components/teacher-multi-combo.tsx) — 신규: 검색-as-you-type 강사 다중 선택 콤보 (`useTeachers({q})` 활용).
- [frontend-acm/src/modules/cal/components/attendee-filter.tsx](../../frontend-acm/src/modules/cal/components/attendee-filter.tsx) — 다중 선택 + kind 세그먼트 컨트롤로 재작성. kind 변경 시 chip 초기화.
- [frontend-acm/src/modules/cal/pages/cal-month-page.tsx](../../frontend-acm/src/modules/cal/pages/cal-month-page.tsx) — native `<select>` 제거, `TeacherMultiCombo` + 새 `AttendeeFilter` 사용.
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/cal.json` — `filter.{ownerLabel,kindLabel,kindStudent,kindTeacher,kindParent,searchTeacher,searchAttendee,addTeacher,addAttendee,maxSelected}` 4 locale 추가.

### Docs
- [docs/analysis/REQ-260511-cal-filter-v2.md](../analysis/REQ-260511-cal-filter-v2.md)
- [docs/plan/PLN-260511-cal-filter-v2.md](../plan/PLN-260511-cal-filter-v2.md)
- [docs/test/TC-260511-cal-filter-v2.md](../test/TC-260511-cal-filter-v2.md)

## 3. 테스트 실행 결과 (staging API)

| TC | 설명 | 기대 | 실제 | 결과 |
|----|------|------|------|------|
| TC-02 | 단일 ownerUserIds | count=1 (해당 강사) | count=1 (강사 fremdung / 김익용) | ✅ |
| TC-02b | 다중 ownerUserIds (2명) | count=2 (합집합) | count=2 (강사 fremdung / 김익용, 수업 / 교사2) | ✅ |
| TC-05 | attendeeKind+attendeeRefIds | count≥1 | count=1 | ✅ |
| TC-07 | attendeeKind 단독 | HTTP 400 | HTTP 400 | ✅ |
| TC-07b | attendeeRefIds 단독 | HTTP 400 | HTTP 400 | ✅ |
| TC-11 | legacy ownerUserId | 정상 200 | count=1 | ✅ |
| TC-12 | invalid uuid | HTTP 400 | HTTP 400 | ✅ |
| TC-R1 | 필터 미사용 baseline | 전체 일정 | count=2 | ✅ |

**통과 8/8**. UI E2E (TC-01/03/04/06/08/09/10) 는 사용자 수동 확인 권장 (`https://acm-stg.amoeba.site/admin/cal`).

## 4. 회귀 영향
- 단수형 `ownerUserId` / `attendeeRefId` 파라미터는 그대로 동작 (TC-11 검증). 기존 호출자/북마크 호환.
- 빌드 영향: backend nest build 통과, frontend tsc+vite build 통과.
- DB 마이그레이션 없음 (기존 `uq_acm_cal_invitee_evt_kind_ref` 인덱스 재사용).

## 5. 후속 작업 / 알려진 한계
- UI E2E (수동) — 사용자 검수 필요.
- `attendeeKind` 단일 선택 — 다른 kind 의 invitee 동시 필터는 추후 요구 시 검토 (현재는 kind 변경 시 chip 초기화).
- 다중 선택 max=10 — UX 안전장치. 더 큰 값 필요 시 backend `@ArrayMaxSize(10)` 동시 상향.

## 6. 메모리/문서 갱신
- 이미 기록된 raw-SQL 컬럼명 주의 (`inv_kind`/`inv_ref_id`) 패턴 그대로 적용. 추가 메모 불필요.
