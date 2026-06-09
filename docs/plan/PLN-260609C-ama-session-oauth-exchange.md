---
document_id: PLN-260609C-ama-session-oauth-exchange
version: 1.0.0
status: DRAFT-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/analysis/REQ-260609C-ama-session-oauth-exchange.md
  - docs/reference/MANUAL-260609-외부앱-ama-session-연동.md
change_log:
  - 2026-06-09 v1.0.0 초안 — 작업 계획 + 태스크 분해 (결정 D-1~D-4 반영)
---

# PLN-260609C — AMA `ama_session` OAuth 교환 + introspect 구현 계획 (Work Plan)

## 1. Approach (접근)

로컬 HS256 검증을 **AMA OAuth 2단계(token 교환 → introspect)** 로 대체한다. 기존 `AmaTokenVerifier`는 보존하고, `AMA_TOKEN_VERIFY_MODE` 토글로 신규 `AmaSessionExchanger`와 공존시켜 staging 검증 후 무중단 컷오버한다. introspect가 미제공하는 email/name/role/jobRole은 **기존 멤버십 조회(`AmaPlatformUser`)** 로 보완하므로 게이트·역할매핑·upsert 파이프라인은 유지된다.

확정 결정:
- **D-1**: 로그인 게이트는 **introspect `ent_id` ↔ `/admin/config` 등록 entityId** 만 비교. appCode는 게이트에서 제외(컬럼·UI는 정보성으로 보존, NOT NULL 유지 → 무(無)마이그레이션).
- **D-2**: 디렉터리/구독/멤버십 호출 인증은 기존(`AMA_PLATFORM_SERVICE_TOKEN` 등) 유지.
- **D-3**: FE↔BE 계약 `POST /api/acm/auth/ama-exchange {amaToken}` 유지. 2단계 OAuth는 백엔드 내부.
- **D-4**: `AMA_TOKEN_VERIFY_MODE = local | ama_session` 토글, staging→prod 단계 전환.

## 2. Component Design (구성)

```
exchangeAmaToken(amaToken)                       [AcmAuthService — 분기]
  ├ mode=local       → AmaTokenVerifier.verify()          (기존)
  └ mode=ama_session → AmaSessionExchanger.verify()       (신규)
        ① POST {AMA_GATEWAY_URL}/oauth/token  (grant_type=ama_session …) → access_token
        ② POST {AMA_GATEWAY_URL}/oauth/introspect (Basic) → {active, sub, ent_id, scope, client_id}
        ③ active=false|!sub|!ent_id → 401
        → returns AmaTokenPayload-호환 {sub, entityId, scope, appCode:client_id, email:'', role:'UNKNOWN', jobRole:null,…}
  ↓ (공통 파이프라인, 변경 최소)
  ③ amaConfigGate.ensureAllowed(entityId)        [appCode 인자 제거 — D-1]
  ④ subscriptionCheck.ensureActive(entityId)     (기존)
  ⑤ membershipGuard.ensureMember(entityId, sub)  → email·name·level·jobRole (기존)
  ⑥ role 매핑 → upsert (email/name 은 member 우선) → ACM JWT
```

신규 클라이언트는 기존 outbound 패턴(`AMA_SERVICES_MODE` mock/http 토글, timeout, fail-closed 503) 재사용.

## 3. Task Breakdown (태스크 분해)

| # | Task | 파일(신규/수정) |
|---|------|----------------|
| **T1** | OAuth 클라이언트 인터페이스 + http/mock 구현 (`/oauth/token`, `/oauth/introspect`, Basic 인증, envelope 파싱, timeout) | `infrastructure/ama-oauth.client.ts`(+ http/mock), provider 토글 |
| **T2** | `AmaSessionExchanger` — token 교환→introspect→검증→`AmaTokenPayload` 매핑, introspect 60s 캐시, 에러 매핑(FR-4) | `infrastructure/ama-session.exchanger.ts` |
| **T3** | `AcmAuthService.exchangeAmaToken` 모드 분기(`AMA_TOKEN_VERIFY_MODE`); upsert에서 email/name 은 member 우선(payload 공백 시) | `application/acm-auth.service.ts` |
| **T4** | 게이트 appCode 제거 — `AmaConfigGateService.ensureAllowed(entityId)` 시그니처 변경(appCode 인자 삭제), 호출부 수정 | `application/ama-config-gate.service.ts`, `acm-auth.service.ts`, spec |
| **T5** | 에러 코드/HTTP 매핑(invalid_ama_token→401, invalid_scope→403, user_inactive→403, invalid_client→500, 5xx→503) + i18n 메시지 | service + `frontend-acm` locales(4) |
| **T6** | env: `AMA_GATEWAY_URL`/`AMA_CLIENT_ID`/`AMA_CLIENT_SECRET`/`AMA_TOKEN_VERIFY_MODE` 추가, `.env.example` 갱신, 배포 secret 문서 반영. `AMA_JWT_SECRET` 제거는 컷오버 후 별도 단계 | `.env.example`, `docs/deployment/*` |
| **T7** | 모듈 와이어링(acm-auth.module: exchanger + oauth client provider) | `acm-auth.module.ts` |
| **T8** | 테스트 — exchanger 단위(mock token/introspect: 정상/만료/변조/invalid_client/5xx), 게이트 spec(appCode 제거), 통합 setup 모드 토글 | spec 파일들 |
| **T9** | `/admin/config` UI — appCode 필드를 정보성(라벨/도움말)으로 조정, 게이트 비사용 명시 | `cfg/pages/ama-config-page.tsx`, locales |
| **T10** | 검증 — staging에서 `ama_session` 모드 실토큰 로그인(401 해소 확인), 회귀(레거시 login) | 수동/통합 |

## 4. Rollout (컷오버 — D-4)
1. 코드 배포(기본 `AMA_TOKEN_VERIFY_MODE=local` 유지 → 무영향).
2. staging env에 `AMA_GATEWAY_URL`/`AMA_CLIENT_ID`/`AMA_CLIENT_SECRET` 설정 + `AMA_TOKEN_VERIFY_MODE=ama_session` → 실 로그인 검증.
3. 운영 env 동일 설정 + 모드 전환 → 실 로그인 확인.
4. 안정화 후 `local` 경로 deprecate + `AMA_JWT_SECRET`/`AMA_JWT_ALLOWED_APP_CODES` 제거(별도 PR).

## 5. Risks (리스크)
- **R1**: AMA `/oauth/*` 응답 envelope/필드명이 매뉴얼과 다를 수 있음(O-1). http 클라이언트에 방어적 파싱 + 계약 확정 전 staging만.
- **R2**: PartnerApp `client_id/secret` 미발급 시 착수 불가(선결). 모드 토글 덕에 코드는 먼저 배포 가능.
- **R3**: 로그인당 OAuth 2콜 — 지연/가용성. timeout + introspect 캐시 + fail-closed로 완화.
- **R4**: introspect `ent_id` 포맷이 `/admin/config` 저장값(현 seed=amb_acm_user.ent_id UUID)과 동일해야 게이트 통과(O-1 확인).

## 6. Estimate
백엔드 T1–T8 중간 규모(기존 outbound/파이프라인 재사용), FE T9 소규모. 가장 신중: T2 exchanger 에러매핑 + T10 staging 실토큰 검증.
