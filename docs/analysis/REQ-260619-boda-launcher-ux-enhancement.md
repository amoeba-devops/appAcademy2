---
document_id: REQ-260619-boda-launcher-ux-enhancement
version: 1.0.0
status: draft
created: 2026-06-19
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260526-acm-cal-boda-integration.md (v2.0.0)
  - docs/analysis/REQ-260610-acm-cal-boda-instant-classroom.md (v1.0.0)
  - docs/reference/MANUAL-260610-boda-classroom-user-flow.md (v1.2.0)
vendor_spec:
  - BODA SPEC_823 v823.002 (이벤트 연동 개발 가이드) — vendor 제공 PDF
  - BODA APP API SPEC_823 v823.002 (bodaOpen / bodaJoin 함수 명세)
change_log:
  - 2026-06-19: v1.0.0 draft — 런처 페이지 헤더 강화 + 임베디드 강의실 뷰 + 장애 fallback
---

# 요구사항 — BODA 화상 강의실 런처 페이지 UX 강화

> **One-liner**: 강사·학생이 `/web/classroom/{evtId}` 에 진입했을 때 (1) 누구의·어떤 수업인지 한눈에 인지하고, (2) BODA 강의실이 페이지 본문에 직접 보이며, (3) 정상 작동이 어려운 환경에서는 친절한 안내 또는 mock 화면이 노출되도록 한다.

---

## 1. Overview (개요)

### 1.1 배경
- 현재 `/web/classroom/:evtId` 런처는 *진입 → 버튼 클릭 → BODA 데스크톱 앱이 새 창으로 뜸* 흐름. 런처 페이지 본문은 강의 시작 후에는 거의 비어 있음.
- 실제 운영자 (트리니티 트랩 인스티튜트) 환경 시연 (`https://acm.amoeba.site/web/classroom/e10ca573-c570-4acc-8564-ced8158cdd97?autoStart=1`) 에서 다음 피드백 수집:
  1. 페이지 상단에 강의 이름·강사·수강생 명단을 보이게 해 달라.
  2. 런처 페이지 본문에 BODA 강의실 화면이 직접 보이게 하면 좋겠다 (현재는 데스크톱 앱 별도 창).
  3. BODA 클라이언트 미설치·스크립트 timeout 등 비정상 상황에서도 페이지가 비어 보이지 않도록 안내 또는 임시 mock 화면을 노출해 달라.

### 1.2 목표
- 강사·학생이 진입과 동시에 **수업 컨텍스트** (제목·강사·수강생) 를 인지.
- 가능한 경우 **WebRTC 기반 임베디드 강의실 뷰** 를 본문에 표시 (vendor BODA Web 의 WebRTC URL: `https://bodaedu.kr/webrtc`).
- 임베디드가 불가능한 환경(데스크톱 앱 모드 / 스크립트 실패 등) 에서는 **안내 카드** 또는 **`?demo=1` mock 강의실** 로 페이지가 비어 있지 않도록.

### 1.3 비목표 (Out of scope)
- BODA 측 vendor 채팅·점수·녹화 데이터의 실시간 페이지 노출 (vendor webhook 이 채팅 본문을 보내지 않음).
- 출결·녹화 다시보기 (별도 모듈로 분리).
- 강의실 진행 중 ACM 측에서 학생 강제 퇴장 / 권한 변경 (vendor SERVER API 미지원).

---

## 2. Vendor capability check (벤더 제공 범위 확인)

| 기능 | 제공 여부 | 의존 여부 |
|---|---|---|
| BODA Web URL (`https://bodaedu.kr`) | ✅ — 학생/강사 진입 페이지 | **헤더 링크용** |
| BODA WebRTC URL (`https://bodaedu.kr/webrtc`) | ✅ — 브라우저용 매체 엔드포인트 | **임베디드 뷰 후보** (iframe 가능 여부 vendor 확인 필요 — Q1) |
| `BodaAppApi.bodaOpen(dup=1, …)` | ✅ — 강사 데스크톱 앱 호출 | 기존 흐름 (변경 없음) |
| `BodaAppApi.bodaJoin(…)` | ✅ — 학생 데스크톱 앱 입장 | 기존 흐름 |
| 이벤트 27 — 대면 승인 사진 일치율 | ✅ (823.001) | v1.1 후속 |
| 이벤트 28 — 스크린 캡처 업로드 | ✅ (823.001 / multipart) | v1.1 후속 |
| 이벤트 5 — 폐쇄 `closeType` 코드 | ✅ (0/1/2/10/11/15/16/20/22/100) | 페이지 종료 안내 메시지 강화에 활용 |

