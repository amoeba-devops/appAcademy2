---
document_id: PLN-260604-ama-tenant-auth-and-user-directory
version: 2.0.0
status: draft
created: 2026-06-04
updated_at: 2026-06-04
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260604-ama-tenant-auth-and-user-directory.md (v2.0.0)
change_log:
  - 2026-06-04 — v1.0.0 — 초안 (단일 service 가정)
  - 2026-06-04 — v2.0.0 — REQ v2 반영: 2 service (stg-apps + ama platform), live 3-step 가드, mock-first 6 신규 env, T1 v1 (commit 6dfadc4) 를 보조 fallback 으로 흡수
---

# 작업 계획서 v2 — AMA 테넌트 인증 + 사용자 디렉터리

> [REQ-260604 v2](../analysis/REQ-260604-ama-tenant-auth-and-user-directory.md) 의 9 FR 을 6 트랙으로 분해. T1 v1 (구독 로컬 캐시 가드, 이미 배포 `6dfadc4`) 은 v2 에서 **보조 fallback** 으로 흡수.

---

## 1. 트랙 개요

```
T1 (v1, DONE @ 6dfadc4)  로컬 캐시 구독 가드          [흡수 — 보조 fallback]
                          academy-subscription.guard.ts
                          + 4 locale i18n
                          + 8 unit test

Track T2   stg-apps Subscription Client      ~ 2h    BE
T2-01  StgAppsSubscriptionClient (interface + DTO)        0.3h
T2-02  Mock client (5 status fixture)                     0.4h
T2-03  Http client (Bearer / HMAC) + retry/timeout        0.5h
T2-04  SubscriptionCheckService — live + cache fallback   0.4h
T2-05  단위 테스트 (3 모드: live OK / live 5xx + cache / live 5xx + stale) 0.4h

Track T3   ama Platform Membership Guard    ~ 1.5h   BE
T3-01  AmaPlatformClient — assertMember(entityId, userId) 0.4h
T3-02  Mock + Http impl                                   0.4h
T3-03  UserMembershipGuard + integration in exchangeAmaToken 0.3h
T3-04  단위 테스트                                        0.4h

Track T4   ama Platform Directory + LRU      ~ 2h    BE
T4-01  AmaPlatformClient.searchUsers(...)                 0.4h
T4-02  AmaUserDirectoryService + LRU 60s                  0.5h
T4-03  GET /api/acm/ama/users controller                  0.4h
T4-04  화이트리스트 강제 (OWNER 제외 서버측)              0.2h
T4-05  단위 + E2E 테스트                                  0.5h

Track T5   Frontend Picker + Modal 통합     ~ 1.5h   FE
T5-01  AmaUserPicker 공통 컴포넌트                        0.5h
T5-02  ama-user-api.ts                                    0.2h
T5-03  Tch/Stf modal 통합                                 0.4h
T5-04  i18n 4 locale × 12 키                              0.2h
T5-05  Login page 신규 에러 코드 (3종)                    0.2h

Track T6   AMA 팀 계약 + 실연동             외부 의존
T6-01  endpoint 3종 + 인증 방식 협의
T6-02  AMA_APPSTORE_SERVICE_TOKEN + AMA_PLATFORM_SERVICE_TOKEN 발급
T6-03  mock → http 전환 (AMA_SERVICES_MODE=http)
T6-04  staging 통합 + production 배포
```

**합계** (T2 ~ T5 mock-first): ≈ **7h**. T6 은 외부 의존.

---

## 2. UI 목업 (v2 변경 부분만)

### 2.1 로그인 차단 — 신규 에러 코드 (T5-05)

