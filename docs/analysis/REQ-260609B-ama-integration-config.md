---
document_id: REQ-260609B-ama-integration-config
version: 1.0.0
status: DRAFT-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/analysis/REQ-260609-ama-tpi-sso-client-sync.md
  - docs/plan/PLN-260609B-ama-integration-config.md
  - backend/src/modules/acm-auth/application/entity-gate.service.ts
  - backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts
  - backend/src/modules/acm-cal/application/boda-config.service.ts
change_log:
  - 2026-06-09 v1.0.0 초안 — REQ-260609 FR-A(entity 게이트)를 어드민 설정(/admin/config)으로 승격. 결정 반영: DB 미설정 시 전면 거부, entityId/appCode 평문 저장.
---

# REQ-260609B — AMA 연동 설정 (entityId · appCode) 어드민 관리 (Requirements Analysis)

## 1. Overview (개요)

`tpi-acm` 은 **TPI 전용 앱**이다. AMA 플랫폼(`ama.amoeba.site`)에 커스텀앱으로 등록하면, SSO 로그인 시 JWT 에 법인정보(`entityId`, `appCode`)가 실려 온다. 본 요구사항은 이 두 값을 **운영자가 `/admin/config` 화면에서 등록·관리**하게 하고, **로그인 게이트가 토큰의 `entityId`+`appCode` 와 등록값이 일치할 때만 로그인을 허용**하도록 한다.

> **REQ-260609 FR-A 와의 관계**: FR-A 는 entity 게이트를 **env(`AMA_ALLOWED_ENTITY_CODES`) + MySQL `tac_academies.acd_ama_entity_code`** 로 구현했다. 본 건은 이 게이트의 **단일 진실원천(source of truth)을 어드민이 편집 가능한 ACM-PostgreSQL 설정 테이블로 이전**하고, `appCode` 검증도 함께 DB 화한다. (env 는 부트스트랩 seed 의 기본값 출처로만 잔존)

## 2. Current State (현행)

