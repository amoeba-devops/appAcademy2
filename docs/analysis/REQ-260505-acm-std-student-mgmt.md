---
document_id: ACM-REQ-STD-001
version: 1.0.0
status: Draft
created: 2026-05-05
author: Copilot (검토: 개발팀)
product_code: ACM
module: STD (Student Management / 학생관리)
parent_requirements: ACM-REQ-001 v3.0.0
change_log:
  - version: 1.0.0
    date: 2026-05-05
    description: 최초 작성 — TPI Master 엑셀 2번째 시트 학생명단 기반 학생관리 모듈
---

# ACM STD — 학생관리 모듈 요구사항 분석서

## 1. 개요 (Overview)

### 1.1 목적
TPI Master 엑셀파일의 학생명단(2번째 시트)을 ACM 시스템으로 디지털화한다.  
엑셀 업로드를 통한 일괄 등록, 개별 학생 CRUD, 목록 조회·검색 기능을 제공한다.

### 1.2 배경
- 현재 학생 정보는 엑셀(TPI Master, TPI 학생 정보.xlsx)로 관리됨
- ACM 시스템에 학생관리 모듈이 없어 상담(CSL), 수업(CLS) 모듈이 학생 참조 불가
- 엑셀 컬럼 구조는 `scripts/build-seed-v2.py` parse_sheet4/parse_sheet2 분석 기반

### 1.3 대상 시스템
- **Frontend**: `acm-stg.amoeba.site` (frontend-acm, Vite/React)
- **Backend**: NestJS `backend/src/modules/acm-std/`
- **DB**: PostgreSQL `db_amb`, 테이블 prefix `amb_acm_std_`

---

## 2. 기능 요구사항 (Functional Requirements)

### FR-STD-001 학생 목록 조회
- 로그인한 관리자의 `ent_id` 기준으로 학생 목록을 표시한다.
- 페이지네이션: 기본 50건/페이지
- 정렬: 이름 오름차순 기본, 등록일 내림차순 선택
- 필터: 상태(ACTIVE/INACTIVE/ALL), 학교, 학년, 담당강사
- 검색: 이름(한국어/영어), 학교 이름 (substring)

### FR-STD-002 학생 상세 조회
- 목록 클릭 시 상세 정보 패널(또는 페이지) 표시
- 표시 필드: 전체 학생 정보 (섹션별 구분)

### FR-STD-003 학생 개별 등록 (Create)
- 폼 기반 단일 학생 등록
- 필수 필드: 이름(한글), 상태
- 선택 필드: 영어이름, 성별, 생년월일, 학교, 학년, 거주지, 연락처, MAP점수, 담당강사, 과목, 교재, 수업일정, GPA, 목표, 특이사항, 등록일

### FR-STD-004 학생 정보 수정 (Update)
- 상세 페이지에서 인라인 편집 또는 편집 폼
- 모든 필드 수정 가능
- 수정 이력(updated_at)만 추적 (별도 history 테이블 없음 — v1.0 범위)

### FR-STD-005 학생 삭제/비활성화 (Delete/Deactivate)
- Soft delete: `deleted_at` 설정 (실제 삭제는 관리자 메뉴에서만)
- 기본 동작: 상태를 INACTIVE로 변경 (비활성화)
- 목록에서 비활성 학생은 별도 토글로 표시/숨김

### FR-STD-006 엑셀 업로드 (Excel Import)
- 파일 형식: `.xlsx` (TPI Master 엑셀 2번째 시트 호환)
- 업로드 후 미리보기 테이블 표시 (파싱 결과 확인)
- 중복 처리: 동일 이름+생년월일 조합 → 기존 레코드 Update (upsert)
- 파싱 오류 행은 오류 표시 후 나머지 유효 행 Import 가능
- Import 완료 후 성공/실패 건수 요약 표시

### FR-STD-007 엑셀 양식 다운로드
- 시스템에서 빈 양식(Template) xlsx 다운로드 가능
- 컬럼 헤더는 TPI Master 엑셀 2번째 시트 형식과 일치

---

## 3. 비기능 요구사항 (Non-Functional Requirements)

| ID | 항목 | 내용 |
|----|------|------|
| NFR-STD-001 | 보안 | 학생 연락처는 암호화 저장 금지 (ACM DB는 PII 레벨 낮음 — 전화번호 plain text, 단 DB접근 제한으로 보호) |
| NFR-STD-002 | 멀티테넌시 | 모든 쿼리에 `ent_id` 필터 적용, OwnEntityGuard 적용 |
| NFR-STD-003 | 성능 | 목록 1,000건 이하 → 단순 쿼리, 인덱스로 충분 |
| NFR-STD-004 | 엑셀 업로드 | 최대 500행, 서버 사이드 파싱 (multer + xlsx 라이브러리) |
| NFR-STD-005 | i18n | 4개 언어(ko/en/vi/zh-CN) 레이블 등록 |

---

## 4. 엑셀 컬럼 매핑 (TPI Master 2번째 시트)

TPI Master 엑셀 2번째 시트(학부모 및 학생 상담)의 컬럼 → ACM STD DB 필드 매핑:

