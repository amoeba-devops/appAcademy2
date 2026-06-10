---
document_id: FIX-260610-ama-customapp-entid-resolution
version: 1.0.0
status: fixed
author: gray.kim@amoeba.group
created: 2026-06-10
related:
  - REQ-260609B-ama-integration-config
  - REQ-260609C-ama-session-oauth-exchange
  - REQ-260609D (local_config Custom App verify)
---

# FIX-260610 — AMA Custom App 링크 로그인 시 ACM 테넌트(entId) 해석 오류 (entId vs amaEntityId mismatch)

## 1. Symptom (증상)

AMA 커스텀앱 링크를 통해 ACM 에 접속하면 테넌트 스코프 데이터가 비어 보인다. 대표적으로:

```
GET https://acm.amoeba.site/api/acm/admin/ama-config
→ {"success":true,"data":null}        # 커스텀앱 링크 세션
```

반면 동일 엔드포인트를 기존 비밀번호 계정(`admin@tpi.co.kr`)으로 호출하면 정상 데이터가 반환된다:

```
GET .../api/acm/admin/ama-config
→ data: { entId: "00000000-0000-0000-0000-000000000001",
          amaEntityId: "928f5fe4-12ab-4113-b9b9-d8d455ca4e3b",
          appCode: "tpi-acm", isActive: true, customAppSecretIsSet: true, ... }
```

`ama-config` 뿐 아니라 students/classes 등 **모든 테넌트 스코프 조회가 빈 결과**가 된다 (커스텀앱 세션이 다른 테넌트에 격리됨).

## 2. Root Cause (원인)

`amb_acm_ama_config` 의 TPI 운영 행은 서로 **다른 두 식별자**를 가진다:

| 컬럼 | 값 | 의미 |
|------|----|----|
| `ent_id` | `00000000-0000-0000-0000-000000000001` | ACM 내부 테넌트 스코프. **모든 TPI 데이터 + `admin@tpi.co.kr` 가 속한 테넌트** |
| `amc_ama_entity_id` | `928f5fe4-12ab-4113-b9b9-d8d455ca4e3b` | 커스텀앱 토큰이 싣는 AMA 법인 UUID |

seed([sql/acm/921-seed-ama-config.sql](../../sql/acm/921-seed-ama-config.sql))는 `ent_id == amc_ama_entity_id` 를 가정하고 엔티티 주석도 "보통 amaEntityId 와 동일" 이라 적혀 있으나, `admin@tpi.co.kr` 가 `/admin/config` 에서 `amaEntityId` 를 실제 AMA UUID 로 갱신하면서 두 값이 **갈라졌다**.

로그인 경로별 `entId` 해석 차이:

- **비밀번호 로그인**: JWT `entId` = 사용자 행의 `entId` = `00000000-…01` → `ama-config` 를 `entId=00000000-…01` 로 조회 → 행 발견 ✓
- **AMA 커스텀앱 링크(`local_config` 모드)**: 사용자 upsert 시 `entId = payload.entityId = 928f5fe4…` 로 스코프 → 그 값으로 JWT 발급 → `ama-config` 를 `entId=928f5fe4…` 로 조회 → **행 없음 → `data:null`** ✗

즉 인증 서비스가 AMA `entityId` → ACM `entId` 매핑(이미 `amb_acm_ama_config` 에 존재)을 사용하지 않고 **토큰의 entityId 를 그대로 ACM 테넌트 스코프로 사용**한 것이 원인. 세 가지 검증 모드(`local` / `ama_session` / `local_config`) 모두 동일한 결함을 공유한다.

## 3. Fix (수정)

AMA `entityId` → ACM `entId` 매핑을 `amb_acm_ama_config.ent_id` 를 통해 수행하도록 인증 흐름을 변경. 게이트가 이미 해당 행을 로드하므로 게이트가 **해석된 `entId` 를 반환**하고, 이후 모든 사용자 스코프/JWT 발급이 이 값을 사용한다. `payload.entityId` 는 추적용으로 사용자 행의 `amaEntityId` 에만 계속 저장.

| File | Change |
|------|--------|
| [ama-config-gate.service.ts](../../backend/src/modules/acm-auth/application/ama-config-gate.service.ts) | `ensureAllowed()` 반환 타입 `void → Promise<string>`. 매칭된 active 설정의 `cfg.entId` 반환 |
| [acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) | `exchangeAmaToken()` 에서 `const acmEntId = await ensureAllowed(...)` 캡처 후 `upsertSessionUser` / `upsertLocalConfigUser` / `loginViaLocalPipeline` / `upsertAmaUser` 에 전파. upsert 의 `entId` 필드·조회 키를 `payload.entityId` → `acmEntId` 로 교체. `amaEntityId` 는 `payload.entityId` 유지 |
| [ama-config-gate.service.spec.ts](../../backend/src/modules/acm-auth/application/ama-config-gate.service.spec.ts) | 반환값 단언 갱신 + entId/amaEntityId 분기 케이스 테스트 추가 |

부수 효과(의도된 동작): `upsertAmaUser` 의 email 폴백 조회가 동일 테넌트(`acmEntId`) 내에서 수행되므로, 커스텀앱 로그인 email 이 `admin@tpi.co.kr` 와 일치하면 **기존 ACM 계정을 그대로 AMA 연동 계정으로 흡수** — 중복 계정 생성 없이 "등록된 유저 데이터" 를 그대로 사용하게 된다.

## 4. Data cleanup (운영 데이터 정리 — 필수 후속)

코드 수정 전 커스텀앱 링크 로그인이 1회 이상 발생했다면, `entId = 928f5fe4…` 로 잘못 생성된 고아 사용자 행이 `amb_acm_user` 에 남아 있을 수 있다. 운영 DB 에서 확인 후 정리한다:

```sql
-- 1) 확인: AMA entityId 를 ACM entId 로 잘못 쓴 고아 행
SELECT usr_id, ent_id, usr_email, ama_user_id, ama_entity_id, auth_source, created_at
  FROM amb_acm_user
 WHERE ent_id = '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b';

-- 2) 동일 email 의 정상 계정(ent_id = 00000000-…01)이 이미 있으면 고아 행 삭제.
--    없다면 ent_id 를 00000000-…01 로 교정(중복 email 충돌 주의).
DELETE FROM amb_acm_user
 WHERE ent_id = '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b'
   AND auth_source = 'ama';
```

> seed 파일은 향후 `ent_id == amaEntityId` 가정이 깨질 수 있음을 전제로 두되, 본 수정으로 런타임은 더 이상 그 가정에 의존하지 않는다.

## 5. Verification (검증)

- `npx tsc --noEmit` — 통과
- `npx jest ama-config-gate` — 5 passed (분기 케이스 포함)
- 수동: 커스텀앱 링크 로그인 후 `GET /api/acm/admin/ama-config` 가 `admin@tpi.co.kr` 와 동일한 `entId=00000000-…01` 데이터를 반환하는지 staging 에서 확인 필요.
