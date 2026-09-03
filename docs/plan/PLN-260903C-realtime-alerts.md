---
document_id: SYS-PLN-260903C
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903C-realtime-alerts.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료. 계획 대비 추가 — 채팅 SSE 페이로드에 senderRefId 추가(클라이언트 mine 재계산용), 셸 배지 쿼리 60s 폴링(백그라운드 포함). 로컬 e2e — 홈페이지 접수→csl:new-inquiry SSE 수신, 채팅 message:new senderRefId 확인
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903C — 채팅 전역 알림·실시간 강화 + 신규상담 알림 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 전역 토스트 (콘솔 어느 화면에서든)

```
                                     ┌───────────────────────────────┐
  (새 채팅)                           │ 💬 김강사: 내일 보강 가능할까요…   │ ← 4초 자동 닫힘
                                     │                    [채팅 열기]  │    클릭 시 /admin/chat
                                     ├───────────────────────────────┤
  (신규상담 접수 — sticky)             │ 🔔 신규상담 접수 #124 (홈페이지)  │ ← 자동 닫힘 없음
                                     │        [상담 목록 열기]    [✕]  │    수동 닫기 필수
                                     └───────────────────────────────┘
```

### 1.2 사이드바 배지

```
│ 📋 신규 상담          │
│ 💬 채팅          (3) │ ← 미읽음 채널 합계, 0이면 숨김
```

## 2. Backend

| # | 항목 | 내용 |
|---|------|------|
| B1 | `AdminEventsSseService` (acm-notification) | 테넌트 브로드캐스트 SSE 버스 — `emitToTenant(entId, payload)` / `subscribe(entId)`, 25s heartbeat, 기존 talk-sse 패턴 준용(단일 인스턴스 제약 동일·문서화) |
| B2 | `GET /api/acm/notifications/events` | `AcmJwtAuthGuard`만(콘솔 전 역할 — STAFF 포함), `X-Accel-Buffering: no` |
| B3 | `CslCreatedListener` (acm-notification) | `@OnEvent('acm.csl.created')` → `{type:'csl:new-inquiry', data:{inqId, seqNo, applyType, inflowType}}` 브로드캐스트. ADR-002 원칙(모듈 간 EventEmitter) 준수 — acm-csl 무변경 |
| B4 | nginx | `frontend-acm/nginx.conf.template` `/api/`에 `proxy_buffering off;` 추가 (호스트 nginx는 X-Accel-Buffering 헤더로 충분 — 변경 없음) |

기존 채팅 SSE(`/acm/talk/events`)는 무변경. 새 테이블·마이그레이션 없음.

## 3. Frontend (frontend-acm)

| # | 항목 | 내용 |
|---|------|------|
| F1 | `toast.tsx` 확장 | `show(..., { sticky?, actionLabel?, onAction? })` — sticky 는 수동 닫기 전 유지 |
| F2 | `AdminRealtimeProvider` 신규 (AppShell 내부) | 관리자 로그인 시 2개 스트림 구독: ① 채팅 `/acm/talk/events`(ADMIN/APP_ADMIN만) ② 알림 `/acm/notifications/events`(전 역할). 기존 `use-talk-events` 스트림 리더 재사용(일반화) |
| F3 | 채팅 이벤트 처리 | `message:new` → talk 캐시 invalidate + **`/admin/chat` 밖이면 토스트**(발신자+40자, [채팅 열기]) . `TalkChat` 내부의 자체 `useTalkEvents` 구독 제거(전역 구독으로 일원화) + **메시지 캐시 직접 append**(`setQueryData`, `mine` 클라이언트 계산, dedupe) |
| F4 | 채팅 배지 | 셸에서 `['talk-channels','admin']` 쿼리(unreadCount 합계, 이벤트 시 invalidate) → NAV 채팅 항목에 배지. ADMIN/APP_ADMIN에서만 조회 |
| F5 | 신규상담 알림 | `csl:new-inquiry` → sticky 토스트("신규상담 접수 #{{seqNo}}", [상담 목록 열기] → /admin/csl) + `['csl','list']` invalidate |
| F6 | 폴링 보강 | talk 백스톱 폴링 `refetchIntervalInBackground: true` |
| F7 | i18n | `common` `realtime.*` 키 4 locale |

## 4. Order & Verification (순서·검증)

1. B1~B3 → 로컬: SSE curl 구독 상태에서 `POST /api/web/contact` 호출 → `csl:new-inquiry` 수신 확인
2. F1~F2 → F3~F6 → `tsc`·build
3. 로컬 e2e: 브라우저 2탭(관리자 A: 대시보드 / 강사 B: 포털 채팅) — B 발신 → A 대시보드 토스트+배지 즉시 확인, A 채팅창에서는 새로고침 없이 즉시 append 확인. 홈페이지 접수 폼 제출 → A sticky 토스트 + 목록 자동 갱신 확인
4. 회귀: 채팅 송수신·읽음처리·삭제 기존 동작, STAFF 계정으로 알림 스트림 수신 확인 → PR

리스크: SSE 연결 수 증가(세션당 2본) — heartbeat 25s로 프록시 타임아웃 내 유지, 실패 시 3s 재연결 + 30s 폴링 백스톱으로 저하 동작. 예상 규모: 백엔드 ~4파일, 프론트 ~7파일.