> Vendor 자격증명 (Ccd / Cid / AuCd / SvrApi Bearer / WEBRTC URL) 은 운영자가 `/admin/config` BODA 섹션에서 입력해 AES-GCM `BYTEA` 로 저장. 본 REQ / PLN / RPT 문서에는 평문 미포함.

---

## 3. AS-IS (현재 상태)

```
/web/classroom/{evtId}?autoStart=1
┌──────────────────────────────────────────────┐
│                                              │
│              📹 Video icon                   │
│         <evt.title>                          │
│         🕒 19:00 ~ 20:30                     │
│                                              │
│    [강의실 입장 (강사)] / Pending 표시        │
│                                              │
│  ※ BODA 데스크톱 앱이 별도 창으로 실행됨     │
│  ※ 페이지 본문은 그 후 비어 있음              │
│                                              │
└──────────────────────────────────────────────┘
```

문제점:
- 강사 이름·수강생 명단이 페이지에 표시되지 않음 → 진입 직후 누가·어떤 수업인지 빠르게 식별이 어려움.
- BODA 앱이 별도 창에 뜨면 ACM 페이지는 빈 상태 → 다중 모니터가 아닌 환경에서 어색함.
- 스크립트 로드 실패·앱 미설치 시 에러 카드만 표시 → "내가 뭐 잘못 했나" 느낌.

---

## 4. TO-BE (목표 상태)

```
/web/classroom/{evtId}
┌──────────────────────────────────────────────────────────────────┐
│ 🏫  중3 영어 - 비교급/최상급                                       │
│ 👨‍🏫  강사: 김교사 ·  ⏰  19:00 ~ 20:30  ·  ⚡즉시 강의 (옵션)     │
│ 👥  수강생 (4명):                                                  │
│   [김학생 (중3-A)] [박학생 (중3-A)] [이학생 (중3-B)] [+1]         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────── 강의실 ────────────────────────────┐  │
│   │                                                            │  │
│   │   (a) BODA WebRTC iframe — vendor 가 임베드 허용 시        │  │
│   │       또는                                                 │  │
│   │   (b) 데스크톱 앱 안내 카드 — 미설치 / 스크립트 실패 시    │  │
│   │       또는                                                 │  │
│   │   (c) Mock 강의실 (`?demo=1`) — 데모 모드                  │  │
│   │                                                            │  │
│   └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│   [강의실 입장 (강사)]  ·  [BODA 앱 설치 안내]  ·  [데모 모드]     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. Functional Requirements (기능 요구사항)

### FR-LX-1. 헤더 — 강의 컨텍스트 표시
런처 페이지 상단에 다음 3 항목을 표시한다:

| 항목 | 출처 | 표시 |
|---|---|---|
| 강의 제목 | `cal_event.evt_title` | 1줄 크게 |
| 강사 이름 + 역할 표시 | `cal_event.evt_owner_user_id` → `acm_user.name` | 아이콘 👨‍🏫 + 이름 |
| 시작 / 종료 | `cal_event.evt_start_at`, `evt_end_at` | `HH:mm ~ HH:mm` |
| 즉시 강의 표시 (있을 때) | `cal_event.evt_source = 'INSTANT'` | ⚡ 아이콘 칩 |
| 수강생 명단 | `cal_invitee` (kind=STUDENT) + 학생 name·class | 칩 형태, 최대 8개 + `+N` |

학생 명단이 8명 초과면 처음 7명 + `+N` 카운트만 표시 — 그 외에는 별도 모달로 확인 (FR-LX-1.1).

#### FR-LX-1.1 수강생 전체 보기 모달
- `+N` 칩 클릭 시 모달 열림.
- 모달 내용: 전체 수강생 목록 (이름 / 학교 / 클래스명 / 알림 상태).
- 강사·운영자만 볼 수 있음 (학생 본인 화면에서는 다른 학생 명단 비공개).

### FR-LX-2. 임베디드 강의실 영역 (3 가지 모드 자동 분기)

#### FR-LX-2.1 모드 A — WebRTC iframe (vendor 허용 시)
- vendor 가 `https://bodaedu.kr/webrtc?…` URL 의 iframe 임베드를 허용하는 경우, 헤더 아래에 `<iframe>` 으로 직접 노출.
- iframe URL 쿼리에는 다음 파라미터 (vendor 명세 — Q2 확인 필요):
  - `CCd` (companyCode), `CId` (companyId), `meetKey`, `roomCode`
  - `UTy` (사용자 타입 11/12/13)
  - `joinUser` JSON (`UId`, `UNm`)
  - `joinOpt.lang` (ko/en)
