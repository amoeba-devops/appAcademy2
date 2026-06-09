---
document_id: PLN-260526-acm-cal-boda-integration
version: 1.0.0
status: draft
created: 2026-06-08
authors:
  - gray.kim@amoeba.group
  - Claude Opus 4.7
related:
  - docs/analysis/REQ-260526-acm-cal-boda-integration.md (v2.0.0)
---

# 작업 계획서 — BODA(보다에듀) 화상 강의실 캘린더 연동 (PLN-260526)

> [REQ-260526 v2](../analysis/REQ-260526-acm-cal-boda-integration.md) 의 38 FR 을 **7 트랙 / 28 task** 으로 분해. Mock-first 진행 — ㈜새하컴즈 Q1·Q2 회신 + Webhook URL 등록 대기 동안에도 frontend / 백엔드 mock 모드로 staging E2E 가능.

---

## 1. 트랙 개요

```
T1   DB Schema (sql/acm/910)                   ~ 1h    BE
T1-01  4 신규 테이블 마이그레이션              0.4h
T1-02  기존 cal/cls 컬럼 재사용 검증           0.2h
T1-03  staging seed (단순 BODA config row)      0.2h
T1-04  staging deploy + migration               0.2h

T2   BodaEdu HTTP/Webhook Module               ~ 3h    BE
T2-01  bodaedu/ 모듈 scaffold + interfaces      0.3h
T2-02  Mock client (fixtures, BODA_MODE=mock)   0.5h
T2-03  Http client — SERVER API (Basic auth)    0.6h
T2-04  Webhook util — 공유비밀 헤더 + IP allow  0.4h
T2-05  Crypto util — AES-GCM (BYTEA) 암복호화   0.4h
T2-06  단위 테스트                              0.8h

T3   BODA-CFG (테넌트 설정 CRUD)               ~ 1.5h  BE
T3-01  BodaConfigService + repo                 0.4h
T3-02  Admin controller /api/admin/cal/boda/config 0.4h
T3-03  Response masking + DTO                   0.3h
T3-04  단위 테스트 + smoke                      0.4h

T4   BODA-ROOM 라이프사이클                    ~ 2h    BE
T4-01  BodaRoomService — create/update/delete   0.5h
T4-02  cal-event.service 통합 (BODASCHOOL 분기) 0.4h
T4-03  meetKey 생성 + 입장 URL 자동 채우기      0.3h
T4-04  Status state machine + transitions       0.4h
T4-05  단위 테스트                              0.4h

T5   BODA-LAUNCH (런처 페이지)                 ~ 3h    FE
T5-01  /web/classroom/:evtId 라우트 + 권한 가드 0.3h
T5-02  BodaAppApi.js loader (외부 스크립트)     0.3h
T5-03  launch-context API + 시간창 검증         0.5h
T5-04  강사: bodaOpen() 호출                    0.4h
T5-05  학생: bodaJoin() + 대기 폴링 (10s)       0.5h
T5-06  에러 콜백 + WebRTC 폴백 안내             0.4h
T5-07  i18n 4 locale + visual                   0.4h
T5-08  smoke test                               0.2h

T6   BODA-EVENT (Webhook 수신)                 ~ 2.5h  BE
T6-01  Webhook controller + DTO                 0.4h
T6-02  공유비밀 + IP allowlist verify           0.3h
T6-03  event_log 멱등 저장 + dedup unique       0.3h
T6-04  6 이벤트 (1·2·3·4·5·11·12) 도메인 핸들러 0.7h
T6-05  순서 역전 처리 (event_at 정렬)           0.3h
T6-06  단위 + E2E 테스트                        0.5h

T7   BODA-ATT (출결 reconcile) + ADMIN          ~ 2h    BE+FE
T7-01  reconcile cron (수업 종료 후 N분)         0.4h
T7-02  SERVER API /svr/meet/log/user/join 호출  0.3h
T7-03  cls_attendance UPSERT (멱등)             0.3h
T7-04  Admin /close + /reconcile 트리거 endpoint 0.3h
T7-05  Admin UI 버튼 (calendar event detail 모달)0.4h
T7-06  smoke                                    0.3h

T8 (외부 의존)   AMA-style follow-up           외부
T8-01  ㈜새하컴즈 Q1·Q2 회신 수신
T8-02  ㈜새하컴즈 측에 ACM Webhook URL 등록 의뢰
T8-03  자격증명 비대칭 채널 합의 + 운영자 env 입력
T8-04  BODA_MODE=mock → http 전환 + smoke
```

