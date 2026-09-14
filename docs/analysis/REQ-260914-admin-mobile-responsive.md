---
document_id: SYS-REQ-260914
version: 0.2.0
status: CONFIRMED — 전 화면 일괄 적용 / 데스크톱 펼침 기본 / 표는 가로 스크롤 (2026-09-14 사용자 확정)
date: 2026-09-14
change_log:
  - 2026-09-14 v0.1.0 초안 — 관리자 콘솔 모바일 최적화 (사이드바 아이콘 모드 + 컨텐츠 반응형) (Claude Code)
---

# REQ-260914 — 관리자 콘솔 모바일 최적화 / Admin Console Mobile Optimization

## 1. Requirement (요구사항)

`https://acm.amoeba.site/admin/*` 관리자 콘솔을 모바일에서 쓸 수 있게 한다.

- **R-1** 관리자 콘솔 화면 **모바일 최적화**
- **R-2** 좌측 메뉴 패널 **아이콘만 보기** 기능
- **R-3** 우측 컨텐츠 화면 **미디어쿼리 반응형** 적용

## 2. As-Is (현행 — 2026-09-14 코드 실측)

### 2.1 셸(AppShell) — 반응형 없음

[app-shell.tsx](../../frontend-acm/src/components/layout/app-shell.tsx) 는 고정 레이아웃이다.

| 요소 | 현재 | 문제 |
|---|---|---|
| 사이드바 | `fixed left-0 w-sidebar` (**240px 고정**) | 375px 화면에서 폭의 64%를 차지 |
| 본문 | `ml-sidebar mt-header p-6` | 모바일 실사용 폭 **≈111px** |
| 헤더 | `h-header`(56px), 브랜드 + 언어 선택 | 메뉴 토글 버튼 없음 |
| 접기/펴기 | **없음** | 아이콘 모드·드로어 모두 미구현 |
| 사이드바 항목 | 최대 18개 + 하단 사용자/로그아웃 | 모바일에서 세로 스크롤 과다 |

`viewport` 메타는 이미 설정돼 있어(`width=device-width`) 별도 작업 불필요.

### 2.2 컨텐츠 — 부분적으로만 반응형

`frontend-acm/src/modules` 기준 실측:

| 지표 | 수치 |
|---|---|
| 모듈 내 tsx 파일 | 142 |
| `md:`/`lg:` 브레이크포인트를 쓰는 파일 | **33** (23%) |
| `<table>` 을 쓰는 파일 | 28 |
| 그중 가로 스크롤(`overflow-x-auto`) 미적용 | **11** |

가로 스크롤이 없어 모바일에서 레이아웃이 깨지는 파일:

```
ref/components/level-test-list.tsx      ref/components/benchmark-list.tsx
ref/components/guideline-list.tsx       sch/pages/school-list-page.tsx
dsh/components/kpi-summary-cards.tsx    cls/components/cls-table.tsx
qna/pages/qna-categories-page.tsx       qna/pages/qna-list-page.tsx
csl/components/intake-stage-panel.tsx   csl/components/level-test-score-editor.tsx
```

> `my/pages/dashboard-page.tsx` 도 같은 문제가 있으나 학부모 포털(`/my/*`)이라 §5 범위 외로 둔다.

### 2.3 개별 화면

| 화면 | 현황 |
|---|---|
| 대시보드(`/admin/dashboard`) | KPI 카드만 `sm:grid-cols-2 lg:grid-cols-4` 적용. 기간 필터 `w-[160px]` 고정, 하단 표 `min-w-full` — 모바일에서 넘침 |
| 신규상담 목록 | 9열 테이블, `overflow-x-auto` 있음(가로 스크롤 가능) |
| 신규상담 칸반 | 6열 그리드 — 모바일 가독성 낮음 |
| 수업일정(캘린더) | 월/주 그리드 7열 고정 |
| 다이얼로그 | `DialogContent` 가 `w-full max-w-lg` — 모바일에서 `p-6` 여백 때문에 실사용 폭 부족. 개별 화면에서 `max-w-3xl~5xl` 을 34곳에서 덮어씀 |

## 3. To-Be (목표)

### 3.1 브레이크포인트 정책 (Tailwind 기본값)

| 구간 | 폭 | 사이드바 | 본문 |
|---|---|---|---|
| Mobile | `< 768px` (`< md`) | **오프캔버스 드로어** (헤더 햄버거로 열기) | 전체 폭, 패딩 축소 |
| Tablet | `768 ~ 1023px` (`md`) | **아이콘 모드 고정**(64px) | 나머지 폭 |
| Desktop | `≥ 1024px` (`lg`) | **펼침(240px) ↔ 아이콘(64px) 토글** — 사용자 선택 유지 | 나머지 폭 |

### 3.2 사이드바 아이콘 모드 (R-2)

- 라벨 숨김, 아이콘만 64px 폭으로 중앙 정렬
- 마우스 오버 시 툴팁(라벨), 스크린리더용 `aria-label` 유지
- 채팅 미읽음 배지는 숫자 대신 **점(dot)** 으로 축소
- 하단 사용자 이메일 숨김, 로그아웃은 아이콘만
- 토글 상태는 **localStorage 에 유지**(zustand persist — 기존 auth.store 와 동일 방식)

### 3.3 컨텐츠 반응형 (R-3)

- 본문 패딩 `p-6` → `p-3 sm:p-4 lg:p-6`
- **모든 표를 가로 스크롤 컨테이너로** 감싼다 (미적용 11개 파일)
- 필터/검색 바: `flex-wrap` + 고정폭(`w-[160px]`) → `w-full sm:w-[160px]`
- 다이얼로그: 모바일에서 여백 축소 + `max-h` 스크롤
- 대시보드·칸반·캘린더 등 주요 화면 개별 조정

## 4. Acceptance Criteria (인수 조건)

- **AC-1** 375px(iPhone SE) 폭에서 `/admin/*` 주요 화면에 **가로 스크롤(body)이 생기지 않는다.** 표·칸반 등 넓은 요소는 자체 컨테이너 안에서만 가로 스크롤된다.
- **AC-2** 모바일에서 햄버거로 메뉴를 열고 닫을 수 있으며, 메뉴 선택·ESC·오버레이 탭으로 닫힌다.
- **AC-3** 데스크톱에서 사이드바를 아이콘 모드로 접을 수 있고, 새로고침 후에도 유지된다.
- **AC-4** 아이콘 모드에서 각 메뉴의 라벨을 툴팁으로 확인할 수 있고, 스크린리더가 메뉴명을 읽는다.
- **AC-5** 태블릿(768~1023px)에서 사이드바가 아이콘 모드로 표시된다.
- **AC-6** 기존 데스크톱(≥1280px) 레이아웃은 시각적으로 변하지 않는다.

## 5. Out of Scope (범위 외)

- 포털(`/my/*`, `/web/*`) 및 학부모 화면 — 별도 요구 시 진행
- 네이티브 앱 / PWA 전환
- 화면별 정보구조(IA) 재설계 — 이번엔 레이아웃 대응만
- 모바일 전용 화면 신규 제작

## 6. Decisions (확정 — 2026-09-14)

| Q | 결정 |
|---|---|
| Q-1 적용 범위 | **전 화면 일괄** (P1~P4) |
| Q-2 데스크톱 기본값 | **펼침 유지** — 접힘은 사용자가 토글, localStorage 에 저장 |
| Q-3 모바일 표 | **가로 스크롤** — 카드형 전환은 하지 않음 |
