# PLN-260511-cal-filter-v2

> 선행: [REQ-260511-cal-filter-v2.md](../analysis/REQ-260511-cal-filter-v2.md)

---

## 1. Task Breakdown

### Phase A — Backend (acm-cal)
- **A-1** `ListCalEventsQueryDto`
  - 추가: `ownerUserIds?: string[]` (`@IsArray`+`@IsUUID('all', { each:true })`+`@ArrayMaxSize(10)`)
  - 추가: `attendeeRefIds?: string[]` 동일 검증
  - 단수형 `ownerUserId` / `attendeeRefId` 유지 (deprecated, 호환)
  - `@Transform(({value}) => Array.isArray(value) ? value : [value])` 로 query string `?ownerUserIds=a&ownerUserIds=b` + 단일 값 모두 normalize
- **A-2** `cal-event.service.ts list()` ADMIN 분기 수정
  - normalize: `const ownerIds = [...(q.ownerUserIds ?? []), ...(q.ownerUserId ? [q.ownerUserId] : [])]`
  - normalize: `const attendeeIds = [...(q.attendeeRefIds ?? []), ...(q.attendeeRefId ? [q.attendeeRefId] : [])]`
  - 검증: `attendeeKind` 와 `attendeeIds.length>0` 둘 다 있어야 적용. 한 쪽만 있으면 400.
  - SQL: `if (ownerIds.length) qb.andWhere('e.ownerUserId IN (:...ownerIds)', { ownerIds })`
  - SQL: `if (attendeeKind && attendeeIds.length) qb.andWhere(EXISTS ... AND i.inv_ref_id IN (:...attendeeIds))`
- **A-3** `npm run build` 검증

### Phase B — Frontend (frontend-acm/src/modules/cal)
- **B-1** `types.ts`
  - `ListCalEventsQuery` 에 `ownerUserIds?: string[]`, `attendeeRefIds?: string[]` 추가
  - 단수형 필드는 유지하되 신규 코드는 ids 형 사용
- **B-2** 신규 컴포넌트 `components/teacher-multi-combo.tsx`
  - props: `value: TeacherDetail[]`, `onChange: (next: TeacherDetail[]) => void`, `max?: number = 10`
  - 내부: `useTeachers({ q: debounced, limit: 50 })`
  - chip + 검색-input + 결과 dropdown
- **B-3** 기존 `attendee-filter.tsx` → 다중 선택 + kind 선택으로 재작성
  - props: `kind, onKindChange, value: InviteeCandidate[], onChange, max?: number = 10`
  - 상단 segment: STUDENT / TEACHER / PARENT 토글
  - kind 변경 시 `onChange([])` 초기화
- **B-4** `pages/cal-month-page.tsx` 갱신
  - 상태: `selectedTeachers: TeacherDetail[]`, `attendeeKind: CalInviteeKind`, `selectedAttendees: InviteeCandidate[]`
  - 쿼리 빌드: `ownerUserIds`, `attendeeKind` + `attendeeRefIds` 매핑
  - 기존 native `<select>` 제거 → `<TeacherMultiCombo>` 로 교체
  - 초기화 버튼: 모두 비우기
- **B-5** `useCalEvents` axios params: 배열 query 파라미터 직렬화 확인 (axios 기본 `params` 가 `?ownerUserIds=a&ownerUserIds=b` 로 직렬화) — `paramsSerializer` 필요 시 추가

### Phase C — i18n (4 locale)
- 신규 키 추가 (cal namespace): `filter.kindLabel`, `filter.kindStudent`, `filter.kindTeacher`, `filter.kindParent`, `filter.searchTeacher`, `filter.searchAttendee`, `filter.maxSelected`

### Phase D — 빌드/배포/스모크/RPT
- backend + frontend build
- commit + push
- staging deploy
- 9 smoke TCs
- RPT 보고서

---

## 2. 화면 구성안 (UI Mockup)

### 필터 row (ADMIN 전용, AS-IS → TO-BE)

**AS-IS** (현재 `b3c16e4`):
```
┌─ filter row ─────────────────────────────────────────────────────────┐
│ Filter:  [강사 전체 ▼ native select]  [참석자 전체 🔍 (학생만)] [초기화] │
└──────────────────────────────────────────────────────────────────────┘
```

**TO-BE**:
```
┌─ filter row (wrap on narrow viewports) ─────────────────────────────────────┐
│ Filter:                                                                      │
│ ┌─ Owner ──────────────────────────────────────────────────────────────┐    │
│ │ 강사: [김익용 ✕] [정성경 ✕]  [+ 강사 추가 🔍 검색…]                    │    │
│ └──────────────────────────────────────────────────────────────────────┘    │
│ ┌─ Attendee ───────────────────────────────────────────────────────────┐    │
│ │ 참석자 종류: ( • 학생 ) ( 강사 ) ( 학부모 )                            │    │
│ │ 참석자: [김민 ✕] [홍길동 ✕]  [+ 참석자 추가 🔍 검색…]                  │    │
│ └──────────────────────────────────────────────────────────────────────┘    │
│ [필터 초기화]                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### TeacherMultiCombo (FR-01 컴포넌트)

```
[김익용 ✕] [정성경 ✕]  [+ 강사 추가  ▼]
                       ┌─────────────────────────┐
                       │ 🔍 [fre___________]      │
                       ├─────────────────────────┤
                       │ • 김익용  fremdung@…    │  ← 이미 선택됨 (체크 표시)
                       │ • 정수영  jung@…        │
                       │ • 박철    park@…        │
                       └─────────────────────────┘
```

### AttendeeMultiCombo (FR-02 컴포넌트)

```
참석자 종류: ( • 학생 ) ( 강사 ) ( 학부모 )

[김민 ✕] [노은 ✕]  [+ 참석자 추가  ▼]
                   ┌─────────────────────────┐
                   │ 🔍 [노___________]       │
                   ├─────────────────────────┤
                   │   김민  4학년            │
                   │ • 노은                   │  ← 선택됨
                   │   동하                   │
                   └─────────────────────────┘
```

---

## 3. 의존성 / 순서
A → B → C → D (각 Phase 완료 후 다음 진행). A 완료 시점에서 B 와 C 는 병렬 가능하지만 단일 작업자 순차 진행.

## 4. 리스크
- **R1**: axios 배열 직렬화. 기본 동작이 `?ownerUserIds[]=a` 형태일 경우 NestJS가 받지 못함 → `paramsSerializer: { indexes: null }` 명시 필요. **완화**: B-5 단계에서 검증 후 필요 시 추가.
- **R2**: 다중 선택 chip 가 많으면 화면 폭 초과 → flex-wrap + max-h-overflow 처리.
- **R3**: TeacherMultiCombo 의 chip 표시용 라벨 — `useTeachers` 결과는 매번 검색용이므로 selected 강사 정보를 별도 보존 (`TeacherDetail[]` 통째로 state 보관).
- **R4**: kind 변경 시 invitee chip 초기화하지 않으면 다른 종류의 refId 가 섞여 EXISTS 가 0건 → kind 변경 onChange 에서 명시적 초기화.

## 5. 롤백
- 단일 commit 으로 묶기. 문제 시 직전 sha (`b3c16e4`) 로 docker image 태그 롤백.

## 6. 일정
- Phase A 30분 / Phase B 1시간 / Phase C 15분 / Phase D 30분
- 사용자 승인 후 시작
