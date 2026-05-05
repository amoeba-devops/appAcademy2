---
document_id: TAC-STUDENT-MGMT-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-04
updated: 2026-05-04
author: 김익용 (Gray)
related:
  - SPEC.md §3.4
  - CLAUDE.md §4 / §5 / §11
  - docs/analysis/PORTAL-TPI-MIGRATION-REQ-1.0.0.md
  - docs/design/academy-management-screens.md (A-S-01 / A-S-02)
  - docs/implementation/tasks/STUDENT-IMPORT-TASK-1.0.0.md
  - docs/implementation/tasks/STUDENT-IMPORT-TASK-2.0.0.md
  - sql/010-academy-management-schema.sql
  - sql/040-migration-student-import-1.0.0.sql
  - sql/050-seed-tpi-students.sql
  - sql/060-seed-tpi-students-v2.sql
change_log:
  - version: 1.0.0
    date: 2026-05-04
    author: 김익용
    description: |
      Initial requirements analysis for TAC admin Student Management
      (학생 정보 입력/조회/수정 기능). TPI verbatim 마이그레이션 후속 작업으로,
      이미 시드된 121명 TPI 학생 데이터를 운영자가 화면에서 관리할 수 있도록
      Backend CRUD + Admin UI를 정의한다.
---

# TAC Student Management — Requirements Analysis (학생 정보 입력 요구사항 분석서)

## 1. Background (배경)

### 1.1 Context (맥락)

TPI 학생 정보 마이그레이션(STUDENT-IMPORT-TASK-1.0.0 / 2.0.0)으로 **MySQL `tac_students` / `tac_parents` / `tac_enrollments`** 에 121명의 학생 시드가 적재되어 있다. 그러나:

- ❌ **운영자가 학생 정보를 등록/수정할 수 있는 화면 없음** (현재 DBMS 직접 접속 또는 SQL 수동 작성 필요)
- ❌ **백엔드 CRUD API 미구현** (`/api/students`, `/api/parents` 미존재)
- ⏳ TPI 포털(verbatim) 이전 후 **인테이크 → 상담 → 등록(학생 생성)** 운영 동선이 활성화되면 **학생 등록 UI 부재가 즉시 운영 차단 요소**가 된다.

### 1.2 Why now (착수 배경)

| # | 트리거 | 영향 |
|---|---|---|
| T-1 | TPI 포털 verbatim 이전 결정 → MAP TEST 신청·상담 폼이 곧 운영 인입 시작 | 신규 학생 정보 수기 입력 수단 필수 |
| T-2 | 시드된 121명 학생 일부 컬럼이 미완 (전화번호 placeholder, MAP 점수 비구조화) | 운영자가 점진적으로 보강 입력해야 함 |
| T-3 | Phase 1 완료 보고서 후속 미결: "Phase 2 — 관리자 UI 구현" | Phase 2 시작점 |

### 1.3 Goals & Non-goals (목표 / 비목표)

**Goals**
- G-1: 운영자(Admin)가 **TAC `(admin)/students` 화면에서 학생을 등록·조회·수정·종료(소프트삭제)** 할 수 있다.
- G-2: **백엔드 CRUD API**를 NestJS Clean Architecture 패턴으로 구현하여 화면이 안정적으로 데이터 조작할 수 있다.
- G-3: 시드된 TPI 학생 데이터를 그대로 활용하며, **기존 컬럼/스키마 변경 없음** (parent FK, lifecycle 등 그대로).
- G-4: **개인정보 컬럼(전화번호, 이메일)** 의 암호화 저장(AES-GCM, NFR-005) 정책을 화면/API에서 일관되게 따른다.

**Non-goals (이번 범위 제외)**
- N-1: 엑셀 일괄 업로드 UI (Phase 2 후속, 별도 REQ로 분리 가능)
- N-2: 학부모 M:N 관리 UI (보조 보호자 추가/편집) — 1:1 주 보호자만 본 범위
- N-3: MAP 점수 구조화 입력 (별도 `tac_map_scores` 모델링 필요 — 별도 REQ)
- N-4: 학생 사진/문서 업로드
- N-5: AMA SSO 연동 (학부모 계정 자동 매핑은 후속)
- N-6: KMS 키로의 prt_phone_encrypted 재암호화 (현재 dev-key 유지, 운영 전환 시점 별도 작업)

---

## 2. Stakeholders & Users (이해관계자/사용자)

