---
document_id: ACM-PORTAL-MENUS-REQ-1.0.0
version: 1.0.0
status: implemented_locally
change_log:
  - version: 1.0.0
    date: 2026-11-25
    description: Define student-note hiding and teacher/student portal menu visibility requirements.
---

# Portal Menu Visibility Requirements (학원 포털 메뉴 노출 요구사항)

## 1. Request (요청)

1. Hide the special-note field on the teacher portal student detail screen (`/portal/students/:stdId`). 수강생 상세의 **특이사항** 항목을 노출하지 않는다.
2. Extend tenant settings menu management (`/admin/tenant`) with academy portal menu visibility controls for teachers and students. 강사 포털과 학생 포털 메뉴를 각각 설정한다.
3. Make portal notices (`/portal/notices`) follow the tenant's portal settings. 공지사항을 강사·학생별로 따로 켜고 끌 수 있어야 한다. 사용자는 현재 운영 콘솔에서 관리자·강사·직원 모두 공지사항을 숨겼는데 포털에는 노출된다고 보고했다.

## 2. Evidence (확인 결과)

- Source baseline is the deployed release `7ece5a6` plus local deployment documentation; application code was subsequently implemented on branch `feat/portal-menus-261125`.
- `portal-teacher-students-page.tsx` renders `s.specialNote` and `s.goalsNote` in the same card. `PortalTeacherStudentsService.getMyStudent` returns special-note data. 포털 표시 제거와 API 응답 제외가 필요하며 학습 목표와 기존 운영 콘솔 기록은 구분해야 한다.
- `PortalShell` declares the notices menu unconditionally. Current per-role visibility settings are not queried by the portal shell.
- `TenantRoleMenuService` / `TenantMasterController` currently manage console roles ADMIN / TEACHER / STAFF. 포털의 STUDENT 역할이나 독립된 강사·학생 메뉴 매트릭스가 없다.
- `/admin/tenant` has a menu tab with the console role matrix and custom menus. 기존 탭 안에 포털 전용 설정 영역을 추가할 수 있다.
- `portalApi.notices` / `notice` use the public `/portal/news` API. `PortalNewsController` reads `DEFAULT_ENT_ID`, not the authenticated portal tenant, and checks published status rather than portal menu visibility.
- External browsing could not open the supplied URLs. 위 운영 콘솔 설정값은 사용자 보고이며, 운영 계정으로 재현·검증한 상태는 아니다. 분석은 관련 소스와 기존 설계에 근거한다.
- `/memories/`, `/memories/session/`, `/memories/repo/` are absent in this environment.

## 3. Requirements (요구사항)

### 3.1 Student Detail (수강생 상세)

- Remove the special-note label and value from portal student detail and omit the field from the teacher-portal detail API response. 브라우저 응답에도 특이사항을 전달하지 않는다.
- Keep learning goals, consultation records, class links, and other requested student information. 특이사항만 있었던 경우 빈 메모 카드를 남기지 않는다.
- Preserve the stored special note and its existing administration-console behavior. 데이터 삭제나 기존 관리자 편집 기능 변경은 포함하지 않는다.

### 3.2 Portal Menu Matrix (포털 메뉴 설정)

- Add an **Academy portal (teacher/student)** section to the tenant settings menu tab, alongside the existing console matrix.
- Store teacher-portal and student-portal settings separately per tenant and menu key. 운영 콘솔의 TEACHER 역할 설정과 포털의 TEACHER 설정을 혼동하거나 같은 저장 행에 덮어쓰지 않는다.
- Let the existing tenant-settings authorization manage its own tenant's portal menu settings. 일반 강사·학생에게 설정 변경 권한을 부여하지 않는다.
- Apply settings to desktop/mobile navigation and direct entry to the corresponding menu screen. 설정 저장 후 캐시가 갱신되어야 하며 다른 학원·다른 역할 설정과 섞이지 않아야 한다.
- Visibility cannot grant an unsupported role access to a feature: teacher-only calendar/student-management/chat stay unavailable to students. 마이페이지·로그아웃 등 계정 관리 진입점은 유지한다.
- This change adds settings for TEACHER / STUDENT. 학부모 포털의 신규 설정은 이번 범위에 포함하지 않으며 기존 정책을 임의로 학생 설정에 합치지 않는다.

### 3.3 Notices (공지사항)

- Provide independent teacher/student notice switches. 강사만 켜기·학생만 켜기·둘 다 켜기·둘 다 끄기가 가능해야 한다.
- Use the authenticated tenant and its effective portal setting for notice list/detail requests. 비노출 역할은 메뉴·직접 화면 진입·인증된 포털 공지 조회를 제한한다.
- Replace the academy portal's use of the public default-tenant news endpoint with an authenticated tenant-scoped notices endpoint. 기존 공개 홈페이지 뉴스 API는 별도로 유지한다.
- Apply the existing system-level tenant menu entitlement as an upper limit where the notice/posts module is disabled. 포털 설정으로 학원에 허가되지 않은 모듈이나 타 테넌트 공지를 열 수 없다.
- **Proposed initial state:** new teacher/student portal notice switches default to **hidden**. 초기 포털 공지 노출을 중단한 뒤 테넌트 설정에서 필요한 역할만 켜도록 제안한다. 기존 콘솔 관리자·강사·직원 설정은 그대로 유지하며 이후 포털은 새 전용 설정을 따른다. 사용자가 계획대로 구현을 승인하여 이 초기값으로 구현했다.
- Other supported portal menus retain current visible defaults; role-ineligible menus remain locked off. 메뉴 설정 조회 실패를 전체 메뉴 노출로 처리하지 않고 안내·재시도를 제공한다.

## 4. Acceptance Criteria (완료 기준)

| Scenario (시나리오) | Expected result (기대 결과) |
| --- | --- |
| Student detail | 특이사항의 라벨·본문·API 필드가 없고 학습 목표 등 다른 내용은 유지 |
| Portal matrix | 기존 콘솔 설정과 별도로 강사·학생 열이 표시되고 저장·재조회 가능 |
| Notices off/off | 양쪽 메뉴·직접 진입·인증된 포털 공지 조회 제한 |
| Notices on/off or off/on | 켠 역할만 접근 가능 |
| Tenant separation | 다른 학원의 설정·공지·학생 정보와 섞이지 않음 |
| Base role restrictions | 학생에게 캘린더·수강생관리·채팅을 활성화할 수 없음 |
| Loading/error | 설정 확인 전 또는 조회 실패 시 숨긴 메뉴·내용이 잠깐 노출되지 않음 |
| Existing services | 공개 뉴스·운영 콘솔의 기존 공지 설정과 관리자 특이사항 데이터 유지 |

## 5. References (참조)

- [Implementation plan and UI layout (작업 계획·화면 구성안)](../plan/PLN-261125-portal-menu-visibility.md)
- [Existing tenant role menus (기존 테넌트 역할별 메뉴)](REQ-261015C-menu-groups-tenant-master.md)
- [Existing tenant settings boundary (테넌트 설정 권한)](REQ-261018-config-invite-tenant-master-settings.md)
- [Deployed teacher portal requirements (배포된 강사 포털 요구)](REQ-261124-teacher-portal-calendar.md)
- [Current standard (현재 표준)](../standard/SPEC.md)

Implementation and verification (구현·검증): [RPT-261125](../report/RPT-261125-portal-menu-visibility.md).
