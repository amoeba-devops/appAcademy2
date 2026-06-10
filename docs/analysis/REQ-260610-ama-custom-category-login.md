---
document_id: REQ-260610-ama-custom-category-login
version: 1.0.0
status: implemented
author: gray.kim@amoeba.group
created: 2026-06-10
related:
  - REQ-260609D-ama-custom-app-local-config
  - FIX-260610-ama-customapp-entid-resolution
---

# REQ-260610 — AMA 커스텀카테고리 로그인 지원 (Custom Category SSO)

## 1. Background (배경)

ACM은 AMA에 **Custom App**(`/apps/<slug>`)으로 등록돼 `local_config` 모드로 SSO 로그인한다 ([REQ-260609D](REQ-260609D-ama-custom-app-local-config.md)). 추가로 **Custom Category**(`/menu/<slug>`) 진입점으로도 동일하게 로그인되어야 한다.

커스텀카테고리 토큰은 커스텀앱과 **별개 통합**이라 클레임·서명이 다르다:

| | Custom App | Custom Category |
|---|---|---|
| scope | `custom_app:context` | `custom_category:context` |
| 식별자 클레임 | `appCode` | `eccSlug` (+ `eccId`) |
| 서명 secret | 앱 secret | **카테고리 secret (다름)** |
| 공통 | `sub`, `email`, `role`, `entityId` 동일 | |

기존 `AmaCustomAppVerifier`는 단일 secret(`amc_custom_app_secret_enc`)으로만 검증 → 카테고리 토큰은 `AMA_TOKEN_INVALID_SIGNATURE`로 실패.

## 2. Decision (결정) — Option A

`amb_acm_ama_config`에 카테고리 전용 secret/slug 2컬럼을 추가하고, 검증기가 **토큰 scope로 secret을 분기**한다. (Option B = 범용 자격증명 자식 테이블은 다중 카테고리 필요 시로 보류.)

`entityId`는 두 토큰 모두 `928f5fe4…`로 동일하므로, 게이트(`amaEntityId`만 사용)와 사용자 upsert는 **변경 없이** 동일 사용자(`fremd@naver.com`)·동일 테넌트(`00000000-…01`)로 로그인된다.

## 3. Changes (변경)

| 영역 | 파일 |
|------|------|
| DB | `sql/acm/924-acm-ama-config-custom-category.sql` — `amc_category_secret_enc BYTEA`, `amc_category_slug VARCHAR(60)` (nullable) |
| Entity | `ama-config.typeorm-entity.ts` — `categorySecretEnc`, `categorySlug` |
| Verifier | `ama-custom-app.verifier.ts` — scope 라우팅: `custom_app:context`→app secret/appCode, `custom_category:context`→category secret/eccSlug, 그 외 scope→`AMA_TOKEN_SCOPE_INVALID` |
| Error code | `ama-token.verifier.ts` — `AMA_TOKEN_CATEGORY_SLUG_INVALID` 추가 (auth-service에서 403 매핑) |
| Config API | `ama-config.dto.ts` + `ama-config.service.ts` — `categorySecret`(write-only) / `categorySlug` 입력, `categorySecretIsSet`·`categorySlug` 노출 |
| Frontend | `ama-config-page.tsx` + `use-ama-config.ts` — "Custom Category" 섹션 (slug + secret), i18n 4-locale (ko/en/vi/zh-CN) |
| Test | `ama-custom-app.verifier.spec.ts` — app/category 각 happy-path, 카테고리 토큰을 앱 secret으로 서명 시 거부(운영 버그 회귀), scope/slug/appCode 불일치, secret 미설정 503(앱 secret로 fallback 안 함) |

## 4. Verification rules (검증 규칙, scope별)

```
decode → entityId, scope
 scope ∉ {custom_app:context, custom_category:context} → AMA_TOKEN_SCOPE_INVALID (403)
config 조회 (amaEntityId=entityId, active) 없으면 ENTITY_NOT_ALLOWED (403)
 app      → secret=amc_custom_app_secret_enc; 없으면 503; appCode==amc_app_code (불일치 403)
 category → secret=amc_category_secret_enc;  없으면 503; eccSlug==amc_category_slug (불일치 403)
jwt.verify(HS256) 실패 → AMA_TOKEN_INVALID_SIGNATURE (401) / 만료 AMA_TOKEN_EXPIRED
signed entityId != routing entityId → ENTITY_NOT_ALLOWED (403)
→ payload(sub/email/role/entityId) 반환 → 동일 upsert 경로
```

## 5. Deploy / Ops (배포·운영)

1. 마이그레이션 `924-acm-ama-config-custom-category.sql` 적용 (ACM Postgres).
2. `/admin/config`에서 **Category Slug**(`tpi-academy`) + **Custom Category secret**(AMA 콘솔의 커스텀카테고리 서명 secret — 앱과 다름) 저장.
3. `AMA_TOKEN_VERIFY_MODE=local_config` (이미 설정됨, FIX-260610).
4. `/menu/tpi-academy` 재진입 → `AMA exchange success` 확인.

> 카테고리 secret은 앱 secret과 다르므로 반드시 AMA 콘솔의 **커스텀카테고리** secret을 입력해야 한다. 미설정 시 `AMA_SSO_NOT_CONFIGURED` 503 (앱 secret으로 fallback하지 않음).
