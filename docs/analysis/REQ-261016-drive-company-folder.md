---
document_id: ACM-DRIVE-COMPANY-REQ-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Q1–Q6 decisions recorded (Workspace only, Drive/ACM storage choice) / 미결 사항 확정
  - version: 1.0.0
    date: 2026-10-16
    description: Company Gmail OAuth connection and tenant shared folder for all files / 회사 지메일 연동·테넌트 공용폴더 단일 저장
---
# Company Drive Folder Requirements (회사 지메일 드라이브 공용폴더 요구사항)

## 1. Request (요청)
1. `/admin/config/drive`에서 회사 지메일 계정으로 Google Drive를 연동한다. 별도 키를 입력하지 않고 Google 로그인 인증으로 세팅한다.
2. 연동한 계정에 공용폴더를 만든다.
3. 해당 테넌트에서 **업로드한 파일**과 **작성한 파일**은 설정에서 정한 회사 지메일 공용폴더에 저장한다.

## 2. Current State (현재 구현 · origin/main 514c127)
| 항목 | 현재 | 근거 |
|---|---|---|
| Google 로그인 연동 | 구현됨. 서비스 운영자(CONFIG_ADMIN)가 [Google 계정으로 연결]을 누르면 OAuth 동의 후 refresh token을 암호화해 저장한다. 테넌트당 계정 1개. scope는 `openid email drive.file` | `acm-prj/application/drive.service.ts`, `amb_acm_prj_drive` |
| 운영 활성화 | **미완료.** 운영 서버에 `ACM_GOOGLE_*` 환경변수(OAuth 클라이언트)가 없다. 화면은 "운영 Google OAuth 앱 설정이 필요합니다"를 표시하고 연결 버튼이 비활성이다 | `drive.client.ts ready()`, SETUP-261014 |
| 저장 폴더 | 이름이 고정된 "ACM Projects" 자동 생성, 또는 기존 폴더 선택. 프로젝트마다 하위 폴더 `"<프로젝트명> (<id8>)"`를 만든다 | `drive.service.ts root()/folder()` |
| 업로드 | Drive가 준비되면 프로젝트 하위 폴더에 저장한다. 미연결이면 **ACM 저장소(ObjectStore)로 대체 저장**한다 | `project-file.service.ts` |
| 작성 | "Google에서 새로 만들기"(Docs/Sheets)는 Drive 프로젝트 폴더에 저장한다. ACM 내부 작성(메모·시트·문서 편집기)은 **DB에 저장**한다 | `project.service.ts saveDocument` |
| 별도 공유폴더 | 드라이브 메뉴의 "폴더 연결"은 기존 Drive 폴더를 따로 연결하는 별도 개념이다 | `shared-drive.service.ts` |
| 장애 시 동작 | Google 토큰 갱신이 실패하면 401을 반환한다. 프론트가 이를 세션 만료로 보고 **ACM에서 로그아웃**시킨다 | `drive.client.ts`, `api-client.ts` |

## 3. Requirements (상세 요구사항)
- **FR-1 연동:** `/admin/config/drive`에서 서비스 운영자가 [회사 Google 계정으로 로그인]하면 연동된다. 연결된 이메일, 연결 일시, 상태(정상/재연결 필요)를 표시한다. 연결 해제 시 Google 원본은 보존한다.
- **FR-2 공용폴더 만들기:** 연동 직후 공용폴더 이름(기본값 `ACM - {테넌트명}`)을 입력해 회사 계정 내 드라이브에 생성하거나, 기존 폴더를 선택한다. 설정에서 폴더 이름과 Google에서 열기 링크를 보여준다.
- **FR-3 저장 위치 일원화:** 테넌트의 아래 파일을 모두 공용폴더(하위 구조는 Q1)에 저장한다.
  - 프로젝트 파일 업로드
  - Google Docs/Sheets 새로 만들기
  - 드라이브 메뉴에서의 업로드·작성
