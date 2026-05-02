---
document_id: ACM-AUTH-REQ-1.0.0
version: 1.0.0
status: draft
created: 2026-05-03
authors: [copilot]
change_log:
  - 2026-05-03 v1.0.0 초안 — ACM 자체 인증 / 로그인 플로우 정식 도입
---

# ACM Authentication Requirements (ACM 인증 요구사항) — v1.0.0

## 1. Overview (개요)

`frontend-acm` (Vite/React CMS) 가 backend ACM 모듈 (Postgres `db_acm`) 의 보호된 엔드포인트를 호출하려면 JWT 가 필요하나, 현재 로그인 UI/API/사용자 테이블이 모두 부재하다. 결과적으로 모든 `/api/acm/*` 호출이 **403 Missing entId in JWT** 로 실패한다.

본 문서는 **ACM 전용 정식 인증 플로우** 도입 요구사항을 정의한다. (TAC MySQL admin 과 별개의 독립 인증 시스템.)

## 2. Background (배경)

| 항목 | 현황 |
|---|---|
| `frontend-acm/src/lib/api-client.ts` | axios + Bearer token 인터셉터 ✅ |
| `frontend-acm/src/stores/auth.store.ts` | zustand persist `{token, user}` ✅ |
| 로그인 페이지/라우트 | ❌ 없음 |
| Backend ACM auth 컨트롤러 | ❌ 없음 (TAC `AuthController` 는 MySQL `tac_users` 기반) |
| ACM Postgres user 테이블 | ❌ 없음 (`ent_id` 는 단순 tenant UUID) |
| ACM 컨트롤러 가드 | `OwnEntityGuard` 만 — `req.user.entId` 부재 시 403 즉시 반환 |
| JWT 인증 가드 (passport-jwt) | TAC 측에만 존재, ACM 컨트롤러에는 미체이닝 |

## 3. Goals (목표)

- G-1: `frontend-acm` 사용자가 이메일·비밀번호로 로그인 후 `/sch`, `/qna`, `/csl`, `/cls`, `/ref`, `/dashboard` 모든 ACM 화면을 정상 사용할 수 있다.
- G-2: JWT 에 `entId` (Postgres UUID) 가 포함되어 `OwnEntityGuard` 가 통과한다.
- G-3: 인증 실패/만료 시 `/login` 으로 자동 리다이렉트한다.
- G-4: 스테이징에 정상 배포되고, 시드 운영자(예: `admin@acm.local` / 임시 비밀번호) 로 즉시 로그인 가능하다.

## 4. Non-Goals (비목표)

- NG-1: TAC MySQL admin 과의 SSO/계정 통합 (별도 RFC).
- NG-2: AMA OIDC SSO 연동.
- NG-3: 비밀번호 재설정/이메일 인증 메일 발송 (관리자가 SQL 로 직접 발급).
- NG-4: MFA / OAuth provider 추가.
- NG-5: 사용자 self-signup. (시드/관리자 전용 계정만)
- NG-6: 역할 기반 권한 분기 (RBAC). 본 라운드는 모든 로그인 사용자가 동일 권한.

## 5. Functional Requirements (기능 요구사항)

### 5.1 Backend
- **FR-1** Postgres 신규 테이블 `amb_acm_user`:
  - `usr_id UUID PK`
  - `ent_id UUID NOT NULL` (tenant)
  - `usr_email VARCHAR(200) NOT NULL`
  - `usr_password_hash VARCHAR(120) NOT NULL` (bcrypt rounds 12)
  - `usr_name VARCHAR(100) NOT NULL`
  - `usr_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'` (ACTIVE / SUSPENDED)
  - `usr_last_login_at TIMESTAMPTZ NULL`
  - `created_at`, `updated_at`
  - `UNIQUE(ent_id, usr_email)`
- **FR-2** `POST /api/acm/auth/login` — 이메일/비번 → `{ accessToken, user: { id, entId, email, name } }`. 실패 시 401.
- **FR-3** `GET /api/acm/auth/me` — JWT 보호. 현재 사용자 반환.
- **FR-4** JWT payload `{ sub: usr_id, entId, email, name }`. 만료 12시간.
- **FR-5** 신규 `AcmJwtStrategy` 등록. `req.user = { id, entId, email, name }`.
- **FR-6** `AcmJwtAuthGuard` 신설. **모든 ACM 컨트롤러에 `@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)` 적용**.
- **FR-7** Bcrypt rate-limit: 동일 이메일 5회 연속 실패 시 60초 lockout (in-memory 카운터로 충분, Redis 의존 없이).

