---
document_id: ACADEMY-WORKPLAN-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-20
updated: 2026-04-20
author: AI Assistant
reviewers: [김익용]
parent_docs:
  - ACADEMY-DEVPLAN-1.3.0 (개발계획서)
  - ACADEMY-FUNCSPEC-1.3.0 (기능명세서)
change_log:
  - version: 1.3.0
    date: 2026-04-20
    author: AI Assistant
    description: |
      개발계획서·기능명세서와 현재 코드베이스 상태를 비교 분석하여
      Phase 0 ~ Phase 5 의 실제 구현 작업 단위(Task)를 정의한 작업계획서.
---

# Trinity Academy — Implementation Work Plan (실제 작업계획서)

## 1. Overview (개요)

### 1.1 Purpose (목적)

개발계획서(`ACADEMY-DEVPLAN-1.3.0`)가 "무엇을, 어떤 순서로" 할지를 정의했다면, 본 작업계획서는 **"지금 코드가 어디까지 와 있고, 다음에 무엇을 만들어야 하는가"** 를 실무 Task 단위로 기술한다.

### 1.2 Current State Summary (현재 상태 요약)

| Area | Status | Detail |
|------|--------|--------|
| **Backend scaffold** | ✅ 완료 | NestJS 11 + TypeORM + MySQL + Swagger. Clean Architecture 디렉터리 생성. `HealthController` 1개만 존재. |
| **Frontend scaffold** | ✅ 완료 | Next.js 14 App Router, `(portal)/(admin)` 라우트 그룹, Tailwind brand tokens, API proxy 설정. |
| **Portal pages** | 🟡 일부 | Home(hero/pillar/process/campus/results), Contact(form), MAP Test(info) 3개 완성. About/Programs/News 미구현. |
| **Portal components** | 🟡 일부 | 14개 컴포넌트(PortalHeader/Footer, HeroSection, ConsultationForm 등). shadcn/ui 미설치. |
| **Admin pages** | 🟡 스캐폴드만 | AdminLayout + Dashboard placeholder. 비즈니스 페이지 0개. |
| **Backend entities** | ❌ 없음 | `BaseEntity` 1개만. 도메인·TypeORM 엔티티 0개. |
| **Backend services** | ❌ 없음 | UseCase, Service, Repository implementation 전부 0개. |
| **Auth/Guard** | ❌ 없음 | JWT, AcademyGuard, RBAC 미구현. |
| **DB migration** | ❌ 미적용 | `academy-management-schema.sql` 존재, Docker MySQL 기동 확인, 테이블 미생성. |
| **Infrastructure** | 🟡 일부 | Docker Compose(MySQL만), `.env` 기본값. Redis/RabbitMQ/S3 미구성. |
| **CI/CD** | ❌ 없음 | GitHub Actions 미설정. |

### 1.3 Gap Analysis (갭 분석)

개발계획서 Phase 0 요구사항 vs 현재 상태:

| Phase 0 Exit Criteria | Current | Gap |
|------------------------|---------|-----|
| 모노레포 스캐폴딩 | ✅ | — |
| Clean Architecture 디렉터리 | ✅ | Boundaries ESLint 규칙 미적용 |
| DB 스키마 → TypeORM migration | ❌ | SQL 존재, 엔티티 미생성, 마이그레이션 미적용 |
| 공통 토큰 (heraldic-tokens.css) | 🟡 | Tailwind config에 색상 정의됨, CSS 변수 파일 미연결 |
| 인증 (NextAuth + JwtGuard + AcademyGuard) | ❌ | 전무 |
| 감사로그 (tac_audit_logs + Interceptor) | ❌ | 스키마에도 audit_logs 테이블 미정의 |
| CI 파이프라인 | ❌ | GitHub Actions 없음 |
| Hello API + 로그인 동작 | 🟡 | Health API ✅, 로그인 ❌ |
| PortalLayout / AdminLayout 렌더링 | 🟡 | 기본 형태 존재, AdminSidebar/Header 미완 |

---

## 2. Phase 0 — Foundation (기반 구축)

> **Dev Plan 기간**: W1–W2 (2주)
> **Exit**: Dev 환경에서 `/api/health` + 로그인 동작, PortalLayout/AdminLayout 렌더링, CI green.

### Task 0-1: DB 스키마 적용 및 TypeORM 엔티티 생성

