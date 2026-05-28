---
document_id: TR-260525-app-academy-ama-jwt-단일화
version: 1.0.0
status: Phase 4 Complete (Pre-deploy)
created: 2026-05-25
executed: 2026-05-26
author: 김익용 (Gray)
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md
  - docs/plan/PLN-260525-app-academy-ama-jwt-단일화.md
  - docs/test/TC-260525-app-academy-ama-jwt-단일화.md
---

# app-academy × AMA 인증 단일화 — 테스트 완료 보고서

## 1. 실행 요약

| 항목 | 결과 |
|------|------|
| 환경 | local (feature/ama-jwt-unify) |
| Backend Build | ✅ Pass (nest build) |
| Backend Lint (변경 파일) | ✅ Pass (0 errors on touched files) |
| Backend Lint (전체) | ⚠ 482 사전 이슈 (본 작업 무관 — pre-existing) |
| Unit Tests (전체) | ✅ **67/67 passed** (15 suites) |
| Unit Tests (AMA 관련) | ✅ **25/25 passed** (5 suites) |
| 정적 검증 (잔존 OIDC) | ✅ 0 hits |
| 환경변수 정리 | ✅ Complete (staging/production/backend .env.example) |
| 문서 정리 | ✅ Complete (ACM-AMA-SSO-REQ §1.2, spec-asks A-2, CUTOVER) |
| 스테이징 배포 | ⏳ Pending (사용자 진행 지시 대기) |

---

## 2. 단위 테스트 결과 (TC-U-*)

### TC-U-01a — Build
```
> nest build
(exit 0, no output)
```
→ **Pass**

### TC-U-01b — Lint (touched files only)
```
$ npx eslint src/presentation/auth/auth.module.ts src/modules/acm-auth/
(0 errors, 0 warnings — except boundaries plugin deprecation notice)
```
→ **Pass**

### TC-U-02 — AmaTokenVerifier 회귀
```
PASS  src/modules/acm-auth/infrastructure/ama-token.verifier.spec.ts
Tests:       10 passed, 10 total
```
→ **Pass** — 10/10 (정상 / 만료 / 서명변조 / scope / appCode / claims / clockTolerance / secret 미설정 503 / multi appCode / 추가 1건)

### TC-U-03, TC-U-04 — JwtStrategy 충돌·AuthModule 정합성
- 사전 점검 (Phase 1): `AcmJwtStrategy` 는 `'acm-jwt'` 이름 사용 (`backend/src/modules/acm-auth/jwt/acm-jwt.strategy.ts:7`), legacy `JwtStrategy` 와 충돌 없음.
- 전체 Jest 부팅 시 NestJS Test container 정상 빌드 (15 suites compile).
→ **Pass**

---

## 3. 통합/모듈 테스트 결과

### TC-I, TC-W (관련 5 suites)
```
PASS  src/modules/acm-auth/infrastructure/ama-token.verifier.spec.ts
PASS  src/application/subscription/lifecycle.use-case.spec.ts
PASS  src/application/subscription/provisioning.use-case.spec.ts
PASS  src/application/subscription/tenant-deprovision.cron.spec.ts
PASS  src/infrastructure/external/ama/webhook/ama-webhook-signature.util.spec.ts
Test Suites: 5 passed, 5 total
Tests:       25 passed, 25 total
```
→ **Pass** — JWT 검증 + 6종 webhook 이벤트 라우팅 + 서명 검증 + dedup 모두 회귀 통과

### TC-I-04 — 제거된 OIDC 라우트 404
정적 검증으로 대체 (controller 파일 자체가 삭제되어 NestJS 라우트 등록 불가):
```
$ grep -rn "@Controller.*auth/ama" src/
(no matches)
```
스테이징 배포 후 실라우트 `curl -i` 검증은 Phase 5에서 수행.

---

## 4. 정적 검증 (TC-S-*)

### TC-S-01 — 잔존 OIDC 식별자
```
$ grep -rn "AmaOidcService\|AmaOidcStateStore\|AmaOidcServiceRef\|AmaSsoUseCase\|AmaAuthModule\|AmaAuthController" backend/src
(no matches)
```
→ **Pass**

### TC-S-02 — PKCE/state util
```
$ grep -rn "generatePkceVerifier\|deriveCodeChallenge\|generateState" backend/src
(no matches)
```
→ **Pass**

---

## 5. 환경설정 검증 (TC-E-*)

