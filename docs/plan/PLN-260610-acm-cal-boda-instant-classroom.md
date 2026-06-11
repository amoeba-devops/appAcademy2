---
document_id: PLN-260610-acm-cal-boda-instant-classroom
version: 1.0.0
status: draft
created: 2026-06-10
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260610-acm-cal-boda-instant-classroom.md (v1.0.0)
  - docs/plan/PLN-260526-acm-cal-boda-integration.md (v1.0.0)
change_log:
  - 2026-06-10: v1.0.0 draft — 5 트랙 MVP plan
---

# 작업 계획서 — 즉시 개설 화상 강의 (REQ-260610)

> **One-liner**: REQ-260610 의 8 FR / 9 AC 를 6 트랙 / 약 9 시간으로 구현. 신규 코드 최소화 — 기존 BODA T1–T7 인프라 100% 재사용.

---

## 1. 트랙 요약 (Track summary)

| 트랙 | 내용 | 예상 시간 | 의존 | 산출물 |
|---|---|---|---|---|
| **T1** | DB schema — `cal_event.evt_source` 컬럼 추가 + 기본값 마이그레이션 | 0.5h | — | SQL 1개 |
| **T2** | BE — `InstantEventService` + `POST /api/admin/cal/events/instant` (1 endpoint, BODA 룸 자동 발급 + invitee 즉시 알림) | 2.5h | T1 | service + controller + DTO + 6 tests |
| **T3** | BE — `GET /api/admin/cal/invitee-suggestions` (강사 본인 클래스 + 최근 7일 기반 추천) | 1.5h | — | service + controller + 4 tests |
| **T4** | FE — `InstantClassModal` 컴포넌트 + 캘린더 헤더 진입 버튼 | 2h | T2/T3 | modal + button + react-query 훅 + i18n × 4 |
| **T5** | FE — 런처 페이지 `autoStart=1` 자동 진입 + 학생 시간표 LIVE 카드 | 1.5h | — | web-classroom-page 확장 + my/timetable 분기 + i18n |
| **T6** | E2E + 빌드 + commit + 스테이징 smoke + RPT 작성 | 1h | T1–T5 | RPT-260610B + green CI |

**합계: ~9h** (mock-first — 벤더 추가 의존 없음).

---

## 2. 트랙별 세부 작업

### T1. DB schema (0.5h)

#### T1-01. 마이그레이션 SQL
- **파일**: `sql/acm/920-acm-cal-event-source.sql`
- **DDL**:
  ```sql
  ALTER TABLE amb_acm_cal_event
    ADD COLUMN evt_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
    CHECK (evt_source IN ('MANUAL', 'INSTANT', 'RECURRING'));
  -- 기존 행은 모두 MANUAL 로 채워짐 (default).
  CREATE INDEX idx_acm_cal_event_source_owner
    ON amb_acm_cal_event(ent_id, evt_source, evt_owner_user_id);
  ```
- **위치**: `acm-pg` (PostgreSQL `db_acm`). `ACM_DS` 데이터소스.

#### T1-02. TypeORM 엔티티 확장
- `backend/src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity.ts` 에 `evtSource` 컬럼 매핑 (`type: 'varchar', default: 'MANUAL'`).
- type union: `'MANUAL' | 'INSTANT' | 'RECURRING'`.

---

### T2. Instant event 백엔드 (2.5h)

#### T2-01. DTO
- **파일**: `backend/src/modules/acm-cal/application/dto/instant-event.dto.ts`
- **요청**:
  ```ts
  export class CreateInstantEventDto {
    @IsString() @IsOptional() title?: string;
    @IsInt() @IsIn([30, 60, 90, 120]) durationMin!: 30 | 60 | 90 | 120;
    @IsArray() invitees!: Array<{ kind: 'STUDENT' | 'TEACHER' | 'PARENT'; refId: string }>;
  }
  ```
- **응답**:
  ```ts
  export class CreateInstantEventResponseDto {
    evtId!: string;
    launcherUrl!: string;       // /web/classroom/{evtId}?autoStart=1
    meetKey!: string;
    invitedCount!: number;
    notifyResult: { sent; failed; skipped };
  }
  ```

#### T2-02. Service
- **파일**: `application/instant-event.service.ts`
- 책임: 기본값 채우기 → `CalEventService.create()` 호출 → 응답 가공.
- 기본값:
  - `title` → `"즉시 강의 - {ownerName} HH:mm"` (locale 별로 다를 수 있어 prefix 만 i18n 키, name + time 은 그대로 삽입)
  - `evtStartAt` = now
  - `evtEndAt` = now + durationMin
  - `evtCategory` = `'CLASS'`
  - `evtMeetingProvider` = `'BODASCHOOL'`
  - `evtSource` = `'INSTANT'`
