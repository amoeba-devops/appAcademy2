---
document_id: ACM-PROJECT-DRIVE-SETUP-1.0.0
version: 1.0.0
status: Ready for configuration
change_log:
  - version: 1.0.0
    description: Shared-account OAuth and Picker deployment configuration.
---
# Google Drive Setup (Google Drive 운영 설정)

## 1. Configuration (운영 환경)
운영 담당자가 Google Cloud 프로젝트에서 Drive API 및 Google Picker API를 활성화하고 Web OAuth 클라이언트를 구성한다. 일반 ACM 사용자는 키/JSON/폴더 ID를 입력하지 않는다.

| 환경변수 | 내용 |
|---|---|
| ACM_GOOGLE_CLIENT_ID | OAuth Web Client ID |
| ACM_GOOGLE_CLIENT_SECRET | 서버 보관 OAuth secret |
| ACM_GOOGLE_REDIRECT_URI | `https://acm.amoeba.site/api/acm/prj/drive/callback` (staging은 acm-stg 도메인) |
| ACM_GOOGLE_PICKER_KEY | Google Picker용 API key; HTTP referrer를 해당 ACM origin으로 제한 |
| ACM_GOOGLE_PROJECT_NUMBER | 같은 Google Cloud 프로젝트의 숫자 project number |
| ACM_PII_KEY | 기존 AES-256-GCM 암호화 키, 연결 후 임의 변경 금지 |

OAuth 승인된 리디렉션 URI에 위 콜백을 정확히 등록한다. 승인된 JavaScript origin과 Picker 키 referrer 제한에 해당 ACM origin을 등록한다. 요청 scope는 openid/email/drive.file이다. 테스트용 OAuth 앱은 허용된 테스트 계정과 토큰 유효기간 제약을 확인하고 운영 공개/내부 배포 설정을 완료한다. Secret은 환경변수/운영 비밀 저장소에 보관하며 Git에 커밋하지 않는다. Compose에 변수 전달을 추가했다.

## 2. Activation (사용자 연결)
1. SQL `1032-project-drive.sql` 적용 후 애플리케이션 배포. 신규 6개 테이블이며 기존 업무 데이터 변경 없음.
2. CONFIG_ADMIN 사용자로 설정 → Google Drive 진입.
3. [Google 계정으로 연결]에서 학원 공용 계정 소유자가 인증·동의. 일회성 state+PKCE+HttpOnly SameSite=Lax 쿠키를 검증한다.
4. 기본 ACM Projects 폴더 또는 Picker에서 기존 폴더 선택. 서버에서 쓰기 권한 확인.
5. 테스트 프로젝트에서 Docs/Sheets 각각 생성, 파일 업로드, Google 열기, 기존 파일 선택, 연결 해제 후 원본 보존 확인.
6. 일반 참여자로 공용 계정 token/Picker 접근 거부, 프로젝트 외 폴더 조회 거부 확인.

내 드라이브와 공유 드라이브는 계정의 기존 권한 범위 내에서 사용한다. drive.file은 앱이 생성하거나 사용자가 Picker로 선택한 파일에 대한 권한이다. 기존 폴더 선택만으로 모든 하위 파일 접근 권한이 생긴다고 가정하지 않는다. 기존 파일은 관리자가 Picker에서 선택하여 연결할 수 있다. ACM 참여자를 Google 파일에 자동 공유하지 않는다.

## 3. Recovery (복구)
연결 만료는 [다시 연결]. 계정 변경은 기존 프로젝트의 account ID를 보존하며 기존 계정의 파일 작업은 차단한다. 저장 위치 변경은 이후 처음 생성하는 프로젝트 폴더에 적용한다. 연결 해제는 ACM 저장 인증을 제거하고 Google 원본과 파일 참조를 보존한다. Google 계정에서 앱 권한 자체를 철회하려면 Google 계정의 타사 연결 설정을 이용한다.

중복 방지: 요청 ID/내용 해시/결과를 DB에 기록한다. Google 응답이 불확실하면 90초 후 동일 요청으로 appProperties를 조회하여 기존 파일을 회수하며 무조건 다시 만들지 않는다. 결과를 찾지 못하면 관리자 확인 상태로 유지한다. 운영자는 해당 작업 ID와 Google 파일 존재를 확인하고 재처리 여부를 결정한다. 브라우저는 세션 동안 같은 입력의 요청 ID를 보존한다.

## 4. References (공식 근거)
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/web-picker
- https://developers.google.com/workspace/drive/api/guides/create-file
