---
document_id: PLN-260708-portal-tenant-scoped-login
version: 0.1.0 (draft — 승인 대기)
status: draft
created: 2026-07-08
authors:
  - gray.kim@amoeba.group
related:
  - docs/plan/PLN-260706-acm-portal-accounts-and-role-portals.md
  - backend/src/modules/acm-auth/application/portal-account.service.ts (login)
decisions:
  - 테넌트 식별자 = 신규 학원 코드(slug) `tnt_code`
  - 입력 방식 = 로그인 URL `?t=<code>` 자동채움 + 화면 "학원 코드" 필드 병행
---

# 포털 테넌트 스코프 로그인 (Portal Tenant-scoped Login)

## 1. 개요 (Overview)
강사·학생·학부모 포털 로그인(`/portal/auth/login`)에 **테넌트(학원) 식별자**를 도입해,
로그인ID를 **소속 학원 범위 안에서만** 조회하도록 한다. 멀티테넌트 SaaS에서 로그인ID
충돌·오배정을 방지한다.

## 2. 문제 (As-is)
- `PortalAccountService.login(loginId, password)` 이 `findOne({ loginId, status:'ACTIVE' })` 로
  **테넌트 무관 전역 매칭**(첫 ACTIVE). 로그인ID는 `UNIQUE(ent_id, pac_login_id)` — 테넌트별 유일.
- 학원이 2곳 이상이면 같은 `loginId` 발급 시 **다른 학원 계정 로그인** 가능(NFR-004 테넌트 격리 위반).
- 사용자가 **소속 학원**을 지정할 수단 없음.
- `amb_acm_tenant` 에 `tnt_name`·`tnt_ama_entity_code` 는 있으나 **로그인용 짧은 코드 없음.**

## 3. 요구사항 (Requirements)
| # | 내용 |
|---|------|
| R1 | 포털 로그인은 (학원 코드 + 로그인ID + 비밀번호)로 인증하며, 계정 조회를 학원 코드 → entId 범위로 스코프 |
| R2 | 학원 코드는 학원별 **짧은 slug**(신규 `tnt_code`), 시스템 관리(APP_ADMIN)에서 설정 |
| R3 | 로그인 링크 `…/portal/login?t=<code>` 로 코드 자동 주입, 없으면 화면 필드로 직접 입력 |

## 4. 설계 (Design)

### 4.1 데이터
- `amb_acm_tenant` 에 `tnt_code VARCHAR(40)` 추가 + `UNIQUE(tnt_code)`(부분: NOT NULL). 마이그레이션 998.
- 기존 TPI 테넌트(`…01`) 코드 시드: `tpi`.

### 4.2 백엔드
- `TenantService`(또는 신규 lookup): `resolveEntIdByCode(code): entId|null` — `amb_acm_tenant` 에서
  `tnt_code`(소문자 정규화) + status ACTIVE 조회.
- `PortalAccountService.login(tenantCode, loginId, password)`:
  1. `entId = resolveEntIdByCode(tenantCode)`; 없으면 401(계정 노출 방지 위해 로그인ID 오류와 동일 메시지).
  2. `findOne({ entId, loginId, status:'ACTIVE' })` → bcrypt 검증(기존과 동일).
- `PortalLoginDto` 에 `tenantCode` 필수 추가. 컨트롤러가 전달.
- **시스템 테넌트 관리**: `UpdateTenantDto`/`CreateTenantDto` + `TenantView` 에 `code` 추가,
  `tenant.service.update/create` 에서 `tnt_code` 반영(소문자·유일성 검증, 409 on dup).

### 4.3 프론트엔드
- `PortalLoginPage`: **학원 코드** 입력 필드 추가. `?t=` 쿼리 있으면 프리필(+회색/읽기전용),
  없으면 사용자 입력. `portalApi.login(tenantCode, loginId, password)`.
- 로그인 성공 후에는 JWT 안의 entId 로 스코프되므로 이후 호출엔 코드 불요(변경 없음).
- 시스템 `TenantDetailPage`: "학원 코드(로그인용)" 편집 필드.
- (선택) 관리자 **포털 계정 패널**의 발급 결과에 **로그인 링크**(`/portal/login?t=<code>`) 표기 — 전달 편의.
- i18n 4로케일.

### 4.4 호환성
- `tenantCode` 필수화 → 프론트 로그인은 항상 코드 전송(URL/필드). 단일 테넌트는 `tpi` 코드로 동작.
- 기존 portal_account 행 변경 없음(entId 이미 보유). 마이그레이션은 컬럼 추가 + 시드뿐.

## 5. 화면 구성안 (UI Mockup)
```
포털 로그인 (/portal/login  또는  /portal/login?t=trinity)
┌───────────────────────────────────┐
│          Trinity Academy 포털       │
│                                     │
│  학원 코드  [ trinity            ]  │ ← ?t= 있으면 자동채움(읽기전용)
│  아이디    [ s7k3m9              ]  │
│  비밀번호  [ ••••••••            ]  │
│          [        로그인        ]   │
│  · 최초 로그인 시 비밀번호를 변경합니다 │
└───────────────────────────────────┘

시스템 > 테넌트 상세
┌ 학원 정보 ─────────────────────────┐
│ 학원명       [ Trinity Academy    ] │
│ 학원 코드    [ tpi                ] │ ← 로그인 URL/필드에 사용, 소문자·유일
│ 상태         [ ACTIVE ▾           ] │
└────────────────────────────────────┘
```

## 6. 작업 분해
1. 마이그레이션 998(`tnt_code` + unique + TPI 시드) + 엔티티 컬럼.
2. 백엔드: 테넌트 코드 resolve + `PortalAccountService.login` 시그니처 변경 + `PortalLoginDto` + 컨트롤러.
3. 백엔드: 시스템 테넌트 DTO/서비스/뷰에 `code`.
4. 프론트: 포털 로그인 학원코드 필드 + `?t=` 프리필 + api + store 불변.
5. 프론트: 테넌트 상세 코드 편집 + (선택) 포털계정 패널 로그인 링크 + i18n.
6. 테스트(로그인 스코프 유닛) + 검증 + 배포(마이그레이션 자동적용).

## 7. 리스크
- **보안**: 알 수 없는 학원 코드/로그인ID 는 동일 401 메시지(계정·테넌트 존재 여부 노출 금지).
- **코드 유일성**: `tnt_code` UNIQUE, 소문자 정규화. 대소문자/공백 혼동 방지.
- **배포 순서**: 로그인 DTO 필수화 + 프론트 필드가 **같은 릴리스**에 나가야 함(부분배포 시 로그인 불가). 프론트+백엔드 동시 배포.