- idempotency:
  - HTTP 헤더 `X-Idempotency-Key`(UUID) 보존. 같은 키 + 같은 작성자 + 10분 이내 요청이면 기존 evtId 반환 (Redis SET NX EX 600).
- 응답 가공:
  - `launcherUrl` = `${FRONTEND_URL}/web/classroom/{evtId}?autoStart=1` (cal-event.service 가 반환한 룸 URL 에 쿼리 부착).

#### T2-03. Controller
- **파일**: `presentation/instant-event.controller.ts`
- 라우트: `POST /api/admin/cal/events/instant`
- 가드: `JwtAuthGuard` + `OwnEntityGuard` + `Roles('TEACHER', 'ADMIN')`
- Throttle: 10 req / min / user (즉시 개설 남발 방지).

#### T2-04. 테스트
- `instant-event.service.spec.ts` — 6 specs:
  1. 기본값 채우기 (title 비움) → 자동 제목 생성
  2. 지정 invitees 가 그대로 cal-event.create 에 전달
  3. evtSource='INSTANT' + provider='BODASCHOOL' 강제
  4. launcherUrl 에 `?autoStart=1` 부착
  5. idempotency-key 재사용 시 같은 evtId 반환, cal-event.create 1회만
  6. cal-event.create 가 예외 시 propagate

#### T2-05. 모듈 등록
- `acm-cal.module.ts` 의 controllers / providers 에 추가.

---

### T3. Invitee suggestions (1.5h)

#### T3-01. Service
- **파일**: `application/invitee-suggestions.service.ts`
- 메서드 `suggest({ entId, teacherUserId, limit=12 })`:
  1. 본 강사 담당 활성 클래스 멤버 (CLS `cls_class` join `cls_class_teacher` + `cls_class_student`).
  2. 최근 7일 본 강사 caleventowner 의 invitee 학생 (출현 빈도 desc).
  3. 두 집합 merge + 중복 제거 + 상위 limit 반환.
- 반환: `Array<{ kind: 'STUDENT'; refId: string; name: string; subLabel: string; reason: 'CLASS' | 'RECENT' }>`

#### T3-02. Controller
- **파일**: `presentation/invitee-suggestions.controller.ts`
- 라우트: `GET /api/admin/cal/invitee-suggestions?limit=12`
- 가드: 동일 (TEACHER/ADMIN).

#### T3-03. 테스트
- `invitee-suggestions.service.spec.ts` — 4 specs:
  1. 클래스 멤버만 있을 때 모두 반환
  2. 최근 7일 invitee 만 있을 때 빈도순 정렬
  3. 두 집합 겹칠 때 중복 제거 + class reason 우선
  4. limit 초과 시 잘림

---

### T4. Frontend — Instant class modal (2h)

#### T4-01. React Query 훅
- **파일**: `frontend-acm/src/modules/cal/hooks/use-instant-event.ts`
- `useCreateInstantEvent()` 뮤테이션 + `useInviteeSuggestions(limit)` 쿼리.
- 뮤테이션 헤더에 `X-Idempotency-Key`(crypto.randomUUID()) 자동 부착.

#### T4-02. 모달 컴포넌트
- **파일**: `frontend-acm/src/modules/cal/components/instant-class-modal.tsx`
- 구조 (REQ §7.2):
  - 제목 input (placeholder 만, 비워두면 백엔드가 자동 생성)
  - durationMin 라디오 4개 (30/60/**90**/120)
  - 추천 학생 그리드 (12명, 클래스명 sub-label, 체크박스 다중 선택)
  - 검색 input (focus 시 추천 그리드 → 검색 결과로 교체)
  - "강의 시작" 버튼 → 뮤테이션 호출 → 응답의 `launcherUrl` 을 `window.open()` 새 탭 → 모달 닫기.
- i18n keys: `cal.instant.*` (sectionTitle, durationLabel, durationOption.*, suggestionsLabel, recentLabel, classLabel, startBtn, hint*).

#### T4-03. 캘린더 헤더 진입 버튼
- `pages/cal-month-page.tsx` 의 헤더에 `⚡ 즉시 강의 개설` 버튼 추가 (기존 `+ 일정 등록` 옆).
- 권한 분기: `currentUser.role === 'ADMIN' || 'TEACHER'` 일 때만 렌더.

#### T4-04. 캘린더 그리드 INSTANT 아이콘
- `pages/cal-month-page.tsx` 의 이벤트 칩에 `evt.source === 'INSTANT'` 면 ⚡ prefix.

