---
document_id: REQ-260510-acm-tch-list-and-resume
title: ACM 교사관리 — 목록 항목 확장 및 이력서 파일 업로드
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-10
related:
  - reference/acm-req-001-academy-mgmt-requirements-v3.md
  - docs/analysis/REQ-260506-acm-tch-stf-cal.md
  - sql/acm/800-acm-tch-teacher.sql
  - sql/acm/500-acm-auth.sql
---

# REQ-260510 — ACM 교사관리 (acm-tch) 기능 개선

## 1. Overview (개요)

기존 ACM 교사관리(`/admin/tch`) 모듈은 기본 인적사항(이름·이메일·연락처·담당과목)·계정 연계·상태(ACTIVE/INACTIVE) 만 관리한다. 본 요청은 (1) **운영에 필요한 인사 항목 확장** 과 (2) **강사 이력서 파일 업로드** 기능을 추가한다.

## 2. Goals / Non-Goals (목표 / 비목표)

### Goals
- 교사 목록(list) 화면에 운영자가 한눈에 볼 수 있는 인사 항목 12종 노출.
- 교사 신규/수정 폼에 신규 항목 입력 지원.
- 교사 상세 화면에서 이력서 등 파일을 다중 업로드/삭제/다운로드.
- 사용자 계정 잠금/해제 기능 (로그인 차단까지 포함).
- 재직상태를 **ACTIVE / LEAVE / RESIGNED** 3-state 로 확장.

### Non-Goals
- 직원(stf) 모듈 변경 — 본 작업은 tch 한정. (stf 도 동일 패턴 필요시 별도 티켓)
- 출결번호로부터 자동 출퇴근 집계 — 컬럼만 신설, 출퇴근 시스템 연동은 후속.
- 자격증/계약서 등 메타데이터 — 본 작업은 단순 파일 첨부(파일명 + 크기 + 업로드 시각) 만.
- 이력서 파일 OCR/자동 파싱 — 미고려.

## 3. Constraints / Decisions (제약 / 결정사항)

| # | Topic | Decision |
|---|-------|----------|
| D1 | 강사여부 | `tch_is_instructor` boolean 컬럼 추가 (default true). 비강사(예: 행정겸직 교과 담당)도 tch 테이블에 들어올 수 있음. |
| D2 | 재직상태 | 기존 `tch_status` CHECK 제약을 **ACTIVE / LEAVE / RESIGNED** 로 확장. UI 라벨: 재직중 / 휴직 / 퇴사. |
| D3 | 계정상태 | `amb_acm_user.usr_locked_at TIMESTAMPTZ NULL` 신규. 잠긴 사용자는 로그인 차단(`AcmAuthService.login` 에서 거부). 운영자가 잠금/해제 토글. |
| D4 | 아이디(닉네임) | 신규 컬럼 추가 없이 `usr_email` 의 local-part(`@` 앞부분) 를 표시값으로 사용. |
| D5 | 출결번호 | `tch_attendance_no VARCHAR(50)` 자유 입력. 멀티 테넌트 unique 보장 X (단순 메모 성격). |
| D6 | 이력서 저장 | 로컬 디스크 볼륨 `/app/uploads/tch-resume/{entId}/{tchId}/{fileId}.{ext}` (docker named volume `tac_acm_uploads`). |
| D7 | 이력서 형식 | PDF, JPG, JPEG, PNG. 파일당 최대 10MB. 교사당 다중 업로드 (개수 제한 없음, soft cap 20개). |
| D8 | 고용형태 | `tch_employment_type VARCHAR(20)` CHECK ∈ { `FULL_TIME`, `PART_TIME` } (default `FULL_TIME`). |
| D9 | 입사일자 | `tch_hired_at DATE NULL`. |
| D10 | 권한 | 본 작업의 모든 신규 API 는 기존과 동일하게 `AcmJwtAuthGuard + OwnEntityGuard + RolesGuard(ADMIN)`. 파일 다운로드도 인증 필요. |

## 4. Functional Requirements (기능 요구사항)

### FR-TCH-EX-001 — 목록 화면 컬럼 확장

`/admin/tch` 목록 테이블에 다음 12개 컬럼을 표시한다:

