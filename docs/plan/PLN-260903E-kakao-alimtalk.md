---
document_id: CAL-PLN-260903E
version: 1.1.0
status: DONE (2026-09-03 구현 완료 — 실발송은 운영 설정 후)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903E-feedback-sms-alimtalk-review.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료 — 로컬 e2e: 설정 저장·마스킹·유지, 테스트 발송이 실제 Solapi API 도달(원문 검증오류 왕복 확인), send-alimtalk 수신자별 결과·notification_log(ALIMTALK) 기록 확인. 실발송(SENT)은 운영 자격증명·템플릿 승인 후 프로덕션 테스트 버튼으로
  - 2026-09-03 v1.0.0 작성 — 대행사 Solapi 확정, 구현 착수
---

# PLN-260903E — 피드백 카카오 알림톡 발송 (Solapi) 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 `/admin/config` — "💬 카카오 알림톡" 카드 → `/admin/config/kakao`

```
┌─ 💬 카카오 알림톡 설정 (Solapi) ────────────────────────────┐
│ API Key    [NCSAYU7Y…      ]                              │
│ API Secret [•••••• (설정됨 — 변경 시에만 입력)]              │
│ 발신프로필 키(pfId)  [KA01PF…            ]                  │
│ 템플릿 ID           [KA01TP…            ]                  │
│  ℹ️ 템플릿 변수: #{학원명} #{학생명} #{수업명} #{일시}          │
│ 대체발송 발신번호   [025551234  ] ☐ 실패 시 SMS 대체발송      │
│ ☑ 사용                                                    │
│ ─────────────────────────────────────────────            │
│ 테스트 발송 [01012345678  ] [테스트 발송] → ✅/❌ 사유        │
│                                   [취소] [저장]            │
└──────────────────────────────────────────────────────────┘
```

### 1.2 피드백 발송 모달 — 알림톡 채널 추가

```
│ ☑ 홍길동 · 모 김영희 [대표]  kim@e.com · 010-1234-5678      │
│ ☑ 이철수 · 부 이아빠        lee@e.com · (전화 없음)          │
│ …                                                         │
│            [취소]  [💬 알림톡 발송 (1명)]  [✉️ 메일 발송 (2명)] │
│  발송 후: 행 우측에 채널별 결과 (💬 발송됨 / 💬 전화 없음 등)     │
```

## 2. Backend

| # | 항목 | 내용 |
|---|------|------|
| B1 | DDL `sql/acm/1009-acm-kakao-config.sql` | `amb_acm_kakao_config`(kkc_) — ent UNIQUE, api_key, api_secret_enc BYTEA(AES-GCM), pf_id, template_id, sender_phone, sms_fallback bool, is_active, timestamps |
| B2 | acm-system: `KakaoConfigService` | mail-config 패턴 — isSet 마스킹·부분 갱신·`getSendConfig(entId)` 복호화 |
| B3 | acm-system: `SolapiAlimtalkService` | `POST https://api.solapi.com/messages/v4/send-many/detail`, `Authorization: HMAC-SHA256 apiKey,date,salt,signature(HMAC(secret, date+salt))`, message `{to, from, type:'ATA', kakaoOptions:{pfId, templateId, variables:{"#{학생명}":…}, disableSms}}`. `isConfigured`/`send`/`sendTest`. failedMessageList 사유 반환 |
| B4 | `GET/PUT /acm/admin/kakao-config` + `POST …/test` (ADMIN) | mail-config 컨트롤러 패턴 |
| B5 | acm-cal 피드백 | recipients 응답에 `phone`·`alimtalkConfigured` 추가. `POST /acm/cal/events/:id/review/send-alimtalk` — 수신자 재검증, 변수(#{학원명}=tnt_name, #{학생명},#{수업명},#{일시}=테넌트 TZ) 발송, 결과 SENT/NO_PHONE/FAILED, notification_log(channel=ALIMTALK) |

## 3. Frontend

| # | 항목 |
|---|------|
| F1 | `kakao-config-page.tsx` + `use-kakao-config.ts` + 랜딩 카드·라우트 `config/kakao` |
| F2 | `feedback-email-dialog.tsx` — 수신자 행에 전화 표시, [알림톡 발송] 버튼(설정 시 활성), 채널별 결과 표시 |
| F3 | i18n — `config.kakao.*`(common)·`feedbackEmail.*` 추가 키 4 locale |

## 4. 운영 선결 조건 (배포 후 설정)

카카오톡 채널 개설·비즈 인증 → Solapi 가입·채널 연동(pfId) → 알림톡 템플릿 등록·검수(변수명 §1.1 고정 계약) → 충전 → `/admin/config/kakao` 입력 → 테스트 발송 확인.

## 5. Verification (검증)

Solapi 실계정 없이는 실발송 불가 — 로컬 검증: 설정 저장/마스킹/부분갱신, 미설정 시 발송 400, 목 서버로 HMAC 헤더·ATA 페이로드 형식 검증, 수신자 전화 유무 분기, spec·tsc·build. 실발송 검증은 운영 설정 완료 후 프로덕션 테스트 발송 버튼으로.
