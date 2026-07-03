---
doc_id: STD-APP-ACADEMY-SPEC
title: App Academy / Trinity Academy Development Specification
version: 1.0.0
updated: 2026-07-04
status: active
based_on:
  - docs/amoeba-starter-kit/amoeba_basic_SPEC_v2.md
  - docs/amoeba-starter-kit/amb-access-control-policy.md
  - docs/report/RPT-260703-app-academy-development-completion.md
---

# App Academy Development Specification

## 1. 개요

App Academy 저장소는 Trinity Academy 운영을 위한 ACM(Academy Management) 시스템이다. 현재 구현은 NestJS 백엔드, Vite React 프론트엔드, PostgreSQL ACM 스키마를 기준으로 한다.

운영 데이터베이스 표준은 PostgreSQL `db_acm` 단일 구조다. MySQL legacy runtime, schema, docker service, 배포 스크립트는 제거 대상이며 신규 표준에 포함하지 않는다.

## 2. 제품 범위

현재 개발된 주요 사용자 영역은 다음과 같다.

- 공개 포털: 홈, 소개, 프로그램, 뉴스
- 공개 웹 폼: 문의, 레벨테스트, BODA 화상 강의실 런처
- 관리자 콘솔: 대시보드, 상담, 수업, 학생, 학부모, 강사, 직원, 일정, 기출문제, 학교/참조 데이터, 게시글, 알림, 등록, Q&A, 연동 설정
- 학부모 포털: 자녀 현황, 결제, 성적, 시간표
- 시스템 관리: 앱 관리자, 테넌트 목록, 테넌트 상세
- 외부 연동: AMA SSO/설정/동기화, BODA 강의실, SMTP 메일, S3 파일, 알림/감사 로그 기반 이벤트

## 3. 기술 스택

| 영역 | 현재 표준 |
| --- | --- |
| Backend | NestJS 11, TypeScript, TypeORM 0.3, PostgreSQL |
| Frontend | Vite 6, React 18, TypeScript, React Router 6, TanStack Query 5, Zustand |
| UI | TailwindCSS, Radix UI, lucide-react, 자체 `components/ui` |
| Validation | class-validator/class-transformer, Zod, react-hook-form |
| Auth | JWT, role guard, route guard |
| Docs | Markdown under `docs/*` |
| CI/CD | GitHub Actions, Docker staging/production folders |

## 4. 런타임 기준

백엔드는 `backend/src/main.ts` 기준으로 다음 전역 정책을 적용한다.

- API prefix: `/api`
- 기본 포트: `4009`
- CORS 기본 origin: `http://localhost:3009`
- Security header: `helmet`
- ValidationPipe: `whitelist`, `forbidNonWhitelisted`, `transform`
- 공통 응답 변환: `TransformInterceptor`
- 공통 예외 처리: `GlobalExceptionFilter`
- 개발 환경 Swagger: `/api/docs`

프론트엔드는 `frontend-acm` Vite 앱으로 실행하며, 루트 스크립트는 `npm run dev`로 프론트와 백엔드를 동시에 실행한다.

## 5. 아키텍처

### 5.1 백엔드

백엔드는 PostgreSQL ACM 모듈 계층을 기준으로 한다.

- ACM 모듈 계층: `backend/src/modules/acm-*`, PostgreSQL `ACM_DS` 기반 신규 ACM 기능

신규 개발은 `backend/src/modules/acm-*`를 기준으로 한다. `backend/src/presentation`에는 health/filter/interceptor처럼 NestJS 공통 런타임에 필요한 최소 파일만 둔다.

### 5.2 프론트엔드

프론트엔드는 shell과 domain module 구조를 사용한다.

- `PortalLayout`: 공개 포털
- `AppShell`: 관리자 콘솔
- `ParentShell`: 학부모 포털
- `SystemShell`: 시스템 관리자
- `RequireAuth`: 인증 사용자 보호
- `RequireAppAdmin`: 시스템 관리자 보호

도메인 기능은 `frontend-acm/src/modules/{domain}` 아래에 둔다.

### 5.3 데이터

데이터 표준은 PostgreSQL `db_acm`이다.

- PostgreSQL named datasource: `ACM_DS`
- PostgreSQL env prefix: `ACM_PG_*`
- PostgreSQL schema/migration: `sql/acm/*.sql`

## 6. 구현된 ACM 모듈

현재 `backend/src/modules/acm.module.ts`에 등록된 ACM 모듈은 다음과 같다.

| 모듈 | 역할 |
| --- | --- |
| `acm-common` | datasource, guard, decorator, crypto, event type |
| `acm-auth` | ACM 인증, 사용자/역할, 비밀번호 회전 |
| `acm-sch` | 학교/캠퍼스 기준 데이터 |
| `acm-ref` | 참조 코드/메타 데이터 |
| `acm-csl` | 상담, 문의, 레벨테스트, 파이프라인 |
| `acm-qna` | Q&A, 카테고리 |
| `acm-dsh` | 대시보드 |
| `acm-cls` | 수업/반 |
| `acm-std` | 학생, 학부모, 관계, import |
| `acm-tch` | 강사 |
| `acm-stf` | 직원 |
| `acm-cal` | 일정, 초대자, BODA 이벤트 |
| `acm-map` | 기출문제/문항 |
| `acm-system` | 시스템 관리자, 테넌트 관리 |