**목표**: `academy-management-schema.sql`의 33개 테이블을 MySQL에 적용하고, TypeORM Entity 클래스를 생성한다.

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-1-A | Docker MySQL에 스키마 SQL 실행 (docker exec) | `sql/academy-management-schema.sql` |
| 0-1-B | TypeORM Entity 생성 — Core (6개) | `backend/src/infrastructure/database/entities/` |
| | - `academy.entity.ts` (acd) | |
| | - `program.entity.ts` (prg) | |
| | - `program-setting.entity.ts` (pgs) | |
| | - `classroom.entity.ts` (clr) | |
| | - `teacher.entity.ts` (tch) | |
| | - `parent.entity.ts` (prt) | |
| 0-1-C | TypeORM Entity 생성 — Student/Consultation (6개) | |
| | - `student.entity.ts` (std) | |
| | - `student-guardian.entity.ts` (sgd) | |
| | - `consultation.entity.ts` (cst) | |
| | - `visit-record.entity.ts` (vsr) | |
| | - `enrollment.entity.ts` (enr) | |
| | - `attendance.entity.ts` (att) | |
| 0-1-D | TypeORM Entity 생성 — Class/Session (2개) | |
| | - `class.entity.ts` (cls) | |
| | - `class-session.entity.ts` (csn) | |
| 0-1-E | TypeORM Entity 생성 — MAP domain (8개) | |
| | - `map-passage.entity.ts` (psg) | |
| | - `map-passage-asset.entity.ts` (pas) | |
| | - `map-item.entity.ts` (itm) | |
| | - `map-item-tag.entity.ts` (itg) | |
| | - `map-test-set.entity.ts` (tst) | |
| | - `map-test-set-item.entity.ts` (tsi) | |
| | - `map-assignment.entity.ts` (asn) | |
| | - `map-response.entity.ts` (rsp) | |
| | - `map-score.entity.ts` (msc) | |
| 0-1-F | TypeORM Entity 생성 — Pay domain (6개) | |
| | - `pay-refund-policy.entity.ts` (rfp) | |
| | - `pay-refund-policy-tier.entity.ts` (rpt) | |
| | - `pay-order.entity.ts` (pod) | |
| | - `pay-ledger.entity.ts` (ldg) | |
| | - `pay-receipt.entity.ts` (rct) | |
| | - `pay-tax-invoice.entity.ts` (txi) | |
| 0-1-G | TypeORM Entity 생성 — Portal/Extension (5개) | |
| | - `external-test-score.entity.ts` (ets) | |
| | - `counseling-record.entity.ts` (cnr) | |
| | - `consultation-intake-form.entity.ts` (cif) | |
| | - `post.entity.ts` (pst) | |
| | - `audit-log.entity.ts` (adl) ← 신규 | |
| 0-1-H | `app.module.ts`에 TypeORM entities 등록, DB 연결 확인 | `backend/src/app.module.ts` |

**Entity 작성 규칙** (Amoeba v2 §5.5 준수):
```
- @Entity('tac_테이블명')
- @PrimaryGeneratedColumn('increment', { name: 'xxx_id', type: 'bigint', unsigned: true })
- @Column({ name: 'xxx_field', ... }) — nullable 컬럼은 type 명시 필수
- @CreateDateColumn({ name: 'xxx_created_at' })
- @UpdateDateColumn({ name: 'xxx_updated_at' })
- @DeleteDateColumn({ name: 'xxx_deleted_at' }) — 해당되는 경우만
- Property 명: camelCase (xxxField)
```

**화면 구성안**: 해당 없음 (백엔드 전용)

---

### Task 0-2: tac_audit_logs 테이블 추가

**목표**: 감사로그 테이블을 스키마에 추가하고 Entity를 생성한다.

**작업 상세**:
```sql
-- 감사로그 (colPrefix: adl)
CREATE TABLE tac_audit_logs (
    adl_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id           BIGINT UNSIGNED NOT NULL,
    adl_user_id      BIGINT UNSIGNED          DEFAULT NULL,
    adl_action       VARCHAR(50)     NOT NULL COMMENT 'CREATE/READ/UPDATE/DELETE/DECRYPT',
    adl_entity_type  VARCHAR(50)     NOT NULL COMMENT 'STUDENT/PARENT/PAYMENT/...',
    adl_entity_id    BIGINT UNSIGNED NOT NULL,
    adl_field_name   VARCHAR(100)             DEFAULT NULL COMMENT '열람 필드명 (PII 추적)',
    adl_old_value    TEXT                     DEFAULT NULL,
    adl_new_value    TEXT                     DEFAULT NULL,
    adl_ip           VARCHAR(45)              DEFAULT NULL,
    adl_user_agent   VARCHAR(500)             DEFAULT NULL,
    adl_reason       VARCHAR(200)             DEFAULT NULL COMMENT '열람 사유 (FN-039)',
    adl_created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (adl_id),
    KEY idx_tac_audit_logs_acd_entity (acd_id, adl_entity_type, adl_entity_id),
    KEY idx_tac_audit_logs_user (adl_user_id, adl_created_at),
    CONSTRAINT fk_tac_audit_logs_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

| File | Action |
|------|--------|
| `sql/academy-management-schema.sql` | 테이블 DDL 추가 |
| `backend/src/infrastructure/database/entities/audit-log.entity.ts` | Entity 생성 |

---

### Task 0-3: 인증 시스템 구축

**목표**: Admin SSR 인증(이메일+비밀번호) + API JWT Guard + AcademyGuard를 구현한다. (Portal 학부모 인증은 Phase 5)

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-3-A | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` 설치 | `backend/package.json` |
| 0-3-B | `tac_users` 테이블 스키마 추가 (admin 사용자) | `sql/academy-management-schema.sql` |
| 0-3-C | `user.entity.ts` 생성 | `backend/src/infrastructure/database/entities/` |
| 0-3-D | `AuthModule` — login(email+pw) → JWT 발급 | `backend/src/presentation/auth/` |
| 0-3-E | `JwtGuard` — Bearer token 검증 | `backend/src/presentation/guards/jwt.guard.ts` |
| 0-3-F | `AcademyGuard` — JWT의 `acd_id`를 request에 주입, TypeORM 조건 자동 바인딩 | `backend/src/presentation/guards/academy.guard.ts` |
| 0-3-G | `@CurrentUser()` 데코레이터 | `backend/src/common/decorators/current-user.decorator.ts` |
| 0-3-H | Frontend: `next-auth` 설치 + Credentials Provider(Admin 로그인) | `frontend/src/app/api/auth/[...nextauth]/route.ts` |
| 0-3-I | Admin 로그인 페이지 | `frontend/src/app/(admin)/login/page.tsx` |
| 0-3-J | Admin auth middleware (미인증 시 /login 리다이렉트) | `frontend/src/middleware.ts` |

