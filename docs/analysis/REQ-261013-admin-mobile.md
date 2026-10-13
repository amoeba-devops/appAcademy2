---
document_id: ACM-MOBILE-ANALYSIS-1.0.0
version: 1.0.0
status: Implemented; not deployed
change_log:
  - version: 1.0.0
    description: Mobile chat investigation and admin-wide optimization plan.
---
# Admin Mobile Optimization (관리자 모바일 최적화)

## 1. Request (요구사항)
/admin/chat 모바일에서 채팅창 미노출 문제 해결 및 ACM 관리자 전반 모바일 최적화.

## 2. Findings (코드 확인)
최신 main을 별도 /private/tmp/acm-mobile-261013에 확보하여 분석했다. 기존 임시 폴더 소스가 삭제된 상태여서 복원하거나 덮어쓰지 않았다.
- TalkChat: viewport md(768px) 기준 방 목록/대화 전환. 높이 calc(100vh - 190px), 최소 420px.
- globals.css: 콘텐츠 너비 640px 미만이면 채팅을 세로 배치, 높이 75vh/최소 560px로 덮어쓴다. 방 목록 높이 최대 180px.
- AdminContentLayout: 1176px 미만은 우측 패널을 본문 아래 배치. 참여자 버튼은 패널로 스크롤 이동.
- AppShell은 이미 모바일 메뉴 드로어를 제공하므로 기존 동작을 개선한다.
- 서로 다른 반응형 기준 및 높이 제약이 문제 후보다. 운영 모바일 세션에서 미노출을 재현하지 못했으므로 단일 원인을 확정하지 않는다. 현재 환경의 in-app browser는 사용 불가였다.

## 3. Scope (범위)
관리자 전체 공통 레이아웃과 메뉴별 목록·상세·입력 폼을 대상으로 한다. 강사 포털 채팅은 공유 컴포넌트 회귀 검증에 포함한다. 공개 홍보 페이지/학부모 포털의 전면 재설계는 포함하지 않는다.
