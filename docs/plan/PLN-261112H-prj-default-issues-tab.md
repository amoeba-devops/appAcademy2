---
document_id: PLN-261112H
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 결정: 탭 순서 유지(개요·문서·이슈), 이슈 탭 기본 선택. 구현
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112H Project detail default tab = Issues (프로젝트 첫 화면 이슈 탭)

Related: [REQ-261112H](../analysis/REQ-261112H-prj-default-issues-tab.md)

## 1. Screen Layout (화면 구성안)
```
지금 /admin/projects/{id}                    바뀐 뒤 /admin/projects/{id}
┌ TPI 운영 ────────────────────────┐          ┌ TPI 운영 ─────────────────────────────────────────┐
│ 개요 │ 문서 3 │ 이슈 12           │          │ (A) 이슈 12 │ 개요 │ 문서 3   ← 이슈를 맨 앞으로     │
│ ▔▔▔▔                              │    →     │     ▔▔▔▔▔▔                                         │
│ (개요: 설명·참여자·최근 활동…)     │          │ [검색][목록|칸반]…          │ 프로젝트 타임라인    │
└──────────────────────────────────┘          │ 이슈 카드 …                 │ …                    │
                                              └────────────────────────────────────────────────────┘
                                              (B) 순서 유지: 개요 │ 문서 3 │ 이슈 12 (이슈 탭 선택 상태)
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | `project-page.tsx` | 기본 탭 `overview` → `issues` (`?tab=` 없을 때) |
| 2 | — | 탭 순서는 유지(B, 사용자 결정) |

## 3. Verification (검증)
- build, Playwright 목 데이터: `/admin/projects/{id}` → 이슈 탭 선택·목록 표시, `?tab=overview` 개요 표시

## 4. Result (결과, 2026-11-12)
- build 통과. Playwright(목 데이터): `/admin/projects/{id}` → 이슈 탭 선택·이슈 3건·타임라인 표시, `?tab=overview` → 개요