**tac_users 스키마** (신규, colPrefix: usr):
```sql
CREATE TABLE tac_users (
    usr_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    acd_id           BIGINT UNSIGNED NOT NULL,
    usr_email        VARCHAR(200)    NOT NULL,
    usr_password     VARCHAR(200)    NOT NULL COMMENT 'bcrypt hash',
    usr_name         VARCHAR(100)    NOT NULL,
    usr_role         VARCHAR(20)     NOT NULL DEFAULT 'STAFF'
        COMMENT 'MASTER/ADMIN/TEACHER/ACCOUNTANT/STAFF',
    usr_status       VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE',
    usr_last_login_at DATETIME                DEFAULT NULL,
    usr_created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usr_updated_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (usr_id),
    UNIQUE KEY uq_tac_users_email (usr_email),
    KEY idx_tac_users_acd_role (acd_id, usr_role),
    CONSTRAINT fk_tac_users_academy FOREIGN KEY (acd_id) REFERENCES tac_academies(acd_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**화면 구성안 — Admin Login (SCR-A-LOGIN)**:
```
┌─────────────────────────────────────────────────────────────┐
│                      Trinity Academy                         │
│                     ┌─ 방패 문장 ─┐                          │
│                     │   Crest    │                           │
│                     └───────────┘                            │
│                   OMNIBUS OMNIA                              │
│                                                              │
│              ┌─────────────────────────┐                     │
│              │  이메일                   │                    │
│              ├─────────────────────────┤                     │
│              │  비밀번호                 │                    │
│              ├─────────────────────────┤                     │
│              │      [ 로그인 ]          │                    │
│              └─────────────────────────┘                     │
│                                                              │
│              Navy #0E1E3A 배경, Gold 버튼                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Task 0-4: Admin Layout 완성 (Sidebar + Header)

**목표**: Admin 콘솔의 좌측 사이드바 + 상단 헤더를 기능명세서 디자인에 맞게 구현한다.

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-4-A | shadcn/ui 초기화 + 기본 컴포넌트 설치 (Button, Input, Card, Badge, Dialog, Dropdown, Table, Tabs, Sheet, Select, Separator, Avatar, Tooltip) | `frontend/src/components/ui/` |
| 0-4-B | `AdminSidebar` — 방패 아이콘 + 네비게이션 메뉴 | `frontend/src/components/admin/admin-sidebar.tsx` |
| 0-4-C | `AdminHeader` — 검색바 + 알림벨 + 사용자 메뉴 | `frontend/src/components/admin/admin-header.tsx` |
| 0-4-D | `AdminLayout` 갱신 — Sidebar + Header 조합 | `frontend/src/app/(admin)/layout.tsx` |
| 0-4-E | `heraldic-tokens.css` CSS 변수 파일 → globals.css 연동 | `frontend/src/app/globals.css` |

**화면 구성안 — AdminLayout (기능명세서 기준)**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────────────────────────┐ │
│ │ SIDEBAR  │ │  HEADER                                             │ │
│ │          │ │  [ 🔍 검색 ]           [ 🔔 ] [ 👤 원장님 ▼ ]      │ │
│ │ ⛨ TAC   │ ├─────────────────────────────────────────────────────┤ │
│ │          │ │                                                     │ │
│ │ 📊 대시보드│ │                    CONTENT AREA                     │ │
│ │ 💬 상담   │ │                                                     │ │
│ │ 👨‍🎓 학생  │ │                                                     │ │
│ │ 👩‍🏫 교사  │ │                                                     │ │
│ │ 📚 프로그램│ │                                                     │ │
│ │ 📅 시간표 │ │                                                     │ │
│ │ 🗺 MAP   │ │                                                     │ │
│ │ 💳 결제   │ │                                                     │ │
│ │ ⚙ 설정   │ │                                                     │ │
│ │          │ │                                                     │ │
│ └──────────┘ └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
  Sidebar: 240px, Navy bg, Gold 아이콘. 접힘 가능(아이콘 only 64px).
  Header: 64px, White bg, border-bottom.