| Role | 의미 | 주요 화면/기능 |
|---|---|---|
| **운영자(Admin)** | TAC 학원 직원, 상담실장 | 학생 목록·등록·수정·종료 |
| **상담사(Counselor)** | 학생 등록·수정 | 신규 학생 생성 (상담 단계에서 lifecycle=CONSULTING) |
| **시스템(타 모듈)** | 상담→등록 전환 use-case | `tac_students.std_lifecycle_status` 갱신 트리거 |

(권한 분기 V1 기준: 모든 Admin 사용자에게 동일 권한 부여. RBAC 세분화는 후속.)

---

## 3. Scope (범위)

### 3.1 In Scope (포함)

#### 3.1.1 Backend
- NestJS `students` 모듈 (Domain → Application → Infrastructure → Presentation 4-Layer)
- REST 엔드포인트 6종 (§5 API Spec 참조)
- 학생-주보호자(`tac_parents`) 동시 생성·수정 (트랜잭션)
- 페이지네이션 / 검색 / 필터 / 정렬

#### 3.1.2 Frontend
- `/admin/students` — 목록 페이지 (검색·필터·페이지네이션·"+신규 학생" 버튼)
- `/admin/students/new` — 등록 폼
- `/admin/students/[id]` — 상세·편집 페이지 (Info 탭 단일 — 다른 탭은 Phase 2)
- 종료(`TERMINATED`) 처리: 상세 화면에서 사유 입력 모달 → 소프트 deactivate

### 3.2 Out of Scope (제외)
N-1 ~ N-6 (§1.3 참조)

---

## 4. Functional Requirements (기능 요구사항)

> 표기 — **FR-S-xx** = Student Mgmt FR. 우선순위: **P0** (필수 출시), **P1** (출시 후 1주 내), **P2** (후속).

### 4.1 학생 조회 (List & Detail)

| ID | 기능 | 우선순위 | 인수 기준(AC) |
|---|---|---|---|
| FR-S-01 | 학생 목록 조회 | P0 | acd_id 격리, 기본 50건/페이지, 응답 < 1초 (1k row 기준) |
| FR-S-02 | 키워드 검색 | P0 | `std_name` / `std_school` 부분일치 (LIKE %k%) |
| FR-S-03 | 필터 (lifecycle / cohort / school) | P0 | URL 쿼리 파라미터로 보존, 다중 선택 가능 |
| FR-S-04 | 정렬 (등록일 desc / 이름 asc) | P0 | 기본 등록일 desc |
| FR-S-05 | 학생 상세 조회 | P0 | 학생 + 주보호자 1건 조인, 권한 체크 (acd_id 일치) |

### 4.2 학생 등록 (Create)

| ID | 기능 | 우선순위 | 인수 기준(AC) |
|---|---|---|---|
| FR-S-10 | 신규 학생 등록 | P0 | 단일 트랜잭션으로 `tac_parents` + `tac_students` 동시 INSERT |
| FR-S-11 | 필수 입력 검증 | P0 | std_name / prt_name / prt_phone 누락 시 400 + i18n 에러 |
| FR-S-12 | 전화번호 형식 검증 | P0 | `^01[016789]-?\d{3,4}-?\d{4}$` (한국 휴대전화) |
| FR-S-13 | 전화번호 중복 시 기존 학부모 매칭 제안 | P1 | 동일 acd_id 내 동일 prt_phone 발견 시 모달로 "기존 학부모에 학생만 추가" 옵션 제공 |
| FR-S-14 | 자동 lifecycle = CONSULTING | P0 | 신규 학생 default `std_lifecycle_status='CONSULTING'` |

### 4.3 학생 수정 (Update)

| ID | 기능 | 우선순위 | 인수 기준(AC) |
|---|---|---|---|
| FR-S-20 | 기본 정보 수정 | P0 | 학생 컬럼 + 주보호자 컬럼 PATCH (부분 업데이트) |
| FR-S-21 | lifecycle 상태 변경 | P0 | CONSULTING → ENROLLED → ACTIVE → TERMINATED 단방향 (예외: ACTIVE↔CONSULTING 허용) |
| FR-S-22 | 종료 처리 (TERMINATED) | P0 | 사유(`std_termination_reason`) 필수 + `std_terminated_at` 자동 NOW() |

### 4.4 학생 삭제 (Delete)

| ID | 기능 | 우선순위 | 인수 기준(AC) |
|---|---|---|---|
| FR-S-30 | 하드 삭제 금지 | P0 | DELETE API 미제공 — TERMINATED 처리만 |
| FR-S-31 | 종료 학생은 목록 기본 숨김 | P0 | 필터 "종료 포함" 체크 시 노출 |

