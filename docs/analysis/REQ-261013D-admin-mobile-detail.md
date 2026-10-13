---
document_id: ACM-MOBILE-DETAIL-REQ-1.0.0
version: 1.0.0
status: Implemented (not deployed)
change_log:
  - version: 1.0.0
    description: Consultation transition hints and admin mobile follow-up audit.
---
# Admin Mobile Follow-up (관리자 모바일 추가 개선)

## 1. Request (요구사항)
상담 상세 `/admin/csl/:id`에서 단계 이동 보조 설명을 모바일에서 숨긴다. 대상 예: ‘2. 레벨테스트 · 별도 입력 요건 없음 (레벨테스트 기록 단계)’, ‘3. 데모수업 · 접수에서 바로 갈 때만…’. 다른 관리자 페이지도 모바일 최적화 상태를 조사하고 문제를 수정한다.

## 2. Findings (코드 조사)
운영 d07f69d의 관련 소스와 이전 모바일 개선 계획/보고서를 확인했다. 제공된 운영 상담 URL은 일반 웹 조회로 열리지 않아 해당 계정의 실제 모바일 화면 재현은 아직 하지 못했다.
- `csl-detail-page.tsx`의 allowedForward 안내 블록이 모든 화면 크기에서 표시된다. `transition.hints.*` 번역을 사용하는 보조 설명이다. 요청한 문구의 위치를 확인했다.
- 같은 화면의 상단 작업 영역은 `flex gap-2`이며 단계 버튼·사이트 선택·설명 등이 함께 놓인다. 좁은 화면의 줄바꿈과 우선순위 보완 대상이다.
- 단계 탭은 이미 영역 가로 스크롤을 제공한다. 전체 페이지 넘침과 선택 단계 식별·터치 영역을 추가 검증한다.
- 공통 관리자 영역에는 767px 이하 최소 폭/텍스트 줄바꿈/입력 16px 처리, 우측 패널 모바일 모달이 이미 있다. 팝업 높이 및 폼 반응형도 이전 PR #316에서 개선했다.
- 레벨테스트 일부 제목/작업 행, 상담 첨부 행, 등록상담 작업 행에 줄바꿈 없는 flex가 남아 있다. 실제 데이터·번역 길이에 따른 넘침 후보이며 브라우저 확인 후 수정한다.
- 학생 상세, 일정 상세, 설정 폼은 반응형 grid를 사용한다. 상담 목록/통계 등 큰 표의 min-width는 의도적 영역 스크롤일 수 있어 그 자체를 오류로 판단하지 않는다.
- 이전 보고서는 채팅·학생 폼의 브라우저 검증과 나머지 코드 점검을 구분한다. 모든 업무 화면의 모바일 동작을 이미 검증한 것으로 간주하지 않는다.

## 3. Acceptance (수용 기준)
1. 768px 미만에서는 상담 상단 ‘다음 단계 안내’ 설명만 숨기고 768px 이상에서는 표시한다. 레벨테스트·데모뿐 아니라 같은 안내 영역 전체에 일관되게 적용한다.
2. 단계 이름·이동 버튼·필수 입력값·유효성 오류·서버 전환 제한 메시지는 유지한다. 업무 규칙/API/권한은 바꾸지 않는다.
3. 모바일 페이지 전체의 의도하지 않은 가로 넘침을 없앤다. 표·캘린더·단계 탭의 영역 스크롤은 유지한다.
4. 주요 동작 버튼의 터치 영역과 검색/필터 줄바꿈, 긴 이름·파일명·번역 대응, 모달 내부 스크롤 및 하단 버튼 접근을 검증한다.
5. 기존 수납 통계 그래프 ‘3개 한 줄’ 요구와 닫기 기능은 유지한다.
6. 화면별 코드 조사/브라우저 재현/수정/확인 불가 상태를 구분해 보고한다. 실제 iOS/Android 기기와 데스크톱 브라우저 에뮬레이션 결과를 구분한다.

## 4. References (참고)
- docs/standard/SPEC.md
- docs/plan/PLN-261013-admin-mobile.md
- docs/report/RPT-261013-admin-mobile.md
- frontend-acm/src/modules/csl/pages/csl-detail-page.tsx
- frontend-acm/src/modules/csl/components/csl-stage-stepper.tsx
- frontend-acm/src/components/layout/admin-content-layout.tsx
- frontend-acm/src/styles/globals.css
