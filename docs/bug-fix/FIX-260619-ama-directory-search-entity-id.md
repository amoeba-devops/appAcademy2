---
document_id: FIX-260619-ama-directory-search-entity-id
version: 1.0.0
status: fixed
author: gray.kim
created: 2026-06-19
related:
  - REQ-260604 (AMA platform user directory picker)
  - REQ-260609B (AMA Custom App SSO login gate)
  - FIX-260610 (entId/amaEntityId divergence at login)
change_log:
  - "1.0.0 (2026-06-19): initial fix — resolve entId → amaEntityId in directory search"
---

# FIX-260619 — AMA 디렉터리 검색 결과 없음 (AMA directory search returns no results)

## 1. Symptom (증상)

- **Where**: `/admin/tch` (교사 등록) 및 `/admin/stf` → "AMA directory / AMA 사용자" 검색 필드.
- **What**: 이름·이메일로 검색해도 **연동된 AMA 구성원 목록이 전혀 나오지 않음** (빈 목록).
- **Scope**: 운영(`acm.amoeba.site`, `AMA_SERVICES_MODE=http`)에서만 발생. mock 모드(로컬/CI)에서는 재현 안 됨.

## 2. Root Cause (원인)

시스템에는 두 개의 서로 다른 법인 식별자가 있으며, 라이브 TPI/Trinity 테넌트에서 값이 다르다:

| ID | 의미 | 예시 |
|----|------|------|
| ACM `entId` | ACM 내부 테넌트 스코프 | `00000000-…01` |
| AMA `amaEntityId` | 공개 AMA 법인 UUID | `928f5fe4-…` |

로그인 시에는 [ama-config-gate.service.ts](../../backend/src/modules/acm-auth/application/ama-config-gate.service.ts)가 `amaEntityId → entId`로 매핑하고 JWT에는 **ACM `entId`**가 서명된다 (FIX-260610).

그러나 **디렉터리 검색 경로는 역매핑을 하지 않았다**:

```
ama-user.controller.ts:54   → directory.search(user.entId, …)   // ACM entId
  → ama-user-directory.service.ts → platform.searchUsers(entId, …)
    → ama-platform-http.client.ts → GET /api/v1/entities/{entId}/users
```

AMA는 `00000000-…01`을 모르므로 빈 배열/404를 반환하고, `AmaUserDirectoryService`가 이를 `[]`로
삼켜(AC-3-5 manual fallback) 사용자에게는 "구성원 없음"으로만 보였다.

mock 클라이언트(`ama-platform-mock.client.ts`)는 전달받은 어떤 id로도 fixture를 생성하므로 테스트에서
이 결함이 드러나지 않았다.

## 3. Fix (수정)

`AmaUserDirectoryService.search()`가 AMA 호출 **전에** `entId → amaEntityId`를 해석하도록 변경
(로그인 게이트의 역연산). `amb_acm_ama_config`(active row)에서 조회한다.

**Changed**: [backend/src/modules/acm-auth/application/ama-user-directory.service.ts](../../backend/src/modules/acm-auth/application/ama-user-directory.service.ts)
- `AmaConfigTypeormEntity` repository 주입.
- `resolveAmaEntityId(acmEntId)` 추가 — active config의 `amaEntityId` 반환, 없으면 `null`.
  키스트로크마다 DB 조회를 피하기 위해 60s TTL 매핑 캐시 적용.
- active config 없으면 platform 호출 없이 `[]` 반환 (명시적 warn 로그).
- 결과 캐시 키를 `amaEntityId` 기준으로 변경.

**Tests**: [ama-user-directory.service.spec.ts](../../backend/src/modules/acm-auth/application/ama-user-directory.service.spec.ts)
- config repo mock(기본 identity 매핑) 추가 → 기존 14 assertion 유지.
- 신규: 해석된 `amaEntityId`로 AMA 호출 확인 / config 없을 때 호출 없이 `[]` / 매핑 캐시 검증.

## 4. Verification (검증)

- `npx jest ama-user-directory` → 14 passed.
- `npx tsc --noEmit` → 통과.
- 운영 검증(권장): `acm.amoeba.site/admin/tch`에서 AMA 구성원 이름 검색 시 목록 노출 확인.
  서버 로그에 `no active amaEntityId for acmEntId=…` 경고가 보이면 해당 테넌트의
  `amb_acm_ama_config` active row / `amc_ama_entity_id` 값을 점검할 것.

## 5. Notes (비고)

- AMA 5xx/timeout/미설정 시 빈 목록 + manual fallback 동작은 의도된 정책(AC-3-5)이라 유지했다.
  단, 본 결함처럼 "잘못된 식별자"가 빈 목록으로 위장되던 케이스는 이제 별도 warn 로그로 구분된다.
- `assertMember`/`ensureMember`(로그인 시 멤버십 검증) 경로는 **영향 없음** — 해당 경로는
  `payload.entityId`(토큰 원본 = `amaEntityId`)를 그대로 사용하므로 이미 올바르다
  ([acm-auth.service.ts:422](../../backend/src/modules/acm-auth/application/acm-auth.service.ts#L422)).
  본 결함은 JWT의 `entId`를 출처로 삼는 **디렉터리 검색 경로에 한정**된다.
