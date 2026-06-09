---
document_id: AMA-PLATFORM-SPEC-ASKS-1.0.0
title: AMA 플랫폼 팀 사전 협의 요청서 — 학원관리앱 등재
version: 1.0.0
status: OPEN (awaiting AMA team response)
date: 2026-04-27
owner: gray.kim@amoeba.group
audience: AMA Platform Team
related:
  - docs/analysis/AMA-APP-STORE-PIVOT-REQ-1.0.0.md
  - docs/implementation/tasks/AMA-APP-STORE-PIVOT-TASK-1.0.0.md
---

# AMA Platform — Spec Asks for "학원관리앱" 등재

> 본 문서는 학원관리앱(이하 **app-academy**)을 AMA 앱스토어에 독립 SaaS로 등재하기 위해 AMA 플랫폼 팀의 명세 확정이 필요한 항목을 정리한다. 회신 항목은 본 문서 §3 표의 "Response" 칸에 채워주시기 바란다.

---

## 1. Context (배경)

- 본 앱은 학원 운영 통합 관리 SaaS이며, AMA 사용자가 앱스토어에서 구독하면 자동 provisioning되어 즉시 사용 가능해야 한다.
- 결제·정산은 **AMA가 전담**하며, 본 앱은 lifecycle webhook만 수신한다.
- 본 앱의 인증은 **AMA SSO 단일** (자체 회원가입 없음, break-glass용 SUPERADMIN 계정만 예외).
- 도메인: `app-academy.amoeba.site` (production) / `app-academy-stg.amoeba.site` (staging)

---

## 2. Development Plan While Awaiting Response

명세 확정 전이라도 다음 가정으로 mock 구현을 진행한다:
- **인증**: HS256 short-lived JWT injection (`?ama_token=<JWT>` 쿼리, 1h 만료, scope=`custom_app:context`) — A-2 resolved 2026-05-25 (OIDC 채택 거절)
- **Webhook**: HTTPS POST + `X-AMA-Signature: HMAC-SHA256` + `X-AMA-Timestamp` + `X-AMA-Nonce` (P0-2 패턴 재사용)
- **사용자 식별자**: `sub` claim = AMA user ID (string, 64자 이내)
- **테넌트 식별자**: `entityId` claim = AMA tenant UUID

---

## 3. Spec Asks (명세 요청 8건)

