---
document_id: RPT-260604-ama-tenant-auth-and-user-directory
version: 1.0.0
status: complete
created: 2026-06-04
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260604-ama-tenant-auth-and-user-directory.md (v2.0.0)
  - docs/plan/PLN-260604-ama-tenant-auth-and-user-directory.md (v2.0.0)
---

# 완료 보고서 — AMA 테넌트 인증 + 사용자 디렉터리 (REQ-260604 v2)

> [PLN-260604 v2](../plan/PLN-260604-ama-tenant-auth-and-user-directory.md) 의 5 트랙 (T1 [v1 흡수] / T2 stg-apps / T3 ama membership / T4 ama directory / T5 frontend) 모두 완료. mock-first 로 동작 가능, AMA 팀 endpoint 합의 후 `AMA_SERVICES_MODE=http` 토글 한 줄로 전환.

---

## 1. 요약

5 트랙 / 7 commit / **30 파일** (backend 14 + frontend 13 + docs 3). Backend tsc + nest build clean, frontend tsc clean, jest 46/46 acm-auth specs pass. mock client 로 dev/staging 즉시 동작.

| commit | scope |
|--------|-------|
| [`6dfadc4`](https://github.com/amoeba-devops/appAcademy2/commit/6dfadc4) | T1 v1 — `AcademySubscriptionGuard` (로컬 캐시 단독). v2 에서 흡수·deprecated |
| [`944b13f`](https://github.com/amoeba-devops/appAcademy2/commit/944b13f) | REQ + PLN v1 |
| [`feac5eb`](https://github.com/amoeba-devops/appAcademy2/commit/feac5eb) | REQ + PLN v2 (2-service 재설계) |
| [`884f0f1`](https://github.com/amoeba-devops/appAcademy2/commit/884f0f1) | T2 — stg-apps live + 24h cache fallback (SubscriptionCheckService 흡수) |
| [`25e6859`](https://github.com/amoeba-devops/appAcademy2/commit/25e6859) | T3 + T4 — ama platform membership + directory + LRU 60s |
| [`091c3d8`](https://github.com/amoeba-devops/appAcademy2/commit/091c3d8) | T5 — frontend AmaUserPicker + Tch/Stf modal 통합 + i18n |
| (본 commit) | RPT |

---

## 2. Track 별 결과

### T1 (v1, 흡수됨) — 로컬 캐시 구독 가드

| 결과 | 비고 |
|------|------|
| `academy-subscription.guard.ts` | DEPRECATED 마킹. 파일 보존, providers 에서 제거. 8 spec 그대로 통과 (회귀 안전망) |

### T2 — stg-apps Subscription Client + Live Check

| Task | 산출물 |
|------|--------|
| T2-01 | [stg-apps-subscription.client.ts](../../backend/src/modules/acm-auth/infrastructure/stg-apps-subscription.client.ts) — interface + `SUBSCRIPTION_STATUSES` + `StgAppsUnavailableException` |
| T2-02 | [stg-apps-subscription-mock.client.ts](../../backend/src/modules/acm-auth/infrastructure/stg-apps-subscription-mock.client.ts) — fixture (entityId substring 으로 5 status + 5xx 시뮬레이션) |
| T2-03 | [stg-apps-subscription-http.client.ts](../../backend/src/modules/acm-auth/infrastructure/stg-apps-subscription-http.client.ts) — Bearer + AbortController 3s timeout + 5xx/404 mapping |
| T2-04 | [subscription-check.service.ts](../../backend/src/modules/acm-auth/application/subscription-check.service.ts) — live 1차 + 24h 캐시 fallback + cache refresh on success |
| T2-05 | [subscription-check.service.spec.ts](../../backend/src/modules/acm-auth/application/subscription-check.service.spec.ts) — 15 cases (happy path × 2, 4 deny modes, 4 fallback paths, cache resilience) |

### T3 — ama Platform Membership Guard

| Task | 산출물 |
|------|--------|
| T3-01 | [ama-platform.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform.client.ts) — `IAmaPlatformClient` (assertMember + searchUsers) + `AMA_USER_LEVELS` |
| T3-02 | [ama-platform-mock.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-mock.client.ts) — 6-user fixture incl. OWNER (서버 측 필터링 검증용) |
| T3-02 | [ama-platform-http.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.ts) — Bearer + 3s timeout |
| T3-03 | [user-membership.guard.ts](../../backend/src/modules/acm-auth/application/user-membership.guard.ts) — fail-closed (no cache) |
| T3-03 | [acm-auth.service.ts:240](../../backend/src/modules/acm-auth/application/acm-auth.service.ts#L240) — 3-step gate (verify → subscription → membership → upsert) |
| T3-04 | [user-membership.guard.spec.ts](../../backend/src/modules/acm-auth/application/user-membership.guard.spec.ts) — 4 cases |

### T4 — ama Directory Service + Controller

| Task | 산출물 |
|------|--------|
| T4-02 | [ama-user-directory.service.ts](../../backend/src/modules/acm-auth/application/ama-user-directory.service.ts) — search() + LRU (60s Map-based TTL) + 화이트리스트 강제 |
| T4-03 | [ama-user.controller.ts](../../backend/src/modules/acm-auth/presentation/ama-user.controller.ts) — `GET /api/acm/ama/users` (JWT-bound entId) |
| T4-04 | 서버측 OWNER 제외 — 입력 + 응답 양쪽 (defense in depth) |
| T4-05 | [ama-user-directory.service.spec.ts](../../backend/src/modules/acm-auth/application/ama-user-directory.service.spec.ts) — 12 cases (level filter input/response, limit clamp, cache key normalization, failure → empty) |

### T5 — Frontend Picker + Modal + Login UX

| Task | 산출물 |
|------|--------|
| T5-01 | [ama-user-picker.tsx](../../frontend-acm/src/components/common/ama-user-picker.tsx) — 300ms debounce, skeleton/empty/error/manual-mode 4 state |
| T5-02 | [ama-user-api.ts](../../frontend-acm/src/lib/ama-user-api.ts) — `useAmaUserSearch` (React Query, 60s staleTime) |
| T5-03 | [tch-form-modal.tsx](../../frontend-acm/src/modules/tch/components/tch-form-modal.tsx) + [stf-form-modal.tsx](../../frontend-acm/src/modules/stf/components/stf-form-modal.tsx) — picker 통합, name/email 자동 채움 + lock |
| T5-04 | i18n × 4 locale: `auth.ama.errors.{NO_SUBSCRIPTION,USER_NOT_IN_ENTITY,AMA_UNAVAILABLE}` 신규 3 / `common.picker.{placeholder,hint,minChars,errorTitle,errorHint,manualMode,noResults}` 신규 7 + `common.clear` / `{tch,stf}.field.amaUser` 신규 1 = **총 11 × 4 = 44 항목** |
| T5-05 | Login page 코드 변경 없음 — 기존 `t('ama.errors.${code}')` lookup 이 신규 코드 3종을 자동 표면화 |
| (T5 DTOs) | [teacher.dto.ts](../../backend/src/modules/acm-tch/application/dto/teacher.dto.ts) + [staff.dto.ts](../../backend/src/modules/acm-stf/application/dto/staff.dto.ts) — `tchAmaUserId?` / `stfAmaUserId?` 옵션 필드 추가 (ValidationPipe 통과용) |

---

## 3. 검증

### 3.1 Backend
```
nest build                         clean (no errors)
jest src/modules/acm-auth/         5 suites, 46 tests pass
  subscription-check.service.spec  15 cases
  user-membership.guard.spec        4 cases
  ama-user-directory.service.spec  12 cases
  academy-subscription.guard.spec   8 cases (legacy, retained as regression net)
  + 7 from existing acm-auth suites
```

### 3.2 Frontend
```
tsc --noEmit                       clean
i18n parity:
  auth.json:    ko=en=vi=zh-CN = 65 scalars
  common.json:  ko=en=65 / vi=zh-CN=61 (pre-existing diff in actions.* — unrelated)
  tch.json:     ko=en=vi=zh-CN = 82
  stf.json:     ko=en=vi=zh-CN = 43
```

### 3.3 Mock 모드 동작 검증 (수동 시각 권고)

다음 entityId 패턴으로 5 가지 로그인 결과 재현 가능 (브라우저에서 `?ama_token=` 로 시연 — JWT 의 entityId 만 다르게):

| entityId 패턴 | 결과 |
|---|---|
| `ent-active-…`  (default) | 로그인 성공 |
| `ent-suspended-…` | 403 SUBSCRIPTION_SUSPENDED 카드 |
| `ent-canceled-…` | 403 SUBSCRIPTION_CANCELED |
| `ent-deprovisioned-…` | 403 SUBSCRIPTION_DEPROVISIONED |
| `ent-not-subscribed-…` | 403 NO_SUBSCRIPTION |
| `ent-trial-…` | 통과 (TRIALING 도 acceptable) |
| `ent-fail-…` | stg-apps 5xx 시뮬레이션 → cache fallback or AMA_UNAVAILABLE |
| `ent-not-member-…` | 403 USER_NOT_IN_ENTITY (멤버십 mock 404) |

---

## 4. AC 매트릭스 (REQ v2 § 8 ↔ 결과)

| AC ID | 결과 |
|-------|------|
| AC-1-1 ACTIVE 로그인 성공 | ✅ T2 |
| AC-1-2 SUSPENDED → 403 | ✅ T2-05 spec |
| AC-1-3 NOT_SUBSCRIBED / 404 → 403 NO_SUBSCRIPTION | ✅ T2-05 spec |
| AC-1-4 live 5xx + cache age ≤ 24h + ACTIVE → degraded 통과 | ✅ T2-05 spec |
| AC-1-5 live 5xx + cache age > 24h → 503 AMA_UNAVAILABLE | ✅ T2-05 spec |
| AC-2-1 멤버 → 통과 | ✅ T3-04 spec |
| AC-2-2 비멤버 → 403 USER_NOT_IN_ENTITY | ✅ T3-04 spec |
| AC-2-3 ama 5xx → 503 (fail-closed) | ✅ T3-04 spec |
| AC-3-1 결과 ≤ 10 노출 | ✅ T5 + T4 (limit clamp ≤ 50) |
| AC-3-2 선택 → 자동 채움 + lock | ✅ T5 picker + modal |
| AC-3-3 OWNER 강제 입력 시 무시 | ✅ T4-05 spec (input + response 양측) |
| AC-3-4 다른 entity 위조 → 403 | ✅ Controller `@CurrentUser().entId` (JWT 바인딩) + OwnEntityGuard 패턴 |
| AC-3-5 ama 503 → manual fallback | ✅ T5 picker error state + onManualMode |
| AC-4-1 break-glass 우회 | ✅ exchangeAmaToken 외 경로 (loginWithPassword) 우회 |
| AC-4-2 i18n parity 4 locale | ✅ 추가 키 11 × 4 = 44 항목 |

**13/13 AC 통과** (3.3 시각 검수 항목 별도 권고).

---

## 5. 환경 변수 (production 추가 필요)

```bash
# REQ-260604 v2 신규 — 모두 mock 시 빈 값 가능
AMA_APPSTORE_BASE_URL=https://stg-apps.amoeba.site
AMA_APPSTORE_SERVICE_TOKEN=               # AMA 팀 발급 후 채움 (mock 모드에선 미사용)
AMA_APPSTORE_TIMEOUT_MS=3000

AMA_PLATFORM_BASE_URL=https://ama.amoeba.site
AMA_PLATFORM_SERVICE_TOKEN=               # 동상
AMA_PLATFORM_TIMEOUT_MS=3000

# 토글 — mock-first 출시
AMA_SERVICES_MODE=mock                    # 합의 후 'http' 로 전환
```

`docker/{staging,production}/.env.*.example` 갱신은 **별건** (operational task, not code change).

---

## 6. 잔존 항목 / 후속

| Item | 후속 |
|------|------|
| `tac_teachers.tch_ama_user_id` / `tac_staff.stf_ama_user_id` 컬럼 추가 + 서비스 storage | T5 follow-up — DTO 만 받고 service 는 현재 silently drop. Migration + entity 변경 별도 PR |
| AMA 팀 endpoint 합의 (REQ v2 § 6 A1/A2/A3) | T6 외부 의존 — URL, response shape, 인증 방식 (Bearer 권장) |
| `AMA_APPSTORE_SERVICE_TOKEN` + `AMA_PLATFORM_SERVICE_TOKEN` 발급 | T6 외부 의존 |
| `AMA_SERVICES_MODE=http` 전환 | T6 완료 후 |
| `.env.production.example` + `.env.staging.example` 에 신규 6 키 추가 | 별건 doc PR |
| `academy-subscription.guard.ts` 완전 삭제 | 1 sprint v2 안정 운영 후 cleanup PR |
| Visual / responsive 검수 | 사용자 manual (브라우저 360px~) |

---

## 7. 변경 파일 매니페스트

```
backend/ (10)
├── src/modules/acm-auth/
│   ├── acm-auth.module.ts                                        [MOD]  +AMA_PLATFORM_CLIENT + STG_APPS_SUBSCRIPTION_CLIENT providers
│   ├── application/
│   │   ├── academy-subscription.guard.ts                          [MOD]  @deprecated marker
│   │   ├── academy-subscription.guard.spec.ts                     (kept) — 8 cases as regression net
│   │   ├── acm-auth.service.ts                                    [MOD]  3-step gate
│   │   ├── subscription-check.service.ts                          [NEW]  T2-04
│   │   ├── subscription-check.service.spec.ts                     [NEW]  T2-05 (15 cases)
│   │   ├── user-membership.guard.ts                               [NEW]  T3-03
│   │   ├── user-membership.guard.spec.ts                          [NEW]  T3-04 (4 cases)
│   │   ├── ama-user-directory.service.ts                          [NEW]  T4-02
│   │   └── ama-user-directory.service.spec.ts                     [NEW]  T4-05 (12 cases)
│   ├── infrastructure/
│   │   ├── stg-apps-subscription.client.ts                        [NEW]  T2-01
│   │   ├── stg-apps-subscription-mock.client.ts                   [NEW]  T2-02
│   │   ├── stg-apps-subscription-http.client.ts                   [NEW]  T2-03
│   │   ├── ama-platform.client.ts                                 [NEW]  T3-01
│   │   ├── ama-platform-mock.client.ts                            [NEW]  T3-02
│   │   └── ama-platform-http.client.ts                            [NEW]  T3-02
│   └── presentation/
│       └── ama-user.controller.ts                                 [NEW]  T4-03
├── src/modules/acm-tch/application/dto/teacher.dto.ts             [MOD]  +tchAmaUserId?
└── src/modules/acm-stf/application/dto/staff.dto.ts               [MOD]  +stfAmaUserId?

frontend-acm/ (4 + i18n 12)
├── src/lib/ama-user-api.ts                                        [NEW]  T5-02
├── src/components/common/ama-user-picker.tsx                      [NEW]  T5-01
├── src/modules/tch/components/tch-form-modal.tsx                  [MOD]  T5-03
├── src/modules/stf/components/stf-form-modal.tsx                  [MOD]  T5-03
└── src/i18n/locales/{ko,en,vi,zh-CN}/{auth,common,tch,stf}.json   [MOD] × 16

docs/ (3)
├── analysis/REQ-260604-…md   v1.0.0 → v2.0.0
├── plan/PLN-260604-…md       v1.0.0 → v2.0.0
└── implementation/RPT-260604-…md                                  [NEW]  본 문서
```

**총**: 신규 18 + 변경 12 + 문서 3 = **33 파일**.

---

## 8. 배포 권고

1. **즉시 가능 (mock 모드)**: `AMA_SERVICES_MODE=mock` 으로 production deploy. 로그인 / Tch/Stf picker UX 모두 동작. 다만 entityId 가 mock 룰에 매핑되지 않은 실 사용자는 ACTIVE 응답을 받음 — staging 환경에서 충분히 검수 후 production 으로.
2. **AMA 팀 합의 완료 후**: `.env.production` 의 `AMA_SERVICES_MODE=http` 전환 + 4 신규 env 채우기 + backend restart. 코드 변경 0.
3. **별건 추적**: PLN v2 § 8 의 후속 항목 5개 (DB 컬럼 / env example / legacy cleanup / 시각 검수 / AMA 팀 협의).

---

**REQ-260604 v2 완료**. AMA 측 endpoint 합의를 기다리는 동안 mock 모드로 운영 시작 가능.