- 시간창·권한은 ACM 측에서 사전 검증 (기존 `BodaLaunchContextService.build()` 흐름 그대로) 후 vendor URL 만 iframe `src` 로.
- 인증·세션은 vendor 측 SSO (URL 파라미터 또는 vendor 가 별도 토큰 제공)에 따른다 — Q3 확인.

#### FR-LX-2.2 모드 B — 데스크톱 앱 안내 카드 (vendor 가 iframe 미허용 / 사용자 환경 미지원 시)
- 페이지 본문에 vendor 데스크톱 앱 안내 표시:
  - 큰 일러스트 + "BODA 강의실을 별도 창에서 진행합니다" 메시지.
  - **`강의실 입장`** 버튼 — `BodaAppApi.bodaOpen()` / `bodaJoin()` (기존 동작).
  - **`BODA 앱 설치 안내`** 버튼 — vendor 의 설치 페이지 새 탭으로 열기.
- 강사가 클릭 후 데스크톱 앱이 열렸음을 확인하면 메시지가 "강의실이 별도 창에서 실행 중입니다" 로 갱신 (room status 가 `OPEN` 이상으로 전이 시).

#### FR-LX-2.3 모드 C — Mock 강의실 (`?demo=1`)
- 기존 `DemoBodaWindow` 컴포넌트를 페이지 본문 영역으로 이동·확장 (REQ-260610 demo).
- 5개 액션 버튼 (수업 시작/일시정지/학생 입장/학생 퇴장/수업 종료) 그대로.
- DEMO 배너는 헤더 위 별도 라인으로.

#### FR-LX-2.4 모드 자동 분기 알고리즘
```
if (search.demo === '1') → 모드 C
else if (BODA_EMBED_ENABLED && vendor 가 iframe X-Frame-Options 허용) → 모드 A
else → 모드 B (기본)
```
- `BODA_EMBED_ENABLED` 는 env 토글 (기본값 `false` — vendor 허용 확인 전 비활성).
- iframe 모드는 iframe `onerror` / `load` 이벤트로 5초 이내 콘텐츠 도착 못 하면 자동 모드 B 로 fallback.

### FR-LX-3. 장애·예외 안내 강화
기존 9 개 에러 카드 (REQ-260526 v2 §5.3) 에 더해 다음 시나리오 분기:

| 상황 | 안내 |
|---|---|
| `BODA-SCRIPT_LOAD_FAILED` | "BODA 강의실 스크립트를 불러오지 못했습니다" + 재시도 / 데스크톱 앱 다운로드 / 도움 요청 3 가지 액션 |
| `BODA-SCRIPT_TIMEOUT` | "응답이 느립니다" + 재시도 버튼 |
| iframe (모드 A) `X-Frame-Options`/CSP 거부 | 자동으로 모드 B 전환 + 짧은 토스트 "iframe 임베드가 불가하여 데스크톱 앱으로 안내합니다" |
| Room `CLOSED` + `closeType = 100` (연결 끊김) | "BODA 측 연결이 끊겨 강의실이 폐쇄되었습니다 — 운영자에게 알려 주세요" |
| Room `CLOSED` + `closeType = 22` (진행자 종료) | "강사가 강의를 종료했습니다" |
| Room `CLOSED` + `closeType = 16` (자동 폐쇄) | "수업 시간이 종료되어 자동 폐쇄되었습니다" |

