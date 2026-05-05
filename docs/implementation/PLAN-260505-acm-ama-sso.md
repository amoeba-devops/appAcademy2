---
document_id: ACM-AMA-SSO-PLAN-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-05
updated: 2026-05-05
author: 김익용 (Gray)
related:
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md
  - docs/integration/ama-platform-spec-asks.md
change_log:
  - version: 1.0.0
    date: 2026-05-05
    author: 김익용
    description: |
      Initial work plan for AMA Custom App SSO on ACM site.
      Phased delivery: schema → backend exchange → frontend auto-login →
      nginx CSP → smoke + report. Includes ASCII UI mockups for the
      auto-login splash and error states.
---

# ACM × AMA Custom App SSO — Work Plan (작업 계획서)

> 본 계획은 [REQ-ACM-AMA-SSO-1.0.0](../analysis/ACM-AMA-SSO-REQ-1.0.0.md) §11.1 미결 Q를 **임시 가정**으로 진행합니다. 사용자 결정 후 갱신:
> - **Q-1 가정**: (a) `ama.amoeba.site` + `ama-stg.amoeba.site` 둘 다 화이트리스트
> - **Q-2 가정**: (b) 임시 dev secret 사용 (`AMA_JWT_SECRET=dev-acm-ama-secret-change-me-32bytes...`), 운영 전 교체
> - **Q-3 가정**: (a) break-glass 폼 유지
> - **Q-4 가정**: (a) MASTER 외 role도 ACM 진입 허용 (RBAC 매핑은 후속)
> - **Q-5 가정**: (a) ko/en/vi/zh-CN 4개 locale 모두 지원

---

## 1. Goals

1. REQ §3 In-Scope 전 항목 구현 + staging 배포
2. AC-1 ~ AC-8 (8개) 모두 PASS
3. AMA 포털에서 iframe으로 ACM 자동 로그인 시연 가능

---

## 2. Phased Tasks

### Phase 0 — 사전 합의·키 발급 (사용자/AMA 팀 협의)

| Task | 설명 | 산출물 / 액션 |
|---|---|---|
| **T-0.1** | AMA 플랫폼 팀에 `AMA_JWT_SECRET` 발급 요청 | (사용자) `docs/integration/ama-platform-spec-asks.md` 회신 받기 |
| **T-0.2** | iframe 화이트리스트 도메인 확정 (Q-1) | (사용자) 결정 |
| **T-0.3** | break-glass 정책 확정 (Q-3) | (사용자) 결정 |

> **Phase 0 미완 시 Phase 1~3은 dev secret로 진행** (운영 적용 전 교체 필수).

### Phase 1 — Backend (NestJS, acm-auth 확장)

| Task | 설명 | 산출물 |
|---|---|---|
| **T-1.1** | 마이그레이션 SQL | `sql/acm/510-acm-ama-sso.sql` |
| **T-1.2** | `AmaTokenVerifier` 인터페이스 + HS256 구현체 | `backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts` |
| **T-1.3** | DTO `AmaExchangeDto` (`amaToken: string`) + 검증 | `backend/src/modules/acm-auth/application/dto/ama-exchange.dto.ts` |
| **T-1.4** | Use-case `exchangeAmaToken(amaToken)` — verify → upsert user → sign ACM JWT | `application/acm-auth.service.ts` 메서드 추가 |
| **T-1.5** | Repo upsert 메서드 + AcmUser 엔티티 컬럼 추가 (ama_user_id, ama_entity_id, ama_role, auth_source) | `infrastructure/typeorm/acm-user.typeorm-entity.ts` |
| **T-1.6** | Controller `POST /api/acm/auth/ama-exchange` | `presentation/acm-auth.controller.ts` 핸들러 추가 |
| **T-1.7** | 환경 변수 로딩 + 검증 (`AMA_JWT_SECRET` 누락 시 부팅 실패) | `acm-auth.module.ts` config |
| **T-1.8** | 에러 코드 enum (`AMA_TOKEN_*`) + Swagger 응답 스키마 | inline |
| **T-1.9** | 단위 테스트: verifier (정상/만료/위조/scope/appCode) — 6 케이스 이상 | `*.spec.ts` |
| **T-1.10** | 통합 테스트: AC-3, AC-4, AC-5, AC-6 시나리오 | `backend/test/integration/acm-ama-exchange.int-spec.ts` |

### Phase 2 — Frontend (frontend-acm)

| Task | 설명 | 산출물 |
|---|---|---|
| **T-2.1** | API client `exchangeAma(amaToken)` | `frontend-acm/src/modules/auth/api/auth-api.ts` |
| **T-2.2** | LoginPage useEffect 자동 교환 + 스피너 + history.replaceState | `frontend-acm/src/modules/auth/pages/login-page.tsx` |
| **T-2.3** | locale 화이트리스트 적용 + i18n.changeLanguage + persist | 동일 |
| **T-2.4** | 에러 상태 (만료/위조/scope/appCode) i18n 키 + 안내 + AMA 복귀 링크 | `frontend-acm/src/i18n/{locale}/auth.json` |
| **T-2.5** | LoginPage break-glass 폼은 amaToken 처리 중에는 hidden, 실패 시 노출 | 동일 |
| **T-2.6** | E2E (Playwright) — AC-1, AC-3, AC-8 | `frontend-acm/e2e/ama-sso.spec.ts` (or 기존 e2e 폴더) |

