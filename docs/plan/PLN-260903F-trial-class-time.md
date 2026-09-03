---
document_id: CSL-PLN-260903F
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903F-trial-class-time.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료 — 로컬 e2e(당일 14:00→05:00Z, 시간변경 동기화, 삭제 자가복구 재생성, 1008 교정+멱등) 통과, 링커 spec 갱신 포함 acm-csl 83건 통과
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903F — 데모수업 시간설정 수정 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안 — 데모수업 행 수정 폼)

```
┌─ 데모수업 #1 ───────────────────────────────────────────┐
│ 2026-09-03 · 14:00 · 김강사        [수정] [피드백]        │
│ ── 수정 모드 ──                                          │
│ 날짜 [2026-09-03] 시간 [14:00 ▼] 강사 [김강사 ▼]  ← 날짜 추가│
│                                  [취소] [저장]           │
└────────────────────────────────────────────────────────┘
※ 저장 후에도 시간이 그대로 표시됨(빈 값 버그 수정),
  캘린더·강사 포털에 설정한 그 시각(KST)으로 표시됨
```

## 2. Backend

| # | 항목 | 내용 |
|---|------|------|
| B1 | `acm-common/time/zoned-time.util.ts` 신규 | `zonedDateTimeToUtc(dateStr, timeStr, tz)` — Intl 2-pass 오프셋 보정(프론트 lib/tz 와 동일 알고리즘, DST 안전) |
| B2 | `csl-cal-linker.service.ts` | `TenantSettingsService` 주입(acm-csl 이 AcmSystemModule import). naive 문자열 대신 `zonedDateTimeToUtc(scheduledAt, time, tz)` → UTC ISO, 종료 = +3,600,000ms. `addOneHour` 제거 |
| B3 | 링커 update 경로 | `calEventId` 존재 시: 이벤트 로드 → 있으면 시작/종료 **update**, 삭제·부재면 **재생성 후 id 교체**. 데모수업·레벨테스트 공통, 실패 무시(swallow) 정책 유지 |
| B4 | `sql/acm/1008-fix-csl-linked-event-times.sql` | 멱등 복구 — `tcl_cal_event_id`/`mpt_cal_event_id` 로 연결된 미삭제 이벤트의 `evt_start_at` 을 CSL 원본으로 재계산: `(held_at + held_time) AT TIME ZONE 'Asia/Seoul'`, `evt_end_at = + interval '1 hour'`. 원본 기준 재계산이라 재실행·수동수정 무관 결정론적 |

## 3. Frontend (frontend-acm — `trial-class-panel.tsx`)

| # | 항목 | 내용 |
|---|------|------|
| F1 | 시간 select 정규화 | 초기값 `slice(0,5)` + props 변경 시 `useEffect` 재동기화 (level-test-schedule-dialog 패턴). 빈 select 로 저장 시 no-op 되던 함정 제거 |
| F2 | 날짜 수정 | 행 수정 폼에 `heldAt` date 입력 추가 → PATCH 에 포함 (링커 update 경로로 캘린더 동기화) |

## 4. Order & Verification (순서·검증)

1. B1(유틸+단위 확인) → B2~B3 → `tsc` + acm-csl·acm-cal spec
2. 로컬 e2e: 데모수업 오늘 14:00 등록 → cal 이벤트 `evt_start_at = 05:00Z`(=14:00 KST) 확인 → 시간 15:30 으로 변경 → 이벤트 06:30Z 갱신 확인 → 이벤트 삭제 후 재변경 → 재생성 확인. 레벨테스트 동일 1회
3. B4 로컬 적용: 어긋난 기존 이벤트 시각 재계산 확인
4. F1~F2 → build → 패널에서 당일 등록·저장 후 표시 유지 확인 → PR

리스크: 1008 이 연동 이벤트 시각을 일괄 재계산 — 원본(held_at/time)이 진실이므로 안전하나, 운영자가 캘린더에서 **일정만** 수동 수정해둔 케이스가 있다면 원본 기준으로 되돌아감(원본이 정답이라는 전제 — 데모/레벨테스트 시각의 진실은 CSL 패널). 예상 규모: 백엔드 ~4파일+SQL 1, 프론트 1파일.
