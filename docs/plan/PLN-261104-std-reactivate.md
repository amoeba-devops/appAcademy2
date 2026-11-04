---
document_id: PLN-261104
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-04 v1.1.0 — confirmed and implemented
  - 2026-11-04 v1.0.0 — initial plan with UI mockup
---

# PLN-261104 Reactivate Archived Student (작업 계획)

Ref: [REQ-261104](../analysis/REQ-261104-std-reactivate.md)

## 1. UI Mockup (화면 구성안)

### 1.1 비활성화 목록 `/admin/std/archived`
```
비활성화 목록
← 목록으로   삭제 이력
┌────────┬──────────────────┬────────┬──────────────────────────────────┐
│ 학생   │ 처리일시          │ 담당자 │ 관리                              │
├────────┼──────────────────┼────────┼──────────────────────────────────┤
│ 김익용 │ 2026.9.18 14:02  │ 관리자 │ [다시 활성화] [내용 확인 / 완전삭제] │
└────────┴──────────────────┴────────┴──────────────────────────────────┘
```

### 1.2 확인창
```
┌ 다시 활성화 ────────────────────────────────┐
│ 김익용 학생을 다시 활성화합니다.              │
│ 학생 목록에 다시 나타나며, 상태·배정 강사·     │
│ 상담·수업·수납 기록은 비활성화 전 그대로입니다. │
│                       [취소] [다시 활성화]    │
└─────────────────────────────────────────────┘
```
- 완료 후: "김익용 학생을 다시 활성화했습니다. [학생 보기]" 안내, 목록에서 제거.
- 삭제 이력 처리유형: 비활성화 / 다시 활성화 / 완전삭제.
- 모바일: 관리 열 버튼 세로 배치.

## 2. Tasks (작업)
| # | 작업 | 위치 |
|---|------|------|
| T1 | 마이그레이션 `1057-std-deletion-restore.sql`: `sdh_action` CHECK 에 `RESTORE` 추가(멱등) | `sql/acm/` |
| T2 | `StudentDeletionService.restore(u, id)`: 권한 확인·행 잠금·archived 비움·이력 `RESTORE` | `student-deletion.service.ts` |
| T3 | `POST /api/acm/std/deletion/:id/restore` | `student-deletion.controller.ts` |
| T4 | 목록 [다시 활성화] + 확인창 + 완료 안내, 이력 처리유형 표시 | `student-deletion.tsx` |
| T5 | i18n 4개 언어, 통합 테스트(복구·상태 보존·이력·권한 403·재실행 안전), type-check·build, 로컬 화면 확인 | — |

## 3. Result (결과)
- `1057-std-deletion-restore.sql`: `sdh_action` CHECK = ARCHIVE·RESTORE·PURGE (운영 제약 이름 `amb_acm_std_deletion_history_sdh_action_check` 확인 후 DROP/ADD, 멱등).
- `StudentDeletionService.restore` + `POST /api/acm/std/deletion/:id/restore` — 비활성화와 같은 권한·행 잠금, 이미 활성이면 그대로 성공.
- 목록 [다시 활성화] → 확인창 → 완료 안내 [학생 보기], 삭제 이력 처리유형 "다시 활성화". i18n 4개 언어.
- 확인:
  - 통합 테스트 `it-std-reactivate` 2건(상태 WITHDRAWN·배정 강사 보존, 목록 제외, 이력 RESTORE/ARCHIVE·처리자, 재실행 안전, 권한 없는 관리자 403, 다른 테넌트 거부), backend tsc, frontend type-check.
  - 로컬 화면: 비활성화 목록 버튼·확인창·완료 안내, 학생 상세(퇴원 상태 유지), 삭제 이력 "다시 활성화".
  - 로컬에서 이력 화면이 한 번 "불러오는 중"에 멈춤 — 실시간 알림 연결 3개가 HTTP/1.1 동시 연결 6개 중 일부를 계속 차지해 생기는 로컬 개발 서버 현상(서버 직접 호출은 즉시 200). 운영은 HTTP/2.
