---
document_id: PLN-260525-app-academy-ama-jwt-단일화
version: 1.0.0
status: Draft
created: 2026-05-25
author: 김익용 (Gray)
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md
---

# app-academy × AMA 인증 단일화 — 작업계획서

> 본 계획서는 [REQ-260525-app-academy-ama-jwt-단일화](../analysis/REQ-260525-app-academy-ama-jwt-단일화.md) 기반.

---

## 1. 시스템 개발 현황 분석

### 1.1 디렉터리 구조 (관련 부분)

```
backend/src/
├── modules/acm-auth/                        ★ 유지 (단일화 후 정식 인증 모듈)
│   ├── acm-auth.module.ts
│   ├── application/acm-auth.service.ts
│   ├── infrastructure/
│   │   ├── ama-token.verifier.ts            (HS256 검증)
│   │   └── ama-token.verifier.spec.ts
│   ├── presentation/acm-auth.controller.ts  (POST /api/acm/auth/ama-exchange)
│   ├── jwt/acm-jwt.strategy.ts
│   ├── guards/acm-jwt-auth.guard.ts
│   └── ...
│
├── presentation/auth/                       △ 부분 제거 (OIDC 부분만)
│   ├── auth.module.ts                       (수정 — OIDC import/providers 제거)
│   ├── auth.controller.ts                   유지 (break-glass)
│   ├── auth.service.ts                      유지
│   ├── parent-auth.controller.ts            유지
│   ├── parent-auth.service.ts               유지
│   ├── jwt.strategy.ts                      유지
│   ├── index.ts                             유지
│   ├── dto/                                 유지
│   ├── ama-auth.controller.ts               ✗ 삭제 (OIDC redirect)
│   ├── ama-oidc-state.store.ts              ✗ 삭제
│   └── ama-oidc-state.store.spec.ts         ✗ 삭제
│
├── application/auth/                        ✗ 디렉터리 전체 삭제
│   ├── ama-sso.use-case.ts                  ✗
│   └── ama-sso.use-case.spec.ts             ✗
│
├── infrastructure/external/ama/
│   ├── auth/                                ✗ 디렉터리 전체 삭제
│   │   ├── ama-auth.module.ts               ✗
│   │   ├── ama-oidc.service.ts              ✗
│   │   ├── ama-oidc-mock.service.ts         ✗
│   │   ├── ama-oidc-mock.service.spec.ts    ✗
│   │   ├── ama-pkce.util.ts                 ✗
│   │   ├── ama-pkce.util.spec.ts            ✗
│   │   └── interfaces/ama-oidc.interface.ts ✗
│   │
│   ├── webhook/                             ★ 유지 (보존 대상)
│   │   └── ama-webhook-signature.util.ts
│   ├── ama-client.service.ts                유지 (구독·고객 API용)
│   ├── ama-mock.service.ts                  유지
│   └── ama.module.ts                        유지
│
└── presentation/webhooks/
    └── ama-subscription-webhook.controller.ts ★ 유지
```

### 1.2 기술 스택 (변경 없음)

- NestJS 11 / TypeScript strict / TypeORM / MySQL 8
- Jest (단위 테스트), Supertest (e2e)
- ConfigModule (`.env` 기반)

### 1.3 제약사항

- **NestJS 모듈 그래프**: `auth.module.ts`의 `imports`/`controllers`/`providers`/`exports` 4곳 모두 정합성 유지 필요
- **JwtStrategy 충돌**: legacy `JwtStrategy` (`presentation/auth/jwt.strategy.ts`) 와 `AcmJwtStrategy` (`modules/acm-auth/jwt/acm-jwt.strategy.ts`) 가 공존 — Passport `defaultStrategy: 'jwt'` 키 충돌 여부 사전 확인
- **외부 의존**: `application/subscription/**`은 webhook과 연결되므로 건드리지 않는다
- **테스트**: spec 파일 삭제 시 Jest 캐시 클린 필요 (`jest --clearCache`)

