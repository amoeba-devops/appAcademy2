---
document_id: PLN-261128C-INT
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-28 v1.1.0 — 사용자 확인("다음"), 구현
  - 2026-11-28 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261128C External scheduler API · new calendar categories (외부 스케줄러 API 새 분류 반영)

Related: [REQ-261128C-INT](../analysis/REQ-261128C-scheduler-availability-category.md)

## 1. Screen / Contract Layout (화면·계약 구성안)
```
① /admin/config/api — 외부 오픈 API 탭, 수업일정 조회 응답 예시 (카탈로그에서 자동 생성)
 {
   "id": "2222…",
   "category": "OTHER",                ← 그대로 (기존 연동 호환)
   "calendarCategory": "AVAILABLE",    ← 추가: 실제 분류 코드
   "blocksBooking": false,             ← 추가: false = 이 시간에 배정 가능
   "startsAt": "2026-12-01T01:00:00Z", …
 }

② 오류 코드 표 — 409 SCHEDULE_CONFLICT 설명 (카탈로그 API_ERRORS)
 기존: 다른 시간으로 배정 / Reschedule
 변경: blocksBooking=true 일정과 겹침, 다른 시간으로 배정 (가능 시간·휴강과는 겹쳐도 됨)
       / Overlaps a blocking event; reschedule (AVAILABLE/CANCELED never block)

③ 409 응답 details.eventIds — 배정을 막은 일정만 담는다 (가능 시간·휴강 일정은 빠짐)
```

| 분류 | `category` | `calendarCategory` | `blocksBooking` |
|------|-----------|--------------------|-----------------|
| 정규·데모·레벨테스트·미팅·기타 | 그대로 | 같은 값 | true |
| 수업 가능 시간 | OTHER | AVAILABLE | **false** |
| 휴강 | OTHER | CANCELED | **false** |
| 수업 불가능 시간 | OTHER | UNAVAILABLE | true |
| 결강 | OTHER | ABSENT | true |
| 관리자 추가 분류 (`C_…`) | OTHER | C_xxxxxxxx | true |

## 2. Backend
| Task | Detail |
|------|--------|
| B-1 | `cal-category.ts`: `NON_BLOCKING_CAL_CATEGORIES = ['AVAILABLE','CANCELED']`, `calCategoryBlocksBooking(code)` |
| B-2 | `scheduler.service.ts` 겹침 검사 SQL: `AND e.evt_category <> ALL($6)`. 배정을 막지 않는 분류를 뺀다 |
| B-3 | `view()`에 `calendarCategory: row.evt_category`, `blocksBooking`을 추가한다 |
| B-4 | `scheduler-catalog.ts`: `lessonResponse` 예시와 `Lesson` 스키마(required 포함)에 두 필드를 넣는다. OpenAPI `1.1.0` |
| B-5 | `docs/integration/external-scheduler-api.md`: 응답 필드, 겹침 규칙, 변경 이력 |
| B-6 | 테스트: 단위 테스트(`calCategoryBlocksBooking`). 통합 테스트 `it-scheduler-api`에서 AVAILABLE·CANCELED와 겹치면 201, UNAVAILABLE·ABSENT와 겹치면 409, 조회에 새 필드가 나오는지 확인 |

## 3. Frontend
- 코드 수정은 없다. API 안내 화면은 서버 카탈로그(응답 예시·오류 표)를 그대로 보여 주므로 자동으로 바뀐다.
- 카탈로그 문구는 기존처럼 한국어/영어를 함께 적는다.

## 4. Test & Deploy (검증·배포)
- DB 마이그레이션은 없다.
- 검증: backend jest, 통합 테스트(CI), tsc.
- 배포 후 확인:
  - OpenAPI가 `1.1.0`이고 `blocksBooking`이 있는지
  - 키 없이 호출하면 401이 나오는지
  - 오류 로그 0
- 롤백: 이전 코드로 돌리면 필드가 빠지고, 겹침 검사가 예전처럼 막는다. 데이터에는 영향이 없다.
- 연동 앱 담당자에게 알릴 내용: 새 필드가 생겼고, 가능 시간·휴강과 겹치는 배정이 허용된다.
