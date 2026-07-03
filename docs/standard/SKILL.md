---
name: app-academy-standard
description: Use this skill when working on the App Academy / Trinity Academy ACM repository, including NestJS backend modules, frontend-acm React screens, PostgreSQL ACM migrations, and documentation.
version: 1.0.0
updated: 2026-07-04
based_on:
  - docs/amoeba-starter-kit/amoeba_basic_skill_v2.md
  - docs/amoeba-starter-kit/amoeba-spec-generator-SKILL-v3.1.md
  - docs/amoeba-starter-kit/amb-access-control-policy.md
---

# App Academy Standard Skill

이 문서는 `docs/amoeba-starter-kit`의 기본 스킬 규칙을 현재 저장소의 실제 구현 구조에 맞춘 작업 스킬이다. 이 저장소에서 기능 추가, 버그 수정, 문서화, 마이그레이션, 화면 구현을 수행할 때 우선 적용한다.

## 1. 사용 시점

다음 작업을 할 때 이 스킬을 적용한다.

- `backend/src/modules/acm-*` 기반 ACM 기능 개발
- `frontend-acm/src/modules/*` 기반 React 화면 개발
- `sql/acm/*.sql` PostgreSQL 스키마, 시드, 마이그레이션 작성
- PostgreSQL `db_acm`, `amb_acm_*` 기준 기능 개발
- 운영/개발 문서, 요구사항, 완료보고서, 표준 문서 작성
- 권한, 테넌트, 학부모/관리자/시스템 관리자 접근 제어 변경

## 2. 핵심 판단

- 현재 저장소는 스타터킷의 표준 `apps/api`, `apps/web` 구조가 아니라 `backend`, `frontend-acm`, `sql/acm` 구조로 구현되어 있다.
- 신규 개발 표준 데이터베이스는 PostgreSQL `db_acm`이다.
- MySQL legacy runtime과 schema는 제거된 것으로 간주하며 신규 기능의 기준으로 삼지 않는다.
- PostgreSQL 연결은 NestJS named datasource `ACM_DS`를 사용한다.
- 테넌트 격리는 `ent_id` 기준으로 설계하며, 교차 테넌트 기능은 `APP_ADMIN`/시스템 관리 기능으로 제한한다.
- TypeORM `synchronize`는 사용하지 않는다. 스키마 변경은 SQL 마이그레이션으로 관리한다.

## 3. 작업 전 확인

작업을 시작할 때 다음 파일을 먼저 확인한다.

- 프로젝트 스펙: `docs/standard/SPEC.md`
- 구조 표준: `docs/standard/STRUCTURE.md`
- 코드 규칙: `docs/standard/CODE_CONVENTION.md`
- 웹 스타일: `docs/standard/STYLE_GUIDE.md`
- 최신 완료보고서: `docs/report/RPT-260703-app-academy-development-completion.md`
- 백엔드 엔트리: `backend/src/app.module.ts`, `backend/src/main.ts`
- 프론트 라우터: `frontend-acm/src/routes/router.tsx`
- 디자인 토큰: `frontend-acm/src/styles/tokens.css`

## 4. 개발 워크플로

1. 요청 범위를 `backend`, `frontend-acm`, `sql/acm`, `docs` 중 어디에 반영할지 분류한다.
2. 같은 도메인의 기존 모듈을 먼저 읽고 파일 배치, 네이밍, 응답 형태를 따른다.
3. 데이터 변경이 있으면 PostgreSQL 마이그레이션을 `sql/acm`에 추가한다.
4. API 변경이 있으면 프론트 hooks/types와 백엔드 DTO/controller/service를 함께 맞춘다.
5. 접근 제어가 필요한 기능은 `roles`, `ent_id`, `OwnEntityGuard`, `RequireAuth`, `RequireAppAdmin` 적용 여부를 확인한다.
6. 구현 후 가능한 범위에서 build, type-check, unit/integration test를 실행한다.
7. 변경 요약에는 신규 기능, 영향 파일, 검증 결과, 남은 리스크를 짧게 남긴다.

