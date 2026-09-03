---
document_id: SYS-REQ-260903C
version: 1.1.0
status: CONFIRMED (2026-09-03 사용자 확정 "진행" — Q-A 알림음 제외, Q-B 미리보기 노출)
date: 2026-09-03
change_log:
  - 2026-09-03 v1.1.0 사용자 확정 반영
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# REQ-260903C — 채팅 전역 알림·실시간 강화 + 신규상담 접수 알림 / Global Chat Alerts & New-Inquiry Notification

## 1. Overview (개요)

1. 새 채팅 수신 시 **관리자 콘솔 어느 화면에서든** 알림(토스트 + 사이드바 배지)이 보이게 한다.
2. 채팅창에서 새 메시지가 **새로고침 없이 즉시** 표시되게 한다 (Google Chat 수준).
3. **신규상담 접수 시 알림 필수** — 콘솔 접속 중인 운영자 전원에게 즉시 표시(수동 닫기 전까지 유지되는 sticky 알림).

## 2. Current State (현행 분석)

- **채팅 SSE는 이미 구축·동작** (`talk-sse.service.ts`, fetch 스트림 리더 `use-talk-events.ts`, 25s heartbeat, 3s 재연결, 30s 폴링 백스톱).
- **문제 1 (전역 알림 부재)**: SSE 구독이 채팅 컴포넌트(`TalkChat`) 안에만 있어 `/admin/chat`을 벗어나면 스트림이 끊긴다 → 다른 화면에서는 새 채팅을 알 방법이 없음. 헤더 벨·네비 배지·이벤트→토스트 연결 전무.
- **문제 2 (즉시성)**: SSE 수신 시 캐시 직접 반영이 아니라 invalidate→재조회 왕복이고, 탭이 비활성일 때 백스톱 폴링이 멈춤(React Query 기본값). SSE 페이로드에 메시지 전문이 이미 실려 있어 즉시 append 가능(단, `mine` 플래그는 서버가 더미 값이라 클라이언트 재계산 필요). 프록시는 백엔드 `X-Accel-Buffering: no`에 의존 — nginx `proxy_buffering off` 명시가 안전.
- **문제 3 (상담 알림 전무)**: 홈페이지 접수(`POST /api/web/contact`, `/api/web/test`)·콘솔 등록 모두 `acm.csl.created` 이벤트를 발행하지만 **리스너 0개** — 알림/배지/로그 아무것도 없음. 상담 목록 페이지는 폴링도 없어 수동 새로고침 전까지 안 보임.
- 채팅 SSE 버스는 멤버키 필터형(브로드캐스트 불가), 관리자 채팅 스트림은 ADMIN/APP_ADMIN 전용(STAFF 제외) → 상담 알림은 **별도의 테넌트 브로드캐스트 스트림**이 적합.
- 전역 `ToastProvider`는 이미 앱 전체에 마운트됨(4초 자동 닫힘 고정 — sticky 옵션 필요).

## 3. Requirements (요구사항)

| ID | 요구사항 |
|----|---------|
| FR-1 | **전역 채팅 알림**: 채팅 SSE 구독을 관리자 셸(AppShell) 레벨로 승격. 새 메시지 수신 시 ① 채팅 화면이 아니면 토스트("○○○: 메시지 미리보기", 클릭 시 /admin/chat 이동) ② 사이드바 채팅 메뉴에 미읽음 합계 배지 |
| FR-2 | **채팅 즉시 표시**: `message:new` 수신 시 메시지 캐시에 직접 append(왕복 제거, `mine`은 클라이언트 계산) + invalidate 백업 유지. 백스톱 폴링은 백그라운드 탭에서도 동작하도록 변경. nginx(컨테이너·호스트)에 `proxy_buffering off` 명시 |
| FR-3 | **신규상담 접수 알림**: 테넌트 브로드캐스트 SSE 스트림 신설(`GET /api/acm/notifications/events`, 콘솔 전 역할 — STAFF 포함). `acm.csl.created` 리스너가 `csl:new-inquiry` 이벤트 발행 → 콘솔 접속 운영자 전원에게 **sticky 토스트**(수동 닫기, "상담 목록 열기" 버튼) + 상담 목록 자동 갱신 |
| FR-4 | 토스트 확장: sticky(자동 닫힘 없음)·액션 버튼 옵션 |
| NFR | i18n 4 locale 동시. 단일 인스턴스 전제(기존 SSE 버스와 동일 제약 — 문서화). 연결 2본(채팅+알림)/세션 이내 |

## 4. Out of Scope (범위 외)

- OS 브라우저 푸시(Notification API)·알림음 — 후속 옵션
- AmoebaTalk/이메일/SMS 채널 발송 (인앱 알림만)
- 강사 포털 측 전역 알림 (관리자 콘솔 우선 — 포털은 채팅 페이지 내 기존 동작 유지)
- 다중 인스턴스 대응(Redis pub/sub) — 현 배포는 단일 인스턴스

## 5. Open Questions (확인)

- Q-A: 신규상담 sticky 알림과 함께 **알림음(beep)** 필요 여부 — 기본 제외 제안
- Q-B: 채팅 토스트 미리보기에 메시지 본문 일부 노출 여부 — 발신자명 + 앞 40자 제안
