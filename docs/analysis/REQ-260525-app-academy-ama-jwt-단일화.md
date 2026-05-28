---
document_id: REQ-260525-app-academy-ama-jwt-단일화
version: 1.0.0
status: Draft
created: 2026-05-25
author: 김익용 (Gray)
related:
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md          # AMA SSO 기존 요구사항
  - backend/src/modules/acm-auth/**                  # 유지·강화 대상
  - backend/src/infrastructure/external/ama/auth/**  # 제거 대상 (OIDC)
  - backend/src/application/auth/ama-sso.use-case.ts # 제거 대상
  - backend/src/presentation/auth/ama-auth.controller.ts # 제거 대상
  - backend/src/presentation/auth/ama-oidc-state.store.ts # 제거 대상
  - backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts # 유지
  - docker/staging/.env.staging.example
  - docker/production/.env.production.example
---

# app-academy × AMA 인증 단일화 — JWT Passthrough + Webhook 보존

## 1. 요구사항 요약

| # | 요구사항 | 유형 |
|---|---------|------|
| R-1 | AMA 인증 채널을 **HS256 JWT passthrough 단일 경로**로 통일한다 | 기능/구조 |
| R-2 | 사용 중이지 않은 **OIDC 인가코드 흐름 코드·환경변수**를 모두 제거한다 | 리팩토링 |
| R-3 | **구독 이벤트 Webhook(`/webhooks/ama/subscription`)은 유지**한다 | 보존 |
| R-4 | 다른 앱(platform / app-car-manager)과 **동일한 인증 패턴**(JWT 검증·`@Auth()`·`ent_id` 격리)을 따른다 | 표준화 |
| R-5 | 기존 이메일/비밀번호 break-glass 로그인은 **100% 호환 유지** | 비파괴 |
| R-6 | `.env` 변수 사용 가이드와 문서를 정리한다 (제거된 변수 명시) | 문서 |
| R-7 | 단위 테스트로 JWT 검증·webhook 서명·플로우 회귀를 보장한다 | 테스트 |

---

## 2. AS-IS 현황 분석

### 2.1 인증 채널이 3개로 분기되어 있음

| # | 채널 | 활성 상태 | 사용 파일 |
|---|------|----------|----------|
| ① | **HS256 JWT passthrough** (실사용) | ✅ Active | `backend/src/modules/acm-auth/` 전체<br>- `infrastructure/ama-token.verifier.ts` (검증 로직)<br>- `presentation/acm-auth.controller.ts` `POST /api/acm/auth/ama-exchange`<br>- `application/acm-auth.service.ts`<br>- `frontend-acm/src/modules/auth/api/auth-api.ts:31` |
| ② | **OIDC Authorization Code Flow** (dead/mock) | ⛔ Mock-only, 미연결 | `backend/src/infrastructure/external/ama/auth/`<br>- `ama-oidc.service.ts` (HTTP 클라이언트)<br>- `ama-oidc-mock.service.ts`<br>- `ama-auth.module.ts` (`AMA_OIDC_MODE=mock` 기본)<br>- `interfaces/ama-oidc.interface.ts`<br>- `ama-pkce.util.ts`<br>- `backend/src/application/auth/ama-sso.use-case.ts`<br>- `backend/src/presentation/auth/ama-auth.controller.ts` `/api/auth/ama/login`, `/callback`, `/logout`<br>- `backend/src/presentation/auth/ama-oidc-state.store.ts` |
| ③ | **Subscription Webhook** (보존 대상) | ✅ Active | `backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts`<br>- `backend/src/application/subscription/{provisioning,lifecycle}.use-case.ts`<br>- `backend/src/application/subscription/tenant-deprovision.cron.ts`<br>- `backend/src/infrastructure/external/ama/webhook/ama-webhook-signature.util.ts` |

### 2.2 환경변수 혼재

`docker/staging/.env.staging.example` 기준:

```
# OIDC 그룹 (사용되지 않음 — 제거 대상)
AMA_OIDC_MODE=mock
AMA_OIDC_ISSUER=https://amoeba.site/oidc
AMA_OIDC_CLIENT_ID=
AMA_OIDC_CLIENT_SECRET=
AMA_OIDC_REDIRECT_URI=https://app-academy-stg.amoeba.site/api/auth/ama/callback

# JWT 그룹 (유지)
AMA_JWT_SECRET=
AMA_JWT_ALLOWED_APP_CODES=tpi-acm

# Webhook 그룹 (유지)
AMA_WEBHOOK_SECRET=REPLACE_ME_WEBHOOK_SECRET
AMA_DEPROVISION_GRACE_DAYS=90
```

### 2.3 문서·코드 정합성 불일치

- `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md` §1.2: "AMA가 OIDC 대신 short-lived HS256 JWT injection 방식을 채택"으로 명시
- 그러나 OIDC 컨트롤러(`/api/auth/ama/login`)는 여전히 라우팅 활성화 → 외부에 노출된 dead endpoint
- 신규 개발자가 두 경로 중 어느 쪽을 따라야 할지 혼동

### 2.4 문제점 요약

| # | 문제 | 영향 |
|---|------|------|
| P-1 | 사용되지 않는 OIDC 코드·라우트가 운영 인프라에 노출됨 | 보안 표면적, 유지보수 비용 |
| P-2 | 환경변수 5종(`AMA_OIDC_*`)이 빈 값 또는 mock 으로 운영 중 | 설정 노이즈, 오설정 위험 |
| P-3 | 같은 도메인(인증)에 두 모듈(`acm-auth/`, `auth/`) 공존 | DDD 위반, 의존성 그래프 복잡화 |
| P-4 | 다른 앱과 인증 패턴 분기 (공통 라이브러리 부재) | 표준화 불가, 학습 비용 ↑ |

---

## 3. TO-BE 요구사항

### 3.1 채널 정리 (단일화)

| 채널 | 결정 | 근거 |
|------|------|------|
| **JWT Passthrough** | ✅ **유일한 인증 경로** | AMA 측 실제 발급 방식, 이미 구현 완료 |
| **OIDC Authorization Code Flow** | ❌ **전부 제거** | AMA 미지원, mock-only, dead code |
| **Subscription Webhook** | ✅ **유지** | 구독 종료/플랜 변경 실시간 반영 필수 |

### 3.2 AS-IS → TO-BE 매핑

| 영역 | AS-IS | TO-BE |
|------|-------|-------|
| 인증 엔드포인트 | `POST /api/acm/auth/ama-exchange`<br>`GET /api/auth/ama/login`<br>`GET /api/auth/ama/callback`<br>`POST /api/auth/ama/logout` | `POST /api/acm/auth/ama-exchange` (유일)<br>break-glass `POST /api/acm/auth/login` (이메일/PW) 유지 |
| 백엔드 모듈 | `modules/acm-auth/` + `application/auth/` + `presentation/auth/` + `infrastructure/external/ama/auth/` | `modules/acm-auth/` 단일 (나머지 제거) |
| 환경변수 | `AMA_JWT_*` 2종 + `AMA_OIDC_*` 5종 + `AMA_WEBHOOK_*` 2종 | `AMA_JWT_*` 2종 + `AMA_WEBHOOK_*` 2종 (OIDC 전부 제거) |
| 모듈 의존성 | `AmaAuthModule`(OIDC) ↔ `AcmAuthModule`(JWT) 둘 다 등록 | `AcmAuthModule`만 등록 (`AmaAuthModule` 제거) |
| 프론트엔드 진입점 | `?ama_token=` 자동 교환 (현재 정상 동작) | 동일 (변경 없음) |

### 3.3 비즈니스 로직 (변경 없음 영역)

- 사용자 자동 프로비저닝 로직 (`AcmAuthService` 내 upsert): 기존 유지
- `ent_id`(=AMA `entityId`) 기반 멀티테넌시 격리: 기존 유지
- `appCode` 화이트리스트(`tpi-acm`): 기존 유지
- Webhook 6종 이벤트 처리(`SUBSCRIPTION_CREATED` 등): 기존 유지

### 3.4 UI 설계 (변경 없음)

- `/login` 페이지 `ama_token` 쿼리 자동 교환 흐름: 변경 없음
- iframe 임베드(CSP `frame-ancestors`): 변경 없음
- `locale=en` 등 i18n 진입 쿼리: 변경 없음

---

## 4. 갭 분석

### 4.1 변경 범위 요약

| 영역 | 현재 | 변경 | 영향도 |
|------|------|------|--------|
| Backend 모듈 | 3중 인증 경로 | 1개 단일 경로 | **High** (dead code 제거, AppModule 의존성 정리) |
| 환경변수 | 9종(AMA_*) | 4종 | Medium (.env 갱신 필요) |
| API 라우트 | `/api/auth/ama/*` 3개 + `/api/acm/auth/ama-exchange` 1개 | `/api/acm/auth/ama-exchange` 1개 | Medium (외부 호출자 없음 — internal/mock only) |
| 프론트엔드 | `/acm/auth/ama-exchange` 호출 | 동일 | None |
| Webhook | 정상 동작 | 정상 동작 (변경 없음) | None |
| 문서 | OIDC 잔존 흔적 | OIDC 언급 제거·갱신 | Low |

### 4.2 변경 파일 목록

#### 제거 대상 (Backend)

| 파일 | 변경유형 |
|------|---------|
| `backend/src/infrastructure/external/ama/auth/ama-oidc.service.ts` | 삭제 |
| `backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.ts` | 삭제 |
| `backend/src/infrastructure/external/ama/auth/ama-auth.module.ts` | 삭제 |
| `backend/src/infrastructure/external/ama/auth/interfaces/ama-oidc.interface.ts` | 삭제 |
| `backend/src/infrastructure/external/ama/auth/ama-pkce.util.ts` | 삭제 |
| `backend/src/infrastructure/external/ama/auth/ama-pkce.util.spec.ts` (있다면) | 삭제 |
| `backend/src/application/auth/ama-sso.use-case.ts` | 삭제 |
| `backend/src/application/auth/ama-sso.use-case.spec.ts` | 삭제 |
| `backend/src/presentation/auth/ama-auth.controller.ts` | 삭제 |
| `backend/src/presentation/auth/ama-oidc-state.store.ts` | 삭제 |
| `backend/src/presentation/auth/ama-oidc-state.store.spec.ts` | 삭제 |

#### 수정 대상

| 파일 | 변경유형 | 변경 내용 |
|------|---------|----------|
| `backend/src/app.module.ts` (또는 동등 모듈 진입점) | 수정 | `AmaAuthModule` import 제거 / `AmaAuthController` providers 제거 |
| `docker/staging/.env.staging.example` | 수정 | `AMA_OIDC_*` 5종 라인 삭제 |
| `docker/production/.env.production.example` | 수정 | `AMA_OIDC_*` 3종 라인 삭제 |
| `backend/.env.example` (있다면) | 수정 | 동일 |
| `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md` | 수정 | §1.2 "OIDC 대안 채택" 표현 → "OIDC 미사용 확정" 변경, related 링크 갱신 |
| `docs/integration/ama-platform-spec-asks.md` | 수정 | A-2 OIDC discovery 항목 → resolved/closed 마킹 |
| `docs/deployment/RUNBOOK.md` | 수정 | OIDC 관련 트러블슈팅 단락 제거 |
| `backend/README.md` | 수정 | 인증 흐름 다이어그램 갱신 |

#### 보존 대상 (변경 없음)

- `backend/src/modules/acm-auth/**` (전체)
- `backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts`
- `backend/src/application/subscription/**`
- `backend/src/infrastructure/external/ama/webhook/**`
- `frontend-acm/src/modules/auth/**`

### 4.3 DB 마이그레이션

**없음**. 본 작업은 코드·환경설정 정리 위주이며 DB 스키마 변경 없음.

### 4.4 외부 영향

- AMA 측 OIDC `client_id`/`client_secret` 발급 요청 **취소** 가능 (이미 mock 단계라 실발급되지 않았을 가능성 높음)
- 다른 앱 / 외부 시스템에서 `/api/auth/ama/*` 호출 흔적: **없음** (코드 grep 결과 0건)

---

## 5. 사용자 플로우

### 5.1 정상 진입 (변경 없음)

```
[AMA 포털 — 학원관리앱 클릭]
        │
        │ Browser navigation
        ▼
[ACM https://app-academy-stg.amoeba.site/login?ama_token=<JWT>&locale=en]
        │
        │ Frontend: ama_token 감지
        ▼
[POST /api/acm/auth/ama-exchange  body={amaToken}]
        │
        │ Backend: AmaTokenVerifier.verify()
        │   - HS256 서명 (AMA_JWT_SECRET)
        │   - exp / iat (clock skew 30s)
        │   - scope == 'custom_app:context'
        │   - appCode ∈ AMA_JWT_ALLOWED_APP_CODES
        ▼
[AcmAuthService — user upsert (ama_user_id, entityId→ent_id)]
        │
        │ JWT 발급 (자체 24h)
        ▼
[Frontend: 토큰 저장 → /admin/dashboard 리다이렉트]
```

### 5.2 Break-glass 진입 (변경 없음)

```
[/login 페이지 직접 접속]
        │
        ▼
[email + password 입력 → POST /api/acm/auth/login]
        │
        ▼
[기존 PW 검증 → 자체 JWT 발급 → /admin]
```

### 5.3 Webhook 흐름 (변경 없음)

```
[AMA 플랫폼 — 구독 상태 변경]
        │
        │ HTTPS POST + HMAC 서명
        ▼
[POST /webhooks/ama/subscription
   Headers: x-ama-signature, x-ama-timestamp, x-ama-nonce]
        │
        │ verifyAmaWebhook(AMA_WEBHOOK_SECRET)
        │ + nonce dedup (subscription_events.sub_nonce UNIQUE)
        ▼
[eventType → ProvisioningUseCase | LifecycleUseCase]
        │
        ▼
[academies / user-academies 상태 갱신]
```

### 5.4 조건별 분기

| 조건 | 결과 |
|------|------|
| AS-IS `/api/auth/ama/login` 호출 (외부에서) | TO-BE에서 **404** 응답 (라우트 제거) |
| AS-IS `/api/auth/ama/callback?code=...` 호출 | TO-BE에서 **404** |
| `AMA_OIDC_*` env 변수가 잔존 설정 | 무시 (코드 미참조), 단 `.env.example`에서는 제거 |
| `AMA_JWT_SECRET` 미설정 | 503 — `AMA SSO is not configured` (기존 동작 유지) |
| `AMA_WEBHOOK_SECRET` 미설정 | 401 — `WEBHOOK_NOT_CONFIGURED` (기존 동작 유지) |

---

## 6. 기술 제약사항

### 6.1 호환성

- **외부 노출 라우트 단절**: `/api/auth/ama/login`·`/callback`·`/logout` 제거 시 외부 호출자가 있는지 사전 확인 필요. 현재 grep 결과 **호출자 없음**.
- **NestJS 모듈 그래프**: `AmaAuthModule` 제거 시 다른 모듈의 `imports` 배열에서도 함께 제거. `JwtModule`은 `AcmAuthModule`에서 자체 등록되므로 영향 없음.
- **테스트 디렉터리**: 제거 파일에 대한 `.spec.ts` 동시 제거 — Jest config에 path 잔존 시 빌드 깨짐 주의.

### 6.2 성능

- **영향 없음**: 부팅 시점 모듈 수 감소 → 미세한 성능 개선만 기대.

### 6.3 보안

| 항목 | 현재 | TO-BE |
|------|------|-------|
| JWT 알고리즘 | HS256 (대칭키) | 동일 — 단, 추후 RS256+JWKS 전환을 별도 Spec Ask로 추적 |
| `AMA_JWT_SECRET` 최소 길이 | 16자 | 동일 (코드 강제) |
| Clock skew 허용 | 30초 | 동일 |
| Webhook 서명 | HMAC-SHA256 + nonce dedup | 동일 |
| Dead OIDC endpoint 노출 | ⚠️ 라우트 활성 (mock) | ✅ 완전 제거 |
| `client_secret` 관리 부담 | 5종 변수 | 0종 (제거) |

### 6.4 운영

- **롤백 전략**: 단일 커밋 또는 단일 PR로 묶어 `git revert` 한 번에 복원 가능하도록 작업.
- **배포 순서**: `.env.example` 갱신 → 코드 제거 → 스테이징 배포 → 검증 → 프로덕션 PR.
- **모니터링**: 배포 직후 `/api/auth/ama/login` 404 로그가 발생하는지 확인 → 발생 시 외부 호출자 추적.

### 6.5 비범위 (Non-goals)

- N-1: AMA 측 OIDC IdP 신규 구축 (장기 과제, 별도 REQ)
- N-2: HS256 → RS256+JWKS 전환 (Spec Ask 별도 등록)
- N-3: Webhook 페이로드 스키마 변경
- N-4: Break-glass 로그인 폼 UX 변경
- N-5: 프론트엔드 코드 변경 (이미 `/acm/auth/ama-exchange` 호출 중)

---

## 7. 승인 게이트

본 분석서는 **DRAFT** 상태이며, 다음 산출물 진행 전 사용자 확인 필요:

1. ☐ 본 요구사항분석서 검토 완료
2. ☐ 작업계획서(PLN) 작성 → 검토
3. ☐ 테스트케이스(TC) 작성 → 검토
4. ☐ **사용자 명시적 진행 지시** ("구현해", "진행해" 등) → 구현 단계 진입

---

## 부록 A. 결정 요약 표

| 결정 | 채택 | 거절 |
|------|------|------|
| 인증 방식 | HS256 JWT passthrough | OIDC Authorization Code Flow |
| Webhook | 유지 | 제거 |
| Break-glass 로그인 | 유지 | 제거 |
| 환경변수 | `AMA_JWT_*` + `AMA_WEBHOOK_*` | `AMA_OIDC_*` |
| 모듈 구조 | `modules/acm-auth/` 단일 | `application/auth/` + `presentation/auth/` + `infrastructure/external/ama/auth/` |
