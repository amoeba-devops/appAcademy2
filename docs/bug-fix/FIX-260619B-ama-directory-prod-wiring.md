---
document_id: FIX-260619B-ama-directory-prod-wiring
version: 1.0.0
status: code-ready (needs prod env values + smoke verify)
author: gray.kim
created: 2026-06-19
related:
  - REQ-260604 (AMA platform user directory picker)
  - FIX-260619 (entId → amaEntityId resolution)
change_log:
  - "1.0.0 (2026-06-19): wire AMA platform env into compose + envelope-tolerant client"
---

# FIX-260619B — AMA 디렉터리 검색 운영 미동작: env 미와이어링 + 응답 envelope

## 1. Symptom (증상)

FIX-260619(entId→amaEntityId) 배포 후에도 `/admin/tch`, `/admin/stf`의 AMA 사용자
검색이 빈 결과 반환:

```
GET https://acm.amoeba.site/api/acm/ama/users?q=fremd&level=MANAGER,MEMBER,VIEWER&limit=10
→ { success: true, data: [] }
```

## 2. Root Cause (원인) — 2가지 복합

### (A) 운영 컨테이너에 AMA 플랫폼 env 미전달 (주원인)

`docker/production/docker-compose.production.yml` 의 backend 서비스는 명시적
`environment:` 목록만 사용하고 `env_file:` 이 없다. 이 목록에 다음이 **누락**:

- `AMA_SERVICES_MODE` → 코드 기본값 `mock` 로 동작 ([acm-auth.module.ts](../../backend/src/modules/acm-auth/acm-auth.module.ts) L64)
- `AMA_PLATFORM_BASE_URL`, `AMA_PLATFORM_SERVICE_TOKEN`, `AMA_PLATFORM_TIMEOUT_MS` → unset

`.env.production` 이 `AMA_SERVICES_MODE=http` 를 선언해도 컨테이너 경계에서 버려진다.
결과적으로 운영은 **mock 디렉터리 클라이언트**로 동작 → 6개 가짜 fixture(김교사·이민지·
박조교·Chris Park…) 만 반환. `q=fremd` 는 매칭 없음 → `[]`. (운영에서 `q=kim` 검색 시
가짜 사용자가 나오면 mock 모드 확정.)

로그인은 `AMA_TOKEN_VERIFY_MODE=local_config` 라 플랫폼 호출을 건너뛰므로
([acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) L250-254)
이 미와이어링이 로그인에는 드러나지 않았다 — 디렉터리 검색만이 유일한 플랫폼 소비자.

### (B) 응답 envelope 불일치 (http 전환 시 잠복 결함)

REQ-260604 A3 계약은 **bare array** `[{...}]` 를 가정했으나, amoeba 생태계는
`{ success, data }` envelope 를 쓴다 (OAuth gateway client 가 이미 unwrap; ACM 자체
응답도 동일). `AmaPlatformHttpClient.searchUsers` 는 `Array.isArray(res)` 만 보고
객체면 `[]` 반환 → http 로 전환해도 빈 결과가 될 위험.

## 3. Fix (수정)

| # | 변경 | 파일 |
|---|------|------|
| 1 | backend `environment:` 에 `AMA_SERVICES_MODE` + `AMA_PLATFORM_*` 4종 추가 (staging+prod) | `docker/{production,staging}/docker-compose.*.yml` |
| 2 | HTTP client: `{success,data}` envelope + bare 양쪽 허용(`unwrapArray`/`unwrapObject`), 미인식 payload 시 명시적 warn | [ama-platform-http.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.ts) |
| 3 | env example 갱신 + `AMA_SERVICES_MODE` 오해 주석 정정("Unused by local_config" → 디렉터리에서 사용) | `docker/{production,staging}/.env.*.example` |
| 4 | 신규 테스트 (envelope/bare 양쪽, 미인식 payload) | [ama-platform-http.client.spec.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.spec.ts) |

## 4. Verification (검증)

- `npx jest ama-platform-http ama-user-directory` → 19 passed.
- `npx tsc --noEmit` 통과.
- `docker compose ... config` 양쪽 유효 + 렌더된 backend env 에 `AMA_PLATFORM_*` 노출 확인.

## 5. Remaining (배포 시 필수 — 운영 .env)

코드/compose 는 준비됐으나 **운영 서버 `.env.production` 에 실제 값 설정 필요**:

```bash
AMA_SERVICES_MODE=http
AMA_PLATFORM_BASE_URL=https://ama.amoeba.site      # 실제 호스트 확인
AMA_PLATFORM_SERVICE_TOKEN=<AMA 팀 발급 토큰>
```

설정 후 재배포 → `q=<실재 멤버명>` 검색으로 실데이터 노출 확인. 여전히 비면 backend
로그에서 구분:
- `no active amaEntityId for acmEntId=…` → `amb_acm_ama_config` 점검 (FIX-260619)
- `ama searchUsers failed … reason=…` → 토큰/엔드포인트/네트워크
- `ama searchUsers returned unrecognised payload …` → AMA 응답 shape 가 array/`{data}` 도 아님 (계약 재확인)
