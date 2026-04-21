---
document_id: STUDENT-IMPORT-TASK-1.0.0
version: 1.0.0
status: APPROVED
date: 2026-04-22
author: Claude Code (pair with @gray.kim)
change_log:
  - "1.0.0 (2026-04-22): Initial approved plan for full Excel import of 24 TPI students with schema augmentation (Plan B)."
---

# TPI Student Full Import Task (TPI 학생 전수 임포트 작업)

## 1. Overview (개요)

Import all 24 currently enrolled students from
`docs/reference/TPI 학생 정보.xlsx` — sheet `현재 등록 학생` — into
the Trinity Academy database **without losing any column value**, by
augmenting the student/enrollment schema where necessary.

엑셀 첫 시트의 15개 항목을 모두 손실 없이 DB 에 적재하기 위해
학생/수강신청 테이블에 컬럼을 보강한 뒤 24명을 일괄 임포트한다.

## 2. Requirements (요구사항)

| ID | Requirement |
|----|-------------|
| R-1 | All 15 Excel columns must be preserved — no field discarded |
| R-2 | Group label `Santa Croce` (row 22) must be retained on rows 23–31 |
| R-3 | `tac_students.prt_id NOT NULL` constraint must not be violated (no parent data in source) |
| R-4 | Placeholder parent must be easily replaceable when real guardian data arrives |
| R-5 | Column additions must follow Amoeba Code Convention v2 (`std_`/`enr_` prefix) |
| R-6 | Migration must include a DOWN path (rollback-safe) |

## 3. Approved Answers (확정 사항)

| Q | Answer |
|---|--------|
| Q-A | Academy tenant = the `Trinity Academy` row created by `seed-dev.sql` (looked up by `acd_business_registration_no='123-45-67890'`) |
| Q-B | Students without start date (장연우 `Jamy`, 장연서 `Janie`) — student row only, **no enrollment row** |
| Q-C | Gender NULL allowed (박지온) |
| Q-D | Single shared placeholder parent `[MIGRATED] Unknown Guardian` per academy |
| Q-E | `tac_map_scores` rows are **not** created (all Excel MAP values are empty) |

## 4. Schema Augmentation (스키마 보강)

### 4.1 `tac_students`

| Column | Type | Purpose |
|--------|------|---------|
| `std_english_name` | `VARCHAR(100) NULL` | English nickname parsed from `'장연우(Jamy)'` |
| `std_residence` | `VARCHAR(200) NULL` | 거주지 (e.g. `'보스턴, 메사추세츠'`) |
| `std_cohort_label` | `VARCHAR(50) NULL` | Cohort tag (e.g. `'Santa Croce'`) |
| `std_curriculum_text` | `TEXT NULL` | Free-form curriculum note (multi-program, unstructured) |
| `std_note` | `TEXT NULL` | 특이사항 |
| `std_phone_encrypted` | `VARBINARY(255) NULL` | Reserved for student-owned phone (NFR-005) |

Added index: `idx_tac_students_acd_cohort (acd_id, std_cohort_label)`.

### 4.2 `tac_enrollments`

| Column | Type | Purpose |
|--------|------|---------|
| `enr_materials` | `JSON NULL` | Per-enrollment textbook assignment |
| `enr_memo` | `TEXT NULL` | Free-form enrollment note |

### 4.3 Rationale — Why TEXT instead of N:M relation for curriculum

Excel values like `'MAP, ISEE, SSAT Reading\nKIS 입학시험 진행중'` mix
program labels with operational notes across newlines. Lossless
structured decomposition is premature. Preserve verbatim in
`std_curriculum_text` now; introduce `tac_student_programs` later
when program catalog is finalized (tracked as future task — not in
this milestone).

## 5. Import Procedure (임포트 절차)

### 5.1 Master prerequisites (선행 마스터)

| Row | Source | Count |
|-----|--------|-------|
| `tac_parents` | 1 placeholder — `[MIGRATED] Unknown Guardian` | 1 |
| `tac_teachers` | `김태윤` (AMA `PENDING-TPI-KTY`), `정성경` (AMA `PENDING-TPI-JSK`), `TBD` (AMA `PENDING-TPI-TBD`) | 3 |
| `tac_programs` | `TPI Reading`, `Santa Croce Reading` | 2 |
| `tac_classrooms` | `Main` | 1 |

### 5.2 Classes (반)

| Class tag | Program | Teacher | Schedule pattern (JSON) | Enrolled students |
|-----------|---------|---------|-------------------------|-------------------|
| `TPI-KTY-GPA` | TPI Reading | 김태윤 | `[]` (unscheduled) | 강병찬 |
| `TPI-JSK-FRI` | TPI Reading | 정성경 | `[{weekday:"FRI",start:"08:30",end:"09:30"}]` | 김민 |
| `TPI-JSK-WED` | TPI Reading | 정성경 | `[{weekday:"WED",start:"08:00",end:"10:00"}]` | 김지환 |
| `TPI-Placeholder` | TPI Reading | TBD | `[]` | 강소율, 구본의, 혜리, 이재인, 정윤아, 정윤지, 김아이비, 이태오, 정하율, 김하음, 이채현, 황채민 (12) |
| `SC-Placeholder` | Santa Croce Reading | TBD | `[]` | 이윤건, 이윤후, 김라희, 박지온, 정수인, 석예준, 석유준 (7) |

