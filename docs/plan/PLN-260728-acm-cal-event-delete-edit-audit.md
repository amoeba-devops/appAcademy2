---
document_id: PLN-260728-acm-cal-event-delete-edit-audit
version: 1.0.0
status: draft
created: 2026-07-28
authors:
  - Claude (Opus 4.8)
basis: docs/analysis/REQ-260728-acm-cal-event-delete-edit-audit.md (FR-1~5)
decisions:
  - Q-1: 삭제 주체 = 현행 유지(ADMIN + 작성자 본인 MANUAL) + 삭제 사유 필수
  - Q-2: 수정 사유 필수 (시스템 자동수정 제외)
  - Q-3: 삭제 사유는 이벤트 컬럼 / 수정은 revision 테이블(분리)
  - Q-4: 복원(restore) 미포함 — 열람만
change_log:
  - 2026-07-28: v1.0.0 draft
---

# 작업계획서 — 수업일정 삭제 사유 · 삭제목록 · 수정 히스토리 (PLN)

> [REQ-260728](../analysis/REQ-260728-acm-cal-event-delete-edit-audit.md) 을 8 트랙으로 구현한다.
> soft-delete·캘린더 숨김·인가(`assertCanMutate`)는 **재사용**하고, **삭제 사유 / 삭제목록 보기 /
> 수정 사유 · 히스토리**만 추가한다.

---

## 1. 트랙 개요 (8 tracks)

| 트랙 | 범위 | 산출물 | 의존 |
|:--:|------|--------|:--:|
| **T1** | 스키마 — 삭제 사유/삭제자 컬럼 + revision 테이블 | 마이그레이션 1 + 엔티티 2 | — |
| **T2** | BE 삭제 — `remove(reason)` 필수 사유 | DTO/service/controller | T1 |
| **T3** | BE 수정 — `update(reason)` + revision 기록(변경 diff) | service + revision writer | T1 |
| **T4** | BE 조회 — list `deletedOnly` + 삭제목록 직렬화 + 히스토리 endpoint | service/controller/DTO | T1–T3 |
| **T5** | FE 삭제 사유 모달 | delete-reason 모달 | T2 |
| **T6** | FE 캘린더 "삭제한 수업일정 보기" 토글 + 삭제 목록 | 캘린더 페이지 | T4 |
| **T7** | FE 수정 사유 입력 + 히스토리 패널 | cal-event-modal | T3·T4 |
| **T8** | i18n ×4 + 빌드/타입체크 | — | 전체 |

---

## 2. 트랙 상세

### T1 — 스키마
`sql/acm/999i-acm-cal-event-delete-edit-audit.sql` (멱등, CD 자동적용):
```sql
ALTER TABLE amb_acm_cal_event
  ADD COLUMN IF NOT EXISTS evt_delete_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS evt_deleted_by UUID;

CREATE TABLE IF NOT EXISTS amb_acm_cal_event_revision (
  rev_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  evt_id UUID NOT NULL,
  rev_editor_user_id UUID,
  rev_reason VARCHAR(500),
  rev_changes JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acm_cal_evt_rev_evt
  ON amb_acm_cal_event_revision (evt_id, created_at DESC);
```
- 엔티티: `cal-event.typeorm-entity.ts` 에 `deleteReason`·`deletedBy` / 신규 `cal-event-revision.typeorm-entity.ts`.
- ✅ AC: 기존 행 무영향, non-prefixed `created_at`(cal 컨벤션) 사용.

### T2 — BE 삭제(사유 필수)
- `DeleteCalEventDto { reason: string (2~500, 필수) }` → controller `@Delete(':id')` 가 `@Body()` 수신.
- `remove(entId, actor, role, id, reason)`: `assertCanMutate`(현행) 후 `deletedAt`·`deleteReason=reason`·`deletedBy=actor` 저장. BODASCHOOL close 유지.
- ✅ AC-1/2/6: 사유 없으면 400, 인가자만, soft-delete + 사유 기록.

