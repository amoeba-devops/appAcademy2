---
document_id: ACM-SYS-GOOGLE-OAUTH-PLN-1.0.0
version: 1.0.0
status: Pending review
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Implementation plan with UI mockups for REQ-261016B / 시스템 설정 Google OAuth 구현 계획
---
# System Google OAuth Settings Plan (시스템 설정 · Google OAuth 앱 설정 작업 계획)

요구사항: [REQ-261016B](../analysis/REQ-261016B-system-google-oauth-config.md)

## 1. UI Mockups (화면 구성안)
### 1.1 Sidebar (시스템 어드민)
```text
🛡 ACM [SYSTEM]
  사용자 관리
  테넌트 관리
  ▾ 시스템 설정
      Google OAuth 앱 설정   ← 신규
```

### 1.2 /system/settings/google-oauth
```text
Google OAuth 앱 설정                       적용 출처: [시스템 설정 ✓] / 서버 환경변수 / 미설정
모든 테넌트가 공유하는 Google 앱입니다. 각 테넌트는 /admin/config/drive 에서 회사 Workspace 계정으로 로그인합니다.

[가이드 ▾]
 ① 프로젝트 만들기       console.cloud.google.com → 새 프로젝트          [열기 ↗]
 ② API 사용 설정         Google Drive API, Google Picker API             [열기 ↗]
 ③ OAuth 동의 화면       외부 → 앱 이름·지원 이메일·승인된 도메인 amoeba.site
                         범위: openid, email, …/auth/drive.file          [복사]
                         게시 상태: "프로덕션으로 푸시" (테스트 상태면 7일마다 재연결)
 ④ OAuth 클라이언트 ID   유형: 웹 애플리케이션
                         승인된 JavaScript 원본  https://acm.amoeba.site                        [복사]
                         승인된 리디렉션 URI     https://acm.amoeba.site/api/acm/prj/drive/callback [복사]
 ⑤ API 키 (Picker)       애플리케이션 제한: HTTP 리퍼러  https://acm.amoeba.site/*   [복사]
                         API 제한: Google Picker API
 ⑥ 프로젝트 번호         대시보드 → 프로젝트 정보 → 프로젝트 번호(숫자)

[등록]
 Client ID       [xxxxxxxx.apps.googleusercontent.com          ]
 Client Secret   [••••••••  (저장됨 · 변경 시에만 입력)           ]
 Redirect URI    [https://acm.amoeba.site/api/acm/prj/drive/callback]
 Picker API Key  [AIza••••••••••••••XyZ                         ]
 Project Number  [123456789012                                  ]
 ⚠ Client를 바꾸면 기존 테넌트 Drive 연결이 끊길 수 있습니다(각 테넌트 재연결 필요).
 마지막 수정: 2026-10-16 10:30 · admin@amoeba.group
                         [연결 확인]  [초기화(환경변수 사용)]  [저장]
 연결 확인 결과: ✓ Google이 Client ID/Secret을 확인했습니다.
```

## 2. Implementation (구현)
| # | 항목 | 내용 |
|---|---|---|
| 1 | DB | `sql/acm/1039-sys-google-app.sql`: `amb_acm_sys_google_app`. 단일 행, `ent_id` = 시스템 테넌트. 컬럼: Client ID, Secret(AES-GCM: ciphertext/iv/tag), Redirect URI, Picker 키, 프로젝트 번호, 수정자·수정일 |
| 2 | 서비스 | `GoogleAppConfigService`: 모듈 시작 시와 60초 주기로 캐시를 갱신하고, 저장 즉시 반영한다. `DriveClient.setting()`은 저장값이 있으면 저장값, 없으면 환경변수를 쓴다(필드 단위가 아니라 행 단위로 출처 일관) |
| 3 | API (APP_ADMIN) | `GET /acm/system/google-oauth`: 마스킹된 값, 출처, 기본값(origin·redirect), 수정 이력<br>`PUT`: 저장. Secret 빈 칸은 유지<br>`DELETE`: 초기화<br>`POST /test`: 잘못된 code로 토큰 교환을 시도해 `invalid_grant`면 유효, `invalid_client`면 오류로 판정 |
| 4 | 감사 | `amb_acm_audit_log`에 변경 필드 이름만 기록(값·비밀 미기록) |
| 5 | 화면 | system-shell 그룹 메뉴, 가이드(접기)·복사 버튼, 등록 폼, 연결 확인, 4개 언어 i18n |
| 6 | 문서 | SETUP-261014 §4를 외부·게시로 정정하고 화면 등록 방식을 추가한다. env 방식은 대체 수단으로 남긴다 |

## 3. Verification (검증)
- 통합 테스트:
  - 저장 → `DriveClient.ready()`·`setting()` 즉시 반영
  - Secret 비노출·빈 칸 유지
  - 초기화 시 환경변수로 복귀
  - APP_ADMIN 외 403
  - 형식 검증 400
- 단위 테스트: 연결 확인 판정(`invalid_grant` / `invalid_client` / 네트워크 오류).
- 실제 Google 확인은 사용자가 값을 등록한 뒤 [연결 확인]과 테넌트 연결로 한다.

## 4. Review Gate (검토)
CLAUDE.md 9.2에 따라 REQ Q1–Q3 확인 후 구현한다.
