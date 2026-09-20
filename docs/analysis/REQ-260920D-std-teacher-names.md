---
document_id: ACM-STD-TEACHER-NAMES-REQ-1.0.0
version: 1.0.0
status: IMPLEMENTING
date: 2026-09-20
change_log:
  - version: 1.0.0
    date: 2026-09-20
    description: 학생 목록 담당강사 전체 이름 노출 요구사항
---
# Teacher Names in Student Lists (학생 목록 담당강사 전체 표시)

## 1. Request and Findings (요청·현황)

학생 목록에서 담당강사가 여러 명이어도 모든 강사명을 표시한다.
현재 `std-table.tsx`는 2명 이상이면 ‘첫 강사 외 N명’으로 축약하고, 전체 이름은 title에만 표시한다. API의 `teachers` 배열에는 이미 전체 이름이 있어 프론트엔드 표시만 변경하면 된다.

## 2. Requirements (요구사항)

- 강사 수와 관계없이 연결된 모든 이름을 쉼표로 구분하여 표시한다.
- 기존 강사 순서를 유지하고 ‘외 N명’ 축약 및 말줄임을 적용하지 않는다.
- 긴 목록은 셀 안에서 줄바꿈하여 전체 이름을 읽을 수 있게 한다.
- 연결 배열이 없으면 기존 텍스트 담당강사 값을 그대로 표시한다. 미등록 표시는 기존 목록 규칙을 유지한다.
- 공통 테이블을 사용하는 통합·사이트별·퇴원 목록에 동일 적용한다.
- 강사 연결, 학생 데이터, API, 수업정보 카드는 변경하지 않는다.

[작업계획·화면구성도](../plan/PLN-260920D-std-teacher-names.md)

2026-09-20 사용자 “진행”으로 구현·배포 승인.
