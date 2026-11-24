---
document_id: ACM-TEACHER-CALENDAR-REQ-1.2.0
version: 1.2.0
status: implemented_locally
change_log:
  - version: 1.2.0
    date: 2026-11-24
    description: Correct work list to the existing custom link and remove the document sidebar entry.
  - version: 1.1.0
    date: 2026-11-24
    description: Add teacher-only calendar, hidden custom timezone, withdrawn student filter, and work navigation order.
  - version: 1.0.0
    date: 2026-11-24
    description: Define teacher portal calendar visibility requirements for review.
---

# Portal Visibility and Navigation Requirements (포털 노출·목록·메뉴 요구사항)

## 1. Request (요청)

Teachers must be able to see the calendar at `https://acm.amoeba.site/portal/calendar/`.
강사 로그인 시 해당 캘린더 메뉴와 화면을 볼 수 있어야 한다.

## 2. Findings (확인 결과)

- `frontend-acm/src/modules/portal-app/components/portal-shell.tsx` already includes the calendar menu for portal users, including teachers. 강사를 제외하는 메뉴 조건은 없다.
- `frontend-acm/src/routes/router.tsx` protects `/portal/calendar` with portal authentication. 관리자 인증과 포털 인증의 연결 여부를 구현 단계에서 점검한다.
- `frontend-acm/src/modules/portal-app/pages/portal-calendar-page.tsx` implements month/week/day/list views and calls `/api/portal/cal/events`.
- `backend/src/modules/acm-cal/application/cal-event.service.ts` scopes teacher events to the same tenant and the teacher's assigned or invited events. 기존 설계도 본인 관련 일정 조회를 명시한다.
- Production URL inspection failed through the external browsing tool. 운영 강사 로그인 재현 및 원인 확정은 아직 수행하지 않았다. 메뉴 누락, 인증 문제, 계정 연결 문제, 빈 일정 중 어느 증상인지 확정되지 않았다.
- `/memories/`, `/memories/session/`, `/memories/repo/` are absent in this environment.

## 3. Proposed Scope (제안 범위)

1. Only teachers see the academy portal calendar. 강사에게 메뉴와 캘린더 본문을 표시하고 학생에게 숨긴다. “강사만”에 따라 학부모도 노출 대상에서 제외한다. 직접 목록 URL에서도 역할 검사를 적용하고 강사 URL의 trailing slash를 지원한다. 이 요구는 사용자 확인 완료다.
2. Preserve month/week/day/list navigation and event details. 기존 보기 전환·기간 이동·상세 조회를 유지한다.
3. Show the teacher's assigned or invited events within the authenticated tenant, following the existing policy. 조회 범위는 기존 정책인 본인 담당·초대 일정으로 제안한다. 학원 전체 일정 공개나 일정 편집 권한 확대는 별도 요구 확정이 필요하다.
4. With no events, retain the calendar and show an empty-state message; distinguish request failures from an empty result. 일정이 없어도 캘린더는 보여야 하며 조회 실패를 일정 없음으로 오인하지 않게 한다.
5. Hide custom user timezone controls for teachers and students at `https://acm.amoeba.site/portal/me` (user-specified target). 강사·학생 모두 내 정보 화면의 사용자 지정 타임존 UI를 숨기며 저장값이나 시간 변환 정책은 변경하지 않는다.
6. Exclude withdrawn students from the default teacher student list; include them only in the all view. 강사 수강생관리 기본 목록은 퇴원생 제외, 전체보기에서만 퇴원생을 포함한다. 전체보기 역시 본인 담당·테넌트 범위로 제한한다.
7. Order the work section at `https://acm.amoeba.site/admin/` (user-specified target) as tasks, issues, my tasks, projects, drive, chat. 관리자 화면 업무 관리 섹션의 순서를 **업무목록 → 이슈 → 내 업무 → 프로젝트 → 드라이브 → 채팅**으로 변경한다.

## 4. Acceptance Criteria (완료 기준)