```

---

### Task 0-5: 공통 모듈 및 인프라 설정

**목표**: Domain Repository 인터페이스, 공통 Response 포맷, 에러 필터, API 인터셉터를 설정한다.

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-5-A | 공통 API 응답 인터페이스 정의 | `backend/src/common/interfaces/api-response.interface.ts` (기존 파일 확장) |
| 0-5-B | `HttpExceptionFilter` — 전역 에러 응답 포맷 통일 | `backend/src/presentation/filters/http-exception.filter.ts` |
| 0-5-C | `TransformInterceptor` — 성공 응답 래핑 `{ data, meta }` | `backend/src/presentation/interceptors/transform.interceptor.ts` |
| 0-5-D | `AuditLogInterceptor` — 민감 엔티티 접근 자동 로깅 | `backend/src/presentation/interceptors/audit-log.interceptor.ts` |
| 0-5-E | `AcademyIdPipe` — 라우트 파라미터 검증 | `backend/src/presentation/pipes/academy-id.pipe.ts` |
| 0-5-F | Frontend API 클라이언트 래퍼 (fetch + error handling + auth token) | `frontend/src/lib/api-client.ts` |
| 0-5-G | React Query Provider + Zustand 기본 스토어 설정 | `frontend/src/app/providers.tsx`, `frontend/src/stores/auth.store.ts` |

---

### Task 0-6: CI/CD 파이프라인 구축

**목표**: GitHub Actions로 lint/typecheck/test/build 파이프라인을 구축한다.

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-6-A | GitHub Actions workflow — PR 검증 | `.github/workflows/ci.yml` |
| 0-6-B | Backend lint + typecheck + unit test | — |
| 0-6-C | Frontend lint + typecheck + build | — |
| 0-6-D | `eslint-plugin-boundaries` 설치 및 규칙 설정 | `backend/eslint.config.mjs` |

---

### Task 0-7: Seed 데이터 스크립트

**목표**: 개발 환경용 기본 데이터(Academy, User, 환불정책 v1)를 삽입하는 seed 스크립트를 작성한다.

**작업 상세**:

| Sub-task | Description | Files |
|----------|-------------|-------|
| 0-7-A | seed SQL: 기본 Academy 1건 + Admin User 1건 | `sql/seed-dev.sql` |
| 0-7-B | seed SQL: 환불정책 v1 (학원법 §18) + 3-tier | `sql/seed-dev.sql` |
| 0-7-C | `npm run seed` script 추가 | Root `package.json` |

---

## 3. Phase 1 — People & Consultation (W3–W6)

> **Exit**: 상담 1건 end-to-end 완료, 학생 등록까지 가능.

### Task 1-1: Teacher Module (AMA Client Mirror)

**기능 ID**: FN-040 ~ FN-045 | **화면 ID**: SCR-A-T-01, SCR-A-T-02

| Sub-task | Description | Layer |
|----------|-------------|-------|
| 1-1-A | Domain Entity: `Teacher` (순수 비즈니스) | `domain/entities/teacher.ts` |
| 1-1-B | Domain Repository Interface: `ITeacherRepository` | `domain/repositories/` |
| 1-1-C | Application DTO: `TeacherResponse`, `UpdateTeacherMappingRequest` | `application/dto/teacher/` |
| 1-1-D | Application UseCase: `GetTeachers`, `GetTeacherDetail`, `UpdateTeacherMapping`, `SyncTeachers` | `application/use-cases/teacher/` |
| 1-1-E | Infrastructure: TypeORM Repository 구현 | `infrastructure/database/repositories/teacher.repository.ts` |
| 1-1-F | Infrastructure: AMA Client Sync Service (read-only, 15분 cron) | `infrastructure/external/ama/teacher-sync.service.ts` |
| 1-1-G | Presentation: `TeacherController` (CRUD + sync trigger) | `presentation/controllers/teacher.controller.ts` |
| 1-1-H | Frontend: 교사 목록 페이지 (카드/테이블 뷰) | `frontend/src/app/(admin)/teachers/page.tsx` |
| 1-1-I | Frontend: 교사 상세 페이지 | `frontend/src/app/(admin)/teachers/[id]/page.tsx` |

**화면 구성안 — SCR-A-T-01 교사 목록**:
```
┌──────────────────────────────────────────────────────────────────┐
│ AdminLayout                                                      │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │  교사 관리                              [ AMA 동기화 🔄 ]   │   │
│ ├────────────────────────────────────────────────────────────┤   │
│ │ 필터: [상태 ▼] [과목 ▼]                    [ 🔍 검색 ]     │   │
│ ├────────────────────────────────────────────────────────────┤   │
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│ │ │ 김영수   │ │ 이미영   │ │ 박지현   │ │ 최동원   │          │   │
│ │ │ RC/Vocab│ │ Math    │ │ RC Adv  │ │ MAP     │          │   │
│ │ │ 반3개   │ │ 반2개   │ │ 반4개   │ │ 반1개   │          │   │
│ │ │ 주12h   │ │ 주8h   │ │ 주16h  │ │ 주4h   │          │   │
│ │ │ ● 정상   │ │ ● 정상  │ │ ● 정상  │ │ ⚠ 지연  │          │   │
│ │ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
  카드: Navy 테두리, Gold 과목 배지. 동기화 상태: ● 정상(초록), ⚠ 지연(노랑), ✕ 실패(빨강)
```

---

### Task 1-2: Student / Parent Module

**기능 ID**: FN-030 ~ FN-039 | **화면 ID**: SCR-A-S-01 ~ SCR-A-S-04

| Sub-task | Description | Layer |
|----------|-------------|-------|
| 1-2-A | Domain: `Student`, `Parent`, `StudentGuardian` (순수 엔티티) | `domain/entities/` |
| 1-2-B | Domain: `IStudentRepository`, `IParentRepository` | `domain/repositories/` |
| 1-2-C | Application DTO: CRUD Request/Response | `application/dto/student/`, `application/dto/parent/` |
| 1-2-D | Application UseCase: `CreateStudent`, `GetStudents`, `GetStudentDetail`, `UpdateStudent` | `application/use-cases/student/` |
| 1-2-E | Application UseCase: `CreateParent`, `GetParents`, `LinkGuardian` | `application/use-cases/parent/` |
| 1-2-F | Infrastructure: Repository 구현 (암호화 필드 처리 포함) | `infrastructure/database/repositories/` |
| 1-2-G | Infrastructure: AES-GCM 암호화 서비스 | `infrastructure/crypto/encryption.service.ts` |
| 1-2-H | Presentation: `StudentController`, `ParentController` | `presentation/controllers/` |
| 1-2-I | Frontend: 학생 목록 (필터+테이블+검색) | `frontend/src/app/(admin)/students/page.tsx` |
| 1-2-J | Frontend: 학생 상세 (TPI 탭 구조) | `frontend/src/app/(admin)/students/[id]/page.tsx` |
| 1-2-K | Frontend: 학부모 목록/상세 | `frontend/src/app/(admin)/students/parents/` |

**화면 구성안 — SCR-A-S-01 학생 목록**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ 학생 관리                                          [ + 학생 등록 ]   │
├──────────────────────────────────────────────────────────────────────┤
│ [학년 ▼] [반 ▼] [상태 ▼] [교사 ▼]                   [ 🔍 검색 ]    │
├──────┬──────┬──────┬──────────┬──────────┬──────────┬───────────────┤
│ 이름  │ 학년 │ 소속반 │ 납부상태  │ 다음 수업  │ 상태     │ 액션         │
├──────┼──────┼──────┼──────────┼──────────┼──────────┼───────────────┤
│ 김하나│ G5   │ RC-A │ ✅ 완납  │ 04/21 PM3│ ● 재원   │ [상세][반변경]│
│ 이서준│ G4   │ RC-B │ ⚠ 미납  │ 04/22 AM │ ● 재원   │ [상세][결제]  │
│ 박지우│ G6   │ —    │ —       │ —        │ ○ 상담중  │ [상세]       │
├──────┴──────┴──────┴──────────┴──────────┴──────────┴───────────────┤
│                                         << 1 2 3 ... 12 >>          │
└──────────────────────────────────────────────────────────────────────┘
```