**합계 (T1-T7 mock-first)**: ≈ **15h** (2 working day, 단일 개발자). T8 외부 의존.

---

## 2. UI 목업

### 2.1 캘린더 이벤트 모달 — BODASCHOOL 선택 시 (T4)

```
┌── 수업 일정 등록 ────────────────────────────────────────────────┐
│                                                                  │
│  화상 미팅 ───────────────────────────────────────────────────   │
│  Provider:  [보다스쿨 ▾]                                          │
│                                                                  │
│  ✓ 보다스쿨 강의실이 자동 생성됩니다                              │
│    └→ 강사가 첫 입장하는 순간 BODA 서버에 룸이 개설됩니다         │
│    └→ 학생 입장 URL: /web/classroom/{이 이벤트의 id}              │
│                                                                  │
│  [미팅 URL 입력란 숨김 — 자동 생성]                               │
│                                                                  │
│  ───────────────────────────────────────────────────────────     │
│                              [  취소  ]   [  저장  ]              │
└──────────────────────────────────────────────────────────────────┘
```

`Provider=GOOGLE_MEET` 또는 `OTHER` 면 기존 수동 입력 UI 그대로.

### 2.2 런처 페이지 — 강사 클릭 시 (T5-04)

```
┌── /web/classroom/{evtId} ────────────────────────────────────────┐
│                                                                  │
│           Trinity Academy — 화상 강의실                          │
│                                                                  │
│  📚  영어 회화 — 김교사 × 학생A                                  │
│  ⏰  2026-06-10 15:00 ~ 16:00 (남은 시간: 8 분)                  │
│                                                                  │
│  ✨ 화상 강의실 입장 준비 완료                                   │
│                                                                  │
│         [  📹  강의실 입장 (강사)  →  ]                          │
│                                                                  │
│  ↳ "강의실 입장" 클릭 시 BODA Client 가 실행됩니다                │
│  ↳ 처음이라면 BODA Client 설치 후 자동 입장                       │
│                                                                  │
│                                                                  │
│  ⚠️ BODA Client 가 설치되어 있지 않다면?                           │
│      [  📥  설치 가이드  ]   [  🌐  WebRTC 로 입장 (Beta)  ]      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 학생 입장 — 강사 미입장 (PENDING) (T5-05)

```
┌── /web/classroom/{evtId} ────────────────────────────────────────┐
│                                                                  │
│  📚  영어 회화 — 김교사                                          │
│  ⏰  2026-06-10 15:00 ~ 16:00                                    │
│                                                                  │
│  ⏳ 선생님 입장 대기 중…                                          │
│         [  ⟳ 자동 새로고침 (10초마다)  ]                          │
│                                                                  │
│  선생님이 강의실을 여시면 자동으로 입장 버튼이 활성화됩니다.       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

상태 = `PENDING` 동안 10초 주기 `/api/cal/boda/rooms/{evtId}/status` 폴링.

### 2.4 학생 입장 — 강사 입장 후 (OPEN+) (T5-05)

```
┌── /web/classroom/{evtId} ────────────────────────────────────────┐
│                                                                  │
│  ✨ 선생님이 강의실에 입장했습니다                                │
│                                                                  │
│         [  📹  강의실 입장 (학생)  →  ]                          │
│                                                                  │
│  ↳ 클릭 시 BODA Client 가 실행되어 강의실에 입장합니다             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.5 시간창 외 차단 (T5-03)

```
┌── /web/classroom/{evtId} ────────────────────────────────────────┐
│                                                                  │
│  🚫  입장 가능 시간이 아닙니다                                    │
│                                                                  │
│  수업 시작 10분 전부터 종료 15분 후까지 입장하실 수 있습니다.      │
│  현재 시각: 2026-06-10 14:30  (입장 가능: 14:50 ~ 16:15)          │
│                                                                  │
│         [  ←  캘린더로 돌아가기  ]                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.6 어드민 — 강제 종료 / 재대조 (T7-05)