### FR-LX-4. 백엔드 — Launch Context 응답 확장
`GET /api/cal/boda/launch-context?evtId=` 응답에 다음 필드 추가:

```ts
interface BodaLaunchContextResponse {
  // ... 기존 필드
  ownerName: string;          // 강사 이름 (acm_user.name)
  evtSource: 'MANUAL' | 'INSTANT' | 'CLS_SESSION';  // 즉시 강의 chip 표시용
  invitees: Array<{
    kind: 'STUDENT' | 'TEACHER' | 'PARENT';
    refId: string;
    name: string;
    subLabel: string | null;  // 학생이면 클래스명, 학부모면 자녀이름 등
    notified: boolean;        // SENT 여부
  }>;
  // 모드 A 활성 시 vendor iframe URL (BODA_EMBED_ENABLED + vendor 허용 후)
  embedUrl: string | null;
}
```

학생 본인 화면(`UTy=12`) 에서는 `invitees` 배열을 빈 배열로 반환 (개인정보 보호 — 다른 학생 명단 비공개). 강사·운영자만 전체 목록 노출.

### FR-LX-5. i18n
- 새 키 추가:
  - `classroom.header.teacher` "강사: {{name}}"
  - `classroom.header.instantBadge` "⚡ 즉시 강의"
  - `classroom.header.attendees` "수강생 ({{count}}명)"
  - `classroom.header.attendeesMore` "+{{more}}명 더보기"
  - `classroom.embed.fallbackTitle` "BODA 강의실을 별도 창에서 진행합니다"
  - `classroom.embed.openDesktop` "강의실 입장"
  - `classroom.embed.installGuide` "BODA 앱 설치 안내"
  - `classroom.embed.iframeFallbackToast` "iframe 임베드가 불가하여 데스크톱 앱으로 안내합니다"
  - `classroom.error.closeReason.CONNECTION_LOST` 등 closeType 별 메시지 6 종
- ko / en / vi / zh-CN 4 locale 동시 추가 (NFR).

---

## 6. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-LX-1 | **응답성** | launch-context 응답 시간 p95 ≤ 500ms (헤더 invitees 추가로 인한 추가 query). |
| NFR-LX-2 | **개인정보** | 학생 화면에서 다른 학생 명단 미노출 (FR-LX-4). 학부모 화면도 동일. |
| NFR-LX-3 | **fallback 보장** | 모드 A 실패 시 모드 B 로 자동 전환 ≤ 5초. 사용자가 빈 페이지를 보는 시간 ≤ 5초. |
| NFR-LX-4 | **iframe 보안** | 모드 A iframe `sandbox` 속성으로 최소 권한만 부여 (`allow-scripts allow-same-origin allow-camera allow-microphone`). |
| NFR-LX-5 | **i18n** | ko / en / vi / zh-CN 4 locale 모두 동시 추가. |
| NFR-LX-6 | **mobile** | 헤더 칩이 좁은 화면(≤375px) 에서도 truncate + horizontal scroll 가능. iframe 은 16:9 비율 유지. |

---

## 7. UI mockups (텍스트 목업)

