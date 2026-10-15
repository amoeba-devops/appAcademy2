---
document_id: ACM-DRIVE-COMPANY-RPT-1.0.0
version: 1.0.0
status: Implemented; Google OAuth client configuration pending (user)
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Company Workspace Drive connection and storage choice / 회사 Workspace 드라이브 연동 구현 보고
---
# Company Drive Folder Report (회사 지메일 드라이브 공용폴더 구현 보고)

요구사항 [REQ-261016](../analysis/REQ-261016-drive-company-folder.md) · 계획 [PLN-261016](../plan/PLN-261016-drive-company-folder.md)

## 1. Changes (구현)
- **Workspace 전용:** 인증 URL에 `hd=*`를 넣는다. 콜백에서 `hd`(회사 도메인)가 없으면 연결하지 않고 `?drive=workspace_required`로 안내한다. 연결 도메인을 저장·표시한다.
- **공용폴더:** 이름을 지정해 생성한다(기본 `ACM - {테넌트명}`, 같은 이름은 재사용). 기존 폴더도 선택할 수 있다. 구조는 공용폴더 / 프로젝트별 하위폴더다.
- **저장소 선택:** 업로드 시 `storage=DRIVE|ACM`을 받는다. 연결 전·재연결 필요 시에는 ACM 저장소만 쓰고, 연결 후 기본값은 Drive다. Drive를 골랐는데 준비가 안 됐으면 409 `DRIVE_NOT_READY`.
- **인증 만료:** Google 토큰 갱신 실패를 401 대신 409 `DRIVE_RECONNECT_REQUIRED`로 반환한다(ACM 로그아웃 방지). `needs_reconnect`를 표시하고, 재연결하면 해제한다.
- **access token 캐시:** 만료 60초 전까지 재사용해 호출마다 반복되던 갱신을 없앴다.
- **화면**
  - `/admin/config/drive`: 3단계(로그인 → 공용폴더 → 사용), 계정·도메인·연결자·상태, 폴더 열기·변경
  - 업로드 창: 저장 위치 선택
  - 4개 언어 i18n
- **마이그레이션 1038:** `account_domain`, `needs_reconnect`, `last_error_at`.
- **운영 문서:** SETUP 문서 §4(Workspace Internal 동의 화면, OAuth 클라이언트, `.env.production` 5개 값)와 env 예시 파일을 갱신했다.

## 2. Verification (검증)
- 통합 테스트 `it-prj-drive` 19/19:
  - 일반 Gmail 거부 / Workspace 연결
  - 폴더 이름 기본값과 생성
  - 토큰 캐시
  - 만료 시 409·재연결 필요·Drive 저장 중지
  - 저장소 선택 4가지 경우
- backend 단위 테스트 734/734, frontend-acm `tsc`·`vite build` 통과.
- 실제 Google 연동은 미검증이다. 운영 OAuth 클라이언트 값이 필요하다.

## 3. Pending (남은 일 — 사용자)
1. Google Cloud OAuth 클라이언트(내부)를 생성하고 운영 `.env.production`에 5개 값을 입력한 뒤 backend를 재생성한다.
2. `/admin/config/drive`에서 회사 계정으로 로그인해 공용폴더를 지정한다.
3. Drive에서 공용폴더를 직원에게 공유한다.
