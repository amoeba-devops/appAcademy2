---
document_id: REQ-260621-acm-std-student-fields-extension
version: 1.0.0
status: Draft
created: 2026-06-21
product_code: ACM
title: ACM 학생관리 — 수강중/등록/종료 3 뷰 필드 매핑·스키마 확장 요구사항 분석서
modules:
  - STD (Student·Parent Management / 학생·학부모관리)
related:
  - docs/analysis/REQ-260505-acm-std-student-mgmt.md       # STD v1 (현 amb_acm_std_student 기반)
  - docs/analysis/REQ-260511-student-parent-link.md         # 학부모 N:M + CSL→STD §D7 매칭
  - docs/analysis/REQ-260506-acm-tch-stf-cal.md             # 강사 마스터 (FR-TCH-5 강사 셀렉터)
  - sql/acm/600-acm-std-students.sql                        # 본 테이블 초기 생성
  - sql/acm/840-acm-cal-invitee-and-std-contact.sql         # std_email + std_parent + N:M (A1~A3)
  - backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts
change_log:
  - { version: 1.0.0, date: 2026-06-21, author: Claude, notes: "초안 — 3 뷰(수강중/신규등록/종료) 필드 매핑·갭 분석 + ALTER TABLE 제안 + 학부모 입력 필수 enforcement 권고" }
---

# REQ-260621 — ACM 학생관리 3 뷰 필드 매핑·스키마 확장 요구사항 분석서
## (Student Management — 3-View Field Mapping & Schema Extension)

---

## 1. 개요 (Overview)

acm.amoeba.site 학생관리(`/admin/std`)에서 사용자가 요구한 **3개 뷰**(① 수강중 목록 ·
② 신규 수강등록 폼 · ③ 수강종료 목록/상세)에서 노출·입력되는 필드를 **현 `amb_acm_std_student`
테이블 컬럼과 1:1 매핑**하고, **부재 필드는 컬럼 추가**한다. 추가로 **학부모 정보 입력은 필수**
요건(`amb_acm_std_parent` + `amb_acm_std_student_parent` 활용)을 응용·UI 레벨에서 강제한다.

> **사전 확인 결론**: 요구 필드 15개 중 **12개는 이미 존재**, **3개가 부재**(수업 종료일,
> 종료 상태/사유, 담당 강사 FK)다. 학부모 정보는 별도 엔티티(`amb_acm_std_parent`)에
> 보관되므로 **스키마 변경 없이도 가능**하지만, "입력 필수" 강제를 위해 응용 계층(DTO·
> 트랜잭션·UI) 보강이 필요하다. 자세한 매핑은 §5.

---

## 2. 배경 (Background)

### 2.1 학생관리 테이블 진화 이력
- `600-acm-std-students.sql` (2026-05-05) — `amb_acm_std_student` 초기 생성 (28 컬럼).
- `840-acm-cal-invitee-and-std-contact.sql` A1 (2026-05-11) — `std_email` 컬럼 추가.
- 이후 학생/학부모 스키마 변경 **없음** (`520-acm-tenant.sql` 등은 다른 모듈).
- 학부모 `amb_acm_std_parent` + N:M 매핑 `amb_acm_std_student_parent` 는 840에서 도입됨.

### 2.2 사용자 요구 3 뷰 정리

사용자가 제시한 3개 뷰의 필드를 정리하면:

| 뷰 | 화면 | 핵심 필드 차이 |
|----|------|----------------|
| ① **수강 중** | 학생 목록 (`/admin/std?status=ACTIVE`) | No. · 이름 · 성별 · 연락처 · 생년월일 · 학교 · 학년 · 거주지 · MAP(R/M/L) · 커리큘럼 · 담당 강사 · 수업 · 수업교재 · 수업 스케줄 |
| ② **신규 등록 폼** | 학생 생성 모달 (`/admin/std/new`) | 위 + **수업 시작일** + **특이사항** (No. 제외, 수업·수업스케줄 입력) |
| ③ **수강 종료** | 종료 학생 목록 (`/admin/std?status=WITHDRAWN`) | 위 인적·MAP·강사·커리큘럼·교재 + **수업 시작일** + **수업 종료일** + **종료 상태** (수업·수업스케줄 미노출) |