`acm-pay`, `acm-posts`, `acm-notification`, `acm-audit`는 스키마와 일부 구현이 존재하므로 기능 활성화 여부를 확인한 뒤 확장한다.

## 7. 프론트 라우트

라우트 표준은 `frontend-acm/src/routes/router.tsx`를 따른다.

| 영역 | 경로 |
| --- | --- |
| 관리자 로그인 | `/admin/login` |
| 학부모 로그인 | `/parent/login` |
| 비밀번호 변경 | `/admin/change-password` |
| 공개 웹 폼 | `/web/contact`, `/web/test`, `/web/classroom/:evtId` |
| 공개 포털 | `/`, `/about`, `/programs`, `/programs/:id`, `/news`, `/news/:slug` |
| 학부모 포털 | `/my`, `/my/payments`, `/my/scores`, `/my/timetable` |
| 관리자 콘솔 | `/admin/*` |
| 시스템 관리 | `/system/*` |

legacy login URL `/login`, `/login/parent`는 하위 호환 리다이렉트로 유지한다.

## 8. 인증과 접근 제어

접근 제어는 starter-kit의 owner-first 원칙을 이 프로젝트에 맞춰 적용한다.

- 일반 관리자는 자기 테넌트 `ent_id` 데이터만 접근한다.
- 학부모는 연결된 학생/결제/성적/시간표 정보만 접근한다.
- `APP_ADMIN`은 시스템 관리 영역에서 교차 테넌트 작업을 수행할 수 있다.
- AI/자동화/동기화 작업도 호출 주체의 권한 범위 안에서만 동작해야 한다.
- 개인정보는 필요 최소 범위로 조회하고 로그에 노출하지 않는다.

백엔드에서는 `RolesGuard`, `OwnEntityGuard`, `CurrentUser`, `RequirePasswordRotationGuard` 등 기존 ACM 공통 요소를 우선 사용한다.

## 9. 데이터베이스 표준

PostgreSQL ACM 스키마 작성 원칙은 다음과 같다.

- 테이블명: `amb_acm_{domain}_{name}`
- 컬럼명: snake_case
- 테넌트 컬럼: `ent_id`
- 시간 컬럼: `created_at`, `updated_at`, 필요 시 `deleted_at`
- 마이그레이션: `sql/acm/{number}-{description}.sql`
- 운영 스키마 변경: SQL 파일과 배포 절차로만 수행
- TypeORM `synchronize`: 항상 `false`

MySQL legacy 제거 원칙은 다음과 같다.

- 신규 테이블은 PostgreSQL에만 만든다.
- MySQL datasource, driver, docker service, root SQL schema/seed, migration helper는 사용하지 않는다.
- 과거 migration 설명을 제외하고 runtime 코드에서 MySQL 테이블명을 참조하지 않는다.
- legacy route, service, repository, env, script는 재도입하지 않는다.

## 10. 외부 연동

현재 고려해야 할 외부 연동은 다음과 같다.

- AMA: SSO, 설정, 사용자/학생 동기화, custom app/category 설정
- BODA: 일정 기반 화상 강의실 런처와 vendor 설정
- SMTP: 초대/알림 메일
- S3: 파일 업로드 또는 presigned URL
- 결제/구독: PostgreSQL pay/subscription 스키마 기준으로 확장
- 알림/감사: 이벤트 기반 notification/audit 스키마 기준으로 확장

외부 연동은 tenant config와 secret 분리를 전제로 한다.

## 11. 비기능 요구사항

- 보안: JWT, role guard, tenant isolation, helmet, validation whitelist
- 개인정보: 암호화, 최소 조회, 로그 마스킹
- 감사성: 주요 상태 변경은 audit/event로 추적
- 운영성: health endpoint, Swagger dev 문서, SQL 기반 배포
- 성능: 목록 API는 pagination/filter/sort를 기본 제공
- 안정성: DB 마이그레이션은 재실행 위험을 고려해 작성
- 접근성: 웹 UI는 키보드 접근, focus ring, 명확한 label을 유지

## 12. 개발 완료 기준

기능은 다음 조건을 만족할 때 완료로 본다.

- 백엔드 API, 프론트 화면, DB 스키마가 같은 도메인 모델로 정렬되어 있다.
- 신규 데이터는 PostgreSQL ACM 기준으로 저장된다.
- MySQL 의존이 추가되지 않았다.
- 권한과 `ent_id` 격리가 검증되었다.
- build/type-check/test 중 가능한 검증을 수행했다.
- 문서 또는 보고서에 구현 범위와 남은 이슈가 기록되어 있다.

## 13. 참조 문서

- `docs/standard/SKILL.md`
- `docs/standard/STRUCTURE.md`
- `docs/standard/CODE_CONVENTION.md`
- `docs/standard/STYLE_GUIDE.md`
- `docs/amoeba-starter-kit/amoeba_basic_SPEC_v2.md`
- `docs/amoeba-starter-kit/amb-access-control-policy.md`
- `docs/report/RPT-260703-app-academy-development-completion.md`