```
v1 (기존):
  SUBSCRIPTION_SUSPENDED / CANCELED / DEPROVISIONED / NO_ACADEMY

v2 (추가):
  NO_SUBSCRIPTION       — stg-apps 응답 NOT_SUBSCRIBED 또는 404
  USER_NOT_IN_ENTITY    — ama 멤버십 404
  AMA_UNAVAILABLE       — stg-apps 또는 ama 5xx/timeout + 로컬 캐시 stale

화면 예 (USER_NOT_IN_ENTITY):
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│                    ACM admin login                            │
│                                                               │
│       ⚠️  이 entity 의 구성원이 아닙니다                       │
│                                                               │
│   로그인하시려는 사용자가 해당 법인 (entity_id: tpi-…4f8a)     │
│   에 등록되지 않았습니다. AMA 관리자에게 권한 추가를 요청해    │
│   주세요.                                                     │
│                                                               │
│   [   AMA 관리자에게 요청  ↗  ]   [  break-glass 로그인  ]    │
└───────────────────────────────────────────────────────────────┘

화면 예 (AMA_UNAVAILABLE — degraded):
┌───────────────────────────────────────────────────────────────┐
│  ⚠️  AMA 서비스에 일시적으로 연결할 수 없습니다                │
│                                                               │
│  자동 재시도 중… 잠시 후 다시 시도해 주세요.                   │
│  ↻ 30초 후 자동 새로고침                                       │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Tch/Stf 추가 모달 (v1 과 동일 — REQ v1 § 2.2 참조)

목업은 REQ v1 § 2.2 그대로 (검색 → 결과 → 선택 → 자동 채움). 단 결과 행 우측 level 뱃지는 ama 응답의 실제 level 표시 (MANAGER/MEMBER/VIEWER).

### 2.3 흐름도 (v2 — 3-step gate)

```
[Login flow]
 entry  ──► /admin/login?ama_token=…
  │
  ▼
 POST /api/acm/auth/ama-exchange { amaToken }
  │
  ├─ [Step 1] AmaTokenVerifier  (기존)
  │    ✗ invalid                  → 401/403 AMA_TOKEN_*
  │
  ├─ [Step 2] SubscriptionCheckService.check(entityId)
  │    ┌─ stg-apps live 호출 (3s timeout)
  │    │   200 ACTIVE/TRIALING    → 통과 + 로컬 캐시 갱신
  │    │   200 SUSPENDED 등        → 403 SUBSCRIPTION_<status>
  │    │   200 NOT_SUBSCRIBED|404  → 403 NO_SUBSCRIPTION
  │    │   5xx/timeout             → 로컬 캐시 fallback
  │    │                              age ≤ 24h + ACTIVE → 통과 (degraded)
  │    │                              그 외              → 503 AMA_UNAVAILABLE
  │
  ├─ [Step 3] UserMembershipGuard.assert(entityId, userId)
  │    ┌─ ama platform live 호출 (3s timeout)
  │    │   200                     → 통과
  │    │   404                     → 403 USER_NOT_IN_ENTITY
  │    │   5xx/timeout             → 503 AMA_UNAVAILABLE (fail-closed)
  │
  ├─ upsertAmaUser
  │
  └─ signJwt + return ACM token   → /admin/dashboard
```

---

## 3. Task 상세 (v2)

### T2-01 — StgAppsSubscriptionClient interface
**파일**: `backend/src/modules/acm-auth/infrastructure/stg-apps-subscription.client.ts` (NEW)

```ts
export type SubscriptionStatus =
  | 'ACTIVE' | 'TRIALING'
  | 'SUSPENDED' | 'CANCELED' | 'DEPROVISIONED'
  | 'NOT_SUBSCRIBED';

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan?: string | null;
  expiresAt?: string | null;
}

export interface IStgAppsSubscriptionClient {
  /**
   * @returns SubscriptionInfo on 200, null on 404 (NOT_SUBSCRIBED proxy).
   * @throws AmaServiceUnavailableException on 5xx/timeout (caller decides fallback).
   */
  checkSubscription(entityId: string, appCode: string): Promise<SubscriptionInfo | null>;
}

export const STG_APPS_SUBSCRIPTION_CLIENT = Symbol('STG_APPS_SUBSCRIPTION_CLIENT');
```

### T2-04 — SubscriptionCheckService (live + cache fallback)

**파일**: `backend/src/modules/acm-auth/application/subscription-check.service.ts` (NEW — T1 의 `academy-subscription.guard.ts` 를 흡수)

```ts
@Injectable()
export class SubscriptionCheckService {
  private readonly logger = new Logger(SubscriptionCheckService.name);
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000;  // 24h

  constructor(
    @InjectRepository(AcademyEntity) private readonly academyRepo: Repository<AcademyEntity>,
    @Inject(STG_APPS_SUBSCRIPTION_CLIENT) private readonly client: IStgAppsSubscriptionClient,
  ) {}