```
┌── 캘린더 이벤트 상세 (어드민 뷰) ─────────────────────────────────┐
│                                                                  │
│  📚  영어 회화 — 김교사                                          │
│  🎬  BODA 룸 상태:  STARTED  (개설: 15:00, 시작: 15:02)          │
│  👥  참여자:  김교사 (15:02-) · 학생A (15:05-)                   │
│                                                                  │
│  관리자 작업:                                                    │
│   [  📊  출결 재대조  ]   [  🛑  강의실 강제 종료  ]              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 데이터 흐름 (개념)

### 3.1 이벤트 생성 → 룸 발급

```
[Teacher Admin UI]
   evt_meeting_provider = BODASCHOOL  →  POST /api/acm/cal/events
                                            │
                                            ▼
                              cal-event.service.create(dto)
                                            │
                              ┌─────────────┴─────────────┐
                              │                            │
                  evt_meeting_url ← /web/classroom/{evtId}  bodaRoomService.create(evtId, entId)
                                            │                              │
                                            │                  INSERT boda_room status=PENDING
                                            │                              │
                                            ▼                              ▼
                                       SAVE event ─────────────────── meetKey = tac-{evtId hex}
```

### 3.2 강사 입장 → BODA 룸 실체화 → Webhook

```
[Teacher Browser]            [Backend]              [BODA APP API]      [BODA Server]   [Webhook]
   /classroom/:id
        │
        │  GET /api/cal/boda/launch-context  ──▶  Authz + 시간창 검증
        │                                          │
        │ ◀── { meetKey, roomCode, UTy=11, ... }   │
        │                                          │
        │  bodaOpen(meetKey, ...)  ───────────────────────────▶
        │                                                                 │
        │                                                          (룸 개설)
        │                                                                 │
        │                                                                 │  POST /api/webhooks/boda
        │                                                                 │     event=1, meetKey, meetIdx, ...
        │                                                                 ▼
        │                                                          공유비밀 검증
        │                                                          → boda_room.status=OPEN
        │                                                          → meet_idx 저장
        │                                                          → opened_at
```

### 3.3 학생 입장 (강사 후)

```
[Student Browser]
   /classroom/:id
        │
        │  GET /api/cal/boda/rooms/:id/status   →   { status: OPEN, ... }
        │                                          (PENDING 일 때는 10s 폴링)
        │
        │  [강의실 입장] 버튼 클릭
        │
        │  GET /api/cal/boda/launch-context     →  { meetKey, UTy=12, ... }
        │
        │  bodaJoin(meetKey, ...)
        │                                  ──────▶ BODA → Webhook event=11 (입장)
                                                              │
                                                              ▼
                                                    boda_participant 입장 행 신설
                                                    (CLS 회차 연계 시 cls_attendance UPSERT)
```

### 3.4 수업 종료 → reconcile

```
[Backend Cron — N분 후]
        │
        │  GET /svr/meet/log/user/join?meetKey=...   (Server API + Basic auth)
        │                                            │
        │  ◀── 권위 입퇴장 목록                       │
        │                                            │
        │  diff vs boda_event_log → 누락 보정
        │  cls_attendance UPSERT (멱등)
```

---

## 4. Task 상세 — 핵심 부분만

### T1-01 — `sql/acm/910-acm-cal-boda.sql`
4 신규 테이블 DDL (REQ §7). 키 제약:
- `amb_acm_cal_boda_config.ent_id` UNIQUE
- `amb_acm_cal_boda_room.evt_id` UNIQUE
- `amb_acm_cal_boda_event_log` UNIQUE `(meet_idx, event_code, event_at, COALESCE(user_id, ''))`

### T2-01 — Module scaffold
```
backend/src/infrastructure/external/bodaedu/
├── bodaedu.module.ts                         provider factory (mock|http)
├── bodaedu.types.ts                          DTOs
├── interfaces/
│   └── bodaedu-server-api.interface.ts       getMeetInfo / closeMeet / getJoinLog
├── infrastructure/
│   ├── bodaedu-server-mock.client.ts
│   └── bodaedu-server-http.client.ts         Basic auth + 5s timeout + 1 retry
├── webhook/
│   ├── bodaedu-webhook.controller.ts          POST /api/webhooks/boda
│   ├── bodaedu-event-shared-secret.util.ts    헤더 검증
│   └── bodaedu-webhook-allowlist.util.ts      출발지 IP 화이트리스트
└── crypto/
    ├── boda-credential.crypto.ts              AES-GCM encrypt/decrypt
    └── boda-credential.crypto.spec.ts
