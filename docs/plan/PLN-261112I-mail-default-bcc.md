---
document_id: PLN-261112I
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포 + 운영 값 입력), 구현
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112I Default BCC on outgoing mail (메일 기본 숨은참조)

Related: [REQ-261112I](../analysis/REQ-261112I-mail-default-bcc.md)

## 1. Screen Layout (화면 구성안) — /admin/config/mail
```
┌ 메일 설정 ───────────────────────────────────────────────┐
│ SMTP 호스트 [smtp.gmail.com]      포트 [587]              │
│ ☐ SSL/TLS                                                 │
│ 사용자명 [...]                    앱 비밀번호 [••••]       │
│ 보내는 사람 이름 [...]            보내는 주소 [...]        │
│ 운영자 알림 수신 이메일 [ops@…, manager@…]                │
│ 기본 숨은참조(BCC)  [tpiyeri@tpiglobal.network        ]  ← 새 항목
│  시스템이 보내는 메일의 사본을 이 주소로 몰래 보냅니다.     │
│  받는 사람에게는 보이지 않습니다. 쉼표로 여러 명, 비우면    │
│  보내지 않습니다. 사용자 초대·임시 비밀번호 메일은 제외.    │
│ ☑ 사용                                                    │
│                                             [저장]        │
└──────────────────────────────────────────────────────────┘
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | `sql/acm/1063-mail-config-default-bcc.sql` | `mlc_default_bcc VARCHAR(500)` (IF NOT EXISTS) |
| 2 | entity · DTO · `MailConfigService` | `defaultBcc` 읽기/저장(쉼표 정리·이메일 형식 검사), `getDefaultBcc(entId)` |
| 3 | `MailerService.SendMailInput` | `bcc?: string[]` 추가, nodemailer 로 전달 |
| 4 | `TenantMailerService.send(entId, input, opts?)` | 기본 BCC 조회 → 받는 사람 제외 → BCC 부착. `opts.skipDefaultBcc` 시 생략. env fallback·테스트 발송에도 적용 |
| 5 | `user-invite` · `password-reset` | `{ skipDefaultBcc: true }` 전달 |
| 6 | `mail-config-page.tsx` · hook · i18n 4개 | 입력 칸 + 안내 문구 |
| 7 | 운영 값 | 배포 후 설정 화면에서 입력 (또는 승인 후 UPDATE 1건) |

## 3. Verification (검증)
- unit: BCC 부착, 받는 사람 중복 제거, skip 옵션, 미설정 시 BCC 없음, env fallback
- build/tsc, 로컬 SQL 마이그레이션 적용 확인

## 4. Result (결과, 2026-11-12)
- 단위 테스트 5건(BCC 부착·받는 사람/중복 제외·skip·미설정) 포함 acm-system 45건 통과, backend tsc·frontend build 통과
- 1063 마이그레이션 로컬 트랜잭션 적용·재적용(멱등) 확인 후 ROLLBACK
- DTO: 쉼표 구분 이메일만 허용(빈 값 허용)
