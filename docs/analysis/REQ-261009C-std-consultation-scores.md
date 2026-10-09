---
document_id: STD-CSL-SCORES-ANALYSIS-1.0.0
version: 1.0.0
status: Implemented; targeted data corrected; code not deployed
change_log:
  - version: 1.0.0
    description: Investigated missing linked consultation MAP scores.
---
# Consultation Score Inheritance (상담 점수 학생 반영)

## 1. Evidence (운영 확인)
상담 #109 (45302f27-7915-417e-9d42-7268f900174d), ATTENDING, 연결 학생 d3084c0f-51cf-4cca-bfe1-99b001a8dc8b.
MAP: Reading 181, Math 216, Language NULL. 같은 상담에 SSAT 행도 존재.
학생 std_map_reading/math/language는 모두 NULL. MAP 행 최종 갱신은 2026-10-09 15:02:38 UTC. 이 시간은 행 갱신 시간이며 최초 점수 입력 시점을 의미하지 않는다.
운영 데이터는 읽기 전용으로 확인했고 점수는 변경하지 않았다.

## 2. Cause (원인)
- 학생 상세는 학생 테이블의 MAP 점수만 표시하며 상담 원본을 조회하지 않는다.
- InquiryService의 점수 이관은 CLASS_STARTED 전환에서만 실행된다. recordLevelTestResultByType는 상담 점수만 저장하므로 등록 이후 입력은 학생에 반영되지 않는다.
- 전환 시 mapTests.findOne({entId,inqId})에 testType 조건이 없어 MAP 대신 SSAT를 선택할 가능성이 있다. 실제 과거 선택 행은 확정하지 않았다.
- StdInheritanceService는 inq.stdId 대신 이름/전화로 학생을 찾는다. 연결 학생 ID를 우선 사용하도록 개선 필요.

## 3. Acceptance (완료 기준)
등록 전후 입력 모두 연결 학생의 비어 있는 MAP 점수에 반영한다. 기존 학생 점수와 수동 수정 값은 덮어쓰지 않는다. 테넌트 경계를 유지하고 SSAT 값을 MAP 필드에 복사하지 않는다.
