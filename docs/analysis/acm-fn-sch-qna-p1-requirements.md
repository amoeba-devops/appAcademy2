---
document_id: ACM-REQ-SCH-QNA-P1-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-02
authors:
  - Implementation Team
related_designs:
  - ACM-FN-SCH-001 v1.0.0 (docs/design/acm-v1.0a-fn-sch-001.md)
  - ACM-FN-QNA-001 v1.0.0 (docs/design/acm-v1.0a-fn-qna-001.md)
  - ACM-REVIEW-001 v1.0.0 (docs/report/ACM-REVIEW-001-implementation-gap.md)
---

# ACM-FN-SCH-001 / FN-QNA-001 — P1 보강 요구사항 분석서

> **목적**: ACM v1.0a SCH(학교 마스터)·QNA(정기상담) 모듈의 명세 대비 미진행 P1 항목을 식별하고, 본 사이클(이번 PR)에 포함할 범위를 결정한다.

---

## 1. 배경 (Background)

[ACM-REVIEW-001 갭 보고서](../report/ACM-REVIEW-001-implementation-gap.md)에서 SCH/QNA 모두 명세 대비 **약 25%** 만 구현되었다고 평가됨.
사용자 결정(2026-05-02): SCH+QNA P1 항목을 **단일 사이클**로 구현 (옵션 C). UI 범위는 **최소(list만)**, i18n 정책은 **신규 텍스트만 ko/en/vi 등록**.

---

## 2. 현재 구현 진단 (As-Is)

### 2.1 SCH (`backend/src/modules/acm-sch/`)

| 항목 | 명세 | 현재 | 갭 |
|------|------|------|-----|
| DB 테이블 | `sch_schools`, `sch_grade_bands`, `sch_schedules` (3) | `amb_acm_sch_school` 1개만 | grade_bands / schedules **테이블 자체 없음** |
| Schools CRUD | S-01~S-06 (6) | 5개 (PATCH는 PUT으로 구현) | S-04 메서드 정렬 |
| Grade Bands | S-10~S-13 | 0개 | **전부 미구현** |
| Schedules | S-20~S-23 | 0개 | **전부 미구현** |
| Migration (xlsx) | S-30/S-31 | 0개 | OOS for P1 |
| Internal DI svc | `ISchSchoolService` | 미정의 | **CSL/QNA cross-module 차단** |
| 컬럼명 정합 | `schName`, `schCategory`, `schAuthorizationStatus`, ... | `name`, `level`, `is_foreign`, ... | **이름/구조 불일치** — Decision §4.1 |

### 2.2 QNA (`backend/src/modules/acm-qna/`)

| 항목 | 명세 | 현재 | 갭 |
|------|------|------|-----|
| DB 테이블 | `qna_records`, `qna_record_students`, `qna_categories` (3) | `amb_acm_qna_question` 1개 | record_students N:N + categories **테이블 없음** |
| 컬럼 (dual-tone, resolution) | `internalBody`/`externalBody`, `resolutionStatus`, `isFaqPromoted`, `faqVisibility` | ✅ 모두 존재 | OK |
| 컬럼 (threading) | `qna_thread_parent_id` | ❌ 미존재 (`parentId`는 학부모 user FK) | **신규 컬럼 필요** |
| Records 액션 | Q-01~Q-11 (11) | Q-01,02,03,04,06 + status/resolution/faq patches | Q-05 (soft delete), Q-08 (escalate), Q-09 (reply), Q-10 (thread), Q-11 (students) **미구현** |
| FAQ 라우트 | Q-20~Q-23 | `PATCH :id/faq` 1개로 통합 | `GET /faq` (검색), `POST :id/use-faq` (clipboard) **미구현** |
| Categories | Q-30~Q-34 | 0개 | **전부 미구현** |
| Per-student timeline | `GET /students/:userId/qna` | 0개 | **미구현** |
| Internal DI svc | `IQnaService` | 미정의 | DSH/CSL 카드 차단 |

---

## 3. 기능 요구사항 (Functional Requirements — FR)

> 본 사이클(P1)에 포함되는 항목만 정의. **OOS** = Out of Scope.

### 3.1 SCH

