---
document_id: ACM-ADR-001
version: 1.0.0
status: ACCEPTED
authors:
  - 김태윤 팀장 (PO)
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: 8 architectural decisions for ACM v1.0a — locked-in choices.
---

# ACM-ADR-001 — Architecture Decision Records (아키텍처 결정 기록)

> Each ADR captures a single architectural decision: context → options → decision → consequences. Decisions marked **ACCEPTED** are binding for v1.0a.

---

## ADR-001 — Clean Architecture 4-Layer 채택

### Status
ACCEPTED · 2026-04-15

### Context
ACM 모듈은 5개 도메인 + AMB Core 의존 + 향후 v2.0 portal/teacher 확장. 단순 NestJS 컨트롤러+서비스 레이어로는 도메인 로직과 인프라(TypeORM, Redis, BullMQ) 간 결합이 강해진다.

### Options
1. **Transaction Script** (NestJS service에 모든 로직)
2. **Active Record + Service** (TypeORM entity에 비즈니스 메서드)
3. **Clean Architecture 4-layer** (presentation/application/domain/infrastructure)
4. **Hexagonal Ports & Adapters**

### Decision
**Option 3 — Clean Architecture 4-layer**.

```
presentation/   ← Controllers, Guards, Pipes (Nest)
application/    ← UseCases, DTOs, Event handlers
domain/         ← Entities (POJO), Repository interfaces, Domain services
infrastructure/ ← TypeORM repos, Redis, BullMQ, External adapters
```

### Consequences
- ✅ Domain은 NestJS/TypeORM에 의존하지 않음 → 단위 테스트 쉬움
- ✅ Cross-module DI ports로 결합도 낮춤
- ❌ 보일러플레이트 증가 (특히 단순 CRUD)
- ❌ 신규 개발자 온보딩 학습 곡선 → 코드 컨벤션 문서 필수

---

## ADR-002 — Cross-Module 통신: NestJS EventEmitter (인프로세스)

### Status
ACCEPTED · 2026-04-18

### Context
5개 모듈이 단일 NestJS 프로세스 내 동작. CSL 등록 → DSH 카운트, QNA 해결 → DSH 컴플레인 등 비동기 사이드 이펙트 다수. 향후 v2.0 분산 가능성 있음.

### Options
1. **직접 서비스 호출** (`csl.service.ts`에서 `dsh.service.ts.method()`)
2. **In-process EventEmitter** (`@nestjs/event-emitter`)
3. **메시지 큐** (RabbitMQ / BullMQ)
4. **Outbox pattern**

### Decision
**Option 2 — `@nestjs/event-emitter` 인프로세스 이벤트** + **DI Read Ports for synchronous queries**.

| 통신 유형 | 메커니즘 |
|---|---|
| 비동기 사이드 이펙트 | EventEmitter |
| 동기 read (e.g., SCH→school by id) | DI Read Port (`ISchSchoolService`) |
| 무거운 잡 (KPI 재집계, 마이그레이션) | BullMQ (Redis 기반) |

### Consequences
- ✅ FK 없이 모듈 간 결합도 최소
- ✅ v2.0 분산 시 EventEmitter → MQ 어댑터 교체 가능
- ❌ 트랜잭션 경계 외부 핸들러는 best-effort (실패 시 outbox 도입 필요할 수도)

---

## ADR-003 — 데이터베이스: PostgreSQL 15 단일 데이터베이스 공유 (with AMB Core)

### Status
ACCEPTED · 2026-04-15

### Context
AMB Core가 사용하는 `db_amb` PostgreSQL 인스턴스. ACM 자체 DB 분리 vs 공유 결정.

### Options
1. **ACM 전용 DB (`db_acm`)**
2. **공유 `db_amb` + 테이블 prefix `amb_acm_*`**
3. **공유 + 별도 schema**

### Decision
**Option 2 — `db_amb` 공유, prefix `amb_acm_*`**.

### Consequences
- ✅ AMB users 테이블에 직접 FK 가능 (학생 = `amb_users` row)
- ✅ 백업/마이그레이션 단일 파이프라인
- ❌ AMB Core 변경이 ACM에 영향 → 스키마 협의 워크플로우 필수
- ❌ 한 DB instance 부하 집중 → v2.0 read replica 고려