| # | 컬럼 라벨 | 데이터 소스 | 정렬 | 필터 |
|---|----------|------------|-----|------|
| 1 | 이름 | `tch_name` (+ `tch_english_name` 보조) | ✓ | 검색어 매칭 |
| 2 | 강사여부 | `tch_is_instructor` (Y/N 배지) | — | ALL/INSTRUCTOR/NON-INSTRUCTOR |
| 3 | 고용형태 | `tch_employment_type` (정규/시간제) | — | ALL/FT/PT |
| 4 | 아이디(닉네임) | linked `amb_acm_user.usr_email` 의 local-part. 미연계는 `—` | — | — |
| 5 | 생년월일 | `tch_birth_date` (`YYYY-MM-DD`) | — | — |
| 6 | 이메일 | `tch_email` | — | — |
| 7 | 핸드폰번호 | `tch_phone` | — | — |
| 8 | 입사일자 | `tch_hired_at` | ✓ | — |
| 9 | 출결번호 | `tch_attendance_no` | — | — |
| 10 | 최종로그인 | linked user 의 `usr_last_login_at` (없으면 `—`). 상대시간(예: "3일 전") + 툴팁 절대시각 | ✓ | — |
| 11 | 재직상태 | `tch_status` (재직중/휴직/퇴사) 배지 | — | ALL/ACTIVE/LEAVE/RESIGNED (default ACTIVE) |
| 12 | 계정상태 | linked user 의 잠금 여부 (잠김/풀림/—). 미연계는 `—` | — | ALL/UNLOCKED/LOCKED/NO_ACCOUNT |

- 검색창은 기존(이름·이메일) 동작 유지.
- 컬럼이 많아져 가로 스크롤 또는 칼럼 토글 필요 — 본 작업에서는 **가로 스크롤 + sticky 첫 컬럼(이름)** 으로 처리.

### FR-TCH-EX-002 — 신규/수정 폼 항목 추가

`TchFormModal` 에 다음 입력 추가:

- 강사여부 — Toggle (default 강사 ✓)
- 고용형태 — Radio (정규 / 시간제, default 정규)
- 입사일자 — Date input
- 출결번호 — Text input (≤50자)

기존 항목(이름·영문명·이메일·연락처·생년월일·담당과목·메모·재직상태·계정 생성·비밀번호) 은 유지. 재직상태는 기존 ACTIVE/INACTIVE → ACTIVE/LEAVE/RESIGNED 셀렉트로 변경.

### FR-TCH-EX-003 — 교사 상세 화면 (Detail Drawer)

기존엔 행 클릭 시 수정 모달만 열렸음. 본 작업에서 **상세 Drawer (오른쪽 패널)** 신설:

- 좌측: 인적사항 + 계정 정보 (read-only, "수정" 버튼으로 모달 진입)
- 우측 탭 1 — **이력서/첨부파일** (FR-TCH-EX-004)
- 우측 탭 2 — 메모 (기존 `tch_memo` 표시)

> 구현 단순화를 위해 기존 모달 편집 흐름은 유지하되, "행 클릭 → 상세 Drawer" 로 1차 진입을 변경하고, Drawer 내 "수정" 버튼이 모달을 연다.

### FR-TCH-EX-004 — 이력서 파일 업로드/관리

- 다중 파일 업로드 (drag-and-drop + file picker).
- 업로드 시 파일명, 크기, 형식 검증 (PDF/JPG/JPEG/PNG, ≤10MB).
- 첨부 목록 표시: 원본 파일명, 형식 아이콘, 크기, 업로드 시각, 다운로드/삭제 버튼.
- 다운로드는 `Content-Disposition: attachment; filename="..."` 헤더로 원본 파일명 보존.
- 삭제 시 확인 다이얼로그.
- 신규 테이블 `amb_acm_tch_attachment` 사용 (D11 참조).

### FR-TCH-EX-005 — 계정 잠금/해제

- 교사 상세 Drawer 의 계정 정보 영역에 **[잠금]/[해제]** 토글 버튼.
- 잠금 = `usr_locked_at = NOW()`. 해제 = `usr_locked_at = NULL`.
- 잠긴 사용자는 `AcmAuthService.login` 에서 401 + `code=ACCOUNT_LOCKED` 반환.
- API: `PATCH /acm/tch/teachers/:id/account/lock`, `PATCH /acm/tch/teachers/:id/account/unlock`.

### FR-TCH-EX-006 — 재직상태 확장

- `tch_status` CHECK 제약: { `ACTIVE`, `LEAVE`, `RESIGNED` }.
- 기존 `INACTIVE` 데이터는 마이그레이션으로 `RESIGNED` 로 변환 (가정: INACTIVE = 퇴사). 운영자가 사후 보정 가능.
- 목록 기본 필터는 `ACTIVE` (기존 동작 유지).

