# PLN-260728C — ACM Lobby Chat Implementation Plan (로비채팅 작업 계획서)

---
document_id: PLN-260728C
version: 1.1.0
status: IMPLEMENTED (2026-07-28 — 하단 구현 노트 참조)
date: 2026-07-28
related: docs/analysis/REQ-260728C-acm-lobby-chat.md
change_log:
  - 0.1.0 (2026-07-28) initial draft
  - 1.0.0 (2026-07-28) 사용자 확정 — 폴링→SSE 전환, 파일전송 v1 포함
---

## 0. Phase Overview (단계 개요)

| Phase | 내용 | 위험 |
|---|---|---|
| **A** | DB (sql/acm/999k) + `acm-talk` 백엔드 모듈 (서비스·콘솔/포털 컨트롤러·테스트) | 중 |
| **B** | Admin 콘솔 UI `/admin/chat` (채널목록·대화창·개설 모달) | 중 |
| **C** | 강사 포털 UI `/portal/chat` (참여 전용) | 소 |
| **D** | i18n 4 locale + 검증·배포 | 소 |

전체 1 PR. 예상 공수: 3~4일 (RPT-260724 옵션 C 를 v1 경량 스펙으로 축소).

## 1. Phase A — Backend (`backend/src/modules/acm-talk/`)

### DB — `sql/acm/999k-acm-talk-lobby-chat.sql` (additive·멱등)
```sql
-- 대화방 (GROUP=단체방/채널, DIRECT=1:1)
CREATE TABLE IF NOT EXISTS amb_acm_talk_channel (
  tlc_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id         UUID NOT NULL,
  tlc_type       VARCHAR(10) NOT NULL CHECK (tlc_type IN ('GROUP','DIRECT')),
  tlc_name       VARCHAR(100) NOT NULL,
  tlc_created_by UUID NOT NULL,            -- amb_acm_user.usr_id (운영자만 개설)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);
-- 멤버 (읽음 포인터 포함 — 아메바톡 read_status 를 멤버 행에 통합)
CREATE TABLE IF NOT EXISTS amb_acm_talk_member (
  tlm_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id           UUID NOT NULL,
  tlc_id           UUID NOT NULL,
  tlm_kind         VARCHAR(10) NOT NULL CHECK (tlm_kind IN ('USER','TEACHER')),
  tlm_ref_id       UUID NOT NULL,          -- USER→usr_id / TEACHER→tch_id
  tlm_role         VARCHAR(10) NOT NULL DEFAULT 'MEMBER' CHECK (tlm_role IN ('OWNER','MEMBER')),
  tlm_last_read_at TIMESTAMPTZ,
  tlm_joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tlm_left_at      TIMESTAMPTZ
);
-- 메시지 (TEXT | FILE — 파일전송 v1 포함, 메시지당 1파일·≤50MB)
CREATE TABLE IF NOT EXISTS amb_acm_talk_message (
  tms_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id          UUID NOT NULL,
  tlc_id          UUID NOT NULL,
  tms_sender_kind VARCHAR(10) NOT NULL CHECK (tms_sender_kind IN ('USER','TEACHER')),
  tms_sender_ref  UUID NOT NULL,
  tms_type        VARCHAR(10) NOT NULL DEFAULT 'TEXT' CHECK (tms_type IN ('TEXT','FILE')),
  tms_content     TEXT NOT NULL DEFAULT '',
  tms_filename    VARCHAR(255),
  tms_mime        VARCHAR(100),
  tms_size_bytes  BIGINT,
  tms_s3_key      VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_acm_talk_member_ref ON amb_acm_talk_member (ent_id, tlm_kind, tlm_ref_id) WHERE tlm_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_talk_member_chn ON amb_acm_talk_member (ent_id, tlc_id) WHERE tlm_left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_talk_msg_chn    ON amb_acm_talk_message (ent_id, tlc_id, created_at DESC) WHERE deleted_at IS NULL;
```

### Service — `TalkService` (actor = `{ kind: 'USER'|'TEACHER', refId }`)
- `listMyChannels(actor)` — 내 멤버 채널 + 마지막 메시지 + **unread 카운트**(아메바톡 산정식: 미발신·미삭제·`created_at > tlm_last_read_at`).
- `createChannel(operator, name, members[])` — **운영자 전용**, 개설자 OWNER 삽입, 멤버 검증(usr/tch 존재 + 강사/운영자만).
- `findOrCreateDm(operator, target{kind,refId})` — DIRECT 채널에서 두 멤버 동시 재적 행 검색(아메바톡 SQL 패턴) → 없으면 생성. 방 이름 = "이름A, 이름B".
- `updateMembers(owner, channelId, members[])` — GROUP·OWNER 전용 추가/제외(left_at). OWNER 제거 불가.
- `listMessages(actor, channelId, cursor?, limit=50)` — 멤버십 검증 후 **커서 페이징**(msg_id 커서 → created_at 미만, 아메바톡 방식).
- `sendMessage(actor, channelId, content)` — 멤버 전용, ≤2,000자, 발신자 read 포인터 동시 갱신, SSE `message:new`.
- `sendFile(actor, channelId, file)` — 멤버 전용, ≤50MB·mime 허용목록(자료실과 동일), S3 `talk/{entId}/…` 저장, FILE 메시지 + SSE.
- `downloadFile(actor, messageId)` — 방 멤버만 스트림 다운로드.
- `markRead(actor, channelId)` — `tlm_last_read_at = NOW()`.
- `deleteMessage(actor, messageId)` — 본인만 soft delete, SSE `message:delete`.

