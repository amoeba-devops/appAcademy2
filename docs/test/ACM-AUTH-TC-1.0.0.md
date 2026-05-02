---
document_id: ACM-AUTH-TC-1.0.0
version: 1.0.0
status: draft
created: 2026-05-03
authors: [copilot]
related:
  - docs/analysis/ACM-AUTH-REQ-1.0.0.md
  - docs/implementation/ACM-AUTH-PLAN-1.0.0.md
---

# ACM Authentication — Test Cases v1.0.0

## 1. Coverage Matrix (AC ↔ TC)

| AC | TC | Type | Priority |
|---|---|---|---|
| AC-1 login 200 | TC-01 | Integration | P0 |
| AC-2 login 401 invalid pwd | TC-02 | Integration | P0 |
| AC-3 unauthenticated /api/acm/sch/schools → 401 | TC-03 | Integration | P0 |
| AC-4 authenticated → 200 | TC-04 | Integration | P0 |
| AC-5 GET /me → 200 | TC-05 | Integration | P0 |
| AC-6 frontend redirect to /login | TC-06 | E2E (manual) | P0 |
| AC-7 form submit success/error | TC-07 | E2E (manual) | P0 |
| AC-8 session persist on refresh | TC-08 | E2E (manual) | P1 |
| AC-9 AppShell user info + logout | TC-09 | E2E (manual) | P1 |
| AC-10 401 auto-redirect | TC-10 | E2E (manual) | P0 |
| AC-11 staging admin login + /sch | TC-11 | Smoke | P0 |
| AC-12 5회 실패 lockout 60s | TC-12 | Integration | P1 |
| 회귀 — 기존 P1 테스트 26/26 PASS | TC-13 | Integration | P0 |

## 2. Test Cases

### TC-01 [Int / P0] Login — Happy path

- **Pre**: amb_acm_user 시드 (`admin@acm.local` / `acm20261234`).
- **Input**: `POST /api/acm/auth/login {email:"admin@acm.local", password:"acm20261234"}`
- **Expected**: 200, body `{accessToken: <jwt>, user:{id,entId,email:"admin@acm.local",name}}`. JWT decode 시 `entId === '00000000-0000-0000-0000-000000000001'`.

### TC-02 [Int / P0] Login — Invalid credentials

- **Input**: 잘못된 비밀번호.
- **Expected**: 401, body `{statusCode:401,message:"Invalid credentials"}`. 정확한 사유 (이메일 부재 vs 비번 오류) 노출 금지.

### TC-03 [Int / P0] Protected route — No token

- **Input**: `GET /api/acm/sch/schools` (Authorization 헤더 없음).
- **Expected**: 401 Unauthorized. (이전: 403). `OwnEntityGuard` 가 실행되기 전 `AcmJwtAuthGuard` 가 차단.

### TC-04 [Int / P0] Protected route — Valid token

- **Pre**: TC-01 의 JWT 확보.
- **Input**: `GET /api/acm/sch/schools` with `Authorization: Bearer <jwt>`.
- **Expected**: 200, body `{data: [...], meta: {...}}` 또는 빈 배열. `req.user.entId` 가 가드에 의해 주입되어 멀티테넌트 필터링 정상 동작.

### TC-05 [Int / P0] GET /api/acm/auth/me

- **Input**: 유효 JWT 로 `GET /api/acm/auth/me`.
- **Expected**: 200, `{user:{id,entId,email,name}}`.

### TC-06 [E2E manual / P0] Unauthenticated redirect

- **Pre**: 브라우저 localStorage 에서 `acm-auth` 키 삭제.
- **Step**: `https://acm-stg.amoeba.site/sch` 직접 접근.
- **Expected**: 즉시 `https://acm-stg.amoeba.site/login?returnTo=%2Fsch` 로 이동.

### TC-07 [E2E manual / P0] Login form

- **Step 1**: `/login` 에서 잘못된 비번 제출 → 빨간 에러 메시지 (i18n 번역됨).
- **Step 2**: 정상 자격증명 제출 → `/sch` 로 이동, 학교 목록 로드.
- **Expected**: 두 케이스 모두 정상 동작. 폼 제출 중에는 submit 버튼 disabled + spinner.

### TC-08 [E2E manual / P1] Session persistence

- **Pre**: TC-07 로 로그인 완료.
- **Step**: 브라우저 새로고침 (F5).
- **Expected**: `/sch` 페이지 그대로 유지, 학교 목록 정상 로드 (재로그인 불필요).

### TC-09 [E2E manual / P1] Header user info + Logout

- **Pre**: 로그인 완료.
- **Step 1**: AppShell 우측 상단에 `admin@acm.local` 표시 확인.
- **Step 2**: Logout 버튼 클릭.
- **Expected**: `/login` 으로 이동, localStorage `acm-auth` 토큰 제거됨.

### TC-10 [E2E manual / P0] Expired token auto-redirect

- **Pre**: 로그인 후 localStorage `acm-auth.token` 을 임의 무효값으로 수동 변경.
- **Step**: `/sch` 새로고침.
- **Expected**: API 호출이 401 → 즉시 `/login?returnTo=/sch` 로 redirect.

### TC-11 [Smoke / P0] Staging full path

```bash
TOKEN=$(curl -sk -X POST https://acm-stg.amoeba.site/api/acm/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acm.local","password":"acm20261234"}' | jq -r .accessToken)

curl -sk -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $TOKEN" \
  https://acm-stg.amoeba.site/api/acm/sch/schools
```

- **Expected**: TOKEN 비어있지 않음. 두 번째 curl → 200.

### TC-12 [Int / P1] Login lockout

- **Step**: 동일 이메일 5회 잘못된 비번 제출 → 6번째 시도.
- **Expected**: 6번째 응답이 429 Too Many Requests (또는 401 + "Too many attempts" 메시지). 60초 후 다시 200 가능.

### TC-13 [Int / P0] Regression — Existing P1 specs

- **Step**: `cd backend && npx jest --config test/jest-int.json --testPathPatterns="it-sch-p1|it-qna-p1"`
- **Expected**: 26/26 PASS — `AcmJwtAuthGuard` mock override 후 setup.ts 가 `req.user.entId` 직접 주입 유지.

## 3. Out-of-Scope (이 라운드 미검증)

- 비밀번호 해시 알고리즘 변경 마이그레이션
- TAC SSO ↔ ACM 토큰 교환
- 동시 다중 디바이스 토큰 무효화
- Refresh token 회전