---

## 2. 단계별 구현 계획

### Phase 1 — 사전 정합성 확인 (No-code)

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 1.1 | 외부에서 `/api/auth/ama/login`·`/callback`·`/logout` 호출 흔적 grep (저장소 전체) | └─ 사이드 임팩트: 호출자 발견 시 본 작업 보류, 마이그레이션 계획 별도 수립 |
| 1.2 | `JwtStrategy`(legacy) vs `AcmJwtStrategy` Passport `name` 충돌 점검 — 두 strategy가 동시 등록되어도 무방한지 확인 | └─ 사이드 임팩트: 충돌 시 strategy name 명시(`@Strategy('jwt-acm')`) 추가 필요 |
| 1.3 | `nest-cli.json` / `tsconfig.json` 의 `paths`·`include` 에 제거 대상 경로 하드코딩이 있는지 확인 | └─ 사이드 임팩트: 빌드 깨짐 방지 |

### Phase 2 — Backend 코드 제거 (Atomic)

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 2.1 | `backend/src/presentation/auth/auth.module.ts` 수정<br>- Line 14~17 import 제거<br>- Line 33 `AmaAuthModule` 제거<br>- Line 35 `AmaAuthController` 제거<br>- Line 40~42 `AmaSsoUseCase`, `AmaOidcStateStore`, `AmaOidcServiceRef` 제거<br>- Line 50 export 의 `AmaSsoUseCase` 제거 | └─ 사이드 임팩트: AuthModule 부팅 의존성 단순화. ParentAuthService/AuthService는 영향 없음 |
| 2.2 | OIDC 파일 11개 일괄 삭제 (REQ §4.2 목록) | └─ 사이드 임팩트: `git rm` 사용. 잔존 import 발견 시 빌드 단계에서 즉시 발견됨 |
| 2.3 | `backend/src/infrastructure/external/ama/auth/` 디렉터리 전체 삭제 (webhook 폴더는 형제 디렉터리이므로 무관) | └─ 사이드 임팩트: `ama-auth.module.ts`는 AmaAuthModule 클래스로 다른 곳에서 import되지 않음 (auth.module.ts에서만 참조) |
| 2.4 | `backend/src/application/auth/` 디렉터리 전체 삭제 | └─ 사이드 임팩트: AmaSsoUseCase 외 파일 없음. 다른 application 도메인은 별도 디렉터리에 있음 |
| 2.5 | `npm run build` (backend) → 빌드 그린 확인 | └─ 사이드 임팩트: 잔존 import 모두 컴파일 에러로 노출되므로 누락 발견 |
| 2.6 | `npm run lint` (backend) → 린트 그린 확인 | └─ 사이드 임팩트: unused-import 제거 누락 발견 |

### Phase 3 — 환경변수·문서 정리

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 3.1 | `docker/staging/.env.staging.example` — `AMA_OIDC_*` 5종 라인 제거 (`AMA_OIDC_MODE`, `AMA_OIDC_ISSUER`, `AMA_OIDC_CLIENT_ID`, `AMA_OIDC_CLIENT_SECRET`, `AMA_OIDC_REDIRECT_URI`) | └─ 사이드 임팩트: 서버 `.env` 본파일 갱신은 배포 시점에 수동 |
| 3.2 | `docker/production/.env.production.example` — `AMA_OIDC_CLIENT_ID`, `AMA_OIDC_CLIENT_SECRET` (그리고 있다면 `AMA_OIDC_ISSUER` 등) 제거 | └─ 사이드 임팩트: 프로덕션 `.env` 본파일은 미사용이라 영향 없음 |
| 3.3 | `backend/.env.example` 동일 정리 (있다면) | └─ 사이드 임팩트: 신규 개발자 온보딩 혼란 제거 |
| 3.4 | `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md` §1.2 표현 수정 ("OIDC 미사용 확정") + 관련 링크 갱신 | └─ 사이드 임팩트: 기존 REQ가 본 작업의 super-set이 되도록 정합성 유지 |
| 3.5 | `docs/integration/ama-platform-spec-asks.md` A-2 항목을 `Resolved` 상태로 갱신 (있다면) | └─ 사이드 임팩트: 외부 협업 추적 정합 |
| 3.6 | `docs/deployment/RUNBOOK.md` OIDC 관련 단락 제거 (있다면) | └─ 사이드 임팩트: 운영자 가이드 정합 |
| 3.7 | `backend/README.md` 인증 다이어그램 갱신 (단일 흐름으로) | └─ 사이드 임팩트: 신규 개발자 학습 시 혼동 제거 |

