---
document_id: SYS-PLN-260902B
version: 1.1.0
status: DONE (2026-09-02 구현 완료)
date: 2026-09-02
depends_on: docs/analysis/REQ-260902B-mail-config-admin.md
change_log:
  - 2026-09-02 v1.1.0 구현 완료. 계획 대비 변경 — B4 transporter ent별 캐시 대신 호출마다 생성(레포의 테넌트 설정 무캐시 read-per-use 관행 준수, 발송량 소규모)
  - 2026-09-02 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260902B — Gmail SMTP 관리자 설정 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 `/admin/config` 랜딩 — 카드 1장 추가

```
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ 🔐 AMA 연동    │ │ 🎥 BODA 연동   │ │ ✉️ 메일(SMTP)  │  ← 신규
│ SSO·시크릿     │ │ 화상강의실     │ │ Gmail 발송 설정 │
└───────────────┘ └───────────────┘ └───────────────┘
```

### 1.2 `/admin/config/mail` — 설정 페이지 (AMA 페이지와 동일 톤)

```
┌─ ✉️ 메일(SMTP) 설정 ────────────────────────────────────────┐
│ SMTP 호스트  [smtp.gmail.com     ]   포트 [587]  □ SSL(465)  │
│ Gmail 주소(SMTP 사용자) [academy@gmail.com            ]      │
│ 앱 비밀번호  [•••••••• (설정됨 — 변경 시에만 입력)      ]      │
│   ℹ️ Google 계정 2단계 인증 → 앱 비밀번호 16자리 발급 필요      │
│ 발신자 이름  [트리니티 아카데미   ]                           │
│ 발신 주소    [(비우면 Gmail 주소 사용)               ]        │
│ ☑ 사용(발송 활성화)                                         │
│ ────────────────────────────────────────────────────────  │
│ 테스트 발송  [recipient@example.com      ] [테스트 발송]      │
│   → ✅ 발송 성공 / ❌ 실패: Invalid login (535)              │
│                                    [취소]  [저장]           │
└───────────────────────────────────────────────────────────┘
```

- 앱 비밀번호는 **재표시 안 함**(isSet placeholder), 미입력 저장 시 기존값 유지 (AMA 패턴).
- 테스트 발송은 저장된 설정 기준(미저장 변경분 있으면 저장 유도).

## 2. Backend (acm-system 모듈)

| # | 항목 | 내용 |
|---|------|------|
| B1 | DDL `sql/acm/1005-acm-mail-config.sql` | `amb_acm_mail_config` — `mlc_id` PK, `ent_id` UNIQUE, `mlc_host`(200, def smtp.gmail.com), `mlc_port`(int, def 587), `mlc_secure` bool, `mlc_username`(200), `mlc_password_enc` BYTEA, `mlc_from_name`(100), `mlc_from_address`(200), `mlc_is_active` bool, timestamps + `set_acm_updated_at` 트리거 |
| B2 | Entity + `MailConfigService` | findByEntId / upsertByEntId(부분 갱신, 비밀번호 undefined 시 유지) / `getTransport(entId)` → 복호화된 접속정보 또는 null. 암호화는 기존 `[iv(12)][tag(16)][ct]` 코덱 재사용 |
| B3 | `MailConfigController` | `GET/PUT /api/acm/admin/mail-config` (ADMIN) — 응답에 `passwordIsSet`만, 평문 금지. `POST /api/acm/admin/mail-config/test` `{to}` — 테스트 발송, 성공/오류 메시지 반환 |
| B4 | `TenantMailerService` (acm-system, export) | `isConfigured(entId)` / `send(entId, input)` — DB 설정(active) 우선, 없으면 기존 env `MailerService` fallback. nodemailer transporter는 ent별 캐시 + 설정 저장 시 무효화 |
| B5 | 소비처 전환 | `FeedbackMailerService`(3곳)·`InviteeNotifierService`(2곳) → `TenantMailerService` 사용으로 변경 (acm-cal이 AcmSystemModule import) |

새 마이그레이션 1건(멱등) — 배포 시 CD가 자동 적용, 로컬만 수동.

## 3. Frontend (frontend-acm)

| # | 파일 | 내용 |
|---|------|------|
| F1 | `cfg/pages/mail-config-page.tsx` 신규 | §1.2 폼 (ama-config-page 패턴: useState, 시크릿 isSet placeholder) + 테스트 발송 |
| F2 | `cfg/hooks/use-mail-config.ts` 신규 | GET/PUT/`test` React Query 훅 |
| F3 | `config-landing-page.tsx` + `router.tsx` | 카드·라우트 `config/mail` 추가 |
| F4 | i18n `common.json` `config.mail.*` | 4 locale 동시 |

## 4. Order & Verification (순서·검증)

1. B1~B4 → 로컬 1005 적용 → B5 전환 → `tsc`
2. F1~F4 → `tsc`·build
3. 로컬 e2e: 설정 저장(마스킹·유지 확인) → 목 SMTP로 테스트 발송 → 피드백 메일 발송이 DB 설정 경유 확인 → env fallback 회귀 확인
4. PR → 머지 → staging/production 배포 → 프로덕션 `/admin/config/mail`에서 실제 Gmail 앱 비밀번호 입력·테스트 발송(운영자)

리스크: Gmail 일일 발송 한도(무료 ~500통/일), 앱 비밀번호 오입력 시 535 오류 — 테스트 발송 버튼으로 즉시 확인 가능.
