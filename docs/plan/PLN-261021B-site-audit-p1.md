---
document_id: PLN-261021B
version: 1.1.0
status: APPROVED
change_log:
  - 2026-10-21 v1.1.0 — approved; lockout default 5 failures → 5 min (user)
  - 2026-10-21 v1.0.0 — P1 plan (access log · persistent lockout · real client IP · audit menu)
---

# PLN-261021B Site audit P1 — access log & lockout (사이트 감사 1단계 — 접속 로그·로그인 실패 잠금)

## 1. Requirement (요구사항)
[REQ-261021B](../analysis/REQ-261021B-site-audit.md) v1.1 (Q1~Q7 제안대로 확정) 중 **P1 기반**: G1(접속 기록 없음)·G2(실제 IP 모름)·G3(메모리 잠금)·G5(잠긴 계정 토큰 유효) 해소 + 감사 메뉴·권한·접속 로그 화면.

| 포함 (P1) | 제외 (후속) |
| --- | --- |
| 실제 접속 IP 해석(전역) | 활동 로그 기록·화면 (P2) |
| 접속 로그: 로그인 성공/실패·로그아웃·잠금/해제·비밀번호 변경·임시비번·SSO | 세션 만료·강제 로그아웃·현재 접속 중 (P3, 서버 세션 필요) |
| DB 기반 로그인 실패 잠금(콘솔·포털·SSO 공통, 계정+IP) | IP 제한·동시접속·유휴 시간 (P3) |
| 잠긴 계정 토큰 즉시 거부 | 2년 보관 배치·월 점검 기록·이상 징후 (P4) |
| 감사 메뉴 + 접속 로그 화면 + 접속 통제(잠금 설정·잠긴 계정) | 교차 테넌트 감사 화면 `/system` (P4) |
| AUDIT_VIEWER 권한 | |

## 2. Mockup (화면 구성안)

### 2.1 사이드바·탭
```
설정 그룹
  🛡 감사          ← TENANT_MASTER 또는 AUDIT_VIEWER 에게만 표시
  ⚙ 테넌트 설정
  ⚙ 서비스 설정
감사 화면 탭:  활동 로그 · [접속 로그] · 접속 통제
  - 활동 로그 탭: "활동 로그는 다음 단계에서 제공됩니다" 안내(Notice)만
```

### 2.2 접속 로그 `/admin/audit/access`
```
┌ 🛡 감사 ─────────────────────────────────────────────────────────────────┐
│ 활동 로그  [접속 로그]  접속 통제                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌오늘 로그인┐ ┌오늘 실패┐ ┌잠긴 계정┐ ┌실패 많은 IP(24h)┐                   │
│ │   42     │ │   3    │ │   1    │ │  58.x.x.x  7회  │                   │
│ └──────────┘ └────────┘ └────────┘ └─────────────────┘                   │
├ 필터 ────────────────────────────────────────────────────────────────────┤
│ 기간 [10-14]~[10-21]  구분 [전체|콘솔|포털]  계정 [이름·ID 검색]            │
│ 이벤트 [전체 ▾]  결과 [전체|성공|실패]  IP [          ]   [조회] [CSV]       │
├──────────────────────────────────────────────────────────────────────────┤
│ 1,032건                                                          1/21 ▸ │
│ 일시             계정                    이벤트        결과        IP     기기│
│ 10-21 14:00:03  배예리 (관리자)          로그인        성공        121.x  PC │
│ 10-21 13:55:10  ab***@gmail.com          로그인        실패·비밀번호 58.x  앱 │
│ 10-21 13:55:40  ab***@gmail.com          자동 잠금     5분        58.x  앱 │
│ 10-21 13:40:22  p1023 (학부모)           로그아웃      —           211.x 앱 │
└──────────────────────────────────────────────────────────────────────────┘
  행 클릭 → 상세: 로그인 방식(비밀번호/AMA SSO), UA 전문, 사유 코드
  모바일: 카드(일시·계정 / 이벤트·결과 / IP·기기)
```

