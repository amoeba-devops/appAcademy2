---
document_id: FIX-260630-ama-category-login-401
version: 1.0.0
status: mitigated
created: 2026-06-30
authors:
  - gray.kim@amoeba.group
---

# 버그 — AMA Custom Category 로그인 401 (FIX-260630)

## 1. 증상 (Symptom)
`https://ama.amoeba.site/menu/tpi-academy` 진입 시
`POST https://acm.amoeba.site/api/acm/auth/ama-exchange` → **401**.
토큰은 Custom **Category** 토큰: `scope=custom_category:context`, `eccSlug=tpi-academy`, `entityId=928f5fe4-…`.

## 2. 원인 분석 (Root cause)
카테고리 토큰은 `local_config` 모드의 `AmaCustomAppVerifier` 가 검증한다. 코드 경로상 401이 의미하는 범위는 **둘뿐**:
1. `local_config` 인데 **서명 검증 실패**(`AMA_TOKEN_INVALID_SIGNATURE`) 또는 **만료**(`AMA_TOKEN_EXPIRED`)
2. **`local_config` 모드가 아님** → 카테고리 토큰이 레거시 `local` 검증기로 가서 거부

(scope/slug/appCode 불일치=403, claims 누락=400, categorySecret 미설정=503, entity 미허용=403 이므로 401에서 제외.)

**환경 footgun 발견**: `docker/{production,staging}/docker-compose.*.yml` 의
`AMA_TOKEN_VERIFY_MODE: ${AMA_TOKEN_VERIFY_MODE:-local}` — 호스트 `.env` 에 값이 없으면 **`local` 로 폴백**(`.env.*.example` 은 `local_config`). 이 경우 위 #2 로 모든 Custom App/Category 로그인이 401.

## 3. 조치 (Changes)
- **compose 기본값 수정**: prod/staging 의 폴백을 `:-local` → **`:-local_config`**. 미설정 시에도 의도한 모드로 동작.
- **프런트 진단 가시성**: 로그인 AMA 에러 카드에 백엔드 `error.code`(예: `AMA_TOKEN_INVALID_SIGNATURE`)를 그대로 노출. (전역 필터는 이미 `{error:{code,message}}` 로 코드 반환 — 화면에만 미표시였음.)

파일: `docker/production/docker-compose.production.yml`, `docker/staging/docker-compose.staging.yml`, `frontend-acm/src/modules/auth/pages/login-page.tsx`.

## 4. 잔여 확인 (Definitive fix depends on surfaced code)
배포 후에도 401이면 화면의 `code:` 로 분기:
- `AMA_TOKEN_INVALID_SIGNATURE` → `/admin/config` 의 **categorySecret 재등록**(AMA 커스텀 카테고리 서명 secret 과 일치) + `categorySlug` 확인(빈값 또는 `tpi-academy`) + `amaEntityId=928f5fe4-…`, `isActive=true`.
- `AMA_TOKEN_EXPIRED` → 메뉴 재진입(신규 토큰).
- `AMA_SSO_DISABLED`/일반 401 → 호스트 `.env` 의 `AMA_TOKEN_VERIFY_MODE` 미설정 — 본 수정으로 해소(재배포 시 local_config).

## 5. 영향 / 검증
- DB 마이그레이션 없음. 백엔드 코드 변경 없음(compose env + FE 만).
- frontend `tsc` + `vite build` clean, compose YAML 유효.
- 배포: 재배포 시 백엔드 컨테이너가 `local_config` 로 기동(호스트 `.env` 미설정 시).
