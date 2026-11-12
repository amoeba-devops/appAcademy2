---
document_id: PLN-261112K
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112K Invite soft delete (초대 소프트삭제)

Related: [REQ-261112K](../analysis/REQ-261112K-invite-soft-delete.md)

## 1. Screen Layout (화면 구성안) — /admin/config/invites
```
[대기] [수락] [만료] [취소] [전체]
┌ 홍길동 a@x.com  관리자  [대기]          [재발송] [취소] [삭제] ┐
│ 김철수 b@x.com  직원    [수락] 11-10 가입               [삭제] │
│ 이영희 c@x.com  직원    [취소]                          [삭제] │
└──────────────────────────────────────────────────────────────┘
[삭제] → "초대를 삭제할까요? 목록에서 사라지고, 대기 중이면 링크도 더는 쓸 수 없습니다.
          이미 만들어진 계정에는 영향이 없습니다."  [취소] [삭제]
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | `sql/acm/1065-acm-user-invite-soft-delete.sql` | `inv_deleted_at`, `inv_deleted_by` |
| 2 | `user-invite.service` | `remove()` — PENDING 이면 REVOKED + 삭제 표시, 목록·재발송·취소·토큰 조회에서 삭제 제외 |
| 3 | `user-invite.controller` | `DELETE /acm/admin/invites/:id` |
| 4 | `invites-page.tsx` + i18n 4개 | [삭제] 버튼·확인 창 |

## 3. Verification (검증)
- 통합 테스트(it-user-invite): 삭제 → 목록 제외, 대기 초대 링크 무효, 재발송 404
- tsc·build

## 4. Result (결과, 2026-11-12)
- 통합 테스트(it-user-invite) 4건 통과: 삭제 → 전체 목록 제외, 대기 링크 무효(REVOKED), 재발송·재삭제 거부, 같은 이메일 재초대 가능
- backend tsc, frontend tsc·lint·build 통과