### 2.3 접속 통제 `/admin/audit/control` (P1 범위)
```
┌ 로그인 실패 잠금 ─────────────────────────────────────────────────────────┐
│ 연속 실패 [5]회 → (•)[5]분 잠금  ( )관리자가 해제할 때까지                  │
│ 같은 IP 실패 [20]회 / [10]분 → 그 IP 로그인 [10]분 차단                     │
│ 적용: 운영 콘솔 · 포털 · AMA SSO 공통          마지막 변경 10-21 배예리 [저장]│
├ 잠긴 계정 ───────────────────────────────────────────────────────────────┤
│ 계정             구분   잠긴 이유        해제 예정     잠근 사람             │
│ 김OO (교사)      콘솔   실패 5회         14:32         자동       [해제]    │
│ p1023 (학부모)   포털   관리자 잠금      —             배예리     [해제]    │
├ IP 제한 · 동시접속 ──────────────────────────────────────────────────────┤
│ ⓘ 다음 단계(P3)에서 제공됩니다.                                           │
└──────────────────────────────────────────────────────────────────────────┘
  저장·해제 버튼은 테넌트 마스터에게만 활성(AUDIT_VIEWER 는 보기만)
```

### 2.4 로그인 화면 문구 (콘솔·포털)
- 잠금: "로그인에 5회 실패해 5분 동안 잠겼습니다. 14:07 이후 다시 시도하거나 관리자에게 문의하세요." (남은 시간 표시)
- IP 차단: "이 위치에서 로그인 실패가 많아 잠시 차단되었습니다. 10분 후 다시 시도하세요."
- 계정 존재 여부는 드러내지 않는다(없는 계정도 같은 횟수에서 같은 잠금 문구).

## 3. Design (설계)

### 3.1 Real client IP (실제 접속 IP)
- `acm-common/http/client-ip.ts` — 보다스쿨 `resolveWebhookSourceIp` 로직을 공통으로 옮겨 `clientIp(req)` 제공(XFF 뒤에서 N번째, IPv6 매핑 정규화). 보다 웹훅은 이 함수를 재사용(동작 동일).
- env `TRUSTED_PROXY_HOPS`(staging·production compose 기본 2, 로컬 0). 미설정 시 `BODA_WEBHOOK_TRUSTED_PROXY_HOPS` 값 사용.
- 적용: 기존 `@Ip()` 3곳(상담 연락처 열람·첨부 다운로드·비밀번호 찾기), **Throttler 추적 키**(`getTracker` 오버라이드 → 사용자별 실제 IP 기준으로 요청 제한).
- `@ClientIp()` 파라미터 데코레이터 추가.

### 3.2 DB migration `sql/acm/1049-audit-access-log.sql` (멱등)
```sql
amb_acm_aud_access_log (
  aal_id UUID PK, ent_id UUID NOT NULL,
  aal_actor_kind VARCHAR(10) CHECK IN ('CONSOLE','PORTAL'),
  aal_actor_id UUID NULL,                -- 계정 없으면 NULL
  aal_actor_name VARCHAR(100) NULL,      -- 스냅숏
  aal_actor_role VARCHAR(20) NULL,       -- ADMIN/TEACHER/STAFF/APP_ADMIN/STUDENT/PARENT/TEACHER
  aal_login_id VARCHAR(200) NULL,        -- 계정 없으면 마스킹 값
  aal_event VARCHAR(30) CHECK IN ('LOGIN','LOGOUT','LOCKED','UNLOCKED','IP_BLOCKED',
             'PASSWORD_CHANGED','TEMP_PASSWORD_ISSUED','SSO_EXCHANGE'),
  aal_result VARCHAR(10) CHECK IN ('SUCCESS','FAILURE'),
  aal_reason VARCHAR(40) NULL,           -- BAD_PASSWORD, NO_ACCOUNT, LOCKED, TEMP_LOCKED, INACTIVE,
                                         -- TEMP_PASSWORD_EXPIRED, SEED_PASSWORD, IP_BLOCKED, AUTO, ADMIN
  aal_method VARCHAR(10) NULL,           -- PASSWORD / SSO / OTP
  aal_ip VARCHAR(45), aal_client VARCHAR(10), aal_user_agent VARCHAR(500),
  aal_by_user_id UUID NULL,              -- 관리자 잠금/해제/임시비번 발급자
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)  -- BRIN(created_at), (ent_id, created_at DESC), (ent_id, aal_actor_kind, aal_actor_id, created_at DESC),
   -- (ent_id, aal_ip, created_at DESC); UPDATE/DELETE 차단 트리거
amb_acm_aud_login_failure (
  alf_id UUID PK, ent_id UUID NOT NULL,
  alf_key VARCHAR(250) NOT NULL,         -- 'C:<email 소문자>' / 'P:<tenant>:<loginId>' / 'IP:<ip>'
  alf_count INT, alf_first_at TIMESTAMPTZ, alf_last_at TIMESTAMPTZ, alf_locked_until TIMESTAMPTZ NULL,
  UNIQUE (alf_key)
)
amb_acm_aud_policy (
  ent_id UUID PK, apl_fail_max INT DEFAULT 5, apl_lock_minutes INT DEFAULT 5 (0 = 관리자 해제까지),
  apl_ip_fail_max INT DEFAULT 20, apl_ip_window_minutes INT DEFAULT 10, apl_ip_block_minutes INT DEFAULT 10,
  apl_settings JSONB DEFAULT '{}',      -- P3 IP·세션 정책 자리
  updated_by UUID, created_at, updated_at   -- set_acm_updated_at 트리거
)
amb_acm_user_permission CHECK 에 'AUDIT_VIEWER' 추가
```
- 콘솔 로그인은 이메일만 받으므로(테넌트 모름) **계정이 없는 실패는 시스템 테넌트(`…00ff`)** 로 기록 — 테넌트 화면에는 자기 계정 기록만 보인다. IP 차단 키는 테넌트 공통.