- **FR-4 저장소 선택:** Drive 연결 전에는 ACM 저장소에 저장한다. 연결 후에는 업로드할 때 Google Drive(공용폴더)와 ACM 저장소 중에서 고른다(기본 Google Drive).
- **FR-5 장애 처리:** Google 인증 만료나 권한 철회 시 ACM 로그아웃 없이 "재연결 필요" 안내를 표시하고, 서비스 운영자에게 재연결을 유도한다.
- **FR-6 권한:** 연동·폴더 설정·해제는 서비스 운영자만 한다. 일반 사용자는 프로젝트·폴더 권한 범위에서만 파일을 조회·업로드한다. ACM은 Google 공유 권한을 자동으로 변경하지 않는다.

## 4. Prerequisites (사용자 준비 사항 — 코드로 대신할 수 없음)
1. Google Cloud 프로젝트에서 Drive API와 Picker API를 활성화하고 OAuth 웹 클라이언트를 만든다.
   - 리디렉션 URI: `https://acm.amoeba.site/api/acm/prj/drive/callback` (스테이징: `https://acm-stg.amoeba.site/...`)
2. OAuth 동의 화면을 설정한다.
   - Google Workspace 회사 계정: **내부(Internal)**
   - 일반 Gmail: **외부(External)로 게시(Publish)**. '테스트' 상태면 refresh token이 7일 후 만료되어 매주 재연결해야 한다.
3. 운영 서버 `docker/production/.env.production`에 아래 값을 넣고 backend를 재생성한다(`DEPLOY_SHA` 필수).
   - `ACM_GOOGLE_CLIENT_ID`
   - `ACM_GOOGLE_CLIENT_SECRET`
   - `ACM_GOOGLE_REDIRECT_URI`
   - `ACM_GOOGLE_PICKER_KEY`
   - `ACM_GOOGLE_PROJECT_NUMBER`

   비밀값이므로 사용자가 직접 입력한다.

## 5. Constraints (제약)
- `drive.file` 권한은 ACM이 만들었거나 사용자가 Picker로 선택한 파일만 다룬다. 회사 계정 Drive 웹에서 공용폴더에 직접 넣은 파일은 ACM 목록에 나오지 않는다. 전체 Drive 권한(`drive`)은 Google 보안 심사(CASA) 대상이라 권장하지 않는다.
- ACM 사용자가 Google에서 파일을 열려면 해당 파일·폴더에 대한 Google 접근 권한이 필요하다. 회사 계정 소유이므로 직원에게는 Google에서 폴더를 공유해야 한다.

## 6. Open Questions (확인 필요)
| Q | 내용 | 제안 기본값 |
|---|---|---|
| Q1 | 공용폴더 내부 구조 | 공용폴더 안에 프로젝트별 하위폴더(현재 방식 유지). 단일 폴더에 모두 두면 파일이 섞이고 이름이 충돌한다 |
| Q2 | 회사 계정 유형 | Google Workspace(회사 도메인)인지 일반 @gmail.com인지 확인 필요 |
| Q3 | 미연결 시 업로드 | 연결 전에는 업로드를 막고 "서비스 운영자에게 연동 요청" 안내. 기존 ObjectStore 대체 저장 중단(기존 파일은 그대로 열람) |
| Q4 | ACM 편집기로 작성한 메모·시트·문서 | DB 저장 유지. 공동 편집·버전 충돌 방지 기능이 DB 기반이라서다. "Google에서 새로 만들기"로 만든 문서만 Drive에 저장 |
| Q5 | 기존 파일 이관 | 이미 ObjectStore에 저장된 프로젝트 파일은 이관하지 않고 그대로 둔다(필요 시 별도 작업) |
| Q6 | 다른 모듈 첨부 | 상담·일정·자료실 첨부는 이번 범위에서 제외(프로젝트·문서·드라이브만) |

## 7. Decisions (확정 · 2026-10-16)
| Q | 결정 |
|---|---|
| Q1 | 공용폴더 안에 프로젝트별 하위폴더 |
| Q2 | **Google Workspace 계정만 허용**. 일반 @gmail.com은 연결 거부(OAuth `hd` 클레임 확인, 계정 선택 시 `hd=*` 힌트) |
| Q3 | Drive와 ACM 저장소 모두 지원. 연결 전에는 ACM 저장소, 연결 후에는 업로드 시 선택(기본 Drive) |
| Q4 | ACM 편집기 문서는 DB 저장 유지. "Google에서 새로 만들기" 문서만 Drive |
| Q5 | 기존 파일 이관하지 않음 |
| Q6 | 상담·일정·자료실 첨부는 제외 |
