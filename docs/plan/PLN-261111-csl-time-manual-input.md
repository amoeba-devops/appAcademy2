---
document_id: PLN-261111
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-11 v1.1.0 — 승인·구현. 번호 PLN-261103→PLN-261111. 목록의 직접 값 표기는 `08:40 · 직접`(좁은 칸에서 시각이 먼저 보이게)
  - 2026-11-03 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261111 Manual time input for class schedules (수업 시간 직접 입력)

Related: [REQ-261111](../analysis/REQ-261111-csl-time-manual-input.md)

## 1. Screen Layout (화면 구성안)

### 1.1 공용 시간 입력 `TimeSelectInput`
```
 시간
 ┌──────────────┐ ┌───────────┐
 │ 14:30      ▾ │ │ 14:30     │   ← 목록에서 고르면 오른쪽 칸도 같은 값
 └──────────────┘ └───────────┘
                   직접 입력 (예: 08:40)

 ── 목록에 없는 시간을 직접 입력한 경우 ──
 ┌──────────────────────┐ ┌───────────┐
 │ 08:40 · 직접       ▾ │ │ 08:40     │
 └──────────────────────┘ └───────────┘

 ── 잘못된 값 ──
 ┌──────────────┐ ┌───────────┐
 │ 14:30      ▾ │ │ 25:10     │  (빨간 테두리)
 └──────────────┘ └───────────┘
                   00:00~23:59 형식으로 입력하세요
```

### 1.2 신규 상담 › 3. 데모수업 (새 회차 추가)
```
 새 데모수업 추가
 ┌ 수업일 ─────┐ ┌ 시간 ──────────────────────┐ ┌ 강사 ──────┐
 │ 2026-11-05  │ │ [08:40 · 직접 ▾] [08:40] │ │ 김OO     ▾ │ [추가]
 └─────────────┘ └────────────────────────────┘ └────────────┘
```
레벨테스트 일정 입력·일정 변경 창, 데모수업 회차 수정도 같은 모양.

### 1.3 수업일정 › 일정 등록/수정 창
```
 📅 [2026-11-05]  🕐 [09:00 ▾] [09:00]
 → 종료일
 📅 [2026-11-05]  🕐 [10:10 · 직접 ▾] [10:10]  · 1시간 10분
```

### 1.4 버그 수정 — 수업 스케줄 · 학생 이력
```
 변경 전:  수업 예정일시 (한국 시간)
           [mm/dd/yyyy, --:-- --  📅]        ← 브라우저 기본 입력 하나

 변경 후:  수업 예정일시 (한국 시간)
           [2026-11-05 📅]  [14:30 ▾] [14:30]
                             시간을 입력하세요   (날짜만 있을 때)
```

## 2. Tasks (작업)
| # | 작업 | 파일 |
|---|------|------|
| T1 | `TimeSelectInput` 컴포넌트 (props: `value`, `onChange`, `slots`, `ariaLabel`, `className`) + 순수 함수 `normalizeTime`(자동 형식·검증) | `frontend-acm/src/components/ui/time-select-input.tsx` (신규) |
| T2 | 레벨테스트 일정 입력: react-hook-form `Controller` 로 연결 | `modules/csl/components/map-test-panel.tsx` |
| T3 | 레벨테스트 일정 변경 창 | `modules/csl/components/level-test-schedule-dialog.tsx` |
| T4 | 데모수업 추가·수정 | `modules/csl/components/trial-class-panel.tsx` |
| T5 | 수업일정 시작·종료 시간 (`timeOpts` 끼워넣기 대신 컴포넌트 사용) | `modules/cal/components/cal-event-modal.tsx` |
| T6 | 버그: 수업 예정일시 날짜+시간 분리 | `modules/dsh/components/lifecycle-editor.tsx` |
| T7 | 4개 언어 문구 (`common` 네임스페이스 `timeInput.*`, `dsh` `life.timeRequired`) | `i18n/locales/{ko,en,vi,zh-CN}/` |
| T8 | DTO 검증 완화 4곳 (`/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/`) | `backend/src/modules/acm-csl/application/dto/inquiry.dto.ts` |
| T9 | DB CHECK 제거 마이그레이션 (멱등) | `sql/acm/1060-csl-time-any-minute.sql` (신규) |
| T10 | 테스트: `normalizeTime` 단위 테스트, DTO `08:40` 허용·`25:00` 거부 테스트, 연동 캘린더 일정 `08:40` 시작 확인 | 기존 spec 옆 |
| T11 | 로컬 확인 후 배포, 운영에서 08:40 데모수업 저장 → 수업일정 반영 확인 (확인용 데이터는 저장 후 원래 값으로 되돌림) | — |

## 3. Risks (위험)
- 운영 DB 제약 삭제는 되돌릴 때 `08:40` 같은 기존 값 때문에 다시 추가가 실패할 수 있다 → 되돌릴 일이 있으면 DTO만 되돌린다.
- 상담 단계의 연동 캘린더 일정은 시작 시각 + 고정 길이로 만들어지므로 10분 단위 시작도 그대로 반영된다(코드 변경 없음, T10에서 확인).
