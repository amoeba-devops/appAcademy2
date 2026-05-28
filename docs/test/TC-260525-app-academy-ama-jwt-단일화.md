---
document_id: TC-260525-app-academy-ama-jwt-단일화
version: 1.0.0
status: Draft
created: 2026-05-25
author: 김익용 (Gray)
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md
  - docs/plan/PLN-260525-app-academy-ama-jwt-단일화.md
---

# app-academy × AMA 인증 단일화 — 테스트케이스

## 1. 테스트 범위

| 영역 | 범위 |
|------|------|
| Backend Build | 컴파일·린트 그린 (잔존 import 없음) |
| Backend Unit | `AmaTokenVerifier` 회귀 테스트 (기존 + 신규) |
| Backend Integration | `POST /api/acm/auth/ama-exchange` 정상 흐름 |
| Backend Negative | 제거된 `/api/auth/ama/*` 라우트 404 |
| Webhook 보존 | `POST /webhooks/ama/subscription` 회귀 |
| Frontend Smoke | `?ama_token=` 자동 로그인 동작 (스테이징) |
| 환경설정 | `.env.example` 의 변수 정합성 |
| 문서 | 잔존 OIDC 언급 제거 |

---

## 2. 단위 테스트 (Backend)

### TC-U-01 — Build & Lint Green

| 항목 | 내용 |
|------|------|
| 목적 | 코드 제거 후 컴파일 에러·미사용 import 없음 |
| 전제 | Phase 2 코드 제거 완료 |
| 수행 | `cd backend && npm run build && npm run lint` |
| 기대 | 둘 다 exit 0 |
| 실패 시 | 잔존 import 추적 → 추가 제거 |

### TC-U-02 — AmaTokenVerifier 정상 검증 (회귀)

| 항목 | 내용 |
|------|------|
| 목적 | 기존 단위 테스트 회귀 보호 |
| 파일 | `backend/src/modules/acm-auth/infrastructure/ama-token.verifier.spec.ts` |
| 수행 | `npx jest ama-token.verifier` |
| 기대 | 기존 9개 it() 케이스 모두 통과: 정상 / 만료 / 서명변조 / scope 불일치 / appCode 불일치 / claims 누락 / clockTolerance / secret 미설정 503 / multi appCode |
| 실패 시 | 검증 로직 회귀 — 디버깅 후 수정 |

### TC-U-03 — JwtStrategy 충돌 없음

| 항목 | 내용 |
|------|------|
| 목적 | legacy `JwtStrategy`(`presentation/auth/jwt.strategy.ts`) + `AcmJwtStrategy`(`modules/acm-auth/jwt/`) 동시 등록 가능 |
| 수행 | NestJS 부팅 e2e: `npm test -- --testPathPattern=app.module.spec` (혹은 boot 테스트 추가) |
| 기대 | DI 컨테이너 정상 부팅, Passport `defaultStrategy: 'jwt'` 가 하나의 strategy로 resolve됨 |
| 실패 시 | strategy name 명시 (예: `@Strategy('jwt-acm')`) 추가하여 충돌 회피 |

### TC-U-04 — AuthModule providers 정합성

| 항목 | 내용 |
|------|------|
| 목적 | `presentation/auth/auth.module.ts` 수정 후 부팅 가능 |
| 수행 | `Test.createTestingModule({ imports: [AuthModule] }).compile()` (있는 테스트 활용) |
| 기대 | 제거된 provider(`AmaSsoUseCase`, `AmaOidcStateStore`, `AmaOidcServiceRef`) 미참조, compile 성공 |

---

## 3. 통합 테스트 (Backend)

### TC-I-01 — POST /api/acm/auth/ama-exchange 정상

| 항목 | 내용 |
|------|------|
| 목적 | JWT passthrough 정상 흐름 회귀 |
| 전제 | `AMA_JWT_SECRET=<test-secret>`, `AMA_JWT_ALLOWED_APP_CODES=tpi-acm` |
| 입력 | HS256 서명된 유효 JWT (`scope=custom_app:context`, `appCode=tpi-acm`, `exp` 미래) |
| 기대 | `200 OK` + `{ accessToken, user, ... }`, 신규 사용자면 user upsert 발생 |
| 실패 시 | 검증 로직 회귀 — 디버깅 |