---

## 5. API Spec (API 명세)

> Base path: `/api/students` · 인증: TAC admin JWT (별도 모듈, ACM 인증과 분리) · acd_id는 JWT 클레임에서 자동 주입.
> **현 단계 임시 정책**: TAC admin 인증 모듈이 미구현이므로, ACM과 동일한 패턴(`AcmJwtAuthGuard` 참고)으로 **`TacAdminJwtAuthGuard`** 신규 추가하거나, 임시로 인증 우회 후 §11에 별도 BLOCKER로 등록.

| Method | Path | 설명 | Body / Query | 응답 |
|---|---|---|---|---|
| GET | `/api/students` | 목록 | `?q=&lifecycle=&cohort=&school=&include_terminated=&page=1&limit=50&sort=created_at:desc` | `{ items: Student[], meta: { page, limit, total } }` |
| GET | `/api/students/:id` | 상세 | — | `{ student: StudentDetail }` (parent 포함) |
| POST | `/api/students` | 등록 | `CreateStudentDto` (학생+주보호자) | `{ student: { std_id }, parent: { prt_id } }` (201) |
| PUT | `/api/students/:id` | 수정 | `UpdateStudentDto` | `{ student }` |
| POST | `/api/students/:id/terminate` | 종료 | `{ reason: string }` | `{ student }` |
| GET | `/api/parents/by-phone?phone=...` | 학부모 중복 검사 (FR-S-13) | — | `{ parent: ParentSummary \| null }` |

### 5.1 DTO Sketch

```ts
// CreateStudentDto
{
  student: {
    name: string;            // required, 1-100
    englishName?: string;    // optional, 1-100
    birthDate?: string;      // ISO date
    gender?: 'M' | 'F';
    school?: string;
    grade?: string;          // 자유텍스트 (e.g. "G7", "초6")
    residence?: string;
    cohortLabel?: string;    // "TPI" / "Santa Croce" / ...
    note?: string;
    lifecycleStatus?: 'CONSULTING' | 'ENROLLED' | 'ACTIVE';  // default CONSULTING
  };
  parent: {
    name: string;            // required, 1-100
    phone: string;           // required, KR phone format
    email?: string;
    preferredChannel?: 'SMS' | 'EMAIL' | 'KAKAO';   // default SMS
  };
  // 또는: { existingParentId: bigint } (FR-S-13 기존 학부모 재사용)
}
```

### 5.2 Response Envelope
- 전역 `TransformInterceptor` → `{ success, data, meta? }` 패턴 그대로 사용 (CLAUDE.md §6.2).

### 5.3 Error Codes
| Code | HTTP | 의미 |
|---|---|---|
| `STUDENT_NOT_FOUND` | 404 | 존재하지 않거나 다른 acd_id |
| `STUDENT_VALIDATION_FAILED` | 400 | DTO 검증 실패 |
| `STUDENT_TERMINATION_REASON_REQUIRED` | 422 | 종료 시 사유 누락 |
| `PARENT_PHONE_DUPLICATE` | 409 | 중복 (FR-S-13 흐름 안내용) |

---

## 6. Data Model (데이터 모델)

### 6.1 사용 테이블 (변경 없음)

| Table | 사용 컬럼 | 비고 |
|---|---|---|
| `tac_students` | std_id, acd_id, prt_id, std_name, std_english_name, std_birth_date, std_gender, std_school, std_grade, std_status, std_lifecycle_status, std_terminated_at, std_termination_reason, std_residence, std_cohort_label, std_curriculum_text, std_note, std_phone_encrypted | 모든 v1.0 추가 컬럼 활용 |
| `tac_parents` | prt_id, acd_id, prt_name, prt_phone_encrypted, prt_email_encrypted, prt_preferred_channel | 신규 입력 시 동시 생성 |
| `tac_student_guardians` | sgd_id, std_id, prt_id, sgd_is_primary | 주 보호자 자동 1행 생성 (`is_primary=true`) |

### 6.2 스키마 변경 사항: **없음**
- 본 REQ는 기존 `sql/040-migration-student-import-1.0.0.sql` 컬럼만 활용.
- 추가 마이그레이션 SQL 없음.

### 6.3 암호화 정책
- `prt_phone_encrypted` / `prt_email_encrypted`: **AES-GCM**, 현재 `SHA2('trinity-dev-key',256)` (dev key) 사용 (시드 v2와 동일).
- KMS 전환은 별도 작업 — 본 범위에서 입력/조회 시 Service 레이어가 dev key로 일관 처리.

