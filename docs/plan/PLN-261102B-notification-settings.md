---
document_id: PLN-261102B
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-02 v1.1.0 — implemented; data model changed to one JSONB row per academy / person; personal settings added (Q1)
  - 2026-11-02 v1.0.0 — initial plan (recommended answers to Q1–Q4 assumed)
---

# PLN-261102B Notification Settings (알림 설정) — Work Plan (작업 계획)

## 1. Screen Layout (화면 구성안)

### 1.1 서비스 설정 카드
```
┌ 서비스 설정 ───────────────────────────────────────────────┐
│ [사용자 초대] [광고 플랫폼] [메일] [드라이브] [관리자] [로그인 유지] │
│ [🔔 알림 설정 — 상황별 알림·기기 푸시·방해 금지 시간]  ← 신규 │
└────────────────────────────────────────────────────────────┘
```

### 1.2 `/admin/config/notifications` — 탭 3개
```
🔔 알림 설정
[상황별 알림]  [기기·푸시]  [발송 경로]
```

#### 탭 ① 상황별 알림 (PC)
```
│ 상황                 │받는 사람        │알림함│푸시│팝업│AMA│메일│알림톡│
│ 신규 상담 접수       │☑관리자☑직원☐강사│ [●] │[●]│[●]유지│[●]│ — │  —  │
│ 상담 상태 변경       │☑관리자☑직원☐강사│ [●] │[●]│ — │[●]│ — │  —  │
│ 수업일정 등록        │☑관리자☑직원☑담당강사│[●]│[●]│ — │[○]│ — │  —  │
│ 수업일정 변경        │☑관리자☑직원☑담당강사│[●]│[●]│ — │[○]│ — │  —  │
│ 피드백·숙제 미완료   │☑관리자 ☑담당강사 │ [●] │[●]│ — │ — │ — │  —  │
│   1차 [5]시간 · 2차 [10]시간 후                                       │
│ 채팅 새 메시지       │채팅방 참여자(고정)│[●] │[●]│[●]│ — │ — │  —  │
│ 채팅 멘션            │멘션된 사람(고정) │ [●] │[●]│ — │[○]│ — │  —  │
│ 이슈 멘션            │멘션된 사람(고정) │ [●] │[●]│ — │ — │ — │  —  │
│ 비밀번호 재발급 요청 │관리자(고정)      │ [●] │[●]│ — │ — │ — │  —  │
│ MAP 테스트 신청      │학부모·운영자     │  —  │ — │ — │ — │[●]│ [●] │
│ 일정 초대            │초대받은 사람     │  —  │ — │ — │ — │[●]│  —  │
                                                          [저장]
```
- 푸시는 알림함에 들어온 알림만 보내므로, 알림함을 끄면 푸시·팝업도 함께 꺼짐(회색).
- AMA 열은 기존 AMA 설정의 '전달 종류'와 같은 값(한쪽에서 바꾸면 다른 쪽도 바뀜). AMA 전달이 꺼져 있으면 열 전체 회색 + "AMA 전달 꺼짐" 안내.

#### 탭 ① 모바일(폭 < 768px) — 상황마다 카드
```
┌ 신규 상담 접수 ─────────────┐
│ 받는 사람 ☑관리자 ☑직원 ☐강사 │
│ 알림함 [●]  푸시 [●]  팝업 [●] │
│ AMA [●]                      │
└─────────────────────────────┘
```

#### 탭 ② 기기·푸시
```
┌ 기기 푸시 ──────────────────────────────────────────┐
│ 기기 푸시 전체        [● 켜짐]                        │
│ 방해 금지 시간        [● 사용] [22:00] ~ [08:00]      │
│   ※ 이 시간에 온 알림은 알림함에 바로 들어가고,        │
│     푸시는 끝나는 시각에 보냅니다(그사이 읽으면 생략). │
│ 잠금 화면 채팅 내용   [● 표시]                        │
│                                         [저장]       │
├ 기기 현황 (최근 7일) ────────────────────────────────┤
│ 서버 푸시 키   ✅ 설정됨                               │
│ 구독 기기      휴대폰 12 · PC 5 · 알 수 없음 3          │
│ 발송           성공 1,204 · 실패 7                     │
│ [내 기기로 테스트 알림]                                │
└─────────────────────────────────────────────────────┘
```

#### 탭 ③ 발송 경로
```
│ 메일(SMTP)   ✅ 연결됨   noreply@…        [메일 설정 →]       │
│ 카카오 알림톡 ⚠ 템플릿 미설정              [카카오 설정 →]     │
│ AMA 전달      ○ 꺼짐                       [AMA 설정 →]        │
```

## 2. Data (데이터)
마이그레이션 `sql/acm/1056-notification-settings.sql`(멱등):
- `amb_acm_notification_setting` — 학원 1행, `nst_config JSONB`(상황별 경로·받는 역할, 기기 푸시 공통, 피드백 알림 시간).
- `amb_acm_notification_pref` — 사람 1행(`npf_kind` USER|TEACHER), `npf_config JSONB`(상황별 끄기, 개인 방해 금지 시간).
- `amb_acm_push_subscription.psu_device` (MOBILE|DESKTOP|NULL), `amb_acm_push_delivery.pdl_result` (SENT|FAILED|SKIPPED).
- 행·키가 없으면 기본값(= 기존 동작). 읽을 때 항상 `normalizeTenant/normalizePersonal` 를 거친다. 저장 요청은 엄격히 검사(시간 형식, 1~48시간, 2차>1차).

