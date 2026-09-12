---
document_id: CAL-PLN-260912B
version: 1.0.0
status: IMPLEMENTED (P1·P2 완료, 미배포) — P0 운영 연동은 사용자 후속 설정 예정
date: 2026-09-12
depends_on: docs/analysis/REQ-260912B-cal-boda-recording-attendance.md
change_log:
  - 2026-09-12 v1.0.0 P1(백엔드)·P2(프론트) 구현 완료 — 녹화 상태 표시·ACM 서버 보관·운영자/강사 전용 노출 반영, 사용자 결정사항 3건 적용 (Claude Code)
  - 2026-09-12 v0.1.0 초안 — 녹화본 링크 활성화 + 입출입 기록 노출 구현 계획 (Claude Code)
---

# PLN-260912B — 수업일정 상세 보다스쿨 녹화본·입출입 기록 / Implementation Plan

## 1. Goal (목표)

`/admin/cal` 수업일정 **상세 모달·상세 페이지**에서 종료된 보다스쿨 수업의 **녹화 동영상(재생·다운로드)** 과 **입·퇴장 기록**을 확인할 수 있게 한다. 보다 SERVER API(SPEC_823 v823.002)에는 공개 재생 URL이 없으므로 **ACM 백엔드가 Basic 인증 프록시** 역할을 한다.

## 2. Architecture (구성)

```
BODA (svr.bodaedu.kr, companyCode 245 / tpi)
  │  ① GET /svr/record/log/video?searchType=ROOM&meetKey=tac-{evtId}   → 녹화 목록
  │  ② GET /svr/record/log/video/{recordIdx}/download (Basic)          → 파일 스트림
  │  ③ GET /svr/meet/log/user/join?meetKey=…                           → 입·퇴장 권위 데이터
  │  ④ POST → ACM /api/webhooks/boda  (event 1·2·4·5·11·12·21)
  ▼
ACM backend (acm-cal)
  BodaRecordingService.syncEvent / archiveDue             ← ①②  (10분 cron)
        └─ ACM S3(MinIO) `cal-recordings/{entId}/{evtId}/{recordIdx}.mp4` 로 복사 보관
  BodaReconcileService.reconcileRoom                      ← ③  (+종료시각 기준 pull 보정: 신규)
  BodaWebhookService.handle                               ← ④  (event 21 → 녹화 레코드 적재: 신규)
  ┌ GET  /api/acm/cal/events/:id/recordings                        (상태 + 목록)
  ├ POST /api/acm/cal/events/:id/recordings/sync                   (즉시 동기화)
  ├ POST /api/acm/cal/events/:id/recordings/:recordIdx/ticket      (5분 재생 티켓)
  ├ GET  /api/acm/cal/recordings/:ticket[?dl=1]                    (Range 스트리밍 — 보관본 우선)
  ├ GET  /api/acm/cal/events/:id/class-record                      (기존)
  └ POST /api/admin/cal/events/:evtId/boda/reconcile               (기존 — UI 에서 호출)
  ▼
frontend-acm (admin)
  cal-event-detail-page.tsx  ·  cal-event-modal.tsx
    🎬 수업 녹화본  (녹화 상태 배지 + 재생 / 다운로드)
    🕐 강의실 기록  (예약 vs 실제 + 참석자 입·퇴장 + [기록 동기화])
```

## 2.1 User Decisions (사용자 결정 — 2026-09-12)

| 결정 | 반영 |
|---|---|
| **P1 → P2 순서로 구현, P0 은 이후 설정** | 코드는 선반영. 연동 전에는 상태 배지가 `강의실 미개설/녹화 없음` 으로 표시되고 오류 없이 렌더 |
| **룸 녹화 상태 표시 필요** | 이벤트 단위 상태 7종(`NOT_APPLICABLE/NO_ROOM/UPCOMING/IN_PROGRESS/AWAITING/NO_RECORDING/AVAILABLE`) + 항목별 보관 상태 배지 |
| **녹화본은 학원 운영자·강사에게만** | 콘솔 `ADMIN·STAFF·TEACHER(관련자)` 로 제한, **포털은 담당 강사만** — 학생·학부모에게는 빈 목록/403 |
| **ACM 서버로 복사 보관** | `amb_acm_cal_boda_recording` + S3(MinIO) 스트림 복사 워커. 보관본이 생기면 보다 보관주기와 무관하게 재생 가능 |

## 3. Phases (작업 단계)

### P0. 운영 선결 — 보다 연동 활성화 (코드 아님 / 사용자·보다 담당자)

> **이 단계 없이는 어떤 코드도 실데이터를 보여줄 수 없다** (현재 프로덕션 `BODA_MODE=mock`, 모든 룸 `PENDING`).

