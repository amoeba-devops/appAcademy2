# PLN-260511-cal-filter-by-owner-and-attendee — 작업 계획서

> **Type**: 작업 계획서 (Work Plan)
> **Date**: 2026-05-11
> **Related**: [REQ-260511-cal-filter-by-owner-and-attendee.md](../analysis/REQ-260511-cal-filter-by-owner-and-attendee.md)

---

## 1. Task Breakdown

### Phase A — Backend (acm-cal)
| # | 작업 | 파일 |
|---|------|------|
| A1 | `ListCalEventsQueryDto` 에 `attendeeKind?`, `attendeeRefId?` 추가 + 상호 의존 검증 | `backend/src/modules/acm-cal/application/dto/cal-event.dto.ts` |
| A2 | `CalEventService.list` 에 attendee EXISTS 서브쿼리 적용 (ADMIN 분기 안에서) | `backend/src/modules/acm-cal/application/cal-event.service.ts` |

### Phase B — Frontend (frontend-acm cal)
| # | 작업 | 파일 |
|---|------|------|
| B1 | `ListCalEventsQuery` 타입에 신규 필드 추가 | `frontend-acm/src/modules/cal/types.ts` |
| B2 | `useTeachers` 훅 재사용 (이미 `frontend-acm/src/modules/tch/hooks/use-teachers.ts` 존재) — 강사 셀렉트용 페이지=1 limit=200 | (재사용) |
| B3 | `cal-month-page.tsx` 헤더에 두 필터 추가 + state 관리 + `useCalEvents` 파라미터 전달 | `frontend-acm/src/modules/cal/pages/cal-month-page.tsx` |
| B4 | 학생 검색 컴포넌트 — debounce + Combobox-like select (간단 구현: input + dropdown) | `frontend-acm/src/modules/cal/components/attendee-filter.tsx` (신규) |
| B5 | TEACHER role 일 때 필터 숨김 — `useAuthStore.role` 체크 | `cal-month-page.tsx` |

### Phase C — i18n
| # | 작업 | 파일 |
|---|------|------|
| C1 | `cal.json` 4개 locale 에 `filter.owner` `filter.attendee` `filter.allOwners` `filter.allAttendees` `filter.searchStudent` 키 추가 | `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/cal.json` |

### Phase D — 빌드/배포
| # | 작업 |
|---|------|
| D1 | `cd backend && npm run build` |
| D2 | `cd frontend-acm && npm run build` |
| D3 | git commit + push |
| D4 | staging deploy (`scripts/deploy-staging.sh`) |
| D5 | smoke test (curl) — 신규 쿼리 파라미터 동작 |
| D6 | RPT 보고서 작성 |

---

## 2. UI Mockup (와이어프레임)

### AS-IS — 캘린더 헤더
```
┌──────────────────────────────────────────────────────────┐
│  캘린더                              [+ 일정 등록]       │
├──────────────────────────────────────────────────────────┤
│  [<]  2026년 5월  [>]                          [오늘]    │
├──────────────────────────────────────────────────────────┤
│  일  월  화  수  목  금  토                              │
│  ...                                                      │
└──────────────────────────────────────────────────────────┘
```

### TO-BE — 캘린더 헤더 (ADMIN)
```
┌──────────────────────────────────────────────────────────────────────┐
│  캘린더                                            [+ 일정 등록]      │
├──────────────────────────────────────────────────────────────────────┤
│  [<]  2026년 5월  [>]   [작성자(강사) 전체 ▾] [참석자(학생) 검색…▾]  [오늘] │
├──────────────────────────────────────────────────────────────────────┤
│  일   월   화   수   목   금   토                                     │
│  ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### TO-BE — 작성자 셀렉트 (열림)
```
┌─────────────────────────┐
│ ✓ (전체)                │
│   김익용 (Gray)         │
│   정성경                │
│   …                     │
└─────────────────────────┘
```

### TO-BE — 참석자 검색 셀렉트 (열림)
```
┌──────────────────────────────────┐
│ [검색: 학생 이름…]  ✕             │
├──────────────────────────────────┤
│   (전체)                          │
│   김민  (4학년)                   │
│   노은                            │
│   동하                            │
│   … 최대 30명                     │
└──────────────────────────────────┘
```

### TO-BE — 캘린더 헤더 (TEACHER) — 필터 숨김
```
┌──────────────────────────────────────────────────────────┐
│  캘린더                              [+ 일정 등록]       │
├──────────────────────────────────────────────────────────┤
│  [<]  2026년 5월  [>]                          [오늘]    │
└──────────────────────────────────────────────────────────┘
```

---

## 3. API Spec (변경분)

### `GET /api/acm/cal/events` — Query 파라미터 확장
```
from           required ISO-8601
to             required ISO-8601
category       optional CAL_CATEGORIES
ownerUserId    optional UUID  (ADMIN only — 기존)
attendeeKind   optional STUDENT|TEACHER|PARENT  (NEW, ADMIN only)
attendeeRefId  optional UUID                    (NEW, ADMIN only)
```
- attendeeKind 와 attendeeRefId 는 **둘 다 있어야** 활성화. 한쪽만 있으면 400 `INVALID_ATTENDEE_FILTER`
- TEACHER 가 전송하면 무시 (서버에서 본인 ownerUserId 강제와 동일 정책)

### Service 쿼리 추가
```ts
if (q.attendeeKind && q.attendeeRefId) {
  qb.andWhere(
    `EXISTS (
       SELECT 1 FROM amb_acm_cal_invitee i
       WHERE i.evt_id = e.id
         AND i.ent_id = :entId
         AND i.kind   = :ak
         AND i.ref_id = :ar
     )`,
    { ak: q.attendeeKind, ar: q.attendeeRefId },
  );
}
```

---

## 4. Risks & Mitigations

| 위험 | 완화 |
|------|------|
| EXISTS 서브쿼리 성능 | 기존 `uq_acm_cal_invitee_evt_kind_ref` 인덱스 활용 — 월 단위(수십~수백 row) 조회에서는 무시 가능 |
| 강사 목록이 많을 때 셀렉트 UX | 일단 limit=200 로 simple `<select>`. 200 초과 시 후속 — combobox 도입 검토 |
| TEACHER 가 직접 쿼리 파라미터 위조 | Service 분기에서 무시 (기존 ownerUserId 와 동일) — 보안 영향 0 |
| attendeeRefId 가 다른 ent 의 ID 일 경우 | EXISTS 에 `ent_id = :entId` 포함 → 자동 격리 |

---

## 5. Estimate

- Backend: A1+A2 = 30~40 LOC
- Frontend: B1~B5 = 150~200 LOC (신규 컴포넌트 1개)
- i18n: 5 keys × 4 locales = 20 lines
- 빌드/배포 기존 파이프라인

---

## 6. Rollback

- DB 변경 없음 → SQL 롤백 불필요
- Backend / Frontend 코드만 revert 후 redeploy