**공통**: 이름·성별·연락처·생년월일·학교·학년·거주지·MAP·담당 강사·커리큘럼·수업교재
**시작일**: ②③ 만
**종료일·종료 상태**: ③ 만
**수업·수업 스케줄**: ①② 만
**특이사항**: ② 만

### 2.3 학부모 정보 필수 요건
사용자 요청 — "**학부목 정보입력항목은 필수**" (학부모 정보입력항목은 필수). 학부모는 `std`
테이블의 컬럼이 아니라 **별도 엔티티 `amb_acm_std_parent`** 에 보관되며, 학생과 N:M으로
연결된다(`amb_acm_std_student_parent`). 따라서 본 요구사항은 **스키마가 아닌 응용·UI 계층의
필수 enforcement** 로 해석한다 (§6.3).

---

## 3. 목표 / 비목표 (Goals / Non-Goals)

### 3.1 Goals
1. 3 뷰의 모든 노출·입력 필드가 **현 또는 추가 컬럼**으로 1:1 매핑된다.
2. 부재 컬럼 3종(`std_end_date`·`std_end_reason`·`std_teacher_id`)을 추가하며, 기존 데이터·코드는
   **하위호환** 유지(NULL 허용·기존 free-text 보존).
3. 학생 생성·수정 시 **학부모 1명 이상 + 이름·전화·관계** 입력을 응용 레벨에서 필수화한다.
4. 종료 상태 enum 값을 학원 운영에 맞게 정의한다(완료·중도퇴원·이전·휴학·기타).
5. 담당 강사를 `amb_acm_tch_teacher` FK 로 정규화한다(REQ-260506 FR-TCH-5 후속).

### 3.2 Non-Goals
- 학부모 PII(`par_phone`·`par_email`) 평문 → 암호화 전환 — 별도 PII 정비 작업으로 분리
  (REQ-260525 §9 Q10).
- 학생 본인 포털 로그인(`std_user_id`) — 자체 로그인 없음(AMA-APP-STORE-PIVOT §2.2 Phase 1).
- MAP 점수 이력화(시기별 누적) — 현재는 최신 1회 컬럼 형태 유지.
- 학생 첨부 파일·사진 — 별도 작업.

---

## 4. 사용자 / 역할 (Users)

| Role | 권한 |
|------|------|
| ADMIN | 학생·학부모 CRUD, 종료 처리, 종료 사유 입력 |
| TEACHER | 본인 담당 학생 조회·MAP/커리큘럼 메모 갱신 |
| (Parent / Student) | 본 작업 직접 권한 없음(포털은 별도) |

---

## 5. 필드 매핑 (Field Mapping)

**범례**: ✅ 이미 존재 · ⚠️ 존재하나 보강 필요 · ❌ 부재(신규 추가 필요) · 🔗 별도 엔티티 연결

### 5.1 ① 수강 중 목록 뷰

| # | 요구 필드 | 현 컬럼 | 상태 | 비고 |
|---|-----------|---------|:---:|------|
| 1 | No. | (없음) | ❌ | 화면 표시용 행 번호 — `ROW_NUMBER() OVER (ORDER BY std_start_date DESC, std_name)` 으로 파생. 별도 컬럼 불필요. (영구 표시 번호가 필요한 경우 `std_seq_no` 옵션 — §8 권고 X) |
| 2 | 이름 | `std_name` VARCHAR(100) NOT NULL | ✅ | — |
| 3 | 성별 | `std_gender` CHAR(1) CHECK IN ('M','F') | ✅ | — |
| 4 | 연락처 | `std_phone` VARCHAR(30) | ✅ | 평문(NFR 정비 Non-Goal) |
| 5 | 생년월일 | `std_birth_date` DATE | ✅ | — |
| 6 | 학교 | `std_school` VARCHAR(100) | ✅ | — |
| 7 | 학년 | `std_grade` VARCHAR(20) | ✅ | — |
| 8 | 거주지 | `std_residence` VARCHAR(100) | ✅ | — |
| 9 | MAP TEST (R/M/L) | `std_map_reading`·`std_map_math`·`std_map_language` SMALLINT | ✅ | NWEA 100~300 |
| 10 | 커리큘럼 | `std_curriculum` TEXT | ✅ | — |
| 11 | 담당 강사 | `std_teacher` VARCHAR(100) | ⚠️ | **Free-text — FK 정규화 필요**. REQ-260506 FR-TCH-5 미해소 |
| 12 | 수업 | `std_subject` VARCHAR(100) | ✅ | "수업(과목)" 의미 |
| 13 | 수업교재 | `std_materials` TEXT | ✅ | — |
| 14 | 수업 스케줄 | `std_schedule_json` JSONB | ✅ | 구조화(요일·시각) |

