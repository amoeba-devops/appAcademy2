---
document_id: CAL-REQ-260920C
version: 1.0.0
status: APPROVED — 구현은 docs/plan/PLN-260920C-boda-recording-vendor-reply-followup.md
date: 2026-09-20
related:
  - docs/analysis/REQ-260912B-cal-boda-recording-attendance.md
  - docs/plan/PLN-260912B-cal-boda-recording-attendance.md (DEPLOYED — PR #211 1190df0)
  - docs/report/체크리스트-보다스쿨-설정.md
  - docs/reference/BODA-vendor-questions-master-260624.md
change_log:
  - 2026-09-20 v1.0.0 사용자 승인("작업 진행") → PLN-260920C 로 B-1·B-2·B-3·C-1·D 구현 (Claude Code)
  - 2026-09-20 v0.1.0 초안 — 보다스쿨 벤더 회신(인증·IP·녹화 설정·파일 제약) 반영 후속 작업 정리 (Claude Code)
---

# REQ-260920C — 보다스쿨 녹화 연동 벤더 회신 반영 / BODA Recording Vendor-Reply Follow-up

## 1. Background (배경)

PLN-260912B 로 녹화본·입출입 기록 기능(백엔드·프론트)은 **프로덕션에 배포 완료**됐으나, P0(운영 연동)이 벤더 회신 대기로 남아 있었다. 2026-09-20 벤더(㈜새하컴즈) 회신으로 P0 의 미결 항목이 모두 확정됐다.

## 2. Vendor Reply Summary (벤더 회신 요약)

| # | 질문 | 회신 | 코드 영향 |
|---|---|---|---|
| 2 | 이벤트 인증(시크릿/토큰) | **없음** — IP 허용목록만으로 운영 | `verifyAuth` 는 이미 IP-only 허용 (FIX-260624). 시크릿 미설정 상태 그대로 둠 |
| 3 | 발신 서버 IP | `121.170.164.136`, `121.170.164.137`, `121.170.164.138` (3개) | `bdc_webhook_allow_cidrs` 에 CSV 등록 |
| 4 | 녹화 활성화 | **서버녹화 ON, 자동 녹화**. 시작 조건: 진행자(강사) 포함 **2명 입장 시** 자동 시작 | 강사 매뉴얼 반영. 학생 미입장 수업은 녹화본 없음 → `NO_RECORDING` 정상 |
| 5-1 | 보관 기간 | 기본 **1년**, 필요 시 요청 | ACM S3 복사 보관이 이미 구현됨 → 1년으로 충분. 회신 불필요(현행 유지) |
| 5-2 | 다운로드 API HTTP Range | **미지원** — 항상 전체 파일 전송 | 보관 전 직프록시 재생은 seek 불가(전체 스트림 폴백 이미 구현). **Content-Length 미제공 시 256MB 상한 버퍼 폴백이 2h 영상에서 실패할 수 있음** → §4 T-3 |
| 5-3 | 동시 요청/속도 제한 | 명시 제한 없음(Tomcat·디스크·대역폭 의존) | 아카이브 워커 10분·3건 직렬 처리 현행 유지 |
| 참고 | 8/31 19:00~21:00 `tac-999cb70c…` | **녹화 파일 2개 존재** | 연동 후 `[녹화본 동기화]` 로 즉시 검증 가능 |

## 3. Gap Analysis (현행 코드 대조)

### 3.1 그대로 동작하는 것
- 웹훅 인증: 시크릿 NULL + CIDR 설정 → IP 단독 통과 ([boda-webhook.service.ts:76-115](../../backend/src/modules/acm-cal/application/boda-webhook.service.ts#L76-L115)).
- allowlist 파서: 단일 IP CSV 지원 (`121.170.164.136,121.170.164.137,121.170.164.138`).
- 관리자 설정 UI `/admin/config/boda` 에 `webhookAllowCidrs` 입력란 존재 ([boda-config-section.tsx](../../frontend-acm/src/modules/cfg/components/boda-config-section.tsx)).
- Range 미지원 폴백: `partial=false` 로 200 전체 스트림 ([bodaedu-server-http.client.ts:101-136](../../backend/src/infrastructure/external/bodaedu/infrastructure/bodaedu-server-http.client.ts#L101-L136)), 보관본(S3)은 Range 206 정상.
- event 21 수신 → 녹화 메타 적재 → 워커 복사 ([boda-webhook.service.ts:189](../../backend/src/modules/acm-cal/application/boda-webhook.service.ts#L189)).
- 웹훅 유실 보정: 예약 종료시각 지난 PENDING 방도 `getMeetInfo` 로 pull (PLN-260912B P1-5).

### 3.2 보완이 필요한 것

| # | 문제 | 근거 | 심각도 |
|---|---|---|---|
| G-1 | **IP 가 유일한 인증 수단인데 발신 IP 판정이 `X-Forwarded-For` 첫 항목** — 외부 클라이언트가 `X-Forwarded-For: 121.170.164.136` 을 붙여 보내면 host nginx 가 뒤에 실 IP 를 append 하므로 첫 항목 = 위조값 → allowlist 우회 가능 | [boda-webhook.controller.ts:158-167](../../backend/src/modules/acm-cal/presentation/boda-webhook.controller.ts#L158-L167), `main.ts` 에 `trust proxy` 미설정, 프록시 2단(host nginx → 컨테이너 nginx → backend) | **High** (시크릿 없음이 확정된 지금 실질 취약점) |
| G-2 | 아카이브 워커가 업스트림 `Content-Length` 부재 시 **256MB 메모리 버퍼 상한** → 2시간 수업(수백 MB~GB) 은 `RECORDING_TOO_LARGE_WITHOUT_CONTENT_LENGTH` 로 3회 실패 후 `FAILED` 고착 | [boda-recording.service.ts:403-455](../../backend/src/modules/acm-cal/application/boda-recording.service.ts#L403-L455), `putObjectStream` 이 `ContentLength` 필수 | **Med** — 벤더 응답 헤더 실측 전까지 미확정. Tomcat 파일 응답은 보통 Content-Length 를 주지만 chunked 이면 즉시 문제 |
| G-3 | 프로덕션 `BODA_MODE=mock` | `.env.production` (REQ-260912B §2.2 실측) | 연동 전제 |
| G-4 | 강사 매뉴얼에 녹화 안내 없음 | `manual-teacher.html`, `GUIDE-260611-teacher-boda-classroom.md` 에 "녹화" 언급 0건 | Low |
| G-5 | cron 동기화 lookback 48h → 8/31 수업 등 과거 건은 자동 수집 안 됨 | [boda-recording.service.ts:582](../../backend/src/modules/acm-cal/application/boda-recording.service.ts#L582) | Low — UI `[녹화본 동기화]` 버튼으로 수동 가능. 1회성 백필 여부만 결정 |

## 4. Tasks (작업 항목)

### A. 운영 설정 (코드 아님)

| # | 작업 | 담당 | 비고 |
|---|---|---|---|
| A-1 | `/admin/config/boda` → **Webhook 허용 IP** 에 `121.170.164.136,121.170.164.137,121.170.164.138` 저장 (이벤트 시크릿은 비워 둠) | 사용자 | 저장 후 DB `bdc_webhook_allow_cidrs` 확인 |
| A-2 | 프로덕션 `docker/production/.env.production` 의 `BODA_MODE=mock` → `http` 후 backend 재기동 | 개발(배포) | 재기동 시점 협의(수업 없는 시간) |
| A-3 | 벤더에 **수신 URL `https://acm.amoeba.site/api/webhooks/boda` 등록 + 이벤트 1·2·4·5·11·12·21 전송 활성화** 요청 확인 (질문 1번 회신 여부 확인 필요) | 사용자 → 벤더 | 회신 본문에 1번 항목이 없음 |
| A-4 | 서버 인바운드: 443 공개 상태라 별도 방화벽 개방 불필요. 필요 시 3개 IP 만 `/api/webhooks/boda` 허용하는 nginx `allow/deny` 는 선택 | 개발 | G-1 보완의 심층 방어 |
| A-5 | 보관 기간: 벤더 기본 1년 그대로 수용 (ACM 이 S3 복사 보관하므로 추가 요청 없음) | — | 회신 불필요 |

### B. 코드 수정 (필수)

| # | 작업 | 파일 |
|---|---|---|
| B-1 | **웹훅 발신 IP 판정을 신뢰 가능한 홉으로 변경** — `main.ts` 에 `app.set('trust proxy', N)`(프로덕션 2홉: host nginx + 컨테이너 nginx) 또는 XFF 를 뒤에서부터 신뢰 홉 수만큼 제거한 값 사용. `X-Real-IP` 는 컨테이너 nginx 가 127.0.0.1 로 덮어쓰므로 사용 불가. env `BODA_WEBHOOK_TRUSTED_PROXY_HOPS`(기본 2) 로 staging/prod 차이 흡수 | `backend/src/main.ts`, `presentation/boda-webhook.controller.ts` + spec |
| B-2 | **아카이브 업로드를 멀티파트 스트림으로 전환** — `@aws-sdk/lib-storage` `Upload` 로 Content-Length 없이도 디스크/메모리 상한 없이 복사. 256MB 버퍼 폴백 제거 | `object-store.client.ts`, `boda-recording.service.ts`, `backend/package.json` |
| B-3 | 보관 전(직프록시) 재생 UX — `partial=false` 응답일 때 `Accept-Ranges: none` 으로 내려 브라우저가 seek 를 시도하지 않게 하고, 프론트 상태 배지에 "보관 완료 전에는 구간 이동 불가" 안내 (4 locale) | `cal-recording-stream.controller.ts`, `cal-recordings-section.tsx`, `i18n/*/cal.json` |

### C. 코드 수정 (선택)

| # | 작업 | 파일 |
|---|---|---|
| C-1 | 다운로드 fetch 에 타임아웃/재시도 없음 → 벤더 속도 제한 없다지만 대용량 전송 중 끊김 대비 `AbortSignal.timeout(30분)` + FAILED 사유 기록 | `bodaedu-server-http.client.ts` |
| C-2 | 과거 수업 1회 백필 — 종료된 BODASCHOOL 이벤트 전건 `syncEvent` (관리자 엔드포인트 또는 스크립트). 8/31 건 등 | `boda-recording.job.ts` 또는 `scripts/` |
| C-3 | 웹훅 수신 여부 운영 가시화 — `/admin/config/boda` 에 최근 수신 이벤트 시각·건수 표시 | `boda-config-section.tsx`, config controller |

### D. 문서·매뉴얼

| # | 작업 | 파일 |
|---|---|---|
| D-1 | 강사 매뉴얼에 **자동 녹화 안내** 추가: "서버 녹화 자동, 강사 포함 2명 입장 시 시작 → 학생 미입장 시 녹화 없음 → 수업 후 상세에서 녹화본 확인" | `frontend-acm/public/web/manual/manual-teacher.html`, `manual-class.html`, `docs/reference/GUIDE-260611-teacher-boda-classroom.md` |
| D-2 | 체크리스트 §3·§4 갱신(②시크릿 없음 확정, ③IP 3개, 녹화 자동) | `docs/report/체크리스트-보다스쿨-설정.md` |
| D-3 | 벤더 질문 마스터 A2·A3·D2 상태를 회신 완료로 갱신 | `docs/reference/BODA-vendor-questions-master-260624.md` |
| D-4 | PLN-260912B P0 표 상태 갱신 + 실데이터 검증 결과 `docs/test/TEST-260912B-*.md` | `docs/plan/PLN-260912B-…`, `docs/test/` |

### E. 연동 후 검증 (A+B 배포 후)

1. 강사 개설 → `amb_acm_cal_boda_event_log` 에 event 1 수신, `src_ip` 가 121.170.164.x 인지 확인.
2. 위조 헤더 테스트: 외부에서 `X-Forwarded-For: 121.170.164.136` 붙여 POST → **401** 이어야 함 (B-1 검증).
3. `/admin/cal/999cb70c-ff33-4624-95f2-1f2218baa471` → `[녹화본 동기화]` → 2건 목록 → 워커 10분 내 `ARCHIVED` → 재생·다운로드·seek 확인.
4. `[기록 동기화]` → 8/31 입·퇴장 기록 표시 확인.
5. 신규 수업 1건 실전: 강사+학생 입장 → 자동 녹화 → 종료 → event 21 수신 → 상세 반영.

## 5. Proposed Order (권장 순서)

1. **B-1** (IP 위조 차단) → 배포. 이것 없이 A-1 만 하면 인증이 사실상 무력.
2. **A-1 → A-2 → A-3** 순으로 운영 연동 활성화.
3. **E-1·E-2·E-3** 검증 — 여기서 다운로드 응답의 `Content-Length` 유무를 실측해 **B-2 우선순위 확정**.
4. B-2·B-3·D-1 후속 PR.

## 6. Open Questions (미결)

| Q | 내용 | 확인 대상 |
|---|---|---|
| Q-1 | 벤더 회신 본문에 **1번 항목(수신 URL 등록·이벤트 활성화)** 이 빠져 있음 — 이미 등록됐는지 별도 확인 필요 | 사용자/벤더 |
| Q-2 | 다운로드 응답에 `Content-Length` 가 오는지 (B-2 필수 여부) | 연동 후 실측 |
| Q-3 | 과거 수업 전건 백필(C-2) 실행 여부 — 보다 보관 1년 이내 건은 모두 복사 가능하나 S3 용량 검토 필요 | 사용자 |
