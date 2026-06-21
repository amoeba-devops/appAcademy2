---
document_id: PLN-260621-acm-ui-system-admin
version: 1.0.0
status: implemented
created: 2026-06-21
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260621-acm-ui-system-admin.md (v1.0.0)
change_log:
  - 2026-06-21 v1.0.0 — T1–T6 구현 완료. nest/tsc/vite build clean, 5 system spec pass.
  - 2026-06-21 v1.1.0 — System Admin 확장(사용자 상세 / 테넌트 허브 / 테넌트별 메뉴 노출). §9 참조.
---

# 작업 계획서 — ACM UI 개편 + System Admin (REQ-260621)

## 1. 트랙 요약

| 트랙 | 내용 | 상태 |
|------|------|------|
| T1 | DB — `APP_ADMIN` CHECK 확장 + `admin@amoeba.group` seed | ✅ |
| T2 | BE — role union 확장 + `acm-system` 모듈(교차 테넌트 user 관리 API) | ✅ |
| T3 | FE — app-shell 헤더(ACM→/admin) + 사용자정보·로그아웃 사이드바 하단 고정 | ✅ |
| T4 | FE — Configuration 카드 랜딩 + `config/ama`·`config/boda` 분리, nav 라벨 변경 | ✅ |
| T5 | FE — `SystemShell` + `/system/admin` 사용자 관리 + `RequireAppAdmin` 게이트 | ✅ |
| T6 | i18n ×4 + builds + docs + security review | ✅ |

## 2. 신규/수정 파일

### 신규
- `sql/acm/510-migration-app-admin-role.sql` (schema: CHECK + `usr_must_change_password`), `sql/acm/511-seed-app-admin-dev.sql` (dev/staging seed)
- `backend/scripts/gen-app-admin-seed.cjs` (prod 환경별 랜덤 비밀번호 시드 생성)
- `backend/src/modules/acm-system/` (module, `application/system-user.service.ts` + `.spec.ts`, `application/dto/system-user.dto.ts`, `presentation/system-user.controller.ts`)
- `backend/src/modules/acm-common/guards/require-password-rotation.guard.ts` + `.spec.ts`
- `frontend-acm/src/modules/cfg/pages/config-landing-page.tsx`, `boda-config-page.tsx`
- `frontend-acm/src/modules/system/pages/system-admin-page.tsx`, `hooks/use-system-users.ts`
- `frontend-acm/src/modules/auth/pages/change-password-page.tsx`
- `frontend-acm/src/components/layout/system-shell.tsx`, `require-app-admin.tsx`
- `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/system.json`

### 보안 하드닝 (보안 리뷰 HIGH 조치)
- `usr_must_change_password` 컬럼 + `RequirePasswordRotationGuard` (SystemUserController 에 적용) + `POST /acm/auth/change-password` + `/admin/change-password` 강제 변경 UI.
- 시드 비밀번호는 dev/staging 만 커밋(`temp@2026`), prod 는 `gen-app-admin-seed.cjs` 랜덤.
- `APP_ADMIN` 전용 시스템 테넌트 `00000000-…00ff` (TPI `…01` 와 분리).

### 수정
- BE role union: `acm-role.mapper.ts`, `current-user.decorator.ts`, `acm-user.typeorm-entity.ts`, `dto/acm-auth.dto.ts`, `acm-auth.service.ts`(`AcmJwtPayload` + `createUserWithPassword`), `jwt/acm-jwt.strategy.ts`, `acm.module.ts`
- FE: `app-shell.tsx`, `routes/router.tsx`, `stores/auth.store.ts`, `modules/cfg/pages/ama-config-page.tsx`, `i18n/index.ts`, `i18n/locales/{*}/common.json`

## 3. API

```
GET    /api/acm/system/users          ?q&role&entId&page&limit   (APP_ADMIN)
POST   /api/acm/system/users          { entId, email, name, password, role }
PATCH  /api/acm/system/users/:id      { name?, role?, status? }
PATCH  /api/acm/system/users/:id/password   { password }
PATCH  /api/acm/system/users/:id/lock
PATCH  /api/acm/system/users/:id/unlock
```
모두 `@Roles('APP_ADMIN')` + `RolesGuard`. `OwnEntityGuard` 미적용(교차 테넌트).

