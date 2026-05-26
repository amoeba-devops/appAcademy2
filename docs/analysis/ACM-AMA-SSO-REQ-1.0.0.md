---
document_id: ACM-AMA-SSO-REQ-1.0.0
version: 1.0.1
status: Draft
created: 2026-05-05
updated: 2026-05-05
author: 김익용 (Gray)
related:
  - docs/integration/ama-platform-spec-asks.md
  - docs/amoeba-starter-kit/amoeba_basic_SPEC_v2.md
  - backend/src/modules/acm-auth/**
  - frontend-acm/src/modules/auth/pages/login-page.tsx
  - docker/staging/nginx-acm.conf
change_log:
  - version: 1.0.1
    date: 2026-05-05
    author: 김익용
    description: |
      Add G-6 + FR-AMA-60~64 — explicit non-breaking guarantee for the
      existing email/password login flow. Q-3 resolved → (a) keep break-glass
      form. AMA SSO is an additive entry path; legacy auth must continue to
      work unchanged for ACM operator accounts (e.g. admin@tpi.co.kr).
  - version: 1.0.0
    date: 2026-05-05
    author: 김익용
    description: |
      Initial requirements analysis for AMA Custom App SSO on ACM site.
      Implements automatic login from `?ama_token=` query parameter and
      iframe embedding from ama.amoeba.site, replacing partial email/password
      flow with AMA-first authentication.
---

# ACM × AMA Custom App SSO — Requirements Analysis (요구사항 분석서)

## 1. Background (배경)

### 1.1 Source Trigger (촉발 사례)

AMA(아메바) 포털에서 ACM 사이트를 호출 시 다음 형태의 URL을 사용함:

```
https://acm-stg.amoeba.site/login
  ?ama_token=<JWT>
  &locale=en
```

**JWT payload 실측** (HS256):
```json
{
  "sub": "c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570",  // AMA user UUID
  "email": "fremd@naver.com",
  "role": "MASTER",
  "entityId": "928f5fe4-12ab-4113-b9b9-d8d455ca4e3b",
  "appId": "15b69898-7828-4072-9892-a2f7bea1eb57",
  "appCode": "tpi-acm",
  "scope": "custom_app:context",
  "iat": 1777981435,
  "exp": 1777985035   // 만료 1시간
}
```

### 1.2 Why now (착수 배경)

- **AMA 운영자가 이미 호출 중**: 현재는 `/login` 페이지가 `ama_token`을 무시 → 수동 로그인 필요 → 사용자 경험 깨짐.
- **iframe 차단**: 현재 nginx 응답에 X-Frame-Options 미설정 → 브라우저 기본 정책에 따라 iframe 임베드 실패 가능.
- **본 사이트는 AMA 커스텀앱 정체성 확정**: appCode `tpi-acm` 으로 등재된 상태이므로 AMA SSO만이 정상 진입 경로 (자체 로그인은 break-glass용 보조).
- **`docs/integration/ama-platform-spec-asks.md` Spec Ask A-2 Resolved (2026-05-25)**: AMA는 OIDC 미지원 확정. short-lived HS256 JWT injection 방식이 **정식 인증 경로**로 채택됨. 별도 OIDC mock 코드·환경변수(`AMA_OIDC_*`)는 [REQ-260525-app-academy-ama-jwt-단일화](./REQ-260525-app-academy-ama-jwt-단일화.md) 로 일괄 제거됨.

### 1.3 Goals & Non-goals (목표 / 비목표)

**Goals**
- G-1: `ama_token` 쿼리 수신 → 검증 → 사용자 자동 생성·로그인 → 기본 라우트 진입까지 **사용자 액션 0회**.
- G-2: `ama.amoeba.site` (및 staging 카운터파트)에서 ACM을 **iframe으로 임베드** 가능.
- G-3: AMA `entityId` ↔ ACM `entId` 매핑으로 멀티테넌시 격리 유지.
- G-4: 토큰 만료/위조/리플레이 공격 방어 (HMAC 서명 검증, exp/iat clock skew, audience).
- G-5: `locale=en` 등 쿼리로 i18n 즉시 적용.
- **G-6: 기존 이메일/비밀번호 로그인은 100% 호환 유지** — AMA SSO 추가는 비파괴(non-breaking)이며, 신규 진입 경로 추가일 뿐 기존 인증 경로(`POST /api/acm/auth/login`, `/login` 폼)의 동작·UX를 변경하지 않는다.

**Non-goals (이번 범위 제외)**
- N-1: AMA OIDC discovery / authorization code flow (다른 명세이며 미지원으로 가정)
- N-2: AMA로의 SLO(Single Logout) 신호 — Phase 2 (Spec Ask B-3)
- N-3: 자체 회원가입/비밀번호 복구 화면 정비 — break-glass 계정만 유지
- N-4: AMA 사용자 → ACM RBAC 세분화 (현재 role=MASTER 하나만 처리, 후속 매핑 필요 시 별도 REQ)
- N-5: AMA → ACM 외 deep link (학생 ID 등 추가 컨텍스트 전달)는 후속

---

## 2. Stakeholders & Users

| Role | 의미 | 진입 경로 |
|---|---|---|
| **AMA 운영자(Master)** | AMA 포털 로그인 후 "학원관리앱" 진입 | iframe 또는 신규 탭 (`?ama_token=...`) |
| **ACM 직접 운영자** | break-glass — DBMS 접근권자 | `/login` 직접 (email/password) |
| **시스템 — AMA 플랫폼** | JWT 발급자 | HS256 공유 시크릿 보유 |

---

## 3. Scope (범위)

### 3.1 In Scope
- Backend: AMA 토큰 교환 엔드포인트 (`POST /api/acm/auth/ama-exchange`)
- Backend: AMA 사용자 자동 프로비저닝 (acm_user upsert)
- Backend: AMA 토큰 검증 라이브러리 (HS256, exp, scope, appCode whitelist)
- Frontend: `/login` 진입 시 `ama_token` 자동 교환 → store 저장 → redirect
- Frontend: `locale` 쿼리 파라미터 처리
- Infra: nginx CSP `frame-ancestors` (ama 화이트리스트), `X-Frame-Options` 제거, `Set-Cookie SameSite=None` 정책 (필요 시 토큰만 사용 시 불필요)
- Env/Secret: `AMA_JWT_SECRET`, `AMA_JWT_ALLOWED_APP_CODES`, `AMA_JWT_AUDIENCE`(옵션), `AMA_FRAME_ANCESTORS`

### 3.2 Out of Scope
N-1 ~ N-5 (§1.3)

---

## 4. Functional Requirements (기능 요구사항)

표기: **FR-AMA-xx**, 우선순위 P0/P1/P2.

### 4.1 토큰 수신·교환

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-01 | `/login?ama_token=...` 진입 시 자동 교환 시도 | P0 | LoginPage 마운트 시 useEffect로 호출 |
| FR-AMA-02 | 백엔드 교환 API: `POST /api/acm/auth/ama-exchange` body `{ amaToken }` | P0 | 검증 통과 시 ACM JWT 발급 (`accessToken`, `user`) |
| FR-AMA-03 | locale 쿼리 적용 | P0 | `?locale=en` 시 i18next.changeLanguage('en') + persist (`acm.lang`) |
| FR-AMA-04 | 교환 성공 시 redirect | P0 | `returnTo` 쿼리 우선, 없으면 `/dashboard` |
| FR-AMA-05 | 교환 실패 시 사용자 안내 | P0 | 401/403 → "AMA 인증이 만료되었습니다 (다시 시도)" + `[ AMA 포털로 돌아가기 ]` 링크 (`document.referrer` 또는 ENV `AMA_RETURN_URL`) |

### 4.2 토큰 검증 (Backend)

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-10 | HS256 서명 검증 | P0 | 비검증 시 401 `AMA_TOKEN_INVALID_SIGNATURE` |
| FR-AMA-11 | exp / iat 시간 검증 (±60s clock skew) | P0 | 만료 시 401 `AMA_TOKEN_EXPIRED` |
| FR-AMA-12 | scope == `custom_app:context` | P0 | 불일치 시 403 `AMA_TOKEN_SCOPE_INVALID` |
| FR-AMA-13 | appCode 화이트리스트 (`AMA_JWT_ALLOWED_APP_CODES`, 기본 `tpi-acm`) | P0 | 불일치 시 403 `AMA_TOKEN_APP_CODE_INVALID` |
| FR-AMA-14 | required claims 존재(`sub`, `email`, `entityId`, `appCode`, `scope`) | P0 | 누락 시 400 `AMA_TOKEN_CLAIMS_MISSING` |
| FR-AMA-15 | 리플레이 방지 (jti 캐시 또는 짧은 윈도우) | P1 | 동일 토큰 재사용 시 동일 결과 — 1시간 만료가 1차 방어선, jti 캐시는 P1 |

### 4.3 사용자 프로비저닝

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-20 | acm_user upsert by `(ama_user_id, ama_entity_id)` | P0 | 신규는 INSERT, 기존은 last_login_at만 갱신 |
| FR-AMA-21 | acm_user에 AMA 식별자 컬럼 추가 (`ama_user_id`, `ama_entity_id`, `ama_role`) | P0 | 마이그레이션 SQL 1건 |
| FR-AMA-22 | 패스워드는 NULL/임의값 허용 (AMA 사용자는 자체 로그인 불가) | P0 | `passwordHash NULL` 허용 + status=ACTIVE |
| FR-AMA-23 | `entId` 매핑 = `entityId` 그대로 사용 | P0 | 멀티테넌시 격리 키로 사용 |
| FR-AMA-24 | 이메일 변경 감지 시 동기화 | P1 | 동일 ama_user_id, 다른 email → email UPDATE |

### 4.4 ACM JWT 발급

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-30 | 기존 acm-auth JWT 형식 그대로 발급 (`sub`, `entId`, `email`, `name`) | P0 | 기존 가드 `AcmJwtAuthGuard` 변경 없음 |
| FR-AMA-31 | 추가 claim: `auth_source: 'ama'` | P0 | 향후 권한 분기·감사용 |
| FR-AMA-32 | TTL: AMA 토큰 잔여 시간 또는 최대 8시간 중 짧은 값 | P0 | 운영 일관성 |

### 4.5 iframe 임베드

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-40 | `Content-Security-Policy: frame-ancestors https://ama.amoeba.site https://ama-stg.amoeba.site 'self'` | P0 | 화이트리스트 외 사이트 임베드 차단 |
| FR-AMA-41 | `X-Frame-Options` 헤더 제거 (CSP frame-ancestors 우선) | P0 | 구 헤더 제거 — 모던 브라우저는 CSP 우선이나 충돌 방지 |
| FR-AMA-42 | API 응답도 `frame-ancestors` 동일 (선택) | P1 | API는 직접 임베드되지 않으므로 영향 없음 — 우선 SPA 응답에만 |
| FR-AMA-43 | 쿠키 미사용(토큰은 localStorage) | P0 | iframe 환경에서도 동작 — 현재 `acm-auth` Zustand persist가 localStorage 사용 |

### 4.6 보안 / 감사

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-50 | AMA 교환 시도 로그 (success/fail, sub/email, ip, ua) | P0 | `acm-auth.log` 또는 표준 로거 — PII는 email만 |
| FR-AMA-51 | rate limit (IP 기준 분당 30회) | P1 | 기존 acm-auth rate limit 패턴 재사용 |
| FR-AMA-52 | URL의 ama_token은 즉시 제거 (history.replaceState) | P0 | 브라우저 히스토리/리퍼러 누수 방지 |

### 4.7 기존 이메일/비밀번호 로그인 호환성 (Backward Compatibility)

| ID | 기능 | 우선순위 | 인수 기준 |
|---|---|---|---|
| FR-AMA-60 | `POST /api/acm/auth/login` 엔드포인트 무변경 | P0 | 요청·응답 스키마, 에러 코드, rate limit 동일. 기존 통합/E2E 테스트 100% 통과 |
| FR-AMA-61 | `/login` 화면 이메일/비밀번호 폼 노출 유지 | P0 | `ama_token` 쿼리 없을 때 폼이 즉시 보여야 함. AMA 분기 코드가 폼 렌더링을 가리지 않음 |
| FR-AMA-62 | 기존 ACM 운영자 계정(예: `admin@tpi.co.kr`) 로그인 가능 | P0 | bcrypt 검증 + `auth_source IS NULL or 'local'` 사용자 모두 통과 |
| FR-AMA-63 | AMA 자동 프로비저닝 사용자도 동일 이메일로 자체 로그인 시도 시 거부(또는 별도 처리) | P1 | `auth_source='ama'` 사용자는 `password_hash IS NULL` → bcrypt 실패로 자연 거부. 별도 에러 메시지 불필요 |
| FR-AMA-64 | 기존 ACM JWT(`ACM_JWT_SECRET`로 서명된 토큰)와 AMA 교환 후 발급된 ACM JWT는 **구분 없이** 동일하게 동작 | P0 | `/api/acm/auth/me`, 기존 가드(`AcmJwtAuthGuard`) 모두 동작. payload `{sub, entId, email, name}` 동일 |

---

## 5. API Spec

### 5.1 신규 엔드포인트

```
POST /api/acm/auth/ama-exchange
Content-Type: application/json
Body: { "amaToken": "<JWT>" }

200 OK
{
  "success": true,
  "data": {
    "accessToken": "<ACM JWT>",
    "user": { "id", "entId", "email", "name", "authSource": "ama" }
  }
}

4xx Errors:
  400 AMA_TOKEN_CLAIMS_MISSING
  401 AMA_TOKEN_INVALID_SIGNATURE | AMA_TOKEN_EXPIRED
  403 AMA_TOKEN_SCOPE_INVALID | AMA_TOKEN_APP_CODE_INVALID
  500 AMA_USER_PROVISION_FAILED
```

응답 envelope는 기존 `TransformInterceptor` 그대로.

### 5.2 변경 없음
- `POST /api/acm/auth/login` (email/password) — 그대로 유지 (break-glass)
- `GET /api/acm/auth/me` — 그대로

---

## 6. Data Model (데이터 모델)

### 6.1 마이그레이션 SQL

```sql
-- sql/acm/510-acm-ama-sso.sql (Postgres, idempotent)
ALTER TABLE amb_acm_user
  ADD COLUMN IF NOT EXISTS ama_user_id   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS ama_entity_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS ama_role      VARCHAR(32),
  ADD COLUMN IF NOT EXISTS auth_source   VARCHAR(16) NOT NULL DEFAULT 'local',
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_amb_acm_user_ama
  ON amb_acm_user (ama_user_id) WHERE ama_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_amb_acm_user_entity
  ON amb_acm_user (ama_entity_id) WHERE ama_entity_id IS NOT NULL;
```

### 6.2 운영 데이터 정책
- `auth_source='ama'` 사용자는 `/api/acm/auth/login` 사용 시 401 (이메일은 있어도 password 미보유)
- `auth_source='local'` 사용자(예: admin@tpi.co.kr)는 그대로 동작

---

## 7. Frontend Behavior (프론트 동작)

### 7.1 LoginPage useEffect 분기

```
LoginPage mount
  └─ amaToken = params.get('ama_token')
  ├─ if amaToken
  │     → showSpinner('AMA 인증 중...')
  │     → POST /api/acm/auth/ama-exchange { amaToken }
  │     → setAuth(accessToken, user)
  │     → if locale → i18n.changeLanguage(locale)
  │     → history.replaceState(null, '', '/login')   // 토큰 URL 제거
  │     → navigate(returnTo || '/dashboard', replace=true)
  │     → on error → showError() + [ 다시 시도 ] (AMA 포털 링크)
  └─ else
        → 기존 email/password 폼 (break-glass)
```

### 7.2 i18n locale 적용
- `?locale=en|ko|vi|zh-CN` 화이트리스트
- 실패 시 무시 (기본값 ko)
- 영구 저장 (`localStorage.acm.lang`)

### 7.3 로그아웃 동작
- 자체 로그아웃 버튼 = ACM 토큰만 삭제 (AMA 세션 영향 없음)
- 향후 SLO 도입 시 별도 처리 (Phase 2 / N-2)

---

## 8. Infrastructure (인프라)

### 8.1 nginx 변경 — `docker/staging/nginx-acm.conf`

```nginx
server {
  listen 443 ssl http2;
  server_name acm-stg.amoeba.site;
  ...
  add_header Strict-Transport-Security "max-age=300" always;
  # NEW — iframe embedding from AMA portal
  add_header Content-Security-Policy "frame-ancestors https://ama.amoeba.site https://ama-stg.amoeba.site 'self';" always;
  # X-Frame-Options 명시 미설정 (default 없음 = 허용; 단 일부 환경에서 SAMEORIGIN 자동 추가될 수 있어 명시 unset)
  ...
}
```

> **Production 카운터파트**: `docker/production/nginx-acm.conf` 동일 패턴, `frame-ancestors`에 prod AMA 도메인만.

### 8.2 환경 변수 추가

```env
# docker/staging/.env.staging  +  docker/production/.env.production
AMA_JWT_SECRET=<128bit+ random shared with AMA platform team>
AMA_JWT_ALGORITHM=HS256
AMA_JWT_ALLOWED_APP_CODES=tpi-acm
AMA_JWT_REQUIRED_SCOPE=custom_app:context
AMA_JWT_CLOCK_SKEW_SEC=60
AMA_RETURN_URL=https://ama-stg.amoeba.site/   # 실패 시 리턴 안내용
AMA_FRAME_ANCESTORS=https://ama.amoeba.site https://ama-stg.amoeba.site
```

> **AMA 플랫폼 팀 협조 필요**: `AMA_JWT_SECRET` 발급/공유 절차. 본 토큰은 staging용. Production은 별도 시크릿.

---

## 9. Non-functional (비기능)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-AMA-1 | 교환 응답 시간 | 95p < 300ms (DB upsert + JWT sign) |
| NFR-AMA-2 | 시크릿 관리 | env에만 저장, 코드/이미지 미포함, 로테이션 절차 문서화 |
| NFR-AMA-3 | iframe 호환 | Chrome/Safari/Edge 최신 2개 메이저, 포함 모달·드롭다운 정상 |
| NFR-AMA-4 | 멀티테넌시 | 모든 후속 API 쿼리 `WHERE ent_id = $jwt.entId` 유지 |
| NFR-AMA-5 | 감사 로그 | 24시간 보관, fail 사례는 30일 |
| NFR-AMA-6 | 로깅 PII 최소화 | sub UUID + email만, 토큰 본문은 로그 금지 |

---

## 10. Acceptance Criteria (수락 기준)

### AC-1: 정상 SSO 진입
**Given** AMA에서 발급된 유효한 ama_token (5분 후 만료)
**When** `https://acm-stg.amoeba.site/login?ama_token=<jwt>&locale=en` 직접 진입
**Then** 200 — 즉시 `/dashboard` 진입, 영문 UI, URL에서 `ama_token` 제거됨

### AC-2: iframe 임베드
**Given** AMA 포털 페이지가 `<iframe src="https://acm-stg.amoeba.site/login?ama_token=...">`
**When** 부모 페이지 로드
**Then** iframe 내 ACM 정상 렌더 + 자동 로그인 + dashboard 표시. CSP 위반 console error 없음.

### AC-3: 만료 토큰
**Given** exp 지난 ama_token
**When** 진입
**Then** 401 + 안내 메시지 + AMA 포털 복귀 링크 노출. `/dashboard` 미진입.

### AC-4: 위조 서명
**Given** 다른 시크릿으로 서명한 ama_token
**When** 진입
**Then** 401 + 보안 로그 1건 (level=warn, sub=토큰의 sub claim, ip)

### AC-5: 잘못된 appCode
**Given** appCode='other-app'
**When** 진입
**Then** 403 `AMA_TOKEN_APP_CODE_INVALID`

### AC-6: 자동 프로비저닝
**Given** 신규 ama_user_id (DB 미존재)
**When** 정상 진입
**Then** `amb_acm_user` 1행 INSERT (auth_source='ama'), 두 번째 진입 시 INSERT 없이 last_login_at만 UPDATE

### AC-7: 멀티테넌시 격리
**Given** entityId=A 사용자가 SSO 진입
**When** entityId=B 데이터 조회 시도
**Then** 404 (기존 가드 정책)

### AC-8: 비-iframe 직접 접근
**Given** ama_token 없이 `/login` 직접 접근
**When** 페이지 표시
**Then** 기존 email/password 폼 정상 동작 (break-glass)

---

## 11. Risks & Open Questions

| ID | 항목 | 영향 | 대응 |
|---|---|---|---|
| R-1 | AMA_JWT_SECRET 발급 지연 | 본 작업 차단 | 스펙 명세 회신 받음과 병행, 임시 dev secret로 mock 검증 |
| R-2 | AMA가 향후 OIDC로 전환 | 재구현 | 어댑터 패턴: `AmaTokenVerifier` 인터페이스로 분리, OIDC 구현체 별도 추가 가능 |
| R-3 | iframe 내 cookie 사용 시 SameSite=None+Secure 필요 | 현재는 토큰만 사용 → 영향 없음 | 향후 쿠키 도입 시 재평가 |
| R-4 | locale 화이트리스트 누락 → XSS/오작동 | 낮 | 명시적 enum 검증 |
| R-5 | ama_token URL 노출 (브라우저 히스토리, 외부 리퍼러) | 중 | history.replaceState로 즉시 제거 + 짧은 exp |
| R-6 | 동일 사용자 동시 다중 세션 | 낮 | 본 범위 영향 없음 (ACM JWT는 stateless) |

### 11.1 사용자 결정 필요 (Q-USER)

| Q | 질문 | 옵션 |
|---|---|---|
| **Q-1** | iframe 화이트리스트 도메인은? | (a) `ama.amoeba.site` + `ama-stg.amoeba.site` 둘 다 / (b) staging에선 stg만 / (c) 추가 도메인 (ama 운영자 확인 필요) |
| **Q-2** | AMA_JWT_SECRET 어디서 받나? | (a) AMA 플랫폼 팀에 별도 요청 (도구: 1Password) / (b) 본 작업에서 임시 dev secret 사용 → 운영 전 교체 |
| **Q-3** | ~~break-glass 자체 로그인 폼 유지?~~ | **Resolved 2026-05-05 → (a) 유지** — 사용자 명시 요구로 확정. 기존 이메일/비밀번호 로그인은 100% 호환 유지(FR-AMA-60~64 참조) |
| **Q-4** | role=MASTER 외 다른 role 처리 정책? | (a) 본 범위 MASTER만, 다른 role도 동일 권한 부여 / (b) MASTER 외는 차단 / (c) 매핑 테이블 별도 도입 (Phase 2) |
| **Q-5** | locale 4개 (`ko/en/vi/zh-CN`) 모두 지원? | (a) 4개 모두 / (b) ko/en만 |

---

## 12. Dependencies

| 의존 | 상태 | 영향 |
|---|---|---|
| AMA 플랫폼 팀의 `AMA_JWT_SECRET` 공유 | ❌ 미수령 | R-1 |
| acm-auth 모듈 (login, jwt strategy) | ✅ 가동 중 | 재사용 |
| Postgres `amb_acm_user` | ✅ 가동 중 | ALTER만 |
| 기존 `frame-ancestors` 정책 | ❌ 없음 | nginx 수정 필요 |

---

## 13. Out-of-scope follow-ups

| 후속 | 메모 |
|---|---|
| ACM-AMA-SLO | AMA 로그아웃 시 ACM 세션도 종료 (Spec Ask B-3) |
| ACM-AMA-DEEPLINK | AMA → ACM 학생/수업 ID 점프 (Spec Ask B-1) |
| ACM-AMA-OIDC | AMA OIDC 전환 시 어댑터 추가 |
| ACM-AMA-RBAC | role → ACM 권한 매핑 정교화 |

---

## 14. DoD

- [ ] §5 신규 엔드포인트 + Swagger
- [ ] §6 마이그레이션 적용 + 롤백 스크립트
- [ ] §8 nginx 헤더 + env vars 적용 (staging)
- [ ] §10 AC-1~8 통합 테스트 통과
- [ ] iframe 수동 테스트 (Chrome) 캡처 1장
- [ ] CHANGELOG `[1.5.0]` + 보고서 `docs/report/REPORT-{YYMMDD}-acm-ama-sso.md`

---

> ⚠ **Draft 상태.** §11.1 Q-1~Q-5 결정 후 status=Approved 전환. 작업 계획서 [PLAN-260505-acm-ama-sso.md](../implementation/PLAN-260505-acm-ama-sso.md) 도 본 결정에 맞춰 갱신.