### 3.3 Backend module `acm-aud`
- `AccessLogService.record(event)` — 실패해도 로그인 흐름은 계속(로그·경고만). 로그인 판단(잠금)은 동기.
- `LoginGuardService` (메모리 Map 대체):
  - `assertAllowed(accountKey, ip, ent)` → 계정 시간 잠금 / IP 차단이면 429 `{code:'ACCOUNT_TEMP_LOCKED', retryAt}` / `{code:'IP_TEMP_BLOCKED', retryAt}`
  - `onFailure` → 원자적 UPSERT(`ON CONFLICT … DO UPDATE`), 창 경과 시 초기화, 한도 도달 시 `locked_until` 설정 + `LOCKED` 이벤트. 정책 `lock_minutes=0` 이면 계정 `usr_locked_at`/`pac_locked_at` 영구 잠금(관리자 해제).
  - `onSuccess` → 계정 키 삭제.
- 연결 지점:
  | 흐름 | 파일 | 기록 |
  | --- | --- | --- |
  | 콘솔 로그인 | `acm-auth.service.ts login()` | 성공·실패(사유별)·잠금 |
  | AMA SSO | `exchangeAmaToken()` | SSO_EXCHANGE 성공/실패, **잠긴 계정 거부 추가** |
  | 포털 로그인 | `portal-account.service.ts login()` | 성공·실패·잠금 (응답은 계속 동일 401/429) |
  | 학부모 OTP(구) | `parent-auth.service.ts verify` | 성공·실패 (메모리 시도 제한은 유지) |
  | 로그아웃 | **신규** `POST acm/auth/logout`, `POST portal/auth/logout` | LOGOUT (토큰은 P3 전까지 클라이언트 폐기) |
  | 관리자 잠금/해제 | `lockUser/unlockUser`, 포털 계정 잠금 | LOCKED/UNLOCKED (reason ADMIN, by) |
  | 비밀번호 변경·임시비번 | `changePassword`, `issueTempPassword`, 포털 reset | PASSWORD_CHANGED / TEMP_PASSWORD_ISSUED |
- JWT 검증: `acm-jwt.strategy` / `portal-jwt.strategy` 가 `locked_at IS NULL` 도 확인 → **관리자가 잠근 계정은 다음 요청부터 401**.
- API (`acm/audit/*`, `AcmJwtAuthGuard + AuditViewerGuard`, ent_id 고정):
  - `GET access-logs?from&to&kind&q&event&result&ip&page` (최대 범위 366일, 50/페이지)
  - `GET access-logs/summary` (오늘 로그인·실패·잠긴 계정·24h 실패 상위 IP)
  - `GET access-logs/export.csv` (최대 10만 행, 내보내기 자체를 `amb_acm_audit_log` EXPORT 로 기록)
  - `GET policy` / `PUT policy` (PUT 은 TenantMasterGuard, 변경 전후 값 audit_log UPDATE 기록)
  - `GET locked-accounts` / `POST locked-accounts/:kind/:id/unlock` (unlock 은 TenantMasterGuard)
