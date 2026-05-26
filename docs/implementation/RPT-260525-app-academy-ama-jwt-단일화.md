---
document_id: RPT-260525-app-academy-ama-jwt-단일화
version: 1.0.0
status: Phase 1~4 Complete (Pending Deploy)
created: 2026-05-25
author: 김익용 (Gray)
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md
  - docs/plan/PLN-260525-app-academy-ama-jwt-단일화.md
  - docs/test/TC-260525-app-academy-ama-jwt-단일화.md
  - docs/test/TR-260525-app-academy-ama-jwt-단일화.md
---

# app-academy × AMA 인증 단일화 — 작업 완료 보고서

## 1. 작업 개요

| 항목 | 내용 |
|------|------|
| 목적 | app-academy 의 AMA 연동을 **HS256 JWT passthrough 단일 경로**로 통일하고, 미사용 OIDC 코드·환경변수·문서 흔적을 일괄 제거 |
| Webhook | **보존** (`/webhooks/ama/subscription`, 6종 이벤트, HMAC 서명 검증, nonce dedup) |
| 호환성 | break-glass 이메일/PW 로그인 100% 호환 유지, frontend 변경 없음, DB 변경 없음 |
| 작업 기간 | 2026-05-25 (분석·계획·TC) → 2026-05-26 (구현·테스트) |
| Branch | `feature/ama-jwt-unify` (app-academy 저장소) |

---

## 2. 수행한 작업

### Phase 1 — 사전 정합성 확인
- 외부에서 `/api/auth/ama/login|callback|logout` 호출 흔적 grep → 코드 호출자 **0건**, 문서 잔존만 확인
- `JwtStrategy`(legacy `jwt`) vs `AcmJwtStrategy`(`acm-jwt`) Passport name 충돌 **없음**
- `nest-cli.json`, `tsconfig` 에 제거 대상 경로 하드코딩 **없음**

### Phase 1.5 — 브랜치 분리 (계획 외 필수 조치)
- app-academy 저장소 `main` 브랜치에 본 작업 관련 staged 12개 + 무관 70+개 modified 가 혼재한 상태 발견
- `feature/ama-jwt-unify` 브랜치 생성 후 본 작업 관련 16개(staged 12 + auth.module.ts + REQ/PLN/TC 3 docs)만 staged 유지
- 무관 변경은 `git stash push --keep-index --include-untracked` 로 stash@{0}에 안전 보관

### Phase 2 — Backend 코드 제거 (이미 staged 상태로 존재, 검증만 수행)
- OIDC 코드 12개 파일 삭제 (REQ §4.2 와 100% 일치)
  - `backend/src/application/auth/` 전체 (2 files)
  - `backend/src/infrastructure/external/ama/auth/` 전체 (7 files)
  - `backend/src/presentation/auth/ama-auth.controller.ts`, `ama-oidc-state.store.ts`, `ama-oidc-state.store.spec.ts`
- `backend/src/presentation/auth/auth.module.ts` 수정 (import/providers/exports 에서 OIDC 5종 제거)

### Phase 3 — 환경변수·문서 정리
- `docker/staging/.env.staging.example`: `AMA_OIDC_*` 5종 + 주석 라인 제거
- `docker/production/.env.production.example`: `AMA_OIDC_*` 5종 제거 + `AMA_JWT_SECRET`, `AMA_JWT_ALLOWED_APP_CODES` 신규 추가 (production 누락 보완)
- `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md §1.2`: "OIDC 대안 채택 해석" → "A-2 Resolved + REQ-260525 링크" 정정
- `docs/integration/ama-platform-spec-asks.md`:
  - §2 인증 가정: OIDC → HS256 JWT injection 정식 채택
  - §3 A-2 행: TBD → Resolved 2026-05-25
  - §5 Mock 다이어그램: OIDC 흐름 → JWT injection 흐름
- `docs/deployment/CUTOVER.md T-3d`: 체크리스트의 `AMA_OIDC_MODE/CLIENT_ID/SECRET` → `AMA_JWT_SECRET, AMA_WEBHOOK_SECRET` 으로 갱신

### Phase 4 — 테스트
- Build: `nest build` ✅ exit 0
- Lint: 본 작업 변경 파일 0 errors ✅ (전체 482 사전 이슈는 본 작업 무관)
- Unit Tests: `npx jest` → **67/67 passed** (15 suites) ✅
  - AMA 관련 25/25 ✅: ama-token.verifier(10), lifecycle, provisioning, deprovision cron, webhook signature
- 정적 검증: 잔존 OIDC 식별자·PKCE util **0건** ✅
- 환경설정 검증: 모든 `.env.example`에서 `AMA_OIDC_*` **0건** ✅

상세는 [TR-260525-app-academy-ama-jwt-단일화](../test/TR-260525-app-academy-ama-jwt-단일화.md) 참조.

---

## 3. 변경 파일 목록

### 삭제 (12 files)

```
backend/src/application/auth/ama-sso.use-case.ts
backend/src/application/auth/ama-sso.use-case.spec.ts
backend/src/infrastructure/external/ama/auth/ama-auth.module.ts
backend/src/infrastructure/external/ama/auth/ama-oidc.service.ts
backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.ts
backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.spec.ts
backend/src/infrastructure/external/ama/auth/ama-pkce.util.ts
backend/src/infrastructure/external/ama/auth/ama-pkce.util.spec.ts
backend/src/infrastructure/external/ama/auth/interfaces/ama-oidc.interface.ts
backend/src/presentation/auth/ama-auth.controller.ts
backend/src/presentation/auth/ama-oidc-state.store.ts
backend/src/presentation/auth/ama-oidc-state.store.spec.ts
```