### TalkSseService (아메바톡 패턴 이식)
- 인메모리 RxJS `Subject` — 이벤트 `{ entId, memberKeys[], payload{type, channelId, data} }`.
- `subscribe(entId, actorKey)` → entId+멤버키 필터 + **25초 heartbeat** merge → `Observable<MessageEvent>`.
- 컨트롤러 `@Sse('events')` (콘솔·포털 각각, 기존 JWT 가드 그대로 — 클라이언트가 fetch 리더로 Bearer 헤더 전송). `X-Accel-Buffering: no` 헤더로 nginx 버퍼링 차단.
- 이벤트 타입: `message:new` / `message:delete` / `channel:update` / `heartbeat`.
- `listCandidates(entId)` — 참여자 후보 = 운영자(usr_role ADMIN·APP_ADMIN, ACTIVE) + 강사(재직) 이름/종류.
- 삭제 채널·탈퇴 멤버 접근 차단, 전부 `ent_id` 스코프.

### Controllers
| Guard | Path | Endpoints |
|---|---|---|
| `AcmJwtAuthGuard`+`RolesGuard` `@Roles('ADMIN','APP_ADMIN')` | `acm/talk` | GET `channels` · POST `channels` · POST `channels/dm` · PUT `channels/:id/members` · DELETE `channels/:id` · GET `channels/:id/messages` · POST `channels/:id/messages` · POST `channels/:id/files`(multipart) · GET `files/:messageId/download` · POST `channels/:id/read` · DELETE `messages/:id` · GET `candidates` · **SSE GET `events`** |
| `PortalJwtAuthGuard` (kind=TEACHER 게이트) | `portal/talk` | GET `channels` · GET `channels/:id/messages` · POST `channels/:id/messages` · POST `channels/:id/files` · GET `files/:messageId/download` · POST `channels/:id/read` · DELETE `messages/:id` · **SSE GET `events`** (개설·멤버관리 없음) |

- actor 매핑: 콘솔 `AcmCurrentUser.id`→`{kind:'USER'}` / 포털 `PortalAuthUser.refId(tch_id)`→`{kind:'TEACHER'}` (TEACHER 외 403).
- 모듈 등록: `acm.module.ts` imports/exports (acm-material 패턴).

### Tests (jest)
운영자만 개설 / 강사 개설·비멤버 접근 403 / DM find-or-create 재사용 / unread 산정 / 커서 페이징 / OWNER 제거 불가 / 본인 메시지만 삭제.

## 2. Phase B — Admin UI (`/admin/chat`)

- 라우트: router.tsx `/admin` children 에 `{ path: 'chat', element: <AdminChatPage /> }`.
- 메뉴: app-shell.tsx `NAV` 에 `{ to: '/admin/chat', icon: MessagesSquare, key: 'chat' }` + i18n `nav.chat`.
- 페이지: `frontend-acm/src/modules/talk/pages/admin-chat-page.tsx` + 공용 컴포넌트(`modules/talk/components/`) — 채널목록/대화창은 포털과 공유, 개설 모달은 admin 전용.
- 실시간: **fetch 기반 SSE 리더 훅**(`useTalkEvents`) — Bearer 헤더 전송, 3초 백오프 재연결, 이벤트 수신 시 해당 React Query 캐시 무효화. 백스톱 폴링 30s. 방 진입/새 메시지 수신 시 `read` 호출.
- 컴포저: 텍스트 입력 + 📎 파일 버튼(선택 즉시 FILE 메시지 전송, ≤50MB).