  async ensureActive(amaEntityId: string): Promise<{ degraded: boolean }> {
    // 1. live first
    try {
      const info = await this.client.checkSubscription(amaEntityId, 'tpi-acm');
      if (!info || info.status === 'NOT_SUBSCRIBED') {
        throw this.deny('NO_SUBSCRIPTION', amaEntityId);
      }
      if (!['ACTIVE', 'TRIALING'].includes(info.status)) {
        throw this.deny(`SUBSCRIPTION_${info.status}`, amaEntityId, info.status);
      }
      await this.refreshCache(amaEntityId, info);
      return { degraded: false };
    } catch (e) {
      if (e instanceof HttpException) throw e;  // explicit deny
      // 2. live 5xx/timeout → cache fallback
      return await this.cacheFallback(amaEntityId);
    }
  }

  private async cacheFallback(amaEntityId: string): Promise<{ degraded: true }> {
    const academy = await this.academyRepo.findOne({ where: { acdAmaTenantId: amaEntityId } });
    if (!academy) throw this.deny('NO_ACADEMY', amaEntityId);
    const age = Date.now() - new Date(academy.acdUpdatedAt).getTime();
    if (age > this.cacheTtlMs) {
      this.logger.warn(`live 실패 + cache stale (${Math.round(age / 3600_000)}h) entId=${amaEntityId}`);
      throw this.deny('AMA_UNAVAILABLE', amaEntityId);
    }
    if (!['ACTIVE', 'TRIALING'].includes(academy.acdSubscriptionStatus)) {
      throw this.deny(`SUBSCRIPTION_${academy.acdSubscriptionStatus}`, amaEntityId);
    }
    this.logger.warn(`degraded mode (live 5xx + cache hit) entId=${amaEntityId}`);
    return { degraded: true };
  }

  private async refreshCache(amaEntityId: string, info: SubscriptionInfo): Promise<void> {
    await this.academyRepo.update(
      { acdAmaTenantId: amaEntityId },
      { acdSubscriptionStatus: info.status, acdSubscriptionPlan: info.plan ?? null },
    );
  }

  private deny(code: string, entityId: string, status?: string): HttpException {
    this.logger.warn(`subscription denied entId=${entityId} code=${code}`);
    return new HttpException(
      { code, message: code, data: { entityId, status } },
      code === 'AMA_UNAVAILABLE' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.FORBIDDEN,
    );
  }
}
```

→ 기존 `AcademySubscriptionGuard` 는 deprecated 처리 (파일은 보존하되 import 0) 또는 `cacheFallback()` 으로 흡수.

### T3-01 — AmaPlatformClient

**파일**: `backend/src/modules/acm-auth/infrastructure/ama-platform.client.ts` (NEW)

```ts
export interface AmaPlatformUser {
  userId: string;
  entityId: string;
  level: 'OWNER' | 'MANAGER' | 'MEMBER' | 'VIEWER';
  name: string;
  email: string;
}

export interface IAmaPlatformClient {
  assertMember(entityId: string, userId: string): Promise<AmaPlatformUser | null>;
  searchUsers(entityId: string, q: string, levels: string[], limit: number): Promise<AmaPlatformUser[]>;
}

export const AMA_PLATFORM_CLIENT = Symbol('AMA_PLATFORM_CLIENT');
```

### T3-03 — exchangeAmaToken 3-step 통합

**파일**: `backend/src/modules/acm-auth/application/acm-auth.service.ts` (MOD)

```diff
   payload = this.amaVerifier.verify(amaToken);
-  await this.subscriptionGuard.ensureActive(payload.entityId);
+  // Step 2 (FR-1) — live 구독 확인, fallback to cache (FR-9)
+  const subCheck = await this.subscriptionCheck.ensureActive(payload.entityId);
+  // Step 3 (FR-2) — entity 멤버십 확인 (live, fail-closed)
+  const member = await this.platformClient.assertMember(payload.entityId, payload.sub);
+  if (!member) {
+    throw new HttpException({ code: 'USER_NOT_IN_ENTITY' }, HttpStatus.FORBIDDEN);
+  }
+  if (subCheck.degraded) {
+    this.logger.warn(`login in degraded mode entId=${payload.entityId} userId=${payload.sub}`);
+  }
   const user = await this.upsertAmaUser(payload);