### 5.3 Students × Enrollments

| # | Student | Cohort | Start date | Class | Enrollment? |
|---|---------|--------|-----------|-------|-------------|
| 1 | 강병찬 | TPI | 2024-12-02 | TPI-KTY-GPA | ✓ |
| 2 | 강소율 | TPI | 2024-12-02 | TPI-Placeholder | ✓ |
| 3 | 구본의 | TPI | 2025-06-05 | TPI-Placeholder | ✓ |
| 4 | 혜리 | TPI | 2024-12-14 | TPI-Placeholder | ✓ |
| 5 | 이재인 | TPI | 2024-12-23 | TPI-Placeholder | ✓ |
| 6 | 정윤아 | TPI | 2025-05-06 | TPI-Placeholder | ✓ |
| 7 | 정윤지 | TPI | 2025-05-06 | TPI-Placeholder | ✓ |
| 8 | 김민 | TPI | 2025-04-22 | TPI-JSK-FRI | ✓ |
| 9 | 김아이비 | TPI | 2025-08-09 | TPI-Placeholder | ✓ |
| 10 | 이태오 | TPI | 2025-11-04 | TPI-Placeholder | ✓ |
| 11 | 정하율 | TPI | 2025-06-06 | TPI-Placeholder | ✓ |
| 12 | 김지환 | TPI | 2025-06-18 | TPI-JSK-WED | ✓ |
| 13 | 김하음 | TPI | 2025-10-02 | TPI-Placeholder | ✓ |
| 14 | 이채현 | TPI | 2026-04-09 | TPI-Placeholder | ✓ |
| 15 | 황채민 | TPI | 2026-04-13 | TPI-Placeholder | ✓ |
| 16 | 이윤건 | Santa Croce | 2024-12-06 | SC-Placeholder | ✓ |
| 17 | 이윤후 | Santa Croce | 2024-12-06 | SC-Placeholder | ✓ |
| 18 | 김라희 | Santa Croce | 2026-04-05 | SC-Placeholder | ✓ |
| 19 | 박지온 | Santa Croce | 2026-03-02 | SC-Placeholder | ✓ |
| 20 | 정수인 | Santa Croce | 2025-08-25 | SC-Placeholder | ✓ |
| 21 | 장연우 (Jamy) | Santa Croce | — | — | ✗ (student row only) |
| 22 | 장연서 (Janie) | Santa Croce | — | — | ✗ (student row only) |
| 23 | 석예준 | Santa Croce | 2026-02-23 | SC-Placeholder | ✓ |
| 24 | 석유준 | Santa Croce | 2026-02-23 | SC-Placeholder | ✓ |

## 6. Data Normalization Rules (데이터 정규화 규칙)

| Source | Rule |
|--------|------|
| `'장연우(Jamy)'` | `std_name='장연우'`, `std_english_name='Jamy'` |
| `'남'` / `'여'` | `std_gender='M'` / `'F'` |
| `6.0` (grade) | `std_grade='6'` (string) |
| `'202412/14'` | `2024-12-14` (heuristic re-parse) |
| `'금 08:30-09:30'` | `[{"weekday":"FRI","start":"08:30","end":"09:30"}]` |
| Row 22 `'Santa Croce'` | `std_cohort_label='Santa Croce'` propagated to rows 23–31 |
| Row 4–20 (no header) | `std_cohort_label='TPI'` |

## 7. Deliverables (산출물)

| File | Description |
|------|-------------|
| `sql/migration-student-import-1.0.0.sql` | UP/DOWN DDL for §4 augmentation |
| `sql/seed-tpi-students.sql` | Data import (one-shot; assumes clean DB state for student rows) |
| `docs/implementation/tasks/STUDENT-IMPORT-TASK-1.0.0.md` | This document |

## 8. Verification (검증 쿼리)

```sql
-- 24 students total, 17 TPI + 9 Santa Croce, wait that's 26 — actual split 15+9=24
SELECT std_cohort_label, COUNT(*) FROM tac_students
 WHERE acd_id = :acd GROUP BY std_cohort_label;
-- Expected: TPI=15, Santa Croce=9

-- 22 enrollments (24 minus 2 without start date)
SELECT COUNT(*) FROM tac_enrollments WHERE acd_id = :acd;
-- Expected: 22

-- Teacher distribution
SELECT t.tch_ama_client_id, COUNT(*) FROM tac_enrollments e
  JOIN tac_classes c ON c.cls_id = e.cls_id
  JOIN tac_teachers t ON t.tch_id = c.tch_id
 WHERE e.acd_id = :acd GROUP BY t.tch_ama_client_id;
-- Expected: KTY=1, JSK=2, TBD=19
```

## 9. Out of Scope (본 작업 범위 제외)

- Real parent contact collection (future task)
- Admin UI exposure for new columns (future task — attach to
  `/admin/students` screen refresh)
- `tac_student_programs` N:M table (deferred until program catalog
  is ratified)
- Other Excel sheets (`학부모 및 학생 상담`, `수업 종료 학생`, `구 학생 정보`)
