---
document_id: ACM-DSH-FIX-1.0.0
version: 1.0.0
status: VERIFIED
change_log:
  - version: 1.0.0
    date: 2026-09-18
    description: Four desktop panels in one row and consistent sparkline strokes
---
# Dashboard Card Layout (대시보드 카드 배치)

## 1. Changes (변경)
사용자 요청에 따라 1280px 이상에서 MARKETING / CS / OPERATING / CLASS 패널을 한 줄로 배치했다. 768~1279px에서는 2열, 그 미만은 1열이다. 로딩 상태도 같은 배치를 사용한다.

카드 내부 여백과 표 열 폭을 조정하고 그래프를 카드 하단에 정렬했다. SVG의 `vector-effect="non-scaling-stroke"`로 가로 확대 시 선 두께가 왜곡되는 문제를 수정했다. 선은 1.5px, 둥근 연결을 유지하고 누락 구간은 연결하지 않는다. 일정한 값은 그래프 중앙에 표시한다.

## 2. Verification (검증)
프론트엔드 타입 검사·프로덕션 빌드 통과(기존 번들 크기 경고 있음). 실제 컴포넌트의 로컬 브라우저 검증에서 4열 배치, 1,505,930 비용 표시, 얇은 선과 누락 구간을 확인했다. 임시 검증 페이지는 삭제했다. API·집계·원장 값은 변경하지 않았다.
