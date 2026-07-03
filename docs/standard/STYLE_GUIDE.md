---
doc_id: STD-APP-ACADEMY-STYLE-GUIDE
title: App Academy Web Style Guide
version: 1.0.0
updated: 2026-07-04
status: active
based_on:
  - docs/amoeba-starter-kit/amoeba_web_style_guide_v2.md
---

# App Academy Web Style Guide

## 1. 디자인 방향

ACM 웹은 학원 운영자가 반복적으로 사용하는 업무 도구와 학부모/방문자가 접근하는 포털을 함께 제공한다. 관리자 콘솔은 조용하고 밀도 있는 운영 UI를 우선하며, 공개 포털은 신뢰감 있는 교육 서비스 톤을 유지한다.

기본 원칙은 다음과 같다.

- 운영 화면은 데이터 스캔, 비교, 필터, 반복 작업을 빠르게 수행할 수 있어야 한다.
- 공개 포털은 브랜드와 프로그램 정보를 첫 화면에서 명확히 보여준다.
- 학부모 포털은 복잡한 관리 기능보다 자녀 정보 확인과 결제/성적/시간표 접근을 우선한다.
- 시스템 관리 화면은 교차 테넌트 작업이므로 실수 방지와 상태 명확성을 우선한다.

## 2. 디자인 토큰

현재 토큰 기준 파일은 `frontend-acm/src/styles/tokens.css`다.

| 토큰 | 값 |
| --- | --- |
| Accent 50 | `#eef2ff` |
| Accent 100 | `#e0e7ff` |
| Accent 500 | `#6366f1` |
| Accent 600 | `#4f46e5` |
| Accent 700 | `#4338ca` |
| Canvas | `--gray-50` |
| Surface | `#ffffff` |
| Text primary | `--gray-900` |
| Text secondary | `--gray-600` |
| Border subtle | `--gray-200` |
| Sidebar width | `240px` |
| Header height | `56px` |

새 색상은 토큰을 먼저 확장한 뒤 사용한다. 특정 페이지에서 임의 hex를 반복하지 않는다.

## 3. Layout

### 3.1 Admin Console

- Shell: `AppShell`
- 기본 경로: `/admin`
- 좌측 사이드바 + 상단 헤더 + 본문 구조를 유지한다.
- 본문은 넓은 테이블과 필터를 고려해 과도한 카드 장식을 피한다.
- 목록 페이지는 상단에 제목, 주요 액션, 필터, table 순서로 배치한다.
- 상세 페이지는 핵심 요약, 주요 정보, 연결 데이터 순서로 배치한다.

### 3.2 Parent Portal

- Shell: `ParentShell`
- 기본 경로: `/my`
- 모바일 사용 가능성을 높게 본다.
- 결제/성적/시간표는 한 화면에서 핵심 상태를 빠르게 확인할 수 있게 구성한다.
- 관리자 전용 용어나 내부 코드 노출을 피한다.

### 3.3 Public Portal

- Shell: `PortalLayout`
- 기본 경로: `/`, `/about`, `/programs`, `/news`
- 첫 화면에는 Trinity Academy/프로그램/공지 등 실제 서비스 대상이 명확히 보여야 한다.
- hero가 필요한 경우 텍스트 카드 중심보다 실제 콘텐츠, 프로그램, 교육 맥락을 보여주는 이미지를 우선한다.
- 포털 페이지는 마케팅 문구보다 정보 탐색과 문의 전환을 명확히 한다.

### 3.4 System Admin

- Shell: `SystemShell`
- 기본 경로: `/system`
- 교차 테넌트 작업은 현재 선택한 tenant와 권한 상태를 명확히 표시한다.
- 위험 작업은 confirm dialog를 사용한다.

## 4. Components

### 4.1 Buttons

- 공용 버튼은 `frontend-acm/src/components/ui/button.tsx`를 우선 사용한다.
- primary action은 한 화면에서 1개를 원칙으로 한다.
- destructive action은 색상과 confirm flow로 구분한다.
- 아이콘이 의미를 명확히 전달하는 경우 lucide icon을 함께 사용한다.

### 4.2 Forms

- label은 항상 입력 요소와 연결한다.
- 필수/선택 상태를 명확히 표시한다.
- validation error는 필드 가까이에 표시한다.
- 저장/취소 액션은 modal 또는 form 하단에서 일관되게 제공한다.
- 긴 form은 section으로 나누고, 중첩 card를 만들지 않는다.

### 4.3 Tables

- 관리자 목록 화면의 기본 표현은 table이다.
- filter, search, sort, pagination을 상단 또는 하단에 일관되게 배치한다.
- 상태값은 badge를 사용하되 색상만으로 의미를 전달하지 않는다.
- 행 액션은 우측에 모으고, 위험 액션은 즉시 실행하지 않는다.

### 4.4 Dialogs