### 5.2 ② 신규 수강 등록 폼

| # | 요구 필드 | 현 컬럼 | 상태 | 비고 |
|---|-----------|---------|:---:|------|
| 1 | 이름 | `std_name` | ✅ | NOT NULL |
| 2 | **수업 시작일** | `std_start_date` DATE | ✅ | — |
| 3 | 성별 | `std_gender` | ✅ | — |
| 4 | 연락처 | `std_phone` | ✅ | — |
| 5 | 생년월일 | `std_birth_date` | ✅ | — |
| 6 | 학교 | `std_school` | ✅ | — |
| 7 | 학년 | `std_grade` | ✅ | — |
| 8 | 거주지 | `std_residence` | ✅ | — |
| 9 | MAP TEST (R/M/L) | `std_map_*` | ✅ | — |
| 10 | 담당 강사 | `std_teacher` | ⚠️ | 동일 FK 정규화 필요 |
| 11 | 커리큘럼 | `std_curriculum` | ✅ | — |
| 12 | 수업교재 | `std_materials` | ✅ | — |
| 13 | 수업 스케줄 | `std_schedule_json` | ✅ | — |
| 14 | **특이사항** | `std_special_note` TEXT | ✅ | — |
| 15 | **학부모 정보 (이름·관계·전화·이메일)** | 🔗 `amb_acm_std_parent` + `amb_acm_std_student_parent` | 🔗 | **입력 필수 — 응용 레벨 enforcement 필요** (§6.3) |

### 5.3 ③ 수강 종료 목록·상세

| # | 요구 필드 | 현 컬럼 | 상태 | 비고 |
|---|-----------|---------|:---:|------|
| 1 | 이름 | `std_name` | ✅ | — |
| 2 | 수업 시작일 | `std_start_date` | ✅ | — |
| 3 | **수업 종료일** | (없음) | ❌ | **`std_end_date` DATE 신규 추가** |
| 4 | 성별·연락처·생년월일·학교·학년·거주지·MAP | (위 동일) | ✅ | — |
| 5 | 담당 강사 | `std_teacher` | ⚠️ | — |
| 6 | 커리큘럼·수업교재 | `std_curriculum`·`std_materials` | ✅ | — |
| 7 | **종료 상태** | (없음 — `std_status='WITHDRAWN'` 만) | ❌ | **`std_end_reason` enum 신규 추가** (완료·중도퇴원·이전·휴학·기타) |

### 5.4 종합 갭 요약

| 갭 | 현 상태 | 조치 |
|----|---------|------|
| G1 | `std_end_date` 부재 | ✦ ALTER ADD `std_end_date DATE` (NULL 허용) |
| G2 | `std_end_reason` 부재 | ✦ ALTER ADD `std_end_reason VARCHAR(30) CHECK(...)` (NULL 허용) |
| G3 | `std_end_note` 부재 (사유 메모) | ✦ ALTER ADD `std_end_note TEXT` (NULL 허용) — 권고 |
| G4 | 담당 강사 = free-text | ✦ ALTER ADD `std_teacher_id UUID` FK → `amb_acm_tch_teacher`. 기존 `std_teacher` 는 폐기 예정 컬럼으로 유지(하위호환), 향후 마이그레이션 |
| G5 | 학부모 입력 필수 enforcement 없음 | ✦ 응용·DTO·UI 강제 (§6.3) |
| G6 | (선택) `std_seq_no` 행 번호 | ✗ 비권고 — `ROW_NUMBER()` 파생으로 충분 |