### 5.2 Frontend (frontend-acm)
- **FR-8** `/login` 라우트 + `LoginPage` 컴포넌트 (i18n 4개 언어).
- **FR-9** `RequireAuth` 라우트 가드: `auth.store` 토큰 부재 시 `/login` 으로 redirect (returnTo state).
- **FR-10** 로그인 성공 시 `auth.store.setAuth(token, user)` → 원래 페이지로 navigate.
- **FR-11** `apiClient` 401 응답 시 store clear + `/login` redirect (현재 `clear()` 만 하고 redirect 없음).
- **FR-12** `AppShell` 헤더에 사용자 이름 + 로그아웃 버튼 표시. 로그아웃 시 store clear + `/login`.

### 5.3 Seed / Operations
- **FR-13** SQL 시드: `admin@acm.local` / `acm20261234` (bcrypt rounds 12), `ent_id = 00000000-0000-0000-0000-000000000001`.
- **FR-14** 환경변수 `ACM_JWT_SECRET` (프로덕션 필수). 누락 시 backend 부팅 거부.

## 6. Non-Functional Requirements

- **NFR-1** Bcrypt rounds 12.
- **NFR-2** JWT secret 32자 이상 random. `.env.staging` / `.env.production` 분리.
- **NFR-3** HTTPS only — 토큰은 Authorization 헤더 (이미 적용).
- **NFR-4** Login endpoint 는 상세 에러 메시지 노출 금지 ("Invalid credentials" 만).
- **NFR-5** 모든 신규 코드는 `strict` TS, lint clean.

## 7. Acceptance Criteria (인수 기준)

- **AC-1** [Backend] `POST /api/acm/auth/login` 정상 자격증명 → 200 + JWT 반환.
- **AC-2** [Backend] 잘못된 비번 → 401, 메시지 "Invalid credentials".
- **AC-3** [Backend] JWT 없이 `GET /api/acm/sch/schools` 호출 → 401 (이전 403 이 아님 — 가드 순서 변경).
- **AC-4** [Backend] 유효 JWT 로 `GET /api/acm/sch/schools` 호출 → 200 + `data` 배열.
- **AC-5** [Backend] `GET /api/acm/auth/me` → 200 + `{user:{id,entId,email,name}}`.
- **AC-6** [Frontend] 비로그인 상태에서 `/sch` 접근 → `/login?returnTo=/sch` 로 redirect.
- **AC-7** [Frontend] 로그인 폼 제출 → 성공 시 `/sch` 로 이동, 실패 시 에러 메시지 (i18n).
- **AC-8** [Frontend] 로그인 후 새로고침해도 세션 유지 (localStorage persist).
- **AC-9** [Frontend] AppShell 우측 상단에 사용자 이름 + 로그아웃 버튼. 클릭 시 `/login` 이동.
- **AC-10** [Frontend] 만료/무효 토큰으로 API 호출 → 401 응답 시 자동 logout + `/login` redirect.
- **AC-11** [Staging] `admin@acm.local` / `acm20261234` 로그인 후 `/sch` 페이지에서 학교 목록 정상 로드.
- **AC-12** [Staging] 로그인 5회 실패 후 60초간 추가 시도 차단.

## 8. Constraints / Risks

- ACM Postgres 와 TAC MySQL 의 사용자 시스템 분리 유지 — JWT secret/payload 도 분리 (`ACM_JWT_SECRET` ≠ `JWT_SECRET`).
- `OwnEntityGuard` 의 `req.user?.entId` 참조 그대로 유지 (변경 금지). 새 가드는 `entId` 를 `req.user` 에 주입만.
- 기존 통합 테스트 (`it-sch-p1`, `it-qna-p1` 등) 은 setup.ts 에서 `req.user` 를 직접 주입하므로 영향 없음 — 가드 추가 시 테스트는 `AcmJwtAuthGuard` 를 mock 으로 교체 필요.

## 9. Out of Scope Reminders

- TAC admin SSO, AMA OIDC, 비밀번호 재설정 메일, MFA, RBAC, self-signup → NG-1~6.