## 5. 백엔드 지침

- 신규 ACM 기능은 기본적으로 `backend/src/modules/acm-{domain}` 아래에 작성한다.
- 모듈 내부는 `presentation`, `application`, `infrastructure/typeorm` 계층을 우선 사용한다.
- Controller는 HTTP 계약과 인증/권한에 집중한다.
- Service는 유스케이스와 트랜잭션 경계를 담당한다.
- TypeORM entity는 PostgreSQL `amb_acm_*` 테이블과 매핑한다.
- DB 접근은 `@InjectRepository(Entity, ACM_DS)` 또는 `@InjectDataSource(ACM_DS)`를 사용한다.
- 신규 코드에서 PostgreSQL `ACM_DS` 외 DB datasource에 의존하지 않는다.
- 개인정보는 평문 저장을 피하고, 기존 `AesGcmService`/`ACM_PII_KEY` 패턴을 검토한다.

## 6. 프론트엔드 지침

- 신규 화면은 `frontend-acm/src/modules/{domain}`에 `pages`, `components`, `hooks`, `types` 구조로 둔다.
- 라우트는 `frontend-acm/src/routes/router.tsx`에서 shell별로 배치한다.
- 관리자 화면은 `AppShell`, 학부모 포털은 `ParentShell`, 공개 포털은 `PortalLayout`, 시스템 관리는 `SystemShell`을 사용한다.
- 서버 상태는 TanStack Query hook으로 캡슐화한다.
- 공용 UI는 `frontend-acm/src/components/ui`에 두고, 도메인 전용 UI는 각 모듈의 `components`에 둔다.
- 다국어 문구는 `frontend-acm/src/i18n/locales/*` 파일을 함께 갱신한다.

## 7. DB 및 마이그레이션 지침

- 신규 스키마 파일은 `sql/acm/{number}-{description}.sql` 형식을 따른다.
- 테이블명은 `amb_acm_{domain}_{name}` 패턴을 우선 사용한다.
- PK는 UUID 또는 기존 ACM 표준 PK를 사용하고, 테넌트 데이터에는 `ent_id`를 포함한다.
- 생성/수정 시각은 `created_at`, `updated_at`을 사용한다.
- 루트 `sql/*.sql` MySQL schema/seed 파일은 사용하지 않는다. 신규 SQL은 `sql/acm`에만 둔다.
- compatibility field가 필요하면 제거 조건과 만료 시점을 문서화한다.

## 8. 문서 작성 지침

- 운영자가 읽는 문서는 한국어를 기본으로 작성하고, 코드 식별자와 API 이름은 원문을 유지한다.
- 요구사항/분석/보고 문서는 날짜 기반 식별자를 사용한다.
- 표준 문서는 `/docs/standard`에 두고, starter-kit 원문은 `/docs/amoeba-starter-kit`에 보존한다.
- 문서에는 현재 구현과 목표 상태를 구분해서 적는다.
- MySQL 의존이 발견되면 결함으로 기록하고 PostgreSQL-only 기준으로 제거한다.

## 9. 검증 명령

상황에 맞게 다음 명령을 사용한다.

```bash
npm run build:be
npm run build:fe
cd backend && npm run test
cd backend && npm run test:int
cd frontend-acm && npm run type-check
```

프론트 lint는 현재 `frontend-acm/package.json`에서 pending 스크립트이므로, type-check와 build 결과를 우선 검증한다.

## 10. 완료 기준

- 기능과 문서가 현재 저장소 구조에 맞게 반영되어 있다.
- 신규 데이터 변경은 PostgreSQL ACM 마이그레이션으로 표현되어 있다.
- MySQL 의존을 새로 늘리지 않았다.
- 접근 제어와 테넌트 격리 기준이 깨지지 않았다.
- 실행 가능한 검증 명령을 수행했거나, 수행하지 못한 이유가 명시되어 있다.