| # | 항목 | 요청 내용 | Response |
|---|---|---|---|
| **A-1** | **앱 등록 카테고리·승인 절차** | "교육/학원관리" 카테고리 신규 등록 가능한가? 승인 SLA·심사 자료 체크리스트는? | _TBD_ |
| **A-2** | **SSO 표준** | ~~OIDC discovery URL, `client_id`/`client_secret` 발급 절차, scope 목록, userinfo 응답 스키마, 토큰 만료/리프레시 정책~~ | **Resolved 2026-05-25** — AMA 측 OIDC 미지원 확정. **HS256 short-lived JWT injection 채택** (`?ama_token=<JWT>` 쿼리 1h, scope=`custom_app:context`). [REQ-260525-app-academy-ama-jwt-단일화](../analysis/REQ-260525-app-academy-ama-jwt-단일화.md) 로 OIDC 코드·환경변수 정리 완료. |
| **A-3** | **Subscription Webhook 명세** | 이벤트 타입 enum (`SUBSCRIPTION_CREATED` / `ACTIVATED` / `SUSPENDED` / `RESUMED` / `CANCELED` / `PLAN_CHANGED`?), payload 스키마, HMAC 알고리즘·서명 헤더명·timestamp tolerance(±5분?), nonce 길이/형식, 재시도 정책(at-least-once 횟수·간격), 실패 시 dead-letter 방식 | _TBD_ |
| **A-4** | **Tenant ↔ User 멤버십 동기화** | (1) 사용자가 직접 직원 초대하는 모델인가, AMA가 멤버십을 관리하고 webhook으로 통보하는 모델인가? (2) 후자라면 `MEMBER_ADDED` / `MEMBER_REMOVED` / `ROLE_CHANGED` 이벤트 명세 필요 | _TBD_ |
| **A-5** | **AMA 거래처(교사) 마스터 API** | 학원관리앱은 AMA 거래처를 교사 마스터로 동기화한다. 기존 AMA Client API의 endpoint, 인증 방식(앱 토큰? 사용자 위임?), rate limit, 변경 이벤트(webhook or polling) | _TBD_ |
| **A-6** | **AmoebaTalk 알림 API** | 발신 식별자(앱 단위? 테넌트 단위?), 템플릿 사전 승인 절차, 비용 부담 주체(AMA 흡수 vs 앱 정산), 발신 quota | _TBD_ |
| **A-7** | **결제 책임 경계 + Deep Link** | (1) AMA 결제센터 deep link URL 패턴(`https://ama.../billing?app=academy&tenant={ama_tenant_id}`?) (2) 환불·플랜 변경 처리는 모두 AMA UI에서 진행됨이 맞나? (3) 본 앱이 webhook 외 결제 API를 호출할 일이 있나? | _TBD_ |
| **A-8** | **AMA 고객사(Client) 생성 API (write)** | REQ-260609 FR-C — 수강 결정 학부모를 entity 하위 고객사로 등록. 확인 필요: (1) endpoint — `POST /api/v1/entities/{entityId}/clients` 인가 `POST /api/v1/clients` (entityId in body)인가? (2) 인증 — read-only 미러링대로 `Bearer AMA_API_KEY` + HMAC(`X-Ama-Timestamp`,`X-Ama-Signature`) 맞나? (3) 요청 body 필수/선택 필드 (`name`+`phone`+`email` 외 사업자번호 등?) (4) 응답에 생성된 `amaClientId` 포함되나? (멱등키) (5) 중복(같은 이름/연락처) 시 동작 — 409+기존 id 반환 vs upsert? | _TBD_ — 그 전까지 `AMA_MODE=mock` 으로 검증, http 스위치만 대기 ([ama-client.service.ts](../../backend/src/infrastructure/external/ama/ama-client.service.ts) `createClient`) |

---

## 4. Optional / Phase 2 Asks

| # | 항목 | 비고 |
|---|---|---|
| B-1 | App-to-App deep link (AMA → 본 앱 특정 학생/수업으로 점프) | Phase 2 |
| B-2 | AMA 알림센터 통합 (본 앱 이벤트가 AMA 통합 알림함에도 표시) | Phase 2 |
| B-3 | 단일 사인아웃(SLO) — AMA 로그아웃 시 본 앱 세션도 종료 | Phase 2 |

---

## 5. Mocked Behavior (개발 중 본 앱이 가정하는 동작)

```
[ AMA HS256 JWT injection (정식 채택, A-2 resolved) ]
  Frontend 진입: /login?ama_token=<JWT>&locale=en
  Backend 검증: POST /api/acm/auth/ama-exchange  body={amaToken}
  Payload claims: sub, email, role, entityId, appId, appCode, scope, iat, exp(1h)
  검증 규칙: HS256 + scope=='custom_app:context' + appCode ∈ whitelist

[ AMA Subscription Webhook ]
  본 앱이 dev/test에서 직접 POST 호출 (curl) — 실제 AMA 호출 없음
  Endpoint: POST /webhooks/ama/subscription
  Headers:  X-AMA-Signature, X-AMA-Timestamp, X-AMA-Nonce
  Body:     { eventType, tenantId, plan, occurredAt, ... }
```

---

## 6. Timeline & Owner

- **회신 희망일**: S0 마감 (현 sprint +5d)
- **AMA 측 contact**: TBD
- **본 앱 측 contact**: gray.kim@amoeba.group
- 회신 받는 즉시 본 문서 §3 Response 컬럼을 채우고, 분석서/작업계획서를 갱신한다.