```

### T2-04 — Webhook util
```ts
// Verify shared-secret + IP allowlist; HMAC 격상 시 verifyAmaWebhook 패턴 차용
export function verifyBodaWebhook({
  sharedSecret,
  receivedToken,
  srcIp,
  allowedCidrs,
}: VerifyOpts): VerifyResult {
  if (receivedToken !== sharedSecret) return { ok: false, reason: 'TOKEN_MISMATCH' };
  if (!isIpInAllowlist(srcIp, allowedCidrs)) return { ok: false, reason: 'IP_NOT_ALLOWED' };
  return { ok: true };
}
```

### T3-02 — Admin config endpoint
```
GET /api/admin/cal/boda/config       — 비밀 마스킹, { authKey: "*****set", ... }
PUT /api/admin/cal/boda/config       — body { authKey?, eventSecret?, ... }
                                        → AES-GCM 암호화 후 BYTEA 저장
                                        → 응답에 비밀값 미포함 (감사 로그만)
```

### T4-02 — cal-event.service 통합
```diff
   async createEvent(dto, entId, actorUserId, actorRole) {
     this.validateMeeting(dto.evtMeetingProvider, dto.evtMeetingUrl);
+    // REQ-260526 FR-ROOM-1/2/4 — BODASCHOOL 분기
+    if (dto.evtMeetingProvider === 'BODASCHOOL') {
+      const evtId = generateEvtId();      // 또는 save 후 id 사용
+      dto.evtMeetingUrl = `${FRONTEND_URL}/web/classroom/${evtId}`;
+      const saved = await this.repo.save({ ...dto, id: evtId });
+      await this.bodaRoomService.createPending(saved, entId);
+      return saved;
+    }
     // ... 기존 manual URL 흐름
   }
```

### T5-03 — launch-context API
```
GET /api/cal/boda/launch-context?evtId=...
  → Auth: 세션 (ACM JWT) + invitee/owner 확인
  → 시간창 검증 (시작 -10m ~ 종료 +15m)
  → 비밀 NOT 노출
  → 응답: {
      meetKey: "tac-...",
      roomCode: "699",
      userType: 11|12,     # JWT role 기반
      UId: amaUserId,
      UNm: name,
      lang: locale,
      appApiUrl: BODA_WEB_URL + "/BodaAppApi.js",
      status: OPEN|PENDING|...
    }
```

### T6-03 — event_log dedup
```ts
@Entity('amb_acm_cal_boda_event_log')
@Unique(['meetIdx', 'eventCode', 'eventAt', 'userIdNorm'])
export class BodaEventLogEntity {
  // userIdNorm = userId ?? '' (NULL 허용 안 함, dedup 키로 사용)
}

// dedup 충돌 시 그냥 무시 (멱등)
try { await this.repo.save(log); }
catch (e) {
  if (isUniqueViolation(e)) return; // ignore — already processed
  throw e;
}
```

### T7-01 — reconcile cron
```ts
@Cron('0 */1 * * * *')  // 매 분
async runReconcile() {
  const rooms = await this.repo.find({
    where: {
      status: In(['ENDED', 'CLOSED']),
      reconciledAt: IsNull(),
      endedAt: LessThan(new Date(Date.now() - RECONCILE_DELAY_MS)),  // 10분 후
    },
    take: 50,
  });
  for (const room of rooms) {
    await this.bodaReconcileService.reconcile(room);
  }
}
```

---

## 5. 일정

```
Day 1 (단일 개발자)
  09:00 - 10:00  T1   DB schema + staging migration
  10:00 - 13:00  T2   BodaEdu module + mock + http + webhook + crypto + tests
  14:00 - 15:30  T3   BODA-CFG (admin endpoint + masking + tests)
  15:30 - 17:30  T4   BODA-ROOM lifecycle + cal-event 통합 + tests

