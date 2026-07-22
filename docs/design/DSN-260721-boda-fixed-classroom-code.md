---
document_id: DSN-260721-boda-fixed-classroom-code
version: 1.0.0
status: draft
created: 2026-07-21
authors:
  - Claude (Opus 4.8)
related:
  - docs/analysis/REQ-260610-acm-cal-boda-instant-classroom.md (즉시 강의 — 이벤트 종속)
  - docs/implementation/RPT-260610-acm-cal-boda-integration.md (BODA T1–T7 인프라)
  - docs/implementation/RPT-260624-boda-status-check.md (컷오버 상태)
  - docs/reference/BODA-vendor-roomcode-request-260721.md (roomCode 추가발급 요청)
  - docs/report/체크리스트-보다스쿨-설정.md (webhook 미연동 blocker)
change_log:
  - 2026-07-21: v1.0.0 draft — 이벤트 비종속 영구 고정코드 강의실 설계안
---

# 설계안 — 이벤트 비종속 영구 고정코드 강의실 (Fixed BODA Classroom)

> **One-liner**: 캘린더 이벤트에 묶이지 않고, **강의장(반)마다 영구 고정된 입장 코드(고정 `meetKey`) 하나**로
> 강사가 예약 시각 없이 즉시 방을 열고 학생이 상시 입장하는 강의실. BODA 벤더의 고정 `roomCode`(699) +
> `dup=1` 위에 우리 고정 `meetKey` 를 pin 하는 방식.

---

## 1. Overview (개요)

### 1.1 배경
- [REQ-260610 즉시 강의](../analysis/REQ-260610-acm-cal-boda-instant-classroom.md) 로 "시간 입력 없는 즉시 개설" UX 는 이미 배포됨. **그러나 즉시 강의도 매번 새 `cal_event` + 새 `meetKey`(`tac-{evt_id}`) 를 발급**한다 — 링크가 매번 바뀌므로 "고정 강의실 주소" 가 아니다.
- 벤더 역량 확인 결과 BODA 는 **입장 시간창 개념이 없고**(강사 `bodaOpen` = 즉시 OPEN), `roomCode`(699)는 이미 고정·재사용 값이다. 즉 **영구 고정코드 강의실을 막는 것은 벤더가 아니라 우리 코드의 두 가지 자체 컨벤션**이다.

### 1.2 목표
강의장(반) 또는 강사 단위로 **변하지 않는 입장 코드/URL 1개**를 발급하여:
- 강사: 그 URL 을 누르면 예약·이벤트 생성 없이 즉시 방 OPEN.
- 학생: 같은 URL 을 상시 보유 — 강사가 열면 입장, 닫혀 있으면 대기.
- 출결·webhook·종료·reconcile 은 기존 BODA T1–T7 인프라 **그대로 재사용**.

### 1.3 비목표 (Out of scope)
- 정규 시간표 수업(이벤트 종속) 대체 — 기존 캘린더/즉시강의 흐름 유지, 본 기능은 **추가** 채널.
- BODA 외 vendor 고정 강의실.
- roomCode 를 강의장마다 분리 발급(현재 699 단일) — 벤더 D1 회신 후 별도. 본 설계는 **roomCode 1개 + 고정 meetKey N개** 를 기본으로 한다.

---

## 2. 현재 제약 2가지 (근본 원인)

