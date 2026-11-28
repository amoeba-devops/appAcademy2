---
document_id: PLN-261128D-INT
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-28 v1.1.0 — 사용자 확인("진행"), 구현. site 필터는 DB 허용 값(TPI·TRINITY·SANTACROCE)으로 제한, 새 키 발급 기본 권한에서 학생 조회 제외
  - 2026-11-28 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261128D External API · student list (외부 연동 API 학생 목록 조회)

Related: [REQ-261128D-INT](../analysis/REQ-261128D-scheduler-students-api.md)

## 1. Screen / Contract Layout (화면·계약 구성안)
```
① /admin/config/api — API 사용 설정 탭
 외부 API 사용 [ON]
 허용할 API  ☑ 강사 조회  ☑ 일정 조회  ☑ 일정 쓰기  ☐ 학생 조회   ← 추가 (기존 테넌트 기본 OFF)
 ⓘ 학생 조회를 켜면 재원 학생의 이름·영문 이름·사이트·학년·배정 강사가 외부 앱으로 전달됩니다.

② 키 발급 — 권한 체크박스에 [학생 조회] 추가

③ 외부 오픈 API 탭 — "학생 목록 / Students" 항목 (카탈로그에서 자동 생성)
 GET /students   scope students:read
 query: limit, cursor, teacherId, site

 {"success":true,"data":[{
   "id":"3333…","name":"홍학생","englishName":"Gildong Hong",
   "site":"TPI","grade":"G7","status":"ACTIVE","admissionDate":"2026-03-02",
   "teachers":[{"teacherId":"1111…","name":"김강사","primary":true}]
 }],"meta":{"limit":100,"nextCursor":null}}
```

## 2. Backend
| Task | Detail |
|------|--------|
| B-1 | `SCOPES`에 `students:read`를 넣는다. `ArrayMaxSize`를 4로 올린다 |
| B-2 | `entitlement()`: 권한별 메뉴를 매핑한다. `students:read`→`std`, `teachers:read`→`tch`, `lessons:*`→`cal` |
| B-3 | `StudentQueryDto extends PageDto`: `teacherId?`(UUID), `site?`(`TPI`·`TRINITY`·`SANTACROCE`) |
| B-4 | `SchedulerService.students()` 쿼리 조건: `ent_id`, `deleted_at IS NULL`, `std_status='ACTIVE'`, 강사·사이트 필터. 정렬은 `std_id`, 페이지는 cursor 방식. 강사는 `jsonb_agg ORDER BY st_sort_order`로 묶고 삭제된 강사는 뺀다 |
| B-5 | `SchedulerApiController` `GET students`, `@SetMetadata('integrationScope','students:read')` |
| B-6 | 카탈로그에 항목·필드·응답 예시·`Student` 스키마를 추가한다. OpenAPI 1.2.0 |
| B-7 | 통합 테스트(`it-scheduler-api`): 권한 없음 403, ACTIVE만 반환, 강사 순서와 primary, 강사·사이트 필터, 다른 테넌트 격리, 페이지 |
| B-8 | DB 마이그레이션은 없다. `int_scopes`가 JSONB라서 그대로 저장된다 |

## 3. Frontend (`frontend-acm`)
| Task | Detail |
|------|--------|
| F-1 | `types/scheduler-api.ts`의 `ApiScope`와 `API_SCOPES`에 `students:read`를 넣는다 |
| F-2 | 사용 설정 탭에 개인정보 안내 문구를 넣는다(① ⓘ) |
| F-3 | i18n 4개 언어: 권한 이름 `students:read`(학생 조회 / Read students / Xem học sinh / 查询学生)와 안내 문구 |

## 4. Test & Deploy (검증·배포)
- 검증: backend jest, 통합 테스트(로컬·CI), frontend tsc·build.
- 배포 후 확인:
  - OpenAPI가 1.2.0이고 `/students`가 있는지
  - 키 없이 호출하면 401이 나오는지
  - 오류 로그 0
- 운영에서 쓰려면 테넌트 마스터가 다음을 해야 한다. 이 작업은 사용자 몫이다.
  1. API 사용 설정에서 [학생 조회]를 켠다.
  2. 연동 앱 키를 `students:read`가 들어간 새 키로 발급한다.
