---
document_id: REQ-260511-student-parent-link
title: ACM 학생-학부모 연결 + CSL 신청 폼 학부모 이름 추가
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-11
related:
  - reference/acm-req-csl-001-counseling-mgmt-requirements-v2.1.md
  - docs/analysis/REQ-260505-acm-std-student-mgmt.md
  - docs/analysis/REQ-260511-cal-invitee-and-std-contact.md
  - sql/acm/600-acm-std-students.sql
  - sql/acm/840-acm-cal-invitee-and-std-contact.sql
  - sql/acm/100-acm-v1.0a-init.sql
---

# REQ-260511 — Student↔Parent Link & CSL Parent-Name Field
# REQ-260511 — 학생-학부모 연결 + 신규상담 학부모 이름 입력

## 1. Overview (개요)

ACM 학생관리(`/admin/std`) 와 신규상담(`/admin/csl`) 모듈에서 학부모 정보 활용을 다음과 같이 확장한다.

1. **학생 상세에서 학부모 연결 관리 UI 제공** — 한 학생에 다수의 학부모(보호자)를 등록·수정·해제할 수 있고, 그중 1명을 "주 보호자(primary)"로 지정한다.
2. **학부모 1 : 학생 N 매칭 지원** — 한 학부모(예: 자녀가 둘 이상인 부모) 가 여러 학생과 연결될 수 있도록 학부모 엔티티를 학생과 분리해 N:M 으로 운용한다. (※ DB 매핑 테이블은 [REQ-260511-cal-invitee-and-std-contact](REQ-260511-cal-invitee-and-std-contact.md) 에서 이미 도입됨 — 본 작업은 UI/API 활용 + 1:N 검색·등록 기능 보강.)
3. **신규상담(CSL) 신청 폼에 "학부모 이름" 입력 칸 추가** — 현재는 학부모 연락처(`inq_phone_*`) 만 받고 있어, 학부모 이름이 누락된다. 신청 단계에서 학부모 이름을 함께 받아 후속 학생 등록(STD) 시 학부모 엔티티 자동/반자동 생성·매칭에 활용한다.

## 2. Goals / Non-Goals (목표 / 비목표)

### Goals
- 학생 상세 화면(`/admin/std/[id]`) 에 **학부모 섹션** 추가: 등록된 학부모 목록 표시, 추가/수정/해제, 주 보호자 토글.
- 학부모 추가 시 **검색 후 연결** (기존 학부모 재사용) 또는 **신규 등록** 두 가지 흐름 지원 → **학부모 1 : 학생 N** 자연 충족.
- 학부모 검색은 이름 부분일치 + 전화 부분일치 (pg_trgm) — 동일 테넌트(`ent_id`) 범위 내.
- 학부모 별도 관리 페이지(`/admin/std/parents`) 신설: 학부모 목록·검색·상세, 학부모 1명에 연결된 자녀(학생) 목록 표시.
- CSL 신청 폼(INTAKE 단계 신규 등록 다이얼로그) 에 **학부모 이름** 입력칸 추가 (선택, 단 학부모 전화 `phoneStatus = PROVIDED` 인 경우 권장).
- CSL inquiry 테이블에 학부모 이름 컬럼 추가 — 학생 이름(`inq_name_*`) 과 분리해 별도 암호화 컬럼으로 저장.
- CSL → STD 전환(ENROLLMENT 단계 또는 student 자동 생성 시점) 에서 CSL 의 학부모 이름·전화를 사용해 학부모 엔티티를 매칭(같은 이름+전화 존재 시 재사용) 또는 신규 생성하여 연결.

### Non-Goals
- 학부모 로그인 계정/포털 — 본 작업은 인적정보·연결만. 인증은 별도 티켓.
- AmoebaTalk/SMS 알림 발송 — 학부모 등록·연결은 데이터 기능에 한정. 알림은 [REQ-260511-cal-invitee-and-std-contact](REQ-260511-cal-invitee-and-std-contact.md) 의 이메일 발송 모델을 따름.
- CSL 신청 폼의 학생-학부모 N:M UI — CSL 단계에서는 학생 1명 ↔ 학부모 1명(이름+전화) 만 입력. 다중 보호자 등록은 **STD 학생 상세** 에서만.
- 기존 CSL inquiry 데이터 일괄 마이그레이션 — 신규 inquiry 부터 적용. 기존은 NULL 허용.
- 학부모 PII 마스킹 정책 변경 — 기존 ADR-005 AES-GCM 정책 그대로 사용.

