---
document_id: REQ-260609-ama-tpi-sso-client-sync
version: 1.1.0
status: APPROVED-PENDING
author: Claude Code (gray.kim@amoeba.group)
created: 2026-06-09
related:
  - docs/plan/PLN-260609-ama-tpi-sso-client-sync.md
  - docs/integration/ama-platform-spec-asks.md
  - backend/src/modules/acm-auth/application/acm-auth.service.ts
change_log:
  - 2026-06-09 v1.0.0 초안 (3-epic: entity gate / role mapping / parent→client)
  - 2026-06-09 v1.1.0 결정 반영: 역할(MASTER/MANAGER→ADMIN, 직무 TEACHER→강사), 자격=ACTIVE 학생 보유, payload=name+phone+email. O-7 해소 — 구현 착수 최종 확인 대기
---

# REQ-260609 — AMA SSO TPI 게이트 · 역할 매핑 · 학부모 고객사 등록 (Requirements Analysis)

## 1. Overview (개요)

`tpi-acm` 앱은 **TPI(Trinity Prep Institute) 전용 앱**이다. 본 요구사항은 AMA 플랫폼(`ama.amoeba.site`) SSO 로그인 흐름에 3가지를 추가한다.

| Epic | 요약 |
|------|------|
| **A. Entity 게이트** | AMA SSO 토큰 교환 시 **entity `VN3040`(TPI)** 일 때만 로그인 허용 |
| **B. 역할 매핑** | AMA `USER_LEVEL` + 직무 필드로 ACM 역할(ADMIN/TEACHER/STAFF) 결정 |
| **C. 학부모→고객사** | 상담 후 수강 결정한 학부모를 직원이 **수동 버튼**으로 entity VN3040 하위 **AMA 고객사(client)** 로 등록 (실 API) |

## 2. Current State (현행)

- AMA SSO 교환 로그인이 이미 존재: `POST /api/acm/auth/ama-exchange` → 토큰검증 → 구독체크 → 멤버십체크 → 사용자 upsert → ACM JWT 발급. ([acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) `exchangeAmaToken`)
- 토큰 클레임: `sub, email, role(=USER_LEVEL, 예 'MASTER'), entityId, appCode, scope`. `appCode` 화이트리스트는 `tpi-acm`.
- `usr_role` 는 upsert 시 토큰 `role` 을 `ama_role` 컬럼에만 저장하고, **ACM 역할(ADMIN/TEACHER/STAFF)로 매핑하지 않음.**
- AMA 플랫폼 사용자 조회(`GET /api/v1/entities/{entityId}/users/{userId}`)는 `level`+5필드만 파싱, **직무 필드 없음.** ([ama-platform-http.client.ts](../../backend/src/modules/acm-auth/infrastructure/ama-platform-http.client.ts))
- AMA Client API는 **read-only** (`GET /api/v1/clients`, `/clients/{id}`, Bearer `AMA_API_KEY`+HMAC). 쓰기 경로 없음. ([ama-client.service.ts](../../backend/src/infrastructure/external/ama/ama-client.service.ts))
- 학부모: `amb_acm_std_parent` (UUID), `/api/acm/std/parents` CRUD. ([parent.controller.ts](../../backend/src/modules/acm-std/presentation/parent.controller.ts))
- 학부모↔학생 연결: `amb_acm_std_student_parent`. 수강 상태: 레거시 `tac_enrollments`(bigint, `enr_status` PENDING/CONFIRMED) 또는 `acm-csl` 문의-연동.
- TPI academy 레코드: `tac_academies` (`acd_ama_tenant_id`=entityId UUID, `acd_subscription_status`). ([academy.entity.ts](../../backend/src/infrastructure/database/entities/academy.entity.ts))

## 3. Functional Requirements (기능 요구사항)

### FR-A. TPI Entity 게이트 (VN3040)

- **FR-A1**: academy 설정에 AMA **entity code(`VN3040`)** 와 **entId UUID** 를 둘 다 저장한다. (`tac_academies.acd_ama_entity_code` 신규)
- **FR-A2**: SSO 교환 시 토큰의 `entityId`(UUID)로 academy 를 조회하고, 해당 academy 의 `acd_ama_entity_code` 가 **허용 화이트리스트(env `AMA_ALLOWED_ENTITY_CODES`, 기본 `VN3040`)** 에 포함될 때만 로그인 허용.
- **FR-A3**: 토큰에 `entityCode`(또는 `entitySlug`) 클레임이 있으면 저장값과 **상호 검증**(불일치 시 거부). 클레임이 없으면 academy 저장값만으로 게이트.
- **FR-A4**: 미허용 entity → **403 `ENTITY_NOT_ALLOWED`** (fail-closed). 구독/멤버십 체크 이전 또는 직후 위치(설계는 PLN).

### FR-B. USER_LEVEL · 직무 → ACM 역할 매핑

- **FR-B1**: `USER_LEVEL ∈ {MASTER, MANAGER}` → **ACM ADMIN**.
- **FR-B2**: 그 외 레벨 → 직무 필드로 분기: **직무 == `TEACHER` → TEACHER(강사)**, 그 외 → **STAFF(직원)**.
- **FR-B3**: 직무 필드는 토큰 클레임에 **없으면 `GET /entities/{entityId}/users/{userId}` 로 별도 조회**한다. (플랫폼 사용자 DTO에 직무 필드 추가)
- **FR-B4**: 역할은 **매 로그인마다 재평가**하여 `amb_acm_user.usr_role` 에 반영(레벨/직무 변경 전파). `ama_role`(레벨)·직무는 감사용으로 보관.

