---
document_id: REQ-260621-acm-ui-system-admin
version: 1.0.0
status: implemented
created: 2026-06-21
authors:
  - gray.kim@amoeba.group
related:
  - docs/plan/PLN-260621-acm-ui-system-admin.md
change_log:
  - 2026-06-21 v1.0.0 — initial. ACM admin UI rework + cross-tenant System Admin.
---

# 요구사항 분석서 — ACM UI 개편 + System Admin (REQ-260621)

> **One-liner**: ACM 어드민 상단/사이드바 UX 정리, `/admin/config` 의 Configuration 카드뷰 분리, 그리고 APP_ADMIN 전용 교차-테넌트 시스템 관리(`/system/admin`) 신설.

---

## 1. Overview (개요)

acm.amoeba.site 운영 콘솔의 헤더·네비게이션을 정리하고, 연동 설정 페이지를 통합 단일 폼에서 카드 메뉴 + 개별 페이지 구조로 분리한다. 추가로 ACM 에 등록된 사용자 계정을 **테넌트 경계를 넘어** 관리하는 시스템 관리자 영역을 신설하고, 이를 위한 최상위 권한(`APP_ADMIN`)과 초기 시스템 관리자 계정을 추가한다.

## 2. Functional Requirements (기능 요구사항)

| ID | 요구사항 | 구현 |
|----|----------|------|
| FR-01 | 상단 브랜드 "ACM v1.0a" → "ACM" 표기 변경, 링크 `/` → `/admin` | [app-shell.tsx](../../frontend-acm/src/components/layout/app-shell.tsx) 헤더 `<Link to="/admin">ACM</Link>` |
| FR-02 | 우측 상단 로그인 사용자정보 \| 로그아웃 → 좌측 메뉴바 하단 고정 | app-shell `<aside>` 하단 고정 영역(`border-t`) |
| FR-03 | nav 라벨 "연동 설정 / Integration" → "설정 / Configuration" | common.json `nav.config` (4 locale) |
| FR-04 | `/admin/config` 를 카드뷰 메뉴 + AMA / BODA 개별 페이지로 분리 | [config-landing-page.tsx](../../frontend-acm/src/modules/cfg/pages/config-landing-page.tsx) + `config/ama` + `config/boda` |
| FR-05 | `/system/admin` 신설 — ACM 등록 사용자 관리(목록/생성/수정/비밀번호/잠금) | [system-admin-page.tsx](../../frontend-acm/src/modules/system/pages/system-admin-page.tsx) + `/api/acm/system/users` |
| FR-06 | 시스템 관리자 계정 생성: `admin@amoeba.group` / `temp@2026` / `APP_ADMIN` | dev/staging [511-seed-app-admin-dev.sql](../../sql/acm/511-seed-app-admin-dev.sql) · prod [gen-app-admin-seed.cjs](../../backend/scripts/gen-app-admin-seed.cjs) |
| FR-07 | 시드/임시 비밀번호는 첫 로그인 시 강제 변경 | `usr_must_change_password` + `RequirePasswordRotationGuard` + `/admin/change-password` |

## 3. Non-Functional / Security (비기능·보안)

| ID | 내용 |
|----|------|
| NFR-01 | `/system/admin` 은 **교차 테넌트**(전체 `ent_id`) 조회/관리 — NFR-004 테넌트 격리 경계를 의도적으로 넘는다. |
| NFR-02 | 따라서 백엔드 `/acm/system/*` 모든 라우트는 `@Roles('APP_ADMIN')` + `RolesGuard` 로 제한하고 `OwnEntityGuard` 를 적용하지 않는다. 프론트는 `RequireAppAdmin` 로 이중 게이팅. |
| NFR-03 | 비밀번호는 기존 정책(8–120자, 영문+숫자) + bcrypt(12) 재사용. |
| NFR-04 | i18n 4 locale(ko/en/vi/zh-CN) 신규 `system` 네임스페이스 + `common.config.*` + `auth.changePassword.*` 키 동시 반영(하드코딩 금지). |
| NFR-05 | **기본 자격증명 강화(보안 리뷰 HIGH 조치)**: (a) 시드/관리자-리셋 계정은 `usr_must_change_password=true` → `RequirePasswordRotationGuard` 가 `/acm/system/*` 차단 + UI 강제 변경, (b) prod 는 공유 해시 미커밋 — `gen-app-admin-seed.cjs` 로 환경별 랜덤 비밀번호 생성, (c) `APP_ADMIN` 은 TPI 테넌트(`…01`) 가 아닌 전용 시스템 테넌트 `…ff` 에 배치. |

## 4. Data Model Impact (데이터 모델 영향)

- `amb_acm_user.usr_role` CHECK 제약 확장: `('ADMIN','TEACHER','STAFF','APP_ADMIN')`.
- `amb_acm_user.usr_must_change_password BOOLEAN DEFAULT false` 신규 컬럼.
- 시스템 관리자 row: `admin@amoeba.group` (`ent_id=00000000-…00ff` 전용 시스템 테넌트, `APP_ADMIN`, `auth_source='local'`, `must_change_password=true`).
- role union 타입 확장: JWT payload / entity / DTO / mapper / FE auth store.

## 5. Open Questions / Decisions (결정 사항)

| Q | 결정 |
|---|------|
| `app-admin` role 처리 | 신규 `APP_ADMIN` role 추가 (시스템 super-admin 계층) — 2026-06-21 사용자 결정 |
| 시스템 관리 범위 | **전체 테넌트 교차 관리** — 2026-06-21 사용자 결정 (보안 검토 대상) |
| 라우트 배치 | 별도 `SystemShell` (`/system/*`) — admin 과 분리 |

## 6. Out of Scope (제외)

- 감사 로그(audit trail) for cross-tenant 작업 — 후속 과제.
- 테넌트(ent) 자체의 CRUD 관리 — 본 범위는 사용자 계정에 한정.
- APP_ADMIN 다중 계정 셀프 프로비저닝 정책.