### TC-I-02 — 만료/위조 토큰 거절

| 항목 | 내용 |
|------|------|
| 입력 | (a) exp 과거 / (b) 서명 변조 / (c) appCode 화이트리스트 외 |
| 기대 | (a) `AMA_TOKEN_EXPIRED` 401 / (b) `AMA_TOKEN_INVALID_SIGNATURE` 401 / (c) `AMA_TOKEN_APP_CODE_INVALID` 401 |

### TC-I-03 — `AMA_JWT_SECRET` 미설정 503

| 항목 | 내용 |
|------|------|
| 전제 | `AMA_JWT_SECRET=""` |
| 기대 | `503 Service Unavailable` (verifier disabled) |

### TC-I-04 — 제거된 OIDC 라우트 404 (★ 핵심)

| 항목 | 내용 |
|------|------|
| 목적 | dead route 완전 제거 확인 |
| 수행 | GET `/api/auth/ama/login`, GET `/api/auth/ama/callback?code=x&state=y`, POST `/api/auth/ama/logout` |
| 기대 | 3개 모두 **404 Not Found** |
| 실패 시 | 라우터 등록 잔존 — `auth.module.ts` 재확인 |

---

## 4. Webhook 보존 회귀 (필수)

### TC-W-01 — Webhook 서명 검증 정상

| 항목 | 내용 |
|------|------|
| 전제 | `AMA_WEBHOOK_SECRET=<test-secret>` |
| 입력 | `POST /webhooks/ama/subscription` + 유효 HMAC 서명 + `eventType=SUBSCRIPTION_CREATED` |
| 기대 | `200 OK { ok: true, acdId: <number> }` |

### TC-W-02 — 중복 nonce dedup

| 항목 | 내용 |
|------|------|
| 입력 | 동일 nonce로 두 번 호출 |
| 기대 | 2회차 `{ ok: true, deduped: true }` |

### TC-W-03 — 서명 누락/위조

| 항목 | 내용 |
|------|------|
| 기대 | `401 WEBHOOK_*` 에러 |

### TC-W-04 — 6종 이벤트 라우팅

| eventType | 기대 핸들러 |
|-----------|-----------|
| SUBSCRIPTION_CREATED | ProvisioningUseCase |
| SUBSCRIPTION_ACTIVATED | ProvisioningUseCase |
| SUBSCRIPTION_RESUMED | LifecycleUseCase(RESUME) |
| SUBSCRIPTION_SUSPENDED | LifecycleUseCase(SUSPEND) |
| SUBSCRIPTION_CANCELED | LifecycleUseCase(CANCEL) |
| SUBSCRIPTION_DEPROVISIONED | LifecycleUseCase(DEPROVISION) |
| SUBSCRIPTION_PLAN_CHANGED | LifecycleUseCase(PLAN_CHANGED) |

---

## 5. Frontend Smoke (스테이징)

### TC-F-01 — `?ama_token=` 자동 로그인

| 항목 | 내용 |
|------|------|
| 수행 | 스테이징 `https://app-academy-stg.amoeba.site/login?ama_token=<valid-jwt>&locale=en` 접속 |
| 기대 | 자동 로그인 → `/admin/dashboard` (또는 nextStep 분기 화면) 도달, i18n=en 적용 |
| 측정 | 사용자 클릭 0회 |

### TC-F-02 — Break-glass 로그인

| 항목 | 내용 |
|------|------|
| 수행 | `/login` 에서 이메일·PW 입력 (예: `admin@tpi.co.kr`) |
| 기대 | 기존 흐름 정상 — 자체 JWT 발급 후 `/admin` 진입 |

### TC-F-03 — iframe 임베드

| 항목 | 내용 |
|------|------|
| 수행 | AMA 포털에서 학원관리앱을 iframe으로 임베드 |
| 기대 | `frame-ancestors` CSP 통과, 자동 로그인 흐름 정상 |

---

