---
doc_id: STD-APP-ACADEMY-STRUCTURE
title: App Academy Repository Structure Standard
version: 1.0.0
updated: 2026-07-04
status: active
based_on:
  - docs/amoeba-starter-kit/amoeba_basic_Structure_v2.md
---

# App Academy Structure Standard

## 1. 구조 원칙

이 저장소는 starter-kit의 표준 `apps/api`, `apps/web` 구조가 아니라 이미 구현된 `backend`, `frontend-acm`, `sql/acm` 구조를 공식 기준으로 사용한다. 별도 구조 개편 요청이 없는 한 현재 구조를 유지하고, 신규 파일은 기존 도메인 모듈 옆에 배치한다.

## 2. 최상위 구조

```text
app-academy/
  backend/              NestJS API
  frontend-acm/         Vite React SPA
  sql/                  PostgreSQL ACM SQL
  docs/                 요구사항, 설계, 보고서, 표준 문서
  docker/               로컬/공통 docker 설정
  docker-staging/       staging 배포 설정
  docker-production/    production 배포 설정
  scripts/              운영/개발 보조 스크립트
  package.json          루트 orchestration scripts
```

## 3. Backend 구조

```text
backend/src/
  main.ts
  app.module.ts
  modules/
    acm.module.ts
    acm-common/
    acm-auth/
    acm-sch/
    acm-ref/
    acm-csl/
    acm-qna/
    acm-dsh/
    acm-cls/
    acm-std/
    acm-tch/
    acm-stf/
    acm-cal/
    acm-map/
    acm-system/
  presentation/         health/filter/interceptor runtime support
  infrastructure/       mailer, external adapters, runtime providers
  common/               shared interfaces/utilities
```

### 3.1 ACM 모듈 내부 표준

신규 ACM 도메인은 다음 구조를 우선 사용한다.

```text
backend/src/modules/acm-{domain}/
  acm-{domain}.module.ts
  presentation/
    {resource}.controller.ts
  application/
    {resource}.service.ts
    dto/
      create-{resource}.dto.ts
      update-{resource}.dto.ts
      {resource}.query.dto.ts
  infrastructure/
    typeorm/
      {resource}.typeorm-entity.ts
```

도메인이 작거나 이미 기존 파일 구조가 다르면 주변 패턴을 우선한다. 다만 `presentation`, `application`, `infrastructure/typeorm` 역할 분리는 유지한다.

### 3.2 Common 모듈

`backend/src/modules/acm-common`은 ACM 공통 기능의 기준 위치다.

- datasource token: `datasource.ts`
- auth decorator: `decorators/*`
- role/ownership guard: `guards/*`
- crypto: `crypto/aes-gcm.service.ts`
- event type: `events/acm-event.types.ts`

새 공통 기능은 실제로 2개 이상의 ACM 모듈에서 사용할 때만 이곳에 둔다.

### 3.3 Presentation 영역

`backend/src/presentation`은 health/filter/interceptor 등 NestJS 공통 런타임에 필요한 최소 파일만 유지한다.

- 신규 ACM 기능의 기준 위치로 사용하지 않는다.
- 도메인 기능은 `backend/src/modules/acm-*`로 이동하거나 대체한다.

## 4. Frontend 구조

```text
frontend-acm/src/
  routes/
    router.tsx
  components/
    layout/
    ui/
    common/
  modules/
    auth/
    portal/
    web/
    my/
    dsh/
    csl/
    cls/
    std/
    tch/
    stf/
    cal/
    map/
    sch/
    ref/
    posts/
    notifications/
    enrollments/
    qna/
    cfg/
    system/
  i18n/
    locales/
  lib/
  stores/
  styles/
```

### 4.1 Frontend 모듈 내부 표준

```text
frontend-acm/src/modules/{domain}/
  pages/
    {domain}-list-page.tsx
    {domain}-detail-page.tsx
  components/
    {domain}-table.tsx
    {domain}-form-modal.tsx
    {domain}-filters.tsx
  hooks/
    use-{domain}.ts
  types.ts
```

