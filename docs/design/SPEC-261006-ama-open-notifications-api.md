---
document_id: NTF-SPEC-261006-ama-open-notifications
version: 1.0.0
status: PROPOSED — AMA(ambManagement) 백로그 등록용 계약서. ACM 쪽 클라이언트는 이 계약으로 구현·배포됨
date: 2026-10-06
related:
  - docs/analysis/REQ-261006-acm-ama-alert-forwarding.md
  - docs/plan/PLN-261006-ama-notification-forward.md
---

# SPEC-261006 — AMA Open API: 외부 앱 알림 생성 `POST /open/notifications` / External-app notification intake

> 대상 저장소: **ambManagement** (`apps/api/src/domain/open-api`, `domain/notification`, `domain/oauth`).
> 목적: Custom App/PartnerApp(ACM 등)이 AMA 사용자에게 알림센터·푸시 알림을 보낼 수 있게 한다.

## 1. 인증 (기존 Open API 와 동일)

- `POST /oauth/token` `grant_type=client_credentials` + `client_id` + `client_secret` + `entity_id` + `scope=notifications:write`
  (기존 REQ-260609 client_credentials 흐름. PartnerApp 이 해당 법인에 **설치**돼 있어야 하며 `papScopes ∩ install.approvedScopes` 에 `notifications:write` 가 포함돼야 한다.)
- 신규 scope: `oauth-scope.ts` 에 `NOTIFICATIONS_WRITE: 'notifications:write'` 추가. PartnerApp 등록 화면의 scope 목록에도 노출.
- 가드: `@Public() @UseGuards(OAuthTokenGuard, RequireScopeGuard, OpenApiQuotaGuard)` + `@RequireScope('notifications:write')` (open-client.controller 와 동일 패턴), `OpenApiLogInterceptor` 적용.

## 2. 엔드포인트

```
POST /api/v1/open/notifications
Authorization: Bearer <client_credentials access_token>
Content-Type: application/json
```

### 2.1 요청

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `entityId` | uuid | ● | AMA 법인 id. 토큰이 발급된 `entity_id` 와 **일치해야** 함(불일치 403) |
| `appCode` | string ≤60 | ● | 발신 앱 코드 (예: `tpi-acm`). 알림 표시의 출처 라벨 |
| `dedupeKey` | string ≤200 | ● | 멱등 키. `(entityId, appCode, dedupeKey)` 유일. 중복이면 **409** |
| `type` | enum | ● | `EXTERNAL_APP` (이번 범위 고정) |
| `title` | string ≤200 | ● | 알림 제목 |
| `body` | string ≤500 | ○ | 본문 |
| `link` | url ≤1000 | ○ | 클릭 시 열 외부 URL (새 탭). ACM 은 `https://acm.amoeba.site/login?returnTo=/admin/…` 형태로 보냄 |
| `recipientUserIds` | uuid[] 1..100 | ● | 해당 법인 소속 AMA 사용자 id. 비소속·비활성 사용자는 건너뜀 |
| `priority` | `normal`\|`high` | ○ | 기본 `normal`. `high` 는 푸시 즉시 발송 대상 |

### 2.2 응답

```json
201 { "success": true, "data": { "created": 2, "skipped": 0 } }
```

| 코드 | 의미 |
|---|---|
| 400 | 검증 실패(필드·길이·recipientUserIds 100 초과) |
| 401 | 토큰 없음/만료 |
| 403 | scope 없음, `entityId` 불일치, 앱 미설치 |
| 409 | `dedupeKey` 중복 — 호출자는 **전달 완료로 간주** |
| 429 | 법인·앱 단위 쿼터 초과 (기존 OpenApiQuotaGuard) |

### 2.3 AMA 내부 처리

1. `NOTIFICATION_RESOURCE_TYPE.EXTERNAL_APP` 추가(`notification-type.constant.ts`), `amb_notifications` 에 `appCode` 를 리소스 id/메타로 저장(`resourceId = dedupeKey` 또는 별도 `not_meta jsonb`).
2. `NotificationService.createBulk(recipients…)` 호출 → 기존 `notification.listener`/`notification-sse.service`/`push.service` 가 **인앱 SSE·웹푸시·Expo 푸시** 를 그대로 수행. 법인 알림 정책(`entity-settings/notification-policy`)의 EXTERNAL_APP 채널 설정을 따른다(기본: 인앱+푸시).
3. 알림 클릭 시 `link` 가 있으면 새 탭으로 연다(외부 URL 허용 도메인은 등록된 Custom App URL 의 origin 으로 제한 권장).
4. 중복 방지: `UNIQUE(ent_id, app_code, dedupe_key)` (별도 테이블 `amb_open_notification_keys` 또는 `amb_notifications` 컬럼).

## 3. ACM 측 호출 예 (참고)

```http
POST /api/v1/open/notifications
Authorization: Bearer eyJ…
{
  "entityId": "928f5fe4-12ab-4113-b9b9-d8d455ca4e3b",
  "appCode": "tpi-acm",
  "dedupeKey": "acm:CSL_CREATED:eeb924d9-26b6-44b8-b48f-6ba03b8836b4",
  "type": "EXTERNAL_APP",
  "title": "[ACM] 신규 상담 접수 #107",
  "body": "새 상담이 접수되었습니다. ACM 콘솔에서 확인하세요.",
  "link": "https://acm.amoeba.site/login?returnTo=%2Fadmin%2Fcsl%2Feeb924d9-26b6-44b8-b48f-6ba03b8836b4",
  "recipientUserIds": ["c31e3cc1-…"],
  "priority": "high"
}
```

## 4. 사전 운영 작업 (AMA 관리자)

1. ACM 용 **PartnerApp** 등록(또는 기존 `AMA_CLIENT_ID` 가 가리키는 앱 확인) + scope 에 `notifications:write` 추가.
2. 해당 PartnerApp 을 TPI 법인(`928f5fe4…`)에 설치·승인.
3. ACM `/admin/config/ama` 에서 "AMA 알림 전달" 켜고 [테스트 전송] 으로 확인.

## 5. 공수 (AMA 측)

| 작업 | 규모 |
|---|---|
| scope 추가·PartnerApp 화면 노출 | 0.5일 |
| `OpenNotificationController` + DTO + 법인/수신자 검증 + dedupe | 1일 |
| 리소스 유형 EXTERNAL_APP + 알림 클릭 외부 링크 처리(web/mobile) | 1일 |
| 테스트·문서 | 0.5일 |
