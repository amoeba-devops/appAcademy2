---
document_id: CAL-PLN-260920C
version: 1.1.0
status: VERIFIED (PR #249·#251·#252 배포, BODA_MODE=http, 8/31 녹화 2건 ARCHIVED 2026-09-20 07:30Z) — 잔여: 목 데이터 정리(FIX-260920 §5)·웹훅 URL 등록 확인
date: 2026-09-20
depends_on: docs/analysis/REQ-260920C-boda-recording-vendor-reply-followup.md
change_log:
  - 2026-09-20 v1.1.0 배포 완료 + 위조 헤더 401 스모크 확인. C-2 lookback env 추가. BODA_MODE 전환은 운영자 수동 (Claude Code)
  - 2026-09-20 v1.0.0 B-1·B-2·B-3·C-1·D-1~D-4 구현 완료 (Claude Code)
---

# PLN-260920C — 보다스쿨 녹화 연동 벤더 회신 반영 / Implementation Plan

## 1. Goal (목표)

벤더 회신(인증 없음·IP 3개·자동 녹화·Range 미지원)을 코드·설정·매뉴얼에 반영하고, **IP 가 유일한 웹훅 인증**이 된 상황에서 발신 IP 판정을 위조 불가능하게 만든다.

## 2. Scope (범위)

| # | 항목 | 결과 |
|---|---|---|
| B-1 | 웹훅 발신 IP 판정 — XFF 첫 항목 → **신뢰 프록시 홉 수 기반(뒤에서 N번째)** | ✅ |
| B-2 | 아카이브 업로드 — 256MB 버퍼 폴백 제거, **lib-storage 멀티파트 스트리밍** | ✅ |
| B-3 | 보다 원본 직프록시 재생 시 `Accept-Ranges: none` + UI 안내(4 locale) | ✅ |
| C-1 | 녹화 다운로드 fetch 전체 전송 타임아웃(기본 30분, env) | ✅ |
| D-1 | 강사 매뉴얼 자동 녹화 안내 (HTML 2종 + GUIDE) | ✅ |
| D-2~D-4 | 체크리스트·벤더 질문 마스터·PLN-260912B 상태 갱신 | ✅ |
| C-2 | 과거 수업 따라잡기 — 10분 cron lookback 을 env `BODA_RECORDING_SYNC_LOOKBACK_HOURS`(기본 48) 로 조정. 프로덕션 `.env.production` 에 720 설정(30일, 수집 후 되돌림) | ✅ (1ee96ce) |
| C-3 | 웹훅 수신 가시화 | ⏸ 보류 |

## 3. Design (설계)

### 3.1 B-1 발신 IP 판정

```
BODA ──▶ host nginx ──▶ 컨테이너 nginx ──▶ backend
           append VENDOR    append 127.0.0.1
X-Forwarded-For = [ (클라이언트 임의값…), VENDOR, 127.0.0.1 ]
                                          ▲ 뒤에서 2번째 = 신뢰 가능
```

- 신규 util [bodaedu-webhook-source-ip.util.ts](../../backend/src/infrastructure/external/bodaedu/webhook/bodaedu-webhook-source-ip.util.ts): `resolveWebhookSourceIp(xff, socketIp, trustedHops)`.
  - 항목 수 < hops → 프록시 우회 직접 접속 → 소켓 IP 사용.
  - `::ffff:` IPv4-mapped 정규화.
- env `BODA_WEBHOOK_TRUSTED_PROXY_HOPS` (기본 2, compose 양쪽에 명시). 로컬 직접 호출은 XFF 없음 → 소켓 IP 로 자연 폴백.
- `X-Real-IP` 는 컨테이너 nginx 가 127.0.0.1 로 덮어써 사용 불가.
- 단위 테스트 11건: 위조 1개·다수, 홉 부족, 0/1/2홉, 배열 헤더, 빈 값.

### 3.2 B-2 멀티파트 보관

- `ObjectStoreClient.putObjectStream({ contentLength?: number | null })` — 길이 있으면 `PutObject`, 없으면 `@aws-sdk/lib-storage` `Upload`(16MB 파트 × queue 2, 메모리 상주 ≤ ~32MB).
- `archiveOne` — 업스트림을 `ByteCounter`(Transform) 로 통과시켜 실제 바이트를 세고, 0 이면 `RECORDING_EMPTY_BODY` → FAILED. 업스트림 에러는 counter 로 전파.
- 테스트 2건 추가(길이 없음 → 멀티파트 + sizeBytes 카운트, 빈 본문 → FAILED).

### 3.3 B-3 재생 UX

- 스트림 컨트롤러: `Accept-Ranges` = ACM 보관본이면 `bytes`, 보다 직프록시면 `none`.
- 프론트: 재생 모달의 `<video>` 아래 안내문(보관 전 seek 불가), `보다스쿨 원본` 배지 tooltip. i18n `cal.recordings.seekHint` / `notArchivedHint` ko·en·vi·zh-CN.

```
┌─────────────── 영어 1차시 녹화 ───────────────┐
│  ┌──────────────────────────────────────────┐ │
│  │            ▶  (video controls)           │ │
│  └──────────────────────────────────────────┘ │
│  ⚠ 보관 완료 전에는 구간 이동(탐색)이 되지    │  ← 보다 원본일 때만
│    않습니다. 보다스쿨 원본을 그대로 재생 중.   │
│                       [⤓ 다운로드]   [닫기]   │
└───────────────────────────────────────────────┘
```

### 3.4 C-1 타임아웃

- `downloadRecording` fetch 에 `AbortSignal.timeout(BODA_DOWNLOAD_TIMEOUT_MS)` (기본 1,800,000ms). 초과 시 스트림 abort → 워커 FAILED·재시도(최대 3회).

## 4. Files (변경 파일)

| 영역 | 파일 |
|---|---|
| backend | `infrastructure/external/bodaedu/webhook/bodaedu-webhook-source-ip.util.ts` (+spec), `modules/acm-cal/presentation/boda-webhook.controller.ts`, `modules/acm-cal/presentation/cal-recording-stream.controller.ts`, `modules/acm-cal/application/boda-recording.service.ts` (+spec), `modules/acm-csl/infrastructure/external/object-store.client.ts`, `infrastructure/external/bodaedu/infrastructure/bodaedu-server-http.client.ts`, `package.json` (`@aws-sdk/lib-storage`) |
| frontend-acm | `modules/cal/components/cal-recordings-section.tsx`, `i18n/locales/{ko,en,vi,zh-CN}/cal.json`, `public/web/manual/manual-teacher.html`, `public/web/manual/manual-class.html` |
| infra | `docker/production/docker-compose.production.yml`, `docker/staging/docker-compose.staging.yml`, `docker/production/.env.production.example` |
| docs | `docs/reference/GUIDE-260611-teacher-boda-classroom.md`, `docs/report/체크리스트-보다스쿨-설정.md`, `docs/reference/BODA-vendor-questions-master-260624.md`, `docs/plan/PLN-260912B-…` |

## 5. Verification (검증)

| 확인 | 결과 |
|---|---|
| backend `tsc --noEmit` | ✅ |
| backend jest (webhook util·recording·webhook service) | ✅ 61 pass |
| backend eslint 변경 파일 | 0 error (기존 warning 만) |
| frontend-acm `tsc --noEmit` | ✅ |
| CI (PR #249) | ✅ 6/6 |
| cd-staging (8333050) | ✅ run 35495004097 |
| cd-production (`-f sha=8333050`) | ✅ run 35495186156 (Preflight·Deploy success) |
| **위조 헤더 차단** — `POST /api/webhooks/boda` + `X-Forwarded-For: 121.170.164.136` (외부에서) | ✅ **401 `AUTH_NOT_IN_ALLOWLIST`** |
| 프로덕션 `bdc_webhook_allow_cidrs` | ✅ `121.170.164.136,121.170.164.137,121.170.164.138` (사용자 설정) |
| 프로덕션 `BODA_MODE` | ✅ `http` (2026-09-20 06:56Z, 이미지 8333050, health 200) |
| 실데이터 E-3 (8/31 녹화 2건) | ✅ 07:30Z `8251`·`8253` ARCHIVED (FIX-260920 봉투 해제 후) |
| 실데이터 E-4 (8/31 입·퇴장) | ⏳ 목 모드 잔여 룸 상태 정리 후 (FIX-260920 §5) |
| E-1·E-5 (실시간 웹훅·신규 수업) | ⏳ 벤더 수신 URL 등록 확인(Q-1) 후 |

## 6. Rollout (배포·운영 순서)

1. ✅ PR #249 머지 → cd-staging → cd-production 8333050 (2026-09-20).
2. ✅ `/admin/config/boda` 허용 IP 저장 (A-1).
3. ✅ **`.env.production` `BODA_MODE=http` → backend 재생성 (A-2)** — 2026-09-20 06:56Z 완료. 컨테이너 `tac-backend:8333050`, `BODA_MODE=http`, `/api/health` 200.

   > ⚠️ **사고 기록**: 첫 재생성을 `DEPLOY_SHA` 없이 `docker compose up -d backend` 로 실행 → compose 의 `image: …:${DEPLOY_SHA:-production}` 폴백으로 **구 `:production` 태그(MySQL 시절 이미지)** 가 떠서 `ECONNREFUSED 127.0.0.1:3306` crash-loop, `/api` 502 약 1분. `DEPLOY_SHA=8333050` 로 재실행해 복구. **백엔드 단독 재생성 시 반드시 `DEPLOY_SHA=<현재 배포 sha>` 를 붙인다** (또는 `scripts/deploy-production.sh` 사용).

   ```bash
   cd ~/app-academy
   sed -i 's/^BODA_MODE=mock/BODA_MODE=http/' docker/production/.env.production
   DEPLOY_SHA=$(docker inspect --format '{{.Config.Image}}' tac-prod-backend | sed 's/.*://') \
   docker compose -f docker/production/docker-compose.production.yml \
     --env-file docker/production/.env.production up -d --no-deps backend
   docker exec tac-prod-backend env | grep '^BODA_MODE'   # → http
   ```

4. ⏳ 벤더에 수신 URL 등록 여부 확인 (A-3 / Q-1).
5. ⏳ 10분 내 `/admin/cal/999cb70c-ff33-4624-95f2-1f2218baa471` 🎬 수업 녹화본 2건 → `ARCHIVED` 전환 → 재생·seek·다운로드. 즉시 확인은 `[녹화본 동기화]`.
6. ⏳ 수집 완료 후 `BODA_RECORDING_SYNC_LOOKBACK_HOURS` 를 48 로 되돌리거나 제거.
