---
document_id: PLN-260701-csl-kanban-view
version: 0.1.0
status: Draft
created: 2026-07-01
related: docs/analysis/REQ-260701-csl-kanban-view.md
---

# PLN-260701 — 작업계획서

## WBS

| ID | Task | 영역 | 효(d) |
|---|---|---|---|
| T-01 | `<CslViewToggle>` 컴포넌트 (List/Kanban seg control + localStorage) | FE | 0.15 |
| T-02 | `<CslKanbanBoard inquiries>` 컴포넌트 — 6 columns + DROPPED footer | FE | 0.4 |
| T-03 | `<CslKanbanCard>` — 카드 layout + 클릭 → detail 이동 | FE | 0.15 |
| T-04 | csl-list-page 통합 — data fetch 공유 + view mode 분기 | FE | 0.1 |
| T-05 | i18n 4 locale — `csl:view.list`, `csl:view.kanban`, `csl:kanban.*` 라벨 | FE | 0.1 |
| T-06 | 반응형 QA — md+ 6 columns / sm 스택 확인 | FE | 0.1 |

**총**: ~1 man-day. 단일 PR. FE-only. 백엔드/DB 변경 0.

## 마일스톤

M1 렌더 → M2 반응형+i18n → M3 검증 (스크린샷).

## 리스크

- **null**: inquiry 개수 많을 때 (수백+) 렌더 성능. MVP 는 client-side partition → 어차피 목록 API 가 반환하는 만큼만 렌더. 페이지네이션 도입 시 별도 REQ.
- **모바일 (sm)**: 세로 스택으로 접혀서 UX 저하 가능. 초기 진입 view = list (mobile 감지) 로 완화.
