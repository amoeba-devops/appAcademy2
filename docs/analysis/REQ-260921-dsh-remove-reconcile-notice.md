---
document_id: ACM-DSH-NOTICE-REQ-1.0.0
version: 1.0.0
status: IMPLEMENTING
date: 2026-09-21
change_log:
  - version: 1.0.0
    date: 2026-09-21
    description: 대시보드 사이트비교 합계 차이 안내 박스 제거 요구사항
---
# Site Comparison Notice Removal (사이트비교 안내 박스 제거)

## 1. Request (요청)

대시보드 사이트비교 박스 안의 “통합과 사이트별 합계에 차이가 있습니다”부터 “공통 값으로 간주하지 않습니다”까지 안내 박스를 제거한다.

대상: `/admin/dashboard?from=2026-09-01&to=2026-09-30&preset=thisMonth&site=ALL`.

## 2. Findings and Scope (확인·범위)

운영 화면과 `frontend-acm/src/modules/dsh/components/site-comparison-table.tsx`에서 확인했다. 제거 대상은 `role="status"`인 내부 박스 전체다.

- 제목: `quality.reconcile`.
- 가운데 지표별 차이 표시 행.
- 설명: `quality.reconcileHint`.

사이트비교 제목/기간, 사이트별 수치와 합계 표, 표 아래 공통(미지정) 설명은 유지한다. API·DB·합계 계산 결과를 변경하지 않는다. 안내 박스는 기간이나 언어에 관계없이 출력하지 않는다.

## 3. Acceptance (완료 기준)

지정 기간의 통합 대시보드에서 해당 안내 박스가 사라지고 빈 여백이 남지 않아야 한다. 사이트별 표와 합계는 이전과 동일하며 데이터 로딩/실패 표시는 유지한다.
