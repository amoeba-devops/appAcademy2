---
document_id: STD-REQ-260903B
version: 1.1.0
status: CONFIRMED (2026-09-03 사용자 확정 "진행" — Q-A 최대 5명 채택)
date: 2026-09-03
change_log:
  - 2026-09-03 v1.1.0 사용자 확정 반영
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# REQ-260903B — 학생 담당강사 복수선택 / Multiple Assigned Teachers per Student

## 1. Overview (개요)

학생 관리(`/admin/std/:id`)의 **담당강사를 복수 선택** 가능하게 한다. 학생↔강사 N:M 연결 테이블을 신설하고, 학생 폼·상세·목록 및 **강사 포털의 "내 학생" 스코핑**을 다중 담당 기준으로 전환한다.

## 2. Current State (현행)

- `amb_acm_std_student.std_teacher_id` (uuid FK, 단일) + `std_teacher` (varchar100 자유텍스트, deprecated 미러) — 조인 테이블 없음.
- 설정: 학생 폼의 단일 `<select>` (`std-form-modal.tsx:283-293`), 서비스에서 FK 검증 후 이름 미러링.
- 소비처 전수조사 결과:
  - **강사 포털 "내 학생"** (`portal-teacher-students.service.ts:70`) — `std_teacher_id = 강사id` OR 반(cls) 소속 경로. **최고 위험 소비처** (전환 누락 시 강사가 학생을 못 봄).
  - 학생 목록 테이블·상세 페이지의 담당강사 표시 (자유텍스트 미러 사용).
  - 목록 API의 teacher ILIKE 필터 — **UI에는 미노출**(사실상 미사용).
  - Excel 임포트 — 자유텍스트만 기록 (FK 미기록, 기존 동작).
  - 그 외 모듈(cls/csl/cal/AMA 등)은 이 컬럼을 읽지 않음 — 영향 없음.
- 재사용 가능: 학부모 N:M `syncForStudent` 패턴, 캘린더의 `TeacherMultiCombo`(검색형 다중선택 칩 UI).

## 3. Requirements (요구사항)

| ID | 요구사항 |
|----|---------|
| FR-1 | 신규 조인 테이블 `amb_acm_std_student_teacher` (학생당 다수 강사, UNIQUE(std_id, tch_id)) + 기존 `std_teacher_id` 값 **백필** |
| FR-2 | 학생 등록/수정 폼: 담당강사 **다중선택**(검색형 콤보+칩, 기존 `TeacherMultiCombo` 재사용). 저장 시 전체 목록 동기화(sync) |
| FR-3 | API: `stdTeacherIds: string[]` (전원 테넌트 검증, 미존재 시 400 TEACHER_NOT_FOUND). 응답 summary/detail에 `teachers: [{tchId, name}]`. 기존 `stdTeacherId` 필드는 하위호환 유지(단일 → 배열 취급) |
| FR-4 | 레거시 컬럼 유지·미러링: `std_teacher_id` = 첫 번째(대표) 강사, `std_teacher` = 이름 콤마 연결(100자 절단) — 기존 화면·임포트·롤백 호환 |
| FR-5 | **강사 포털 "내 학생" 스코핑**: 조인 테이블 EXISTS 로 확장 (기존 FK 경로도 병행 유지 — 백필 전후 안전) |
| FR-6 | 학생 목록 테이블·상세 페이지: 다수 강사 이름 표시 |
| NFR | i18n 4 locale 동시, 목록 조회 시 N+1 없이 배치 로드 |

## 4. Out of Scope (범위 외)

- Excel 임포트의 FK/다중 강사 기록 (현행 자유텍스트 유지)
- 학생 목록의 강사 필터 UI 신설 (현재도 미노출)
- 강사별 역할(주/부) 구분 — 필요 시 후속 (테이블에 확장 여지만 둠)

## 5. Open Question (확인)

- Q-A: 담당강사 최대 선택 수 — **5명 제한** 제안 (UI 칩 표시·미러 컬럼 길이 고려)