#### T4-05. i18n × 4 locale
- ko / en / vi / zh-CN 의 `cal.json` 에 `instant.*` 키 추가 (≈ 12 scalar).

---

### T5. Frontend — Auto-start + LIVE 카드 (1.5h)

#### T5-01. Web classroom page autoStart
- `frontend-acm/src/modules/web/pages/web-classroom-page.tsx` 의 useEffect 에:
  ```ts
  const { searchParams } = useLocation();
  const autoStart = searchParams.get('autoStart') === '1';
  useEffect(() => {
    if (autoStart && ctx?.userType === 11 && ctx.status === 'PENDING') {
      // 자동으로 bodaOpen() 호출
      handleStartClass();
    }
  }, [autoStart, ctx?.status]);
  ```
- "강의를 시작합니다..." 임시 화면을 짧게 노출 (1초 정도).

#### T5-02. 학생 시간표 LIVE 카드
- `frontend-acm/src/modules/my/pages/timetable-page.tsx` 의 이벤트 카드:
  - `evt.source === 'INSTANT'` + 현재시각이 startAt/endAt 사이 → 빨간 `🔴 LIVE` 뱃지 + 상단 강조.
  - "지금 입장하기" 버튼 (기존 입장 버튼과 동일 동작, 더 강조된 스타일).
- i18n: `my.timetable.live.*` (badge, ctaBtn, ctaHint).

#### T5-03. i18n × 4 locale
- 학생용 키 추가.

---

### T6. 통합 검증 + commit + 배포 (1h)

#### T6-01. E2E manual 시나리오
- 강사 계정으로 즉시 개설 → 새 탭 자동 진입 → BODA mock 룸 → 학생 알림 enqueued 로그 확인.
- 학생 계정으로 시간표 진입 → LIVE 카드 표시 → 입장 → 런처 정상 진입.

#### T6-02. 빌드 + 테스트
- `npm run build` (BE + FE) green.
- BODA spec 98 + Instant 10 (T2 6 + T3 4) = **108** all pass.

#### T6-03. commit + push
- Conventional commits: `feat(acm-cal): T1-T6 BODA instant classroom (REQ-260610)`.

#### T6-04. cd-staging 자동 빌드 대기 + smoke
- `POST /api/admin/cal/events/instant` 404→401 (JWT 없이) 확인.
- `GET /api/admin/cal/invitee-suggestions` 401 확인.

#### T6-05. RPT-260610B 작성
- 본 매뉴얼 & FAQ 갱신 (LIVE 카드 + 즉시 개설 흐름).

---

## 3. Data flow diagram

```
[강사] ──"강의 시작" 클릭──┐
                            ▼
┌──────────── frontend-acm ────────────┐
│ POST /api/admin/cal/events/instant   │
│   X-Idempotency-Key: <uuid>          │
│   body: { title?, durationMin,       │
│           invitees: [...] }          │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌────────── backend NestJS ────────────┐
│ InstantEventController (Throttle 10/min)│
│   ↓                                    │
│ InstantEventService.create()           │
│   ├ idempotency check (Redis SET NX)   │
│   ├ defaults 채우기                    │
│   ├ CalEventService.create() ─────────┐│
│   │    ├ amb_acm_cal_event INSERT   ─┘│
│   │    ├ BodaRoomService.createPending()│
│   │    │    └ amb_acm_cal_boda_room ─┐│
│   │    └ amb_acm_cal_invitee INSERT  ││
│   │       + InviteeNotifierService   ││
│   └ launcherUrl + autoStart=1 부착   ││
└────────────────┬─────────────────────┘│
                 │ 200 OK                │
                 │ { evtId, launcherUrl }│
                 ▼                        │
[강사 브라우저] ──window.open(launcherUrl, '_blank')──┐
                                                      ▼
                          ┌───── /web/classroom/{evtId}?autoStart=1 ─────┐
                          │ WebClassroomPage                              │
                          │   ↳ autoStart=1 & owner & PENDING            │
                          │     → handleStartClass()                     │
                          │     → loadBodaAppApi() + bodaOpen()          │
                          └──────────────────────────────────────────────┘
                                          │
                                          ▼
                          BODA Client (new desktop window)
                                          │
                                          ▼
                          BODA Webhook → /api/webhooks/boda (이벤트 1)
                                          │
                                          ▼
                          BodaWebhookService → applyEvent → room.status = OPEN
                                          │
                                          ▼
                          [학생] /my/timetable LIVE 카드 (10s 폴링)
                                          │
                                          ▼
                          /web/classroom/{evtId} (autoStart 없음, 학생 흐름)
                                          │
                                          ▼
                          BodaAppApi.bodaJoin() → BODA Client
```

