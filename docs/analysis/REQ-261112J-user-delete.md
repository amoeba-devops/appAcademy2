---
document_id: REQ-261112J
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현. ICS 가져오기 소유자는 완전삭제 거부(409) 추가
  - 2026-11-12 v1.0.0 — initial (사용자 결정 반영)
---

# REQ-261112J Console user delete (콘솔 사용자 삭제)

## 1. Overview (개요)
- `/system/tenants/{entId}` 테넌트 사용자 관리 — **완전삭제** (APP_ADMIN)
- `/admin/config/admins` 관리자 관리 — **소프트삭제** + 삭제됨 보기·복구 (CONFIG_ADMIN)
- 서비스 안 선택 목록에서 삭제·잠금 사용자를 숨김

## 2. Current State (현재)
- `amb_acm_user` 에 삭제 개념 없음 (상태 ACTIVE/INACTIVE, 잠금 `usr_locked_at`). 운영: 전원 ACTIVE, 잠금 4명
- `(ent_id, usr_email)` UNIQUE — 같은 이메일 재등록 불가
- 선택 목록(`/acm/prj/people` 담당자·참여자·멘션, `/acm/talk/candidates`)은 ACTIVE 만, 잠금 사용자는 보임
- FK: permission CASCADE, staff/teacher SET NULL, ics_source NO ACTION. 나머지 이력(이슈·일정·로그)은 FK 없는 uuid

## 3. Requirements (요구사항)
| ID | Requirement |
|---|---|
| FR-1 | 관리자 관리: [삭제] → `usr_status='DELETED'`, `usr_deleted_at/by` 기록. 로그인·SSO 로그인 거부, 다음 토큰 갱신 시 세션 종료 |
| FR-2 | 관리자 관리 목록 기본은 삭제 사용자 제외, "삭제됨" 필터로 보기 + [복구] |
| FR-3 | 삭제한 이메일로 새 계정 초대·등록 허용 (이메일 유일성은 삭제 안 된 계정끼리만). 복구 시 같은 이메일의 다른 계정이 있으면 409 |
| FR-4 | 삭제된 AMA SSO 사용자는 SSO 로 자동 재생성되지 않고 로그인 거부(복구 필요) |
| FR-5 | 테넌트 화면: [삭제] → 완전삭제. 이메일 입력 확인. 개인 데이터(권한·프로젝트/드라이브 멤버·알림함·푸시 구독·알림 설정·채팅 멤버·비밀번호 요청·OAuth·ICS 구독) 함께 삭제, 이력(이슈·일정·로그)은 남고 이름은 빈칸 |
| FR-6 | 테넌트 화면 목록은 소프트삭제 사용자도 "삭제됨" 표시로 보여 완전삭제 가능 |
| FR-7 | 자기 자신·APP_ADMIN 은 삭제 불가 |
| FR-8 | 선택 목록에서 삭제·잠금 사용자 숨김 (프로젝트/이슈/드라이브 사용자, 채팅 후보), 프로젝트 멤버 목록에서 삭제 사용자 숨김 |

## 4. Decisions (사용자 결정, 2026-11-12)
- 테넌트 화면은 완전삭제, 관리자 관리는 소프트삭제
- 삭제됨 보기 + 복구
- 같은 이메일로 새 계정 재등록 허용
- 잠금 사용자도 선택 목록에서 숨김
