---
document_id: ACM-PROJECT-DRIVE-SETUP-1.1.0
version: 1.1.0
status: Ready for configuration
change_log:
  - version: 1.1.0
    description: REQ-261016 company Google Workspace only, named shared folder, storage choice, reconnect handling.
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

## 4. Company Workspace Setup (회사 Workspace 연동 · REQ-261016)
1. **Google Cloud 콘솔** (회사 Workspace 관리자 계정 권장)
   - 프로젝트를 만들고 **Google Drive API**와 **Google Picker API**를 사용 설정한다.
   - OAuth 동의 화면 사용자 유형은 **내부(Internal)**로 한다. 회사 도메인 사용자만 동의할 수 있고, 앱 검증·테스트 사용자 7일 토큰 만료 제약이 없다.
   - 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)를 만든다.
     - 승인된 JavaScript 원본: `https://acm.amoeba.site`
     - 승인된 리디렉션 URI: `https://acm.amoeba.site/api/acm/prj/drive/callback`
   - API 키를 만들고 HTTP 리퍼러를 `https://acm.amoeba.site/*`, API를 Picker API로 제한한다(Picker용).
2. **운영 서버** `docker/production/.env.production`(파일 예시는 `.env.production.example`)에 아래 5개 값을 입력한다.
   - `ACM_GOOGLE_CLIENT_ID`
   - `ACM_GOOGLE_CLIENT_SECRET`
   - `ACM_GOOGLE_REDIRECT_URI`
   - `ACM_GOOGLE_PICKER_KEY`
   - `ACM_GOOGLE_PROJECT_NUMBER`: 프로젝트 번호, 숫자

   입력 후 backend를 재생성한다. 이때 `DEPLOY_SHA`를 반드시 지정한다. 비밀값은 Git에 커밋하지 않는다.
3. **ACM 연결:** 서비스 운영자가 `/admin/config/drive` → [회사 Google 계정으로 로그인] → 공용폴더 이름 입력(비우면 `ACM - 학원명`) 또는 기존 폴더 선택 → [공용폴더 지정].
4. **동작**
   - 일반 Gmail(@gmail.com)은 연결이 거부된다(`hd` 클레임 없음).
   - 업로드 시 저장 위치로 회사 Google Drive(기본)와 ACM 저장소 중 하나를 고른다. 미연결이거나 재연결이 필요하면 ACM 저장소만 쓸 수 있다.
   - Google 인증이 만료되면 "재연결 필요"로 표시하며 ACM 로그아웃은 일어나지 않는다.
5. **공유:** 직원이 Google에서 파일을 열 수 있게 회사 계정 Drive에서 공용폴더를 직원 또는 그룹에 공유한다. ACM은 공유 설정을 바꾸지 않는다.

## 5. References (공식 근거)
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/web-picker
- https://developers.google.com/workspace/drive/api/guides/create-file