**화면 구성안 — SCR-A-S-02 학생 상세 (TPI)**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ ⛨ 김하나  G5  ● 재원                                               │
├──────────────────────────────────────────────────────────────────────┤
│ [ 기본정보 ] [ TPI ] [ 수업·출결 ] [ 성적 ] [ 결제 ]                 │
├──────────────────────────────────────────────────────────────────────┤
│ TPI (Trinity Personal Information)                                   │
│ ┌────────────────────────┬──────────────────────────────────────┐    │
│ │ 생년월일               │ 2015-03-12                           │    │
│ │ 성별                   │ 여                                   │    │
│ │ 학교                   │ 서울국제초등학교                       │    │
│ │ 학년                   │ G5                                   │    │
│ │ 담임                   │ 김영수 선생님                          │    │
│ │ 연락처 (암호화)         │ 010-****-**** [보기 🔓]              │    │
│ │ 학습이력               │ RC Basic → RC Inter (2025.09~)       │    │
│ │ 특이사항               │ [알러지] [영어원어민] [해외거주경험]     │    │
│ └────────────────────────┴──────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
  암호화 필드: 마스킹 기본, [보기] 클릭 시 권한+사유 확인 후 복호화 (FN-039)
```

---

### Task 1-3: Consultation Module (Kanban)

**기능 ID**: FN-020 ~ FN-029 | **화면 ID**: SCR-A-C-01 ~ SCR-A-C-03

| Sub-task | Description | Layer |
|----------|-------------|-------|
| 1-3-A | Domain: `Consultation`, `VisitRecord` + 상태 전이 로직 | `domain/entities/`, `domain/services/` |
| 1-3-B | Domain: `IConsultationRepository` | `domain/repositories/` |
| 1-3-C | Application DTO: 접수/상태전이/방문예약/등록확정 | `application/dto/consultation/` |
| 1-3-D | Application UseCase: `CreateConsultation`, `TransitionState`, `ScheduleVisit`, `ConfirmEnrollment` | `application/use-cases/consultation/` |
| 1-3-E | Infrastructure: Repository 구현 | `infrastructure/database/repositories/` |
| 1-3-F | Presentation: `ConsultationController` | `presentation/controllers/` |
| 1-3-G | Frontend: Kanban 보드 (5-column DnD) | `frontend/src/app/(admin)/consultations/page.tsx` |
| 1-3-H | Frontend: 상담 상세 (타임라인) | `frontend/src/app/(admin)/consultations/[id]/page.tsx` |
| 1-3-I | Frontend: 방문 예약 모달 | `frontend/src/components/admin/consultation/visit-modal.tsx` |
| 1-3-J | Portal ConsultationForm → Backend 연동 (기존 프론트 API 라우트 → NestJS 전환) | `frontend/src/app/(portal)/contact/` |

**화면 구성안 — SCR-A-C-01 Consultation Kanban**:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 상담 관리                                              [ + 상담 접수 ]   │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌─ INQUIRY ──┐ ┌─ VISIT_SCHED ┐ ┌─ MAP_TESTED ┐ ┌─ ENROLLED ┐ ┌ LOST ┐│
│ │            │ │              │ │             │ │           │ │      ││
│ │ ┌────────┐ │ │ ┌──────────┐ │ │ ┌─────────┐ │ │ ┌───────┐ │ │      ││
│ │ │ 이서준  │ │ │ │ 박지우    │ │ │ │ 최유나  │ │ │ │ 김하나 │ │ │      ││
│ │ │ G4     │ │ │ │ G6       │ │ │ │ G5      │ │ │ │ G5    │ │ │      ││
│ │ │ D+3    │ │ │ │ 04/22 방문│ │ │ │ RC 240  │ │ │ │ RC-A  │ │ │      ││
│ │ │ 📞 전화 │ │ │ │ 👤 김영수 │ │ │ │ 반배정→ │ │ │ │ ✅    │ │ │      ││
│ │ └────────┘ │ │ └──────────┘ │ │ └─────────┘ │ │ └───────┘ │ │      ││
│ │            │ │              │ │             │ │           │ │      ││
│ │ ┌────────┐ │ │              │ │             │ │           │ │      ││
│ │ │ 한소율  │ │ │              │ │             │ │           │ │      ││
│ │ │ G3     │ │ │              │ │             │ │           │ │      ││
│ │ │ D+1    │ │ │              │ │             │ │           │ │      ││
│ │ └────────┘ │ │              │ │             │ │           │ │      ││
│ └────────────┘ └──────────────┘ └─────────────┘ └───────────┘ └──────┘│
└──────────────────────────────────────────────────────────────────────────┘
  DnD: 카드 드래그 → 상태 전이 확인 다이얼로그. 금지 전이(예: ENROLLED→INQUIRY) 차단.
  카드 색: Cream bg, Gold left-border, Navy text. LOST = Slate muted.
```

---

### Task 1-4: Settings 기초

**기능 ID**: FN-120, FN-121 | **화면 ID**: SCR-A-SET-01, SCR-A-SET-02

