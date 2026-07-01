---
document_id: REQ-260701-csl-kanban-view
version: 0.1.0
status: Draft
created: 2026-07-01
product_code: ACM
title: CSL 신규상담 목록 — 진행 상태별 칸반보드 뷰 추가
modules:
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - frontend-acm/src/modules/csl/pages/csl-list-page.tsx
  - docs/design/DSN-260626-acm-csl-pipeline-revision.md §4 (SCR-CSL-*)
change_log:
  - { version: 0.1.0, date: 2026-07-01, author: Claude, notes: "초안" }
---

# REQ-260701 — CSL 신규상담 칸반보드 뷰

## 1. Overview

현 `/admin/csl` 는 **테이블 목록 뷰** 만 제공. 운영자는 진행 단계 파악을 위해 매 행의 stage 칼럼을 읽어야 하고, "지금 몇 명이 결제 대기인지" 같은 카운트를 눈으로 세야 함.

칸반 뷰 를 추가해 진행 상태별 즉시 파악 + 각 카드 클릭으로 상세 이동. 데이터/백엔드는 변경 없음 — 순수 프론트엔드 렌더 추가.

## 2. Functional Requirements

### FR-K01 · View toggle

리스트 페이지 상단에 **List** ↔ **Kanban** 토글 (아이콘 or 세그먼트 컨트롤). 선택 상태를 `localStorage.csl.viewMode` 에 저장, 새로고침 후 유지.

### FR-K02 · Kanban 6 columns

|  | column | badge color (기존 매핑 재사용) |
|---|---|---|
| 1 | 1. 접수 (INTAKE) | accent |
| 2 | 2. 레벨테스트 (MAP_TEST) | accent |
| 3 | 3. 데모수업 (TRIAL_CLASS) | accent |
| 4 | 4. 등록상담 (ENROLLMENT_COUNSELING) | accent |
| 5 | 5. 결제 (PAYMENT) | amber |
| 6 | 6. 수강시작 (CLASS_STARTED) | emerald |

DROPPED (탈락) 는 별도 folded footer 로 접혀 있음 (기본 collapsed) — 아카이빙 성격.

### FR-K03 · Card content

- 학생 이름 (또는 익명 seqNo)
- 학교 · 학년 (짧게, truncate)
- 유입경로 · 신청유형 배지
- 접수일 · 팔로우업일 (있을 때만)
- 클릭 → `/admin/csl/<id>` 상세로 이동 (list 뷰와 동일 UX)

### FR-K04 · Column header

- 단계명 + 현재 카드 개수 badge
- 사용자 필터/정렬 없음 (MVP) — 필터 필요 시 별도 REQ

### FR-K05 · 반응형 + Empty state

- md+ 에서 6 column 가로 스크롤 없이 표시 (min-width 200px per col)
- sm 에서 세로 스택
- 빈 column 은 "카드 없음" placeholder

## 3. Non-Functional

- 4 locale — column 라벨은 기존 `csl:stage.*` 재사용
- 성능 — inquiry 목록은 이미 `/acm/csl/inquiries` 한 번 fetch → 클라이언트에서 partition
- 드래그-드롭 stage 전환은 **out of scope** (별도 REQ, workflow guard 재검토 필요)

## 4. UI Mockup (칸반 뷰)

```
┌─ 신규 상담 ─────────────────────── [🗂 List] [▦ Kanban]  [+ 신규 등록] ─┐
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌── 1.접수(3) ──┐┌── 2.레벨테스트(2) ┐┌── 3.데모수업(1) ┐┌── 4.등록상담(0) ┐│
│ │┌───────────┐ ││┌───────────┐   ││┌───────────┐   ││                 ││
│ ││ 홍길동 #12 │ │││ 김민지 #10│   │││ 이수민 #8 │   ││   카드 없음     ││
│ ││ 개포중/M2 │ │││ 신동중/M3 │   │││ 개포고/H1 │   ││                 ││
│ ││ 홈페이지  │ │││ 카카오    │   │││ 홈페이지  │   ││                 ││
│ ││ 07-01     │ │││ 06-28     │   │││ 06-25     │   ││                 ││
│ │└───────────┘ ││└───────────┘   ││└───────────┘   ││                 ││
│ │┌───────────┐ ││┌───────────┐   ││                ││                 ││
│ ││ 박수현 #11│ │││ 이지훈 #9 │   ││                ││                 ││
│ ││ 개포중/M1 │ │││ 개포중/M1 │   ││                ││                 ││
│ ││ 전화      │ │││ 홈페이지  │   ││                ││                 ││
│ ││ 07-01     │ │││ 06-27     │   ││                ││                 ││
│ │└───────────┘ ││└───────────┘   ││                ││                 ││
│ │┌───────────┐ │                                                       ││
│ ││ 최수아 #6 │ │                                                       ││
│ ││ ...       │ │                                                       ││
│ │└───────────┘ │                                                       ││
│ └──────────────┘                                                        │
│                                                                         │
│ ┌── 5.결제(2) ──┐┌── 6.수강시작(1) ┐                                    │
│ │  ...          ││  ...            │                                    │
│                                                                         │
│ ▶ 탈락 · DROPPED (5)  ← 클릭 시 펼침 (기본 접힘)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 5. Out of Scope

- Drag-drop 으로 stage 전환
- 정렬 / 필터 / 검색 (칸반 뷰 내)
- 카드 hover preview
- Real-time 갱신 (WebSocket)

## 6. Acceptance Criteria

- AC-1: `/admin/csl` 상단 view toggle 이 List / Kanban 전환. 새로고침 후 상태 유지 (localStorage)
- AC-2: Kanban 모드 시 6 stage column + DROPPED collapsed footer 표시
- AC-3: 각 column 헤더에 카드 수 badge
- AC-4: 카드 클릭 → 상세 페이지로 이동 (list 뷰와 동일)
- AC-5: 4 locale (ko/en/vi/zh-CN) 라벨 정상
- AC-6: md+ 에서 6 column horizontal fit, sm 에서 세로 스택
