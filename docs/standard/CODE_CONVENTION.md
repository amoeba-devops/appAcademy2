---
doc_id: STD-APP-ACADEMY-CODE-CONVENTION
title: App Academy Code Convention
version: 1.0.0
updated: 2026-07-04
status: active
based_on:
  - docs/amoeba-starter-kit/amoeba_code_convention_v2.md
  - docs/amoeba-starter-kit/amb-access-control-policy.md
---

# App Academy Code Convention

## 1. 공통 원칙

- TypeScript를 기본 언어로 사용한다.
- 신규 기능은 명시적 타입, 명시적 권한, 명시적 데이터 소유권을 갖는다.
- 현재 구현 패턴을 우선 따르고, 대규모 구조 변경은 별도 설계 문서 없이 수행하지 않는다.
- 신규 데이터 저장은 PostgreSQL `db_acm`을 기준으로 한다.
- MySQL runtime, driver, schema, table 의존성은 신규 기능의 의존성으로 추가하지 않는다.
- tenant-scoped 데이터는 항상 `ent_id` 기준 접근 제어를 고려한다.

## 2. Backend Convention

### 2.1 모듈

- 신규 ACM 기능은 `backend/src/modules/acm-{domain}`에 둔다.
- controller, service, DTO, entity 책임을 분리한다.
- 여러 도메인에서 공유되는 기능만 `acm-common`에 둔다.
- `acm.module.ts`에는 활성화할 ACM 모듈만 등록한다.

### 2.2 Controller

- 경로, 인증, 권한, DTO validation, HTTP status에 집중한다.
- 비즈니스 규칙은 service로 넘긴다.
- 요청 body/query/param은 DTO로 받는다.
- tenant context와 current user는 기존 decorator/guard 패턴을 사용한다.
- 응답은 프론트가 바로 사용할 수 있는 명확한 DTO shape로 반환한다.

### 2.3 Service

- 유스케이스 단위 메서드를 제공한다.
- DB transaction이 필요한 작업은 service에서 경계를 잡는다.
- 외부 API 호출은 adapter/client service로 분리한다.
- 이벤트 발행은 상태 변경 성공 후 수행한다.
- 예외는 NestJS 표준 exception을 우선 사용한다.

### 2.4 DTO

- DTO는 `class-validator` decorator로 입력 제약을 표현한다.
- query DTO는 pagination, filter, sort 기본값을 명확히 둔다.
- 불필요한 field는 `ValidationPipe`의 whitelist 정책에 의해 제거되어야 한다.
- API 계약 변경 시 프론트 `types.ts`와 hook도 함께 맞춘다.

### 2.5 Entity

- PostgreSQL entity는 `*.typeorm-entity.ts`로 작성한다.
- `@Entity({ name: 'amb_acm_...' })`처럼 실제 테이블명을 명시한다.
- 신규 ACM repository 주입은 `ACM_DS` named datasource를 사용한다.
- entity에는 DB 매핑과 최소한의 변환만 둔다.
- 복잡한 비즈니스 규칙은 service 또는 domain helper로 분리한다.

### 2.6 Datasource

PostgreSQL ACM repository 예시는 다음 패턴을 따른다.

```ts
@InjectRepository(StudentEntity, ACM_DS)
private readonly students: Repository<StudentEntity>
```

raw SQL이나 transaction이 필요한 경우에도 `ACM_DS` datasource를 사용한다. 신규 코드에서 다른 DB datasource를 주입하지 않는다.

### 2.7 Auth and Access

- 관리자 기능은 역할 기반 guard를 적용한다.
- 학부모 기능은 연결된 학생/가족 데이터만 접근 가능해야 한다.
- 시스템 관리 기능은 `APP_ADMIN` 기준으로 분리한다.
- tenant data query에는 `ent_id` 조건이 빠지지 않아야 한다.
- AI, batch, sync 작업도 동일한 접근 제어 정책을 따른다.

### 2.8 Error and Response

- validation error는 전역 `ValidationPipe` 정책을 따른다.
- unknown error를 그대로 노출하지 않는다.
- 개인정보, token, secret은 로그에 남기지 않는다.
- 목록 API는 total/page/limit 또는 cursor 정보를 명확히 제공한다.

## 3. Frontend Convention

### 3.1 모듈

- 도메인 코드는 `frontend-acm/src/modules/{domain}`에 둔다.
- 페이지는 `pages`, 화면 조각은 `components`, API state는 `hooks`, 타입은 `types.ts`를 사용한다.
- 전역 재사용 UI만 `components/ui`에 둔다.
- shell 관련 컴포넌트는 `components/layout`에 둔다.

