---
document_id: REQ-261128C-INT
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-28 v1.1.0 — 사용자 확인("다음"), 구현
  - 2026-11-28 v1.0.0 — initial analysis (사용자 확인 대기). 범위 = 제안 1·2 (사용자 선택 "1,2 까지")
---

# REQ-261128C External scheduler API · new calendar categories (외부 스케줄러 API 새 분류 반영)

Related: [REQ-261128-CAL](REQ-261128-cal-category-manage.md), [REQ-261125 external scheduler](REQ-261125-external-scheduler-api.md), [연동 문서](../integration/external-scheduler-api.md)

## 1. Background (배경)
REQ-261128-CAL (#455)이 일정 분류 4개를 추가했다: 수업 가능 시간 `AVAILABLE`, 수업 불가능 시간 `UNAVAILABLE`, 휴강 `CANCELED`, 결강 `ABSENT`.
외부 스케줄러 API는 아직 이 분류들을 구분하지 않는다.

## 2. Current State (현황 — 운영 2026-11-28 조회)
| Item | Current | Problem |
|------|---------|---------|
| 운영 데이터 | `AVAILABLE` 145건 (강사 5명, 2026-11-28 ~ 2027-01-31). 외부 연동 앱 2개 사용 중, 일정 쓰기 권한 ON | 바로 영향 |
| 배정 겹침 검사 (`PUT /lessons/external/{id}`) | 강사의 모든 일정과 겹치면 409 `SCHEDULE_CONFLICT` | '수업 가능 시간' 안에 수업을 넣을 수 없다. 휴강한 자리에도 넣을 수 없다 |
| 조회 응답 `category` | 테넌트 분류는 모두 `OTHER` | 외부 앱에서 '수업 가능 시간'이 '이미 일정 있음'과 똑같이 보인다 |

## 3. Requirements (요구사항)
| ID | Requirement |
|----|-------------|
| FR-1 | 겹침 검사에서 `AVAILABLE`(수업 가능 시간)·`CANCELED`(휴강) 일정은 빼고 배정을 허용한다 |
| FR-2 | `UNAVAILABLE`(수업 불가능 시간)·`ABSENT`(결강)과 기존 분류, 관리자가 추가한 분류는 지금처럼 배정을 막는다. 결강은 학생만 빠지고 강사 시간은 쓰인 것으로 본다 |
| FR-3 | 조회·상세·등록 응답에 `calendarCategory`(실제 분류 코드)와 `blocksBooking`(이 일정 때문에 그 시간에 배정할 수 없는지)를 추가한다 |
| FR-4 | 기존 `category` 값은 바꾸지 않는다. 기존 연동이 깨지지 않게 하기 위해서다 |
| FR-5 | API 안내 화면(`/admin/config/api`)·OpenAPI·연동 문서에 새 필드와 겹침 규칙을 적는다 |

## 4. Non-Functional (비기능)
- **하위 호환**: 응답 필드를 추가만 한다. 요청 형식과 등록 가능한 분류(데모/정규)는 그대로다. OpenAPI 버전은 1.1.0으로 올린다.
- **규칙 원본**: '배정을 막지 않는 분류' 목록은 `cal-category.ts` 한 곳에 둔다. 겹침 검사와 `blocksBooking`이 같은 목록을 쓴다.

## 5. Out of Scope (범위 제외)
- 수업 가능 시간 **밖**의 배정을 막는 일. 가능 시간을 등록하지 않은 강사도 있기 때문이다.
- 관리자 화면에서 일정을 만들 때의 겹침 검사. 지금도 이 검사는 없다.
- 학생 상세의 '다음 수업'과 강사 포털 '최근 수업'에서 휴강·결강을 빼는 일 (제안 3).
- 관리자가 추가한 분류마다 '배정 막음 여부'를 고르는 설정.