| FR-ID | 항목 | 설명 | 대응 명세 # |
|-------|------|------|-------------|
| FR-SCH-P1-01 | School CRUD HTTP 메서드 정렬 | 현 PUT → PATCH 변경 (Update만) | S-04 |
| FR-SCH-P1-02 | Grade Bands CRUD | List/Create/Update/Delete (Authorized 학교에 한정) | S-10~S-13 |
| FR-SCH-P1-03 | Schedules CRUD | List/Create/Update/Delete | S-20~S-23 |
| FR-SCH-P1-04 | Internal DI service | `SchSchoolPublicService.findById/findByName` 노출 (CSL/QNA용) | §2.6 |
| FR-SCH-P1-05 | School delete 시 active CSL FK 차단 | `csl_inquiries.inq_target_school_id` 참조 시 422 거부 | S-05 |
| **OOS** | xlsx import (S-30/S-31), 컬럼 rename (`name`→`schName`), 다국어 학교명 | 별도 사이클 |

### 3.2 QNA

| FR-ID | 항목 | 설명 | 대응 명세 # |
|-------|------|------|-------------|
| FR-QNA-P1-01 | Soft delete | `DELETE /records/:id` (`team_lead+`) | Q-05 |
| FR-QNA-P1-02 | Escalate | `POST /records/:id/escalate` (status → ESCALATED) | Q-08 |
| FR-QNA-P1-03 | Threading 컬럼 + Reply | `thread_parent_id` 컬럼 추가, `POST :id/reply` (자식 record 생성) | Q-09 |
| FR-QNA-P1-04 | Thread chain 조회 | `GET /records/:id/thread` (parent 포함 모든 후속) | Q-10 |
| FR-QNA-P1-05 | Categories CRUD | `qna_categories` 테이블 + Q-30~Q-33 (List/Create/Patch/Delete) + `categoryId` FK 컬럼 | Q-30~Q-33 |
| FR-QNA-P1-06 | Per-student timeline | `GET /students/:userId/qna` (해당 학생의 모든 QNA 시계열) | §2.5 |
| FR-QNA-P1-07 | Internal DI service | `QnaPublicService.findByStudent/countOpenByStudent` | §2.7 |
| FR-QNA-P1-08 | FAQ Browse | `GET /faq?category=&q=` (현재 list에 `isFaqPromoted` 필터만 추가) | Q-20 |
| FR-QNA-P1-09 | Use-FAQ tracking | `POST :id/use-faq` (use_count++ + 응답 본문 반환) | Q-23, 신규 컬럼 `useCount` |
| **OOS** | `qna_record_students` N:N 분리, full-text search, bulk-recategorize, cleanse migration | 별도 사이클 |

---

## 4. 결정 필요 사항 (Decisions)

### 4.1 SCH 컬럼명 정합 (Decision-D1)
명세는 `schName/schCategory/schAuthorizationStatus/schCurriculumSystem`이지만 현재 DB는 `name/level/is_foreign`. 컬럼 rename은 마이그레이션 + 모든 의존 코드 수정 + 시드 재작성 필요 → **OOS 권고**, 명세 갱신 또는 별도 사이클로 분리.
- **권고**: 본 사이클은 컬럼명 유지. 명세 일치는 별도 PR (`acm-v1.0a-sch-rename-001`)로.

### 4.2 QNA student 다대다 (Decision-D2)
명세는 `qna_record_students` N:N이지만 현재 `studentId` 단일 컬럼. N:N 전환은 데이터 이행 + Q-11(`POST :id/students`) 시맨틱 변경 필요.
- **권고**: 본 사이클은 단일 `studentId` 유지. **Q-11은 본 사이클 OOS** (단일 학생만 PATCH로 변경 가능). N:N 전환은 별도 사이클.

### 4.3 thread_parent_id의 의미 (Decision-D3)
현재 `parentId`는 학부모 user FK. 명세 `qna_thread_parent_id`는 self-FK(부모 QNA).
- **권고**: 신규 컬럼 `thread_parent_id` 추가 (자체 self-FK), 기존 `parentId` (학부모 user) 보존.