---

## 6. 기능 요구사항 (Functional Requirements)

### 6.1 STD-SCH — 스키마 확장

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STD-SCH-1 | `amb_acm_std_student` 에 `std_end_date DATE` 컬럼을 NULL 허용으로 추가. `std_status IN ('INACTIVE','WITHDRAWN')` 이면 채워야 한다(응용 검증) | P0 |
| FR-STD-SCH-2 | `std_end_reason VARCHAR(30)` CHECK enum 추가. 값: `COMPLETED`(정상수료) · `MID_TERM_DROP`(중도퇴원) · `TRANSFERRED`(타원이전) · `ACADEMIC_BREAK`(휴학) · `RELOCATION`(이주) · `OTHER` | P0 |
| FR-STD-SCH-3 | `std_end_note TEXT` 사유 메모 컬럼 추가 (`std_end_reason='OTHER'` 시 필수, 그 외 선택) | P1 |
| FR-STD-SCH-4 | `std_teacher_id UUID` 컬럼 추가 + FK → `amb_acm_tch_teacher(tch_id)` (`ON DELETE SET NULL`). 기존 `std_teacher`(VARCHAR) 는 deprecated 로 유지 — 응용 레벨에서 점진 마이그레이션 | P0 |
| FR-STD-SCH-5 | 조회 인덱스 `idx_acm_std_ent_end_date ON amb_acm_std_student(ent_id, std_end_date) WHERE deleted_at IS NULL AND std_end_date IS NOT NULL` | P1 |
| FR-STD-SCH-6 | 모든 ALTER 는 멱등(`ADD COLUMN IF NOT EXISTS`) — 기존 데이터 영향 없음 | P0 |

### 6.2 STD-STAT — 종료 상태 라이프사이클

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STD-STAT-1 | 학생 상태 전이 — `ACTIVE → INACTIVE` (휴학) 또는 `ACTIVE → WITHDRAWN`(퇴원·완료). 이때 `std_end_date` + `std_end_reason` 필수 입력(응용 검증) | P0 |
| FR-STD-STAT-2 | `WITHDRAWN` 행은 ③ 종료 뷰에서 노출, `ACTIVE` 행은 ① 수강중 뷰에서 노출. `std_status` 기반 필터 | P0 |
| FR-STD-STAT-3 | 재등록(WITHDRAWN → ACTIVE) 시 `std_end_date`·`std_end_reason`·`std_end_note` 초기화, 변경 이력은 audit 로그(별도 작업) | P1 |

### 6.3 STD-PAR — 학부모 정보 입력 필수 enforcement

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STD-PAR-1 | 학생 생성 API(`POST /api/std/students`)는 **`parents: [{name, relation, phone, email?, isPrimary?}, ...]` 배열을 필수**로 받는다. 최소 1명. `name`·`relation`·`phone` 필수 | P0 |
| FR-STD-PAR-2 | 학생 신규 등록 폼 UI(`/admin/std/new`)는 학부모 섹션을 1행 펼친 채 노출 + "+ 학부모 추가" 버튼으로 다중 입력 허용 | P0 |
| FR-STD-PAR-3 | 백엔드 단일 트랜잭션 — 학생 INSERT + 학부모 매칭(REQ-260511 §D7: ent_id+name+phone 동일하면 재사용, 없으면 신규 par_id 생성) + `amb_acm_std_student_parent` 매핑. 트랜잭션 실패 시 모두 롤백 | P0 |
| FR-STD-PAR-4 | 최초 학부모는 `sp_is_primary=TRUE` 기본. 다수 입력 시 UI 에서 1명을 primary 로 선택 (학생당 정확히 1명 primary — partial unique index 이미 존재) | P0 |
| FR-STD-PAR-5 | 학생 상세 화면(`/admin/std/[id]`)에 학부모 섹션 — 학부모 목록·추가·해제·primary 토글 (REQ-260511 §FR 와 동일) | P0 |
| FR-STD-PAR-6 | 학생 수정 시 학부모 정보 변경은 학부모 엔티티 자체 수정(이름·전화·이메일) 또는 매핑 변경(연결·해제). 학생 row 자체는 수정 안 함 | P0 |
| FR-STD-PAR-7 | CSL → STD 전환(REQ-260525 §7) 경로에서도 학부모 정보 필수 enforcement 동일 — CSL inquiry 의 `inq_parent_name_*` + `inq_phone_*` 을 자동 prefill | P1 |

