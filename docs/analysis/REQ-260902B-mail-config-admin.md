---
document_id: SYS-REQ-260902B
version: 1.1.0
status: CONFIRMED (2026-09-02 사용자 확정)
date: 2026-09-02
change_log:
  - 2026-09-02 v1.1.0 사용자 확정("진행") 반영
  - 2026-09-02 v1.0.0 최초 작성 (Claude Code)
---

# REQ-260902B — /admin/config Gmail SMTP 설정 기능 / Admin-managed Gmail SMTP Settings

## 1. Overview (개요)

메일 발송(SMTP) 설정을 서버 환경변수가 아니라 **관리자 설정페이지(`/admin/config`)에서 테넌트별로 관리**하게 한다. 1차 대상은 Gmail SMTP. 설정 즉시 피드백 학부모 메일(REQ-260902)·캘린더 초대 메일이 발송 가능해진다.

## 2. Current State (현행)

- `MailerService`는 env(`SMTP_*`) 전용 부팅 시 싱글턴 — **설정 UI 없음**.
- 프로덕션/스테이징 compose에 SMTP env 전달 자체가 없어 현재 NO-OP(발송 불가) 상태.
- 설정 저장 선례: `/admin/config/ama` — `amb_acm_ama_config` (ent별 1행, 시크릿은 `ACM_PII_KEY` AES-256-GCM `[iv][tag][ct]` BYTEA, 응답은 `*IsSet` 부울만 반환, 미입력 시 기존값 유지). BODA 설정도 동일 구조.
- 메일 소비처는 2곳: `FeedbackMailerService`(피드백 학부모 메일), `InviteeNotifierService`(일정 초대 메일).

## 3. Requirements (요구사항)

| ID | 요구사항 |
|----|---------|
| FR-1 | `/admin/config`에 "메일(SMTP)" 카드 추가 → `/admin/config/mail` 설정 페이지 (ADMIN 전용) |
| FR-2 | 설정 항목: 호스트(기본 `smtp.gmail.com`)·포트(기본 587)·SSL 여부·Gmail 주소(SMTP 사용자)·**앱 비밀번호**(암호화 저장, 재조회 불가·isSet 표시)·발신자 이름·발신 주소(비우면 Gmail 주소)·사용 여부 |
| FR-3 | **테스트 발송** — 수신 주소 입력 후 저장된(또는 입력 중) 설정으로 테스트 메일 발송, 성공/실패 즉시 표시 |
| FR-4 | 발송 경로 전환 — 피드백 메일·초대 메일이 **테넌트 DB 설정 우선**, 없으면 기존 env fallback 으로 발송 |
| FR-5 | 앱 비밀번호는 AES-256-GCM 암호화 저장(AMA 패턴 재사용), 로그·응답에 평문 노출 금지 |
| NFR | i18n 4 locale 동시 반영, 신규 테이블은 PG 컨벤션(5.1) 준수 |

## 4. Out of Scope (범위 외)

- Gmail OAuth2(XOAUTH2) 방식 — 앱 비밀번호 방식만 1차 지원
- 발송 큐·재시도, 수신(IMAP), 조직 Stalwart 메일서버 연동 자동화(설정값으로는 입력 가능)

## 5. Notes (참고)

- Gmail 준비물: 발신 계정 2단계 인증 + **앱 비밀번호 16자리** (일반 비밀번호 불가), `smtp.gmail.com:587` STARTTLS.
- Gmail은 From을 계정 주소로 강제 재작성하므로 발신 주소는 보통 Gmail 주소와 동일하게 사용.
- `ACM_PII_KEY`는 프로덕션에 이미 설정되어 있음(AMA SSO가 사용 중) — 추가 env 작업 불필요.
