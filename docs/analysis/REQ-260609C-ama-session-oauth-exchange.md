---
document_id: REQ-260609C-ama-session-oauth-exchange
version: 1.0.0
status: DRAFT-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/reference/MANUAL-260609-외부앱-ama-session-연동.md
  - docs/analysis/REQ-260609B-ama-integration-config.md
  - docs/analysis/REQ-260609-ama-tpi-sso-client-sync.md
  - backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts
  - backend/src/modules/acm-auth/application/acm-auth.service.ts
change_log:
  - 2026-06-09 v1.0.0 초안 — 로컬 HS256 검증(AMA_JWT_SECRET) → AMA OAuth ama_session grant 교환 + introspect(Option C)로 전환. MANUAL-260609 기준.
  - 2026-06-09 v1.0.1 결정 확정 — D-1: 게이트는 **entityId만 비교**, appCode는 게이트에서 제외(필드는 정보성으로 보존, client_id 교차검증도 비채택). D-2: 디렉터리/구독 호출 인증 기존 유지. D-3: 기존 FE 계약 유지. D-4: 모드 토글 단계 컷오버. 실현가능성 확인 — introspect 미제공 email/name/level/jobRole은 기존 멤버십 조회(AmaPlatformUser)로 보완.
---

# REQ-260609C — AMA `ama_session` OAuth 교환 + introspect 로그인 검증 (Requirements Analysis)

## 1. Overview (개요)

현재 AMA SSO 로그인은 ACM이 `?ama_token`(HS256 JWT)을 **로컬에서 `AMA_JWT_SECRET`으로 직접 서명 검증**한다. 운영에서 이 secret이 AMA 서명 secret과 불일치하여 **`AMA_TOKEN_INVALID_SIGNATURE`(401)** 로 전 로그인이 실패 중이다.

본 요구사항은 [MANUAL-260609](../reference/MANUAL-260609-외부앱-ama-session-연동.md)의 **Option C**를 채택한다 — ACM은 ama_token을 **직접 검증하지 않고** AMA OAuth 게이트웨이에 위임한다:

1. `POST {gateway}/oauth/token` (`grant_type=ama_session`) 으로 ama_token → OAuth `access_token` 교환 (AMA가 서명·유효·사용자상태 검증 대행)
2. `POST {gateway}/oauth/introspect` 로 access_token → `{active, sub, ent_id, scope, client_id}` 컨텍스트 조회

→ 공유 서명 비밀(`AMA_JWT_SECRET`)이 불필요해져 **`INVALID_SIGNATURE` 근본 원인이 제거**된다.

## 2. Current State & Problem (현행과 문제)

- FE: `/admin/login` 진입 시 `?ama_token` 추출 → `POST /api/acm/auth/ama-exchange {amaToken}` ([login-page.tsx](../../frontend-acm/src/modules/auth/pages/login-page.tsx), [auth-api.ts](../../frontend-acm/src/modules/auth/api/auth-api.ts))
- BE: `AmaTokenVerifier.verify()` 가 `jwt.verify(token, AMA_JWT_SECRET, {HS256})` 로컬 검증 → 실패 시 401. ([ama-token.verifier.ts](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts))
- 검증 성공 후 파이프라인: entityId/appCode 게이트(REQ-260609B) → 구독체크 → 멤버십/디렉터리 → 역할매핑 → upsert → ACM JWT 발급
- **문제**: 운영 `AMA_JWT_SECRET` ≠ AMA 서명 secret → `AMA_TOKEN_INVALID_SIGNATURE` 401 (2026-06-09 확인). secret 보유 자체가 보안 부담이기도 함.

## 3. Target Flow (목표 흐름 — Option C)

```
?ama_token (FE) → POST /api/acm/auth/ama-exchange {amaToken}  (FE↔BE 계약 유지)
   │
   ① BE: POST {AMA_GATEWAY_URL}/oauth/token
        grant_type=ama_session, ama_token, client_id, client_secret, scope=app_store:context
        → { success, data:{ access_token, expires_in, scope } }
   │
   ② BE: POST {AMA_GATEWAY_URL}/oauth/introspect  (Basic client_id:secret, token=access_token)
        → { success, data:{ active, sub, ent_id, scope, client_id, exp, iat } }
        active=false | sub|ent_id 누락 → 401
   │
   ③ TPI 게이트 — ent_id 가 /admin/config 등록값과 일치하는지 (REQ-260609B, entityId 유지)
   ④ 구독 체크 (기존)
   ⑤ 멤버십/디렉터리 조회 (entityId+sub) → email·name·level·jobRole 확보 (기존)
   ⑥ 역할 매핑 → amb_acm_user upsert → ACM JWT 발급 (기존)
```