### 6.4 STD-TCH — 담당 강사 FK 정규화

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STD-TCH-1 | 학생 폼의 "담당 강사" 셀렉터에서 활성(`tch_status='ACTIVE'`) 교사를 검색·선택 — 선택 시 `std_teacher_id` 저장 | P0 |
| FR-STD-TCH-2 | 기존 `std_teacher`(free-text) 가 있고 `std_teacher_id` 가 NULL 인 row 는 어드민에 "강사 매칭 필요" 배지로 노출 (백필 가이드) | P1 |
| FR-STD-TCH-3 | 강사 비활성화 시 연결된 학생은 자동 해제하지 않고 어드민 알림만 (`ON DELETE SET NULL` 은 강사 삭제 시에만 동작) | P1 |

### 6.5 STD-VIEW — 3 뷰 API·필터

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-STD-VIEW-1 | `GET /api/std/students?status=ACTIVE` — 수강중 목록 (① 뷰) | P0 |
| FR-STD-VIEW-2 | `GET /api/std/students?status=INACTIVE,WITHDRAWN` — 종료 목록 (③ 뷰), 응답에 `std_end_date`·`std_end_reason` 포함 | P0 |
| FR-STD-VIEW-3 | 응답은 학부모 primary 1명을 join 하여 `parents[0]` 으로 포함 (목록 화면 표시용) | P1 |
| FR-STD-VIEW-4 | 목록 정렬 기본 — 수강중: `std_start_date DESC, std_name`. 종료: `std_end_date DESC, std_name` | P1 |

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | 멀티테넌시 | 모든 변경 컬럼/인덱스에 `ent_id` 격리 유지 |
| NFR-2 | 하위호환 | `ADD COLUMN IF NOT EXISTS` 멱등. 기존 row 는 모두 NULL 으로 살아 있음. `std_teacher`(VARCHAR) 컬럼 즉시 삭제 금지 |
| NFR-3 | 검증 위치 | 종료 라이프사이클 검증(시작일 ≤ 종료일, 종료시 사유 필수)은 **응용 계층** (DTO/Service). DB CHECK 는 enum 값만 |
| NFR-4 | 트랜잭션 | 학생+학부모+매핑 INSERT 는 단일 트랜잭션. 부분 실패 금지 |
| NFR-5 | PII | 학부모 신규 컬럼 추가 없음(기존 평문 유지). 별도 작업에서 암호화 전환 검토 |
| NFR-6 | i18n | 종료 상태 enum 표시명 4 로케일 — `std.end_reason.{COMPLETED,...}.json` 키 추가 |
| NFR-7 | 인덱스 | `std_end_date` 부분 인덱스로 종료 뷰 페이지네이션 < 200ms (10K rows 기준) |

---

## 8. 데이터 모델 — ALTER TABLE 제안

마이그레이션 권장 번호: 현 sql/acm 최대 `930-acm-cal-event-source-instant.sql` 이후
**`sql/acm/940-acm-std-student-extension.sql`**.