### Phase 3 — Infra (nginx + env)

| Task | 설명 | 산출물 |
|---|---|---|
| **T-3.1** | nginx CSP `frame-ancestors` 추가 | `docker/staging/nginx-acm.conf` (+ production 카운터파트) |
| **T-3.2** | env vars 추가 (REQ §8.2) | `docker/staging/.env.staging` |
| **T-3.3** | `scripts/deploy-staging.sh` 실행 (nginx 재로드 포함) | — |
| **T-3.4** | 배포 후 헤더 검증 | `curl -sI https://acm-stg.amoeba.site/ \| grep -i frame-ancestors` |

### Phase 4 — Smoke + iframe 수동 검증

| Task | 설명 |
|---|---|
| **T-4.1** | AMA 포털에서 발급한 실 토큰으로 AC-1 통과 (브라우저 직접) |
| **T-4.2** | 임시 HTML 호스트 페이지로 AC-2 (iframe) 검증 — `docs/integration/ama-iframe-test.html` 임시 파일 생성·테스트 후 삭제 |
| **T-4.3** | DevTools Network/Console에서 CSP/CORS 위반 0건 확인 |

### Phase 5 — Doc + Report

| Task | 산출물 |
|---|---|
| **T-5.1** | CHANGELOG `[1.5.0]` 항목 |
| **T-5.2** | `docs/report/REPORT-{YYMMDD}-acm-ama-sso.md` |
| **T-5.3** | repo memory 갱신: AMA SSO live, env vars, secret 발급처 |
| **T-5.4** | `docs/integration/ama-platform-spec-asks.md` §3 A-2 Response 칸 채우기 (실제 채택 방식 기록) |

---

## 3. UI Mockups (ASCII 와이어프레임)

### 3.1 자동 로그인 진행 (스플래시) — `/login?ama_token=...`

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                                                             │
│                       [ AMA Logo ]                          │
│                                                             │
│                  AMA 인증을 처리하는 중...                  │
│                                                             │
│                  ◯ ◯ ◯  (loading spinner)                  │
│                                                             │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

성공 시 즉시 `/dashboard` 로 이동.

### 3.2 실패 — 만료/위조/scope/appCode

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       [ ⚠️  Logo ]                          │
│                                                             │
│              AMA 인증이 만료되었습니다                      │
│                                                             │
│    AMA 포털에서 다시 진입해 주세요. 문제가 계속되면         │
│    관리자에게 문의 부탁드립니다.                            │
│                                                             │
│         [ AMA 포털로 돌아가기 ]   [ 다시 시도 ]             │
│                                                             │
│         ─────────────  또는  ─────────────                  │
│                                                             │
│              관리자 직접 로그인 ▾  (break-glass)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

> "관리자 직접 로그인" 클릭 시 기존 email/password 폼 노출 (Q-3=(a) 정책).

### 3.3 break-glass 폼 (ama_token 없는 직접 접근)

```
┌─────────────────────────────────────────────────────────────┐
│                                              [언어 ▾]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                ┌─────────────────────────────┐              │
│                │  ACM 관리자 로그인           │              │
│                │                              │              │
│                │  Email    [...............] │              │
│                │  Password [...............] │              │
│                │                              │              │
│                │       [    로그인    ]       │              │
│                │                              │              │
│                │  ※ AMA 사용자는 AMA 포털을   │              │
│                │     통해 진입해 주세요.       │              │
│                └─────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 iframe 임베드 시 (AMA 포털 안)

```
[ AMA 포털 — 학원관리앱 탭 ]
┌──────────────────────────────────────────────────────────────────┐
│ ⌂ AMA   [홈] [거래처] [학원관리앱] [...]              👤 관리자 │
├──────────────────────────────────────────────────────────────────┤
│ ┌─ <iframe src="https://acm-stg.amoeba.site/login?ama_token..."> │
│ │                                                                │
│ │  ACM 사이드바 + 헤더 + 대시보드 (자동 로그인 완료 상태)         │
│ │  - 학생 관리                                                    │
│ │  - 상담 관리                                                    │
│ │  - 클래스 관리                                                  │
│ │  - ...                                                          │
│ │                                                                │
│ └────────────────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────────┘
```

부모 페이지의 헤더와 ACM 자체 헤더 중복은 향후 별도 layout flag(`?embed=1`)로 ACM 헤더를 축소/숨김 처리 가능 — **현 범위 외, 후속 검토**.

---

## 4. Sequence Diagram (순차도)

```
[Browser]                      [ACM SPA]                    [ACM API]              [DB]
    │                              │                            │                    │
    │ GET /login?ama_token=...     │                            │                    │
    │ ───────────────────────────► │                            │                    │
    │                              │ useEffect: parse params    │                    │
    │                              │ POST /api/acm/auth/ama-exchange { amaToken }    │
    │                              │ ─────────────────────────► │                    │
    │                              │                            │ verify HS256       │
    │                              │                            │ check exp/scope/appCode
    │                              │                            │ upsert user        │
    │                              │                            │ ─────────────────► │
    │                              │                            │ ◄───────────────── │
    │                              │                            │ sign ACM JWT       │
    │                              │ ◄───────────────────────── │                    │
    │                              │ setAuth(token, user)       │                    │
    │                              │ history.replaceState('/login')                  │
    │                              │ if locale → i18n.change    │                    │
    │ ◄ navigate('/dashboard')      │                            │                    │
    │                              │                            │                    │
    │ GET /dashboard               │                            │                    │
    │ ───────────────────────────► │ Authorization: Bearer ...  │                    │
    │                              │ ─────────────────────────► │                    │