### UI Mockup — Admin (화면 구성안)
```
/admin/chat                                  로비채팅
┌─ 채널 (w-64) ────────┬─ 대화창 ─────────────────────────────┐
│ [+ 새 채널] [+ DM]    │  # 수학팀 공지            멤버 5 [멤버관리]│
│ ─────────────────    │ ──────────────────────────────────── │
│ # 수학팀 공지     (3) │  김강사   10:01                        │
│ # 전체 강사방         │  │ 다음주 시험범위 공유드립니다          │
│ ● 김강사 (DM)     (1) │  나       10:02                        │
│ ● 이강사 (DM)         │                안내 감사합니다 │        │
│                      │  ⋮ (위로 스크롤 시 이전 50건 로드)       │
│  (미읽음 뱃지,        │ ──────────────────────────────────── │
│   최근 메시지순 정렬)  │  [메시지 입력……………………]      [전송]  │
└──────────────────────┴──────────────────────────────────────┘

[+ 새 채널] 모달                    [+ DM] 모달
┌───────────────────────┐        ┌───────────────────────┐
│ 방 이름 [___________]  │        │ 상대 검색 [____]        │
│ 멤버 검색 [____]        │        │ ○ [운영자] 박운영       │
│ ☑ [강사]김강사          │        │ ○ [강사] 김강사         │
│ ☑ [강사]이강사 ☐ [운영자]…│        │   (기존 DM 있으면 재사용) │
│         [개설] [취소]   │        │         [시작] [취소]   │
└───────────────────────┘        └───────────────────────┘
```

## 3. Phase C — Teacher Portal UI (`/portal/chat`)

- 라우트: `/portal` children 에 `{ path: 'chat', element: <PortalChatPage /> }`.
- 메뉴: portal-shell.tsx `NAV` 에 `{ to: '/portal/chat', icon: MessagesSquare, key: 'chat', teacherOnly: true }`.
- **api-client.ts `isPortalEndpoint()` 에 `/portal/talk` 프리픽스 추가 필수** (미추가 시 admin 토큰 전송 → 401, 기존 `/portal/teacher` 와 동일 함정).
- 개설·멤버관리 버튼 없음 — 참여 방 목록 + 대화만.

### UI Mockup — Portal (강사)
```
/portal/chat                                 로비채팅 (강사)
┌─ 대화방 ─────────────┬─ 대화창 ─────────────────────────────┐
│ # 수학팀 공지     (2) │  # 수학팀 공지          참여자: 운영자,… │
│ ● 박운영 (DM)         │ ──────────────────────────────────── │
│                      │  박운영   09:55                        │
│  (개설 버튼 없음)      │  │ 신학기 시간표 확인 부탁드립니다      │
│                      │  나       10:01                        │
│                      │            확인했습니다, 감사합니다 │    │
│                      │ ──────────────────────────────────── │
│                      │  [메시지 입력……………………]      [전송]  │
└──────────────────────┴──────────────────────────────────────┘
```

## 4. Phase D — 공통·검증·배포
- i18n: `nav.chat`, `portalApp.nav.chat`, `talk.*` 신규 네임스페이스 — 4 locale 동시.
- 검증: be jest·tsc·eslint / fe tsc·build. 수동: 운영자 개설→강사 포털 수신, DM 재사용, 비멤버 403, 미읽음 뱃지, 학생/학부모 메뉴 비노출.
- 마이그레이션 999k — 로컬 수동 1회, staging/prod CD 자동.
- Git: `feat(talk): 로비채팅 — 운영자↔강사 채널·DM (PLN-260728C)`.

## 5. Explicitly Deferred (후속)
리액션·핀·스레드·멘션 / presence·타이핑 / 미접속 알림(AmoebaTalk notify) / 강사 DM 개설 / 메시지당 다중 파일. (SSE·파일전송은 v1 포함으로 확정)

## 6. Implementation Notes (구현 결과 — 2026-07-28)

- **BE**: `backend/src/modules/acm-talk/` — 엔티티 3종 + `TalkService`(개설/DM find-or-create/멤버교체/커서 페이징/unread 집계/파일 50MB·mime 검증) + `TalkSseService`(Subject + 25s heartbeat) + 콘솔·포털 컨트롤러(@Sse events 포함). `acm.module.ts` 등록.
- **전역 인터셉터**: `TransformInterceptor` 에 `__sse__` 메타데이터 스킵 추가 — SSE 이벤트가 `{success,data}` 로 감싸져 깨지는 문제 예방.
- **FE**: `frontend-acm/src/modules/talk/` — `talk-api.ts`(mode 분기), `use-talk-events.ts`(fetch 스트림 SSE 리더, Bearer 헤더·3s 재연결), `talk-chat.tsx`(채널목록+대화창+새채널/DM/멤버관리 모달), admin/portal 페이지. 라우트 `/admin/chat`·`/portal/chat`(teacherOnly), `isPortalEndpoint` 에 `/portal/talk` 추가.
- **SSE 수신** → talk-channels/talk-messages 쿼리 무효화, 백스톱 폴링 30s 유지.
- **DB**: `sql/acm/999k` (3 테이블 + 인덱스 3, 멱등) — 로컬 적용 완료, staging/prod CD 자동.
- 검증: be jest 53 suites/451 tests(talk 15 신규)·tsc·eslint 0 errors / fe tsc·build clean / i18n `talk.*`+`nav.chat`+`portalApp.nav.chat` 4 locale.