Day 2
  09:00 - 12:00  T5   런처 페이지 (강사/학생 분기 + 폴링 + 에러 + i18n)
  13:00 - 15:30  T6   Webhook 수신 + 6 이벤트 + dedup + 테스트
  15:30 - 17:30  T7   reconcile + admin UI (close/reconcile 버튼)

Day 3 (검증)
  AM   staging smoke (mock 모드, full E2E — 일정 등록 → 런처 → status 폴링)
  PM   RPT 작성 + 시각 검수 권고

(T8 외부) ㈜새하컴즈 회신 + Webhook URL 등록 후 1h 작업으로 BODA_MODE=mock → http 전환
```

**총** mock-first: ≈ **15h** / **3 working days**. T8 합치면 약 1.5-2 주 (vendor 응답 latency 포함).

---

## 6. 환경 변수 (신규)

`.env.production` + `.env.staging` 추가 (운영자 측 1회 입력, vendor 회신 후 채움):

```bash
# === BODA(보다에듀) 연동 ===
BODA_MODE=mock                       # mock | http (vendor 회신 + ACM url 등록 후 http)
BODA_WEB_URL=https://bodaedu.kr
BODA_WEBRTC_URL=https://bodaedu.kr/webrtc
BODA_SERVER_URL=https://svr.bodaedu.kr
BODA_COMPANY_CODE=                   # ㈜새하컴즈 발급, 공개 식별자
BODA_COMPANY_ID=                     # 동상
BODA_AUTH_KEY=                       # 비밀 — env 만, AES-GCM 으로 DB 옮김
BODA_BASIC_AUTH=                     # Basic Base64(companyCode:authKey) 사전 계산값
BODA_DEFAULT_ROOM_CODE=              # 1:1 수업 룸 코드 (TPI 발급)
BODA_EVENT_SHARED_SECRET=            # Webhook 헤더 토큰 (앱<->BODA 합의값)
BODA_WEBHOOK_ALLOWED_CIDRS=          # 콤마 구분 IP/CIDR (BODA 출발지)
BODA_TIMEOUT_MS=5000
BODA_LAUNCH_GRACE_BEFORE_MIN=10
BODA_LAUNCH_GRACE_AFTER_MIN=15
BODA_RECONCILE_DELAY_MIN=10
```

---

## 7. 리스크 → 완화 매핑 (REQ §9 ↔ Task)

| RID | 완화 task |
|-----|----------|
| R-1 BODA 룸 사전 예약 X | T5-05 학생 대기 폴링 |
| R-2 roomCode 1종만 | Non-Goal, T1-01 default_room_code env |
| R-3 HMAC 부재 | T2-04 shared-secret + T6-02 IP allow + 멱등 |
| R-4 AuCd 클라이언트 노출 미확정 | T5-03 launch-context 응답 minimize, Q1 회신 대기 |
| R-5 Mac/Mobile 설치 감지 X | T5-06 에러 콜백 + WebRTC 폴백 안내 |
| R-6 룸 제목 변경 X | T4-04 이벤트 수정 시 meetKey 불변 (Non-Goal 명시) |
| R-7 학생 선입장 에러 | T5-05 대기 화면 (직접 노출 X) |
| R-8 Webhook 순서 역전 | T6-05 event_at 정렬 후 처리 |
| R-9 DSN dangling | (해소 — REQ v2 §10.3 단독 인용) |

---

## 8. 변경 파일 매니페스트 (예상)

```
backend/src/
├── infrastructure/external/bodaedu/                          [NEW dir]
│   ├── bodaedu.module.ts                                     [NEW T2-01]
│   ├── bodaedu.types.ts                                      [NEW]
│   ├── interfaces/bodaedu-server-api.interface.ts            [NEW]
│   ├── infrastructure/bodaedu-server-mock.client.ts          [NEW T2-02]
│   ├── infrastructure/bodaedu-server-http.client.ts          [NEW T2-03]
│   ├── webhook/bodaedu-webhook.controller.ts                 [NEW T6-01]
│   ├── webhook/bodaedu-event-shared-secret.util.ts           [NEW T2-04]
│   ├── webhook/bodaedu-webhook-allowlist.util.ts             [NEW T2-04]
│   ├── crypto/boda-credential.crypto.ts                       [NEW T2-05]
│   └── crypto/boda-credential.crypto.spec.ts                  [NEW]
│
├── modules/acm-cal/
│   ├── application/
│   │   ├── boda-room.service.ts                              [NEW T4-01]
│   │   ├── boda-room.service.spec.ts                         [NEW]
│   │   ├── boda-reconcile.service.ts                         [NEW T7-01]
│   │   ├── boda-reconcile.service.spec.ts                    [NEW]
│   │   └── cal-event.service.ts                              [MOD T4-02]
│   ├── presentation/
│   │   ├── boda-launch.controller.ts                         [NEW T5-03]
│   │   ├── boda-launch.controller.spec.ts                    [NEW]
│   │   ├── boda-room-status.controller.ts                    [NEW T5-05]
│   │   ├── boda-admin.controller.ts                          [NEW T7-04]
│   │   └── boda-config.controller.ts                         [NEW T3-02]
│   └── infrastructure/typeorm/
│       ├── boda-config.typeorm-entity.ts                     [NEW T1-01]
│       ├── boda-room.typeorm-entity.ts                       [NEW T1-01]
│       ├── boda-participant.typeorm-entity.ts                [NEW T1-01]
│       └── boda-event-log.typeorm-entity.ts                  [NEW T1-01]
│
└── presentation/webhooks/
    └── (existing webhook patterns — referenced only)