## 3. Constraints / Decisions (제약 / 결정사항)

| # | Topic | Decision |
|---|-------|----------|
| D1 | 학부모 엔티티 | 기존 `amb_acm_std_parent` (par_id, par_name, par_relation, par_phone, par_email) 그대로 사용. 신규 컬럼 추가 없음. |
| D2 | 매핑 테이블 | 기존 `amb_acm_std_student_parent` (sp_id, std_id, par_id, sp_is_primary, UNIQUE(std_id,par_id), partial unique on primary) 그대로 사용. |
| D3 | 학부모 1 : 학생 N | DB 레벨 자연 지원 (par_id → 다수 std_student_parent row). UI 에서 학부모 검색·재사용 흐름으로 보장. |
| D4 | 주 보호자(primary) | 학생당 최대 1명. UI 에서 다른 학부모를 primary 로 설정 시 기존 primary 는 자동 해제 (트랜잭션). |
| D5 | CSL 학부모 이름 컬럼 | `amb_acm_csl_inquiry` 에 신규 추가 — `inq_parent_name_encrypted`, `inq_parent_name_iv`, `inq_parent_name_auth_tag` (BYTEA, NULL 허용). 학생 이름 암호화와 동일 패턴 (ADR-005 AES-GCM). |
| D6 | CSL 폼 검증 | `parentName` 은 선택 필드. 단 `phoneStatus === 'PROVIDED'` 이면서 `parentPhone` 이 있을 때 UI 에서 "권장" 안내(차단은 X). |
| D7 | CSL → STD 학부모 매칭 | 학생 신규 생성 시 (`csl_inquiry.enrolled_at` 채워질 때 또는 운영자가 STD 등록할 때) CSL 의 (parent_name, parent_phone) 으로 동일 ent_id 내 학부모 검색 → hit 시 재사용 + 매핑 row 추가, miss 시 신규 par_id 생성 후 매핑. 기본 sp_is_primary = TRUE (학생의 첫 학부모일 때). |
| D8 | 학부모 검색 | pg_trgm GIN 인덱스(이미 par_name 에 존재) 활용. 전화 검색은 평문 par_phone 컬럼(현 스키마는 평문) 부분일치. |
| D9 | 권한 | 학부모 CRUD 는 ACM 운영자(JWT) 만 가능. 학생 상세 권한과 동일(이미 `AcmJwtAuthGuard + OwnEntityGuard` 적용). |
| D10 | i18n | ko/en 두 언어 라벨 추가 (`std.json`, `csl.json`). 학부모 관계 enum (MOTHER/FATHER/GUARDIAN/OTHER) 라벨 i18n. |

## 4. Functional Requirements (기능 요구사항)

### 4.1 STD — 학생 상세 학부모 섹션 (FR-STD-PAR-*)

