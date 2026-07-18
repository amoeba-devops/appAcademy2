# FIX-260719 — 포털 수강생관리 진입 시 로그인 리다이렉트 (401)

## 1. Symptom (증상)
강사 포털 로그인 후 `https://acm.amoeba.site/portal/students` 진입 시 목록 대신 **로그인 페이지로 리다이렉트**됨.

## 2. Root Cause (원인)
`frontend-acm/src/lib/api-client.ts` 의 `isPortalEndpoint()` 허용 목록에 신규 경로
**`/portal/teacher/*` 가 누락** → 요청이 포털 JWT 가 아닌 (비어있는) 콘솔 토큰으로 전송
→ 백엔드 401 → 응답 인터셉터가 세션만료로 판단해 로그인으로 리다이렉트.

- 백엔드 스코프 자체는 정상: `PortalTeacherStudentsService` 는 처음부터 **전체 학생이 아닌
  "내 학생"만** 반환 (담당강사 FK ∪ 내 반 소속, 타 학생 조회 시 403).

## 3. Fix (수정)
`isPortalEndpoint()` 에 `url.startsWith('/portal/teacher')` 추가.
> 재발 방지 메모: 포털 신규 API prefix 는 이 함수에 반드시 등록해야 한다
> (등록 누락 = 잘못된 토큰 → 401 리다이렉트).

## 4. 강사–수업–학생 관계 조사 (요청 사항)

```
[강사]  amb_acm_tch_teacher (tch_id ─ 포털 TEACHER 계정의 refId)
   │  ①직접 배정                     │  ②반(수업) 경유
   ▼                                 ▼
[학생] std_teacher_id = tch_id   [수업/반] amb_acm_cls_classes
 (amb_acm_std_student,             cls_teacher_user_id = 강사의 콘솔계정(usr_id)
  /admin/std 폼의 "담당강사")        ↕ tch.tch_user_id 로 강사와 연결
                                   [반-학생] amb_acm_cls_class_students
                                     cst_student_user_id = std_id
                                     (cst_left_at IS NULL = 재적)
```

**수강생관리 목록 = ① ∪ ②** (`PortalTeacherStudentsService.listMyStudents`).

| 경로 | 연결 고리 | 만들어지는 곳 | 주의점 |
|---|---|---|---|
| ① 직접 배정 | `std_teacher_id` → `tch_id` | `/admin/std` 학생 등록/수정의 **담당강사** 필드 | 콘솔 계정 없이도 동작 |
| ② 반 소속 | `cls_teacher_user_id` = 강사의 `tch_user_id`(콘솔 usr_id) → 반 → `cst_student_user_id` | `/admin/classes` 반 담당강사 + 반 학생 등록 | **강사의 `tch_user_id` 가 NULL(콘솔 계정 미연결)이면 이 경로는 매칭 안 됨** |
| (참고) 일정 참석자 | `amb_acm_cal_invitee` | 일정 참석자 추가 | 수강생관리 목록 기준엔 **포함되지 않음** — 상세의 "수업 기록" 조회에만 사용 |

**목록이 비어 보이는 경우 점검 순서**
1. `/admin/std` 에서 해당 학생의 **담당강사**가 로그인 강사로 지정돼 있는가 (①)
2. `/admin/classes` 에서 강사가 담당인 반에 학생이 재적 중인가 + 강사 행의 콘솔계정 연결(`tch_user_id`) 여부 (②)

## 5. Verification (검증)
- fe `tsc` clean, `vite build` clean. 배포 후 강사 로그인 → `/portal/students` 목록 표시 확인 필요.