```

### T4-04 — 화이트리스트 강제 (서버측 OWNER 제외)

**파일**: `backend/src/modules/acm-auth/application/ama-user-directory.service.ts`

```ts
const ALLOWED_LEVELS = ['MANAGER', 'MEMBER', 'VIEWER'] as const;

async search(entityId: string, opts: SearchOpts): Promise<AmaPlatformUser[]> {
  // 클라이언트가 level 강제로 OWNER 넣어도 무시
  const safeLevels = (opts.levels ?? []).filter((l) => ALLOWED_LEVELS.includes(l as any));
  if (!safeLevels.length) safeLevels.push(...ALLOWED_LEVELS);
  // ... 캐시 + ama call ...
  const result = await this.client.searchUsers(entityId, opts.q ?? '', safeLevels, opts.limit ?? 10);
  // 응답에도 다시 강제 (방어적 코딩)
  return result.filter((u) => ALLOWED_LEVELS.includes(u.level as any));
}
```

### T5 — Frontend (REQ v1 § 2.2 와 동일)
- AmaUserPicker (300ms debounce, skeleton/empty/error)
- ama-user-api.ts
- Tch/Stf modal 통합
- i18n 신규 키 3종 추가 (`ama.errors.NO_SUBSCRIPTION` / `USER_NOT_IN_ENTITY` / `AMA_UNAVAILABLE`)

---

## 4. 일정 (단일 개발자, mock-first)

```
Day 1 (오후 4h)
  13:00 ~ 13:30  T2-01/02 stg-apps client interface + mock
  13:30 ~ 14:00  T2-03    Http client
  14:00 ~ 14:30  T2-04    SubscriptionCheckService 통합
  14:30 ~ 15:00  T2-05    단위 테스트
  15:00 ~ 15:30  T3-01/02 AmaPlatformClient interface + mock + http
  15:30 ~ 16:00  T3-03/04 Membership guard + integration + tests

Day 2 (오전 3h)
  09:00 ~ 09:30  T4-01    searchUsers 추가
  09:30 ~ 10:00  T4-02/03 Directory service + controller
  10:00 ~ 10:15  T4-04    화이트리스트 강제
  10:15 ~ 10:45  T4-05    테스트
  10:45 ~ 11:15  T5-01/02 AmaUserPicker + client
  11:15 ~ 11:45  T5-03/04 Modal 통합 + i18n
  11:45 ~ 12:00  T5-05    Login 에러 코드 + smoke
```

→ ≈ **7h** (Day 1 + Day 2 오전). T6 은 외부.

---

## 5. 환경 변수 (신규 6 + 기존)

`.env.production` (서버에 직접 적용, repo 의 `.env.production.example` 도 갱신):

```bash
# === REQ-260604 v2 신규 ===
# AMA App Store (구독 서비스)
AMA_APPSTORE_BASE_URL=https://stg-apps.amoeba.site
AMA_APPSTORE_SERVICE_TOKEN=REPLACE_ME_FROM_AMA            # 발급 대기
AMA_APPSTORE_TIMEOUT_MS=3000

# AMA Platform (디렉터리)
AMA_PLATFORM_BASE_URL=https://ama.amoeba.site
AMA_PLATFORM_SERVICE_TOKEN=REPLACE_ME_FROM_AMA            # 발급 대기
AMA_PLATFORM_TIMEOUT_MS=3000

# 토글 — 둘 다 mock-first 로 시작
AMA_SERVICES_MODE=mock                                    # mock | http

