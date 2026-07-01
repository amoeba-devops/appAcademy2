---
document_id: PLN-260630-cal-assignee-teacher
version: 0.1.0
status: Draft
created: 2026-06-30
product_code: ACM
title: REQ-260630 작업계획서 — CAL 이벤트 담당자 + CSL 자동 매핑
related:
  - docs/analysis/REQ-260630-cal-assignee-teacher.md
---

# PLN-260630 — 작업계획서

## 1. WBS

| ID | Task | 영역 | 효(d) | FR |
|----|------|------|------|-----|
| T-01 | sql/acm/991 — `evt_assignee_tch_id` 컬럼 + 인덱스 + FK | DB | 0.25 | FR-A01 |
| T-02 | TypeORM `CalEventTypeormEntity.assigneeTchId` 매핑 | BE | 0.1 | FR-A01 |
| T-03 | `CreateCalEventDto` / `UpdateCalEventDto` + `assigneeTchId?` | BE | 0.1 | FR-A04 |
| T-04 | `CalEventService.create/update` — DTO 필드 → entity, 응답 join | BE | 0.3 | FR-A04 |
| T-05 | `CslCalLinkerService.linkLevelTest/linkDemoClass` — `assigneeTchId: teacherId` 전달 | BE | 0.2 | FR-A02 |
| T-06 | unit spec — linker assignee + cal-event service | BE | 0.3 | NFR |
| T-07 | `/admin/cal` 월 뷰 카드 — 담당자 라인 추가 | FE | 0.3 | FR-A03 |
| T-08 | `/admin/cal` 상세 모달 — "담당자" 별도 행 | FE | 0.2 | FR-A03 |
| T-09 | `/admin/cal` 편집 모달 — 담당자 강사 select | FE | 0.3 | FR-A03 |
| T-10 | i18n 4 locale `cal:detail.assignee*` | FE | 0.1 | NFR |

**총**: ~2.4 d. 1 PR.

## 2. UI 목업 — [REQ-260630 §4 참조]

## 3. 마일스톤

| M | 기준 |
|---|------|
| M1 BE | sql + entity + DTO + service + linker + spec green |
| M2 FE | 3 모드 (카드 / 상세 / 편집) + i18n 4 locale |
| M3 검증 | 운영자 staging 매트릭스 |

## 4. 검증 매트릭스

- /admin/csl/&lt;inq&gt; 2단계 schedule → 강사 지정 → 저장 → CAL 이벤트에 담당자 채워짐
- 3단계 데모수업 동일
- /admin/cal 월 뷰 + 상세 + 편집 — 담당자 표시/변경 정상
- 4 locale 토글
- 강사 미지정 row → 담당자 빈 상태 (오류 없음)
