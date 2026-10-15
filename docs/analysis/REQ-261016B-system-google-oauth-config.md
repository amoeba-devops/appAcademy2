---
document_id: ACM-SYS-GOOGLE-OAUTH-REQ-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Defaults approved for Q1–Q3 / 제안 기본값 승인
  - version: 1.0.0
    date: 2026-10-16
    description: System settings menu with Google OAuth app guide and registration / 시스템 설정 · Google OAuth 앱 설정
---
# System Google OAuth Settings Requirements (시스템 설정 · Google OAuth 앱 설정 요구사항)

## 1. Request (요청)
`/system/admin` 좌측 메뉴의 사용자관리·테넌트관리 아래에 **시스템 설정** 메뉴를 만든다. 하위 메뉴 **Google OAuth 앱 설정**에서 아래 두 가지를 제공한다.
1. Google Cloud에서 OAuth 클라이언트와 Picker API 키를 만드는 **가이드**
2. 만든 값을 ACM에 **등록**하는 기능

## 2. Current State (현재)
- Google 앱 값 5개(Client ID / Client Secret / Redirect URI / Picker API Key / Project Number)는 운영 서버 환경변수(`ACM_GOOGLE_*`)로만 읽는다. 바꾸려면 서버 파일을 수정하고 컨테이너를 재생성해야 한다(`drive.client.ts`).
- 한 벌의 값을 모든 테넌트가 공유한다. 각 테넌트는 `/admin/config/drive`에서 자기 회사 Workspace 계정으로 로그인한다(REQ-261016).
- 시스템 어드민(`APP_ADMIN`) 메뉴는 사용자관리·테넌트관리 두 개뿐이다(`system-shell.tsx`).

## 3. Requirements (요구사항)
- **FR-1 메뉴:** 시스템 어드민 사이드바에 `시스템 설정` 그룹을 두고, 하위에 `Google OAuth 앱 설정`(`/system/settings/google-oauth`)을 둔다. APP_ADMIN만 접근한다(서버 검사).
- **FR-2 가이드:** 단계별 가이드를 제공하고, 아래 ACM 값을 [복사] 버튼과 함께 보여준다.
  1. Google Cloud 프로젝트 생성·선택
  2. Drive API·Picker API 사용 설정
  3. OAuth 동의 화면(외부 + 게시, 범위 `openid`·`email`·`drive.file`)
  4. OAuth 웹 클라이언트 생성(승인된 JavaScript 원본·리디렉션 URI)
  5. API 키 생성과 제한(HTTP 리퍼러·Picker API)
  6. 프로젝트 번호 확인

  복사할 값: 승인된 원본, 리디렉션 URI, 범위.
- **FR-3 등록:** 5개 값을 입력·저장한다.
  - Client Secret은 암호화 저장하고 다시 보여주지 않는다. 빈 칸으로 저장하면 기존 값을 유지한다.
  - Picker 키는 마스킹해 표시한다.
  - 형식 검증: Client ID는 `*.apps.googleusercontent.com`, 프로젝트 번호는 숫자, API 키는 `AIza…`, 리디렉션 URI는 https.
- **FR-4 연결 테스트:** [연결 확인]으로 Client ID/Secret 조합이 Google에서 유효한지 확인한다(테넌트 데이터 접근 없음).
- **FR-5 적용:** 저장 즉시 재시작 없이 적용한다. 저장 값이 없으면 기존 환경변수를 쓴다. 화면에 현재 적용 출처(시스템 설정 / 서버 환경변수 / 미설정)를 표시한다.
- **FR-6 이력:** 마지막 수정자·수정 일시를 표시한다. 값 변경은 감사 로그에 남기며, 비밀값은 로그에 기록하지 않는다.

## 4. Constraints (제약)
- 값은 시스템 전체 1벌이다(테넌트별 아님). 클라이언트를 바꾸면 기존 테넌트 연결(refresh token)은 이전 클라이언트에 묶여 있어 각 테넌트가 다시 연결해야 할 수 있다. 화면에서 이를 경고한다.
- 여러 회사(테넌트)가 사용하므로 동의 화면은 **외부(External) + 게시(In production)**로 안내한다. Workspace 전용 제한은 ACM이 `hd`로 검사한다. 앞서 SETUP 문서의 "내부(Internal)" 권장은 정정한다.

## 5. Open Questions (확인 필요)
| Q | 내용 | 제안 기본값 |
|---|---|---|
| Q1 | 저장값과 환경변수 우선순위 | 시스템 설정 저장값 우선, 없으면 환경변수 |
| Q2 | 값 삭제(초기화) 허용 | 허용. 삭제하면 환경변수로 돌아가며 확인창을 띄운다 |
| Q3 | 스테이징 | 서버별 DB라서 스테이징은 스테이징 화면에서 따로 등록한다(리디렉션 URI 기본값은 현재 접속 도메인) |

## 6. Decisions (확정 · 2026-10-16)
Q1–Q3 제안 기본값 승인: 저장값 우선(없으면 환경변수), 초기화 허용(확인창), 스테이징은 별도 등록.