- `GET acm/me/config-access` 에 `canViewAudit` 추가.
- AUDIT_VIEWER 부여: 기존 시스템 사용자 권한 화면(`PUT acm/system/users/:id/permissions`)에 항목 추가.

### 3.4 Frontend (`frontend-acm/src/modules/aud`)
- `app-shell.tsx` NAV: `audit`(ShieldCheck 아이콘, settings 그룹 첫 항목), `canViewAudit` 일 때만.
- 라우트: `/admin/audit` → `/admin/audit/access`, `/admin/audit/activity`(안내), `/admin/audit/control` — `RequireAuditViewer` 래퍼.
- 페이지: `audit-layout.tsx`(PageHeader + UnderlineTabs), `access-log-page.tsx`(StatCard·FilterBar·ResultBar·ResponsiveTable·상세 Dialog·CSV), `access-control-page.tsx`(Section 3개).
- 로그아웃: `onLogout` 에서 `POST /acm/auth/logout`(또는 portal) 호출 후 저장소 정리(실패해도 로그아웃 진행).
- 로그인 화면 3곳(콘솔·포털·학부모): `ACCOUNT_TEMP_LOCKED`·`IP_TEMP_BLOCKED` 문구 + 해제 시각.
- i18n: 새 네임스페이스 `aud` (ko/en/vi/zh-CN) + `common:nav.audit`, `auth` 잠금 문구.

### 3.5 Tests
- unit: `client-ip`(XFF 위조·홉 부족·IPv6), `LoginGuardService`(창·잠금·성공 초기화·관리자 해제까지 모드), 기록 마스킹.
- integration(PostgreSQL, CI 필수): 콘솔 5회 실패 → 6회째 429 + `LOCKED` 행, 재시작 가정(새 서비스 인스턴스)에도 유지; 포털 동일; 잠근 계정 토큰 401; 감사 API 권한(일반 ADMIN 403, AUDIT_VIEWER 200, AUDIT_VIEWER PUT 403); CSV 내보내기 audit_log 기록.
- 신규 빈 DB 마이그레이션 순서 검사(`scripts/acm-migration-order.sh`) 통과.

## 4. Steps (작업 순서)
1. 실제 IP 공통화 + Throttler 추적 키 + 테스트
2. 마이그레이션 1049 + 엔티티 + `acm-aud` 모듈(기록·잠금 서비스)
3. 로그인 흐름 5곳 연결 + 로그아웃 API + JWT 잠금 확인
4. 감사 API·권한(AUDIT_VIEWER) + config-access
5. 프론트 메뉴·라우트·화면 2개·로그인 문구·로그아웃 호출·i18n 4개
6. 통합 테스트 → PR → CI → 머지 → staging 확인(실제 IP 기록 확인) → 최신 sha 로 production 배포
7. 운영 확인(로그인 비밀번호 없이 확인 가능한 범위: 401/403/404, 번들, 배포 로그) + 사용자 화면 확인 요청 → RPT 작성

## 5. Impact & Risks (영향·위험)
| 항목 | 내용 | 대응 |
| --- | --- | --- |
| 요청 제한 기준 변경 | 지금까지 모든 사용자가 프록시 IP 한 묶음(60회/분 공유)이었다면 이제 사용자별 | 실질적으로 완화 방향. 배포 후 429 발생 모니터링 |
| 잠금 강화 | 60초 → 5분 (연속 5회) | 정책 화면에서 조정 가능, 임시비번 발급 시 자동 해제(현행 유지) |
| 잠긴 계정 즉시 차단 | 관리자가 잠근 계정은 진행 중인 세션도 다음 요청부터 401 | 의도된 동작 |
| 기록 실패 | DB 오류 시 접속 기록 누락 가능 | 로그인은 진행, 서버 로그 경고. P4 에서 누락 감시 |
| 개인정보 | 접속 로그에 이름·IP | 감사 권한자만 조회, 없는 계정 ID 는 마스킹 |
| 스테이징 홉 수 | staging 도 2홉 가정 | staging 배포 후 기록된 IP 가 실제 IP 인지 확인 후 운영 배포 |