### 7.1 모드 A — WebRTC iframe (vendor 허용 시)
```
┌─────────────────────────────────────────────────────────────────┐
│ 🏫  중3 영어 - 비교급/최상급                                      │
│ 👨‍🏫 김교사 · ⏰ 19:00~20:30 · 🟢 진행 중                          │
│ 👥 수강생 (4명): [김학생 중3-A] [박학생 중3-A] [이학생 중3-B] +1│
├─────────────────────────────────────────────────────────────────┤
│┌───────────────────────────────────────────────────────────────┐│
││                                                                ││
││           ✏️ < vendor iframe — bodaedu.kr/webrtc >             ││
││                                                                ││
││                                                                ││
││                                                                ││
│└───────────────────────────────────────────────────────────────┘│
│ [전체화면] [마이크] [화면공유]   (vendor UI 가 직접 제공)         │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 모드 B — 데스크톱 앱 안내 (기본)
```
┌─────────────────────────────────────────────────────────────────┐
│ 🏫  중3 영어 - 비교급/최상급                                      │
│ 👨‍🏫 김교사 · ⏰ 19:00~20:30 · 🟢 진행 중                          │
│ 👥 수강생 (4명): [김학생 중3-A] [박학생 중3-A] [이학생 중3-B] +1│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│              💻                                                 │
│       BODA 강의실을 별도 창에서 진행합니다                       │
│                                                                 │
│    BODA 데스크톱 앱이 실행 중이면 자동으로 입장됩니다.            │
│    창이 안 보이면 작업 표시줄에서 BODA 아이콘을 확인하세요.       │
│                                                                 │
│        [💻 강의실 입장]  [📥 BODA 앱 설치]                       │
│                                                                 │
│  💡 처음이라면 BODA 앱을 먼저 설치해 주세요.                     │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 모드 C — Mock 강의실 (`?demo=1`)
```
┌─────────────────────────────────────────────────────────────────┐
│ 🟡 DEMO 모드 — 실제 BODA 클라이언트 대신 시뮬레이터로 동작합니다  │
├─────────────────────────────────────────────────────────────────┤
│ 🏫  중3 영어 - 비교급/최상급                                      │
│ 👨‍🏫 김교사 · ⏰ 19:00~20:30 · 🟢 진행 중                          │
│ 👥 수강생 (4명): ...                                             │
├─────────────────────────────────────────────────────────────────┤
│        ┌─────────────────────────────────────────────────┐      │
│        │  🎥 화상 강의 진행 중 (mock)                     │      │
│        │  참석자: 김교사 / 박학생                         │      │
│        └─────────────────────────────────────────────────┘      │
│   [수업 시작] [일시정지] [학생 입장 시뮬] [학생 퇴장] [수업 종료]│
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Acceptance criteria (수락 기준)

| AC | 시나리오 | 기대 결과 |
|---|---|---|
| AC-LX-1 | 강사가 런처 진입 (`autoStart` 무관) | 헤더에 제목·강사명·수강생 칩이 1초 이내 표시. |
| AC-LX-2 | 학생이 동일 URL 진입 | 헤더에 제목·강사명은 표시되지만 수강생 명단 칩 영역은 비어있음. |
| AC-LX-3 | 수강생이 9명 이상 | 처음 7명 + `+N` 칩. 클릭 시 모달 노출 (강사·운영자만). |
| AC-LX-4 | `?demo=1` 진입 | 모드 C (mock 강의실) — 헤더 + mock 창 + 5 액션 버튼. |
| AC-LX-5 | `BODA_EMBED_ENABLED=false` (기본) + 일반 진입 | 모드 B — 데스크톱 앱 안내 카드 + 강의실 입장 버튼. |
| AC-LX-6 | `BODA_EMBED_ENABLED=true` + vendor 가 iframe 거부 | iframe `onerror`/`load` 타임아웃 → 5초 이내 모드 B 자동 fallback + 토스트 안내. |
| AC-LX-7 | room status `CLOSED` + `closeType=22` | "강사가 강의를 종료했습니다" 안내 카드. |
| AC-LX-8 | i18n | ko/en/vi/zh-CN 4 locale 모두 신규 키 누락 없음. |
| AC-LX-9 | 학생 화면에서 다른 학생 refId/name 노출 안 됨 | 백엔드 응답의 `invitees` 가 빈 배열. |

---

## 9. Open questions (미결 사항 — vendor / 운영자 확인 필요)

| Q | 질문 | 책임 | 우선순위 |
|---|---|---|---|
| Q-LX-1 | BODA 가 `https://bodaedu.kr/webrtc` 를 ACM 도메인에서 iframe 임베드 허용하는가? (`X-Frame-Options: ALLOWFROM` 또는 `Content-Security-Policy: frame-ancestors`) | 벤더 (㈜새하컴즈) | **High** — 모드 A 가능 여부 결정 |
| Q-LX-2 | iframe `src` 에 사용할 정확한 vendor URL + 쿼리 파라미터 명세 (joinUser 인코딩 / 토큰 등) | 벤더 | **High** |
| Q-LX-3 | iframe 모드에서 강사가 입장 시 vendor 측 SSO 처리 (URL 토큰 / cookie / postMessage 등)? | 벤더 | **High** |
| Q-LX-4 | room `closeType` 코드 별 vendor 권장 안내 문구 (15·16·20·22·100 등) | 운영자 / 벤더 | Medium |
| Q-LX-5 | 학부모 화면에서 자녀가 아닌 다른 학생 명단 표시 정책 (FR-LX-4 와 동일하게 비공개?) | 운영자 | Medium |
| Q-LX-6 | iframe 모드에서 mic/cam 권한 prompt UX 차이가 학생에게 혼란을 주는지 베타 테스트 필요 | 운영자 | Low |