| # | 작업 | 담당 |
|---|---|---|
| P0-1 | 프로덕션 `.env.production` 의 `BODA_MODE` 를 실연동 값으로 전환 후 backend 재기동 | 개발(배포) |
| P0-2 | 보다 관리웹에 **이벤트 수신 URL** `https://acm.amoeba.site/api/webhooks/boda` 등록 + 전송 이벤트(1·2·4·5·11·12·21) 활성화 | 보다 담당자 |
| P0-3 | **이벤트 시크릿** 발급 → `/admin/cal/boda/config` 에 저장 (현재 `bdc_event_secret_enc` NULL) | 사용자 |
| P0-4 | 보다 발신 IP 확인 → `bdc_webhook_allow_cidrs` 설정 | 사용자/보다 |
| P0-5 | 룸 **녹화 기능 ON** 여부 확인 (자동 녹화 or 강사 수동 녹화) | 보다 담당자 |

### P1. Backend — **완료**

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| P1-0 | **녹화 보관 테이블** `amb_acm_cal_boda_recording` (recordIdx unique, 보관상태·s3키·크기·재시도) | `sql/acm/999l-acm-cal-boda-recording.sql` | ✅ |
| P1-1 | **BodaRecordingService** — 목록 동기화(upsert) · 상태 판정 · S3 보관 · 스트리밍(보관본 우선, 보다 폴백) · 접근제어 · 재생 티켓 | `application/boda-recording.service.ts` | ✅ |
| P1-2 | **재생 티켓 방식** — `<video>` 는 Authorization 헤더를 못 싣는다. 5분 서명 티켓(`purpose=cal-recording`)을 발급해 무헤더 스트리밍. 세션 토큰 재사용 차단 | `presentation/cal-recording-stream.controller.ts` | ✅ |
| P1-3 | `downloadRecording(range)` + `getObjectStream(key, range)` + `putObjectStream()` — Range 패스스루, 업스트림 206 미지원 시 전체 스트림 폴백, 길이 미상 시 256MB 상한 버퍼 폴백 | `bodaedu/**`, `object-store.client.ts` | ✅ |
| P1-4 | 웹훅 **event 21** 처리 — `recordIdx/recordTitle/recordTime` 적재 후 보관 대기 | `application/boda-webhook.service.ts` | ✅ |
| P1-5 | **웹훅 유실 보정** — sweep 대상을 `ENDED` 방에서 *"예약 종료시각이 지난 PENDING/OPEN/STARTED/PAUSED 방"* 까지 확대하고, `getMeetInfo` 로 실제 개설·시작·종료 시각을 끌어온다 | `application/boda-reconcile.service.ts` | ✅ |
| P1-6 | **보관 워커** `@Cron('*/10 * * * *')` — 최근 48h 종료 수업 목록 동기화 + 보관 대기건 3건씩 복사 | `application/boda-recording.job.ts` | ✅ |
| P1-7 | `getMeetInfo` 일시 정규화 버그 수정 — `openDatetime/startDatetime`(YYYYMMDDhhmmss, KST) 수용 + UTC ISO 변환 (정규화 전에는 `Invalid Date`) | `bodaedu-server-http.client.ts` | ✅ |
| P1-8 | 단위 테스트 15건 신규 + 기존 스펙 갱신 (접근제어·상태판정·동기화·보관 성공/실패/재시도 상한·스트리밍 폴백·티켓 위조 차단) | `boda-recording.service.spec.ts` 외 | ✅ 496 tests pass |

### P2. Frontend — admin 상세 — **완료**

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| P2-1 | `🎬 수업 녹화본` 공용 섹션 — **녹화 상태 배지** + 보관 중/실패 건수 + [녹화본 동기화] | `modules/cal/components/cal-recordings-section.tsx` (신규) | ✅ |
| P2-2 | 재생 = 인앱 `<video controls>` 모달(티켓 URL), 다운로드 = `?dl=1` 새 탭. 항목별 `보다스쿨 원본`/보관본 구분, 크기 표시 | 〃 | ✅ |
| P2-3 | 상세페이지 + 상세모달에 삽입 (403 이면 섹션 자동 숨김) | `pages/cal-event-detail-page.tsx`, `components/cal-event-modal.tsx` | ✅ |
| P2-4 | `🕐 강의실 기록` — 기록 0건이어도 섹션 노출 + 안내 문구 + **[기록 동기화]** 버튼 | 〃 | ✅ |
| P2-5 | i18n 4 locale — `cal.recordings.*`(상태 7종·빈 상태 문구 포함), `cal.boda.record*` | `i18n/locales/{ko,en,vi,zh-CN}/cal.json` | ✅ |
| P2-6 | 포털 녹화본 응답 정규화 대응 (`title/startedAt/playable`) + 학생·학부모 미노출 | `portal-app/api/portal-api.ts`, `portal-cal-event-detail-page.tsx` | ✅ |

### P3. 검증 (1h)

- 스테이징에서 실제 보다 룸 개설 → 녹화 → 종료 → 웹훅 수신(`amb_acm_cal_boda_event_log`) → 상세에서 녹화본·입출입 확인.
- 프로덕션 배포 후 대상 이벤트(`999cb70c…`) 재확인. 단, **과거 수업은 보다 측에 녹화 파일이 없으면 표시되지 않음**.
- 결과는 `docs/test/TEST-260912B-*.md` 로 기록.