- Teacher portal login → calendar menu → calendar view works; direct access and refresh at `/portal/calendar/` work.
- Assigned and invited events appear; unrelated teacher events and other tenant events remain inaccessible, including through direct detail URLs.
- Date navigation, all four views, and accessible event details work with the existing permissions.
- Empty results and API errors have distinguishable UI states.
- Student/parent calendar menu and list page are hidden, including direct list URL access. 다른 화면에서 사용하는 일정 상세·수업자료 API 권한을 일괄 폐기하는 요구로 확대하지 않는다.
- Teacher/student custom timezone controls are hidden; stored values and existing time conversion are preserved.
- Default student list excludes WITHDRAWN; all view includes withdrawn students within the same authorized scope. INACTIVE를 퇴원생으로 간주하지 않는다.
- Work menu order matches the requested order on desktop and mobile; existing item permissions remain effective.

## 5. Additional Findings (추가 확인)

- `portal-teacher-students-page.tsx` has no status filter or all-view control. `PortalTeacherStudentsService.listMyStudents` returns status but does not exclude WITHDRAWN. 학생 상태는 ACTIVE / INACTIVE / WITHDRAWN이다.
- `getMyStudent` reuses `listMyStudents` for authorization. 기본 목록 필터가 전체보기의 퇴원생 상세 접근까지 막지 않도록 표시 조건과 접근 범위를 분리해야 한다.
- The user identified `/portal/me` as the custom timezone screen. 현재 체크아웃에는 해당 라우트·사용자 지정 설정 코드가 검색되지 않는다. 테넌트 설정과 구분하고 구현 전 운영 버전에 해당하는 소스 위치를 확인한다.
- The user identified `/admin/` as the work section screen. Current `AppShell` includes chat and server-supplied menu ordering but lacks the requested six-item work section. 프로젝트·드라이브 계획 문서는 있으나 현재 체크아웃과 운영 버전의 차이를 확인해야 한다.
- Both supplied URLs were inaccessible through the external browsing tool. URL로 적용 대상은 확정했으나 운영 화면을 직접 확인한 상태는 아니다. 현재 브랜치는 `docs/rpt-260921b`이며 해당 기능이 있는 소스 기준점을 구현 전에 확인한다.
- Teacher-only calendar visibility is confirmed. 추가 세 항목을 포함한 갱신 계획은 사용자의 “계획대로 구현”으로 2026-11-24 승인되었다.

## 6. References (참조)

- [Implementation plan and UI layout (작업 계획·화면 구성안)](../plan/PLN-261124-teacher-portal-calendar.md)
- [Role portal design §4.4 (역할별 일정 설계)](../plan/PLN-260706-acm-portal-accounts-and-role-portals.md)
- [Current standard (현재 표준)](../standard/SPEC.md)

## 7. Implementation Baseline (구현 기준점)

2026-11-24 fetched `origin/main` at `bc2803c`; implementation branch: `feat/portal-visibility-261124`. 최신 main에는 내 정보 타임존 UI와 업무 관리 여섯 메뉴가 있다. 캘린더 메뉴는 이전 요구로 모든 역할에서 숨겨진 상태여서 강사에게만 복원한다. 위 초기 확인 결과는 원래 작업 폴더의 이전 브랜치 기준이다. 운영 URL은 네트워크/브라우저 연결 문제로 직접 검증하지 못했다.

Implementation and verification (구현·검증): [RPT-261124](../report/RPT-261124-portal-visibility.md).

## 8. Work List Correction (업무목록 정정)

The user clarified “업무목록은 링크임 기존 문서 사용안함. 수정”. 이 지시가 이전 문서 메뉴 대응 확인을 대체한다. [기존 업무목록 설계](REQ-261026B-custom-menu-embed.md)에 따라 `/acm/me/menus`가 반환하는 WORK 그룹의 업무목록 사용자 링크를 맨 위에 표시한다. URL·EMBED/LINK·새 탭 설정을 유지하며, 권한으로 반환되지 않은 항목을 새로 만들거나 하드코딩하지 않는다. 기존 문서 메뉴는 사이드바에서 제외한다.