### Phase 4 — 테스트 보강

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 4.1 | TC 문서(`TC-260525-app-academy-ama-jwt-단일화.md`) 기반 단위 테스트 보강 — 신규 케이스 추가는 TC 단계에서 정의 | └─ 사이드 임팩트: 회귀 방지 |
| 4.2 | `jest --clearCache && npm test` 수행 — 삭제된 spec 캐시 잔존 방지 | └─ 사이드 임팩트: CI 캐시 깨짐 사전 차단 |
| 4.3 | e2e 테스트 (있다면) 실행 — `/api/acm/auth/ama-exchange` 정상 동작 검증 | └─ 사이드 임팩트: 회귀 검출 |

### Phase 5 — 스테이징 검증 → 프로덕션 (CLAUDE.md 배포 원칙 준수)

| Step | 작업 | 사이드 임팩트 |
|------|------|--------------|
| 5.1 | feature 브랜치(`feature/app-academy-ama-jwt-unify`) 에서 작업 → main PR | └─ 사이드 임팩트: 작은 PR 1개로 묶어 revert 용이 |
| 5.2 | 스테이징 배포 → `/api/auth/ama/login` 404 확인 + `/api/acm/auth/ama-exchange` 200 확인 | └─ 사이드 임팩트: 실서비스 영향 검증 |
| 5.3 | Webhook 회귀 확인 — 테스트 페이로드 1건 전송 → `subscription_events` 행 생성 확인 | └─ 사이드 임팩트: 보존 채널 정상 동작 보장 |
| 5.4 | 프로덕션 PR (main → production) | └─ 사이드 임팩트: AWS 싱가포르 서버 배포 |

---

## 3. 변경 파일 목록

### Backend — 삭제 (11개)

| # | 파일 | 종류 |
|---|------|------|
| 1 | `backend/src/presentation/auth/ama-auth.controller.ts` | 컨트롤러 |
| 2 | `backend/src/presentation/auth/ama-oidc-state.store.ts` | 인메모리 store |
| 3 | `backend/src/presentation/auth/ama-oidc-state.store.spec.ts` | 단위 테스트 |
| 4 | `backend/src/application/auth/ama-sso.use-case.ts` | 유스케이스 |
| 5 | `backend/src/application/auth/ama-sso.use-case.spec.ts` | 단위 테스트 |
| 6 | `backend/src/infrastructure/external/ama/auth/ama-auth.module.ts` | NestJS 모듈 |
| 7 | `backend/src/infrastructure/external/ama/auth/ama-oidc.service.ts` | HTTP 클라이언트 |
| 8 | `backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.ts` | mock 구현 |
| 9 | `backend/src/infrastructure/external/ama/auth/ama-oidc-mock.service.spec.ts` | 단위 테스트 |
| 10 | `backend/src/infrastructure/external/ama/auth/ama-pkce.util.ts` | PKCE util |
| 11 | `backend/src/infrastructure/external/ama/auth/ama-pkce.util.spec.ts` | 단위 테스트 |
| 12 | `backend/src/infrastructure/external/ama/auth/interfaces/ama-oidc.interface.ts` | 인터페이스 |

