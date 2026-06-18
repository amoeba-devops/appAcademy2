---
document_id: PLN-260619-boda-launcher-ux-enhancement
version: 1.0.0
status: draft
created: 2026-06-19
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260619-boda-launcher-ux-enhancement.md (v1.0.0)
change_log:
  - 2026-06-19 v1.0.0 — draft. T1–T5 (모드 B+C+헤더) 즉시 구현 / 모드 A iframe 은 vendor Q-LX-1 회신 후
---

# 작업 계획서 — BODA 런처 UX 강화 (REQ-260619)

> **One-liner**: REQ-260619 의 FR-LX-1·2·3·4·5 중 vendor 회신 무관 항목 (헤더 강화, 모드 B + 탭으로 열기, 모드 C 흡수, closeType 안내) 을 5 트랙 / 약 5h 로 구현. 모드 A (iframe) 는 env 플래그 + 코드 stub 만 두고 vendor Q-LX-1 회신 후 별도 PR.

---

## 1. 트랙 요약 (Track summary)

| 트랙 | 내용 | 예상 시간 | 의존 | 산출물 |
|---|---|---|---|---|
| **T1** | BE — `BodaLaunchContextService.build()` 응답 확장 (`ownerName` / `evtSource` / `invitees` / `embedUrl`) | 1h | — | service + DTO + 4 tests |
| **T2** | FE — Header 컴포넌트 강화 (강사 + 참석자 칩 + `+N` 모달) | 1.5h | T1 | Header redesign + AttendeesModal + i18n |
| **T3** | FE — `ClassroomEmbed` 통합 컴포넌트 (모드 B 데스크톱 앱 카드 + **브라우저 새 탭 열기** + 모드 C demo 흡수) | 1.5h | T1 | new component, demo-window 흡수 |
| **T4** | FE — closeType 안내 메시지 + 5xx fallback 메시지 강화 | 0.5h | T1 | 6 closeReason 카드 + i18n |
| **T5** | i18n × 4 locale + build + commit + cd-staging + cd-production | 1h | T1–T4 | 신규 키 약 20개 × 4 |

**합계: ~5h** (모드 A iframe 트랙은 stub 만 — vendor 회신 후 추가 1.5h 예상)

---

## 2. 트랙별 세부 작업

### T1. BE — Launch Context 응답 확장 (1h)

#### T1-01. DTO 확장
`backend/src/modules/acm-cal/application/dto/boda-launch.dto.ts`:
```ts
export interface BodaLaunchContextResponseDto {
  // 기존 필드 (변경 없음): meetKey, roomCode, meetIdx, status, userType, uid, uname, lang, appApiUrl, evtTitle, evtStartAt, evtEndAt
  // ── 신규 (REQ-260619 FR-LX-4) ─────────────────────────────
  ownerName: string;
  evtSource: 'MANUAL' | 'INSTANT' | 'CLS_SESSION';
  invitees: Array<{
    kind: 'STUDENT' | 'TEACHER' | 'PARENT';
    refId: string;
    name: string;
    subLabel: string | null;  // 학생: 학교명·학년, 학부모: 자녀명
    notified: boolean;
  }>;
  embedUrl: string | null;    // 모드 A vendor iframe URL (BODA_EMBED_ENABLED + room status live 시)
}
```

#### T1-02. Service — invitees lookup
`BodaLaunchContextService.build()` 확장:
- 기존: cal_event + room + invitee 권한 검증.
- 추가: 강사 화면(`userType === 11` 또는 ADMIN) 일 때만 invitees 풀 lookup. 학생·학부모 화면(`userType === 12`)에서는 `invitees: []` 반환 (NFR-LX-2 개인정보).
- `CalInviteeService.listForEvent()` 재사용 — 이미 student name + class 정보 join 되어 있음.
- `ownerName` = `acm_user.name` (cal-event service 의 `lookupOwners()` 패턴 차용).