---

## 7. UI Requirements (화면 요구사항)

> 본 단원은 화면 정의 수준만 명시. **상세 와이어프레임/ASCII 목업은 작업 계획서(PLAN-260504-tac-student-mgmt.md)** 에서 작성.

### 7.1 화면 목록

| 화면 ID | 경로 | 핵심 컴포넌트 |
|---|---|---|
| **A-S-01 List** | `/admin/students` | 검색바, 필터 칩(lifecycle/cohort/school/include_terminated), 테이블, 페이지네이션, "+신규 학생" 버튼 |
| **A-S-02-N New** | `/admin/students/new` | 학생 입력 폼 + 학부모 입력 폼 (단일 화면) |
| **A-S-02 Detail/Edit** | `/admin/students/[id]` | 학생 정보 편집(인플레이스), 학부모 정보 편집, 종료 버튼 (모달) |

### 7.2 컴포넌트 정책
- shadcn/ui (Form / Input / Select / Dialog / Table) 재사용
- React Hook Form + Zod 스키마 (CLAUDE.md §7.2)
- 토스트(`useToast`) / 확인 다이얼로그(`useConfirm`) — ACM 모듈에서 정착된 패턴 동일 적용

### 7.3 i18n
- 신규 namespace `students.json` (4 locale: ko/en/vi/zh-CN)
- 메모리 룰(amb-i18n): 신규 화면 모든 사용자 문자열 i18n 키화 필수

---

## 8. Non-functional Requirements (비기능 요구사항)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-S-1 | 응답 시간 | 목록 조회 95p < 800ms (1k row), 상세 < 300ms |
| NFR-S-2 | 멀티테넌시 격리 | 모든 쿼리 `WHERE acd_id = ?` (CLAUDE.md §4.5) |
| NFR-S-3 | 개인정보 암호화 | prt_phone / prt_email AES-GCM (CLAUDE.md §11.2) |
| NFR-S-4 | 입력 검증 | DTO class-validator + 글로벌 ValidationPipe (`forbidNonWhitelisted:true`) |
| NFR-S-5 | 감사 로그 | created_at/updated_at 자동, 명시적 audit log는 후속 |
| NFR-S-6 | 접근성 | 폼 라벨 `<Label for>` 연결, 에러 메시지 `aria-describedby` |
| NFR-S-7 | 테스트 커버리지 | Service 단위 80% / Controller 통합 핵심 흐름 100% |

---

## 9. Acceptance Criteria — 시나리오 (수락 기준)

### AC-1: 신규 학생 등록 (정상)
**Given** 운영자가 `/admin/students/new` 진입
**When** 학생명 "홍길동", 학부모명 "홍모", 전화 "010-1234-5678" 입력 후 저장
**Then** 201 응답 + 목록에 즉시 노출, lifecycle=CONSULTING

### AC-2: 학부모 전화 중복 시 매칭
**Given** 학부모 전화 "010-1234-5678"가 이미 다른 학생에 연결됨
**When** 동일 전화로 신규 학생 등록 시도
**Then** 모달로 "기존 학부모에 학생만 추가하시겠습니까?" 안내, "예" 선택 시 신규 prt 생성 없이 std만 INSERT

### AC-3: 학생 종료
**Given** lifecycle=ACTIVE 학생 상세 화면
**When** "종료" 버튼 → 사유 "이사" 입력 → 확인
**Then** lifecycle=TERMINATED, std_terminated_at=NOW(), 목록 기본 숨김

### AC-4: 검색/필터
**Given** TPI 학생 121명 시드
**When** 검색어 "리지", 필터 cohort=Santa Croce
**Then** 매칭 학생만 노출, 페이지네이션 정상

### AC-5: 멀티테넌시
**Given** acd_id A 운영자
**When** acd_id B 학생 ID 조회 시도
**Then** 404 (정보 노출 방지)

---

## 10. Risks & Open Questions (리스크/미결사항)