frontend-acm/src/
├── modules/cal/components/cal-event-modal.tsx                [MOD T4-02]
├── modules/web/pages/web-classroom-page.tsx                  [NEW T5-01]
├── modules/web/components/boda-launcher.tsx                  [NEW T5-04 + T5-05]
├── modules/web/components/boda-error-fallback.tsx            [NEW T5-06]
├── routes/router.tsx                                         [MOD T5-01]
├── lib/boda-api.ts                                           [NEW T5-03]
└── i18n/locales/{ko,en,vi,zh-CN}/                            [MOD T5-07]
    ├── cal.json                                              keys: hint.bodaAuto, …
    └── classroom.json                                        [NEW] 런처 페이지 키 ~20

sql/acm/
└── 910-acm-cal-boda.sql                                      [NEW T1-01]

docker/{staging,production}/.env.*.example                   [MOD] +15 키

docs/
├── analysis/REQ-260526-… (v2.0.0)                            [DONE ddeef90]
├── plan/PLN-260526-…                                          [본 문서 NEW]
└── implementation/RPT-260526-…                                [NEW T7 후]
```

**총** 신규 27 + 변경 5 + 문서 3 = **35 파일**.

---

## 9. 사용자 승인 필요 항목

1. **15h 일정 적정성** (3 working days, mock-first) — 조정 필요?
2. **런처 페이지 URL 패턴** — `/web/classroom/{evtId}` (REQ FR-LAUNCH-1) 그대로 OK?
3. **시간창** — 시작 10분 전 ~ 종료 15분 후 (REQ FR-LAUNCH-3) 그대로 OK?
4. **신규 env 13 키** — production 서버에 운영자가 입력. 평문 자격증명 운반 채널 (Q12) 합의?
5. **i18n 4 locale** — `classroom.json` 신규 namespace 추가 OK?
6. **Mock-first → http 전환 신호** — ㈜새하컴즈 Webhook URL 등록 + Q1·Q2 회신 모두 도착 시점이 cutover gate. 신호 받으면 T8-04 진행 (1h 작업).

---

## 10. 다음 단계

1. 본 PLN 사용자 승인 ← 현재 단계
2. (병행) ㈜새하컴즈 Q1 · Q2 회신 요청 + Webhook URL 사전 등록 의뢰
3. T1 → T2 → T3 → T4 → T5 → T6 → T7 순서로 mock-first 구현
4. Staging smoke (BODA_MODE=mock 으로 일정 등록 → 런처 → status 폴링 E2E)
5. RPT-260526 작성
6. (T8) vendor 회신 + Webhook 등록 완료 후 BODA_MODE=http 전환 + 실 staging smoke + production 배포