**핵심**: introspect는 `email·name·role(level)·jobRole·appCode`를 **반환하지 않는다**. 이 값들은 **이미 존재하는 디렉터리/멤버십 조회**([AmaPlatformHttpClient](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.ts), key=entityId+userId)로 확보하므로 ③~⑥ 파이프라인은 그대로 유지된다.

## 4. Functional Requirements (기능 요구사항)

### FR-1. OAuth 토큰 교환
- **FR-1.1**: `POST {AMA_GATEWAY_URL}/oauth/token`, body `application/x-www-form-urlencoded`: `grant_type=ama_session`, `ama_token`, `client_id`, `client_secret`, `scope=app_store:context`.
- **FR-1.2**: 응답 `{success, data:{access_token, expires_in, scope}}` 파싱. `success=false`/비2xx → 에러 매핑(FR-4).

### FR-2. Introspect 컨텍스트 조회
- **FR-2.1**: `POST {AMA_GATEWAY_URL}/oauth/introspect`, `Authorization: Basic base64(client_id:client_secret)`, body `token=<access_token>`.
- **FR-2.2**: 응답 `{active, sub, ent_id, scope, client_id, exp, iat}`. `active!==true || !sub || !ent_id` → **401**.
- **FR-2.3**: introspect 결과 **60초 메모리 캐시**(동일 access_token) 권장.

### FR-3. TPI 인가 게이트 (REQ-260609B 연속)
- **FR-3.1**: introspect `ent_id` 가 `/admin/config`(`amb_acm_ama_config`)의 등록 entityId(active)와 일치할 때만 허용. 불일치/미설정 → **403 ENTITY_NOT_ALLOWED**.
- **FR-3.2**: **appCode 비교 재정의** — 토큰이 더 이상 appCode를 자체 보고하지 않음. 앱 정체성은 우리가 교환에 사용하는 `client_id/secret`로 이미 결속됨. introspect `client_id`를 우리 `AMA_CLIENT_ID`와 교차 검증(불일치 → 거부). `/admin/config`의 appCode 필드 처리는 **결정 D-1** 참조.

### FR-4. 에러 매핑 (MANUAL §4·§6 기준)
| AMA 응답 | ACM 처리 |
|----------|----------|
| `invalid_ama_token` (만료/변조/INACTIVE) | 401 `AMA_TOKEN_INVALID` |
| `invalid_scope` | 403 `AMA_SCOPE_INVALID` |
| `user_inactive` | 403 `USER_INACTIVE` |
| `invalid_client` (client_id/secret 오류) | 500 + 로그 `invalid_client` (설정 오류) |
| network/timeout/5xx | 503 `AMA_UNAVAILABLE` (fail-closed, 기존 멤버십 가드 패턴) |

### FR-5. 환경 변수
- **신규**: `AMA_GATEWAY_URL`(예 `https://api.amoeba.site`), `AMA_CLIENT_ID`(`pap_...`), `AMA_CLIENT_SECRET`.
- **제거**: `AMA_JWT_SECRET`, `AMA_JWT_ALLOWED_APP_CODES`(무의미해짐).
- **검증 모드 토글**: `AMA_TOKEN_VERIFY_MODE = local | ama_session` (안전한 단계적 컷오버 + 롤백).
- mock/http: 기존 `AMA_SERVICES_MODE` 토글에 OAuth 클라이언트 mock 추가(로컬/테스트 유지).

### FR-6. FE 계약 유지
- FE↔BE 계약(`POST /api/acm/auth/ama-exchange {amaToken}`)은 **변경 없음** — 2단계 OAuth는 백엔드 내부에서 처리. FE의 `?ama_token` URL 정리(FR-AMA-52)도 유지. (MANUAL의 `/auth/ama-callback` GET 리다이렉트 방식은 **미채택** — 결정 D-3)

## 5. Impact (기존 구성요소 영향)