```

---

## 5. Dependency Graph

```
T-0.1 (secret 발급) ──┐
T-0.2 (도메인 확정) ──┤
T-0.3 (break-glass) ──┘
                      ▼ (가정으로 우회 가능)
T-1.1 → T-1.5 → T-1.4 → T-1.6 → T-1.7 → T-1.8 → T-1.9 → T-1.10
                              ▲
                         T-1.2 / T-1.3
                              ▼
                  T-2.1 → T-2.2/2.3/2.4/2.5 → T-2.6
                              ▼
                  T-3.1 → T-3.2 → T-3.3 → T-3.4
                              ▼
                  T-4.1 → T-4.2 → T-4.3
                              ▼
                  T-5.1 → T-5.2 → T-5.3 → T-5.4
```

**Critical path**: T-1.2/1.4/1.6 → T-2.2 → T-3.1/3.3 → T-4.1/4.2

---

## 6. Risks & Mitigations

| ID | 리스크 | 가능성 | 영향 | 대응 |
|---|---|---|---|---|
| R-P1 | AMA 시크릿 미발급 → 운영 적용 지연 | 중 | 중 | dev secret로 staging까지 완료, 운영 전 시크릿 교체만 남김 |
| R-P2 | nginx CSP 잘못 설정 → ACM 자체 페이지에서도 동작 깨짐 | 낮 | 중 | `frame-ancestors`만 추가 (다른 directive 미사용) → 다른 정책 영향 없음 |
| R-P3 | iframe 환경에서 third-party storage(localStorage) 차단 (브라우저 정책) | 중 | 중 | 동일 출처(별도 도메인) iframe이라도 localStorage는 일반적으로 동작. Safari ITP 케이스만 제한 — fallback으로 Bearer 토큰만 사용 (cookie 미사용)으로 회피. iframe 내 sessionStorage도 백업으로 사용 검토 |
| R-P4 | AMA가 토큰 1시간 발급 → 사용자가 ACM에서 1시간 이상 작업 시 ACM JWT만 유효 | 낮 | 낮 | ACM JWT 자체 TTL = 8시간 (Spec §4.4 FR-AMA-32). 만료 시 재진입 안내 |
| R-P5 | E2E에서 AMA 토큰 mock 어려움 | 중 | 낮 | 백엔드 verifier에 환경변수로 dev secret 주입 → Playwright에서 Node에서 jsonwebtoken으로 토큰 직접 sign → URL 주입 |

---

## 7. Test Strategy 요약 (TC 문서는 별도 작성 예정)

| 분류 | 도구 | 범위 |
|---|---|---|
| Unit | Jest | verifier (signature/exp/scope/appCode/claims) |
| Integration | Jest + supertest | `/api/acm/auth/ama-exchange` 6 케이스 (AC-1, 3, 4, 5, 6, 7) |
| E2E | Playwright | AC-1, AC-3, AC-8 |
| Manual | Browser DevTools | AC-2 (iframe), CSP 위반 검증, locale=en |

---

## 8. Definition of Done

- [ ] Phase 0 결정 사항 모두 반영 (또는 가정 명시 유지)
- [ ] Phase 1~5 모든 Task ✓
- [ ] AC-1~8 통합/수동 PASS
- [ ] CHANGELOG / 보고서 / repo memory 갱신
- [ ] `docs/integration/ama-platform-spec-asks.md` A-2 Response 기록

---

## 9. Next

본 계획 승인 후:
1. **테스트 케이스**: `docs/test/TC-260505-acm-ama-sso.md`
   - AC 8건 + Phase 별 P0 1:1 매핑 / Unit/Integration/E2E/Manual 분류
2. 사용자 승인 후 Phase 0 (가능 시) → Phase 1~5 순차 구현 착수

---

> ⚠ **Draft 상태.** 사용자 승인 + Q-1~Q-5 회신 후 status=Approved.
