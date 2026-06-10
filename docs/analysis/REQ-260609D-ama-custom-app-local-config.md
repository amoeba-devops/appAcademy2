---
document_id: REQ-260609D-ama-custom-app-local-config
version: 1.0.0
status: DRAFT-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-10
related:
  - docs/analysis/REQ-260609C-ama-session-oauth-exchange.md
  - docs/analysis/REQ-260609B-ama-integration-config.md
  - docs/reference/MANUAL-260609-외부앱-ama-session-연동.md
change_log:
  - 2026-06-10 v1.0.0 초안 — Custom App 토큰을 /admin/config 입력값으로 로컬 검증(local_config 모드).
---

# REQ-260609D — Custom App 토큰 로컬 검증 (config 기반) (Requirements Analysis)

## 1. Overview (개요)
사이드바가 발급하는 `?ama_token`은 **Custom App 토큰**(`scope=custom_app:context`, HS256, appId `15b69898…`, appCode `tpi-acm`)이다. PartnerApp `ama_session` grant로는 서명 검증 불가(`AMA_TOKEN_INVALID_SIGNATURE`). 본 요구사항은 이 토큰을 **`/admin/config`에 입력한 검증 정보로 ACM이 직접 로컬 검증**한다 (REQ-260525 Custom App SSO를 어드민 설정 기반으로 정식화).

## 2. Functional Requirements
- **FR-1**: `/admin/config`에 입력/저장 — **Custom App HS256 secret**(AES-GCM 암호화), **expectedScope**(예 `custom_app:context`), 기존 entityId·appCode.
- **FR-2**: 신규 검증 모드 `AMA_TOKEN_VERIFY_MODE=local_config`:
  1. 토큰 decode(무검증)로 `entityId` 추출 → active config 조회
  2. config secret 복호화 → `jwt.verify(token, secret, HS256, clockTolerance=30)`
  3. `token.scope === expectedScope`, `token.appCode === appCode`, `token.entityId === config.amaEntityId` 검증
  4. 토큰 클레임(`sub·email·role`)으로 사용자 upsert → ACM JWT (구독·멤버십 호출 없음)
- **FR-3**: 역할 — 토큰 `role`(USER_LEVEL) + jobRole로 `mapAcmRole` 매핑(MASTER→ADMIN). email/name은 토큰값 사용.
- **FR-4**: 에러 — 서명실패/만료 401, scope/appCode/entity 불일치 403 ENTITY_NOT_ALLOWED, secret 미설정 503.

## 3. Non-Functional
- **NFR-1 보안**: Custom App secret은 **AES-GCM(ACM_PII_KEY) 암호화 저장**, 응답엔 `isSet`만, 복호화는 검증 시 메모리에서만. 로그 평문 금지.
- **NFR-2 토글**: `local | ama_session | local_config` 모드 공존(무중단 전환·롤백).
- **NFR-3 i18n**: 신규 UI 문자열 4 locale.

## 4. Out of Scope
- AMA 측 앱 재구성(B안). 구독·멤버십 live 호출.

## 5. Acceptance
1. 어드민이 secret/scope 입력 → 동일 Custom App 토큰 로그인 성공, 신규=ADMIN(MASTER), email=토큰값.
2. secret 오타 → 401, scope/entity 불일치 → 403.
3. 응답에 secret 평문 미노출(`customAppSecretIsSet`만).
