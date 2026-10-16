---
document_id: ACM-AUTH-PW-MYPAGE-FRESH-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-17
related: REQ-261017-auth-password-mypage-fresh-install
change_log:
  - version: 1.1.0
    date: 2026-10-17
    description: Q1 tenant admins, Q2 24h, Q3 keep manual reset, Q4 allow AMA accounts, Q5 one emergency contact; implement and deploy approved / 결정 반영
  - version: 1.0.0
    date: 2026-10-17
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Login, Password, My Page & Fresh Install Work Plan (작업 계획)

## 1. UI Mockups (화면 구성안)

### 1.1 로그인 + 비밀번호 찾기
```
┌──────── ACM 관리자 로그인 ────────┐        ┌ 비밀번호 찾기 ─────────────────────┐
│ 이메일    [admin@tpi.co.kr      ] │        │ 가입한 이메일을 입력하면 관리자에게 │
│ 비밀번호  [••••••••••      👁 ]   │ ─────▶ │ 재발급 요청이 전달됩니다.           │
│                 비밀번호를 잊으셨나요? │        │ 이메일 [                       ]   │
│ [            로그인            ]   │        │            [취소] [재발급 요청]     │
└───────────────────────────────────┘        │ ✓ 요청이 접수되었습니다. 관리자가   │
 👁 = 보기/숨기기 토글                          │   임시 비밀번호를 메일로 보냅니다.  │
                                              └────────────────────────────────────┘
```

### 1.2 관리자 — 비밀번호 재발급 요청 (테넌트 설정 › 비밀번호 재발급 요청)
```
상태 [대기 ▾]                                                    🔔 알림함에도 표시
┌──────────────┬───────────────────────┬────────────────┬──────┬────────────────────┐
│ 요청자        │ 이메일                 │ 요청 시각        │ 상태 │                    │
├──────────────┼───────────────────────┼────────────────┼──────┼────────────────────┤
│ tpijung      │ tpijung@tpiglobal…     │ 10/17 09:12     │ 대기 │ [임시 비밀번호 발급][거절]│
│ 홍길동 (AMA)  │ hong@…                 │ 10/16 18:40     │ 발급 │ 10/16 19:02 · ACM Admin │
└──────────────┴───────────────────────┴────────────────┴──────┴────────────────────┘
발급 결과: ✓ tpijung@… 로 임시 비밀번호를 보냈습니다(24시간 유효).
          ⚠ 메일 미설정 → 임시 비밀번호  Kx7mQ2pR9a  [복사]  (이 창을 닫으면 다시 볼 수 없음)
```
- 같은 [임시 비밀번호 발급] 버튼을 시스템 관리자 사용자 상세, 교사·직원 수정 창에도 둔다.

### 1.3 좌측 하단
```
│ ⚙ 시스템 관리 (APP_ADMIN)        │
│ 👤 홍길동  ·  마이페이지          │   ← 이름 + 텍스트 링크(/admin/me)
│ ⎋ 로그아웃                       │
```

### 1.4 마이페이지 `/admin/me`
```
내 정보
 이름 홍길동 · 아이디 hong@… · 역할 관리자 · 가입일 2026-06-10
 시간대 [Asia/Seoul ▾]                                  [저장]
비밀번호 변경
 현재 비밀번호 [        👁]  새 비밀번호 [        👁]  확인 [        👁]
 8자 이상, 영문·숫자 포함                                  [변경]
비상연락망
 이름 [      ]  관계 [      ]  연락처 [            ]
자기소개
 [                                              ] 0/1000
                                                         [저장]
```

## 2. Work Packages (작업 단위)
| WP | 내용 | 주요 파일 |
|----|------|-----------|
| WP0 브랜치 보호 | 저장소 관리자가 설정(작업 계정 권한 없음): `main` 에 CI 6개 체크 필수. 설정 명령·화면 경로 안내 | — |
| WP1 DB | `1044-auth-reset-request-profile.sql`: `amb_acm_password_reset_request`(요청·상태·처리자·IP 해시), `amb_acm_user` 에 `usr_temp_password_expires_at`, `usr_emergency_name`, `usr_emergency_relation`, `usr_emergency_phone_enc`(AES-GCM), `usr_bio`. 알림 종류 `PASSWORD_RESET_REQUEST` | `sql/acm/1044-*.sql` |
| WP2 BE 요청·발급 | `POST /acm/auth/password-reset-requests`(공개, 속도 제한, 항상 같은 응답) → 테넌트 관리자 알림. `GET/POST …/reset-requests/:id/issue|reject`(ADMIN·테넌트 마스터·APP_ADMIN). 공통 `issueTempPassword(userId)`: 생성·해시·변경 필수·만료·메일(실패 시 1회 반환). 로그인 시 만료 검사. 교사·직원·시스템 사용자 발급 엔드포인트 | `acm-auth`, `acm-system`, `acm-tch`, `acm-stf` |
| WP3 BE 마이페이지 | `GET/PUT /acm/me/profile` 확장(가입일·비상연락망·자기소개), 비밀번호 변경은 기존 `POST /acm/auth/change-password` 재사용 | `me-profile.controller.ts` |
| WP4 FE 로그인 | 보기 아이콘, 비밀번호 찾기 창, 잠김 문구 구분 | `login-page.tsx`, `auth.json` |
| WP5 FE 관리자 | 재발급 요청 목록(테넌트 설정), [임시 비밀번호 발급] 버튼·결과 창(시스템 사용자·교사·직원) | `cfg`, `system`, `tch`, `stf` 모듈 |
| WP6 FE 좌측·마이페이지 | 인증 저장소에 이름 저장(로그인·`me` 보정), 좌측 하단 이름+마이페이지, 마이페이지 섹션 3개 | `app-shell.tsx`, `auth.store.ts`, `my-profile-page.tsx` |
| WP7 새 환경 | `scripts/apply-acm-migrations.sh`(버전 순 + 의존 역순 3개 명시 배치, 마커 그대로), 배포 스크립트 2개·로컬 docker 초기화가 사용. CI 에 빈 DB 전체 적용 검사. `setup.ts` 를 같은 순서로. RUNBOOK-261017 새 환경 구축 | `scripts/*`, `docker-compose.yml`, `.github/workflows/ci.yml` |
| WP8 i18n·테스트·배포 | 4개 언어, 통합 테스트(요청 응답 동일·속도 제한·발급·만료·권한, 프로필 저장·암호화), PR → staging → production → RPT | |

## 3. Risks (위험)
- 메일 미설정 테넌트는 자동 발송 불가 → 관리자 1회 표시로 대체.
- 배포 스크립트 순서 변경은 기존 환경에 영향이 없어야 한다: 마커가 파일명+해시라 이미 적용된 파일은 건너뜀. 스테이징 배포 로그로 “[skip] 전체”를 확인 후 운영 배포.
- 로그인은 이메일로 전 테넌트에서 찾는다(기존). 재발급 요청도 같은 방식이며, 같은 이메일이 여러 테넌트에 있으면 각 테넌트 관리자에게 요청이 간다.

## 4. Estimate (예상)
WP1–3 1일, WP4–6 1일, WP7 0.5일, WP8 0.5일.