- AMA SSO 교환: `POST /api/acm/auth/ama-exchange` → 토큰검증 → entity 게이트 → 구독 → 멤버십 → upsert → ACM JWT. ([acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts))
- 토큰 클레임: `sub, email, role, entityId, entityCode?, appCode, scope, iat, exp`. ([ama-token.verifier.ts:9](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts#L9))
- **`appCode` 검증**: env `AMA_JWT_ALLOWED_APP_CODES`(기본 `tpi-acm`) 화이트리스트 — [ama-token.verifier.ts:113](../../backend/src/modules/acm-auth/infrastructure/ama-token.verifier.ts#L113)
- **`entityId` 게이트**: `EntityGateService.ensureAllowed()` 가 MySQL `tac_academies` 조회 + env `AMA_ALLOWED_ENTITY_CODES`(기본 `VN3040`) — [entity-gate.service.ts:49](../../backend/src/modules/acm-auth/application/entity-gate.service.ts#L49), 호출부 [acm-auth.service.ts:239](../../backend/src/modules/acm-auth/application/acm-auth.service.ts#L239)
- 즉 **기능 자체는 동작하나 값이 env/코드에 하드코딩**되어 운영자가 바꿀 수 없다. `/admin/config` 화면은 **아직 없다**.
- 참조 패턴: BODA 테넌트 설정(`amb_acm_cal_boda_config`)이 admin CRUD(GET/PUT) + ACM-PG 1행/테넌트 + `OwnEntityGuard`+`@Roles('ADMIN')` 구조를 이미 확립. ([boda-config.controller.ts](../../backend/src/modules/acm-cal/presentation/boda-config.controller.ts), [boda-config.service.ts](../../backend/src/modules/acm-cal/application/boda-config.service.ts))

## 3. Functional Requirements (기능 요구사항)

### FR-1. AMA 연동 설정 저장소
- **FR-1.1**: ACM-PostgreSQL 에 신규 테이블 `amb_acm_ama_config` 추가. 테넌트당 1행(`UNIQUE(ent_id)`).
- **FR-1.2**: 저장 필드 — **사용할 AMA 법인 `entityId`**(문자열), **`appCode`**(문자열, 예 `tpi-acm`), 활성 토글(`is_active`).
- **FR-1.3**: `entityId`/`appCode` 는 **평문 저장**(비교용 공개 식별자, 비밀값 아님 — 결정 2026-06-09). AES-GCM 미적용.

### FR-2. 어드민 설정 화면 `/admin/config`
- **FR-2.1**: 프론트(`frontend-acm`)에 `/admin/config` 라우트 + 좌측 네비 "연동 설정" 항목 추가.
- **FR-2.2**: 화면에서 `entityId`, `appCode`, 활성 여부를 **조회·수정(upsert)**. ADMIN 역할만 접근.
- **FR-2.3**: 백엔드 API `GET /api/acm/admin/config`(현재값 조회), `PUT /api/acm/admin/config`(upsert). 가드 `AcmJwtAuthGuard` + `OwnEntityGuard` + `RolesGuard('ADMIN')`.
- **FR-2.4**: 저장 시 즉시 다음 로그인부터 게이트에 반영(캐시 없음 또는 짧은 TTL).

### FR-3. 로그인 게이트 (일치 시에만 허용)
- **FR-3.1**: SSO 교환 시 토큰의 `entityId` 로 `amb_acm_ama_config`(active) 행을 조회.
- **FR-3.2**: 행이 존재하고 `amc_app_code == token.appCode` 이면 **허용**, 그 외(행 없음 / 비활성 / appCode 불일치 / entityId 불일치) **전면 거부 403 `ENTITY_NOT_ALLOWED`** (fail-closed, 결정 2026-06-09).
- **FR-3.3**: 이 DB 게이트가 기존 env 기반 entity-code 화이트리스트 + verifier 의 appCode 화이트리스트를 **승계**한다. 토큰 verifier 는 **서명·클레임 존재·scope 구조 검증**만 유지(구조 검증과 비즈니스 허용을 분리).
- **FR-3.4**: 게이트는 구독/멤버십 등 무거운 호출 **이전**에 위치.

### FR-4. 부트스트랩 (lockout 방지)
- **FR-4.1**: "DB 미설정 시 전면 거부" 정책상 최초 관리자도 로그인 불가하므로, **배포 seed SQL** 로 TPI 기본 설정 행을 미리 적재한다(`entityId`=VN3040 UUID, `appCode`=`tpi-acm`, active). 이후 `/admin/config` 에서 수정.
- **FR-4.2**: seed 값의 출처는 기존 env(`AMA_ALLOWED_ENTITY_CODES`/`AMA_JWT_ALLOWED_APP_CODES` + `tac_academies.acd_ama_tenant_id`)와 동일하게 유지하여 현행 동작과 무손실 연속성 보장.

## 4. Non-Functional (비기능)
- **NFR-1 fail-closed**: 설정 조회 5xx/부재 시 차단(403/503), 우회 폴백 금지.
- **NFR-2 멀티테넌시**: admin CRUD 는 `OwnEntityGuard` 로 `ent_id` 스코프. 로그인 게이트는 인증 전이므로 토큰 `entityId` 직접 매칭.
- **NFR-3 i18n**: 신규 UI 문자열 4 locale(ko/en/vi/zh-CN) react-i18next 키. 하드코딩 금지. ([[feedback_i18n_default]])
- **NFR-4 감사**: 설정 변경은 `updated_at` 갱신. (별도 audit log 는 범위 외)

## 5. Out of Scope (범위 외)
- TPI 외 다중 테넌트 입주 — 단일 entity(VN3040) 가정 유지.
- `entityId`/`appCode` 외 추가 AMA 연동 파라미터(API 키 등) — 본 건은 2개 값만.
- env 변수 완전 제거 — 부트스트랩 seed 기본값 출처로 잔존(후속 정리).

## 6. Acceptance Criteria (인수 기준)
1. `/admin/config` 에서 `entityId`+`appCode` 저장 후, 동일 법인·앱의 AMA JWT 로 로그인 성공.
2. 등록값과 다른 `entityId` 또는 `appCode` 토큰 → 403 `ENTITY_NOT_ALLOWED`.
3. 설정 행 삭제/비활성 시 → 모든 AMA 로그인 거부.
4. 신규 배포(seed 적용) 직후 기존 TPI 계정 로그인 무손실.
5. 설정 UI 문자열 4 locale 키 존재, 비-ADMIN 접근 차단.