### 2.1 Personal settings screen (개인 설정 — 🔔 › 알림 설정)
```
┌ 알림 설정 ─────────────────────────────── ✕ ┐
│ (기존) 이 기기 알림 켜기/끄기                  │
│ 내 알림 설정                                   │
│  신규 상담 접수   ☑알림함 ☑푸시 ☑팝업(항상)    │
│  상담 상태 변경   ☐알림함 ☐푸시                 │
│  …                                            │
│ ☐ 내 방해 금지 시간 [22:00] ~ [08:00]           │
│ 학원 방해 금지 시간 22:00~08:00도 함께 적용     │
│                [내 기기로 테스트 알림] [저장]  │
└───────────────────────────────────────────────┘
```

## 3. Implementation (구현)
| # | Layer | File | 변경 |
|---|-------|------|------|
| 1 | Backend | `acm-notification/application/notification-settings.service.ts`(신규) | 설정 읽기(기본값 병합, 60초 캐시)·저장·현황. 저장 시 활동 로그. |
| 2 | Backend | `presentation/notification-settings.controller.ts`(신규) | `GET/PUT /acm/admin/notification-settings`, `GET …/status`, `POST …/test-push` — CONFIG_ADMIN. |
| 3 | Backend | `inbox-outbox.ts` | `enqueueInbox` — 상황 꺼짐이면 넣지 않음, 받는 역할을 설정으로 거름(관리자·직원·강사). |
| 4 | Backend | `push.service.ts` | 푸시 꺼짐 상황 제외, 방해 금지 시간이면 `pdl_next_at` 을 끝 시각으로 미룸, 채팅 내용 표시 꺼짐이면 미리보기 생략, 실패 시각 기록, 구독 시 `device` 저장. |
| 5 | Backend | `review-reminder.service.ts` | 1차·2차 시간을 설정에서 읽음(학원별). |
| 6 | Backend | `map-apply-notifier.service.ts`, `invitee-notifier.service.ts` | 메일·알림톡 꺼짐이면 `SKIPPED`(로그 사유 `DISABLED_BY_SETTING`). |
| 7 | Backend | AMA 설정 | AMA 열 = 기존 `amc_forward_types` 읽기·쓰기(값 하나로 유지). |
| 8 | Backend | `GET/PUT /acm/notifications/my-settings`, `/portal/notifications/my-settings` | 개인 설정(학원 설정 범위 표시 포함) — 콘솔 팝업 판단에도 사용. |
| 9 | Frontend | `cfg/pages/notification-settings-page.tsx`(신규) | 탭 3개(1.2), PC 표·모바일 카드. |
| 10 | Frontend | `config-landing-page.tsx`, `router.tsx` | 카드·경로 추가(RequireConfigAdmin). |
| 11 | Frontend | `admin-realtime.tsx` | 팝업 꺼진 상황은 토스트 생략, 신규 상담 '유지' 설정 반영. |
| 12 | Frontend | `push-settings.tsx` | 구독 시 기기 종류(MOBILE/DESKTOP) 전송. |
| 13 | i18n | 4 locale | `notifySettings.*` |
| 14 | Test | 단위·통합 | 설정 기본값 병합, 꺼진 상황 enqueue 안 함, 역할 거름, 방해 금지 미룸(자정 넘김 포함), 리마인더 시간, 권한(CONFIG_ADMIN 외 403). |

## 4. Verification (검증)
- 로컬(빈 DB + sql/acm 전체): 설정 저장 → 상담 접수 시 알림함·팝업 on/off 확인, 역할 해제 시 직원 미수신, 방해 금지 중 푸시 지연, 테스트 알림.
- 모바일 폭(375px) 화면 확인.
- 마이그레이션 1건(멱등) — CD 자동 적용.

## 5. Result (결과) — 2026-11-02
- API: `GET/PUT /api/acm/config/notifications`, `GET …/status` (서비스 운영자 `ConfigAdminGuard`), `GET/PUT /api/acm/notifications/my-settings`, `POST …/test-push` (콘솔 전 역할), `GET/PUT /api/portal/notifications/my-settings`, `POST …/test-push` (포털 강사). 저장은 기존 활동 로그 인터셉터가 기록.
- 반영 지점: `enqueueInbox`(상황 끄기·역할 좁히기·개인 알림함 끄기), `PushService`(푸시 끄기·방해 금지 미룸·채팅 내용 숨김·결과 기록·기기 종류·테스트 발송), `ReviewReminderService`(학원별 1차·2차 시간, `rrm_stage` 5=1차·10=2차 코드 유지), `MapApplyNotifierService`(메일·알림톡 끄기 → `SKIPPED`/`DISABLED_BY_SETTING`), 콘솔 채팅 팝업. AMA 열 = 기존 `amc_forward_types`.
- 테스트: 단위(카탈로그·방해 금지 자정 넘김·푸시 꺼짐/미룸/내용 숨김, 권한 가드) 통과, 통합 `it-notification-settings` 5건 + 기존 알림 관련(비밀번호 재발급·이슈·상담·채팅) 통과. 최소 스키마를 쓰는 기존 통합 테스트 3개에 새 테이블 반영.
- 로컬(빈 DB + sql/acm 전체): 화면 3개 탭 표시, 상황표 저장 → DB 반영, 잘못된 시간 400, 현황(서버 키 없음 표시), 🔔 › 개인 설정 저장(상담 상태 변경 알림함 끄기 → 푸시 비활성). 휴대폰 폭은 브라우저 창 크기 조절이 되지 않아 화면으로는 확인하지 못함(카드 레이아웃 코드만).
- 계획 대비 변경: 상황별 열 대신 JSONB 1행, 일정 초대 메일은 설정표 제외(일정마다 선택하는 기존 방식 유지).
