---
document_id: ACM-PAY-STUDENT-SEARCH-REQ-1.0.0
version: 1.0.0
status: Implemented; not deployed
created: 2026-10-01
change_log:
  - version: 1.0.0
    date: 2026-10-01
    description: Individual student selection by search / 검색 후 학생 개별 선택
---

# Student Search Selection (청구 학생 검색 선택)

## 1. Requirement (요구사항)

수납관리의 “청구 등록 / 월별 생성”에서 학생을 검색하여 한 명씩 선택한다. “한 명씩”은 검색 결과에서 개별 추가하는 동작으로 해석하며, 선택 목록에 여러 명을 모아 월별 청구를 생성하는 기존 기능은 유지하는 안이다.

## 2. Current Behavior (현재 동작)

`frontend-acm/src/modules/pay/payment-page.tsx`의 CreateDialog는 열자마자 학생 목록을 가져와 체크박스와 “표시된 항목 선택” 버튼을 제공한다. 학생 이름 검색은 가능하지만 전체 목록이 먼저 노출되며 일괄 선택할 수 있다. 검색을 바꾸면 선택한 학생의 이름이 화면에서 사라질 수 있다.

## 3. Proposed Behavior (변경안)

- 처음에는 학생 목록 대신 “학생 이름을 검색하세요” 안내 표시.
- 이름을 입력하면 검색 결과 표시. 학생 이름·사이트·재원 상태로 구분하고 각 행의 “추가”로 1명씩 선택.
- 전체 선택 버튼 제거. 선택한 학생은 별도 목록에 유지하고 개별 삭제 가능.
- 검색어 변경으로 선택 목록이 사라지지 않음. 같은 학생 중복 추가 차단.
- 휴원/퇴원 학생은 기존 규칙대로 선택 불가. 동명이인은 사이트 및 식별 정보로 구분.
- 검색 결과 없음·로딩·오류/재시도 및 선택 상한 100명 표시.
- 기존 청구 미리보기·금액 조정·중복 방지 및 권한 유지.

[작업 계획](../plan/PLN-261001E-pay-student-search-selection.md)

2026-10-01 사용자 “진행” 승인 후 구현 및 로컬 브라우저 검증 완료. 운영 미배포.
