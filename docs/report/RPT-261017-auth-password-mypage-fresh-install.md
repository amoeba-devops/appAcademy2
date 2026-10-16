---
document_id: ACM-AUTH-PW-MYPAGE-FRESH-RPT-1.0.0
version: 1.0.0
status: Deployed
created: 2026-10-17
change_log:
  - version: 1.0.0
    date: 2026-10-17
    description: Password toggle, forgot password via admin temp password, sidebar name + my page, my page profile/password, fresh-install migrations — deployed / 구현·배포 보고
---
# Login, Password, My Page & Fresh Install Report (로그인·비밀번호·마이페이지·새 환경 구축 구현 보고)

요구사항 [REQ-261017](../analysis/REQ-261017-auth-password-mypage-fresh-install.md) · 계획 [PLN-261017](../plan/PLN-261017-auth-password-mypage-fresh-install.md) · PR #344 (merge `dbdb1ac`)

## 1. Changes (구현)

### 1.1 로그인 화면
- 비밀번호 입력란 오른쪽 눈 아이콘으로 보기/숨기기(로그인·강제 변경·마이페이지 공용 `PasswordInput`).
- "비밀번호를 잊으셨나요?" → 이메일 입력 → 관리자에게 재발급 요청.
  - 계정이 있든 없든 같은 안내(계정 확인 악용 방지). 같은 계정 10분 쿨다운, IP 는 해시로만 저장, 5회/10분 속도 제한.
  - 테넌트 관리자(ADMIN·APP_ADMIN)의 알림함에 "비밀번호 재발급 요청이 접수되었습니다" → 클릭 시 요청 화면.
- 만료된 임시 비밀번호로 로그인하면 "임시 비밀번호가 만료되었습니다…" 안내.

### 1.2 관리자 — 임시 비밀번호
- 새 메뉴 **설정 › 비밀번호 요청**(`/admin/password-requests`, 관리자에게만 보임): 대기/발급됨/거절/전체, [임시 비밀번호 발급]·[거절].
- 교사·직원 수정 창, 시스템 사용자 상세에 [임시 비밀번호 발급] 추가(기존 직접 재설정은 유지).
- 임시 비밀번호: 10자, **24시간 유효**, 로그인하면 새 비밀번호로 바꿔야 대시보드로 이동. 발급 시 잠금 해제.
- 학원 메일이 설정돼 있으면 사용자에게 메일 발송(관리자 화면에는 비밀번호를 보여주지 않음). 미설정·실패 시 관리자 화면에 **한 번만** 표시 + 복사 버튼.
- 테넌트 관리자는 자기 테넌트 사용자만, APP_ADMIN 은 전 테넌트. AMA 계정도 발급 가능(이후 로컬 비밀번호로도 로그인).

### 1.3 사이드바·마이페이지
- 사이드바 하단: 이메일 대신 **이름** + 오른쪽 [마이페이지] 링크(아이콘 모드는 아이콘만).
- `/admin/me`: 가입일(학원 타임존), **비상연락망**(이름·관계·연락처 — 연락처는 AES-GCM 암호화 저장), **자기소개**(1000자, 글자 수 표시), **비밀번호 변경**(현재 비밀번호 확인). AMA 전용 계정은 비밀번호 변경 대신 안내.

### 1.4 새 환경 구축
- `scripts/acm-migration-order.sh`: 버전 순 + 더 큰 번호에 의존하는 3개(`999m`→1006 뒤, `999r`→1007 뒤, `999y`→1025 뒤) 명시 배치. 이전에는 빈 DB 에서 31개 파일이 실패했다.
- 배포 스크립트(staging/production), 로컬 docker 초기화, CI, 통합 테스트가 같은 순서를 사용. 기존 환경은 적용 마커가 그대로라 영향 없음.
- CI `Backend — Integration` 에 **빈 DB 전체 적용 검사** 단계 추가 — 순서 문제가 생기면 PR 에서 실패.
- 절차서 [RUNBOOK-261017](../deployment/RUNBOOK-261017-fresh-environment.md).

### 1.5 DB — `sql/acm/1044-auth-reset-request-profile.sql`
- `amb_acm_user`: `usr_temp_password_expires_at`, `usr_emergency_name/relation`, `usr_emergency_phone_encrypted/iv/auth_tag`, `usr_bio`.
- `amb_acm_password_reset_request`(REQUESTED/ISSUED/REJECTED, 계정당 대기 1건).
- 알림 종류 `PASSWORD_RESET_REQUEST`.

## 2. Verification (검증)

| 항목 | 결과 |
| --- | --- |
| Backend unit | 109 suites / 846 passed |
| Backend integration | 전 suite 통과(신규 `it-password-reset` 5/5, `it-user-timezone` 3/3 포함) |
| Frontend | tsc·vite build 통과 |
| 빈 DB 적용 | 로컬·CI 모두 136개 전체 적용 성공 |
| 로컬 브라우저(테스트 DB 사본) | 비밀번호 찾기 → 관리자 발급(1회 표시) → 임시 비밀번호 로그인 → 강제 변경 → 대시보드, 마이페이지 저장·새로고침 유지 |
| CI (PR #344) | 6/6 통과(빈 DB 검사 포함) |
| Staging | 기존 135개 `[skip]`, `1044` `[apply] OK`, 신규 API 401·없는 경로 404 |
| Production (`dbdb1ac`) | 기존 135개 `[skip]`, `1044` `[apply] OK`, 신규 API 401, 로그인 200, 번들에 신규 API 포함, DB 컬럼 7개·요청 테이블·알림 CHECK 확인(읽기 전용) |

## 3. Notes (운영 참고)
- 메일 미설정 학원은 임시 비밀번호가 관리자 화면에만 표시된다 — 사용자에게 직접 전달해야 한다(`/admin/config/mail` 설정 권장).
- `main` 브랜치 보호(필수 체크)는 저장소 관리자 권한이 필요하다. 필수로 지정할 체크: `Backend — Lint, Typecheck, Unit Test`, `Backend — Integration (PostgreSQL Testcontainers)`, `Frontend-acm — Lint, Typecheck, Build`.
- 프로덕션은 PR #344 머지 커밋 `dbdb1ac` 로 배포했다. 그 직후 머지된 #345(`8f859a0`)는 이번 배포에 포함되지 않았다.
