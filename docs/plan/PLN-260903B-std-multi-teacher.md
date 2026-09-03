---
document_id: STD-PLN-260903B
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903B-std-multi-teacher.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료 — 로컬 e2e(복수 저장·왕복·400 검증·목록 배치·포털 EXISTS·전체 해제) 통과, acm-std 기존 spec 8건 통과
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903B — 학생 담당강사 복수선택 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 학생 등록/수정 모달 — 담당강사 필드 (단일 select → 검색형 다중선택)

```
│ 담당강사                                                    │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [김영어 ×] [이수학 ×]                                  │  │
│ │ 강사 검색…                                       🔍   │  │
│ │  ├ 박과학  park@…                              [+]   │  │
│ │  └ 최국어  choi@…                              [+]   │  │
│ └────────────────────────────────────────────────────┘  │
│  (최대 5명 · 첫 번째가 대표 강사)                             │
```

### 1.2 학생 상세 — 수업 정보 / 목록 테이블

```
수업 정보                          │  학생 목록 테이블 (담당강사 열)
담당강사   김영어, 이수학            │  김영어 외 1명   ← 2명 이상 시
```

## 2. Backend

| # | 항목 | 내용 |
|---|------|------|
| B1 | DDL `sql/acm/1007-acm-std-student-teacher.sql` | `amb_acm_std_student_teacher` — `st_id` PK, `ent_id`, `std_id` FK(CASCADE), `tch_id` FK(CASCADE), `st_sort_order` int, timestamps, `uq_acm_std_st_pair UNIQUE(std_id, tch_id)`, 인덱스 `(ent_id, tch_id)`. **백필**: `std_teacher_id IS NOT NULL` 학생 → link INSERT (멱등 ON CONFLICT DO NOTHING) |
| B2 | Entity + sync | `StudentTeacherTypeormEntity`. `StudentService.syncTeachers(entId, stdId, tchIds)` — 전원 `In()` 검증(400 TEACHER_NOT_FOUND), 행 교체, 레거시 미러(`teacherId`=첫번째, `teacher`=이름 콤마조인 100자 절단) |
| B3 | DTO | `stdTeacherIds?: string[]` (`@IsUUID each`, `@ArrayMaxSize(5)`) create/update 추가. 기존 `stdTeacherId` 유지 — `stdTeacherIds` 미제공 시 단일값을 배열로 취급 |
| B4 | 응답 | summary/detail에 `teachers: [{tchId, name}]` — 목록은 페이지 학생 `In(stdIds)` 배치 1쿼리로 하이드레이션 (N+1 금지) |
| B5 | 포털 스코핑 | `portal-teacher-students.service.ts` FK 조건 → `(std_teacher_id = $2 OR EXISTS(SELECT 1 FROM amb_acm_std_student_teacher st WHERE st.std_id = s.std_id AND st.tch_id = $2))`. spec 목 갱신 |

## 3. Frontend (frontend-acm)

| # | 파일 | 내용 |
|---|------|------|
| F1 | `std-form-modal.tsx` | 단일 select 제거 → `TeacherMultiCombo`(cal 모듈, max=5) 재사용. 폼 상태 `TeacherDetail[]`, 제출 시 `stdTeacherIds` 배열. 수정 모드 초기값 = detail.teachers |
| F2 | `std-detail-page.tsx` | 담당강사 = teachers 이름 콤마 표시 (없으면 레거시 teacher fallback) |
| F3 | `std-table.tsx` | 1명 = 이름, 2명 이상 = "첫번째 외 N명" (title 툴팁 전체) |
| F4 | `std/types.ts` | `teachers?: Array<{tchId, name}>` summary/detail 추가 |
| F5 | i18n `std` | `form.teachersHint`("최대 {{max}}명 · 첫 번째가 대표 강사"), `table.teacherMore`("{{name}} 외 {{count}}명") 4 locale |

## 4. Order & Verification (순서·검증)

1. B1 로컬 적용(백필 확인) → B2~B4 → `tsc` + 기존 spec 통과(B5 목 갱신 포함)
2. F1~F5 → `tsc`·build
3. 로컬 e2e: 학생에 강사 2명 저장→재조회(teachers·레거시 미러 확인)→1명 제거→전체 제거. **강사 포털 "내 학생"**: 조인 테이블만으로 연결된 강사 계정으로 목록·상세 접근 확인
4. 회귀: 기존 단일 강사 학생(백필) 표시·수정 정상 확인 → PR

리스크: 포털 스코핑 쿼리 변경(B5) — 기존 FK 경로 병행 유지 + 백필로 이중 안전. 예상 규모: 백엔드 ~6파일 + SQL 1, 프론트 ~5파일.