| ID | Requirement |
|----|-------------|
| FR-STD-PAR-01 | 학생 상세 화면에 "학부모(보호자)" 섹션을 표시한다. 등록된 학부모는 카드/행 형식으로 이름·관계·연락처·이메일·primary 배지를 표시한다. |
| FR-STD-PAR-02 | "학부모 추가" 버튼 클릭 시 모달이 열리고, 사용자는 (a) 기존 학부모 검색 후 선택 또는 (b) 신규 학부모 등록 두 가지 모드를 선택할 수 있다. |
| FR-STD-PAR-03 | 검색 모드: 이름 또는 전화 2자 이상 입력 시 디바운스(300ms) 후 학부모 후보 목록 표시. 동일 테넌트 범위 내. 후보에는 이미 연결된 자녀(학생) 수도 표시한다. |
| FR-STD-PAR-04 | 신규 등록 모드: 이름(필수), 관계(필수, MOTHER/FATHER/GUARDIAN/OTHER), 전화(선택), 이메일(선택). 저장 시 학부모 신규 생성 + 학생-학부모 매핑 동시 생성 (트랜잭션). |
| FR-STD-PAR-05 | 학부모 행에서 "수정" 클릭 시 학부모 인적정보(이름/관계/전화/이메일) 수정 모달. 수정은 학부모 엔티티 단일 갱신이며, 같은 학부모에 연결된 다른 학생 모두에 반영된다. |
| FR-STD-PAR-06 | 학부모 행에서 "연결 해제" 클릭 시 학생-학부모 매핑(`std_student_parent`) 만 삭제하고, 학부모 엔티티 자체는 유지(다른 학생 연결 보존). |
| FR-STD-PAR-07 | 학부모 행에서 "주 보호자로 지정" 토글 클릭 시, 해당 학생의 다른 매핑 row 의 sp_is_primary 를 FALSE 로 변경하고 선택한 row 만 TRUE 로 변경한다 (트랜잭션). |
| FR-STD-PAR-08 | 같은 학부모(par_id) 가 같은 학생(std_id) 에 중복 연결될 수 없다 (UNIQUE 제약). 사용자에게 "이미 연결된 학부모입니다" 에러 토스트. |

### 4.2 학부모 관리 페이지 (FR-PAR-*)

| ID | Requirement |
|----|-------------|
| FR-PAR-01 | `/admin/std/parents` 라우트 신설. 학부모 목록(검색·페이지네이션). 컬럼: 이름·관계·전화·이메일·연결 자녀 수·등록일. |
| FR-PAR-02 | 학부모 상세(또는 인라인 expand)에서 연결된 자녀(학생) 목록 표시. 학생 행 클릭 시 학생 상세로 이동. |
| FR-PAR-03 | 학부모 상세에서 "자녀 추가 연결" 가능 — 학생 검색 후 매핑 row 생성. 기존 매핑 정책(D4, FR-STD-PAR-07~08) 동일 적용. |
| FR-PAR-04 | 학부모 단독 등록(자녀 없이)도 가능. 단, 0명 자녀 학부모는 목록에 "고아" 배지 표시(운영자 정리 유도). |

### 4.3 CSL — 신청 폼 학부모 이름 (FR-CSL-PAR-*)

| ID | Requirement |
|----|-------------|
| FR-CSL-PAR-01 | CSL 신규 등록 다이얼로그(`csl-create-dialog.tsx`) 폼에 **"학부모 이름"** (`parentName`) 입력 필드를 학부모 전화(`parentPhone`) 위에 추가한다. 라벨 i18n: `csl:fields.parentName`. |
| FR-CSL-PAR-02 | parentName 은 선택 필드 (max 50자). 학생 이름의 익명 처리(isAnonymous)와는 독립적으로 동작. |
| FR-CSL-PAR-03 | UI 안내: phoneStatus = PROVIDED 이면서 parentPhone 입력 시 parentName 미입력이면 "학부모 이름 입력을 권장합니다" 헬퍼 텍스트 표시 (검증 차단 X). |
| FR-CSL-PAR-04 | CSL inquiry 상세/수정 화면에서도 학부모 이름 표시·편집 지원. PII 마스킹 정책은 학생 이름과 동일. |
| FR-CSL-PAR-05 | CSL → STD 등록(또는 운영자가 학생 신규 생성 시점) 에서 CSL 의 (parentName, parentPhone) 이 모두 있으면 학부모 매칭 로직(D7) 으로 자동 학부모 엔티티 생성·연결한다. parentName 만 있고 parentPhone 이 없으면 신규 학부모로 생성하되 운영자 확인 모달로 한 번 더 확인. |

### 4.4 API (FR-API-*)