---

## ADR-004 — UUID v4 기본 키 + 외래키 명명: `{prefix}_id`

### Status
ACCEPTED · 2026-04-15

### Context
AMB Core PK가 UUID v4. 일관성 + 분산 ID 생성 + 보안(추측 방지) 고려.

### Decision
- 모든 PK: `UUID v4` (`uuid_generate_v4()` PostgreSQL extension)
- PK 컬럼명: `{table_short}_id` (예: `inq_id`, `qna_id`, `sbm_id`)
- FK 컬럼: 참조 테이블의 PK 명을 그대로 사용 (예: `qna_record_students.qrs_qna_id`)

### Consequences
- ✅ 분산 환경에서도 충돌 없음
- ✅ URL 노출 시 enum 추측 불가
- ❌ index 크기 증가 (BIGINT 대비 2배) → 적절한 인덱스 전략 필요
- ❌ 정렬 시 `created_at` 별도 사용 (UUID 자체로 시간 정렬 불가)

---

## ADR-005 — PII 암호화: AES-256-GCM 3-Field 패턴

### Status
ACCEPTED · 2026-04-20

### Context
학부모 전화번호/이메일/주소 등 PII 저장. AMB 표준 정책 = 컬럼 단위 암호화 with separate IV per row.

### Options
1. **DB-level TDE** (Transparent Data Encryption)
2. **컬럼 암호화 (단일 필드)** — IV 추출 가능 vs 보안 약함
3. **3-field 패턴**: `*_encrypted` (BYTEA) + `*_iv` (BYTEA(16)) + `*_auth_tag` (BYTEA(16))

### Decision
**Option 3 — AES-256-GCM with 3-field 패턴**.

```ts
// crypto helper (AMB Core 공유)
encrypt(plain: string): { encrypted: Buffer, iv: Buffer, authTag: Buffer }
decrypt(encrypted: Buffer, iv: Buffer, authTag: Buffer): string
```

키는 **AWS KMS** (또는 동등 KMS) 보관, envelope 암호화. 애플리케이션은 Data Encryption Key (DEK)을 캐시 (TTL 1h).

### Consequences
- ✅ row 단위 IV → rainbow table 무력화
- ✅ AuthTag → 변조 감지
- ❌ 검색 불가 → `*_search_hash` (deterministic, salted) 별도 컬럼 필요 시
- ❌ 인덱스 사용 불가 → 검색 빈도 높은 PII는 별도 hash 컬럼 운영

---

## ADR-006 — 버전 관리 정책: REF만 Per-Update Versioning

### Status
ACCEPTED · 2026-04-22 (resolves Q-003)

### Context
REF 벤치마크는 매년 갱신 → CSL 과거 상담 reproducibility 요구. 다른 모듈은 수정 빈도 낮음.

### Options
1. **모든 모듈 audit log only**
2. **모든 모듈 versioning** (과도)
3. **REF만 explicit version, 나머지 in-place + audit log**

### Decision
**Option 3**.

| 모듈 | 정책 |
|---|---|
| REF guidelines/level-tests/benchmarks | **per-update versioning** (`version_no`, `effective_from/to`, `supersedes_id`) |
| CSL/DSH/SCH/QNA | in-place + optimistic lock (`version` int) + audit log |

REF의 PATCH는 **historical reference 없을 때만** 허용; 그 외는 `POST /new-version` 강제.

### Consequences
- ✅ Q-003 해결 — CSL 과거 시점 lookup 정확성 보장
- ✅ 단순 모듈은 보일러플레이트 회피
- ❌ REF 마이그레이션 시 INHERITED_FROM 처리 추가 작업

---

## ADR-007 — 프론트엔드: React 18 + Vite + TanStack Query (Pinia/Vue3 폐기)

### Status
ACCEPTED · 2026-04-26 (revised from 2026-04-15 Vue3 결정)

