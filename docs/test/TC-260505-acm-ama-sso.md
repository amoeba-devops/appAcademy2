---
document_id: ACM-AMA-SSO-TC-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-05
updated: 2026-05-05
author: 김익용 (Gray)
related:
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md
  - docs/implementation/PLAN-260505-acm-ama-sso.md
change_log:
  - version: 1.0.0
    date: 2026-05-05
    author: 김익용
    description: Initial test cases (Unit / Integration / E2E / Manual) for ACM × AMA Custom App SSO.
---

# ACM × AMA Custom App SSO — Test Cases (테스트 케이스)

## 1. Coverage Matrix (AC ↔ TC)

| AC | 시나리오 | TC ID(s) | 분류 |
|---|---|---|---|
| AC-1 | 정상 SSO 진입 (locale=en) | TC-INT-01, TC-E2E-01 | Integration, E2E |
| AC-2 | iframe 임베드 | TC-MAN-01 | Manual |
| AC-3 | 만료 토큰 | TC-UNIT-02, TC-INT-02, TC-E2E-02 | Unit, Integration, E2E |
| AC-4 | 위조 서명 | TC-UNIT-01, TC-INT-03 | Unit, Integration |
| AC-5 | 잘못된 appCode | TC-UNIT-04, TC-INT-04 | Unit, Integration |
| AC-6 | 자동 프로비저닝 (INSERT/UPDATE) | TC-INT-05, TC-INT-06 | Integration |
| AC-7 | 멀티테넌시 격리 | TC-INT-07 | Integration |
| AC-8 | 비-iframe 직접 접근 | TC-E2E-03 | E2E |

> 모든 P0 FR이 최소 1개 TC로 커버됨을 §5 FR↔TC 표에서 확인.

---

## 2. Unit Tests (Jest, `*.spec.ts`)

대상: `backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts`

### TC-UNIT-01 — 위조 서명 거부
- **우선순위**: P0
- **전제조건**: Verifier가 `AMA_JWT_SECRET=secret-A`로 초기화됨
- **입력**: `secret-B`로 sign된 JWT
- **기대 결과**: `verify()` throws `AmaTokenInvalidSignatureError`

### TC-UNIT-02 — 만료 토큰 거부
- **우선순위**: P0
- **전제조건**: clock skew 60s
- **입력**: `exp = now - 120s` 토큰
- **기대 결과**: throws `AmaTokenExpiredError`

### TC-UNIT-03 — clock skew 내 통과
- **우선순위**: P0
- **입력**: `exp = now - 30s` 토큰 (skew 60s)
- **기대 결과**: 정상 반환 (claims)

### TC-UNIT-04 — appCode 화이트리스트 위반
- **우선순위**: P0
- **전제조건**: `AMA_JWT_ALLOWED_APP_CODES=tpi-acm`
- **입력**: `appCode='other-app'` 토큰
- **기대 결과**: throws `AmaTokenAppCodeInvalidError`

### TC-UNIT-05 — scope 불일치
- **우선순위**: P0
- **입력**: `scope='other'` 토큰
- **기대 결과**: throws `AmaTokenScopeInvalidError`

### TC-UNIT-06 — 필수 claim 누락
- **우선순위**: P0
- **입력**: `email` claim 없는 토큰
- **기대 결과**: throws `AmaTokenClaimsMissingError`

### TC-UNIT-07 — 정상 토큰 파싱
- **우선순위**: P0
- **입력**: 유효한 토큰
- **기대 결과**: `{ sub, email, role, entityId, appId, appCode, scope, iat, exp }` 반환

---

## 3. Integration Tests (Jest + supertest)

대상: `POST /api/acm/auth/ama-exchange` 엔드투엔드

