---
document_id: REQ-261112M
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현
  - 2026-11-12 v1.0.0 — initial (사용자 결정: 관리·선택 목록 모두, 본인에게는 보임)
---

# REQ-261112M Hide tenant master from lists (테넌트 마스터 목록 비노출)

## 1. Overview (개요)
테넌트 마스터(`TENANT_MASTER` 권한, 운영: admin@tpi.co.kr)는 사이트 안 관리자 목록에 보이지 않게 한다.

## 2. Requirements (요구사항)
| ID | Requirement |
|---|---|
| FR-1 | 서비스 설정 › 관리자 관리(`/admin/config/admins`) 목록·삭제됨 보기에서 제외 |
| FR-2 | 등록 사용자(`/admin/config/invites`) 목록과 건수에서 제외 |
| FR-3 | 선택 목록에서 제외: 프로젝트·이슈 담당자/참여자/멘션, 공용 드라이브 멤버(`/acm/prj/people`), 채팅 참여자 후보(`/acm/talk/candidates`) |
| FR-4 | 테넌트 마스터 본인이 로그인했을 때는 본인 행이 보인다 |
| FR-5 | 로그인·권한·알림, 이미 들어간 담당자·멤버 기록, 시스템 테넌트 화면(APP_ADMIN)은 그대로 |