---

## 4. 영향받는 파일 (영향 분석 - 구현 전 확인용)

### 4.1 신규 (10)
| 파일 | 트랙 |
|---|---|
| `sql/acm/920-acm-cal-event-source.sql` | T1 |
| `backend/src/modules/acm-cal/application/instant-event.service.ts` | T2 |
| `backend/src/modules/acm-cal/application/instant-event.service.spec.ts` | T2 |
| `backend/src/modules/acm-cal/application/dto/instant-event.dto.ts` | T2 |
| `backend/src/modules/acm-cal/presentation/instant-event.controller.ts` | T2 |
| `backend/src/modules/acm-cal/application/invitee-suggestions.service.ts` | T3 |
| `backend/src/modules/acm-cal/application/invitee-suggestions.service.spec.ts` | T3 |
| `backend/src/modules/acm-cal/presentation/invitee-suggestions.controller.ts` | T3 |
| `frontend-acm/src/modules/cal/components/instant-class-modal.tsx` | T4 |
| `frontend-acm/src/modules/cal/hooks/use-instant-event.ts` | T4 |

### 4.2 수정 (8)
| 파일 | 트랙 |
|---|---|
| `backend/src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity.ts` (evtSource 컬럼) | T1 |
| `backend/src/modules/acm-cal/acm-cal.module.ts` (3 신규 provider/controller) | T2/T3 |
| `frontend-acm/src/modules/cal/pages/cal-month-page.tsx` (헤더 버튼 + ⚡ 칩) | T4 |
| `frontend-acm/src/modules/web/pages/web-classroom-page.tsx` (autoStart 분기) | T5 |
| `frontend-acm/src/modules/my/pages/timetable-page.tsx` (LIVE 카드) | T5 |
| `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/cal.json` (instant.* 키 + my.timetable.live.*) | T4/T5 |

### 4.3 미변경
- BODA 4 테이블, BodaWebhookService, BodaReconcileService, BodaRoomService, InviteeNotifierService.

---

## 5. 위험 + 완화

| 위험 | 완화 |
|---|---|
| 강사가 즉시 개설 버튼 남발 → BODA 룸 다수 발급 | Throttle 10/min/user + idempotency-key. |
| 학생 알림이 INSTANT 라는 점을 인지 못함 → 정규 수업 누락 우려 | 알림 본문에 "즉시 강의" 명시 + LIVE 뱃지 / ⚡ 아이콘. |
| 즉시 개설 직후 BODA SERVER API 호출이 늘어남 | 현재 호출은 webhook 수신뿐 — 룸 생성 자체는 강사 클라이언트가 BODA 측에 직접 호출. SERVER API 부하 증가 없음. |
| 학생이 늦게 입장하려는데 강사가 이미 종료 | 기존 시간창 정책 + reconcile cron 으로 처리. AC-INSTANT-5. |
| evt_source 컬럼 추가 마이그레이션 vs 기존 데이터 충돌 | DEFAULT 'MANUAL' + CHECK 제약 — 기존 모든 행 자동 채워짐, 무중단. |

---

## 6. Done 정의

- [ ] T1 마이그레이션 적용 (acm-pg).
- [ ] T2 endpoint POST /api/admin/cal/events/instant 동작 (BODA mock 환경에서 룸 PENDING 발급 확인).
- [ ] T3 추천 endpoint 가 12개 이내 학생 반환.
- [ ] T4 모달이 3 위치 (캘린더 헤더, 대시보드, 헤더 빠른액션) 중 최소 1 위치 (캘린더 헤더 우선) 에서 동작.
- [ ] T5 autoStart=1 자동 진입 + LIVE 카드 학생 화면에 노출.
- [ ] T6 BE+FE build clean, BODA + Instant specs 100% pass, staging smoke 통과.
- [ ] AC-INSTANT-1 ~ 9 모두 통과.
- [ ] i18n 4 locale 누락 없음.

---

## 7. Next step

본 PLN 은 **draft**. 사용자(운영자) 가 REQ + PLN 양쪽을 검토하고 **승인** 하면 T1 → T6 순으로 진행.

미결 사항 (REQ §9) 중 Q-INSTANT-1 (custom duration) 만 작업 진행 중 결정해도 무방. 나머지 Q-INSTANT-2/3/4 는 본 MVP 의 동작에 영향 없음 — 추후 v1.1 에서 별도 처리.
