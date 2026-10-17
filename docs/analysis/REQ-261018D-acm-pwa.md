---
document_id: ACM-PWA-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-18
change_log:
  - version: 1.0.0
    date: 2026-10-18
    description: Installable PWA for ACM (console + portal) / ACM 앱 설치(PWA)
---
# ACM PWA Requirements (ACM 앱 설치 요구사항)

요청 원문: "acm - PWA 구현"

## 1. Current (현황, 2026-10-18)

| 항목 | 현재 |
| --- | --- |
| manifest | `/manifest.webmanifest` 있음 — 이름 "ACM", `start_url "/"`(공개 포털 홈), 아이콘 192·512(일반), maskable 없음 |
| 서비스 워커 | `acm-push-sw.js` — **알림 켤 때만 등록**, 웹 푸시 전용(캐시·오프라인 없음) |
| iOS | `apple-touch-icon` 만. 홈 화면 앱 메타(`apple-mobile-web-app-*`), 테마 색 없음 |
| 설치 안내 | 없음(브라우저 기본 메뉴로만 설치 가능) |
| 캐시 | nginx 가 `*.js` 를 7일 `immutable` 캐시 — 서비스 워커 파일도 포함 |
| 도메인 | 메인 `acm-tpi.amoeba.site`(최종 `acm.tpi.co.kr` 예정), 보조 `acm.amoeba.site` |

## 2. Requirements (요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 휴대폰·PC 에 **앱으로 설치**(Android·Chrome·Edge 설치 버튼, iOS 홈 화면 추가) — 주소창 없는 전체 화면 |
| FR-2 | 앱을 열면 로그인 상태에 맞는 첫 화면: 콘솔 사용자 → 대시보드, 포털 사용자(학생·학부모·강사) → 포털, 로그인 전 → 로그인 선택 |
| FR-3 | **설치 안내**: 로그인 화면·사이드바 하단 "앱 설치" 버튼(설치 가능할 때만), iOS 는 "공유 → 홈 화면에 추가" 안내 |
| FR-4 | **오프라인 안내 화면**: 인터넷이 끊기면 "연결되지 않았습니다 [다시 시도]" (업무 데이터는 저장하지 않음) |
| FR-5 | **새 버전 알림**: 배포 후 "새 버전이 있습니다 [새로고침]" |
| FR-6 | 웹 푸시는 지금처럼 동작(같은 서비스 워커로 통합). iOS 는 설치한 앱에서만 알림 가능(iOS 16.4+) 안내 |
| FR-7 | 앱 아이콘 maskable(안드로이드 모양 맞춤), 바로가기(대시보드·일정·알림함), 테마 색 |
| NFR | API·로그인 응답은 캐시하지 않는다(개인정보·최신성). 4개 언어. 테넌트 중립 이름·아이콘 |

## 3. Open Questions (확인 사항)

| Q | 내용 | 제안 |
| --- | --- | --- |
| Q1 | 앱을 하나로 할지(콘솔+포털) 두 개로 나눌지 | **하나**("ACM") — 열 때 로그인 상태로 화면을 나눈다 |
| Q2 | 오프라인 범위 | **안내 화면만**(데이터 캐시 없음) |
| Q3 | 앱 이름·아이콘 | 지금 이름 **"ACM"**·현재 아이콘 유지(+maskable 판) |
| Q4 | 도메인 | 설치한 앱은 주소별로 따로다. `acm.tpi.co.kr` 로 바뀌면 **다시 설치** 필요 — 안내 문구로 처리 |
