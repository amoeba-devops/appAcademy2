---
document_id: PLN-261024
version: 1.0.0
status: APPROVED
change_log:
  - 2026-10-24 v1.0.0 — plan for REQ-261024
---

# PLN-261024 AMA issue transfer + admin user management (이슈 이전 · 관리자 관리)

## 1. Requirement
[REQ-261024](../analysis/REQ-261024-issue-transfer-admin-user-mgmt.md)

## 2. Mockup (화면 구성안)

### 2.1 서비스 설정 카드
```
[사용자 초대] [광고매체 연동] [메일 설정] [Google Drive] [관리자 관리 ← 신규]
```

### 2.2 관리자 관리 `/admin/config/admins`
```
┌ ⚙ 관리자 관리 ──────────────────────────────────────────────────────────┐
│ 관리자·직원 계정의 정보·비밀번호·로그인 방식을 관리합니다.                  │
├ 필터 ───────────────────────────────────────────────────────────────────┤
│ 검색 [이름·이메일 ]  등급 [전체|관리자|직원]  로그인 [전체|AMA|로컬]        │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ 이름        이메일                        등급   로그인  권한      마지막 로그인│
│ ☐ tpiyeri    tpiyeri@tpiglobal.network     관리자  AMA   서비스운영자 10-24 02:09 │
│ ☐ tpimorgan  tpimorgan@tpiglobal.network   관리자  AMA              10-23 22:54 │
│ ☐ riskzang…  riskzang9699@gmail.com        관리자  AMA ⚠비번없음     07-28       │
│ ☐ fremd      fremd@korea.com               직원    AMA ⚠비번없음     09-12       │
│   admin      admin@tpi.co.kr               관리자  로컬  테넌트마스터 …          │
├──────────────────────────────────────────────────────────────────────────┤
│ 선택 6명  [로컬 로그인으로 전환]                                           │
└──────────────────────────────────────────────────────────────────────────┘
 행 클릭 → 상세 패널
```

### 2.3 상세 패널
```
┌ tpimorgan ──────────────────────────────────── [닫기] ┐
│ 기본 정보                                               │
│  이름 [tpimorgan        ]  이메일 [tpimorgan@…        ]  │
│  등급 (•)관리자 ( )직원   상태 (•)활성 ( )비활성          │
│                                              [저장]    │
│ 로그인                                                  │
│  방식: AMA (AMA 역할 MASTER)        [로컬로 전환]         │
│  잠금: 없음                          [잠금]              │
│ 비밀번호                                                │
│  [새 비밀번호 지정]  [임시 비밀번호 발급 (24시간·메일)]     │
│ 기록  가입 06-19 · 마지막 로그인 10-23 13:44 · [감사 이력] │
└────────────────────────────────────────────────────────┘
 로컬 전환 확인: "로컬로 바꾸면 이메일·비밀번호로 로그인합니다. 비밀번호가 없으면
                임시 비밀번호를 발급해 메일로 보냅니다. AMA 로 로그인해도 로컬로 유지됩니다."
```

## 3. Design (설계)

### 3.1 Part 1 — 이슈 이전
1. (허용 후) AMA 운영 DB(`amb-production`) **SELECT 만**으로 이슈·댓글·참여자·첨부 목록 추출 → 스크래치 JSON
2. `sql/acm/105x-prj-issue-import-ama-<id>.sql` — 1041 패턴(멱등 `pit_source_ref`, 이메일 매칭·대체, 같은 이름 프로젝트, 댓글·참여자, 첨부는 이름 목록)
3. 통합 테스트 빈 DB 적용 확인(테넌트 마스터 없으면 건너뜀) → PR·배포 → 운영 확인

### 3.2 Part 2 — Backend
- 마이그레이션: `amb_acm_user.usr_local_pinned BOOLEAN NOT NULL DEFAULT false` (Q-A1)
- `acm-auth.service` SSO 연결: `local_pinned` 이면 `auth_source` 를 바꾸지 않음(AMA 사용자 ID·역할 스냅숏만 갱신)
- `ConfigAdminGuard` 컨트롤러 `acm/config/admins`:
  - `GET /` 목록(ADMIN·STAFF, 필터), `GET /:id`
  - `PATCH /:id` 이름·이메일·등급·상태(FR-A7 검사)
  - `PATCH /:id/lock|unlock`, `PUT /:id/password`(정책 검사), `POST /:id/temp-password`(기존 `issueTempPassword` + 메일)
  - `POST /switch-local` `{ ids[] }` → `auth_source='local'`, `usr_local_pinned=true`; 비밀번호 없으면 임시 비밀번호 발급·메일, 결과(메일 발송/1회 표시 비밀번호)
- 권한 기준 변경(Q-A2): 상담 삭제·학생 삭제 = 관리자 등급 + (서비스 운영자 또는 테넌트 마스터)
- 감사: 활동 로그 자동, 접속 로그(비밀번호·잠금·임시비번) 기존 경로 재사용

### 3.3 Part 2 — Frontend
- `cfg/pages/admin-users-page.tsx` + 상세 패널, 서비스 설정 카드, 라우트(`RequireConfigAdmin`)
- 상담·학생 삭제 버튼 노출 조건을 새 권한 기준으로
- i18n 4개 언어

### 3.4 Tests
- integration: 목록 범위·권한(일반 관리자 403), 수정·자기 강등 금지, 비밀번호 지정·임시 발급(로그인 확인), 로컬 전환 → 비밀번호 로그인 성공 + SSO 후에도 로컬 유지, 상담·학생 삭제 새 권한 기준

## 4. Steps
1. (Q-I1 허용 시) AMA 이슈 추출 → import SQL
2. 관리자 관리 백엔드·화면·권한 기준 변경 + 테스트
3. PR → CI → 머지 → staging → production
4. 운영: 이슈 이전 확인(읽기 전용). 6명 전환은 관리자 관리 화면에서 실행(Q-A3)