(디렉터리 자체 정리: `backend/src/application/auth/`, `backend/src/infrastructure/external/ama/auth/`)

### Backend — 수정 (1개)

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `backend/src/presentation/auth/auth.module.ts` | Line 14~17 import 5종 제거 / Line 33 `AmaAuthModule` 제거 / Line 35 `AmaAuthController` 제거 / Line 40~42 providers 3종 제거 / Line 50 export 1종 제거 |

### 환경설정 — 수정 (2~3개)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `docker/staging/.env.staging.example` | `AMA_OIDC_*` 5종 라인 삭제 |
| 2 | `docker/production/.env.production.example` | `AMA_OIDC_*` 2~3종 라인 삭제 |
| 3 | `backend/.env.example` | (존재 시) 동일 |

### 문서 — 수정 (3~4개)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md` | §1.2 표현 정정, 본 REQ로 super-seded 표기 |
| 2 | `docs/integration/ama-platform-spec-asks.md` | (존재 시) A-2 항목 Resolved 처리 |
| 3 | `docs/deployment/RUNBOOK.md` | (존재 시) OIDC 단락 제거 |
| 4 | `backend/README.md` | 인증 흐름 다이어그램 갱신 |

### Frontend — 변경 없음

`frontend-acm/src/modules/auth/api/auth-api.ts:31` 가 이미 `/acm/auth/ama-exchange`를 호출 중이므로 수정 불필요.

### DB — 변경 없음

본 작업은 스키마·데이터 변경 없음.

---

## 4. 사이드 임팩트 분석

| 범위 | 위험도 | 설명 |
|------|-------|------|
| **NestJS 부팅 의존성 그래프** | Low | `AuthModule` 의존성만 단순화. 다른 모듈에서 `AmaAuthModule`·`AmaSsoUseCase` 참조 흔적 없음 (grep 확인 필요 — Phase 1.1) |
| **외부 호출자** | Low | `/api/auth/ama/login`·`/callback`·`/logout` 라우트 외부 호출자 없음 (사전 grep 결과 0건). 만약 있다면 Phase 1.1에서 발견 |
| **Passport JwtStrategy 충돌** | Low | legacy `JwtStrategy`(presentation/auth/jwt.strategy.ts) 와 `AcmJwtStrategy`(modules/acm-auth/jwt/) 가 별도 모듈에서 등록됨 — 작업 전후 변동 없음 |
| **Webhook 동작** | None | webhook 코드·환경변수·DB 모두 보존 대상 |
| **Break-glass 로그인** | None | `auth.controller.ts` / `auth.service.ts` 미변경 |
| **Frontend** | None | 이미 단일화된 엔드포인트만 호출 중 |
| **CI/CD 파이프라인** | Low | Jest 캐시 클린 필요 (Phase 4.2) 외 변경 없음 |
| **운영 환경** | Low | `.env` 본파일은 서버에서 수동 관리 — `AMA_OIDC_*` 변수는 코드 미참조라 잔존해도 무해. 다음 배포 시 운영자가 cleanup |

---

## 5. DB 마이그레이션

**해당 없음.** 본 작업은 코드·환경설정·문서 정리 작업이며 DB 스키마 변경 없음.

---

## 6. 롤백 전략

- 단일 PR로 모든 변경을 묶는다 (분리 커밋 OK, 단일 머지)
- 문제 발생 시 `git revert <merge-sha>` 한 번으로 복구
- 환경변수는 `.env.example`만 변경 (서버 `.env` 본파일은 미수정) — 별도 롤백 불필요

---

## 7. 작업 추정

| Phase | 추정 시간 |
|-------|----------|
| Phase 1 사전 점검 | 30분 |
| Phase 2 코드 제거 + 빌드 | 1시간 |
| Phase 3 문서·env | 1시간 |
| Phase 4 테스트 | 1시간 |
| Phase 5 스테이징 검증 | 1시간 |
| **합계** | **~4.5시간** |