### TC-INT-01 — 정상 교환 (신규 사용자) [AC-1, AC-6]
- **우선순위**: P0
- **전제조건**: DB에 해당 ama_user_id 미존재
- **입력**: 유효한 JWT
- **기대 결과**:
  - HTTP 200, body `{ success: true, data: { accessToken, user: { id, entId, email } } }`
  - DB에 `amb_acm_user` 1행 INSERT (auth_source='ama', ama_user_id, ama_entity_id, ama_role 채워짐)
  - 발급된 ACM JWT decode 시 `entId === entityId from ama_token`

### TC-INT-02 — 만료 토큰 [AC-3]
- **우선순위**: P0
- **입력**: exp 지난 JWT
- **기대 결과**: 401, body `{ error: { code: 'AMA_TOKEN_EXPIRED' } }`

### TC-INT-03 — 위조 서명 [AC-4]
- **우선순위**: P0
- **기대 결과**: 401, code `AMA_TOKEN_INVALID_SIGNATURE`, 보안 로그 1건 (warn level)

### TC-INT-04 — 잘못된 appCode [AC-5]
- **우선순위**: P0
- **기대 결과**: 403, code `AMA_TOKEN_APP_CODE_INVALID`

### TC-INT-05 — 재진입 (기존 사용자) [AC-6]
- **우선순위**: P0
- **전제조건**: TC-INT-01 후 동일 ama_user_id
- **기대 결과**: HTTP 200, DB INSERT 없음, `last_login_at` UPDATE 1건

### TC-INT-06 — 이메일 변경 동기화 [FR-AMA-24]
- **우선순위**: P1
- **전제조건**: 기존 사용자 email='old@x'
- **입력**: 동일 sub, email='new@x'
- **기대 결과**: HTTP 200, DB의 email='new@x'로 UPDATE

### TC-INT-07 — 멀티테넌시 격리 [AC-7]
- **우선순위**: P0
- **전제조건**: ent A의 사용자가 SSO로 로그인 후 발급된 ACM JWT 보유
- **입력**: ent B 리소스 GET (`/api/acm/sch/schools` with ent_id=B 데이터만)
- **기대 결과**: 응답에 ent A 데이터만 포함, ent B 데이터 0건

### TC-INT-08 — DTO 검증 (필수 필드 누락) [FR-AMA-14]
- **우선순위**: P0
- **입력**: `{ }` body
- **기대 결과**: 400, validation 오류

### TC-INT-09 — Rate limit [FR-AMA-51]
- **우선순위**: P1
- **입력**: 동일 IP에서 위조 토큰 31회 연속 호출
- **기대 결과**: 31번째 응답 429

### TC-INT-10 — 환경변수 누락 시 부팅 실패 [FR-AMA-T-1.7]
- **우선순위**: P0
- **전제조건**: `AMA_JWT_SECRET` 미설정
- **기대 결과**: NestJS 부팅 실패 + 에러 메시지에 키 명시

---

## 4. E2E Tests (Playwright)

대상: `frontend-acm/e2e/ama-sso.spec.ts`

### TC-E2E-01 — 정상 SSO + locale=en 자동 진입 [AC-1]
- **우선순위**: P0
- **사전 작업**: Node에서 `jsonwebtoken`으로 dev secret 사용해 유효 토큰 발급
- **시나리오**:
  1. `goto('/login?ama_token=<jwt>&locale=en')`
  2. 스피너 노출 확인 ("AMA 인증 처리 중...")
  3. URL이 `/dashboard`로 변경됨 (timeout 10s)
  4. 페이지에 영어 UI 텍스트 노출 (예: "Dashboard")
  5. URL에 `ama_token` 미포함 (history.replaceState 동작)
  6. localStorage `acm-auth`에 토큰·user 저장됨

### TC-E2E-02 — 만료 토큰 시 에러 노출 [AC-3]
- **우선순위**: P0
- **시나리오**:
  1. exp 지난 토큰으로 `/login?ama_token=<expired>`
  2. 에러 카드 노출: "AMA 인증이 만료되었습니다"
  3. `[ AMA 포털로 돌아가기 ]` 버튼 표시
  4. `/dashboard` 미진입

