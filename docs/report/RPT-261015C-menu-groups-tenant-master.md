---
document_id: ACM-MENU-TENANT-RPT-1.0.0
version: 1.0.0
status: Implemented on staging; production deploy pending
created: 2026-10-15
change_log:
  - version: 1.0.0
    date: 2026-10-15
    description: WP1–WP5 implementation report / 메뉴 그룹·테넌트 마스터·이슈·내 업무·사용자 타임존 구현 보고
---
# Menu Groups and Tenant Master Report (메뉴 구조·테넌트 마스터 구현 보고)

요구사항: [REQ-261015C](../analysis/REQ-261015C-menu-groups-tenant-master.md) · 계획: [PLN-261015C](../plan/PLN-261015C-menu-groups-tenant-master.md)

## 1. Delivered (구현 내용)
| WP | PR | 내용 |
|---|---|---|
| WP1 | #325 | 학원관리/업무관리/설정 메뉴 그룹(접기 기억), 표준 메뉴 키 순서 변경, `/system/admin` 테넌트 선택 후 사용자 목록 |
| WP2 | #326 | `TENANT_MASTER` 권한·`amb_acm_tenant_role_menu`(1035), 테넌트 설정(`/admin/tenant`: 등급별 메뉴 노출·기본 타임존), 서비스 설정은 CONFIG_ADMIN 전용, 시스템 어드민 테넌트 마스터 지정/해제, admin@tpi.co.kr 최초 지정 |
| WP3·WP4 | #327 | 이슈 확장(1036: 간소화 상태·유형·우선순위·기간·댓글·이력), `/admin/issues` 목록·칸반·상세, `/admin/my-work` |
| WP5 | 이 PR | 사용자 타임존(1037), 포털 `/portal/me`·콘솔 `/admin/me` 마이페이지, 테넌트 기본 기준 + 사용자 타임존 병기 |

## 2. Decisions Applied (결정 반영)
- Q6 숨김만: 등급별 메뉴는 좌측 메뉴 노출만 제어한다. 직접 URL과 API 권한은 바뀌지 않는다.
- Q4 간소화 모드: 기존 TODO→OPEN, DOING→IN_PROGRESS로 변환했다. 허용 전이는 OPEN→진행/완료/반려, 진행→완료/열림, 완료·반려→열림이다.
- Q2: 기본 타임존 저장은 테넌트 마스터와 서비스 운영자 모두 가능하다(서버 `TenantSettingsGuard`). 화면은 테넌트 설정에만 있고, `/admin/config/general`은 테넌트 설정으로 이동한다.
- 수납 메뉴는 기존 정책대로 강사 등급에 열 수 없다(매트릭스에서 잠김).

## 3. Timezone Display Scope (타임존 병기 적용 범위)
- 적용:
  - 포털: 일정 목록·주/일 보기 행(시각 아래 사용자 시각), 일정 팝업, 일정 상세
  - 콘솔: 일정 상세(시작·종료·화상 기록 시각)
- 형식: `오후 07:00 (오후 05:00 Ho Chi Minh)`. 사용자 타임존이 없거나 표시 결과가 같으면 한 번만 표시한다. 종일 일정은 날짜만 표시한다.
- 미적용:
  - 월간 달력 칸은 공간 문제로 테넌트 시각만 표시한다.
  - 포털 달력의 날짜 칸 배치는 기존처럼 브라우저 기준이다.
  - 공지·자료 게시일 등 날짜만 있는 값은 그대로 둔다.

## 4. Verification (검증)
- Backend 단위 테스트(acm-system/acm-common/acm-prj/time) 통과.
- 통합 테스트:
  - `it-tenant-role-menu` 5
  - `it-prj-issues` 7
  - `it-prj-drive` 17
  - `it-user-timezone` 2
  - 마이그레이션 2회 적용으로 멱등성 확인
- frontend-acm `tsc`·`vite build` 통과. 각 PR CI 6개 job 통과. 스테이징 배포 시 1035·1036 `[apply] OK`.
- 화면 확인: 로그인이 필요해 브라우저 시각 검증은 하지 않았다. 스테이징에서 사용자 확인이 필요하다.

## 5. Remaining (남은 사항)
- 운영 배포 미실행. 운영 배포 시 1035–1037이 자동 적용된다. admin@tpi.co.kr 계정이 운영 테넌트 `…0001`에 있으면 테넌트 마스터로 지정되고, 없으면 시스템 어드민에서 지정해야 한다.
- 순서를 따로 저장한 테넌트는 그룹 안에서 기존 저장 순서를 따른다.