## 5. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | 성능 | 목록 200건 + 12 컬럼 렌더 < 1.5s (p95). |
| NFR-2 | 파일 업로드 | 10MB 단일 파일 업로드 응답 < 5s (LAN). |
| NFR-3 | 디스크 안전 | 업로드 디렉터리 `0750`, 파일 `0640`. 파일명은 UUID 사용 (사용자 입력 파일명 디스크 저장 X). |
| NFR-4 | 파일명 보존 | 원본 파일명은 DB(`att_original_name`) 에 저장, 다운로드 시 헤더로 노출. |
| NFR-5 | 다국어 | i18n 신규 라벨은 `ko` 우선, `en` fallback. 본 모듈은 ACM 운영자 콘솔이라 `ko` 만 우선. |
| NFR-6 | 보안 | 다운로드 endpoint 도 OwnEntityGuard 적용 — 다른 ent 의 첨부 다운로드 금지. MIME sniffing 방지(`X-Content-Type-Options: nosniff` 기본 적용 중). |
| NFR-7 | 데이터 호환 | 기존 데이터 무손실 마이그레이션. CHECK 제약 변경은 트랜잭션 내 `DROP CHECK + UPDATE 데이터 + ADD CHECK`. |

## 6. Data Model Changes (데이터 모델 변경)

### D11 — 신규 테이블 `amb_acm_tch_attachment`

```sql
CREATE TABLE amb_acm_tch_attachment (
  att_id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id              UUID         NOT NULL,
  tch_id              UUID         NOT NULL REFERENCES amb_acm_tch_teacher(tch_id) ON DELETE CASCADE,
  att_original_name   VARCHAR(255) NOT NULL,
  att_mime            VARCHAR(100) NOT NULL,
  att_size_bytes      BIGINT       NOT NULL,
  att_storage_path    VARCHAR(500) NOT NULL,  -- 상대경로: {entId}/{tchId}/{att_id}.{ext}
  att_kind            VARCHAR(30)  NOT NULL DEFAULT 'RESUME', -- RESUME | CERTIFICATE | OTHER
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by          UUID,                                    -- amb_acm_user.usr_id
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_acm_tch_att_ent_tch ON amb_acm_tch_attachment (ent_id, tch_id) WHERE deleted_at IS NULL;
```

### D12 — `amb_acm_tch_teacher` 컬럼 추가

```sql
ALTER TABLE amb_acm_tch_teacher
  ADD COLUMN tch_is_instructor   BOOLEAN     NOT NULL DEFAULT TRUE,
  ADD COLUMN tch_employment_type VARCHAR(20) NOT NULL DEFAULT 'FULL_TIME'
    CHECK (tch_employment_type IN ('FULL_TIME', 'PART_TIME')),
  ADD COLUMN tch_hired_at        DATE,
  ADD COLUMN tch_attendance_no   VARCHAR(50);

-- status CHECK 제약 확장
UPDATE amb_acm_tch_teacher SET tch_status = 'RESIGNED' WHERE tch_status = 'INACTIVE';
ALTER TABLE amb_acm_tch_teacher DROP CONSTRAINT amb_acm_tch_teacher_tch_status_check;
ALTER TABLE amb_acm_tch_teacher ADD  CONSTRAINT amb_acm_tch_teacher_tch_status_check
  CHECK (tch_status IN ('ACTIVE', 'LEAVE', 'RESIGNED'));
```

### D13 — `amb_acm_user` 컬럼 추가

```sql
ALTER TABLE amb_acm_user
  ADD COLUMN usr_locked_at TIMESTAMPTZ NULL;
```

### D14 — 마이그레이션 파일 위치

- `sql/acm/830-acm-tch-extend.sql` (idempotent, `IF NOT EXISTS` 가드).

## 7. API Changes (API 변경)