## 6. 환경설정 검증

### TC-E-01 — `.env.example` 정합

| 항목 | 내용 |
|------|------|
| 수행 | `grep -c AMA_OIDC docker/staging/.env.staging.example docker/production/.env.production.example backend/.env.example` |
| 기대 | 모든 파일에서 **0건** (`AMA_OIDC_*` 변수 완전 제거) |

### TC-E-02 — 잔존 변수 확인

| 항목 | 내용 |
|------|------|
| 수행 | grep `AMA_JWT_SECRET`, `AMA_JWT_ALLOWED_APP_CODES`, `AMA_WEBHOOK_SECRET`, `AMA_DEPROVISION_GRACE_DAYS` |
| 기대 | 4종 변수 보존 |

---

## 7. 문서 검증

### TC-D-01 — OIDC 언급 제거

| 항목 | 내용 |
|------|------|
| 수행 | `grep -rni "AMA_OIDC\|OIDC discovery\|authorize url" docs/ backend/README.md` (제외: 본 REQ/PLN/TC 자체) |
| 기대 | 결과 없음, 또는 "OIDC 미사용 확정" 같은 단방향 표현만 잔존 |

### TC-D-02 — 인증 흐름 다이어그램 갱신

| 항목 | 내용 |
|------|------|
| 수행 | `backend/README.md` 의 인증 다이어그램이 단일 흐름(`ama_token → /api/acm/auth/ama-exchange → JWT`)을 표현하는지 시각 확인 |

---

## 8. 코드 정적 검증

### TC-S-01 — 잔존 OIDC 식별자 grep

| 항목 | 내용 |
|------|------|
| 수행 | `grep -rn "AmaOidcService\|AmaOidcStateStore\|AmaOidcServiceRef\|AmaSsoUseCase\|AmaAuthModule\|AmaAuthController" backend/src` |
| 기대 | 결과 0건 |

### TC-S-02 — PKCE/state util 잔존 없음

| 항목 | 내용 |
|------|------|
| 수행 | `grep -rn "generatePkceVerifier\|deriveCodeChallenge\|generateState" backend/src` |
| 기대 | 결과 0건 |

---

## 9. 배포 검증

### TC-DEP-01 — 스테이징 배포 후 라우트 확인

| 항목 | 내용 |
|------|------|
| 수행 | `curl -i https://app-academy-stg.amoeba.site/api/auth/ama/login` |
| 기대 | `HTTP 404` |

### TC-DEP-02 — 스테이징 헬스체크 + 인증

| 항목 | 내용 |
|------|------|
| 수행 | `curl -i -X POST .../api/acm/auth/ama-exchange -d '{"amaToken":"<dummy>"}'` |
| 기대 | `HTTP 401` (dummy 토큰), 단 503 (시크릿 미설정)이 아니어야 함 |

### TC-DEP-03 — Webhook 헬스체크

| 항목 | 내용 |
|------|------|
| 수행 | (운영팀과 협조) AMA 테스트 페이로드 1건 전송 |
| 기대 | `subscription_events` 테이블에 행 1개 INSERT 확인 |

---

## 10. 합격 기준

다음 모두 만족 시 합격:

- ☐ TC-U-01 ~ TC-U-04 (단위) 전체 통과
- ☐ TC-I-01 ~ TC-I-04 (통합) 전체 통과
- ☐ TC-W-01 ~ TC-W-04 (Webhook) 전체 통과
- ☐ TC-F-01 ~ TC-F-03 (Frontend smoke) 전체 통과
- ☐ TC-E-01 ~ TC-E-02 (환경) 전체 통과
- ☐ TC-D-01 ~ TC-D-02 (문서) 전체 통과
- ☐ TC-S-01 ~ TC-S-02 (정적 검증) 전체 통과
- ☐ TC-DEP-01 ~ TC-DEP-03 (스테이징 배포) 전체 통과

위 합격 후 → `docs/test/TR-260525-app-academy-ama-jwt-단일화.md` 작성 → `docs/implementation/RPT-260525-app-academy-ama-jwt-단일화.md` 작성 → 프로덕션 PR.