### TC-E-01 — `AMA_OIDC_*` 잔존 (`.env.example`)
```
$ grep -c AMA_OIDC docker/staging/.env.staging.example
0
$ grep -c AMA_OIDC docker/production/.env.production.example
0
$ grep -c AMA_OIDC backend/.env.example
0
```
→ **Pass**

### TC-E-02 — 유지 변수 보존
```
docker/staging/.env.staging.example:
  AMA_WEBHOOK_SECRET=REPLACE_ME_WEBHOOK_SECRET    ✅
  AMA_DEPROVISION_GRACE_DAYS=90                    ✅
  AMA_JWT_SECRET=                                  ✅
  AMA_JWT_ALLOWED_APP_CODES=tpi-acm                ✅

docker/production/.env.production.example:
  AMA_WEBHOOK_SECRET=REPLACE_ME_WEBHOOK_SECRET    ✅
  AMA_DEPROVISION_GRACE_DAYS=90                    ✅
  AMA_JWT_SECRET=REPLACE_ME_AMA_JWT_SECRET         ✅ (신규 추가)
  AMA_JWT_ALLOWED_APP_CODES=tpi-acm                ✅ (신규 추가)
```
→ **Pass**

---

## 6. 문서 검증 (TC-D-*)

### TC-D-01 — OIDC 잔존 (작업 문서 제외)
```
$ grep -rn "AMA_OIDC" docs/ backend/README.md \
    | grep -v "REQ-260525\|PLN-260525\|TC-260525\|spec-asks\|PIVOT-TASK"
(no matches outside of history/super-seded docs)
```
→ **Pass** — 현재 유효 문서에 OIDC 사용 언급 0건. `PIVOT-TASK-1.0.0.md`는 작업 history이므로 보존.

### TC-D-02 — `ACM-AMA-SSO-REQ-1.0.0.md §1.2` 갱신
`OIDC 대신 short-lived HS256 JWT injection 방식을 채택한 것으로 해석` → `Spec Ask A-2 Resolved (2026-05-25): AMA는 OIDC 미지원 확정. ... [REQ-260525-app-academy-ama-jwt-단일화]로 일괄 제거됨.`

### TC-D-03 — `ama-platform-spec-asks.md A-2` Resolved
A-2 행 Response 컬럼에 Resolved + REQ-260525 링크 추가. Mock 다이어그램(§5)도 HS256 JWT 흐름으로 갱신.

### TC-D-04 — `CUTOVER.md` 체크리스트
`AMA_OIDC_MODE=http, _CLIENT_ID/SECRET 실 값` → `AMA_JWT_SECRET 16+ chars, AMA_WEBHOOK_SECRET 실 값`

---

## 7. 변경 파일 최종 요약 (staged)

| 종류 | 파일 수 | 비고 |
|------|--------|------|
| OIDC 코드 삭제 | 12 | REQ §4.2 목록과 100% 일치 |
| `auth.module.ts` 수정 | 1 | OIDC import/providers/exports 제거 |
| `.env.staging.example` | 1 | AMA_OIDC_* 5종 라인 제거 |
| `.env.production.example` | 1 | AMA_OIDC_* 5종 제거 + AMA_JWT_* 2종 추가 |
| 문서 갱신 | 3 | ACM-AMA-SSO-REQ §1.2, spec-asks A-2/§2/§5, CUTOVER T-3d |
| 신규 문서 | 4 | REQ-260525, PLN-260525, TC-260525, TR-260525 (본 파일) |

---

## 8. 미실시 항목 (Phase 5에서 수행)

| TC | 내용 | 사유 |
|----|------|------|
| TC-F-01~03 | Frontend smoke (스테이징) | 스테이징 배포 후 실제 브라우저 검증 |
| TC-DEP-01~03 | 스테이징 배포 검증 (curl, webhook 페이로드) | 배포 미수행 |
| TC-I-04 (실라우트) | `/api/auth/ama/login` 404 응답 | 정적 검증으로 갈음, 배포 후 curl 확인 |

---

## 9. 합격 판정

CLAUDE.md 워크플로우 기준 **Phase 4 (테스트 수행) 완료**.

| 항목 | 상태 |
|------|------|
| 단위/통합 (TC-U, TC-I, TC-W, TC-S, TC-E, TC-D) | ✅ All Pass |
| 회귀 (전체 67 tests) | ✅ All Pass |
| 빌드·린트 그린 | ✅ Pass |
| 배포 검증 (TC-DEP, TC-F) | ⏳ Phase 5 대기 |

→ 사용자 진행 지시 시 Phase 5 (스테이징 배포) 진입 가능.
