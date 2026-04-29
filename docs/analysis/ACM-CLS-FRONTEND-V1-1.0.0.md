---
document_id: ACM-CLS-FRONTEND-V1-1.0.0
version: 1.0.0
status: Approved
created: 2026-04-29
updated: 2026-04-29
author: Gray Kim
related:
  - docs/design/acm-v1.0a-adr-001.md (ADR-007 React pivot)
  - docs/design/acm-v1.0a-erd.md
  - backend/src/modules/acm-cls/
change_log:
  - version: 1.0.0
    date: 2026-04-29
    author: Gray Kim
    description: |
      Initial v1 scope for the ACM CLS (Class Management) frontend module.
      v1 covers list + detail (read-only with status transitions); v2 adds
      session/attendance/feedback/makeup dialogs; v3 adds settlement.
---

# ACM CLS — Frontend v1 Requirements & Plan (반 관리 v1 화면)

## 1. Background (배경)

ACM(`backend/src/modules/acm-cls/`) 모듈은 클래스·세션·출석·피드백·메이크업·정산까지 풀 도메인 로직을 갖춘 백엔드 6 서비스 / 24+ endpoint를 보유하고 있다. 그러나 `frontend-acm` 측은 types와 hooks(`use-classes`, `use-sessions`, `useAttendance`, `useFeedback`, `useMakeups`)만 작성된 상태이며 페이지·컴포넌트·라우트가 없다. 사이드바(`app-shell.tsx:17`)에는 `/cls` 메뉴가 등록되어 있으므로 클릭 시 `404 Not Found`가 발생한다.

본 v1 작업은 **클래스 목록 + 상세(read-only with status transition)** 까지를 커버하여 메뉴 클릭 동선을 정상화하고, ACM CLS 도메인의 기본 가시성을 확보한다.

## 2. Source Inventory (현황)

### 2.1 Backend (구현 완료)

| Controller | 핵심 endpoint | Service |
|---|---|---|
| `class.controller` (`/acm/cls/classes`) | POST · GET · GET/:id · PUT/:id · PATCH/:id/status · POST/:id/sessions/generate | `class.service` |
| `session.controller` (`/acm/cls/sessions`, `/makeups`) | sessions CRUD + reschedule/cancel/hold + attendance + feedback + makeups | `session.service`, `attendance.service`, `feedback.service`, `makeup.service` |
| `settlement.controller` (`/acm/cls/settlements`) | GET · GET/:id · POST/recompute · POST/:id/confirm | `settlement.service` |

TypeORM 엔티티: `class`, `class-student`, `recurrence`, `video-config`, `session`, `attendance`, `feedback`, `makeup`, `settlement`, `settlement-line`.

### 2.2 Frontend assets (이번 작업 전)

```
frontend-acm/src/modules/cls/
├── hooks/
│   ├── use-classes.ts     ← useClasses, useClass
│   └── use-sessions.ts    ← useSessions, useSession, useAttendance, useFeedback, useMakeups
└── types.ts               ← Class*/Session/Attendance/Feedback/Makeup/Settlement (170 lines)
```

페이지·컴포넌트·라우트 0개.

### 2.3 Domain enums (types.ts에서 발췌)

- `ClsSubjectType`: MAP_TEST · SSAT · ISEE · WRITING · LANGUAGE_ARTS · MATH · INTL_PREP · DEMO · OTHER
- `ClsStatus`: PROPOSED · ACTIVE · PAUSED · COMPLETED · CANCELLED
- `SesMode`: IN_PERSON · ONLINE · TWO_PERSON_IN_PERSON · HYBRID
- `SesStatus`: SCHEDULED · HELD · CANCELLED · RESCHEDULED · NO_SHOW · MAKEUP_REPLACEMENT
- `AttStatus`, `FbkStatus`, `MkpStatus`: 본 v1 범위 외이지만 v2에서 사용 예정

## 3. Decisions (의사결정 결과)

| ID | Topic | Decision | Rationale |
|---|---|---|---|
| **Q-CLS-01** | frontend-acm에 zh-CN locale 신설 여부 | **Yes** | 메모리 `feedback_i18n_default.md` 정책상 4 locale 필수. 본 작업 시점에 동시 추가 |
| **Q-CLS-02** | v1에 클래스 생성 다이얼로그 포함 여부 | **No** | 헤더 `+ 신규 클래스` 버튼은 placeholder. Dialog는 v2에서 CSL 패턴 재사용 |
| **Q-CLS-03** | studentName/teacherName 표시 처리 | 백엔드 DTO에 포함되어 있으면 그대로, 없으면 ID fallback. 추후 매핑 보강 | DTO 확인 결과 `teacherName?` `studentName?`이 optional로 type에 정의되어 있음 |
| **Q-CLS-04** | dev 환경 401(JWT placeholder) 처리 | 본 작업 범위 외. 빈 상태 / 에러 카드 표시까지만 보장 | AMB Core JWT 통합은 별도 트랙 |

## 4. Out of Scope (이번 작업 범위 외)

- 클래스 생성 / 수정 / 학생 추가·제외 폼
- 세션 그리드, attendance 입력, feedback 작성, makeup 처리
- 월별 정산(Settlement) 화면
- AMB Core JWT 인증 통합
- 백엔드 DTO 보강(teacherName/studentName lookup)

