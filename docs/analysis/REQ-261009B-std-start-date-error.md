---
document_id: STD-START-DATE-ANALYSIS-1.0.0
version: 1.0.0
status: Deployed
change_log:
  - version: 1.0.0
    description: Investigated production date mismatch and prepared fix plan.
---
# Student Start Date Error (학생 수업시작일 저장 오류)

## 1. Evidence (확인 결과)
대상 학생 ID: d3084c0f-51cf-4cca-bfe1-99b001a8dc8b.
운영 읽기 전용 조회 결과: 기본 std_start_date=2026-10-08, std_end_date=NULL, ACTIVE.
별도 재원기간은 한 건이며 start_date=2026-11-02, end_date=NULL, confirmed=true, cancelled=false.
운영 로그에서 해당 학생 PUT 요청이 다음 오류로 반복 실패함을 확인했다:
`QueryFailedError: Edit the individual operating period instead of the representative date`.

## 2. Root Cause (원인)
sql/acm/999w-acm-tch-employment-dates.sql의 acm_ops_master_dates 트리거는 기존 기본 시작일과 같은 재원기간만 수정한다. 일치 건수가 1이 아니면 예외를 발생시킨다. 해당 학생은 날짜가 달라 일치 건수가 0이다. 서버는 이 예외를 사용자용 오류로 변환하지 않아 HTTP 500으로 반환한다.
학생 재원기간 편집은 별도 저장 경로이며, 강사와 달리 기본 날짜 역동기화가 없어 불일치가 남을 수 있다. 실제 불일치 생성 경위는 미확정이다.

## 3. Scope (범위)
학생 시작일·종료일과 재원기간의 일관성 및 오류 안내를 개선한다. 강사 규칙은 유지한다. 요청에는 변경할 목표 날짜가 없으므로 운영 학생 날짜를 임의 보정하지 않는다.