### TC-E2E-03 — 비-iframe 직접 접근 (break-glass) [AC-8]
- **우선순위**: P0
- **시나리오**:
  1. `goto('/login')` (ama_token 없음)
  2. email/password 폼 즉시 노출
  3. `admin@tpi.co.kr / acm20261234` 로그인 → `/dashboard` 진입

### TC-E2E-04 — 잘못된 locale 무시
- **우선순위**: P1
- **시나리오**: `/login?ama_token=<valid>&locale=xx-YY`
- **기대 결과**: 정상 진입, 기본 언어(ko) 유지

---

## 5. Manual Tests

### TC-MAN-01 — iframe 임베드 [AC-2]
- **우선순위**: P0
- **사전 작업**: 임시 HTML (`/tmp/ama-iframe-test.html`) 작성:
  ```html
  <iframe src="https://acm-stg.amoeba.site/login?ama_token=<JWT>&locale=ko"
          width="1280" height="800" frameborder="0"></iframe>
  ```
- **시나리오**:
  1. 로컬에 임시 HTML 호스팅 (또는 `file://` 로컬 직접 열기 — CSP 동작 확인 위해 동일 출처 시뮬레이션은 staging-aware하게)
  2. 권장: 임시 HTML을 `https://ama-stg.amoeba.site` 도메인 하위에서 호스팅하여 CSP 화이트리스트 검증
- **기대 결과**:
  - iframe 내 ACM 정상 렌더, `/dashboard` 진입
  - DevTools Console에 CSP 위반 0건
  - 비-허용 도메인(`https://example.com`) 호스팅 시 iframe 차단(브라우저 console에 `frame-ancestors` 위반 메시지)

### TC-MAN-02 — CSP 헤더 검증
- **우선순위**: P0
- **명령**: `curl -sI https://acm-stg.amoeba.site/ | grep -i 'content-security-policy'`
- **기대 결과**: `frame-ancestors https://ama.amoeba.site https://ama-stg.amoeba.site 'self'` 포함

### TC-MAN-03 — URL 토큰 노출 검증
- **우선순위**: P0
- **시나리오**: SSO 진입 후 브라우저 주소창과 history 확인
- **기대 결과**: 주소창 = `/dashboard` (또는 returnTo). History에 `ama_token` query 미잔존

### TC-MAN-04 — 실 토큰 시연 [AC-1]
- **우선순위**: P0
- **사전 작업**: AMA 플랫폼에서 실 토큰 발급
- **기대 결과**: 1회 클릭으로 ACM 진입

### TC-MAN-05 — 시크릿 로테이션 절차
- **우선순위**: P1
- **시나리오**: env의 `AMA_JWT_SECRET` 교체 → backend 재기동 → 구 시크릿 토큰 401 / 신 시크릿 토큰 200
- **기대 결과**: 로테이션 절차 문서대로 동작

---

## 5.5 회귀 — 기존 이메일/비밀번호 로그인 (Backward Compatibility) [신규 1.0.1]

> AMA SSO 추가가 기존 인증 경로를 깨지 않음을 보장. FR-AMA-60~64 매핑.

### TC-REG-01 — 기존 `/api/acm/auth/login` 정상 동작 [FR-AMA-60]
- **우선순위**: P0 / Integration
- **시나리오**: `POST /api/acm/auth/login { email: 'admin@tpi.co.kr', password: 'acm20261234' }`
- **기대 결과**: 200 OK, `{success: true, data: {accessToken, user: {...}}}`. `auth_source` 컬럼 추가 후에도 응답 스키마 변경 없음

### TC-REG-02 — 잘못된 비밀번호 401 [FR-AMA-60]
- **우선순위**: P0 / Integration
- **시나리오**: 동일 이메일 + 틀린 비밀번호
- **기대 결과**: 401 Unauthorized, `Invalid credentials`