| ID | Endpoint | Description |
|----|----------|-------------|
| FR-API-01 | `GET /api/acm/std/parents?q=&limit=` | 학부모 검색(이름/전화 부분일치). |
| FR-API-02 | `POST /api/acm/std/parents` | 학부모 신규 생성. |
| FR-API-03 | `GET /api/acm/std/parents/:parId` | 학부모 상세 + 연결 자녀 목록. |
| FR-API-04 | `PUT /api/acm/std/parents/:parId` | 학부모 인적정보 수정. |
| FR-API-05 | `GET /api/acm/std/students/:stdId/parents` | 학생의 연결 학부모 목록. |
| FR-API-06 | `POST /api/acm/std/students/:stdId/parents` | 학생-학부모 매핑 생성 (body: parId 또는 신규 학부모 payload). |
| FR-API-07 | `DELETE /api/acm/std/students/:stdId/parents/:parId` | 매핑 해제 (학부모 엔티티는 유지). |
| FR-API-08 | `PATCH /api/acm/std/students/:stdId/parents/:parId/primary` | 주 보호자 지정. |
| FR-API-09 | CSL 기존 `POST/PUT /api/acm/csl/inquiries` DTO 에 `parentName` 필드 추가. |

## 5. Non-Functional Requirements (비기능 요구사항)

| ID | Requirement |
|----|-------------|
| NFR-01 | **테넌트 격리** — 모든 학부모 조회/생성/수정은 JWT 의 ent_id 범위 내. OwnEntityGuard 에서 par.ent_id 검증. |
| NFR-02 | **PII 보호** — par_phone/par_email 은 현재 스키마 평문이지만, 응답 시 권한 없는 컨텍스트에서는 마스킹 옵션 적용 (학생 폼/리스트 동일 정책 준수). CSL parent_name 은 BYTEA AES-GCM 암호화 (ADR-005). |
| NFR-03 | **검색 성능** — 학부모 이름 검색은 pg_trgm GIN 인덱스(`uq_acm_std_parent_name_trgm`) 활용, 응답 P95 < 200ms (테넌트당 학부모 1만명 기준). |
| NFR-04 | **트랜잭션 일관성** — primary 토글, 매핑 추가, 학부모 신규 생성+매핑 은 단일 DB 트랜잭션으로 처리. |
| NFR-05 | **i18n** — 모든 신규 라벨 ko/en 두 언어 `std.json` / `csl.json` 에 추가. |
| NFR-06 | **마이그레이션 idempotent** — 신규 컬럼 추가 SQL 은 `ADD COLUMN IF NOT EXISTS` 사용. `scripts/deploy-staging.sh` 의 `sql/_applied/acm/` 마커로 1회 적용. |

## 6. Acceptance Criteria (인수 기준)

| AC | Scenario |
|----|----------|
| AC-01 | 학생 상세에서 "학부모 추가" → 신규 등록 → 저장 시, 학부모 엔티티 1건 생성 + 매핑 row 1건 생성, primary=TRUE. |
| AC-02 | 학부모 A 가 학생 X 에 이미 연결된 상태에서, 학생 Y 의 상세에서 "학부모 추가" → 검색 → A 선택 → 저장 시, A 의 par_id 가 X·Y 두 학생에 모두 연결됨 (학부모 1 : 학생 N). |
| AC-03 | 학생 X 에 학부모 A(primary) + B 두 명이 연결된 상태에서, B 를 primary 로 토글 시, A 의 sp_is_primary 가 FALSE 로, B 가 TRUE 로 1번의 트랜잭션에 변경됨. |
| AC-04 | 학생 X 에서 학부모 A 의 "연결 해제" → 매핑만 삭제. 학부모 A 는 학부모 목록에 그대로 존재하며 다른 학생 연결도 유지됨. |
| AC-05 | 학부모 관리 페이지(`/admin/std/parents`) 에서 이름 부분일치로 검색 시 후보가 표시되며, 행에 연결된 자녀 수가 정확히 표시됨. |
| AC-06 | 학부모 상세에서 자녀 학생 추가 연결 → 같은 매핑/제약 룰이 적용됨 (FR-STD-PAR-08 중복 검증 포함). |
| AC-07 | CSL 신규 등록 다이얼로그에 "학부모 이름" 입력칸이 노출되며, 입력값이 저장되고 CSL 상세에서 동일하게 조회·수정됨. |
| AC-08 | CSL 의 phoneStatus=PROVIDED + parentPhone 입력 + parentName 비어 있음 → 헬퍼 텍스트 표시되되 저장은 정상 진행. |
| AC-09 | CSL inquiry 가 (parentName="홍길순", parentPhone="010-1111-2222") 으로 등록된 후, 운영자가 "학생 등록" 액션을 실행하면, 동일 ent_id 내 같은 (par_name, par_phone) 학부모가 없으면 신규 par_id 생성 후 학생-학부모 매핑(primary=TRUE) 자동 생성. 동일 학부모 존재 시 par_id 재사용. |
| AC-10 | 다른 테넌트(ent_id) 의 학부모 par_id 로 매핑 시도 시 403/404. 다른 테넌트 학부모 검색 결과에 노출되지 않음. |
| AC-11 | 학부모 수정(이름/전화 변경) 후, 같은 학부모에 연결된 모든 학생 상세에서 갱신 즉시 반영(refetch 또는 cache invalidation). |

