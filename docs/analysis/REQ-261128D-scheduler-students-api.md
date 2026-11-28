---
document_id: REQ-261128D-INT
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-28 v1.1.0 — 사용자 확인("진행"), 구현. site 필터는 DB 허용 값(TPI·TRINITY·SANTACROCE)으로 제한, 새 키 발급 기본 권한에서 학생 조회 제외
  - 2026-11-28 v1.0.0 — initial analysis (사용자 확인 대기)
---

# REQ-261128D External API · student list (외부 연동 API 학생 목록 조회)

Related: [REQ-261125 external scheduler](REQ-261125-external-scheduler-api.md), [REQ-261128C](REQ-261128C-scheduler-availability-category.md), [연동 문서](../integration/external-scheduler-api.md)

## 1. Request (요구사항)
외부 연동 API(`/api/integrations/v1`)에 **재원(ACTIVE) 학생 목록 조회**를 추가한다. 응답에는 학생마다 배정 강사를 함께 넣는다.

## 2. Current State (현황)
| Item | Current | Gap |
|------|---------|-----|
| 외부 API | 강사 조회(`teachers:read`), 수업 조회·쓰기(`lessons:*`) | 학생을 조회할 수 없다. 수업을 등록할 때 `studentId`를 알 방법이 없어 이름 일치에만 기댄다 |
| 학생 | `amb_acm_std_student`. 상태는 ACTIVE / INACTIVE / WITHDRAWN. 운영 TPI 테넌트 ACTIVE 58명 | — |
| 배정 강사 | `amb_acm_std_student_teacher`(여러 명, `st_sort_order` 순서). 첫 번째가 대표 강사 | — |
| 권한 | 테넌트 허용 기능 ∩ 앱 상태 ∩ 키 권한 ∩ 메뉴 이용 권한(`tch`/`cal`) | 학생용 권한이 없다 |
| 수업 등록의 학생 매칭 | `deleted_at IS NULL AND std_status='ACTIVE'` | 목록 조회도 같은 조건을 쓰면 된다 |

## 3. Requirements (요구사항 정의)
| ID | Requirement |
|----|-------------|
| FR-1 | `GET /api/integrations/v1/students`: 재원(ACTIVE)이고 삭제되지 않은 학생만 반환한다 |
| FR-2 | 응답 항목 `id, name, englishName, site, grade, status, admissionDate, teachers[]`. `teachers` 항목은 `{teacherId, name, primary}`이고 배정 순서대로 둔다. 첫 번째가 `primary=true` |
| FR-3 | 필터는 `teacherId`(그 강사가 배정된 학생)와 `site`(TPI / TRINITY / SANTACROCE)다. 페이지 방식은 강사 조회와 같다(`limit` 1–200, 기본 100, `cursor`) |
| FR-4 | 새 권한 `students:read`를 만든다. 테넌트 API 사용 설정과 키 발급 화면에서 고를 수 있다. 메뉴 이용 권한은 학생 메뉴(`std`)를 따른다 |
| FR-5 | 기존 테넌트 설정과 키에는 새 권한이 들어가지 않는다(기본 OFF). 쓰려면 테넌트 마스터가 설정을 켜고, 새 키를 발급하거나 키를 교체해야 한다 |
| FR-6 | API 안내 화면·OpenAPI·연동 문서에 추가한다. 권한 이름은 4개 언어(ko/en/vi/zh-CN)로 둔다 |

## 4. Non-Functional (비기능)
- **개인정보 최소화**: 연락처, 이메일, 생년월일, 주소, 학교, 성적·상담 메모는 내보내지 않는다. 화면 안내에도 "학생 이름·학년·배정 강사가 외부 앱으로 전달된다"고 적는다.
- **감사**: 외부 API의 기존 요청 기록·감사 경로를 따른다.
- **테넌트 격리**: 키의 `ent_id` 학생만 반환한다. 다른 테넌트의 `teacherId`로 조회하면 빈 목록을 준다.
- **호환**: 기존 API와 응답은 바꾸지 않는다. OpenAPI 버전은 1.2.0으로 올린다.

## 5. Out of Scope (범위 제외)
- 휴원(INACTIVE)·퇴원(WITHDRAWN) 학생 조회, 학생 상세 단건 API.
- 학생 등록·수정 같은 쓰기 API.
- 학부모 정보.