#### T1-03. embedUrl 빌더 (stub)
```ts
private buildEmbedUrl(ctx: {...}): string | null {
  const enabled = this.config.get<string>('BODA_EMBED_ENABLED');
  if (enabled !== 'true' && enabled !== '1') return null;
  if (!ctx.cfg.webrtcUrl) return null;
  const params = new URLSearchParams({
    CCd: ctx.cfg.companyCode,
    CId: ctx.cfg.companyId,
    meetKey: ctx.room.meetKey,
    roomCode: ctx.room.roomCode,
    UTy: String(ctx.userType),
    UId: ctx.uid,
    UNm: ctx.uname,
    lang: ctx.lang,
  });
  return `${ctx.cfg.webrtcUrl}?${params.toString()}`;
}
```
- 기본 `BODA_EMBED_ENABLED=false` 이므로 항상 `null` 반환 (모드 B 로 fallback).
- vendor Q-LX-1·2 회신 후 토큰·쿼리 파라미터 추가 시 1 메서드만 손질.

#### T1-04. 테스트 (4 spec 추가 → 기존 13 + 4 = 17)
- `ownerName` 채워짐
- 강사 viewer → invitees 풀 노출
- 학생 viewer → `invitees: []`
- `BODA_EMBED_ENABLED=false` → `embedUrl: null`

---

### T2. FE — Header 강화 (1.5h)

#### T2-01. Header 컴포넌트 재설계
`web-classroom-page.tsx` 의 `<Header>` 함수 안 → 별도 파일 `components/classroom-header.tsx` 로 분리.

레이아웃 (REQ §7):
- 1줄: 🏫 제목 (16px 굵게) + ⚡ INSTANT 칩 (있을 때)
- 2줄: 👨‍🏫 강사명 · ⏰ HH:mm~HH:mm · 🟢 상태 뱃지 (재사용)
- 3줄: 👥 수강생 (N명) — 칩 그리드 (최대 7개 + `+N`)

```tsx
<div className="flex flex-wrap gap-1.5">
  {invitees.slice(0, 7).map(...)}
  {invitees.length > 7 && (
    <button onClick={openAttendees} className="...">
      +{invitees.length - 7}명
    </button>
  )}
</div>
```

#### T2-02. AttendeesModal
`components/attendees-modal.tsx`:
- 전체 invitees 목록 (이름 + subLabel + 알림 상태 뱃지).
- 강사·운영자만 진입 가능 (이미 백엔드가 비강사 화면에는 빈 배열 반환하므로 학생 화면에서는 +N 칩 자체가 안 뜸).

#### T2-03. 학생 화면 분기
- `ctx.userType !== 11` 이면 수강생 줄 자체를 hide.
- `evtSource === 'INSTANT'` 일 때만 ⚡ 칩 노출.

---

### T3. FE — ClassroomEmbed 통합 컴포넌트 (1.5h)

#### T3-01. 새 파일 — `modules/web/components/classroom-embed.tsx`
- props: `{ ctx, evtId, isTeacher, demo: boolean, embedUrl: string | null, roomStatus }`
- 내부에서 모드 분기:
  ```
  if (demo) → <DemoBodaWindow ... />  (기존 DemoBodaWindow 흡수 — 본 컴포넌트의 내부 sub-component)
  else if (embedUrl + iframeAttempt 성공) → <iframe sandbox=... src={embedUrl} />
  else → <DesktopAppCard ... />  ← 모드 B 본체
  ```

#### T3-02. iframe 시도 + 5s 타임아웃 fallback
```tsx
function tryIframe(url: string, onSuccess: () => void, onFail: () => void) {
  // iframe load 이벤트 5초 안에 → onSuccess, 아니면 onFail
  // X-Frame-Options 거부는 브라우저 콘솔에 출력되지만 load 이벤트도 안 옴 → 타이머가 잡음
}
```
- vendor Q-LX-1 회신 전에는 `embedUrl === null` 이므로 iframe 분기 자체가 안 탐.
- 회신 후 `BODA_EMBED_ENABLED=true` + embedUrl 가 채워지면 모드 A 자동 활성.