| # | Method | Path | 변경 |
|---|--------|------|-----|
| A1 | GET | `/acm/tch/teachers` | 응답에 `isInstructor, employmentType, hiredAt, attendanceNo, accountUsername, accountLastLoginAt, accountLockedAt` 추가 |
| A2 | GET | `/acm/tch/teachers/:id` | 동일 (+ attachments 배열) |
| A3 | POST | `/acm/tch/teachers` | DTO 에 신규 4 필드 추가 (`tchIsInstructor, tchEmploymentType, tchHiredAt, tchAttendanceNo`) |
| A4 | PUT | `/acm/tch/teachers/:id` | 위와 동일 (모두 optional) |
| A5 | GET | `/acm/tch/teachers/:id/attachments` | 신규 — 첨부 목록 |
| A6 | POST | `/acm/tch/teachers/:id/attachments` | 신규 — multipart `file`(필수) + `kind`(optional, default RESUME) |
| A7 | GET | `/acm/tch/teachers/:id/attachments/:attId/download` | 신규 — 파일 스트림, `Content-Disposition: attachment` |
| A8 | DELETE | `/acm/tch/teachers/:id/attachments/:attId` | 신규 — soft delete + 파일 디스크 unlink |
| A9 | PATCH | `/acm/tch/teachers/:id/account/lock` | 신규 — userId 필요 |
| A10 | PATCH | `/acm/tch/teachers/:id/account/unlock` | 신규 — userId 필요 |

응답 포맷은 기존 `{success, data, error}` envelope 유지.

`AcmAuthService.login` 변경: `usr_locked_at IS NOT NULL` 시 401 + `code=ACCOUNT_LOCKED`.

## 8. UI Changes (UI 변경 — 요약)

상세 와이어프레임은 작업 계획서(PLN-260510) 참조.

- 목록 페이지: 12 컬럼 + 가로 스크롤, 필터 영역에 강사여부/고용형태/계정상태 추가.
- 신규/수정 모달: 신규 필드 4개 추가, 재직상태 셀렉트 옵션 변경.
- 상세 Drawer 신규: 인적사항 + 계정 + 첨부 탭.

## 9. Acceptance Criteria (인수 기준)

- AC-1: `/admin/tch` 목록에서 12개 컬럼이 모두 표시되며, 데이터 없는 셀은 `—` 로 노출된다.
- AC-2: 신규 등록 모달에서 강사여부/고용형태/입사일자/출결번호를 입력하고 저장하면 DB 에 정확히 반영된다.
- AC-3: 재직상태 필터에서 LEAVE / RESIGNED 를 선택하면 해당 교사만 노출된다.
- AC-4: 교사 상세 Drawer 에서 PDF 1개와 JPG 1개를 업로드하면 첨부 목록 2건이 표시되고, 다운로드 시 원본 파일명이 보존된다.
- AC-5: 11MB 파일 업로드는 거부 (400 + 메시지). PDF/JPG/PNG 외 형식(예: docx)도 거부.
- AC-6: 다른 ent 의 운영자가 첨부 다운로드 URL 을 호출해도 403 이 반환된다.
- AC-7: 운영자가 [잠금] 토글 후, 해당 교사 계정으로 로그인 시 401 `ACCOUNT_LOCKED` 반환. [해제] 후 정상 로그인 가능.
- AC-8: 마이그레이션 후 기존 ACTIVE 교사는 그대로 ACTIVE, INACTIVE 교사는 RESIGNED 로 표시된다.
- AC-9: 첨부 다운로드/업로드/삭제 모두 ADMIN 권한 필요 (RolesGuard).
- AC-10: 교사 soft-delete 시 첨부 row 는 cascade soft-delete 되지 않으며(FK는 ON DELETE CASCADE 지만 hard-delete 안함), 디스크 파일은 보존된다 (별도 정리 잡 — 본 작업 범위 밖).

## 10. Risks (리스크)

| R | 설명 | 완화 |
|---|------|------|
| R1 | 디스크 볼륨 백업 누락 | docker compose volume `tac_acm_uploads` 정의 + staging 운영 가이드에 백업 추가 안내. |
| R2 | 컬럼 12개로 인한 가로 스크롤 UX 저하 | sticky first-column + 컬럼 폭 최적화. 후속으로 컬럼 토글 도입 검토. |
| R3 | INACTIVE → RESIGNED 자동 변환의 의미적 오류 | 마이그레이션 직전 staging 데이터 확인. 필요 시 수동 SQL 보정 안내. |
| R4 | 잠금 기능이 admin 본인 계정에 적용될 위험 | UI 에서 `currentUser.id === teacher.userId` 인 경우 잠금 버튼 비활성화. |
| R5 | 로컬 디스크 → 다중 인스턴스 시 분기 | 현재 단일 backend 인스턴스(staging/prod 동일). 멀티 인스턴스 전환 시 S3 마이그레이션 필요 (후속). |

## 11. Open Questions

(현 시점 모두 결정 — Section 3 참조)

## 12. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-10 | Copilot | Initial draft |
