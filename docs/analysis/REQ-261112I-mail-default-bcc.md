---
document_id: REQ-261112I
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포 + 운영 값 입력), 구현
  - 2026-11-12 v1.0.0 — initial (사용자 결정: 설정 화면 항목·계정 메일 제외·BCC)
---

# REQ-261112I Default BCC on outgoing mail (메일 발송 기본 숨은참조)

## 1. Overview (개요)
Every mail the system sends must also be copied to `tpiyeri@tpiglobal.network`.
시스템이 보내는 메일을 tpiyeri@tpiglobal.network 에도 사본으로 보낸다.

## 2. Current State (현재)
- All mail goes through `TenantMailerService.send(entId, …)` — tenant SMTP config (`amb_acm_mail_config`), env `MailerService` fallback.
- Production: one tenant config (smtp.gmail.com, active). No CC/BCC support.

| Mail (메일) | Source | Recipient |
|---|---|---|
| 일정 안내 / 수업 링크 변경 | `invitee-notifier.service.ts` | 일정 참석자 |
| 수업 피드백 | `feedback-mailer.service.ts` | 학부모·학생 |
| MAP TEST 접수 확인 / 운영자 알림 | `map-apply-notifier.service.ts` | 신청자 / 운영자 |
| 메일 설정 테스트 | `tenant-mailer.service.ts` | 입력 주소 |
| 사용자 초대 | `user-invite.service.ts` | 초대 대상 |
| 임시 비밀번호 | `password-reset.service.ts` | 요청 사용자 |

## 3. Requirements (요구사항)
| ID | Requirement |
|---|---|
| FR-1 | `/admin/config/mail` 에 "기본 숨은참조(BCC)" 항목 추가 — 쉼표로 여러 주소, 비우면 사본 없음 |
| FR-2 | 설정된 주소를 **BCC** 로 모든 메일에 붙인다 (받는 사람에게 보이지 않음) |
| FR-3 | 사용자 초대·임시 비밀번호 메일은 제외 (비밀번호·초대 링크 제3자 전달 방지) |
| FR-4 | 받는 사람과 같은 주소는 BCC 에서 뺀다 (중복 수신 방지) |
| FR-5 | 메일 설정이 비활성이라 env fallback 으로 보내도 같은 BCC 를 적용 |
| FR-6 | 운영 값: TPI 테넌트 BCC = `tpiyeri@tpiglobal.network` |

## 4. Decisions (사용자 결정, 2026-11-12)
- 위치: 메일 설정 화면 항목 (코드 고정 아님)
- 계정 메일(초대·임시 비밀번호) 제외
- CC 대신 숨은참조(BCC)