| Sub-task | Description |
|----------|-------------|
| 1-4-A | Academy 프로필 편집 API + 페이지 | BE + FE |
| 1-4-B | 역할/권한 매트릭스 조회 API (편집은 Phase 4 이후) | BE |

---

## 4. Phase 2 — Program / Class / Timetable (W7–W10)

> **Exit**: 반 개설 → 시간표 노출 → 출결 체크 가능.

### Task 2-1: Program Module

**기능 ID**: FN-050, FN-051 | **화면 ID**: SCR-A-P-01, SCR-A-P-02

| Sub-task | Description |
|----------|-------------|
| 2-1-A | Domain/Application/Infrastructure: Program CRUD | Backend 전체 레이어 |
| 2-1-B | Frontend: 프로그램 목록 (6카드 그리드) | `frontend/src/app/(admin)/programs/page.tsx` |
| 2-1-C | Frontend: 프로그램 상세 (커리큘럼 트리) | `frontend/src/app/(admin)/programs/[id]/page.tsx` |

**화면 구성안 — SCR-A-P-01 Program 목록**:
```
┌──────────────────────────────────────────────────────────────────────┐
│ 프로그램 관리                                      [ + 프로그램 추가 ]│
├──────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │ RC Basic     │  │ RC Intermediate│ │ Math Pre-Alg │               │
│ │ ────────     │  │ ──────────── │  │ ──────────── │               │
│ │ G3~G4       │  │ G4~G5        │  │ G5~G6        │               │
│ │ 주 2h · 12w │  │ 주 3h · 16w  │  │ 주 2h · 12w  │               │
│ │ 반 3개 운영  │  │ 반 2개 운영   │  │ 반 1개 운영   │               │
│ │ ● ACTIVE    │  │ ● ACTIVE     │  │ ○ DRAFT      │               │
│ └──────────────┘  └──────────────┘  └──────────────┘               │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│ │ Math Algebra │  │ MAP 대비      │  │ 실전 모의     │               │
│ │ ...          │  │ ...          │  │ ...          │               │
│ └──────────────┘  └──────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Task 2-2: Class / Session Module

**기능 ID**: FN-052 ~ FN-058 | **화면 ID**: SCR-A-P-03

| Sub-task | Description |
|----------|-------------|
| 2-2-A | Domain: `Class`, `ClassSession` + 회차 자동 생성 로직 | `domain/` |
| 2-2-B | Domain Service: `SessionGenerationService` — 시작~종료, 요일 패턴, 휴원일 제외 | `domain/services/` |
| 2-2-C | Application: Class CRUD + Session 상태 전이 UseCase | `application/` |
| 2-2-D | Infrastructure: Repository 구현 | `infrastructure/` |
| 2-2-E | Presentation: `ClassController`, `SessionController` | `presentation/` |
| 2-2-F | Frontend: 반 상세 (회차 테이블 + elapsed_ratio 사이드바) | `frontend/src/app/(admin)/classes/[id]/page.tsx` |
| 2-2-G | Frontend: 반 개설 폼 (프로그램/교사/교실/시간 선택) | `frontend/src/components/admin/class/class-form.tsx` |
| 2-2-H | Domain Service: `ElapsedRatioCalculator` — `held/total` (FN-058, Trinity Pay 입력) | `domain/services/` |

---

### Task 2-3: Timetable Module

**기능 ID**: FN-080 ~ FN-084 | **화면 ID**: SCR-A-TT-01, SCR-A-TT-02

| Sub-task | Description |
|----------|-------------|
| 2-3-A | Application UseCase: `GetWeeklyTimetable` (교사/반 필터) | `application/` |
| 2-3-B | Frontend: 주간 달력 그리드 (7day × 시간축) | `frontend/src/app/(admin)/timetable/page.tsx` |
| 2-3-C | Frontend: 세션 상세 + 출결표 | `frontend/src/app/(admin)/timetable/session/[id]/page.tsx` |
| 2-3-D | Frontend: 출결 입력 컴포넌트 | `frontend/src/components/admin/timetable/attendance-form.tsx` |

**화면 구성안 — SCR-A-TT-01 Weekly Calendar**:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 시간표                    [< 이전주]  2026년 4월 3주차  [다음주 >]      │
│                           [교사 ▼] [반 ▼]                              │
├──────┬────────┬────────┬────────┬────────┬────────┬────────┬──────────┤
│ 시간  │  월     │  화    │  수    │  목    │  금     │  토    │  일      │
├──────┼────────┼────────┼────────┼────────┼────────┼────────┼──────────┤
│ 14:00│        │ ██████ │        │ ██████ │        │        │          │
│      │        │RC-A #5 │        │RC-A #6 │        │        │          │
│      │        │김영수  │        │김영수  │        │        │          │
│      │        │● 진행  │        │◆ 예정  │        │        │          │
│ 15:00│        │        │        │        │        │        │          │
│      │ ██████ │        │ ██████ │        │ ██████ │        │          │
│      │Math-B  │        │Math-B  │        │Math-B  │        │          │
│      │이미영  │        │이미영  │        │이미영  │        │          │
│      │● 진행  │        │✕ 결강  │        │◆ 예정  │        │          │
│ 16:00│        │        │        │        │        │        │          │
│      │        │        │ ██████ │        │        │        │          │
│      │        │        │보강#3  │        │        │        │          │
│      │        │        │김영수  │        │        │        │          │
│      │        │        │♦ 보강  │        │        │        │          │
└──────┴────────┴────────┴────────┴────────┴────────┴────────┴──────────┘
  색: ● 진행(#28a745 초록) / ✕ 결강(#dc3545 빨강) / ◆ 예정(Gold) / ♦ 보강(#6F4DB8 보라)
```

