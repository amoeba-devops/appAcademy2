---
document_id: ACM-PWA-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-18
related: REQ-261018D-acm-pwa
change_log:
  - version: 1.1.0
    date: 2026-10-18
    description: Approved as proposed (Q1 one app, Q2 offline notice only, Q3 keep name/icon, Q4 reinstall on domain change) / 제안대로 승인
  - version: 1.0.0
    date: 2026-10-18
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — ACM PWA

## 1. Mockups (화면 구성안)

로그인 화면(설치 가능할 때):
```
ACM 콘솔 로그인
 이메일 [        ]  비밀번호 [      👁]
                [로그인]
 ─────────────────────────────
 📲 ACM 앱 설치 — 홈 화면에서 바로 열고 알림을 받습니다   [설치]
```
iOS Safari(설치 버튼 없음):
```
📲 홈 화면에 추가: 아래 [공유 ⬆] → [홈 화면에 추가]  (알림은 설치한 앱에서만 받을 수 있습니다)
```
사이드바 하단:
```
👤 ACM Admin   마이페이지
📲 앱 설치            ← 설치 가능할 때만
⎋ 로그아웃
```
새 버전·오프라인:
```
┌ 새 버전이 있습니다.            [새로고침] ┐      (화면 하단 토스트)
┌──────────── 📡 ────────────┐
│ 인터넷에 연결되지 않았습니다 │                  (오프라인 전체 화면)
│        [다시 시도]          │
└────────────────────────────┘
```

## 2. Work Packages (작업 단위)

| WP | 내용 |
| --- | --- |
| WP1 manifest·아이콘 | `start_url "/app"`(시작 분기 경로), `display standalone`, `theme_color`, maskable 아이콘 512, 바로가기 3개, `lang`·`description`. index.html 에 `theme-color`, `apple-mobile-web-app-capable/status-bar/title` |
| WP2 서비스 워커 | `acm-sw.js` 하나로 통합(기존 푸시 처리 그대로 이전): 앱 시작 시 항상 등록, 화면 이동(navigate) 요청만 네트워크 우선 → 실패 시 오프라인 화면. API·정적 파일은 가로채지 않음. `acm-push-sw.js` 는 새 워커를 불러오는 호환 파일로 남김(기존 구독 유지) |
| WP3 앱 화면 | `/app` 시작 분기, 설치 버튼(`beforeinstallprompt`)·iOS 안내, 새 버전 토스트(`registration.waiting` → `skipWaiting`), 오프라인 화면. 4개 언어 |
| WP4 nginx | `acm-sw.js`·`acm-push-sw.js`·`manifest.webmanifest` 는 `no-cache`(지금은 js 7일 immutable) |
| WP5 검증 | Lighthouse PWA 설치 가능 항목, Playwright: 서비스 워커 등록·오프라인 화면·새 버전 토스트, 기존 푸시 구독 유지 확인 |
| WP6 배포 | PR → CI → 스테이징 → 운영. 사용자 안내(설치 방법, 주소 변경 시 재설치) |

DB 변경 없음.