---

## 10. Implementation impact (영향 범위)

### 10.1 신규
- **BE**: `BodaLaunchContextService.build()` 응답에 `ownerName` / `evtSource` / `invitees` / `embedUrl` 필드 추가 (단일 service 변경, ~50 LOC).
- **FE**: `WebClassroomPage` 의 `<Header>` 컴포넌트 확장 + 신규 `<ClassroomEmbed>` 컴포넌트 (모드 A/B/C 분기) + `<AttendeesModal>` (FR-LX-1.1).
- **FE**: 기존 `<DemoBodaWindow>` 를 `<ClassroomEmbed mode="demo">` 로 흡수.
- **i18n**: `classroom.header.*`, `classroom.embed.*`, `classroom.error.closeReason.*` 키 × 4 locale.
- **env**: 백엔드 `BODA_EMBED_ENABLED` (기본 false).

### 10.2 수정
- `BodaLaunchContextResponseDto` 인터페이스 확장.
- `web-classroom-page.tsx` 의 demo 분기를 mode 분기로 통합.
- 4 locale `classroom.json` i18n 추가.

### 10.3 미변경
- BODA 4 테이블, webhook 수신, room state machine, instant event 흐름, idempotency-key 등 기존 모든 인프라.
- Demo simulate endpoint (BODA_SIMULATE_ENABLED) — 그대로.

---

## 11. Security note (자격증명 처리)

본 REQ 진행 중 운영자가 채팅 / 콘솔 / 메일 등 어떤 채널로든 vendor 자격증명 (Ccd / Cid / **AuCd** / **SvrApi Bearer**) 을 보내는 경우:

1. **즉시 secure 저장**: 운영자가 `/admin/config` BODA 섹션의 PUT 화면에 직접 입력 — DB 에 AES-GCM `BYTEA` 저장. **운영자 외 누구도 평문 접근 불가.**
2. **평문 미포함**: REQ / PLN / RPT / 코드 / 커밋 메시지 / 환경변수 파일에 평문 미포함. env 키 이름 (`BODA_CRYPTO_KEY`, `BODA_MODE`, `BODA_EMBED_ENABLED`) 만 기록.
3. **노출된 경우 즉시 로테이션**: 자격증명이 평문으로 chat / email / 로그에 노출된 경우, 벤더에 즉시 신규 발급 요청 + ACM 측 BYTEA 갱신. (REQ-260526 v2 NFR-3 / RPT-260610 §7.2 follow-up)

---

## 12. Sign-off (승인 대기)

- 본 REQ 는 **draft**. 운영자 검토 후 confirm 시 → 동일 일자로 PLN-260619 작성 → 5 트랙 / 약 6h 구현 진입 예상.
- 핵심 결정 사항: Q-LX-1 (vendor iframe 허용 여부) 회신 이후에야 모드 A 트랙 실제 구현. 회신 전에는 모드 B + C 우선 구현 + 헤더 강화로 MVP 충족 가능.
