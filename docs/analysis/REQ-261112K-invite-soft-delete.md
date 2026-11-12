---
document_id: REQ-261112K
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현
  - 2026-11-12 v1.0.0 — initial
---

# REQ-261112K Invite soft delete (초대 소프트삭제)

## 1. Overview (개요)
`/admin/config/invites` 초대 목록에서 초대를 삭제(소프트삭제)할 수 있게 한다.

## 2. Current State (현재)
- `amb_acm_user_invite` 상태 PENDING / ACCEPTED / REVOKED (+ 화면상 EXPIRED). 삭제 개념 없음
- 대기·만료 초대만 [재발송]·[취소], 취소·수락·만료 내역은 목록에 계속 남음. 운영 0건

## 3. Requirements (요구사항)
| ID | Requirement |
|---|---|
| FR-1 | 모든 상태의 초대 행에 [삭제] — 확인 창 후 `inv_deleted_at/by` 기록, 목록(모든 탭)에서 숨김 |
| FR-2 | 대기 중 초대를 삭제하면 링크도 무효(REVOKED 처리 후 삭제) |
| FR-3 | 수락된 초대 삭제는 초대 기록만 숨김 — 만들어진 계정에는 영향 없음 |
| FR-4 | 삭제된 초대는 재발송·취소·수락 불가 |