### TC-REG-03 — Rate limit 5회 잠금 [FR-AMA-60]
- **우선순위**: P1 / Integration
- **시나리오**: 1분 내 6회 실패
- **기대 결과**: 6회째 429 Too Many Requests

### TC-REG-04 — `/login` 화면 폼 노출 [FR-AMA-61]
- **우선순위**: P0 / E2E
- **시나리오**: `?ama_token=` 없이 `/login` 진입
- **기대 결과**: 이메일/비밀번호 input + "로그인" 버튼 즉시 표시. AMA 분기 코드가 폼 렌더링을 가리지 않음

### TC-REG-05 — `/login` 화면에서 수동 로그인 성공 [FR-AMA-61, FR-AMA-62]
- **우선순위**: P0 / E2E
- **시나리오**: 폼에 `admin@tpi.co.kr` / `acm20261234` 입력 → submit
- **기대 결과**: `/dashboard` redirect, localStorage `acm-auth` 저장

### TC-REG-06 — AMA 자동 프로비저닝 사용자 자체 로그인 거부 [FR-AMA-63]
- **우선순위**: P1 / Integration
- **시나리오**: 사전 — AMA SSO로 `fremd@naver.com` 자동 생성됨 (auth_source='ama', password_hash NULL). 그 후 `POST /api/acm/auth/login { email: 'fremd@naver.com', password: 'anything' }`
- **기대 결과**: 401 Unauthorized (bcrypt 비교 시 자연 실패)

### TC-REG-07 — ACM JWT 발급 페이로드 동일성 [FR-AMA-64]
- **우선순위**: P0 / Integration
- **시나리오**: (a) login 경로로 발급된 JWT, (b) ama-exchange로 발급된 JWT 두 개 비교
- **기대 결과**: 두 JWT 모두 payload `{sub, entId, email, name, iat, exp}` 동일 키. `AcmJwtAuthGuard`로 보호된 `/api/acm/auth/me` 양쪽 다 200

### TC-REG-08 — 기존 admin 계정 e2e 로그인 (CHANGELOG 회귀 가드)
- **우선순위**: P0 / E2E
- **시나리오**: 마이그레이션 510 적용 후 staging에서 `admin@tpi.co.kr` 폼 로그인
- **기대 결과**: 마이그레이션 전과 동일하게 정상 진입

---

## 6. FR ↔ TC 매핑

| FR | TC |
|---|---|
| FR-AMA-01 (자동 교환) | TC-E2E-01 |
| FR-AMA-02 (교환 API) | TC-INT-01 |
| FR-AMA-03 (locale) | TC-E2E-01, TC-E2E-04 |
| FR-AMA-04 (redirect) | TC-E2E-01 |
| FR-AMA-05 (실패 안내) | TC-E2E-02 |
| FR-AMA-10 (HS256 서명) | TC-UNIT-01, TC-INT-03 |
| FR-AMA-11 (exp/iat) | TC-UNIT-02, TC-UNIT-03, TC-INT-02 |
| FR-AMA-12 (scope) | TC-UNIT-05 |
| FR-AMA-13 (appCode) | TC-UNIT-04, TC-INT-04 |
| FR-AMA-14 (claims 존재) | TC-UNIT-06, TC-INT-08 |
| FR-AMA-15 (replay 방지, P1) | (jti 캐시 도입 시 TC 추가) |
| FR-AMA-20 (upsert) | TC-INT-01, TC-INT-05 |
| FR-AMA-21 (스키마 컬럼) | TC-INT-01 (DB 검증 step) |
| FR-AMA-22 (passwordHash NULL) | 마이그레이션 적용 시 검증 (TC-MAN-수동 SQL) |
| FR-AMA-23 (entId 매핑) | TC-INT-01 (JWT decode step) |
| FR-AMA-24 (이메일 동기화, P1) | TC-INT-06 |
| FR-AMA-30/31/32 (ACM JWT 발급) | TC-INT-01 |
| FR-AMA-40 (CSP frame-ancestors) | TC-MAN-01, TC-MAN-02 |
| FR-AMA-41 (X-Frame-Options 미설정) | TC-MAN-02 |
| FR-AMA-43 (localStorage) | TC-E2E-01 (storage step) |
| FR-AMA-50 (감사 로그) | TC-INT-03 (로그 검증 step) |
| FR-AMA-51 (rate limit, P1) | TC-INT-09 |
| FR-AMA-52 (URL 토큰 제거) | TC-MAN-03, TC-E2E-01 |
| **FR-AMA-60** (legacy login API 무변경) | **TC-REG-01, TC-REG-02, TC-REG-03** |
| **FR-AMA-61** (legacy 폼 노출) | **TC-REG-04, TC-REG-05** |
| **FR-AMA-62** (legacy admin 계정) | **TC-REG-05, TC-REG-08** |
| **FR-AMA-63** (AMA 사용자 자체 로그인 거부) | **TC-REG-06** |
| **FR-AMA-64** (ACM JWT 동일성) | **TC-REG-07** |

