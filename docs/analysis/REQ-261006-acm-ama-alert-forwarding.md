---
document_id: NTF-REQ-261006
version: 0.1.0
status: REVIEW (기능 검토 — 구현 여부·방식 결정 대기)
date: 2026-10-06
related:
  - docs/analysis/REQ-261001-acm-notification-inbox.md (ACM 통합 알림함 — 발생 이벤트 원천)
  - docs/analysis/REQ-260903C-realtime-alerts.md
  - docs/analysis/ACM-AMA-SSO-REQ-1.0.0.md (ACM↔AMA 연동 경계)
  - ambManagement: apps/api/src/domain/notification, domain/open-api, domain/oauth
change_log:
  - 2026-10-06 v0.1.0 기능 존재 여부 검토 + 구현 방안 3안 비교 (Claude Code)
---

# REQ-261006 — ACM 알림 이벤트의 AMA(ama.amoeba.site) 알림 전달 / Forwarding ACM alerts to the AMA platform

## 1. Question (검토 요청)

acm.amoeba.site 에서 발생한 알림 이벤트(신규 상담, 단계 변경, 일정, 멘션 등)를 상위 플랫폼 **ama.amoeba.site 의 알림**으로 전달하는 기능이 있는가. 없으면 구현 방안.

## 2. Conclusion (결론)

**현재 그런 기능은 없다.** ACM 알림은 ACM 콘솔 안(인앱 알림함·SSE 토스트)에서만 소비되고, ACM→AMA 방향으로 알림을 보내는 코드·API 계약이 양쪽 모두 없다. 다만 **양쪽에 재사용 가능한 부품이 갖춰져 있어** AMA 에 Open API 엔드포인트 1개, ACM 에 전달 워커 1개를 추가하면 구현 가능하다(§5 권장안).

## 3. As-Is — ACM (acm.amoeba.site)

| 구성 | 현황 |
|---|---|
| 알림 원천 | `amb_acm_notification_outbox` — 업무 트랜잭션과 같은 트랜잭션에 적재(`enqueueInbox`). 이벤트 종류 `CSL_CREATED` `CSL_STAGE` `CAL_CREATED` `CAL_UPDATED` `CHAT_MENTION`, 수신자 = 콘솔 사용자 id 목록 |
| 전달 | `InboxService` 5초 cron 이 outbox → 개인 알림함(`amb_acm_notification_inbox`) + 테넌트 SSE(`GET /api/acm/notifications/events`) 로 배달. **외부 채널 전달 없음** |
| 외부 발송 부품 | `AmoebaTalkHttpService`(`POST {AMOEBATALK_API_URL}/api/v1/messages`, Bearer+HMAC) 와 `AmaClientService`(고객사 생성)가 코드에 있으나 **프로덕션은 `AMA_MODE` 미설정(=mock), `AMOEBATALK_*` 미설정** — 실제로 AMA 로 나가는 호출은 없다 |
| AMA 자격 | 프로덕션 env 에 `AMA_CLIENT_ID/SECRET` 설정, `AMA_PLATFORM_SERVICE_TOKEN` 비어 있음. SSO 는 `local_config`(Custom App/Category HS256) |
| 사용자 매핑 | `amb_acm_user.ama_user_id`(AMA `sub`) — AMA SSO 로 들어온 계정만 보유. 로컬 계정(APP_ADMIN·일부 ADMIN)은 AMA 사용자 id 가 없다 |
| 테넌트 매핑 | `amb_acm_ama_config.amc_ama_entity_id` (TPI: `928f5fe4…`) |

## 4. As-Is — AMA (ama.amoeba.site, ambManagement)

| 구성 | 현황 |
|---|---|
| 알림 도메인 | `domain/notification` — `amb_notifications`, `NotificationService.create/createBulk`, 리소스 유형 `TODO/ISSUE/MEETING_NOTE/CALENDAR/TALK/EXPENSE_REQUEST/WORK_ITEM/NOTICE/LEAVE_REQUEST/APPROVAL_DOCUMENT/CUSTOMER_REQUEST/WORK_ACTION/INVOICE/WORK_REPORT`. 실시간 `GET /notifications/stream`(SSE) + 웹푸시(`push`, VAPID) + Expo 푸시, 법인별 알림 정책(`entity-settings/notification-policy`) |
| 외부 앱 수신 API | **없음** — `notifications` 컨트롤러는 조회/읽음 처리뿐(JWT 사용자 전용). 알림 생성은 내부 이벤트 리스너(`notification.listener.ts`)만 가능 |
| Open API | `domain/open-api` — `open/clients` `open/issues` `open/projects` `open/users` `open/units` `open/entity` `open/assets`. 인증 **OAuth client_credentials(PartnerApp `pap_*`) + scope**(`clients:write`, `issues:write`, `users:read` …) + 쿼터 + 호출 로그. **`notifications:*` scope 없음** |
| 커스텀 앱 레지스트리 | `amb_entity_custom_apps`(ACM = `tpi-acm`, JWT secret) — 앱→AMA 호출용 자격은 아님 |

## 5. Options (구현 방안)

| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **A. AMA Open API 신설 + ACM outbox 전달 워커 (권장)** | AMA 에 `POST /api/v1/open/notifications`(scope `notifications:write`) 추가 → AMA 알림함·SSE·푸시 그대로 재사용. ACM 은 outbox 소비 시 AMA 사용자 id 가 있는 수신자에게 전달 | AMA 알림센터·푸시·정책과 완전히 통합, 기존 Open API 인증·쿼터·로그 재사용, 재시도·중복 방지 설계 가능 | **AMA 측 개발 필요**(엔드포인트·scope·리소스 유형 `EXTERNAL_APP`), PartnerApp OAuth 클라이언트 발급 |
| B. AmoebaTalk 메시지로 전달 | 기존 `AmoebaTalkHttpService` 로 운영자에게 톡 메시지 발송 | ACM 코드만으로 가능(워커+설정) | 알림이 아니라 "채팅 메시지"로 섞임, 읽음/정책/푸시 통합 불가, AmoebaTalk 수신 API 실체·자격 미확인(프로덕션 미설정) |
| C. AMA 가 ACM 을 폴링/구독 | AMA 가 ACM `GET /api/acm/notifications/...` 또는 SSE 를 구독 | ACM 변경 최소 | AMA 가 앱별 커넥터를 유지해야 함, 인증·멀티테넌트 복잡, 확장성 낮음 |

## 6. Recommended Design — Option A (권장안 상세)

### 6.1 AMA 측 (ambManagement)

- 신규 `OpenNotificationController` `@Controller('open/notifications')` `@Public() @UseGuards(OAuthTokenGuard, RequireScopeGuard, OpenApiQuotaGuard)` `@RequireScope('notifications:write')`.
- scope 레지스트리(`oauth-scope.ts`)에 `NOTIFICATIONS_WRITE: 'notifications:write'` 추가.
- 리소스 유형 `NOTIFICATION_RESOURCE_TYPE.EXTERNAL_APP`(+ `appCode`) 추가, `NotificationService.createBulk` 호출 → 기존 SSE·푸시·정책 자동 적용.
- 요청 계약(안):

```json
POST /api/v1/open/notifications
Authorization: Bearer <client_credentials token, scope notifications:write>
{
  "entityId": "928f5fe4-…",            // AMA 법인 id (토큰의 pap 이 접근 가능한 법인인지 검증)
  "appCode": "tpi-acm",
  "dedupeKey": "acm:csl:CSL_CREATED:<inqId>",   // 멱등 (중복 전달 방지)
  "type": "EXTERNAL_APP",
  "title": "[ACM] 신규 상담 접수 — 김민",
  "body": "TPI · 맵테스트 · 2026-10-06 09:12",
  "link": "https://acm.amoeba.site/admin/csl/<inqId>",   // 클릭 시 ACM 으로 이동(SSO 진입점 경유)
  "recipientUserIds": ["c31e3cc1-…", "…"],            // AMA 사용자 id (ACM amb_acm_user.ama_user_id)
  "priority": "normal"
}
→ 201 { "created": 2, "skipped": 0 }
```

- 응답/오류: 401(토큰) · 403(scope/법인 불일치) · 409(dedupeKey 중복) · 429(쿼터).

### 6.2 ACM 측 (app-academy)

| # | 변경 | 비고 |
|---|---|---|
| 1 | 테넌트 설정 `/admin/config/ama` 에 **"AMA 알림 전달"** on/off + 전달할 이벤트 종류 선택(CSL_CREATED·CSL_STAGE·CAL_*·CHAT_MENTION) | `amb_acm_ama_config` 컬럼 추가(`amc_forward_notifications`, `amc_forward_types`) |
| 2 | OAuth 클라이언트 자격 저장 — `AMA_CLIENT_ID/SECRET`(이미 env 존재) 로 `POST /oauth/token`(client_credentials, scope notifications:write) 토큰 캐시 | `AmaOpenApiTokenService`(신규) |
| 3 | `amb_acm_notification_forward`(outbox 1건 × 외부 채널 1행: 상태 PENDING/SENT/FAILED, 시도 횟수, 응답) 테이블 + `AmaNotificationForwarder` cron(10초, 3회 재시도, 지수 백오프). **인앱 배달 트랜잭션과 분리** — 외부 실패가 콘솔 알림을 막지 않음 | REQ-261001 outbox 는 수정 없이 재사용(배달 완료 행을 forward 로 복제) |
| 4 | 수신자 매핑: 수신자 `usr_id` → `ama_user_id` 가 있는 사용자만 전달, 없으면 skip 집계 | 로컬 계정은 전달 대상 아님 |
| 5 | 제목·본문 4 locale 템플릿(수신자 언어는 테넌트 기본 locale) | i18n 규칙 |
| 6 | `/admin/config/ama` 에 전달 현황(최근 전달·실패 수, 테스트 전송 버튼) | 운영 가시성 |

### 6.3 공수 (추정)

| 영역 | 규모 |
|---|---|
| AMA: 엔드포인트·scope·리소스 유형·테스트 | 2~3일 |
| ACM: 설정·토큰·forward 테이블·워커·UI·i18n·테스트 | 3~4일 |
| 연동 검증(PartnerApp 발급·스테이징 E2E) | 1일 |

## 7. Open Questions (결정 필요)

| Q | 내용 | 기본안 |
|---|---|---|
| Q-1 | 추진 여부 및 방안(A/B/C) | **A** |
| Q-2 | AMA 측 개발 주체·일정 — Open API 엔드포인트는 AMA 팀 작업 | AMA 백로그 등록 |
| Q-3 | 전달 대상 이벤트 — 전부 vs 신규 상담·단계 변경만 | 신규 상담(CSL_CREATED)·단계 변경(CSL_STAGE) 먼저, 나머지 설정으로 확장 |
| Q-4 | 수신자 — ACM 알림함 수신자 그대로(개인) vs 법인 ADMIN 전원 | ACM 수신자 그대로 + AMA 사용자 id 보유자만 |
| Q-5 | 클릭 링크 — AMA 알림에서 ACM 상세로 바로 열기(SSO 재진입) 가능 여부 | Custom App 진입 URL 에 `redirect` 파라미터 지원 여부 확인 |
| Q-6 | 중단 방안 B(AmoebaTalk) 를 임시로 쓸지 | 권장 안 함(채널 의미 불일치, 자격 미확인) |
