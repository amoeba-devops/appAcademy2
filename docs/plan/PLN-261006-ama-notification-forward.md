---
document_id: NTF-PLN-261006
version: 1.0.0
status: DEPLOYED (ACM 측 PR #306 4272877 — cd-staging·cd-production 2026-10-06, 전달 OFF 기본) — AMA 측 엔드포인트는 SPEC-261006 로 백로그 이관
date: 2026-10-06
depends_on: docs/analysis/REQ-261006-acm-ama-alert-forwarding.md
change_log:
  - 2026-10-06 v1.0.0 사용자 결정(A 추진, AMA 백로그, 신규상담·단계변경 우선, SSO 재진입) 반영 구현 (Claude Code)
---

# PLN-261006 — ACM 알림 → AMA 알림 전달 (Option A) / Implementation Plan

## 1. Decisions (2026-10-06 사용자 결정)

| 항목 | 결정 |
|---|---|
| 방안 | **A** — AMA Open API `POST /open/notifications` + ACM outbox 전달 워커 |
| AMA 측 | 계약서 [SPEC-261006](../design/SPEC-261006-ama-open-notifications-api.md) 로 AMA 백로그 등록 (ambManagement 저장소는 이 세션 작업 범위 밖) |
| 이벤트 범위 | 기본 **신규 상담(CSL_CREATED)·단계 변경(CSL_STAGE)**. 설정 화면에서 일정 등록/변경·채팅 멘션 추가 선택 가능 |
| SSO 재진입 | AMA 알림 링크 = `https://acm.amoeba.site/login?returnTo=/admin/…`. ACM 세션이 있으면 로그인 화면을 건너뛰고 바로 이동, 없으면 로그인(로컬 또는 AMA 진입) 후 `returnTo` 로 이동 |

## 2. Architecture

```
업무 트랜잭션 ──enqueueInbox──▶ amb_acm_notification_outbox ──(InboxService 5s)──▶ 인앱 알림함·SSE
                                        │
                                        └──(AmaForwardService 10s)──▶ amb_acm_ama_notification_forward
                                             enqueue: 전달 ON 테넌트 · 켠 시각 이후 · 대상 종류 · 인앱 배달 완료
                                                      수신자 = 인앱 수신자 ∩ ama_user_id 보유(없으면 SKIPPED)
                                             send:    PENDING → AMA Open API (client_credentials, notifications:write)
                                                      5xx/네트워크 → 2^n 분 백오프 재시도(최대 5회), 4xx → FAILED, 409 → SENT(중복)
```

## 3. Changes (ACM)

| # | 변경 | 파일 |
|---|---|---|
| SQL | `amb_acm_ama_config` +`amc_forward_enabled/_types/_enabled_at`, 신규 `amb_acm_ama_notification_forward` | `sql/acm/1027-ama-notification-forward.sql` |
| B-1 | AMA Open Notification 클라이언트 (http: 법인별 토큰 캐시·401 재발급·409 중복 처리 / mock: 로그) — `AMA_SERVICES_MODE` 로 선택 | `infrastructure/external/ama/open-notification/*` |
| B-2 | 전달 워커 `AmaForwardService` (enqueue/send/status/sendTest) + 템플릿 4 locale(`AMA_FORWARD_LOCALE`, 기본 ko) + 링크(`FRONTEND_URL`/`ACM_PUBLIC_URL`) | `acm-notification/application/ama-forward*.ts` |
| B-3 | `GET /acm/admin/ama-config/forward/status`, `POST …/forward/test` (ADMIN) | `acm-notification/presentation/ama-forward.controller.ts` |
| B-4 | AMA 설정 DTO/엔티티/서비스에 `forwardEnabled`·`forwardTypes`·`forwardEnabledAt` | `acm-auth/*ama-config*` |
| F-1 | `/admin/config/ama` 에 "AMA 알림 전달" 섹션 — on/off, 종류 체크, 최근 7일 현황, [테스트 전송] | `cfg/pages/ama-config-page.tsx`, `cfg/hooks/use-ama-config.ts` |
| F-2 | `/login?returnTo=…` 에 기존 세션이 있으면 즉시 이동 | `auth/pages/login-page.tsx` |
| F-3 | i18n `common.config.forward.*` ko/en/vi/zh-CN | `i18n/locales/*/common.json` |
| T | 템플릿·링크 단위 테스트 3건 | `ama-forward-templates.spec.ts` |

## 4. UI 구성안

```
┌ AMA 연동 설정 ─────────────────────────────────────────────────────┐
│ … (기존 커스텀앱 / 커스텀카테고리 설정) …                            │
├ AMA 알림 전달 ─────────────────────────────────────────────────────┤
│ ACM 에서 발생한 알림을 AMA 알림으로도 보냅니다. AMA 계정과 연결된   │
│ 콘솔 사용자에게만 전달됩니다.                                        │
│ [✓] AMA 로 알림 전달 (켜는 시점 이후 발생분부터)                     │
│ 전달할 알림 종류                                                    │
│   [✓] 신규 상담 접수  [✓] 상담 단계 변경  [ ] 일정 등록             │
│   [ ] 일정 변경       [ ] 채팅 멘션                                 │
│ 최근 7일 — 전송 12 · 대기 0 · 실패 1 · 수신자 없음 3 · AMA 연결 7명 │
│ 마지막 전송: 2026-10-06 09:12   최근 오류: HTTP 404                 │
│ [테스트 전송]  현재 계정(AMA 연결 필요)에게 1건 전송                 │
├────────────────────────────────────────────────────────────────────┤
│ [ ] 이 설정으로 로그인 허용 (활성)                  [취소] [저장]    │
└────────────────────────────────────────────────────────────────────┘
```

## 5. Verification

| 확인 | 결과 |
|---|---|
| backend tsc · eslint(0 error) · jest(acm-notification·acm-auth) | ✅ 107 pass (+템플릿 3) |
| frontend tsc · eslint · prettier | ✅ |
| SQL 1025+1027 로컬 적용 | ✅ |
| CI PR #306 · cd-staging · cd-production (4272877) | ✅ |
| 프로덕션 | `amb_acm_ama_config` 전달 컬럼 생성(OFF, 기본 종류 CSL_CREATED,CSL_STAGE), forward 테이블 0행, `AmaOpenNotificationModule`·`AmaForwardController` 로드, health 200 |
| 프로덕션 | SQL 1027 자동 적용 → 설정 화면 섹션 노출. **AMA 엔드포인트가 없으므로 전달은 OFF 유지**, [테스트 전송] 은 AMA 404 로 실패가 정상 |

## 6. Rollout

1. ACM PR 머지·배포 (전달 OFF 기본값 — 동작 변화 없음).
2. AMA 팀: SPEC-261006 구현 + PartnerApp scope/설치.
3. ACM `/admin/config/ama` 에서 전달 ON → [테스트 전송] → 신규 상담 1건으로 E2E.
