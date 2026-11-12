---
document_id: REQ-261112H
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 결정: 탭 순서 유지(개요·문서·이슈), 이슈 탭 기본 선택. 구현
  - 2026-11-12 v1.0.0 — 현황 조사·변경안 (사용자 확인 대기)
---

# REQ-261112H Project detail opens on Issues tab (프로젝트 첫 화면 = 이슈 목록)

## 1. Request (요청)
`/admin/projects/{id}` — 프로젝트를 선택했을 때 첫 화면을 이슈 목록 화면으로 변경한다.

## 2. Current State (현황, main `9ce59fd`)
- `frontend-acm/src/modules/prj/project-page.tsx`: `?tab=` 이 없으면 **개요(overview)** 탭. 탭 순서 = 개요 · 문서 · 이슈.
- `?tab=` 없이 들어오는 경로: 프로젝트 목록 카드, 프로젝트 생성 직후, 내 업무의 프로젝트 이동 → 지금은 모두 개요로 열림.
- `?tab=issues` / `?tab=documents` 를 붙인 링크(이슈 상세의 프로젝트 링크, 문서 화면 등)는 영향 없음.

## 3. Requirements (요구사항)
| ID | 내용 |
|----|------|
| R1 | `?tab=` 이 없으면 이슈 탭으로 연다 |
| R2 | 개요·문서 탭은 그대로 선택 가능, `?tab=overview` 링크도 그대로 동작 |
| R3 | 탭 순서는 사용자 결정에 따름 |

## 4. Out of Scope (범위 밖)
- 백엔드·DB 변경 없음