- 공용 dialog는 `components/ui/dialog.tsx`를 우선 사용한다.
- 삭제/위험 작업은 `confirm-dialog.tsx`를 사용한다.
- dialog 안에 다시 card를 중첩하지 않는다.
- 모바일에서 dialog content가 화면 밖으로 넘치지 않게 한다.

### 4.5 Toast

- 성공/실패/주의 메시지는 `components/ui/toast.tsx` 패턴을 따른다.
- toast에는 사용자가 다음에 해야 할 행동을 짧게 담는다.
- 개인정보나 내부 error stack을 표시하지 않는다.

## 5. Typography

- 기본 글꼴은 기존 글로벌 CSS와 Tailwind 설정을 따른다.
- 관리자 화면 heading은 과도하게 크게 만들지 않는다.
- table, filter, form 내부 텍스트는 compact하게 유지한다.
- letter spacing은 기본값을 유지한다.
- viewport width에 따라 font-size를 직접 계산하지 않는다.

권장 크기:

| 용도 | 크기 |
| --- | --- |
| Page title | `text-xl` 또는 `text-2xl` |
| Section title | `text-lg` |
| Card/table title | `text-base` |
| Body | `text-sm` 또는 `text-base` |
| Helper/error | `text-xs` 또는 `text-sm` |

## 6. Color and Status

상태 색상은 `tokens.css`의 status token을 우선 사용한다.

| 상태 | 토큰 |
| --- | --- |
| active/success | `--status-active-*` |
| warning/pending | `--status-warning-*` |
| danger/error | `--status-danger-*` |
| neutral | gray scale |

한 화면이 단일 색상 계열로만 보이지 않도록 neutral, accent, semantic color를 균형 있게 사용한다.

## 7. Icons

- 아이콘은 `lucide-react`를 우선 사용한다.
- toolbar, action button, nav item에는 텍스트와 아이콘을 함께 쓰거나 tooltip을 제공한다.
- 아이콘 크기는 일반적으로 `16px` 또는 `20px`를 사용한다.
- 아이콘만 있는 버튼은 접근 가능한 label을 제공한다.

## 8. Responsive

- 모바일에서는 sidebar가 본문을 밀어내지 않게 처리한다.
- table은 필요한 경우 horizontal scroll 또는 card/list 대체 레이아웃을 사용한다.
- 버튼 텍스트가 좁은 화면에서 잘리지 않도록 min/max width와 wrap을 고려한다.
- 고정 포맷 UI는 aspect ratio, grid track, min/max size로 레이아웃 shift를 방지한다.

## 9. Accessibility

- 모든 interactive element는 keyboard focus가 보여야 한다.
- input에는 label 또는 aria-label이 있어야 한다.
- 색상만으로 상태를 전달하지 않는다.
- dialog는 focus trap과 escape close 동작을 유지한다.
- loading, empty, error 상태를 화면에 명확히 제공한다.

## 10. Copy and i18n

- 사용자 화면 문구는 locale 파일에 둔다.
- 관리자 화면도 가능하면 다국어 구조를 따른다.
- 버튼 문구는 동사 중심으로 짧게 쓴다.
- 내부 코드명, 테이블명, secret 이름은 사용자 화면에 노출하지 않는다.
- 외부 서비스명 AMA, BODA는 원문을 유지한다.

## 11. Page Patterns

### 11.1 List Page

목록 화면은 다음 순서를 권장한다.

1. Page title and primary action
2. Summary metrics when useful
3. Filters and search
4. Data table
5. Pagination

### 11.2 Detail Page

상세 화면은 다음 순서를 권장한다.

1. Header with title, status, actions
2. Key summary
3. Editable core information
4. Related records
5. Audit or history when available

### 11.3 Form Modal

form modal은 다음 규칙을 따른다.

- 제목은 생성/수정 목적을 명확히 쓴다.
- 입력 필드는 관련 정보끼리 묶는다.
- submit 중에는 중복 클릭을 막는다.
- 성공 후 관련 list/detail query를 갱신한다.

## 12. Do Not

- 운영 화면을 landing page처럼 과도하게 꾸미지 않는다.
- card 안에 card를 중첩하지 않는다.
- 의미 없는 gradient orb, blob, bokeh 장식을 추가하지 않는다.
- 버튼이나 badge 안의 텍스트가 잘리게 두지 않는다.
- shell별 navigation과 domain content 책임을 섞지 않는다.
- 새 페이지에서 기존 UI 컴포넌트를 무시하고 독자 스타일을 만들지 않는다.

## 13. Review Checklist

- 현재 shell과 route 영역에 맞는 화면인가?
- table/filter/form 흐름이 반복 작업에 편한가?
- 토큰 기반 색상과 공용 UI를 사용했는가?
- loading, empty, error 상태가 있는가?
- 모바일에서 텍스트와 버튼이 겹치지 않는가?
- 권한이 없는 사용자가 보는 상태가 정의되어 있는가?
- locale 문구가 필요한 파일에 반영되었는가?