| 구성요소 | 영향 |
|----------|------|
| `AmaTokenVerifier` (로컬 HS256) | `ama_session` 모드에서 미사용. 신규 `AmaSessionExchanger`(token+introspect)로 대체. 모드 토글로 공존. |
| REQ-260609B `/admin/config` 게이트 | **유지·연속**. entityId 비교는 introspect `ent_id`로 그대로. appCode 필드는 D-1로 조정. 내 직전 작업 **폐기 아님**. |
| 구독/멤버십/디렉터리 호출 | **유지**. email/name/level/jobRole 출처로 계속 사용(introspect가 미제공). 호출 인증은 D-2 참조. |
| `EntityGateService`(env/MySQL) | 이미 superseded. 변화 없음. |
| 통합 테스트 | exchange/introspect mock 기반으로 재작성 필요. |

## 6. Non-Functional (비기능)
- **NFR-1 fail-closed**: AMA OAuth 5xx/timeout → 503 차단(우회 금지). 기존 패턴 재사용.
- **NFR-2 보안**: `AMA_CLIENT_SECRET` env 전용, 로그/브라우저 노출 금지(마스킹). HTTPS 강제. ama_token URL 노출 최소화(즉시 교환 + history 정리).
- **NFR-3 성능**: 로그인당 OAuth 2회 호출. 현행도 구독/멤버십 live 호출이 있어 일관. timeout(기존 3s) + introspect 60s 캐시.
- **NFR-4 멀티테넌시**: ent_id 스코프 유지.
- **NFR-5 i18n**: 신규 사용자 대면 에러 메시지 4 locale.

## 7. Out of Scope (범위 외)
- `/oauth/revoke` 연동(선택), 로그아웃 시 AMA 토큰 폐기.
- 디렉터리/구독 호출을 OAuth access_token Bearer로 전면 이관(별건 — D-2).
- AMA 측 PartnerApp 등록·scope 부여(운영 협조 사항).

## 8. Open Items / Decisions (결정·확인 필요)

| # | 항목 | 기본 권장안 |
|---|------|-------------|
| **D-1** | `/admin/config`의 appCode 필드 처리 | introspect는 appCode 미제공. 권장: **entityId 게이트 유지** + introspect `client_id`를 `AMA_CLIENT_ID`와 교차검증(env 기반). admin appCode 필드는 표시용/`client_id` 저장용으로 전환하거나 게이트에서 제외. |
| **D-2** | 디렉터리/구독/멤버십 호출 인증 | 권장: 기존 `AMA_PLATFORM_SERVICE_TOKEN`/`AMA_API_KEY` 유지(블래스트 반경 최소). 추후 OAuth access_token으로 통합 검토. |
| **D-3** | 진입 방식 | 권장: 기존 FE `POST /api/acm/auth/ama-exchange` 계약 유지(백엔드 내부 2단계). MANUAL의 `/auth/ama-callback` GET+cookie 방식 미채택(ACM은 ACM JWT 세션 사용). |
| **D-4** | 컷오버 | 권장: `AMA_TOKEN_VERIFY_MODE` 토글로 staging 검증 후 운영 전환, 안정화 뒤 `local` 경로·`AMA_JWT_SECRET` 제거. |
| **O-1** | AMA 계약 확인 | `/oauth/token`·`/oauth/introspect` 응답 envelope(`{success,data}`), `ent_id` 포맷(UUID, /admin/config 저장값과 동일?), scope 명칭(`app_store:context`), gateway 호스트(`api.amoeba.site`)와 기존 `AMA_PLATFORM_BASE_URL` 관계. |

## 9. Acceptance Criteria (인수 기준)
1. 정상 진입(AMA 로그인→사이드바 클릭) → 200, ACM JWT 발급, `amb_acm_user` upsert. (현재 401 해소)
2. 만료/변조 ama_token → 401, 사용자에 재진입 안내.
3. introspect `ent_id` ≠ `/admin/config` 등록값 → 403 ENTITY_NOT_ALLOWED.
4. AMA OAuth 장애(5xx/timeout) → 503 AMA_UNAVAILABLE.
5. `AMA_JWT_SECRET` 제거 후에도 로그인 정상(로컬 검증 비의존 입증).
6. 레거시 email/password 로그인(`/api/acm/auth/login`) 무영향.
7. 신규 에러 메시지 4 locale.
