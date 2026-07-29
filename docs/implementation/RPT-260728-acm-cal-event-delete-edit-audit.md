---
document_id: RPT-260728-acm-cal-event-delete-edit-audit
version: 1.0.0
status: complete
created: 2026-07-28
basis:
  - docs/analysis/REQ-260728-acm-cal-event-delete-edit-audit.md
  - docs/plan/PLN-260728-acm-cal-event-delete-edit-audit.md
---

# 완료 보고서 — 수업일정 삭제 사유 · 삭제목록 · 수정 히스토리 (REQ-260728)

> PLN-260728 T1–T8 구현 완료. soft-delete·캘린더 숨김·인가는 재사용, **삭제 사유 / 삭제목록 보기 /
> 수정 사유 · 히스토리**를 추가. BE `nest build` clean, FE `tsc`/`vite build` clean, JSON 4 locale 유효.

## 1. 변경 요약

| 트랙 | 내용 |
|:--:|---|
| T1 | 마이그레이션 `999i` — `evt_delete_reason`·`evt_deleted_by` + `amb_acm_cal_event_revision`(append-only) 테이블 + 인덱스. 엔티티 2 |
| T2 | 삭제 — `DeleteCalEventDto{reason}`(필수), `remove()` 가 사유·삭제자 기록 |
| T3 | 수정 — `evtEditReason`(필수), `update()` 가 변경 diff 계산 → revision 1건 기록(변경 필드 있을 때만). 시스템 자동수정(BODA URL) 제외 |
| T4 | 조회 — list `deletedOnly` 파라미터 + 삭제 메타(사유·삭제자명·시각) 직렬화, `GET /:id/revisions`(시간역순) |
| T5 | FE 삭제 사유 프롬프트(모달 내), `useDeleteCalEvent({id,reason})` |
| T6 | FE `/admin/cal` **‘삭제한 수업일정 보기’** 토글 → 삭제 목록 테이블(제목·기간·사유·삭제자·시각) |
| T7 | FE 수정 모달에 **수정 사유(필수)** 필드 + **수정 히스토리 패널**(수정자·시각·사유·변경요약) |
| T8 | cal 네임스페이스 i18n ×4(delete/edit/revision/deleted) |

## 2. 결정 반영 (REQ Q-1~Q-4)
- 삭제 주체: **현행 유지**(ADMIN + 작성자 본인 MANUAL) + **사유 필수**.
- 수정 사유: **필수**(시스템 자동수정 제외).
- 삭제 사유는 이벤트 컬럼 / 수정은 revision 테이블(분리).
- **복원 미포함** — 삭제 목록 열람 전용.

## 3. 변경 파일
**BE**: `sql/acm/999i-*.sql` · `cal-event.typeorm-entity.ts` · `cal-event-revision.typeorm-entity.ts`(신규) · `acm-cal.module.ts` · `cal-event.service.ts` · `cal-event.controller.ts` · `dto/cal-event.dto.ts`
**FE**: `types.ts` · `hooks/use-cal-events.ts` · `components/cal-event-modal.tsx` · `pages/cal-month-page.tsx` · `i18n/locales/{ko,en,vi,zh-CN}/cal.json`

## 4. 검증
- BE `nest build` clean, eslint 경고만(기존). FE `tsc --noEmit` + `vite build` clean. cal.json 4 locale 유효.
- 마이그레이션 CD step4 멱등 자동 적용.
- 무회귀: update 는 모달 단일 경로(다른 caller 없음 확인) → 수정 사유 필수화 안전.

## 5. 남은 확인(운영)
- 삭제 사유 입력 → 캘린더에서 사라짐 → ‘삭제한 수업일정 보기’ 목록에 사유·삭제자·시각 표시.
- 일정 수정 → 히스토리 1건(변경요약) 기록·열람.
</content>
