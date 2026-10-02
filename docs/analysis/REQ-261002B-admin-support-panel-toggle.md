---
document_id: ACM-ADMIN-SUPPORT-TOGGLE-REQ-1.0.0
version: 1.0.0
status: Implemented; not deployed
created: 2026-10-02
change_log:
  - version: 1.0.0
    date: 2026-10-02
    description: Shared support panel visibility requirements / 공통 우측 패널 표시 요구사항
---

# Admin Support Panel Toggle (관리자 우측 패널 가리기)

## 1. Request (요청)

수납관리 `/admin/pay`의 우측 패널에 가리기 버튼을 제공하고 모든 페이지에 동일하게 적용한다. 대상은 공통 이용 팁/배너 패널이며 좌측 메뉴나 업무 상세 패널과 구분한다.

## 2. Findings (현황)

운영 배포 69a0deb 기준 `frontend-acm/src/components/layout/admin-content-layout.tsx`의 AdminContentLayout이 공통 AdminSupportPanel을 표시한다. AppShell 아래 업무 화면에 적용되며 대시보드는 기존 정책에 따라 제외된다. 가용 폭 1176px 이상에서는 본문 896px + 간격 24px + 패널 256px, 좁은 화면에서는 패널이 본문 아래로 이동한다. 현재 표시/숨김 상태 및 버튼은 없다.

관련 기준: REQ/PLN-260920E-admin-ui-consistency, docs/standard/SPEC.md. `/memories`, `/memories/session`, `/memories/repo`는 현재 환경에서 확인되지 않았다.

## 3. Acceptance Criteria (완료 기준)

- 공통 패널 상단에 아이콘과 ‘가리기’ 버튼을 표시한다.
- 가린 상태에는 본문 상단 우측에 ‘우측 패널 보이기’ 버튼을 남긴다.
- 가리면 팁·배너와 패널 열/여백이 사라지고 본문은 사용 가능한 폭으로 확장된다.
- 페이지를 이동하거나 새로고침해도 동일 브라우저·사용자 기준 선택을 유지한다. 저장소 접근 실패 시에도 현재 화면 조작은 가능해야 한다.
- 처음 사용하는 경우 기존과 같이 표시한다. 좁은 화면에서는 하단 패널도 함께 가려지고 상단에서 복원할 수 있다.
- 공통 패널이 있는 모든 관리자 페이지에 적용한다. 패널이 없는 대시보드·로그인·학부모/공개 페이지에 새 패널을 추가하지 않는다.
- 표시 전환 시 본문을 재마운트하지 않아 검색 조건·입력 중 값·스크롤 상태를 불필요하게 초기화하지 않는다.
- 버튼의 키보드 접근, 상태 설명, 4개 언어를 지원한다.
- DB/API/수납 원장 변경 없음.

## 4. Decision (승인 대상)

버튼 위치, 숨김 시 본문 폭 확장, 사용자별 표시 상태 유지 방안을 아래 계획서와 함께 승인받은 뒤 구현한다.

2026-10-02 사용자 “구현 진행” 승인 후 구현 및 로컬 공통 레이아웃 검증 완료. 운영 배포 전.