| # | 제약 | 위치 | 성격 |
|---|------|------|------|
| **(a)** | `meetKey = tac-{evt_id}` 로 하드 파생 + 방은 오직 `cal-event.service.create(BODASCHOOL)` 에서만 생성. `boda_room` 에 `UNIQUE(evt_id)` NOT NULL. | [boda-room.service.ts:26-33, 80-129](../../backend/src/modules/acm-cal/application/boda-room.service.ts#L26-L33), [boda-room.typeorm-entity.ts:30,40](../../backend/src/modules/acm-cal/infrastructure/typeorm/boda-room.typeorm-entity.ts#L30-L41) | **우리 컨벤션** — 이벤트 없이는 방(meetKey) 자체가 존재 불가 |
| **(b)** | 런처 입장 시 `assertTimeWindow()` — `[startAt−10m, endAt+15m]` 밖이면 `403 BODA_LAUNCH_OUT_OF_WINDOW`. | [boda-launch-context.service.ts:530-553](../../backend/src/modules/acm-cal/application/boda-launch-context.service.ts#L530-L553) | **우리 컨벤션** — 이벤트의 시각에 종속 |

> **핵심 지렛대**: Webhook 수신·상태전이·reconcile·강제폐쇄는 모두 **`meetKey` 로 방을 조회**한다
> (`findByMeetKey` [boda-room.service.ts:166](../../backend/src/modules/acm-cal/application/boda-room.service.ts#L166), reconcile/close 동일). `evt_id` 에 의존하지 않는다.
> → **`evt_id` 없는 방 row 를 만들고 안정적 `meetKey` 만 부여하면 전체 라이프사이클 인프라가 무수정 재사용된다.**

---

## 3. 설계 결정 — Option B (boda_room 재사용) 채택

두 후보를 비교했다.

| | Option A — 신규 `boda_fixed_room` 테이블 | **Option B — `boda_room` 에 FIXED 종류 추가 (채택)** |
|---|---|---|
| 라이프사이클(webhook/reconcile/close) | 별도 재구현 필요 | **무수정 재사용** (meetKey 기반) |
| 스키마 변경 | 신규 테이블 + 신규 상태머신 | `evt_id` nullable + partial unique 1건 |
| 위험 | 상태전이 중복 구현 → drift | 기존 경로 회귀 위험(제약 완화) |
| 결론 | ✗ | **✓ — 인프라 재사용 이득이 압도적** |

### 3.1 스키마 변경 (`amb_acm_cal_boda_room`)
```sql
-- 마이그레이션: sql/acm/9XX-acm-cal-boda-fixed-room.sql (멱등)
ALTER TABLE amb_acm_cal_boda_room ALTER COLUMN evt_id DROP NOT NULL;      -- (a) 완화

-- 기존 UNIQUE(evt_id) → evt_id 있는 행에만 적용 (FIXED 행은 evt_id NULL 다수 허용)
DROP INDEX IF EXISTS uq_acm_boda_room_evt;
CREATE UNIQUE INDEX uq_acm_boda_room_evt
  ON amb_acm_cal_boda_room (evt_id) WHERE evt_id IS NOT NULL;

-- 방 종류 + 고정 강의실 소유/제목
ALTER TABLE amb_acm_cal_boda_room
  ADD COLUMN IF NOT EXISTS bdr_kind  VARCHAR(10) NOT NULL DEFAULT 'EVENT'  -- 'EVENT' | 'FIXED'
    CHECK (bdr_kind IN ('EVENT','FIXED')),
  ADD COLUMN IF NOT EXISTS bdr_owner_user_id UUID,          -- FIXED: 담당 강사
  ADD COLUMN IF NOT EXISTS bdr_title VARCHAR(200);          -- FIXED: 강의장 이름

-- FIXED 는 (ent_id, owner) 당 1개 (강사 1인 = 고정 강의실 1개; 다강의장은 후속)
CREATE UNIQUE INDEX uq_acm_boda_room_fixed_owner
  ON amb_acm_cal_boda_room (ent_id, bdr_owner_user_id)
  WHERE bdr_kind = 'FIXED';
```
- `UNIQUE(meet_key)`(`uq_acm_boda_room_meet_key`) **유지** — meetKey 는 EVENT/FIXED 통틀어 전역 유일.
- FIXED 행은 `evt_id IS NULL`, `bdr_kind='FIXED'`, `bdr_owner_user_id`·`bdr_title` 채움.

### 3.2 고정 meetKey 포맷
```
FIXED:  tac-fix-{16 hex}     예) tac-fix-a1b2c3d4e5f60718   ← 생성 시 1회 발급, 영구 불변·재사용
EVENT:  tac-{evt_id 32 hex}  (기존 유지)
```
- `makeMeetKey` 는 EVENT 전용으로 남기고, FIXED 는 `makeFixedMeetKey()` 신규(랜덤 16 hex).
- roomCode 는 `config.defaultRoomCode`(699) 를 EVENT 와 동일하게 복사.

### 3.3 신규 서비스 — `BodaFixedRoomService`
```ts
// application/boda-fixed-room.service.ts
getOrCreate(input: { entId; ownerUserId; title? }): Promise<BodaRoom>
  // (ent_id, owner) 로 조회 → 있으면 반환, 없으면 FIXED 행 INSERT (meetKey 고정 발급)
resetForReopen(meetKey): Promise<void>
  // ENDED/CLOSED FIXED 방을 재개설 가능 상태로 리셋 (meetIdx=NULL, status=PENDING, 타임스탬프 클리어)
```
- `createPending` 의 로직(roomCode 결정·config isActive 검사)은 공유 헬퍼로 추출해 재사용.

### 3.4 런처/입장 — 시간창 우회 (b)
- 신규 컨텍스트 빌더 `buildForFixed(roomId | ownerUserId, actor)`:
  - EVENT 경로의 `loadAndAuthorize` + `assertTimeWindow` 를 **호출하지 않는다**(이벤트/시각 없음).
  - 인가: `bdr_owner_user_id === actor` → 강사(UTy 11, `bodaOpen`). 그 외 인가된 학생 → UTy 12(`bodaJoin`). (인가 소스는 §4 참조)
  - 반환 payload 는 기존 `BodaLaunchContext` 와 동일 형태 → 프론트 런처/`enterBodaRoom` 무수정 재사용.

### 3.5 라이프사이클 재사용 (무변경)
- 강사 `bodaOpen` → 벤더 `ROOM_OPENED`(evt 1) → Webhook 이 `findByMeetKey` 로 FIXED 방 찾아 `meetIdx` 캐시 + `OPEN`.
- 종료(evt 4/5/10) → `ENDED`/`CLOSED`. **FIXED 방은 여기서 `resetForReopen`** 을 태워 재사용 가능 상태로 되돌린다(reconcile cron 또는 다음 개설 시 lazy reset).

---

## 4. 학생 입장 대안 (Student entry) — 핵심 난제

고정 강의실이라도 **`meetIdx` 는 강사가 열 때마다 벤더가 새로 발급**하고 **Webhook 으로만 전달**된다. 학생 입장은 아래 3단 fallback 으로 설계한다.

| 우선 | 방식 | 조건 | 상태 |
|:---:|------|------|:---:|
| **1** | **JOIN_IDX (정석)** — 캐시된 `meetIdx` 로 `bodaJoin({ meetKey, meetIdx })` | Webhook 연동(A1·A2) → `meetIdx` 채워짐 | webhook 컷오버 시 자동 동작 |
| **2** | **JOIN_KEY** — `bodaJoin({ meetKey })` 만으로 입장 (meetIdx 불필요) | 벤더 A4/⑤ "meetKey-only 입장 허용" 회신 | 🔴 벤더 미확인 |
| **3** | **Soft-gate 폴링 (현행 패턴 재사용)** — 학생 런처가 입장 카드 노출 + `PENDING` 동안 컨텍스트 재폴링, `OPEN`+`meetIdx` 되면 입장 활성화 | 항상 (1·2 미비 시 UX 방어) | 이미 구현됨([체크리스트 §2 #6·#7](../report/체크리스트-보다스쿨-설정.md)) |

- **결론**: 학생 입장의 완결은 **①(webhook 컷오버)에 여전히 종속**. 고정코드 기능이 이 blocker 를 없애지는 못한다 — 강사 즉시 개설만 이벤트에서 해방한다. ②가 벤더에서 열리면 webhook 없이도 학생 입장이 가능해져 blocker 가 해소된다.
- 런처는 §3.4 의 폴링 로직을 FIXED 에도 적용: `refetchInterval` 이 `PENDING` 동안 10s 재조회([boda-launch-api.ts:90-92](../../frontend-acm/src/lib/boda-launch-api.ts#L90-L92)) — FIXED 방도 그대로 재사용.

---

## 5. API 변경

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| POST | `/api/admin/cal/boda/fixed-room` | JWT + `TEACHER`\|`ADMIN` | 내 고정 강의실 getOrCreate → `{ roomId, meetKey, launcherUrl }` |
| GET | `/api/cal/boda/fixed-launch-context?roomId=&lang=` | JWT (콘솔) | 강사/운영자 런처 컨텍스트 (시간창 없음) |
| GET | `/api/portal/cal/boda/fixed-launch-context?roomId=&lang=` | JWT (포털) | 학생/강사 포털 런처 컨텍스트 |
| GET | `/api/portal/cal/boda/fixed-rooms` | JWT (포털) | 내가 입장 가능한 고정 강의실 목록(학생) |

- `launcherUrl = /portal/classroom/fixed/{roomId}` (기존 `/portal/classroom/:evtId` 런처에 `fixed` 분기 추가, 세션 겸용).
- 강사 진입 시 `?autoStart=1` 로 자동 `bodaOpen` (즉시강의와 동일 패턴).

---

## 6. 학생 인가 소스 (누가 이 고정 강의실에 들어올 수 있나)

이벤트 invitee 가 없으므로 **수강 관계**로 인가한다.
- **CLS 수강반 기반**: FIXED 방 `owner`(강사)가 담당하는 활성 클래스의 학생 → 입장 허용. (기존 즉시강의 추천 로직 [invitee-suggestions](../../backend/src/modules/acm-cal/application/instant-event.service.ts) 의 `cls_teacher` join 재사용.)
- 옵션(후속): FIXED 방에 명시적 화이트리스트(`boda_fixed_room_member`) 부여 — v1.1.

---

## 7. UI 목업 (텍스트)

### 7.1 강사 — 고정 강의실 카드 (`/admin/dashboard` 또는 `/admin/cal` 헤더)
```
┌──────────────────────────────────────────────────────────┐
│ 🏫 내 고정 강의실                                          │
│ ────────────────────────────────────────────────────────  │
│ 김교사 강의실                                              │
│ 고정주소: acm.amoeba.site/portal/classroom/fixed/…  [복사] │
│ 상태: ● 닫힘                                               │
│                                        [지금 강의 시작 ⚡] │
└──────────────────────────────────────────────────────────┘
```

### 7.2 학생 — 시간표/포털의 상시 강의실 카드
```
┌──────────────────────────────────────────────────────────┐
│ 🏫 김교사 강의실 (상시)                                    │
│ 상태: ● 닫힘 — 강사가 열면 입장 버튼이 활성화됩니다        │
│                                        [입장 대기 중…]     │
└──────────────────────────────────────────────────────────┘
        ▼ (강사 개설 → webhook OPEN + meetIdx)
┌──────────────────────────────────────────────────────────┐
│ 🏫 김교사 강의실 (상시)         🔴 LIVE                    │
│ 상태: ● 열림                                               │
│                                        [지금 입장하기 →]   │
└──────────────────────────────────────────────────────────┘
```

---

## 8. 마이그레이션 & 롤아웃

1. `sql/acm/9XX-acm-cal-boda-fixed-room.sql` — §3.1 (멱등, CD 자동 적용).
2. 기존 EVENT 방은 `bdr_kind` 기본값 `'EVENT'` 로 무영향. `evt_id` NOT NULL 완화는 기존 데이터 안전(모두 값 있음).
3. `BODA_MODE=mock` 에서 FIXED 방 개설/폴링 동작 시연 → webhook 컷오버(`http`) 후 학생 JOIN_IDX 검증.
4. 기능 플래그 `BODA_FIXED_ROOM_ENABLED`(기본 false) 로 감싸 점진 릴리스.

---

## 9. 위험 & 미결 (Risks / Open questions)

| ID | 항목 | 영향 | 조치 |
|---|---|---|---|
| **R-1** | **고정 `meetKey` 재사용을 벤더가 허용하는가** — 종료된 방과 같은 meetKey 로 재개설 시 충돌 가능성. RPT-260610 §3.2 는 meetKey 를 "룸 재생성 시 충돌 방지" 로 설명 → **재사용이 막힐 수 있음**. | 막히면 §3.2 고정 meetKey 전제 붕괴 | **벤더 ⑤ 회신 선결** ([roomCode-request-260721 §2 ⑤](../reference/BODA-vendor-roomcode-request-260721.md)). 불가 시 fallback: FIXED 방은 고정 `roomId` 만 유지하고 **개설마다 새 meetKey 발급**(URL 은 roomId 로 고정, 내부 meetKey 는 회전) |
| R-2 | 학생 입장이 webhook(①)에 여전히 종속 | 강사 개설은 해방되나 학생 완결은 미완 | §4 fallback 3단 + 벤더 ② JOIN_KEY 요청 |
| R-3 | `dup=1` 동시 방 수용량 한계 | 동시 다강의장 개설 시 실패 가능 | 벤더 ③ 회신 → throttle/안내 |
| R-4 | 상시 방 = 무단 입장 위험(코드 유출) | 학생 아닌 자 입장 | §6 CLS 수강 인가 필수 + (옵션) roomPwd |
| R-5 | 종료 후 상태 리셋 경합 | reconcile vs 재개설 race | `resetForReopen` 를 lazy(다음 개설 시) + cron 이중 안전망 |

---

## 10. Sign-off (승인 대기)

- 본 문서는 **draft** 이며, CLAUDE.md §9.2 에 따라 **사용자 확인 후 PLN(구현계획) 진입**한다.
- **선결 조건**: R-1(고정 meetKey 재사용 가부) 벤더 회신 — 이 결과에 따라 §3.2 가 "고정 meetKey" 또는 "고정 roomId + 회전 meetKey" 로 갈린다. 회신 전 구현 착수 시 R-1 fallback 설계를 기본으로 잡을 것을 권장.
</content>