---

### Task 2-4: Enrollment Module

**기능 ID**: FN-025 (상담→등록 연계), FN-056 (반배정)

| Sub-task | Description |
|----------|-------------|
| 2-4-A | Domain/Application: Enrollment CRUD, 시간 충돌 검사 | Backend |
| 2-4-B | Frontend: 등록 관리 목록/상세 | `frontend/src/app/(admin)/enrollments/` |

---

## 5. Phase 3 — MAP Question Bank & Grading (W11–W14)

> **Exit**: 1개 TestSet을 실 학생 그룹에 배포하고 포털에 노출.

### Task 3-1: Passage & Item CRUD

**기능 ID**: FN-070 ~ FN-072 | **화면 ID**: SCR-A-M-01, SCR-A-M-02

| Sub-task | Description |
|----------|-------------|
| 3-1-A | Domain: Passage, Item (Part A/B), ItemTag | `domain/` |
| 3-1-B | Application: CRUD UseCases | `application/` |
| 3-1-C | Frontend: Passage Library (필터 + 카드 그리드) | `(admin)/map/passages/` |
| 3-1-D | Frontend: Item Editor (좌 지문 고정 / 우 Part A·B 탭) | `(admin)/map/items/` |

---

### Task 3-2: TestSet Builder & Assignment

**기능 ID**: FN-073 ~ FN-076 | **화면 ID**: SCR-A-M-03, SCR-A-M-04

| Sub-task | Description |
|----------|-------------|
| 3-2-A | Application: TestSet Build/Preview UseCase | `application/` |
| 3-2-B | Application: Assignment Create/Notify | `application/` |
| 3-2-C | Frontend: TestSet Builder (DnD + Summary 사이드바) | `(admin)/map/test-sets/` |
| 3-2-D | Frontend: Assignment 배포 폼 | `(admin)/map/assignments/` |

---

### Task 3-3: Grading Center & Score Portal

**기능 ID**: FN-077 ~ FN-079 | **화면 ID**: SCR-A-M-05, SCR-P-10/scores

| Sub-task | Description |
|----------|-------------|
| 3-3-A | Application: Grading UseCase (객관식 자동채점) | `application/` |
| 3-3-B | Frontend: Grading Center (3-패널) | `(admin)/map/grading/` |
| 3-3-C | Frontend: Score Portal (학부모 조회) | `(portal)/my/scores/` |

---

### Task 3-4: MAP Hub

**기능 ID**: — | **화면 ID**: SCR-A-M-00

| Sub-task | Description |
|----------|-------------|
| 3-4-A | Frontend: MAP Hub (KPI 4종 + 6 진입 카드) | `(admin)/map/page.tsx` |

---

## 6. Phase 4 — Trinity Pay (W15–W19)

> **Exit**: 결제 → 부분환불 → 수정세금계산서 Staging 통과.

### Task 4-1: Toss Widget 결제 (W15)

**기능 ID**: FN-100, FN-101 | **화면 ID**: SCR-A-PAY-01, SCR-A-PAY-02

| Sub-task | Description |
|----------|-------------|
| 4-1-A | `@tosspayments/payment-widget-sdk` 설치 | FE |
| 4-1-B | Domain: `PaymentOrder`, `PaymentProvider` interface | `domain/` |
| 4-1-C | Infrastructure: Toss Adapter (Confirm API) | `infrastructure/external/toss/` |
| 4-1-D | Application: `CreateOrder`, `ConfirmPayment` UseCase | `application/` |
| 4-1-E | Frontend: 결제 위젯 페이지 + Confirm 콜백 | `(admin)/payments/` |
| 4-1-F | Frontend: 주문 목록/상세 | `(admin)/payments/orders/` |

---

### Task 4-2: Webhook & Reconcile (W16)

**기능 ID**: FN-104

| Sub-task | Description |
|----------|-------------|
| 4-2-A | Webhook Controller (HMAC 서명 검증) | `presentation/controllers/webhook.controller.ts` |
| 4-2-B | Idempotency 처리 (Redis key) | `infrastructure/` |
| 4-2-C | Delta Reconciler (5분 cron) | `infrastructure/external/toss/` |

---

### Task 4-3: 수업일 기준 환불 (W17)

**기능 ID**: FN-102, FN-103 | **화면 ID**: SCR-A-PAY-03, SCR-A-PAY-04

| Sub-task | Description |
|----------|-------------|
| 4-3-A | Domain Service: `RefundCalculator` (elapsed_ratio → tier → 환불액) | `domain/services/` |
| 4-3-B | Infrastructure: Toss Cancel API 호출 | `infrastructure/external/toss/` |
| 4-3-C | Application: `CalculateRefund`, `ExecuteRefund` UseCase | `application/` |
| 4-3-D | Frontend: 환불 계산기 (4-row Tier 테이블) | `(admin)/payments/refund/` |

---

### Task 4-4: NTS eTax 자체 발행 (W18)

**기능 ID**: FN-106 | **화면 ID**: SCR-A-PAY-05, SCR-A-PAY-06

| Sub-task | Description |
|----------|-------------|
| 4-4-A | Infrastructure: NTS eTax Adapter (DRAFT→SUBMITTED→APPROVED) | `infrastructure/external/nts/` |
| 4-4-B | Application: `CreateTaxInvoice`, `SubmitTaxInvoice` UseCase | `application/` |
| 4-4-C | Frontend: 세금계산서 목록/상세 (XML Viewer) | `(admin)/payments/tax-invoices/` |
| 4-4-D | Worker: 익월 10일 배치 발행 + D-5 알림 | `infrastructure/` |