| 열 | 엑셀 헤더 | ACM DB 필드 | 비고 |
|----|----------|------------|------|
| A | 등록일 | std_start_date | DATE |
| B | 번호 | (import 순번, 미저장) | — |
| C | 학생 이름 | std_name, std_english_name | "홍길동(James)" 파싱 |
| D | 성별 | std_gender | 남→M, 여→F |
| E | 이동수단 | std_mobility | VARCHAR |
| F | GPA | std_gpa | VARCHAR |
| G | MAP | std_map_note | MAP 점수 메모 |
| H | SSAT/ISEE | std_ssat_isee_note | VARCHAR |
| I | 담당강사 | std_teacher | VARCHAR |
| J | 수업교재 | std_curriculum | TEXT |
| K | 상담내용 | std_special_note | TEXT |
| L | 목표 | std_goals_note | TEXT |
| M | 만족도 | std_satisfaction_note | VARCHAR |
| N | 최근 상담일 | std_last_counsel_date | DATE |

> **구 학생 정보 시트(Sheet 4)** 추가 컬럼도 지원:
> 전화번호(std_phone), 생년월일(std_birth_date), 학교(std_school), 학년(std_grade), 거주지(std_residence), MAP점수 수치(std_map_reading/math/language), 과목(std_subject), 교재(std_materials), 수업일정 JSON(std_schedule_json)

---

## 5. 데이터 모델 (DB Schema)

```sql
-- amb_acm_std_student
CREATE TABLE IF NOT EXISTS amb_acm_std_student (
  std_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ent_id              UUID NOT NULL,

  -- 기본 인적사항
  std_name            VARCHAR(100) NOT NULL,         -- 한국어 이름
  std_english_name    VARCHAR(100),                  -- 영어 이름
  std_gender          CHAR(1) CHECK (std_gender IN ('M','F')),
  std_birth_date      DATE,
  std_phone           VARCHAR(20),                   -- 연락처 (보호자)
  std_residence       VARCHAR(100),                  -- 거주지

  -- 학교 정보
  std_school          VARCHAR(100),
  std_grade           VARCHAR(20),                   -- G5, G7, 중1 등

  -- MAP 점수
  std_map_reading     SMALLINT,
  std_map_math        SMALLINT,
  std_map_language    SMALLINT,
  std_map_note        TEXT,                          -- 원본 메모 문자열

  -- 수업 정보
  std_teacher         VARCHAR(100),                  -- 담당강사 이름
  std_subject         VARCHAR(100),                  -- 과목
  std_curriculum      TEXT,                          -- 수업교재
  std_materials       TEXT,                          -- 추가 교재
  std_schedule_json   JSONB,                         -- [{weekday, start, end}]
  std_mobility        VARCHAR(50),                   -- 이동수단

  -- 상담/목표
  std_gpa             VARCHAR(20),
  std_ssat_isee_note  TEXT,
  std_special_note    TEXT,
  std_goals_note      TEXT,
  std_satisfaction_note VARCHAR(200),
  std_last_counsel_date DATE,

  -- 상태/등록
  std_start_date      DATE,
  std_status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (std_status IN ('ACTIVE','INACTIVE','WITHDRAWN')),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acm_std_ent
  ON amb_acm_std_student (ent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acm_std_name_trgm
  ON amb_acm_std_student USING GIN (std_name gin_trgm_ops);
```

---

## 6. API 엔드포인트 정의

| Method | Path | 설명 |
|--------|------|------|
| GET | /api/acm/std/students | 목록 조회 (페이지, 필터, 검색) |
| POST | /api/acm/std/students | 개별 등록 |
| GET | /api/acm/std/students/:id | 상세 조회 |
| PUT | /api/acm/std/students/:id | 수정 |
| PATCH | /api/acm/std/students/:id/status | 상태 변경 |
| DELETE | /api/acm/std/students/:id | Soft delete |
| POST | /api/acm/std/students/import | 엑셀 업로드 (multipart) |
| GET | /api/acm/std/students/template | 엑셀 양식 다운로드 |

---

## 7. 인수 기준 (Acceptance Criteria)

| AC-ID | 조건 | 기대 결과 |
|-------|------|-----------|
| AC-001 | 로그인 후 사이드바 "학생관리" 클릭 | 학생 목록 페이지 표시 |
| AC-002 | 빈 상태에서 학생 목록 조회 | "등록된 학생이 없습니다" 안내 |
| AC-003 | 신규 학생 폼 작성 후 저장 | 목록에 즉시 반영 |
| AC-004 | 학생 이름 검색 | 매칭 결과만 필터 |
| AC-005 | xlsx 파일 업로드 (TPI 양식) | 파싱 미리보기 → Import → 성공건수 표시 |
| AC-006 | 중복 이름+생년월일 업로드 | upsert (기존 레코드 갱신) |
| AC-007 | 업로드 오류 행 (필수필드 누락) | 오류 행 표시, 나머지 import 진행 |
| AC-008 | 학생 상세에서 정보 수정 | 변경사항 저장, updated_at 갱신 |
| AC-009 | 학생 비활성화 | 목록에서 기본 숨김, 토글로 표시 |
| AC-010 | 엑셀 양식 다운로드 | TPI 헤더 포함 빈 xlsx 다운로드 |

---

## 8. 범위 외 (Out of Scope — v1.0)

- 학생-수업(CLS) 연동: v1.1에서 std_id FK 추가 예정
- 학생-상담(CSL) 연동: v1.1
- 학생 사진 업로드
- 상담 이력 내 학생 참조
- 학부모 계정 연동
