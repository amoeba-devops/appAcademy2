---
document_id: ACM-TEACHER-CALENDAR-PLN-1.2.0
version: 1.2.0
status: implemented_locally
change_log:
  - version: 1.2.0
    date: 2026-11-24
    description: Correct work list to the existing custom link and remove the document sidebar entry.
  - version: 1.1.0
    date: 2026-11-24
    description: Expand UI layout and verification to all four portal and navigation requirements.
  - version: 1.0.0
    date: 2026-11-24
    description: Propose teacher calendar verification, implementation, and UI layout.
---

# Portal Visibility and Navigation Plan (포털 노출·목록·메뉴 작업 계획)

## 1. Outcome (목표)

Make the existing portal calendar visible and usable for teachers under the [requirements](../analysis/REQ-261124-teacher-portal-calendar.md).
강사만 캘린더를 볼 수 있게 하고, 강사·학생 타임존 UI, 강사 수강생 목록, 업무 관리 메뉴 순서를 갱신 요구에 맞춘다.

## 2. UI Layout (화면 구성안)

Reuse the existing portal layout. 기존 포털과 캘린더 구성을 유지한다.

```text
포털                                      강사 · 로그인 ID
┌ 메뉴 ─────────┬───────────────────────────────────────┐
│ 공지사항      │ [<] 2026년 11월 [>] [오늘]            │
│ 수업일정 ◀    │                 [월] [주] [일] [목록] │
│ 수강생관리    │ 일   월   화   수   목   금   토       │
│ 자료실        │ …                                     │
│ 채팅          │ 24  [담당·초대 일정]                  │
│               │ …                                     │
└───────────────┴───────────────────────────────────────┘
일정 선택 → 기존 일정 상세
일정 없음 → 캘린더 유지, 기존 빈 일정 안내
조회 실패 → 오류 안내와 재시도

학생·학부모 포털: 수업일정 메뉴 숨김 / 캘린더 목록 직접 진입 제한
강사·학생 > 내 정보 (/portal/me): 사용자 지정 타임존 항목 숨김

강사 > 수강생관리                  [전체보기 □]
기본: 퇴원생 제외 / 전체보기 선택: 퇴원생 포함
[학생 A] [학생 B] …               (기존 카드 구성 유지)

관리자 (/admin/) > 업무 관리
  업무목록
  이슈
  내 업무
  프로젝트
  드라이브
  채팅
```

## 3. Implementation Steps (구현 순서)

1. Reproduce teacher navigation and direct URL access, checking the trailing slash. 강사 포털 세션·라우트 가드·메뉴·API 응답을 확인해 화면 미표시와 일정 미조회를 구분한다. 운영 재현 가능 여부도 기록한다.
2. Check teacher account kind/refId and its correspondence to assignee/invitee IDs. 강사 계정 연결을 확인하며 원인 증거 없이 운영 데이터나 인증 정책을 변경하지 않는다.
3. Apply the smallest necessary fix in `frontend-acm/src/`; if the cause is in the API, adjust the relevant `backend/src/modules/acm-auth` or `acm-cal` code while preserving tenant isolation. 기존 작업 변경을 보존한다.
4. Keep calendar rendering for empty results and add a distinguishable error/retry state where needed. 학생·학부모의 캘린더 메뉴와 목록 페이지는 숨기고 직접 진입도 제한한다. 다른 화면에서 사용하는 일정 상세·자료 API 권한은 일괄 변경하지 않는다.
5. Hide custom user timezone controls for TEACHER and STUDENT on `/portal/me`, as identified by the user. 운영 버전에 해당하는 내 정보 화면 소스를 확인해 숨김 조건을 적용하며 기존 시간 데이터·시간 변환·관리자 테넌트 설정은 유지한다.
6. Add a default-off all-view control to the teacher student list. 기본 목록/API 조회는 WITHDRAWN 제외, 전체보기는 본인 관련 학생 범위 내 퇴원생 포함이다. 캐시 키에 보기 조건을 반영한다. 상세 권한 검사에 기본 표시 필터가 적용돼 퇴원생 상세가 막히지 않도록 한다. 대상은 포털 페이지/API와 `acm-std`의 portal-teacher-students 컨트롤러·서비스다.
7. Reorder the work section on `/admin/`, including any server-supplied order. 기존 메뉴별 권한·URL을 보존하며 데스크톱·모바일 순서를 일치시킨다. 현재 브랜치 `docs/rpt-260921b`에는 해당 여섯 메뉴 구성이 없어 운영 버전 소스와 기준점을 먼저 확인한다. 관련 없는 기존 변경은 보존한다.

## 4. Verification (검증)

| Scenario (시나리오) | Expected result (기대 결과) |
| --- | --- |
| Teacher menu/direct URL/refresh | Calendar displayed, including trailing slash URL |
| Assigned/invited events | Related events and authorized details visible |
| Unrelated event/other tenant | Excluded from list; detail access denied |
| No events | Calendar remains visible with empty state |
| Request failure | Error feedback with retry, distinguishable from no events |
| Month/week/day/list | Navigation and event selection work |
| Student/parent calendar | Menu hidden and direct list-page access restricted |
| Custom timezone | Hidden for teacher/student; existing stored values and time conversion preserved |
| Student list default | WITHDRAWN excluded; other statuses follow existing behavior |
| Student list all | Withdrawn included within authorized scope; details accessible |
| View switching | Cache does not mix default/all results |
| Work section | 업무목록 → 이슈 → 내 업무 → 프로젝트 → 드라이브 → 채팅; same on mobile |

Run affected type checks/builds and targeted authorization tests where code changes require them. 구현 후 변경 범위에 맞는 타입 검사·빌드·권한 테스트와 화면 확인을 수행하고, 결과와 운영 환경 미확인 항목을 보고한다.

## 5. Approval Gate (구현 전 확인)

The user approved this revised plan with “계획대로 구현” on 2026-11-24.
2026-11-24 사용자 승인으로 최신 `origin/main` (`bc2803c`) 기반 별도 브랜치 `feat/portal-visibility-261124`에서 구현한다. 기존 작업 폴더의 변경은 보존한다.

[AGENTS.md §9.2](../../AGENTS.md) requires (원문): 「요구사항 분석서 + 작업 계획서 작성 후 **반드시 사용자 확인을 받은 후** 구현으로 진행한다.」
Implementation and local verification are complete in the isolated worktree; production has not been deployed. 별도 작업 폴더에서 구현·로컬 검증을 완료했으며 운영 배포는 하지 않았다.

## 6. Implementation Decisions (구현 결정)

- Latest main contains `/portal/me` and the six-item work section. 최초 작업 폴더의 이전 브랜치와 달리 최신 소스에서 적용 위치를 확인했다.
- The latest user correction supersedes the earlier document-menu mapping. 업무목록은 REQ-261026B의 기존 사용자 링크이며 저장된 URL·열기 방식을 유지해 업무관리 맨 위에 표시한다. 기존 문서 메뉴는 사이드바에서 제외한다.
- Existing saved tenant order is normalized for the five built-in work entries, with the authorized work-list custom link pinned first. 메뉴별 숨김·역할 조건과 다른 그룹 순서는 유지한다. 업무목록 외 사용자 메뉴는 기존 위치를 유지한다.
- Custom timezone UI is hidden only for teacher/student portal sessions. 학원 기준 시간대는 계속 표시하고 학부모·콘솔 설정 및 저장된 시간값은 유지한다.

Implementation and verification (구현·검증): [RPT-261124](../report/RPT-261124-portal-visibility.md).