| ID | 항목 | 영향 | 대응 |
|---|---|---|---|
| R-1 | TAC admin 인증 모듈 미구현 | 모든 API 보호 불가 | §5 머리에 BLOCKER 명시. 옵션: (a) ACM `AcmJwtAuthGuard` 패턴 복제, (b) 임시 미보호 후 별도 REQ로 분리 — **사용자 결정 필요** |
| R-2 | dev key AES-GCM 유지 | 운영 전 KMS 전환 필요 | 본 REQ 범위 외, 별도 추적 |
| R-3 | 학부모 1:1 vs 1:N | 시드 v2의 일부 학부모는 다자녀 | 본 REQ는 "주보호자 1명 + std에 prt_id NOT NULL" 정책 유지. 보조보호자 UI는 후속 |
| R-4 | 시드 데이터 placeholder | "[MIGRATED]" 학부모명·"010-0000-0000" 등 | 운영자가 실데이터로 보강 입력하는 시나리오 자체가 본 기능의 사용 사례 |
| R-5 | 화면 디자인 A-S-01/A-S-02 v1.3 vs 현재 shadcn 토큰 | 미세 디자인 차이 | 작업 계획서에서 ASCII 목업으로 재확정 |

### 10.1 사용자 결정 필요 (Q-USER)

| Q-ID | 질문 | 옵션 |
|---|---|---|
| **Q-1** | TAC admin 인증을 본 작업에 포함할 것인가? | (a) 포함 — REQ 범위 확장, 일정 +α / (b) 미포함, 임시 무인증 (staging only) / (c) ACM AcmJwtAuthGuard 임시 재사용 |
| **Q-2** | TPI 학생 121명 placeholder 정리(데이터 클린업)도 본 범위에 포함? | (a) 포함 / (b) 운영자 수동 보강 (본 화면으로 충분) |
| **Q-3** | 학부모 전화 중복 매칭(FR-S-13) P0 vs P1? | (a) P0 (출시 동시) / (b) P1 (다음 스프린트) |

---

## 11. Dependencies (의존성)

| 의존 | 상태 | 영향 |
|---|---|---|
| MySQL `tac_students` v1.0 마이그레이션 | ✅ 완료 (`sql/040`) | — |
| TPI 시드 (121명) | ✅ 완료 (`sql/050`, `sql/060`) | 검색/필터 테스트 즉시 가능 |
| TAC admin 인증 | ❌ 미구현 | **R-1 / Q-1 참조** |
| Backend NestJS Clean Architecture | ✅ 패턴 정착 (ACM 모듈 6종 참고) | — |
| Frontend shadcn/ui + 토스트/확인 패턴 | ✅ 정착 (frontend-acm) | TAC frontend (`frontend/`)에 복제 필요 |

---

## 12. Out-of-scope follow-ups (후속 별도 REQ 후보)

| 후속 | 메모 |
|---|---|
| TAC-STUDENT-BULK-IMPORT | 엑셀 업로드 + 미리보기 + 중복 처리 |
| TAC-STUDENT-MAP-SCORES | `tac_map_scores` 테이블 + 점수 입력/그래프 |
| TAC-STUDENT-GUARDIANS-MN | 보조 보호자 N명 추가 UI |
| TAC-STUDENT-TIMELINE | 학생 활동 이력 탭 (상담→등록→수업→피드백) |
| TAC-ADMIN-AUTH | TAC admin 인증/세션 (Q-1 결정 후) |

---

## 13. Definition of Done (완료 기준)

- [ ] §5 모든 P0 API 구현 + Swagger 문서화 (`/api/docs`)
- [ ] §7 3개 화면(목록/등록/상세) 모두 i18n 4-locale 적용
- [ ] §9 5개 AC 시나리오 통합 테스트 통과
- [ ] §8 NFR 기준 충족 (응답 시간, 멀티테넌시)
- [ ] 보고서: `docs/report/REPORT-{YYMMDD}-tac-student-mgmt.md`
- [ ] CHANGELOG `[1.4.x]` 또는 `[1.5.0]` 항목 추가

---

## 14. Next Step (다음 단계)

본 분석서 승인 후:
1. **작업 계획서**: `docs/implementation/PLAN-260504-tac-student-mgmt.md`
   - Task 분해 (Backend 모듈/Use-case/Controller, Frontend 3 화면)
   - ASCII UI 목업 (목록 / 등록 폼 / 상세 / 종료 모달)
   - 의존성 그래프, 리스크 보강
2. **테스트 케이스**: `docs/test/TC-260504-tac-student-mgmt.md` (AC 1:1 매핑)
3. 위 2개 산출물에 대한 **사용자 승인** 후 구현 착수

---

> ⚠️ **본 문서는 Draft 입니다.** §10.1 Q-1/Q-2/Q-3 결정 후 status=Approved로 전환하고 작업 계획서·TC를 작성합니다.
