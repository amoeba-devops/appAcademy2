---
document_id: ACM-DRIVE-COMPANY-PLN-1.0.0
version: 1.0.0
status: Pending review
created: 2026-10-16
change_log:
  - version: 1.0.0
    date: 2026-10-16
    description: Implementation plan with UI mockups for REQ-261016 / 회사 지메일 공용폴더 구현 계획
---
# Company Drive Folder Plan (회사 지메일 드라이브 공용폴더 작업 계획)

요구사항: [REQ-261016](../analysis/REQ-261016-drive-company-folder.md). 목업은 미결 사항(Q1–Q6)의 제안 기본값을 반영했다.

## 1. UI Mockups (화면 구성안)
### 1.1 /admin/config/drive — 미연결
```text
Google Drive 연동                                  [서비스 운영자 전용]
① 회사 Google 계정 연결  ② 공용폴더 지정  ③ 사용

┌ 회사 Google 계정 ─────────────────────────────────────────┐
│ 연결된 계정이 없습니다.                                    │
│ 회사 지메일로 로그인하면 이 학원의 업로드·작성 파일이       │
│ 해당 계정의 공용폴더에 저장됩니다.                         │
│                               [G 회사 Google 계정으로 로그인] │
└───────────────────────────────────────────────────────────┘
(운영 OAuth 미설정 시) ⚠ 운영 Google OAuth 설정이 필요합니다 — 관리자 문의
```

### 1.2 연결 직후 — 공용폴더 지정
```text
┌ 회사 Google 계정 ─────────────── academy@company.com ✓ 정상 ┐
│ 연결 2026-10-16 10:12 · 연결자 홍길동      [재연결] [연결 해제] │
└────────────────────────────────────────────────────────────┘
┌ 공용폴더 ──────────────────────────────────────────────────┐
│ ● 새 폴더 만들기   이름 [ACM - Trinity Academy      ]        │
│ ○ 기존 폴더 선택   [Google Drive에서 선택…]                  │
│                                              [공용폴더 지정] │
└────────────────────────────────────────────────────────────┘
```

### 1.3 설정 완료
```text
┌ 공용폴더 ─────────────────────────── ACM - Trinity Academy ┐
│ 저장 구조: 공용폴더 / 프로젝트별 하위폴더                     │
│ [Google에서 열기 ↗]  [변경]                                  │
│ ※ 변경은 이후 새로 만드는 프로젝트 폴더에 적용됩니다.          │
└──────────────────────────────────────────────────────────┘
(인증 만료 시) ⚠ Google 연결이 만료되었습니다. [다시 연결]
```

### 1.4 프로젝트 > 문서 > 파일 (미연결 상태, Q3)
```text
[업로드] (비활성)  ⓘ 회사 Google Drive가 연결되지 않아 업로드할 수 없습니다.
                    서비스 운영자에게 /admin/config/drive 연동을 요청하세요.
기존 파일 목록은 그대로 열람·다운로드 가능
```

## 2. Implementation (구현)
| # | 항목 | 내용 |
|---|---|---|
| 1 | 폴더 이름 지정 생성 | `PUT /acm/prj/drive/root`에 `name` 추가. 미지정 시 `ACM - {테넌트명}`. 같은 이름의 앱 생성 폴더가 있으면 재사용(멱등) |
| 2 | 연결 정보 | `amb_acm_prj_drive`에 `connected_at`·`connected_by` 표시와 `last_error`·`needs_reconnect` 추가(마이그레이션 1038) |
| 3 | 장애 처리 | Google 토큰 갱신 실패를 401 대신 409 `DRIVE_RECONNECT_REQUIRED`로 바꾸고 `needs_reconnect=true`로 기록. ACM 로그아웃을 방지한다 |
| 4 | 토큰 캐시 | access token을 만료 1분 전까지 메모리에 캐시해 호출마다 반복되는 갱신을 없앤다 |
| 5 | 저장 위치 강제 (Q3) | 공용폴더가 없으면 프로젝트 업로드를 409 `DRIVE_NOT_READY`로 거부한다. ObjectStore 대체 저장을 중단하되 기존 파일 다운로드는 유지한다 |
| 6 | 저장 구조 (Q1) | 공용폴더 / 프로젝트별 하위폴더(기존 로직 유지). 드라이브 메뉴 업로드·작성은 해당 폴더 |
| 7 | 설정 화면 | 1.1–1.3 단계형 UI, 4개 언어 i18n, 운영 미설정·인증 만료 안내 |
| 8 | 운영 문서 | SETUP 문서에 Workspace(Internal) / 일반 Gmail(External 게시) 절차와 `.env.production` 항목 추가. `.env.production.example`에 키 이름 추가(값 없음) |

## 3. Rollout (진행 순서)
1. 사용자 확인 후 코드 PR → 스테이징 배포. 스테이징용 OAuth 클라이언트가 있으면 스테이징에서 먼저 연결 테스트.
2. 사용자가 Google Cloud OAuth 클라이언트를 만들고 운영 서버 `.env.production`에 값을 입력한다(REQ §4).
3. 운영 배포 후 서비스 운영자가 `/admin/config/drive`에서 회사 계정으로 로그인 → 공용폴더를 만든다.
4. 테스트 프로젝트에서 업로드, Google 문서·시트 생성 후 Drive 공용폴더 안에 생성되는지 확인한다.

## 4. Verification (검증)
- 통합 테스트:
  - 폴더 이름 지정과 재사용
  - 미연결 업로드 409
  - 토큰 갱신 실패 시 409 + `needs_reconnect`, 재연결 시 해제
  - 비운영자 연결·설정 403
  - 타 테넌트 격리
- 단위 테스트: 토큰 캐시 만료 처리.
- 실제 Google 연동은 OAuth 클라이언트 설정 후 스테이징·운영에서 수동으로 확인한다.

## 5. Review Gate (검토)
CLAUDE.md 9.2에 따라 REQ의 Q1–Q6 확인 후 구현한다.