### 신규 API (P1 결과)

| Method | Path | 권한 |
|---|---|---|
| GET | `/api/acm/cal/events/:id/recordings` | ADMIN·STAFF·TEACHER(관련자) — 상태 + 목록 |
| POST | `/api/acm/cal/events/:id/recordings/sync` | ADMIN·STAFF — 보다 목록 즉시 재조회 |
| POST | `/api/acm/cal/events/:id/recordings/:recordIdx/ticket` | ADMIN·STAFF·TEACHER — 5분 재생/다운로드 티켓 |
| GET | `/api/acm/cal/recordings/:ticket[?dl=1]` | 티켓 인증 (Range 지원, 스로틀 제외) |

## 4. UI 구성안 (화면 목업)

### 4.1 상세 페이지 `/admin/cal/{evtId}` (모달도 동일 섹션 재사용)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ‹ 수업일정으로                                                        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 영어                                        [입장링크] [수정]     │ │
│ │ (정규수업) ✓수업완료                                              │ │
│ │ 시작 2026-08-31(일) 19:00     종료 2026-08-31(일) 21:00           │ │
│ │ 담당 강사 배예리              장소 —                              │ │
│ │ 참석자 (2)  [S 김민]  [T 배예리]                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │ 🎬 수업 녹화본                                    ← ★신규          │ │
│ │ ┌──────────────────────────────────────────────────────────────┐ │ │
│ │ │ 영어 1차시 녹화            08/31 19:03 ~ 20:58  [▶ 재생][⤓]  │ │ │
│ │ │ 영어 2차시 녹화            08/31 21:01 ~ 21:12  [▶ 재생][⤓]  │ │ │
│ │ └──────────────────────────────────────────────────────────────┘ │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │ 🕐 강의실 기록                         [↻ 기록 동기화] ← ★신규     │ │
│ │ 예약   시작 08/31 19:00      종료 08/31 21:00                     │ │
│ │ ─────────────────────────────────────────────────────────────    │ │
│ │ 실제   개설 18:55  시작 19:02  종료 20:59  폐쇄 21:10             │ │
│ │ ─────────────────────────────────────────────────────────────    │ │
│ │ 실제 수업 입장시간                                                │ │
│ │  [강사] 배예리   19:02 → 21:05 (123분)                            │ │
│ │  [학생] 김민     19:07 → 20:58 (111분)                            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ │ 📝 피드백 / 📚 과제 … (기존)                                      │ │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 빈 상태 (보다 기록 없음)

```
│ 🕐 강의실 기록                              [↻ 기록 동기화]          │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ 아직 보다스쿨에서 수신된 입·퇴장 기록이 없습니다.                 │ │
│ │ 수업 종료 후 약 10분 뒤 자동 반영되며, [기록 동기화] 로 즉시      │ │
│ │ 다시 가져올 수 있습니다.                                          │ │
│ └──────────────────────────────────────────────────────────────────┘ │
```

- 녹화본이 0건이면 `🎬` 섹션 자체를 숨긴다(포털 동작과 동일).
- 보다 연동 비활성(`is_active=false`)·API 장애 시 섹션은 숨기고 상세 화면은 정상 렌더한다.

### 4.3 재생 모달

```
┌─────────────── 영어 1차시 녹화 ───────────────┐
│  ┌──────────────────────────────────────────┐ │
│  │            ▶  (video controls)           │ │
│  └──────────────────────────────────────────┘ │
│                       [⤓ 다운로드]   [닫기]   │
└───────────────────────────────────────────────┘
```

## 5. Risks (리스크)

| # | 리스크 | 대응 |
|---|---|---|
| R-1 | P0(운영 연동)이 지연되면 P1·P2 를 배포해도 화면은 그대로 빈 상태 | UI 는 빈 상태 안내로 안전하게 동작. P0 완료 후 재검증 |
| R-2 | 보다 다운로드 API 가 Range 미지원이면 인라인 재생에서 탐색(seek) 불가 | 전체 스트림 fallback + 다운로드 버튼 병행 제공 |
| R-3 | 대용량 영상 프록시로 백엔드 메모리/대역폭 부담 | 스트림 파이프(버퍼링 없음) 유지, 필요 시 후속으로 서명 URL·캐시 도입 검토(Q-4) |
| R-4 | 과거 수업은 보다 측 녹화 보관 주기 경과 시 조회 불가 | 요구 확인 후 보관 정책 협의(Q-4) |
| R-5 | 녹화본이 관리자뿐 아니라 포털(학생·학부모)에도 이미 노출 중 | Q-3 확인 후 정책 통일 |

## 6. Out of Scope (범위 외)

- 녹화 파일의 ACM 서버 영구 보관·재인코딩
- 녹음(22)·채팅(23)·노트(24) 이력 노출
- 포털(학생·학부모) 화면 변경 — 현행 유지
