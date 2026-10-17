---
document_id: ACM-CFG-INVITE-TM-PLN-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-18
related: REQ-261018-config-invite-tenant-master-settings
change_log:
  - version: 1.0.0
    date: 2026-10-18
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — 사용자 초대·테넌트 마스터 전용 설정

## 1. Screen Mockups (화면 구성안)

### 1.1 서비스 설정 `/admin/config` (서비스 운영자)
```
⚙ 서비스 설정
┌──────────────────────────┐ ┌──────────────────────────┐
│ 👤+ 사용자 초대        > │ │ 📊 광고 플랫폼         > │
│ 이메일로 관리자·직원·강사 │ │                          │
│ 를 초대합니다             │ │                          │
└──────────────────────────┘ └──────────────────────────┘
┌──────────────────────────┐ ┌──────────────────────────┐
│ ✉ 메일                 > │ │ 📁 Google Drive        > │
└──────────────────────────┘ └──────────────────────────┘
(AI 엔진·AMA·화상강의·카카오·GA4 카드 제거)
```

### 1.2 사용자 초대 `/admin/config/invites`
```
👤+ 사용자 초대                                  [+ 초대하기]
[대기] [수락] [만료·취소] [전체]
┌────────────────────────────────────────────────────────────┐
│ 홍길동  hong@tpi.co.kr  직원   대기 · 2026-10-21 까지        │
│ 초대한 사람 fremd · 10-18 14:02          [재발송] [취소]     │
├────────────────────────────────────────────────────────────┤
│ 김영희  kim@tpi.co.kr   강사   수락 · 10-18 15:10            │
└────────────────────────────────────────────────────────────┘

[초대하기] 대화상자
 이메일 [            ]  이름 [        ]
 역할   (●) 관리자 ( ) 직원 ( ) 강사
                                   [취소] [초대 메일 보내기]
 → 메일 미설정 시: "초대 링크 (이 창을 닫으면 다시 볼 수 없습니다) [복사]"
```

### 1.3 초대 수락 `/invite?token=…` (로그인 전 화면)
```
ACM 초대
Trinity Academy 에서 홍길동 님을 직원으로 초대했습니다.
 이메일  hong@tpi.co.kr (변경 불가)
 비밀번호      [        👁]   8자 이상, 영문·숫자
 비밀번호 확인 [        👁]
                                   [가입하고 시작하기]
 만료·사용된 링크: "초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 다시 요청하세요."
```

### 1.4 테넌트 설정 `/admin/tenant` (테넌트 마스터)
```
🏢 테넌트 설정
[메뉴 권한] [일반] [연동 설정]   ← 새 탭
┌─ AI 엔진 ─┐ ┌─ AMA 연동 ─┐ ┌─ 화상강의 ─┐ ┌─ 카카오 알림톡 ─┐ ┌─ GA4 방문자 ─┐
(카드 클릭 → 기존 설정 화면 /admin/config/ai 등, 테넌트 마스터만 열림)
```

## 2. Work Packages (작업 단위)

| WP | 내용 |
| --- | --- |
| WP1 DB | `sql/acm/1046-acm-user-invite.sql`: `amb_acm_user_invite`(inv_id, ent_id, inv_email, inv_name, inv_role CHECK ADMIN/STAFF/TEACHER, inv_token_hash, inv_status CHECK PENDING/ACCEPTED/REVOKED, inv_expires_at, invited_by, accepted_usr_id, created_at, updated_at), 대기 중 이메일 중복 방지 unique partial index |
| WP2 API 초대 | `ConfigAdminGuard`: `GET/POST /acm/admin/invites`, `POST /:id/resend`, `POST /:id/revoke`. 공개(속도 제한): `GET /acm/auth/invites/:token`(초대 정보), `POST /acm/auth/invites/:token/accept`(비밀번호 정책 검사 → 사용자 생성 → 로그인 토큰 반환). 토큰 32바이트 랜덤, sha256 저장 |
| WP3 메일 | 테넌트 메일(`TenantMailerService`) 2개 국어 초대 메일, 링크 `${ACM_PUBLIC_URL}/invite?token=` — 미설정 시 링크 1회 반환 |
| WP4 권한 이동 | AI·AMA·화상(video/boda config)·카카오·GA4 설정 컨트롤러 `ConfigAdminGuard` → `TenantMasterGuard`. 업무용 조회 API(화상 수업 실행 등)는 그대로. `config-guard-coverage.spec` 갱신 |
| WP5 화면 | 서비스 설정 카드 정리 + 사용자 초대 카드·페이지, 초대 수락 페이지, 테넌트 설정 "연동 설정" 탭, 5개 화면 라우트를 `RequireTenantMaster` 로 이동. 4개 언어 |
| WP6 테스트 | 통합 테스트: 초대→수락→로그인, 만료·재사용·취소, 중복 이메일, 권한(운영자는 5개 설정 403, 테넌트 마스터 200) |
| WP7 배포 | PR → CI → 스테이징 → 운영(최신 main sha) → 무자격 확인(401/404·번들) |

## 3. Impact (영향)

- 지금 서비스 운영자 2명(fremd, tpiyeri)은 5개 설정을 더 이상 볼 수 없다. 테넌트 마스터 admin@tpi.co.kr 만 관리.
- 화면 주소는 바뀌지 않는다(북마크 유지, 권한만 바뀜).
