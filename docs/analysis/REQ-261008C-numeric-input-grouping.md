---
document_id: ACM-NUMERIC-INPUT-REQ-1.0.0
version: 1.0.0
status: Approved for Implementation
created: 2026-10-08
change_log:
  - version: 1.0.0
    date: 2026-10-08
    description: Group monetary and quantity inputs / 금액·수량 콤마
---
# Numeric Inputs Requirements (숫자 입력 요구사항)

## 1. Scope and Approval (범위 및 승인)

사용자가 5단계 결제금액 및 기타 숫자 입력의 콤마 패치를 요청했고, 추가 질문에 “금액·수량 모두 적용”으로 범위를 확정했다. 먼저 PR #310을 운영 배포하고 콤마 패치를 별도로 구현한다.

숫자형 입력 60곳 중 금액·수량 58곳에 공통 포맷을 연결한다. 상담 결제/수업시간/MAP 및 레벨테스트 점수, 학생 점수, 대시보드 마케팅·운영·수동 입력, 수업 시간, 반복 간격, 학교 학년 범위, 참조자료 점수·절차 순서, Q&A 정렬순서, 화상수업 시간 설정이 대상이다. 수납관리 및 수강료는 기존 콤마 기능을 유지한다. 연도·문항 식별번호, 날짜·전화번호·인증번호·GA4 ID·포트 번호에는 콤마를 넣지 않는다.

## 2. UI Layout (화면 구성)

```text
5. 결제
결제금액 [2,345,678]    비고 [          ]
수업 시간 [1,500] 분
수량 [12,345]    소수/음수 [-12,345.67]
```

## 3. Implementation and Validation (구현 및 검증)

Input type=number는 공통 NumericInput으로 렌더링한다. 개별 native 수량 입력도 해당 컴포넌트로 변경한다. 화면에만 천 단위 구분자를 표시하고 onChange는 쉼표 없는 문자열을 전달한다. React Hook Form은 Controller 연결을 사용해 DOM의 표시값이 저장값으로 들어가지 않게 한다. 기존 수치 타입 전환, validate 규칙, min/max/step/required, 소수·음수·빈 값, reset 및 포커스를 유지한다.

공통 입력 브라우저 테스트와 실제 상담 5단계/4단계 컴포넌트의 합성 API 저장 검증을 실행한다. 기존 캘린더 반복 등록·편집도 회귀 검증하고 TypeScript/Vite 빌드를 수행한다. DB/API 스키마 변경 없이 프런트엔드만 수정한다.