---

## 7. Test Data (테스트 픽스처)

### 7.1 토큰 fixture builder

```ts
// backend/test/fixtures/ama-token.fixture.ts
import jwt from 'jsonwebtoken';

const SECRET = process.env.AMA_JWT_SECRET ?? 'dev-acm-ama-secret-change-me-32bytes-for-tests';

export function makeAmaToken(overrides: Partial<{
  sub: string; email: string; role: string;
  entityId: string; appId: string; appCode: string;
  scope: string; ttlSec: number; signWith?: string;
}> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub:       overrides.sub      ?? 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
    email:     overrides.email    ?? 'fremd@naver.com',
    role:      overrides.role     ?? 'MASTER',
    entityId:  overrides.entityId ?? '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
    appId:     overrides.appId    ?? '15b69898-7828-4072-9892-a2f7bea1eb57',
    appCode:   overrides.appCode  ?? 'tpi-acm',
    scope:     overrides.scope    ?? 'custom_app:context',
    iat: now,
    exp: now + (overrides.ttlSec ?? 3600),
  };
  return jwt.sign(payload, overrides.signWith ?? SECRET, { algorithm: 'HS256' });
}
```

### 7.2 테스트용 dev secret (환경변수)
```
AMA_JWT_SECRET=dev-acm-ama-secret-change-me-32bytes-for-tests
```

> 운영 secret은 별도 발급, 본 dev secret은 staging까지만 허용.

---

## 8. Execution Plan (실행 순서)

| 순서 | 단계 | 명령 |
|---|---|---|
| 1 | Unit | `cd backend && npm test -- ama-token.verifier.spec` |
| 2 | Integration | `cd backend && npm run test:int -- acm-ama-exchange.int-spec` |
| 3 | E2E (frontend-acm) | `cd frontend-acm && npx playwright test e2e/ama-sso.spec.ts` |
| 4 | Manual TC-MAN-01~05 | 사용자 직접 (스테이징 배포 후) |

---

## 9. DoD for Test Phase

- [ ] §2 Unit 7건 PASS (커버리지 ≥ 90% on verifier)
- [ ] §3 Integration P0 7건 PASS (TC-INT-01~05, 07, 08, 10), P1 2건 (06, 09) PASS
- [ ] §4 E2E P0 3건 PASS (TC-E2E-01, 02, 03)
- [ ] §5 Manual P0 4건 (TC-MAN-01~04) 검증 완료, 스크린샷 1장 (iframe 임베드 캡처)
- [ ] 회귀: 기존 acm-auth 단위/통합 테스트 30건 그대로 PASS

---

> ⚠ **Draft 상태.** 사용자 승인 후 status=Approved → 구현 단계 진입.