### 4.4 i18n 적용 (Decision-D4)
- **권고**: 신규 추가되는 `frontend-acm` UI 텍스트(grade-band/schedule action 라벨, category 관리 라벨, escalate/reply 버튼 등)만 ko/en/vi 신규 키로 등록. 기존 화면은 별도 P0 사이클로.

### 4.5 인증/권한 (Decision-D5)
현재 `OwnEntityGuard`만 있고 role 분기는 미구현. 명세는 viewer/advisor/team_lead/admin 4단계.
- **권고**: 본 사이클은 명세상 권한을 **DTO/컨트롤러 ApiOperation summary에 주석으로만** 기재. 실제 RBAC enforcement는 AMA Auth 통합 사이클(P0-D)로 위임.

---

## 5. 비기능 요구사항 (NFR)

| NFR-ID | 항목 | 기준 |
|--------|------|------|
| NFR-P1-01 | 응답 시간 | list 200ms p95 (테넌트당 row≤1k 기준) |
| NFR-P1-02 | 멀티 테넌시 | 모든 쿼리 `WHERE ent_id = ?` 강제 |
| NFR-P1-03 | Soft delete | 모든 신규 테이블 `deleted_at` 컬럼 + `WHERE deleted_at IS NULL` 필터 |
| NFR-P1-04 | i18n | 신규 UI 텍스트는 ko 기본 + en/vi 키 등록 (Decision-D4) |
| NFR-P1-05 | 트랜잭션 | reply / escalate / promote-faq 등 상태 변경은 단일 트랜잭션 |
| NFR-P1-06 | API 호환성 | 기존 컨트롤러 응답 schema는 backwards-compatible (필드 추가만 허용) |

---

## 6. 인수 기준 (Acceptance Criteria — AC)

### 6.1 SCH

- **AC-SCH-01**: `PATCH /api/acm/sch/schools/:id` 가 200 OK; 동일 body로 PUT 호출 시 405.
- **AC-SCH-02**: Authorized 학교에 grade-band 생성 가능; Unauthorized 학교에 생성 시 422.
- **AC-SCH-03**: grade-band/schedule list는 부모 school의 `entId` 일치 검증.
- **AC-SCH-04**: school delete 시 active CSL 참조 있으면 422 + `code: SCHOOL_IN_USE`.
- **AC-SCH-05**: `SchSchoolPublicService.findById(entId, schId)` 가 cross-module DI로 호출 가능 (CSL 모듈에서 import 검증).

### 6.2 QNA

- **AC-QNA-01**: `DELETE /records/:id` → 204; 다시 `GET` 시 404.
- **AC-QNA-02**: `POST :id/escalate` → status `ESCALATED`, audit `escalated_by/at` 기록.
- **AC-QNA-03**: `POST :id/reply { subject, body }` → 자식 record 생성, `thread_parent_id = :id`.
- **AC-QNA-04**: `GET :id/thread` → 부모 + 모든 후속 자식 시간순 반환.
- **AC-QNA-05**: Categories CRUD 4개 액션 동작; record 참조 있는 category 삭제 시 422.
- **AC-QNA-06**: `GET /students/:userId/qna` → 해당 학생 QNA만, 같은 entId 내, 시간 desc.
- **AC-QNA-07**: `POST :id/use-faq` → `useCount` 증가 + `externalBody` 반환.
- **AC-QNA-08**: `QnaPublicService.findByStudent(entId, studentId)` 가 DSH 모듈에서 import 가능.

---

## 7. 영향도 (Impact)

| 영역 | 영향 |
|------|------|
| DB | 신규 테이블 4개 (`sch_grade_bands`, `sch_schedules`, `qna_categories`) + QNA `thread_parent_id`, `category_id`, `use_count` 3개 컬럼 |
| Backend | SCH/QNA 모듈 컨트롤러/서비스 ~12개 신규 액션, public service 2개 |
| Frontend-acm | school-list-page / qna-list-page에 미니 액션 + i18n 키 신규 |
| 기존 데이터 | 비파괴 (모두 추가). 기존 `PUT /schools/:id`는 PATCH로 별칭 라우팅 추가하여 호환 유지 |

---

_End of ACM-REQ-SCH-QNA-P1-1.0.0._
