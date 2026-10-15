---
document_id: ACM-SYS-GOOGLE-OAUTH-RPT-1.0.0
version: 1.0.0
status: Implemented
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: System settings · Google OAuth app implementation report / 시스템 설정 Google OAuth 구현 보고
---
# System Google OAuth Settings Report (시스템 설정 · Google OAuth 앱 구현 보고)

요구사항 [REQ-261016B](../analysis/REQ-261016B-system-google-oauth-config.md) · 계획 [PLN-261016B](../plan/PLN-261016B-system-google-oauth-config.md)

## 1. Changes (구현)
- **메뉴:** `/system` 사이드바 사용자 관리·테넌트 관리 아래에 `시스템 설정 ▸ Google OAuth 앱 설정`(`/system/settings/google-oauth`)을 추가했다. 화면은 APP_ADMIN만 들어갈 수 있다.
- **가이드:** 6단계(프로젝트, API, 동의 화면 외부·게시, 웹 클라이언트, Picker API 키 제한, 프로젝트 번호)와 콘솔 바로가기를 넣었다. 승인된 도메인·범위·원본·리디렉션 URI·리퍼러는 복사 버튼으로 제공한다. 4개 언어.
- **등록**
  - Client Secret은 AES-GCM으로 암호화 저장하고 다시 보여주지 않는다(빈 칸 = 유지).
  - Picker 키는 마스킹 표시한다(빈 칸 = 유지).
  - 형식을 검증한다.
  - 수정자·일시를 표시하고, 감사 로그에는 바뀐 필드 이름만 남긴다.
- **적용**
  - `DriveClient.setting()`은 시스템 설정 저장값을 먼저 쓰고, 없으면 `ACM_GOOGLE_*` 환경변수를 쓴다(행 단위).
  - 캐시를 시작 시·60초마다·저장 직후 갱신하므로 재시작이 필요 없다.
  - 화면에 적용 출처(시스템 설정 / 서버 환경변수 / 미설정)를 표시한다.
- **연결 확인:** 일부러 잘못된 code로 토큰 교환을 시도한다. `invalid_grant`면 유효, `invalid_client`·`redirect_uri_mismatch`면 원인을 표시한다.
- **초기화:** 저장값을 삭제하고 환경변수로 돌아간다(확인창).
- **마이그레이션 1039:** `amb_acm_sys_google_app`(단일 행, 시스템 테넌트).
- **SETUP 문서:** 동의 화면을 외부·게시로 정정하고 화면 등록을 권장 방식으로 추가했다.

## 2. Verification (검증)
- 단위 테스트 8/8(형식 검증, 연결 확인 판정).
- 통합 테스트 `it-sys-google-app` 5/5:
  - 환경변수 대체
  - 저장 즉시 적용
  - Secret 암호화·비노출
  - 빈 칸 유지
  - 잘못된 입력 시 기존 값 보존
  - 초기화 시 환경변수 복귀
  - 감사 로그에 값 미기록
- `it-prj-drive` 19/19, frontend-acm `tsc`·build 통과.
- 실제 Google 값으로 [연결 확인]은 사용자가 값을 등록한 뒤 확인한다.