### Context
초기 Vue3+Pinia로 결정했으나, AMB 전체 ecosystem이 React 기반 + 팀 React 경험 더 많음 + shadcn/ui 풍부 → 재검토.

### Decision
**React 18 + TypeScript 5 + Vite + TailwindCSS + shadcn/ui**.
- State (client): **Zustand 5**
- State (server): **TanStack Query 5**
- Form: **React Hook Form 7 + Zod 4**
- Routing: **React Router 6** (SPA — admin only, no SSR)
- i18n: **react-i18next 14**

### Consequences
- ✅ AMB 전체 일관성
- ✅ shadcn/ui 즉시 사용 (toast, command, dialog, etc.)
- ❌ 작업계획서 v1.0.0 → v1.0.1 재발행 필요 (완료)
- ❌ AMB Core React 컴포넌트 라이브러리 직접 import 가능 → 결합

---

## ADR-008 — 검색 인프라: PostgreSQL GIN + pg_bigm (Korean 토크나이즈)

### Status
ACCEPTED · 2026-04-24

### Context
QNA 본문 한국어 full-text search 필요. ElasticSearch 도입은 운영 부담 큼 (별도 클러스터).

### Options
1. **ElasticSearch 별도 클러스터**
2. **PG `tsvector` + `simple` config** — 한국어 토크나이즈 약함
3. **PG `tsvector` + `pg_bigm` extension** (bigram 기반 한국어)
4. **PG `pg_trgm`** (trigram, 외국어 fuzzy)

### Decision
- QNA 본문 검색: **Option 3 — `tsvector` + `pg_bigm`**
- SCH 학교명 autocomplete: **Option 4 — `pg_trgm`** (외국학교명 영문 fuzzy 매칭)

### Consequences
- ✅ 단일 PG instance에 통합 → 운영 단순
- ✅ 1k~10k records 규모에서 `< 400ms p95` 충분
- ❌ 100k+ scale 시 ES 전환 필요 가능 (v3.0 검토)
- ❌ `pg_bigm`은 RDS 추가 옵션 활성화 필요 (DBA 협의)

---

## ADR-009 — 마이그레이션 전략: BullMQ Worker + Review Queue

### Status
ACCEPTED · 2026-04-25

### Context
QNA 1500행 / REF 수백 행 xlsx 마이그레이션. 동기 처리 시 timeout / 메모리 이슈, 모호 행 사용자 검토 필요.

### Decision
- **BullMQ + Redis** 기반 비동기 잡
- 컨트롤러는 `202 Accepted {jobId}` 즉시 반환
- 잡 진행 상태 polling (`GET /migration/jobs/{jobId}`)
- 모호한 행은 `migration_review_queue` 테이블에 쌓고 `<*MigrationReview/>` 화면에서 admin 수동 결정

### Consequences
- ✅ 사용자 경험 개선 (브라우저 멈춤 없음)
- ✅ 부분 실패 시 retry 가능
- ❌ Redis 의존성 추가 → AMB 인프라에 이미 존재하므로 OK
- ❌ Job state 영속화 (`bullmq-jobs` 테이블 또는 Redis persistent)

---

## ADR Index

| ID | 결정 | Status |
|---|---|---|
| ADR-001 | Clean Architecture 4-layer | ACCEPTED |
| ADR-002 | EventEmitter + DI Read Ports + BullMQ | ACCEPTED |
| ADR-003 | PostgreSQL 공유 `db_amb` + prefix | ACCEPTED |
| ADR-004 | UUID v4 PK + `{prefix}_id` 명명 | ACCEPTED |
| ADR-005 | AES-256-GCM 3-field PII 암호화 | ACCEPTED |
| ADR-006 | REF만 per-update versioning | ACCEPTED |
| ADR-007 | React 18 + Vite + TanStack Query | ACCEPTED |
| ADR-008 | PG GIN + pg_bigm (QNA) + pg_trgm (SCH) | ACCEPTED |
| ADR-009 | BullMQ + Review Queue 마이그레이션 | ACCEPTED |

---

## Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Architect | TBD | — |
| Backend Lead | TBD | — |

_End of ACM-ADR-001 v1.0.0._