```sql
-- ============================================================================
-- 940 — ACM STD Student fields extension (REQ-260621)
-- · std_end_date / std_end_reason / std_end_note   — 종료 라이프사이클
-- · std_teacher_id                                  — 담당 강사 FK 정규화
-- 멱등(IF NOT EXISTS). 기존 데이터 영향 없음.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A1. 종료 라이프사이클 컬럼
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_end_date   DATE,
  ADD COLUMN IF NOT EXISTS std_end_reason VARCHAR(30),
  ADD COLUMN IF NOT EXISTS std_end_note   TEXT;

-- enum 값 CHECK 제약 — 멱등 패턴
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_acm_std_end_reason'
  ) THEN
    ALTER TABLE amb_acm_std_student
      ADD CONSTRAINT chk_acm_std_end_reason
      CHECK (
        std_end_reason IS NULL
        OR std_end_reason IN (
            'COMPLETED',        -- 정상수료
            'MID_TERM_DROP',    -- 중도퇴원
            'TRANSFERRED',      -- 타원이전
            'ACADEMIC_BREAK',   -- 휴학
            'RELOCATION',       -- 이주
            'OTHER'             -- 기타 (std_end_note 권장)
        )
      );
  END IF;
END $$;

-- 종료 뷰 인덱스 (부분 인덱스 — WITHDRAWN/INACTIVE 만)
CREATE INDEX IF NOT EXISTS idx_acm_std_ent_end_date
  ON amb_acm_std_student (ent_id, std_end_date DESC, std_name)
  WHERE deleted_at IS NULL AND std_end_date IS NOT NULL;

COMMENT ON COLUMN amb_acm_std_student.std_end_date
  IS '수강 종료일 (std_status IN (INACTIVE, WITHDRAWN) 일 때 필수 — 응용 검증)';
COMMENT ON COLUMN amb_acm_std_student.std_end_reason
  IS '종료 사유 코드 (COMPLETED|MID_TERM_DROP|TRANSFERRED|ACADEMIC_BREAK|RELOCATION|OTHER)';
COMMENT ON COLUMN amb_acm_std_student.std_end_note
  IS '종료 사유 메모 (std_end_reason=OTHER 일 때 필수 — 응용 검증)';


-- ----------------------------------------------------------------------------
-- A2. 담당 강사 FK 정규화
--     기존 std_teacher (VARCHAR) 컬럼은 deprecated 로 보존 — 즉시 삭제 금지.
--     데이터 백필은 별도 운영 task.
-- ----------------------------------------------------------------------------
ALTER TABLE amb_acm_std_student
  ADD COLUMN IF NOT EXISTS std_teacher_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_acm_std_teacher_id'
  ) THEN
    ALTER TABLE amb_acm_std_student
      ADD CONSTRAINT fk_acm_std_teacher_id
      FOREIGN KEY (std_teacher_id)
      REFERENCES amb_acm_tch_teacher(tch_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acm_std_ent_teacher
  ON amb_acm_std_student (ent_id, std_teacher_id)
  WHERE deleted_at IS NULL AND std_teacher_id IS NOT NULL;

COMMENT ON COLUMN amb_acm_std_student.std_teacher_id
  IS '담당 강사 FK → amb_acm_tch_teacher.tch_id (REQ-260506 FR-TCH-5). 기존 std_teacher(VARCHAR)는 deprecated.';
COMMENT ON COLUMN amb_acm_std_student.std_teacher
  IS '[DEPRECATED] 자유 텍스트 강사명. std_teacher_id 로 점진 마이그레이션 후 제거 예정.';

-- ============================================================================
-- End of 940
-- ============================================================================
```

### 8.1 갱신 후 `amb_acm_std_student` 컬럼 요약

| 카테고리 | 컬럼 | 비고 |
|----------|------|------|
| 식별 | `std_id`, `ent_id` | PK + 테넌트 |
| 기본 인적 | `std_name`*, `std_english_name`, `std_gender`, `std_birth_date`, `std_phone`, `std_email`, `std_residence` | * = NOT NULL |
| 학교 | `std_school`, `std_grade` |  |
| MAP | `std_map_reading`, `std_map_math`, `std_map_language`, `std_map_note` |  |
| 수업 | `std_subject`, `std_curriculum`, `std_materials`, `std_schedule_json`, `std_mobility` |  |
| **담당 강사** | **`std_teacher_id`** FK | 신규 (G4) |
| 강사 (deprecated) | `std_teacher` VARCHAR | 하위호환만 |
| 메모 | `std_special_note`, `std_goals_note`, `std_ssat_isee_note`, `std_satisfaction_note`, `std_gpa`, `std_last_counsel_date` |  |
| 라이프사이클 | `std_start_date`, **`std_end_date`** ⭐, `std_status`, **`std_end_reason`** ⭐, **`std_end_note`** ⭐ | ⭐ = 신규 (G1·G2·G3) |
| Audit | `created_at`, `updated_at`, `deleted_at` |  |

