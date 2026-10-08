---
document_id: ACM-CSL-REGISTRATION-SUMMARY-RPT-1.0.0
version: 1.0.0
status: Implemented - Not Deployed
created: 2026-10-08
change_log:
  - version: 1.0.0
    date: 2026-10-08
    description: Hide unused stage-six summary fields / 6단계 불필요 요약 항목 숨김
---
# Enrollment Summary Display (수강등록 요약 표시)

## 1. Changes (구현)

6단계 수강등록에서 수강횟수는 기존 값이 있어도 숨긴다. 시작일·종료일은 등록상담에 저장된 값이 있을 때만 각각 행을 표시한다. null/undefined/빈 문자열/공백은 미지정으로 처리한다. 7단계 수강중의 기존 표시, 4단계 입력, API 및 저장 데이터는 변경하지 않았다.

## 2. Validation (검증)

프런트 TypeScript/Vite 빌드 통과 (기존 번들 크기 경고 유지). 로컬 합성 API 응답으로 실제 공유 컴포넌트를 렌더링하여 다음 6가지 화면을 확인했다: 날짜 모두 없음, 시작일만 있음, 종료일만 있음, 두 날짜 있음, 빈 문자열/공백, 7단계. 수강횟수 12가 저장된 fixture에서도 6단계는 숨김, 7단계는 기존 표시를 유지했다. 브라우저 오류 없음. 임시 검증 페이지는 검사 후 제거했다.

![날짜 미지정](assets/csl-summary-261008/no-dates.png)
![시작일만 지정](assets/csl-summary-261008/start-only.png)

## 3. Delivery (적용 상태)

`fix/csl-registration-summary-261008` 독립 브랜치에서 수정했다. 기존 IDE의 변경/스테이징은 보존하며 문서·캡처만 복사했다. 운영 배포는 아직 진행하지 않았다. 앞서 요청한 반복 종료일 수정 PR #310과 별도 변경이다.