# === 기존 (REQ-260525) — 유지 ===
AMA_JWT_SECRET=...                                        # JWT 검증
AMA_JWT_ALLOWED_APP_CODES=tpi-acm
AMA_WEBHOOK_SECRET=...                                    # 구독 이벤트 push 검증
```

---

## 6. 리스크 → 완화 매핑 (v2)

| RID (REQ §10) | Task | 완화 |
|---------------|------|------|
| R-1 AMA endpoint 미존재 | T2/T3/T4 mock client | `AMA_SERVICES_MODE=mock` 토글 |
| R-2 stg-apps 5xx → 마비 | T2-04 cache fallback | 24h 캐시 + degraded mode banner |
| R-3 latency 증가 | T2-03 / T3-01 | 3s timeout, 1 retry, LRU 60s |
| R-4 OWNER 노출 | T4-04 | 서버측 화이트리스트 강제 |
| R-5 userId 매핑 | T3-01 | AMA 응답의 userId 와 JWT sub 비교 |
| R-6 T1/v2 중복 | T2-04 | T1 의 가드는 deprecated → SubscriptionCheckService 가 흡수 |

---

## 7. 변경 파일 매니페스트 (v2)

```
backend/src/modules/acm-auth/
├── infrastructure/
│   ├── stg-apps-subscription.client.ts          [NEW T2-01]
│   ├── stg-apps-subscription-mock.client.ts     [NEW T2-02]
│   ├── stg-apps-subscription-http.client.ts     [NEW T2-03]
│   ├── ama-platform.client.ts                   [NEW T3-01]
│   ├── ama-platform-mock.client.ts              [NEW T3-02]
│   └── ama-platform-http.client.ts              [NEW T3-02]
├── application/
│   ├── academy-subscription.guard.ts            [DEPRECATED T1 — 흡수됨]
│   ├── academy-subscription.guard.spec.ts       [DEPRECATED]
│   ├── subscription-check.service.ts            [NEW T2-04]
│   ├── subscription-check.service.spec.ts       [NEW T2-05]
│   ├── user-membership.guard.ts                 [NEW T3-03]
│   ├── user-membership.guard.spec.ts            [NEW T3-04]
│   ├── ama-user-directory.service.ts            [NEW T4-02]
│   ├── ama-user-directory.service.spec.ts       [NEW T4-05]
│   └── acm-auth.service.ts                      [MOD T3-03]
├── presentation/
│   └── ama-user.controller.ts                   [NEW T4-03]
└── acm-auth.module.ts                           [MOD providers]

frontend-acm/src/
├── modules/auth/pages/login-page.tsx            [MOD T5-05]
├── modules/common/components/ama-user-picker.tsx[NEW T5-01]
├── modules/common/api/ama-user-api.ts           [NEW T5-02]
├── modules/tch/components/tch-form-modal.tsx    [MOD T5-03]
├── modules/stf/components/stf-form-modal.tsx    [MOD T5-03]
└── i18n/locales/{ko,en,vi,zh-CN}/{auth,common}.json  [MOD T5-04] × 8

docker/{staging,production}/.env.{staging,production}.example [MOD]
docs/
├── analysis/REQ-260604-... (v2.0.0)             [DONE]
├── plan/PLN-260604-... (v2.0.0)                 [본 파일]
└── implementation/RPT-260604-...                 [NEW after T5]
```

**총**: 신규 12 + 변경 8 + 문서 3 = **23 파일**.

---

## 8. 사용자 승인 필요 항목 (v2)

1. **2-service 아키텍처** (§ 1) — `ama.amoeba.site` 와 `stg-apps.amoeba.site` 의 역할 분리 정확한가요?
2. **AMA API 계약** (§ 6) — 3 endpoint 의 URL/응답 shape 가 합리적인가요? (AMA 팀 확인 필요)
3. **인증 방식** (§ 6.1) — 서비스 토큰 (Bearer) 권장 — OK?
4. **24h cache fallback** (FR-9) — stg-apps 5xx 시 24h 안의 ACTIVE 캐시면 통과 (degraded). 24h 보다 길면 fail-closed. 적절한가요? (12h / 48h 등 조정 가능)
5. **T1 v1 (commit 6dfadc4) deprecate** — v2 의 SubscriptionCheckService 가 흡수. 별건 cleanup commit OK?
6. **Mock-first** — T6 AMA 팀 합의 전 mock client 로 production deploy. OK?

---

## 9. 다음 단계

1. 본 PLN v2 사용자 승인 ← 현재 단계
2. T2-01..05 (stg-apps client + service + tests)
3. T3-01..04 (ama platform membership + integration)
4. T4-01..05 (directory + controller + tests)
5. T5-01..05 (frontend Picker + modal + i18n + login errors)
6. localhost smoke → staging deploy → production deploy (mock 모드)
7. (T6 별건) AMA 팀 endpoint 합의 → http 모드 전환