### 8.2 학부모 정보 관계 (변경 없음)

```
amb_acm_std_student      ──N:M──     amb_acm_std_parent
  std_id                              par_id
                ▲                       ▲
                │                       │
                └── amb_acm_std_student_parent
                      sp_id · std_id · par_id · sp_is_primary
                      UNIQUE(std_id, par_id)
                      PARTIAL UNIQUE(std_id) WHERE sp_is_primary=TRUE
```

학부모 입력은 별도 엔티티에 저장되므로 **본 마이그레이션 940 은 학생 테이블만 변경**한다.
학부모 필수 입력 보장은 §6.3 응용 계층 책임.

---

## 9. 학부모 입력 폼 권고 (UI/UX)

학생 신규 등록 모달(`/admin/std/new`) 의 학부모 섹션 권고 레이아웃:

```
┌──────────── 신규 학생 등록 ────────────────────────┐
│ ▼ 학생 정보                                         │
│   이름* [        ] 성별 [▾] 생년월일 [          ]   │
│   학교  [        ] 학년 [▾] 거주지 [             ]  │
│   연락처 [        ] 이메일 [                       ] │
│   …                                                 │
│ ▼ 수업 정보                                         │
│   수업 시작일* [        ]                           │
│   담당 강사* [강사 검색 ▾]    수업 [▾]              │
│   커리큘럼 [                    ]                   │
│   수업교재 [                    ] 스케줄 [편집]      │
│   특이사항 [                                      ] │
│ ▼ 학부모 정보 (* 필수)                              │
│   ◉ 학부모 #1 [주 보호자]                           │
│      이름*  [           ]  관계* [어머니 ▾]         │
│      전화*  [           ]  이메일 [             ]   │
│   [ + 학부모 추가 ]                                 │
│                                                     │
│                            [ 취소 ] [ 등록 ]        │
└─────────────────────────────────────────────────────┘
```

- "▼ 학부모 정보" 섹션은 **펼쳐진 채로 기본 노출** (접힘 금지).
- 학부모 ≥1 명 + 이름·관계·전화 입력 전에는 [등록] 버튼 비활성화 (FR-STD-PAR-1).
- 동일 (이름+전화) 학부모가 이미 존재 → "기존 학부모 사용하시겠어요?" 추천 (REQ-260511 §D7).

---

## 10. 인수 기준 (Acceptance Criteria)

- **AC-SCH-1**: 940 마이그레이션 실행 후 `\d amb_acm_std_student` 에 `std_end_date`·`std_end_reason`·`std_end_note`·`std_teacher_id` 4 컬럼이 추가되고, 기존 row 의 새 컬럼은 모두 NULL.
- **AC-SCH-2**: `std_end_reason` 에 enum 외 값 INSERT 시 CHECK 위반 23514.
- **AC-SCH-3**: `std_teacher_id` 에 존재하지 않는 `tch_id` INSERT 시 FK 위반 23503.
- **AC-STAT-1**: 학생 상태를 `WITHDRAWN` 으로 전환할 때 `std_end_date` 미입력 → API 400 (검증 메시지: `END_DATE_REQUIRED`).
- **AC-STAT-2**: `std_end_reason='OTHER'` 인데 `std_end_note` 누락 → API 400 (`END_NOTE_REQUIRED`).
- **AC-PAR-1**: `POST /api/std/students` 에 `parents` 배열 없음/빈 배열 → 400 (`PARENTS_REQUIRED_MIN_1`).
- **AC-PAR-2**: 학생 INSERT 와 매핑 INSERT 가 단일 트랜잭션 — 매핑 실패 시 학생 row 도 롤백.
- **AC-PAR-3**: 동일 ent_id 내 (par_name=A, par_phone=B) 학부모 존재 시 신규 par_id 생성 없이 기존 재사용 + 새 매핑 행만 추가.
- **AC-PAR-4**: 학생당 `sp_is_primary=TRUE` 가 정확히 1명 (partial unique index 가 강제).
- **AC-TCH-1**: 강사 셀렉터 검색에서 `tch_status='INACTIVE'` 인 강사는 노출 X.
- **AC-VIEW-1**: `/admin/std?status=ACTIVE` 목록에 종료 학생 미노출. `/admin/std?status=WITHDRAWN` 목록은 `std_end_date` 컬럼이 노출되고 값이 채워져 있다.