필요한 폴더만 만든다. 페이지 전용 컴포넌트는 도메인 모듈 안에 두고, 전역 재사용이 확인된 경우에만 `components/common` 또는 `components/ui`로 승격한다.

### 4.2 Layout 배치

- 공개 포털: `PortalLayout`
- 공개 웹 폼: shell 없이 단독 페이지 또는 web module layout
- 관리자 콘솔: `AppShell`
- 학부모 포털: `ParentShell`
- 시스템 관리: `SystemShell`
- 인증 보호: `RequireAuth`
- 시스템 관리자 보호: `RequireAppAdmin`

라우트는 반드시 `frontend-acm/src/routes/router.tsx`에서 중앙 관리한다.

## 5. SQL 구조

```text
sql/
  acm/
    100-acm-v1.0a-init.sql
    500-acm-auth.sql
    600-acm-std-students.sql
    ...
    991-acm-cal-evt-assignee-tch.sql
```

### 5.1 PostgreSQL ACM

- 신규 스키마는 `sql/acm`에 둔다.
- 번호는 기존 순서를 유지해 증가시킨다.
- 파일명은 `{number}-{domain}-{purpose}.sql` 형식을 권장한다.
- PostgreSQL 문법을 사용한다.

### 5.2 Removed Legacy SQL

- 루트 `sql/*.sql` schema/seed는 사용하지 않는다.
- 신규 기능용 스키마 추가 위치가 아니다.
- 신규/보정 SQL은 `sql/acm`에만 추가한다.

## 6. Docs 구조

```text
docs/
  amoeba-starter-kit/   원본 표준/스킬 템플릿
  standard/             이 프로젝트 전용 표준 문서
  analysis/             요구사항 분석
  design/               설계, ADR, 화면 설계
  implementation/       구현 계획/작업 기록
  integration/          외부 연동 문서
  deployment/           배포 문서
  manual/               사용자/운영 매뉴얼
  report/               완료보고서
  test/                 테스트 문서
  reference/            외부 참고자료
```

새 표준은 `docs/standard`에 작성하고, starter-kit 원본은 수정하지 않는다.

## 7. 파일명 규칙

| 영역 | 규칙 |
| --- | --- |
| Backend module | `acm-{domain}` |
| Backend controller | `{resource}.controller.ts` |
| Backend service | `{resource}.service.ts` |
| Backend DTO | `{action}-{resource}.dto.ts` 또는 `{resource}.dto.ts` |
| TypeORM entity | `{resource}.typeorm-entity.ts` |
| Frontend page | `{domain}-{view}-page.tsx` |
| Frontend hook | `use-{resource}.ts` |
| Frontend type | `types.ts` |
| SQL migration | `{number}-{domain}-{purpose}.sql` |
| Report | `RPT-{yymmdd}-{topic}.md` |
| Requirement analysis | `REQ-{yymmdd}-{topic}.md` |

## 8. 신규 도메인 추가 순서

1. PostgreSQL 테이블과 인덱스를 `sql/acm`에 정의한다.
2. `backend/src/modules/acm-{domain}`을 만든다.
3. `acm-{domain}.module.ts`를 구현하고 필요 시 `acm.module.ts`에 등록한다.
4. DTO, entity, service, controller를 작성한다.
5. `frontend-acm/src/modules/{domain}`에 pages/hooks/components/types를 추가한다.
6. `router.tsx`와 navigation 메뉴를 연결한다.
7. i18n locale을 갱신한다.
8. build/type-check/test를 수행한다.

## 9. 구조 변경 제한

- `backend`와 `frontend-acm`을 `apps/*`로 이동하지 않는다.
- 제거된 legacy DB 파일과 MySQL runtime 구성을 재도입하지 않는다.
- 공용 컴포넌트나 공용 service로 과도하게 승격하지 않는다.
- shell/layout 역할과 domain page 역할을 섞지 않는다.