## 4. 배포 주의

- **수동 마이그레이션**: `sql/acm/510-migration-app-admin-role.sql`(스키마, 전 환경 안전)을 ACM Postgres 에 적용.
- dev/staging 계정: `sql/acm/511-seed-app-admin-dev.sql` (temp@2026, `must_change_password=true` → 첫 로그인 강제 변경).
- **production 계정**: `511` 을 적용하지 말 것. `node backend/scripts/gen-app-admin-seed.cjs` 로 환경별 랜덤 비밀번호 + bcrypt 해시가 든 INSERT 를 생성해 prod DB 에 적용하고, 출력된 비밀번호를 1회 캡처. (`APP_ADMIN_PASSWORD` 환경변수로 지정 가능.)

## 5. 검증

- `cd backend && npx nest build` → clean
- `cd backend && npx jest src/modules/acm-system` → 5 passed
- `cd frontend-acm && npx tsc --noEmit && npx vite build` → clean
- `/security-review` (교차 테넌트 경계) — 본 PLN 작성 시점 수행.

## 6. Out-of-scope / 후속

- cross-tenant 작업 감사 로그.
- 테넌트(ent) CRUD 관리 화면.

---

## 9. v1.1 — System Admin 확장 (2026-06-21)

### 9.1 데이터 모델 (신규 2테이블, `sql/acm/520-acm-tenant.sql`)
- `amb_acm_tenant` — 테넌트 레지스트리 (tnt_ent_id PK / tnt_name / tnt_status / tnt_is_system). 시드: TPI(…0001), System(…00ff).
- `amb_acm_tenant_menu` — 테넌트별 메뉴 노출 override (PK ent_id+menu_key, visible). 행 없으면 노출(기본).

### 9.2 백엔드 (acm-system 확장)
```
GET   /acm/system/tenants                 테넌트 목록(+userCount)      [APP_ADMIN]
POST  /acm/system/tenants                 테넌트 등록
GET   /acm/system/tenants/:entId          상세
PATCH /acm/system/tenants/:entId          이름/상태 수정
GET   /acm/system/tenants/:entId/menus    메뉴 노출 설정(기본 병합)
PUT   /acm/system/tenants/:entId/menus    메뉴 노출 일괄 저장
GET   /acm/system/users/:id               사용자 상세
GET   /acm/me/menus                        내 테넌트의 hidden 메뉴 키(로그인 사용자)
```
- `dashboard`는 항상 노출(토글 불가). 메뉴 키 정본: `admin-menu-keys.ts`(BE/FE 동기화).
- `/acm/me/menus`는 APP_ADMIN 아닌 일반 사용자도 자기 ent 기준 호출.

### 9.3 프론트
- `/system/tenants`(목록) + `/system/tenants/:entId`(정보편집·소속 사용자·메뉴토글). system-shell 에 "테넌트 관리" 추가.
- 사용자 리스트: 테넌트 이름 표시 + 행 클릭 → `UserDetailDrawer`(상세 + 수정/리셋/잠금).
- `AppShell`: `useMyHiddenMenus()`(GET /acm/me/menus)로 NAV 필터 — fail-open(로딩/에러 시 전체 노출). **UI 숨김만**(백엔드 테넌트 스코핑 그대로).

### 9.4 검증
- nest build + `jest src/modules/acm-system` 10 pass(+tenant menu spec) / 전체 touched 103 pass.
- frontend-acm tsc + vite build clean.

### 9.5 배포 (직전과 동일 — DB 우선)
1. `sql/acm/520-acm-tenant.sql` 적용 (전 환경, 코드 배포 전 필수 — 엔티티가 신규 테이블 참조).
2. staging DB 적용 후 머지 → cd-staging.
3. prod DB 적용 후 cd-production dispatch.
