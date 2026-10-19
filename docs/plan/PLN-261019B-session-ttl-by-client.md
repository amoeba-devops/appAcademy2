---
document_id: ACM-SESSION-TTL-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-19
related: REQ-261019B-session-ttl-by-client
change_log:
  - version: 1.1.0
    date: 2026-10-19
    description: Approved as proposed (Q1 mobile browser 4h, Q2 all logins, Q3 fixed from login, Q4 existing tokens keep) / 제안대로 승인
  - version: 1.0.0
    date: 2026-10-19
    description: Work plan with UI mockup / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — 접속 환경별 로그인 유지 시간

## 1. Mockup (화면 구성안)

시간이 지나 로그인 화면으로 돌아왔을 때:
```
ACM 콘솔 로그인
┌──────────────────────────────────────────────┐
│ ⓘ 로그인 시간이 지나 다시 로그인해 주세요.        │   ← Notice(info), 4개 언어
└──────────────────────────────────────────────┘
 이메일 [            ]
 비밀번호 [          👁]
              [로그인]          → 로그인 후 보던 화면으로
```
(포털·학부모 로그인 화면도 동일)

## 2. Work Packages

| WP | 내용 |
| --- | --- |
| WP1 화면→서버 | 공용 API 클라이언트가 요청마다 `X-ACM-Client: pwa`(설치 앱: display-mode standalone 또는 iOS standalone) / `web` 헤더를 붙인다 |
| WP2 서버 | 모든 로그인 발급 지점(콘솔 로그인·AMA SSO 교환·포털·학부모)에서 헤더에 따라 `expiresIn` = PWA 8h / 그 외 4h. env `ACM_JWT_EXPIRES_IN_WEB`·`ACM_JWT_EXPIRES_IN_PWA`(기본 4h·8h), 기존 `ACM_JWT_EXPIRES_IN` 은 대체. 응답에 `expiresAt` 포함 |
| WP3 화면 | 로그인 시 `expiresAt` 저장 → 그 시각에 자동 로그아웃(앱이 켜져 있어도), 401 로 돌아온 경우와 함께 로그인 화면에 만료 안내 표시. 4개 언어 |
| WP4 테스트 | 통합: 헤더별 토큰 만료 시간(4h·8h), 헤더 없음=4h, 만료 토큰 401. 화면: 만료 시 안내·복귀 |
| WP5 배포 | PR → CI → 스테이징 → 운영. 운영 env 추가 불필요(기본값) |