### 수정 (5 files)
- `backend/src/presentation/auth/auth.module.ts`
- `docker/staging/.env.staging.example`
- `docker/production/.env.production.example`
- `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md`
- `docs/integration/ama-platform-spec-asks.md`
- `docs/deployment/CUTOVER.md`

### 신규 (5 files)
- `docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md`
- `docs/plan/PLN-260525-app-academy-ama-jwt-단일화.md`
- `docs/test/TC-260525-app-academy-ama-jwt-단일화.md`
- `docs/test/TR-260525-app-academy-ama-jwt-단일화.md`
- `docs/implementation/RPT-260525-app-academy-ama-jwt-단일화.md` (본 문서)

### 변경 없음 (보존)
- `backend/src/modules/acm-auth/**` (전체)
- `backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts`
- `backend/src/application/subscription/**`
- `backend/src/infrastructure/external/ama/webhook/**`
- `frontend-acm/**`
- DB 스키마

---

## 4. 효과

| 영역 | Before | After |
|------|--------|-------|
| 인증 채널 | OIDC(mock) + JWT passthrough + Webhook = 3중 | JWT passthrough + Webhook = 2개 |
| 환경변수 (AMA) | 9종 (staging) | 4종 — `AMA_JWT_*` 2종 + `AMA_WEBHOOK_*` + `AMA_DEPROVISION_GRACE_DAYS` |
| API 라우트 | `/api/auth/ama/{login,callback,logout}` 3개 + `/api/acm/auth/ama-exchange` | `/api/acm/auth/ama-exchange` 단일 |
| 백엔드 모듈 | `AuthModule(legacy+OIDC)` + `AcmAuthModule(JWT)` + `AmaAuthModule(OIDC infra)` | `AuthModule(legacy)` + `AcmAuthModule(JWT)` |
| 코드 라인 수 | OIDC 잔존 ~700 LoC | 0 |
| 신규 개발자 학습 비용 | 두 경로 어디를 따를지 혼동 | 단일 경로 명확 |
| 다른 앱 인증 패턴과의 정합 | 단독 OIDC 분기 | platform/car-manager 와 동일 JWT passthrough |

---

## 5. 회귀 방지 패턴

- **단일 진입점 원칙**: 인증 채널을 추가할 때는 기존 `modules/acm-auth/` 패턴을 그대로 따른다. 별도 `application/auth/`, `infrastructure/external/ama/auth/` 디렉터리는 만들지 않는다.
- **환경변수 그룹 명명**: `AMA_*` 변수는 그룹별 prefix(`AMA_JWT_*`, `AMA_WEBHOOK_*`)로 통일.
- **Mock 코드 정책**: production-bound dead code (OIDC mock 등) 는 작성 시점부터 `// TODO: remove if not adopted by S0` 주석으로 만료일 명시.
- **Strategy name 명시**: Passport strategy 추가 시 반드시 두 번째 인자에 unique name 지정 (`AcmJwtStrategy → 'acm-jwt'` 패턴).

---

## 6. 미수행 / 후속 과제

### Phase 5 (배포·검증) — 사용자 진행 지시 대기

- Local commit 생성
- `git push origin feature/ama-jwt-unify` + GitHub PR 생성
- 스테이징 배포 → 다음 검증:
  - TC-DEP-01: `curl -i https://app-academy-stg.amoeba.site/api/auth/ama/login` → 404
  - TC-DEP-02: `curl -i POST .../api/acm/auth/ama-exchange` → 401 (dummy token), 503(미설정) 아님
  - TC-DEP-03: AMA 테스트 페이로드 1건 webhook 정상 수신
- TC-F-01~03 frontend smoke (브라우저)
- main → production PR (스테이징 검증 후)

### Follow-up Spec Ask
- AMA 측 RS256+JWKS 전환 요청 (B-4 신규 등록 제안) — HS256 대칭키 공유의 중장기 보안 부담 완화
- Webhook 페이로드 스키마 명세 확정 (A-3 후속)

### Stash 복원 안내 (분리 보관된 무관 변경)
- 본 작업과 무관한 70+개 변경은 stash@{0}에 보관:
  ```
  stash@{0}: On feature/ama-jwt-unify: unrelated-changes-from-main-2026-05-25
  ```
- 사용자가 `main` 으로 돌아가 별도 컨텍스트에서 `git stash pop stash@{0}` 로 복원 (다른 진행 중 작업).

---

## 7. 결론

REQ-260525 의 R-1 ~ R-7 7개 요구사항을 모두 충족:

| # | 요구사항 | 결과 |
|---|---------|------|
| R-1 | HS256 JWT passthrough 단일 경로 통일 | ✅ |
| R-2 | OIDC 코드·env 제거 | ✅ |
| R-3 | Webhook 유지 | ✅ |
| R-4 | platform/car-manager 패턴 정합 | ✅ |
| R-5 | break-glass 100% 호환 | ✅ |
| R-6 | env 가이드·문서 갱신 | ✅ |
| R-7 | 단위 테스트 회귀 보장 (67/67 pass) | ✅ |

스테이징 배포 후 TC-DEP / TC-F 통과로 최종 합격.