#### T3-03. DesktopAppCard (모드 B 본체) — **탭으로 열기 버튼 포함**
```
┌────────────────────────────────────────────────────────┐
│  💻  BODA 강의실 진입                                   │
│                                                        │
│   ┌─[ 데스크톱 앱으로 입장 ]─┐  ← 주요 (`bodaOpen/Join`) │
│   ┌─[ 브라우저 새 탭으로 열기 ]─┐  ← 부 (window.open)    │
│                                                        │
│  💡 처음이라면 [BODA 앱 설치 안내]                       │
│                                                        │
│  iframe 임베드 실패 시 자동으로 이 화면이 보입니다.       │
└────────────────────────────────────────────────────────┘
```

**`브라우저 새 탭으로 열기`** 동작:
- `embedUrl` 이 있으면 그 URL을 새 탭으로 (vendor WebRTC 브라우저 모드).
- `embedUrl` 이 null 인데 vendor 의 `bodaWebUrl` 이 config 에 있으면 그것을 fallback (백엔드가 이미 cfg 검증한 값).
- 둘 다 없으면 버튼 disabled + tooltip "운영자에게 BODA 설정 확인 요청".
- 백엔드는 `BodaLaunchContextResponseDto` 에 `webBrowserUrl` 추가로 노출 (T1 작업에 포함, embedUrl 과 별개 — env flag 무관 항상 채움).

#### T3-04. DemoBodaWindow 흡수
- 기존 `components/demo-boda-window.tsx` 를 `<DemoMode>` sub-component 로 본 파일에 흡수 (혹은 그대로 import — 우선 import 로 가져오고 통일 후 정리).
- 헤더 위 노란 DEMO 배너는 web-classroom-page 가 직접 렌더 (Embed 내부가 아닌).

---

### T4. FE — closeType 안내 강화 (0.5h)

#### T4-01. closeType → 메시지 매핑
백엔드 `BodaRoomTypeormEntity.closeType` 컬럼 (varchar) 에 webhook 이벤트 5 의 `closeType` 정수가 저장되어 있음.

코드 매핑 (vendor SPEC 3.1.6):

| closeType | 의미 | 안내 키 |
|---|---|---|
| 0 | 알 수 없음 | `closeReason.UNKNOWN` |
| 1 | 개설 실패 | `closeReason.OPEN_FAILED` |
| 2 | 사용하지 않는 룸 | `closeReason.UNUSED` |
| 10 | 사용자 없음 | `closeReason.NO_USERS` |
| 11 | 실제 회의실 없음 | `closeReason.NO_ROOM` |
| 15 | 수동 종료 | `closeReason.MANUAL_END` |
| 16 | 자동 폐쇄 | `closeReason.AUTO` |
| 20 | 관리자 폐쇄 | `closeReason.ADMIN_CLOSED` |
| 22 | 진행자 폐쇄 | `closeReason.HOST_CLOSED` |
| 100 | 연결 끊김 | `closeReason.CONNECTION_LOST` |
| (그 외) | — | `closeReason.UNKNOWN` |

#### T4-02. `<RoomEndedNotice>` 컴포넌트 확장
기존 단순 안내 → closeType 분기.

---

### T5. i18n + commit + deploy (1h)

#### T5-01. i18n keys × 4 locale (`classroom.json`)
신규 키 (약 22개):
- `header.teacher`, `header.instantBadge`, `header.attendees`, `header.attendeesMoreBtn`, `header.statusLive`
- `attendees.modalTitle`, `attendees.kindStudent`, `attendees.kindTeacher`, `attendees.kindParent`, `attendees.notifiedTrue`, `attendees.notifiedFalse`
- `embed.desktopTitle`, `embed.desktopHint`, `embed.openInBrowser`, `embed.installGuide`, `embed.iframeFallbackToast`
- `closeReason.UNKNOWN`, `.OPEN_FAILED`, `.UNUSED`, `.NO_USERS`, `.NO_ROOM`, `.MANUAL_END`, `.AUTO`, `.ADMIN_CLOSED`, `.HOST_CLOSED`, `.CONNECTION_LOST`