---

## 11. 리스크 / 가정 (Risks & Assumptions)

| # | 항목 | 완화 |
|---|------|------|
| R-1 | `std_teacher` 기존 free-text 데이터의 강사 매핑 백필 | 신규 row 부터 `std_teacher_id` 적용, 기존은 어드민 수동 매핑 + "매핑 필요" 배지 |
| R-2 | 종료 enum 값이 학원 실제 운영과 다를 수 있음 | 5종 + OTHER 로 시작, 실사용 피드백 후 추가/수정 |
| R-3 | 학부모 필수화로 기존 학부모 미연결 학생 등록 워크플로 변화 | 기존 row 는 영향 없음(NULL 허용). 신규 INSERT 에만 enforcement |
| R-4 | `std_phone`/`par_phone`/`par_email` 평문 PII | 별도 PII 정비 작업으로 분리 (REQ-260525 §9 Q10) |
| R-5 | `std_teacher` deprecated 컬럼 잔존 | 응용 코드에서 점진 deprecate. 1~2 sprint 후 삭제 마이그레이션 별도 |
| R-6 | REQ-260511 §D7 학부모 매칭이 코드에 미반영 시 중복 par_id 생성 | FR-STD-PAR-3 트랜잭션에서 매칭 로직 구현 필수 — 작업계획서에 task 분리 |

---

## 12. 의존성 (Dependencies)

### 12.1 선행
- `600-acm-std-students.sql` — 본 테이블 존재 전제.
- `840-acm-cal-invitee-and-std-contact.sql` — `amb_acm_std_parent`, `amb_acm_std_student_parent` 존재 전제.
- `800-acm-tch-teacher.sql` + `830-acm-tch-extend.sql` — `amb_acm_tch_teacher.tch_id` FK 대상.

### 12.2 후속
- REQ-260511 §D7 학부모 매칭 로직 구현 (FR-STD-PAR-3) — 본 REQ 의 학부모 필수화의 핵심.
- `std_teacher` (VARCHAR) deprecated → 실제 DROP 마이그레이션 (1~2 sprint 후).
- PII 암호화 정비 (별도 작업).
- REQ-260525-csl-parent-ama-registration 의 CSL→STD 전환에서 본 학부모 필수 enforcement 재사용 (FR-STD-PAR-7).

---

## 13. 미결사항 (Open Questions)

| Q | 주제 | 확인 대상 |
|---|------|-----------|
| Q1 | 종료 enum 5종이 학원 실제 운영 분류와 일치하는가 (졸업/수료/방학 등 추가?) | 학원 운영 담당 |
| Q2 | `std_end_date` 가 `std_start_date` 보다 과거여도 허용할지 (역행 입력 케이스) | 운영 |
| Q3 | "종료" 상태 학생을 ① 수강중 목록에 토글로 함께 보여줄 옵션 필요? | 운영 |
| Q4 | 학부모 ≥ 2명일 때 primary 외 학부모도 "필수" 인가, 선택인가 | 운영 (현 권고: 최소 1명 필수, 추가는 선택) |
| Q5 | `std_teacher` deprecated 백필 — 일괄 자동 매칭(이름 동일) 시도할지, 100% 수동인지 | 운영 |
| Q6 | "No." 표시 번호의 정렬 기준 — 등록순(`std_start_date ASC`)인지 최신순인지 | 운영 |
| Q7 | 학생 PII 암호화 전환을 본 작업과 함께 진행할지 (Q10 REQ-260525 와 연계) | 자사 보안 |

---

## 14. 변경 이력 (Change Log)

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-06-21 | Claude | 초안 — 3 뷰(수강중/신규등록/종료) 필드 매핑 + 갭 3종(`std_end_date`·`std_end_reason`·`std_teacher_id`) ALTER TABLE 940 제안 + 학부모 입력 필수 enforcement(FR-STD-PAR-1~7) + AC 11종 + 미결 7건 |
