---
document_id: REQ-260604-ama-tenant-auth-and-user-directory
version: 2.0.0
status: draft
created: 2026-06-04
updated_at: 2026-06-04
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260525-app-academy-ama-jwt-단일화.md   # JWT passthrough 단일화 (선행)
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md                  # AMA SSO 원본 요구사항
  - docs/analysis/AMA-APP-STORE-PIVOT-REQ-1.0.0.md          # AMA App Store 피벗
  - backend/src/modules/acm-auth/**                          # JWT 검증 + ACM 토큰 발급
  - backend/src/modules/acm-auth/application/academy-subscription.guard.ts  # T1 (v1) — 로컬 캐시 가드 (v2 에서 보조 fallback)
  - backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts  # 구독 webhook 수신 (유지)
  - backend/src/infrastructure/database/entities/academy.entity.ts            # acd_subscription_status (캐시)
change_log:
  - 2026-06-04 — v1.0.0 — 초안. webhook 캐시 단일 출처 가정 (단일 service).
  - 2026-06-04 — v2.0.0 — **사용자 구두 명세 반영**. AMA 측 2 service 분리 명시 (ama.amoeba.site / stg-apps.amoeba.site), 로그인 시 **live 2-step 확인** (구독 + entity 멤버십), tch/stf 디렉터리는 ama platform 사용. T1 의 webhook 캐시 가드는 보조 fast-path 로 재정의.
---

# 요구사항 분석서 v2 — AMA 테넌트 인증 + 사용자 디렉터리

> Production `acm.amoeba.site` 가 **AMA 의 두 service** (`ama.amoeba.site` 플랫폼 · `stg-apps.amoeba.site` 구독) 와 연동되어, **JWT entity_id → 구독 활성 → 사용자-entity 소속 3 단계 확인** 후에만 로그인되도록 한다. 교사·교직원 추가는 `ama.amoeba.site` 디렉터리에서 검색하여 자동 채움한다.

---

## 1. AMA 측 Service 아키텍처 (사용자 명세 v2)

| Domain | 역할 | ACM 가 호출 |
|--------|------|-------------|
| **`ama.amoeba.site`** | AMA Platform — 사용자(법인 구성원) 디렉터리, JWT 발급, entity·user 관리 | ✅ 사용자-entity 멤버십 확인, 사용자 검색 |
| **`stg-apps.amoeba.site`** | AMA App Store (현재 staging) — **구독 (subscription) 서비스**. 각 법인의 app 별 구독 상태 관리 | ✅ entity 의 app-academy 구독 활성 확인 |
| ACM 의 `/webhooks/ama/subscription` | (기존) AMA → ACM push. lifecycle 이벤트 (`PROVISION`/`SUSPEND`/`CANCEL`/`DEPROVISION`) 수신 | 입력 (push 받기만) |

→ stg-apps 와 ama 는 **동일 AMA 조직의 서로 다른 service**. ACM 는 둘 다 outbound HTTP 호출.

> 사용자 확인 사항 (v1 부터): "스테이징 구독서비스 확인 연동 완료" — AMA 측 stg-apps service 자체는 ACM 의 connection 준비 완료된 상태로 가정. ACM 의 outbound client 는 본 REQ 에서 신규 구현.

---

## 2. 요구사항 (Functional Requirements)

| # | 요구사항 | v1 vs v2 |
|---|---------|----------|
| **FR-1** | `/admin/login` 진입 시 AMA JWT 검증 후 **stg-apps 에 live 구독 확인** | v1: 로컬 캐시만 → v2: **stg-apps live + 로컬 캐시 fallback** |
| **FR-2** | 구독 활성 통과 후 **ama 에 user-entity 멤버십 확인** (JWT 의 user 가 같은 entity 소속인지) | **신규** (v1 에 없음) |
| **FR-3** | `/admin/tch` 교사 추가 시 **ama 디렉터리 검색** + USER_LEVEL 필터 + 자동 채움 | v1 와 동일 (URL 만 ama.amoeba.site) |
| **FR-4** | `/admin/stf` 교직원 추가 시 FR-3 와 동일 패턴 | v1 와 동일 |
| **FR-5** | 디렉터리 검색은 USER_LEVEL ∈ {MANAGER, MEMBER, VIEWER} 만 노출 (OWNER 제외, **사용자 확인됨**) | 동일 |
| **FR-6** | 테넌트 격리는 AMA `entity_id` 키로 한다 — 다른 entity 노출 금지 | 동일 |
| **FR-7** | AMA service 미응답/오류 시 graceful: 로그인 — fail-closed (안전 우선) / 디렉터리 — fallback 수동 입력 | v1 와 동일 |
| **FR-8** | break-glass 이메일/비번 로그인 100% 호환 (구독 체크 우회) | 동일 |
| **FR-9** | 로컬 캐시 (T1 의 `acd_subscription_status`) 는 stg-apps live 호출 실패 시 **보조 fallback**. 단 cache age > 24h 이면 가드 거부 | **재정의** |

## 3. 비기능 요구사항 (NFR)

- **NFR-1 (Security)** ACM ↔ AMA outbound 는 모두 서버 사이드. Service token (Bearer) 또는 HMAC 서명 — AMA 팀 결정
- **NFR-2 (i18n)** 4 locale (ko/en/vi/zh-CN) 동시
- **NFR-3 (Latency)** 로그인 = JWT 검증 (~10ms) + stg-apps 호출 (~150ms) + ama 멤버십 (~150ms) + upsert (~50ms) ≤ **500ms p95**
- **NFR-4 (Auditability)** 모든 차단 사유 backend log + acm-auth audit table 기록
- **NFR-5 (Cache)** 디렉터리 검색 LRU 60s. 구독 결과는 캐시 안 함 (fresh-always — 단 webhook 으로 즉시 invalidate)
- **NFR-6 (Timeout)** stg-apps / ama 호출 timeout 3s. timeout 시 fail-closed (로그인 거부)

---

## 4. AS-IS 현황 (v2 갱신)

### 4.1 인증 (`/admin/login`) — T1 v1 적용 후
| 구성 | 상태 |
|------|------|
| JWT 검증 (HS256, scope, appCode) | ✅ [ama-token.verifier.ts](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts) |
| 로컬 캐시 구독 가드 (`acd_subscription_status`) | ✅ [academy-subscription.guard.ts](../../backend/src/modules/acm-auth/application/academy-subscription.guard.ts) (T1, commit `6dfadc4`) |
| **stg-apps live 구독 확인** | ❌ **신규 — FR-1 대상** |
| **ama user-entity 멤버십 확인** | ❌ **신규 — FR-2 대상** |
| 사용자 upsert | ✅ [acm-auth.service.ts:264-313](../../backend/src/modules/acm-auth/application/acm-auth.service.ts#L264-L313) |
| 구독 이벤트 webhook 수신 | ✅ [ama-subscription-webhook.controller.ts](../../backend/src/presentation/webhooks/ama-subscription-webhook.controller.ts) |

### 4.2 기존 AMA HTTP client (별 도메인)
| 구성 | 상태 | 비고 |
|------|------|------|
| `AmaClientHttpService` (Client master mirror) | ✅ | `GET /api/v1/clients/:id` 등 — **다른 도메인용**. 본 REQ 의 ama platform / stg-apps 호출과 별개 |
| `AMA_MODE=mock|http` 토글 패턴 | ✅ | 본 REQ 도 동일 패턴 적용 (mock-first) |
| Bearer + HMAC 서명 패턴 | ✅ | [ama-signature.util.ts](../../backend/src/infrastructure/external/ama/ama-signature.util.ts) — 신규 client 도 재사용 |

### 4.3 교사·교직원 폼
| 구성 | 상태 |
|------|------|
| `TchFormModal` / `StfFormModal` — 수동 name·email 입력 | ✅ |
| **ama 디렉터리 검색** | ❌ 신규 (FR-3/4) |
| `USER_LEVEL` enum | ❌ ACM 측 미정의 (FR-5 에서 정의) |

---

## 5. TO-BE 흐름

### 5.1 로그인 (FR-1, FR-2)

```
[AMA platform] → user clicks "app-academy" tile → AMA issues JWT
  redirect: https://acm.amoeba.site/admin/login?ama_token=<JWT>
  ↓
[ACM frontend] auto-detects ?ama_token → POST /api/acm/auth/ama-exchange
  ↓
[ACM backend] AmaTokenVerifier.verify(amaToken)
  → payload { entityId, sub (=userId), email, role, ... }
  ↓
[NEW] StgAppsSubscriptionClient.checkSubscription(entityId, appCode="tpi-acm")
  HTTP GET https://stg-apps.amoeba.site/api/v1/subscriptions
    ?entityId={entityId}&appCode=tpi-acm
  Authorization: Bearer ${AMA_APPSTORE_SERVICE_TOKEN}    (또는 HMAC)
  → 200 { status: "ACTIVE", plan, expiresAt }    → 통과
  → 200 { status: "SUSPENDED"|"CANCELED"|"DEPROVISIONED" } → 403 SUBSCRIPTION_<status>
  → 200 { status: "NOT_SUBSCRIBED" } 또는 404           → 403 NO_SUBSCRIPTION
  → 5xx / timeout                                       → 로컬 캐시 fallback (FR-9)
        ↳ cache age ≤ 24h + cache says ACTIVE          → 통과 (degraded mode flag)
        ↳ 그 외                                         → 503 AMA_UNAVAILABLE
  ↓
[NEW] AmaPlatformMembershipClient.assertMember(entityId, userId)
  HTTP GET https://ama.amoeba.site/api/v1/entities/{entityId}/users/{userId}
  Authorization: Bearer ${AMA_PLATFORM_SERVICE_TOKEN}
  → 200 { userId, entityId, level }    → 통과
  → 404                                → 403 USER_NOT_IN_ENTITY
  → 5xx / timeout                      → 503 AMA_UNAVAILABLE (fail-closed)
  ↓
upsertAmaUser(payload) → ACM JWT 발급 → 로그인 성공
```

### 5.2 교사·교직원 추가 (FR-3, FR-4, FR-5)

```
[Admin] /admin/tch → "교사 추가" 클릭 → <TchFormModal>
  ↓ <AmaUserPicker>
GET /api/acm/ama/users?level=MANAGER,MEMBER,VIEWER&q=김
  ↓
[backend] AmaUserDirectoryService.search(entityId, query, levels)
  → 캐시 hit → return
  → cache miss →
    AmaPlatformDirectoryClient.searchUsers(entityId, query, levels)
    HTTP GET https://ama.amoeba.site/api/v1/entities/{entityId}/users
      ?q={query}&level=MANAGER,MEMBER,VIEWER&limit=10
    Authorization: Bearer ${AMA_PLATFORM_SERVICE_TOKEN}
  → [{ userId, name, email, level, avatarUrl? }, ...]
  → backend 에서 다시 한 번 level 화이트리스트 강제 (서버 사이드 방어)
  → 60s LRU 캐시
  → return to frontend
  ↓
[Modal] 선택 → POST /api/acm/tch/teachers { tchName, tchEmail, tchAmaUserId, ... }
```

---

## 6. AMA Service API 계약 (의존성)

본 REQ 는 **AMA 팀이 3 endpoint 를 제공** 한다고 가정. 계약 합의 필요:

| # | Service | Endpoint | 응답 | 용도 |
|---|---------|----------|------|------|
| **A1** | `stg-apps.amoeba.site` | `GET /api/v1/subscriptions?entityId=…&appCode=tpi-acm` | `{ status: ACTIVE\|TRIALING\|SUSPENDED\|CANCELED\|DEPROVISIONED\|NOT_SUBSCRIBED, plan?, expiresAt? }` | FR-1 로그인 시 구독 확인 |
| **A2** | `ama.amoeba.site` | `GET /api/v1/entities/{entityId}/users/{userId}` | `{ userId, entityId, level, name, email }` 또는 404 | FR-2 멤버십 확인 |
| **A3** | `ama.amoeba.site` | `GET /api/v1/entities/{entityId}/users?q=&level=…&limit=10` | `[{ userId, name, email, level, avatarUrl? }, ...]` | FR-3/4 디렉터리 검색 |

### 6.1 인증 방식 (제안 — AMA 팀 결정 대기)

| 옵션 | 장단점 |
|------|--------|
| **(a) Service token (Bearer)** | ✅ 간단 ✅ AMA 측 발급만 / ❌ 토큰 rotation 정책 필요 |
| (b) HMAC 서명 (timestamp + signature) | ✅ 보안 강 ✅ 기존 `ama-signature.util.ts` 재사용 / ❌ AMA 측 추가 작업 |
| (c) 사용자 JWT pass-through | ❌ 사용자별이라 캐시 효율↓ ❌ user 만 호출 가능 (서버 시점 호출 불가) |

→ **권장 (a) + 토큰 rotation 90일**. 향후 (b) 로 업그레이드 가능.

---

## 7. USER_LEVEL 의미 (확정)

| Level | AMA 의미 | ACM 디렉터리 노출 |
|-------|---------|------------------|
| OWNER | 법인 대표 | ❌ 제외 (FR-5) |
| **MANAGER** | 법인 관리자 | ✅ |
| **MEMBER** | 일반 사용자 | ✅ |
| **VIEWER** | 조회 전용 | ✅ |

USER_LEVEL 은 ACM 자체 권한 (acm_user.role: ADMIN/TEACHER/STAFF) 과 **별도**. AMA 디렉터리 메타데이터일 뿐 ACM 권한 결정에는 사용 안 함.

---

## 8. 수용 기준 (Acceptance Criteria — v2)

| AC ID | 시나리오 | 기대 결과 |
|-------|----------|----------|
| **AC-1 (구독)** | | |
| AC-1-1 | stg-apps ACTIVE + ama 멤버 확인 + 유효 JWT | 로그인 성공 → /admin/dashboard |
| AC-1-2 | stg-apps SUSPENDED | 403 `SUBSCRIPTION_SUSPENDED` + 안내 카드 |
| AC-1-3 | stg-apps NOT_SUBSCRIBED 또는 404 | 403 `NO_SUBSCRIPTION` + AMA App Store 링크 |
| AC-1-4 | stg-apps 5xx + 로컬 캐시 age ≤ 24h + ACTIVE | 통과 (degraded mode 로그 + UI banner) |
| AC-1-5 | stg-apps 5xx + 로컬 캐시 age > 24h 또는 not ACTIVE | 503 `AMA_UNAVAILABLE` |
| **AC-2 (멤버십)** | | |
| AC-2-1 | JWT 의 user 가 entity 멤버 | 통과 |
| AC-2-2 | JWT 의 user 가 entity 멤버 아님 (404) | 403 `USER_NOT_IN_ENTITY` |
| AC-2-3 | ama 5xx / timeout | 503 `AMA_UNAVAILABLE` (fail-closed) |
| **AC-3 (Tch/Stf 검색)** | | |
| AC-3-1 | "김" 입력 → 결과 ≤ 10 노출 | 이름·이메일·level 뱃지 |
| AC-3-2 | 선택 → name + email 자동 채움 | ✓ |
| AC-3-3 | OWNER 사용자 (Burp 로 level=OWNER 강제) | 서버 사이드에서 무시, 결과에 미포함 |
| AC-3-4 | 다른 entity 의 사용자 위조 호출 | OwnEntityGuard 차단 — HTTP 403 |
| AC-3-5 | ama 503 / timeout | "디렉터리 검색 실패 — 수동 입력" fallback |
| **AC-4 (Misc)** | | |
| AC-4-1 | 이메일/비번 break-glass 로그인 | 모든 AMA 가드 우회 (의도) |
| AC-4-2 | i18n parity 4 locale | jq 결과 동일 |

---

## 9. 영향 범위 (v2)

### 9.1 Backend (≈12 파일)
**신규**
- `acm-auth/infrastructure/stg-apps-subscription.client.ts` — stg-apps HTTP client (mock + http)
- `acm-auth/infrastructure/stg-apps-subscription.mock.ts`
- `acm-auth/infrastructure/ama-platform.client.ts` — ama platform HTTP client (membership + directory)
- `acm-auth/infrastructure/ama-platform.mock.ts`
- `acm-auth/application/subscription-check.service.ts` — stg-apps + 로컬 캐시 통합 (T1 가드 흡수/대체)
- `acm-auth/application/user-membership.guard.ts`
- `acm-auth/ama-directory/` 디렉터리 — service / controller / cache (T2 와 통합)

**변경**
- `acm-auth.service.ts` — exchangeAmaToken 3-step 가드 적용
- `acm-auth.module.ts` — provider 주입
- `.env.production.example` + `.env.staging.example` — 6 신규 키
- `tch-form-modal.tsx`, `stf-form-modal.tsx`
- `login-page.tsx` — 신규 에러 코드 (`USER_NOT_IN_ENTITY`, `NO_SUBSCRIPTION`, `AMA_UNAVAILABLE`)

### 9.2 Frontend-acm (≈6 파일)
- `ama-user-picker.tsx` (NEW)
- `ama-user-api.ts` (NEW)
- `tch-form-modal.tsx` (MOD)
- `stf-form-modal.tsx` (MOD)
- `login-page.tsx` (MOD — 신규 에러 코드)
- `i18n/auth.json` × 4 locale (신규 키 3종)

### 9.3 환경변수 (신규)
```bash
# stg-apps (구독 서비스) outbound client
AMA_APPSTORE_BASE_URL=https://stg-apps.amoeba.site
AMA_APPSTORE_SERVICE_TOKEN=                            # AMA 팀 발급
AMA_APPSTORE_TIMEOUT_MS=3000

# ama platform (디렉터리) outbound client
AMA_PLATFORM_BASE_URL=https://ama.amoeba.site
AMA_PLATFORM_SERVICE_TOKEN=                            # AMA 팀 발급
AMA_PLATFORM_TIMEOUT_MS=3000

# mode toggle (mock 또는 http) — 둘 다 동일하게 적용
AMA_SERVICES_MODE=mock                                 # mock | http
```

### 9.4 DB Migration

- 없음 (모든 데이터는 기존 academy/user 테이블 + AMA live 응답)
- 단, **로컬 캐시 fallback (FR-9)** 위해 `acd_subscription_checked_at` 컬럼 추가 검토 (선택, v3)

---

## 10. 리스크

| RID | 리스크 | 완화 |
|-----|--------|------|
| R-1 | AMA 측 3 endpoint 미존재 | mock-first (`AMA_SERVICES_MODE=mock`) + AMA 팀 합의 후 http 전환 |
| R-2 | stg-apps 5xx 로 로그인 차단 → 운영 마비 | NFR-6: 로컬 캐시 fallback (FR-9). break-glass 로 admin 복구 |
| R-3 | ama 응답 latency 증가 → 로그인 ≥ 1s | NFR-3: 3s timeout, 캐시 60s, 1 retry |
| R-4 | OWNER 검색 결과 노출 (서버측 미필터) | A3 응답에서 backend 가 다시 화이트리스트 강제 |
| R-5 | 사용자 user_id ↔ AMA user_id 매핑 깨짐 | A2 응답에 `userId` 동일 사용. mismatch 시 USER_NOT_IN_ENTITY |
| R-6 | T1 v1 의 webhook 캐시 가드와 v2 의 live 호출 중복 | v2: webhook 캐시는 보조 fallback 으로만 사용. live 가 1차 |

---

## 11. v1 → v2 변경 요약

| 영역 | v1 (commit `944b13f`/`6dfadc4`) | v2 (본 REQ) |
|------|------|-----|
| 구독 출처 | 로컬 캐시 (`acd_subscription_status`) 만 | **stg-apps live** + 로컬 캐시 fallback |
| 멤버십 확인 | ❌ 없음 (JWT entity_id 만 신뢰) | **ama platform live 확인** |
| AMA 호출 endpoint | 0 | 3 (A1/A2/A3) |
| 신규 env 변수 | 0 | 6 |
| 환경/architecture | 단일 service 가정 | 2 service 분리 (stg-apps + ama platform) |
| T1 위치 | 메인 가드 | **보조 fallback** |

---

## 12. 다음 단계

1. **본 REQ v2 사용자 승인** ← 현재 단계
2. PLN-260604 v2 작성 (UI 목업 + task 분해)
3. AMA 팀과 § 6 의 3 endpoint + § 6.1 인증 방식 합의
4. 합의 전: mock client 로 구현 진행 가능 (`AMA_SERVICES_MODE=mock`)
5. 합의 후: http client + 토큰 발급 → production 배포