#### T5-02. Build + tests
- BE `nest build` clean.
- FE `tsc + vite build` clean.
- 17 launch-context spec (기존 13 + T1 4) all pass.

#### T5-03. Commit + push + cd-staging + cd-production
- Conventional commit `feat(acm-cal): T1-T5 BODA launcher UX (REQ-260619)`.
- 자동 cd-staging → smoke.
- 사용자 승인 후 cd-production dispatch.

---

## 3. Data flow diagram

```
GET /api/cal/boda/launch-context?evtId=...
                   │
                   ▼
┌─────────────────── BodaLaunchContextService ────────────────┐
│  build():                                                    │
│   ├─ ctx (기존: meetKey/roomCode/status/userType/uid/uname)  │
│   ├─ ownerName  ← acm_user lookup                            │
│   ├─ evtSource  ← cal_event.source                           │
│   ├─ invitees   ← CalInviteeService.listForEvent()           │
│   │              (학생/학부모 화면이면 빈 배열로 강제 마스킹)│
│   └─ embedUrl   ← BODA_EMBED_ENABLED + cfg.webrtcUrl 결합    │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
              { ctx, invitees, embedUrl }
                       ▼
┌──────────────── WebClassroomPage ───────────────────────────┐
│  ┌─ <ClassroomHeader ctx={ctx} invitees={invitees} />        │
│  │  강사 / 시간 / 수강생 칩 (학생 view 면 명단 hide)         │
│  ├─ <ClassroomEmbed ctx={ctx}                                │
│  │                  embedUrl={embedUrl}                      │
│  │                  demo={?demo=1}                           │
│  │                  isTeacher={ctx.userType === 11} />       │
│  │                                                           │
│  │   if (demo)            → <DemoBodaWindow />               │
│  │   else if (embedUrl)   → iframe + 5s timeout fallback     │
│  │                          → on fail: <DesktopAppCard />    │
│  │   else                 → <DesktopAppCard />               │
│  │                                                           │
│  │   <DesktopAppCard> 안:                                     │
│  │     - 데스크톱 앱 입장 버튼 (bodaOpen/Join)                │
│  │     - **브라우저 새 탭으로 열기** (window.open(embedUrl))  │
│  │     - BODA 앱 설치 안내 링크                              │
│  └─ <RoomEndedNotice closeType={room.closeType} />           │
│      → closeType 코드별 다른 안내 (T4)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 영향받는 파일

### 4.1 신규 (4)
| 파일 | 트랙 |
|---|---|
| `frontend-acm/src/modules/web/components/classroom-header.tsx` | T2 |
| `frontend-acm/src/modules/web/components/attendees-modal.tsx` | T2 |
| `frontend-acm/src/modules/web/components/classroom-embed.tsx` | T3 |
| `frontend-acm/src/modules/web/components/desktop-app-card.tsx` | T3 |

### 4.2 수정 (7)
| 파일 | 트랙 |
|---|---|
| `backend/src/modules/acm-cal/application/boda-launch-context.service.ts` | T1 |
| `backend/src/modules/acm-cal/application/dto/boda-launch.dto.ts` | T1 |
| `backend/src/modules/acm-cal/application/boda-launch-context.service.spec.ts` | T1 |
| `frontend-acm/src/lib/boda-launch-api.ts` (응답 타입 확장) | T1 |
| `frontend-acm/src/modules/web/pages/web-classroom-page.tsx` (재구성) | T3, T4 |
| `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/classroom.json` (~22 신규 키) | T5 |
| `docker/staging/docker-compose.staging.yml` (BODA_EMBED_ENABLED 환경변수 추가) | T1 |

### 4.3 미변경
- BODA 4 테이블, room state machine, webhook 수신, reconcile cron, instant-event 서비스, demo 시뮬레이터 endpoint (stack 그대로).

---

## 5. 위험 + 완화

| 위험 | 완화 |
|---|---|
| iframe 임베드가 vendor 측 X-Frame-Options 로 거부됨 (Q-LX-1 미회신) | **본 PR 에서는 iframe 시도 자체를 안 함** — `BODA_EMBED_ENABLED=false` 기본. embedUrl 만 응답에 채워두고 모드 B 의 "브라우저 새 탭으로 열기" 버튼이 사용함. |
| invitees 권한 마스킹 버그 → 학생이 다른 학생 명단 봄 | 백엔드 service 에서 `userType !== 11 && actorRole !== 'ADMIN'` 이면 빈 배열로 강제 후 spec 으로 검증 (T1-04 case 3). |
| `+N` 모달이 매우 큰 클래스 (50+ 학생) 에서 성능 이슈 | invitees 자체가 cal_invitee 테이블에 join — 50명 정도는 한 query 로 50ms 이내. 향후 pagination 필요해질 때 별도 PR. |
| closeType 매핑 누락된 코드 | unknown fallback 메시지 ("강의실이 폐쇄되었습니다") + 로그에 closeType 값 출력 → 운영 중 발견 시 키 추가. |
| iframe 시도 후 fallback 까지 5초 빈 화면 | iframe `src` 설정과 동시에 `<DesktopAppCard>` 를 hidden 으로 미리 마운트 → fallback 발동 시 즉시 show (RUM 체감 latency 최소화). |

---

## 6. Done 정의

- [ ] T1 BE — invitees 마스킹 spec 4 종 모두 pass + nest build clean.
- [ ] T2 FE — 강사 화면에서 수강생 칩 N개 표시 + AttendeesModal 정상 동작.
- [ ] T2 FE — 학생 화면에서 수강생 칩 영역 hide.
- [ ] T3 FE — 모드 C (`?demo=1`) 동작 동일 (기존 DemoBodaWindow 회귀 없음).
- [ ] T3 FE — 모드 B 카드에 "데스크톱 앱 입장" + "브라우저 새 탭으로 열기" + "설치 안내" 3 버튼 노출.
- [ ] T4 FE — closeType=22 시 "강사가 강의를 종료했습니다" 메시지 표시 (mock 환경에서 simulate-event 5/closeType=22 로 검증).
- [ ] T5 — 4 locale 모두 신규 키 누락 없음.
- [ ] cd-staging green + smoke 401/401 (기존 endpoint 회귀 없음).
- [ ] cd-production dispatch + smoke.

---

## 7. Out-of-scope (의도적 이연 — v1.1)

| 항목 | 사유 |
|---|---|
| 모드 A iframe 실제 활성화 | Q-LX-1·2·3 vendor 회신 필요. 본 PR 에서는 stub + env flag 만. |
| 채팅·녹화 다시보기 페이지 노출 | vendor webhook 이 채팅 본문 미전송. 별도 모듈 분리. |
| 학부모 화면의 자녀 외 학생 명단 마스킹 정책 (Q-LX-5) | 기본 비공개 (학생과 동일) — 운영자 결정 후 v1.1 에서 정책 토글 추가 가능. |
| 대형 클래스(50+) pagination | 현재 cal_invitee 가 SET 기반 SQL 1회 — 30명 미만은 가벼움. 50+ 이슈 보고 시 별도 PR. |

---

## 8. Next step

본 PLN 은 **draft**. 사용자 승인 시 T1 → T5 순서로 즉시 진행. 모드 A iframe 트랙은 vendor 회신 후 별도 `REQ-260619 v1.1` 로 follow-up.