### 3.2 Components

- React component는 PascalCase로 작성한다.
- 파일명은 kebab-case를 사용한다.
- props type은 component 가까이에 둔다.
- 한 컴포넌트가 목록 조회, 편집 modal, table, filter를 모두 담당하지 않도록 분리한다.
- 버튼, input, dialog, confirm dialog는 기존 `components/ui`를 우선 사용한다.

### 3.3 Hooks and API

- 서버 상태는 TanStack Query hook으로 관리한다.
- hook 이름은 `use-{resource}` 또는 `use-{action}-{resource}` 형식을 사용한다.
- query key는 도메인과 filter를 포함해 충돌을 피한다.
- mutation 성공 후 관련 query invalidate를 명시한다.
- axios client, auth header, error mapping은 기존 `lib` 패턴을 따른다.

### 3.4 Routing

- 모든 라우트는 `frontend-acm/src/routes/router.tsx`에서 관리한다.
- 관리자 화면은 `/admin`, 학부모 화면은 `/my`, 시스템 관리는 `/system`, 공개 포털은 `/` 하위에 둔다.
- legacy path는 필요한 경우 명시적 redirect로 유지한다.
- shell이 다른 영역 간 컴포넌트 의존을 만들지 않는다.

### 3.5 i18n

- 사용자에게 보이는 문구는 locale 파일에 둔다.
- 한국어, 영어, 베트남어, 중국어 locale이 있는 도메인은 함께 갱신한다.
- 코드 식별자와 외부 상품명은 번역하지 않는다.

## 4. Database Convention

### 4.1 PostgreSQL Naming

| 항목 | 규칙 |
| --- | --- |
| database | `db_acm` |
| table | `amb_acm_{domain}_{name}` |
| column | `snake_case` |
| tenant | `ent_id` |
| created timestamp | `created_at` |
| updated timestamp | `updated_at` |
| soft delete | `deleted_at` |
| index | `idx_{table}_{columns}` |
| unique | `uq_{table}_{columns}` |
| foreign key | `fk_{table}_{ref_table}` |

### 4.2 Migration

- `sql/acm`에 순번 SQL 파일을 추가한다.
- 이미 배포된 migration은 수정하지 않고 새 migration으로 보정한다.
- `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 등 재실행 안전성을 고려한다.
- seed는 idempotent하게 작성한다.
- 운영 배포 전 rollback 또는 보정 전략을 문서화한다.

### 4.3 Legacy Removal

- MySQL 참조가 발견되면 controller/service/repository/API/screen 단위로 제거한다.
- 필요한 데이터 모델은 PostgreSQL `amb_acm_*` 테이블로 정의한다.
- API를 PostgreSQL 기준으로 전환한다.
- 프론트 hook과 화면을 검증한다.
- MySQL driver, env, docker service, SQL seed/script를 재도입하지 않는다.

## 5. Testing Convention

- 백엔드 unit test는 `*.spec.ts`를 사용한다.
- DB 연동이 필요한 테스트는 `npm run test:int` 기준을 확인한다.
- 프론트는 현재 type-check/build를 우선 검증한다.
- 권한, tenant isolation, 개인정보 조회 조건은 테스트 우선순위가 높다.
- migration은 로컬 PostgreSQL 적용 여부를 확인한다.

## 6. Security Convention

- token, password, API key, PII를 로그에 남기지 않는다.
- secret은 env로 주입한다.
- CORS origin은 환경별로 명시한다.
- `ACM_PII_KEY`가 필요한 암호화 기능은 key 길이와 환경 설정을 검증한다.
- 외부 webhook은 signature 또는 shared secret 검증을 고려한다.

## 7. Documentation Convention

- 표준 문서는 `docs/standard`에 둔다.
- 요구사항 분석은 `docs/analysis/REQ-{yymmdd}-{topic}.md` 형식을 사용한다.
- 완료보고서는 `docs/report/RPT-{yymmdd}-{topic}.md` 형식을 사용한다.
- 문서에는 현재 상태와 목표 상태를 분리해 적는다.
- MySQL 의존이 발견되면 “제거 대상 결함”으로 명시한다.

## 8. Commit and Change Safety

- 사용자 변경이 있는 파일은 임의로 되돌리지 않는다.
- 무관한 formatting churn을 만들지 않는다.
- 기능 변경과 문서 변경은 가능하면 목적별로 분리한다.
- destructive git command는 명시적 요청 없이 사용하지 않는다.