### T3 — BE 수정(사유 + 히스토리)
- `UpdateCalEventDto` 에 `evtEditReason: string(필수, 2~500)` 추가.
- `update()`: 저장 전 **변경 필드 diff** 계산(title/시간/장소/provider/roomType/assignee/description 등 사용자 편집 필드), 저장 후 `CalEventRevision` 1건 INSERT(editor·reason·changes[]).
- **시스템 자동수정 제외**: BODA 프로비저닝의 `meetingUrl` 자동 세팅 등은 히스토리 미기록(사용자 update 경로에서만 기록).
- ✅ AC-4: 수정 시 히스토리 1건(수정자·사유·변경요약).

### T4 — BE 조회
- `ListCalEventsQueryDto` 에 `deletedOnly?: boolean`(기본 false). true 면 `deleted_at IS NOT NULL` 로 조회, 응답에 `deleteReason`·`deletedBy(name)`·`deletedAt` 포함.
- `GET /acm/cal/events/:id/revisions` — 히스토리 시간역순(수정자 이름 resolve).
- 삭제 목록/히스토리의 user_id → 이름은 기존 `lookupOwners` 재사용.
- ✅ AC-3/5.

### T5 — FE 삭제 사유 모달
- `delete-reason-modal.tsx`(또는 기존 confirm 대체): 제목 + 사유 textarea(필수) + 안내문. 확인 시 `deleteMut({ id, reason })`.
- 진입: cal-event-modal 의 삭제 버튼 → 사유 모달. (REQ §5.1 목업)
- ✅ 사유 미입력 시 확인 비활성.

### T6 — FE "삭제한 수업일정 보기"
- `/admin/cal` 헤더에 토글 버튼(REQ §5.2). ON 시 `useCalEvents({ deletedOnly:true })` 로 해당 기간 삭제 목록을 **리스트(테이블)** 로 표시(그리드 오버레이 아님).
- 항목: 제목·기간·삭제사유·삭제자·삭제시각. (복원 없음 — 열람 전용)
- ✅ AC-3.

### T7 — FE 수정 사유 + 히스토리
- cal-event-modal 수정 시 **수정 사유 입력(필수)** 필드 추가 → submit dto `evtEditReason`.
- 상세(수정) 모달 하단에 **수정 히스토리 패널**: `useCalEventRevisions(evtId)` 시간역순(수정자·시각·사유·변경요약). (REQ §5.3)
- ✅ AC-4/5.

### T8 — i18n + 검증
- cal 네임스페이스: 삭제사유·삭제목록·수정사유·히스토리 라벨 ko/en/vi/zh-CN.
- BE `tsc`/`nest build`, FE `tsc`/`vite build`, JSON 유효.

---

## 3. 화면 목업 (§9.2 — REQ §5 재수록)

**삭제 사유 모달 / 캘린더 토글+목록 / 히스토리 패널** — [REQ-260728 §5](../analysis/REQ-260728-acm-cal-event-delete-edit-audit.md) 참조(동일).

---

## 4. 테스트 계획

| 레벨 | 대상 | 예상 |
|---|---|---|
| unit(BE) | remove 사유 필수/기록, update 히스토리 diff, list deletedOnly, revisions 조회 | +6~8 |
| 회귀(BE) | 기존 create/update/list/BODA 룸 무회귀 | 기존 spec |
| FE | tsc/build (러너 없음 — 순수 로직 분리) | — |

---

## 5. 롤아웃

```
T1 스키마 → T2 삭제 → T3 수정/히스토리 → T4 조회 → T5·T6·T7 FE → T8 i18n/빌드
staging(멱등 마이그레이션 자동) → production
```
- 마이그레이션 CD step4 자동 적용([[project_deploy_auto_migrations]]).

---

## 6. Sign-off (승인 대기)
- 본 PLN 은 **draft**. **승인 후 T1 착수**(CLAUDE.md §9.2).
</content>