---

### Task 4-5: Pay Hub & Refund Policy Admin (W19)

**기능 ID**: FN-107 ~ FN-109 | **화면 ID**: SCR-A-PAY-00, SCR-A-PAY-08

| Sub-task | Description |
|----------|-------------|
| 4-5-A | Frontend: Pay Hub (KPI + Alerts + 최근 주문/환불) | `(admin)/payments/page.tsx` |
| 4-5-B | Frontend: 환불정책 Admin (버전 관리) | `(admin)/settings/refund-policy/` |
| 4-5-C | Application: 환불정책 CRUD + 소급 미적용 검증 | `application/` |
| 4-5-D | Frontend: 영수증 발급/조회 | `(admin)/payments/receipts/` |

---

## 7. Phase 5 — Portal, Hardening, Launch (W20–W22)

> **Exit**: Portal Lighthouse ≥ 90, 보안 스캔 High 0, 운영자 사인오프.

### Task 5-1: Portal 완성

**기능 ID**: FN-110 ~ FN-119 | **화면 ID**: SCR-P-01 ~ SCR-P-10

| Sub-task | Description | Status |
|----------|-------------|--------|
| 5-1-A | About 페이지 (OMNIBUS OMNIA, 원장 인사말) | ✅ 완료 |
| 5-1-B | Programs 목록/상세 (SSG 카탈로그) | ✅ 완료 |
| 5-1-C | News 목록/상세 (자체 DB) | ✅ 완료 |
| 5-1-D | MAP Test 안내 보완 | 🟡 기존 폼 유지 |
| 5-1-E | Contact → Backend 연동 | ✅ 완료 (기존 ConsultationModule) |
| 5-1-F | 학부모 로그인 (FN-114) | ❌ |
| 5-1-G | Parent Dashboard (/my) + 자녀 스위처 | ❌ |
| 5-1-H | 내 시간표 / 내 성적 / 내 결제 | ❌ |

---

### Task 5-2: Dashboard Module

**기능 ID**: FN-010 ~ FN-012 | **화면 ID**: SCR-A-00

| Sub-task | Description |
|----------|-------------|
| 5-2-A | Backend: KPI 집계 API (오늘 수업/이번주 결제/미납/신규 상담) | `application/` |
| 5-2-B | Frontend: Dashboard KPI 카드 + Today 리스트 + Alert 배너 | `(admin)/dashboard/` |

---

### Task 5-3: 보안 강화 및 성능 최적화

| Sub-task | Description |
|----------|-------------|
| 5-3-A | Rate Limiting (Redis-based) | `backend/` |
| 5-3-B | CSP Headers | `frontend/next.config.mjs` |
| 5-3-C | OWASP Top 10 체크리스트 검증 | — |
| 5-3-D | Lighthouse 최적화 (이미지/폰트/번들) | FE |
| 5-3-E | Playwright e2e 테스트 (5개 핵심 시나리오) | `test/e2e/` |

---

### Task 5-4: 설정 모듈 완성

**기능 ID**: FN-122 ~ FN-124

| Sub-task | Description |
|----------|-------------|
| 5-4-A | 알림톡 템플릿 관리 | `(admin)/settings/notifications/` |
| 5-4-B | 공동인증서 등록 | `(admin)/settings/certificate/` |
| 5-4-C | 감사로그 조회 | `(admin)/settings/audit-log/` |

---

## 8. Task Summary (작업 요약)

| Phase | Task Count | Key Deliverables |
|-------|-----------|------------------|
| **Phase 0** | 7 tasks (28 sub-tasks) | DB 적용, Entity 33+2개, Auth, AdminLayout, CI |
| **Phase 1** | 4 tasks (30 sub-tasks) | Teacher/Student/Parent/Consultation 전체 스택 |
| **Phase 2** | 4 tasks (19 sub-tasks) | Program/Class/Session/Timetable/Enrollment |
| **Phase 3** | 4 tasks (11 sub-tasks) | MAP Passage/Item/TestSet/Grading/Score |
| **Phase 4** | 5 tasks (16 sub-tasks) | Toss/Webhook/Refund/NTS eTax/Policy Admin |
| **Phase 5** | 4 tasks (16 sub-tasks) | Portal 완성/Dashboard/보안/설정 |
| **Total** | **28 tasks** | **~120 sub-tasks** |

---

## 9. Immediate Next Steps (즉시 실행 항목)

Phase 0 내에서의 **권장 실행 순서**:

```
1. Task 0-1 (DB 스키마 적용 + TypeORM Entity)   ← 모든 후속 작업의 전제
2. Task 0-2 (Audit Log 테이블)                   ← 0-1과 함께
3. Task 0-3 (인증 시스템)                         ← Admin 페이지의 전제
4. Task 0-4 (Admin Layout)                       ← UI 작업의 전제
5. Task 0-5 (공통 모듈)                           ← 비즈니스 로직의 전제
6. Task 0-7 (Seed 데이터)                         ← 개발 환경 완성
7. Task 0-6 (CI/CD)                              ← 안정화
```

---

## 10. Reference Documents (참조 문서)

| Document | Path |
|----------|------|
| 개발계획서 v1.3 | `docs/implementation/academy-management-dev-plan.md` |
| 기능명세서 v1.3 | `docs/design/academy-management-func-spec.md` |
| 요구사항 분석서 v1.3 | `docs/analysis/academy-management-requirements.md` |
| ERD v1.3 | `docs/design/academy-management-erd.md` |
| DB Schema SQL | `sql/academy-management-schema.sql` |
| Hi-Fi Mockups | `docs/design/screens/*.html` |

---

*OMNIBUS OMNIA — 모든 이에게 모든 것이 되어.*
