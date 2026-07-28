# REQ-260728C — ACM Lobby Chat: Operator↔Teacher Messenger (로비채팅 — 운영자↔강사 메신저)

---
document_id: REQ-260728C
version: 1.0.0
status: CONFIRMED (2026-07-28 — SSE 실시간 + 파일전송 v1 포함 확정)
date: 2026-07-28
related:
  - docs/report/RPT-260724-material-upload-cause-and-chat-review.md (Part 2 — AMA 채팅 활용 검토)
  - ambManagement `apps/api/src/domain/amoeba-talk/*` (AMA 로비채팅 = 아메바톡, 참조 구현)
change_log:
  - 0.1.0 (2026-07-28) initial draft
---

## 1. Requirements Summary (요구사항 요약)

| # | 요구 (사용자 원문 기준) |
|---|---|
| R1 | `/admin` 에 **로비채팅** 기능 구현 (AMA 로비채팅 참조) |
| R2 | 대화방은 **AMA 운영자가 개설** — **단체방(채널)** 및 **다이렉트채팅(DM)** 지원 |
| R3 | 대화방 참석 가능자 = **AMA 운영자 + 강사** |
| R4 | 운영자는 **admin 콘솔**(`/admin`)에서 입장 |
| R5 | 강사는 **강사 포털**(`/portal`)에서 입장 |

## 2. Reference & Current State (참조 구현·현재 상태 조사 결과)

### 2.1 AMA "로비채팅" = 아메바톡 (동일 기능의 두 이름)
- ambManagement 조사 결과 별도의 로비채팅 모듈은 없으며, **amoeba-talk 이 곧 로비채팅** (Swagger `Lobby Chat - *`, 메뉴 라벨 `Lobby Chat`, i18n "로비 채팅").
- 참조 모델 요약: 채널 `PUBLIC/PRIVATE/DIRECT` + OWNER/MEMBER, **DM find-or-create**, 커서 페이징 메시지, **타임스탬프 기반 읽음 포인터**(`trs_last_read_at`) → 미읽음 카운트/읽음 수, SSE 실시간 + presence, 첨부·리액션·핀·스레드·번역.

### 2.2 ACM 적용 시 확정 사실 (RPT-260724 P1·P2 재확인)
- **AMA 아메바톡 직접 사용 불가**: 요구가 운영자·강사 모두 **ACM 화면에서 입장**이며, 포털 전용 강사는 AMA 계정이 없을 수 있음(`tch_ama_user_id` nullable). 인증 체계(AMA JWT vs ACM JWT)도 상이.
- → **ACM 자체 구현 (RPT-260724 옵션 C)** 로 확정하되, 데이터 모델·UX 는 아메바톡을 참조.
- ACM 백엔드에 SSE/WebSocket 인프라 없음 — 기존 실시간 패턴은 **React Query 폴링**(`refetchInterval`).
- 계정 2체계: 운영자 = `amb_acm_user`(usr_role ADMIN/APP_ADMIN), 강사 = `amb_acm_tch_teacher`(포털 TEACHER 의 refId = `tch_id`).

## 3. Functional Requirements (기능 요구사항)

### FR-1 대화방 (채널/DM)
- 종류: `GROUP`(단체방) / `DIRECT`(1:1 DM).
- **개설 권한: 운영자(콘솔 ADMIN·APP_ADMIN)만** — 강사는 개설 불가, 초대받은 방에 참여만 (요구 문면 기준, v1).
- GROUP: 방 이름 + 멤버 선택(운영자+강사 후보). 개설자 = OWNER. OWNER 는 멤버 추가/제외·방 삭제(soft) 가능.
- DIRECT: 상대(운영자 또는 강사) 지정 → **find-or-create** (동일 상대와 기존 DM 존재 시 재사용, 아메바톡과 동일).
- 참여자 종류: 운영자(`USER`, usr_id) / 강사(`TEACHER`, tch_id) 혼합.

### FR-2 메시지
- 텍스트 메시지 전송/조회 (최대 2,000자 — 댓글과 동일 한도).
- **파일전송 (2026-07-28 확정)**: 메시지당 파일 1개, ≤50MB, 자료실과 동일 mime 허용 목록. 다운로드는 방 멤버만.
- 커서 기반 페이징 (최신순, limit 50 — 아메바톡과 동일 방식).
- 본인 메시지 삭제(soft). 시스템 메시지(멤버 입장/제외)는 v1 제외.

### FR-3 읽음/미읽음
- 채널별·사용자별 **읽음 포인터**(last_read_at) — 방 열람 시 갱신.
- 채널 목록에 **미읽음 카운트 뱃지** (아메바톡 unread 산정식과 동일: 내가 보내지 않은 메시지 중 last_read_at 이후 건수).

### FR-4 입장 경로
- 운영자: `/admin/chat` (AppShell 사이드 메뉴 "로비채팅" 추가).
- 강사: `/portal/chat` (PortalShell 메뉴, **teacherOnly** — 학생/학부모 비노출).
- 권한: 콘솔측 API 는 ADMIN·APP_ADMIN 만, 포털측 API 는 TEACHER 만. 방 비멤버는 조회 불가(403).

### FR-5 실시간성 — **SSE (2026-07-28 확정)**
- 사용자 단일 스트림 `GET {acm|portal}/talk/events` — 아메바톡 TalkSseService 패턴(인메모리 RxJS Subject + 25초 heartbeat) 이식.
- 이벤트: `message:new` / `message:delete` / `channel:update`(개설·멤버변경). 수신 시 프론트가 해당 쿼리 갱신.
- 클라이언트는 Bearer 헤더를 보낼 수 있는 **fetch 기반 SSE 리더** 사용(EventSource 는 헤더 불가 — URL 토큰 노출 회피). 연결 유실 대비 저빈도 폴링(30초) 백스톱 유지.

## 4. Non-Functional (비기능)
- 멀티테넌시: 전 테이블 `ent_id` 스코프 (NFR-004).
- i18n: 신규 UI 문구 4 locale(ko/en/vi/zh-CN) 동시 반영.
- DB: additive 멱등 마이그레이션 `sql/acm/999k` — CD 자동 적용.
- 테스트: 서비스 규칙(개설 권한·멤버십 접근제어·DM 재사용·unread 산정) jest + be tsc/eslint + fe tsc/build.

## 5. Out of Scope — v1 (제외, 아메바톡 대비)
- 리액션, 스레드(답글), 핀, 멘션, 번역, presence(접속상태), 타이핑 표시. (첨부=파일전송은 v1 **포함**으로 확정)
- 강사의 방 개설/DM 시작 (요구 문면상 운영자만 개설).
- 미접속자 푸시/알림톡 알림 (후속: AmoebaTalk notify 연계 검토).
- STAFF·학생·학부모 참여.

## 6. Future Enhancements (후속 후보)
- SSE 실시간(@nestjs @Sse — 아메바톡 TalkSseService 패턴 이식), 첨부파일(S3 재사용), 강사 DM 개설 허용, 미접속 알림.

## 7. Confirmed Decisions (확정 사항 — 2026-07-28)

| 항목 | 확정 | 비고 |
|---|---|---|
| 실시간 방식 | **SSE** (fetch 리더 + heartbeat, 폴링 백스톱) | 사용자 지시 |
| 파일전송 | **v1 포함** — 메시지당 1개·≤50MB·mime 허용목록 | 사용자 지시 |
| 운영자 범위 | usr_role `ADMIN`·`APP_ADMIN` (STAFF 제외) | 제안 기본값 |
| 강사 개설 권한 | 없음 (참여만) | 요구 문면 기준 |