## 5. Acceptance Criteria (수락 기준)

1. `http://localhost:5173/cls`가 200을 반환하고, 사이드바 active 상태가 표시된다.
2. `/cls`에서 클래스 목록·필터·빈상태가 정상 렌더된다.
3. `/cls/:id`로 이동 시 클래스 정보·학생·반복일정·최근 세션 read-only 카드가 표시된다.
4. 상태 변경 드롭다운으로 PATCH `/classes/:id/status`가 호출되고 성공 시 카드가 갱신된다(낙관적 업데이트 또는 invalidate).
5. ko/en/vi/zh-CN 4 locale에서 라벨이 모두 키 기반으로 해석된다(zh-CN/vi는 ko 미러).
6. `npm run build` typecheck 통과(`tsc -b`), Vite build 성공.

## 6. Component Inventory (v1)

| File | Purpose | Type |
|---|---|---|
| `pages/cls-list-page.tsx` | `/cls` 진입 페이지 | RR Outlet child |
| `pages/cls-detail-page.tsx` | `/cls/:id` 진입 페이지 | RR Outlet child |
| `components/cls-status-badge.tsx` | ClsStatus 색상·아이콘 배지 | Pure |
| `components/cls-filters.tsx` | 상단 필터 바 (status·subject·teacher·search) | Controlled |
| `components/cls-table.tsx` | 데스크톱 표 + 모바일 카드 모드 | Pure |
| `components/cls-info-card.tsx` | 상세 Info 탭 | Pure |
| `components/cls-students-list.tsx` | 상세 Students 탭 | Pure |
| `components/cls-recurrence-list.tsx` | 상세 Schedule 탭 | Pure |
| `components/cls-recent-sessions.tsx` | 상세 Sessions 탭 (read-only) | useSessions 호출 |

## 7. UI Mockup (Desktop ≥1024px)

### 7.1 `/cls` — Class List

```
┌────────────────────────────────────────────────────────────────────┐
│ Classes                                          [+ 신규 클래스]    │
├────────────────────────────────────────────────────────────────────┤
│ [Status ▼] [Subject ▼] [Teacher ▼] [Search code/name…]              │
├────────────────────────────────────────────────────────────────────┤
│ Code      Subject     Status     Teacher       Mode      Started   │
├────────────────────────────────────────────────────────────────────┤
│ ENG-MAP-1 MAP_TEST    ● ACTIVE   Sarah Lee     ONLINE    2026-03   │
│ ISEE-PREP ISEE        ● ACTIVE   David Kim     IN_PERSON 2026-04   │
│ MATH-G7   MATH        ○ PAUSED   Sarah Lee     ONLINE    2026-02   │
│ DEMO-001  DEMO        ◌ PROPOSED -             -         -         │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 `/cls/:id` — Class Detail

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Classes                              Status: ● ACTIVE [▼]         │
│ ENG-MAP-1 (MAP_TEST · ONLINE)                                       │
│ Teacher: Sarah Lee     Started: 2026-03-01    Hourly: ₩70,000       │
├────────────────────────────────────────────────────────────────────┤
│ Tab: Info | Students | Schedule | Sessions                          │
│                                                                     │
│  Info: started-from / default-mode / video-config                   │
│  Students(N): 학생명 + joined + capacity-role                        │
│  Schedule: DAY HH:MM–HH:MM (durMin, mode), effective-from           │
│  Sessions(N): 최근 N개 세션 read-only + status badge                │
└────────────────────────────────────────────────────────────────────┘
```

### 7.3 Mobile (≤768px)

- 목록: 카드형 1열, 필터 sticky bar
- 상세: 탭 가로 스크롤 chip, 콘텐츠 stack

## 8. i18n Plan

- 신규 namespace **`cls`** 추가, 4 locale 모두 동시 작성
- ko 원문, en 영문 번역, vi/zh-CN ko 미러 (정식 번역 후속)
- frontend-acm i18n init에 `cls` namespace 등록
- frontend-acm `src/i18n/locales/` 하위에 **zh-CN/** 디렉토리 신규 생성 (Q-CLS-01)

## 9. Work Plan (작업 계획)

| Phase | 작업 | 시간 |
|---|---|---|
| 1. 인프라 | router(2 라우트) + i18n cls namespace 4 locale + zh-CN 디렉토리 신설 + i18n init 등록 | 0.5h |
| 2. 컴포넌트 | 7개 컴포넌트 작성 | 2h |
| 3. 페이지 | cls-list-page + cls-detail-page | 1h |
| 4. 검증 | 5173에서 시각 확인 + tsc/빌드 | 0.5h |
| **합계** | | **~4h** |

## 10. Open Items (미결)

| ID | Item | Status |
|---|---|---|
| Q-CLS-NEXT-01 | v2: 세션 보드 + attendance/feedback/makeup 다이얼로그 | 별도 티켓 |
| Q-CLS-NEXT-02 | v3: 정산 (settlements) 화면 | 별도 티켓 |
| Q-CLS-04 | dev JWT placeholder — 401 처리 | 별건 |