## 7. Out of Scope / Open Questions (범위 외 / 미결)

| # | Item | Note |
|---|------|------|
| Q1 | 학부모 PII 컬럼(par_phone/par_email) 의 암호화 전환 | 현 스키마 평문. CSL parent_name 은 암호화. 정책 통일 필요? → **Decision required** (운영팀). 본 작업 범위는 평문 유지(현행 student 컬럼과 동일). |
| Q2 | 학부모 중복 정리(merge) | 같은 사람을 여러 par_id 로 등록한 경우 머지 기능 필요? v1 미포함, 후속. |
| Q3 | CSL inquiry 의 학부모 이름이 학부모 검색 결과 일치 시 미리 후보를 보여주는 inline 검색 UX | UX 향상이지만 v1 비포함, 후속. |
| Q4 | 학생 폼 신규 생성 단계에서 학부모 동시 입력 (one-shot) | v1 은 학생 저장 후 상세에서 학부모 등록 2-step. one-shot 폼은 후속. |
| Q5 | AmoebaTalk/SMS 자동 알림 발송 | 본 작업 범위 외. 별도 티켓. |

## 8. Impacted Files (영향 파일 — 예상)

### Backend
- `sql/acm/8XX-csl-inquiry-parent-name.sql` (신규) — `amb_acm_csl_inquiry` 학부모 이름 컬럼 추가.
- `backend/src/modules/acm/std/` — 학부모 controller/service/repository 신규 또는 확장 (`StdParentController`, `StdStudentParentController`).
- `backend/src/modules/acm/csl/` — DTO 에 parentName 추가 + AES-GCM 암복호화 헬퍼 호출.
- `backend/src/modules/acm/std/dto/*` — `CreateParentDto`, `UpdateParentDto`, `LinkParentDto`.
- `backend/test/integration/acm/it-std-parent.spec.ts` (신규).

### Frontend
- `frontend-acm/src/modules/std/pages/std-detail-page.tsx` — 학부모 섹션 추가.
- `frontend-acm/src/modules/std/components/std-parent-section.tsx` (신규).
- `frontend-acm/src/modules/std/components/parent-pick-or-create-dialog.tsx` (신규).
- `frontend-acm/src/modules/std/pages/parent-list-page.tsx` (신규) + 라우터 등록.
- `frontend-acm/src/modules/csl/components/csl-create-dialog.tsx` — parentName 필드 추가 + zod 스키마 갱신.
- `frontend-acm/src/modules/csl/pages/csl-detail-page.tsx` — parentName 표시·편집.
- `frontend-acm/src/i18n/locales/{ko,en}/std.json`, `csl.json`.

## 9. Dependencies (의존)

- 기존 SQL 마이그레이션 [sql/acm/840-acm-cal-invitee-and-std-contact.sql](../../sql/acm/840-acm-cal-invitee-and-std-contact.sql) 적용 완료 (학부모 + 매핑 테이블).
- ACM 인증 모듈 (AcmJwtAuthGuard + OwnEntityGuard) 적용 완료.
- ADR-005 PII 암호화 헬퍼 (CSL inquiry 학생 이름 암호화에 이미 사용 중) — 동일 헬퍼 재사용.

## 10. Change Log

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-05-11 | GitHub Copilot | 최초 작성 (DRAFT). |
