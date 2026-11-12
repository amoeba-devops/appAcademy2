---
document_id: PLN-261112L
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112L Registered users — edit/delete (등록 사용자 수정·삭제)

Related: [REQ-261112L](../analysis/REQ-261112L-registered-user-edit-delete.md)

## 1. Screen Layout (화면 구성안) — /admin/config/invites (등록 사용자 탭)
```
이름(링크 유지)  로그인ID         유형  로그인   표시      등록일   최근 로그인     
홍길동           a@tpi.co.kr      관리자 AMA    서비스운영 …        …          [수정] [삭제]
김강사 →/admin/tch t@tpi.co.kr    강사   로컬            …        …          [수정] [삭제]
이학생 →/admin/std/… s@mail.com  학생   포털            …        …          [수정] [삭제]

[수정] 콘솔 → 관리자 관리 상세 창 재사용 (강사는 등급 '강사' 고정)
[수정] 포털 → ┌ 이학생 · 포털 계정 ─────────────┐
               │ 로그인ID s@mail.com              │
               │ 상태 [사용 ▾ / 중지]     [저장]  │
               │ 비밀번호 [새 비밀번호(선택)] [재발급] │
               └──────────────────────────────────┘
[삭제] → 확인 창 → 소프트삭제 (모바일 카드에도 같은 버튼)
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | `sql/acm/1066-acm-portal-account-soft-delete.sql` | `pac_deleted_at`, `pac_deleted_by` |
| 2 | `admin-user.service` | 대상 등급에 TEACHER 추가(목록은 관리자·직원 유지), 강사 등급 변경 거부 |
| 3 | `portal-account.service` | `setStatus`, `softDelete`; `getByRef` 삭제 제외; `issue` 는 삭제 계정 되살림; `ensureAccount` 는 되살리지 않음 |
| 4 | `RegisteredUserController` (CONFIG_ADMIN) | `PATCH/DELETE portal/:id`, `POST portal/:id/reset` |
| 5 | `registered-user.service` | 포털 삭제 계정 제외 |
| 6 | `registered-users.tsx` · `admin-users-page.tsx`(상세 창 export) · i18n 4개 | 버튼·편집 창 |

## 3. Verification (검증)
- 통합: 강사 콘솔 계정 수정·삭제, 포털 상태 중지→로그인 거부, 삭제→목록 제외·getByRef null·재발급 되살림, ensureAccount 미복구
- tsc·build

## 4. Result (결과, 2026-11-12)
- 삭제된 강사 콘솔 계정도 관리자 관리 "삭제됨"에서 복구 가능(삭제됨 보기만 강사 포함)
- 등록 사용자 건수(탭 숫자)가 삭제 계정을 세던 문제 함께 수정(REQ-261112J 누락분)
- 통합 테스트 it-registered-users·it-admin-users 12건 통과(강사 수정·등급 고정 403·삭제, 포털 상태·재발급·삭제·getByRef 미노출·재발급 되살림)
- backend tsc, frontend tsc·lint·build 통과