```
mapAcmRole(level, jobRole):
  if level in {MASTER, MANAGER}: return ADMIN
  if jobRole == 'TEACHER':       return TEACHER
  return STAFF
```

### FR-C. 학부모 → AMA 고객사 수동 등록

- **FR-C1**: 직원(ADMIN/STAFF)이 학부모 목록/상세에서 **"AMA 고객사 등록" 버튼**으로 트리거. (TEACHER 불가)
- **FR-C2**: 대상은 **수강을 결정한 학부모** — `acm-std` 에 상담/수강 상태 신호가 없으므로 **프록시**로 정의: 학부모(`amb_acm_std_parent`)가 `amb_acm_std_student_parent` 를 통해 **`std_status='ACTIVE'` 학생을 1명 이상 보유**할 것. (등록된 학생이 ACTIVE = 실제 수강 중 = 수강 결정) 미충족 시 버튼 비활성 + 백엔드 **422 `NO_ACTIVE_STUDENT`**.
- **FR-C3**: entity **VN3040 하위 client** 로 POST. **`name`+`phone`+`email`** 전송(phone/email 은 AES-GCM 복호화 후 전송, NFR-2 준수).
- **FR-C4**: **멱등** — 이미 등록된 학부모(`par_ama_client_id` 보유)는 재호출 시 기존 id 반환, 중복 POST 금지. AMA 409(중복) 시 기존 id 저장.
- **FR-C5**: 등록 성공 시 반환된 `amaClientId` 를 `amb_acm_std_parent.par_ama_client_id` + `par_ama_registered_at` 에 저장하고 UI에 "등록됨" 상태 표시.

## 4. Non-Functional (비기능)

- **NFR-1 보안**: 쓰기 호출도 read-only 와 동일하게 Bearer + HMAC 서명(§6 확정). PAN/카드정보 무관.
- **NFR-2 개인정보**: 전화/이메일은 AES-GCM 암호화 저장. AMA 전송 시에만 복호화하며 로그에 평문 금지.
- **NFR-3 멀티테넌시**: 모든 신규 쿼리에 `ent_id`/`academy_id` 스코프 유지.
- **NFR-4 fail-closed**: entity 게이트·멤버십은 5xx 시 차단(503), 캐시 폴백 금지(멤버십). 구독은 기존 24h 캐시 폴백 유지.
- **NFR-5 i18n**: 신규 UI 문자열은 4 locale(ko/en/vi/zh-CN) react-i18next 키로. 하드코딩 금지.

## 5. Out of Scope (범위 외)

- AMA 고객사 **수정/삭제/동기화**(본 건은 생성만). 
- 자동(이벤트 기반) 학부모 등록 — 본 건은 수동 버튼만.
- TPI 외 테넌트 입주(현재 VN3040 단일).

## 6. Open Items — 연동 계약 확정 필요 (AMA 플랫폼팀)

| # | 항목 | 기본 가정(미확정 시) |
|---|------|----------------------|
| **O-1** | Add Client **엔드포인트** | `POST /api/v1/entities/{entityId}/clients` (entity 스코프 확정됨) |
| **O-2** | 인증 | read-only 미러링: `Bearer AMA_API_KEY` + HMAC(`X-Ama-Timestamp`,`X-Ama-Signature`) |
| **O-3** | 요청 body 필드 | **확정**: `{ name, phone, email }` 전송(phone/email 복호화). 추가 필수 필드 유무만 확인 |
| **O-4** | 응답 | `{ amaClientId }` 반환(멱등키) 가정 |
| **O-5** | 중복 동작 | 동일 이름/연락처 시 409 + 기존 id 반환, 또는 upsert |
| **O-6** | AMA **직무 필드명** | `jobRole`/`position`/`employmentType` 중 무엇이 TEACHER 값을 갖는지 확정 필요 |
| ~~O-7~~ | ~~"수강 결정 완료" 술어~~ | **해소**: ACTIVE 학생 보유 프록시(FR-C2)로 확정. 크로스모듈 링크 불필요 |

> O-1~O-6 은 [ama-platform-spec-asks.md](../integration/ama-platform-spec-asks.md) 에 A-6(신규 write) 으로 등재한다.

## 7. Acceptance Criteria (인수 기준)

- **AC-A**: VN3040 entity 토큰 → 로그인 성공. 비-VN3040 entity 토큰 → 403 `ENTITY_NOT_ALLOWED`.
- **AC-B1**: MASTER/MANAGER 로그인 → `usr_role=ADMIN`.
- **AC-B2**: level=MEMBER & jobRole=TEACHER → `usr_role=TEACHER`; jobRole≠TEACHER → `STAFF`. 토큰에 직무 없으면 별도 조회 후 판정.
- **AC-C1**: ACTIVE 학생이 없는 학부모 → 버튼 비활성 + API 422 `NO_ACTIVE_STUDENT`.
- **AC-C2**: 자격 학부모 등록 → AMA 201/200 + `par_ama_client_id` 저장 + UI "등록됨".
- **AC-C3**: 등록된 학부모 재클릭 → 중복 POST 없이 기존 id 반환(멱등).
- **AC-C4**: TEACHER 역할 사용자는 등록 버튼/API 접근 불가(403).
