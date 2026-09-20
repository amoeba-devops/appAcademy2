---
document_id: CAL-FIX-260920-boda-server-api-envelope
version: 1.0.0
status: FIXED (배포 대기)
date: 2026-09-20
related:
  - docs/plan/PLN-260920C-boda-recording-vendor-reply-followup.md
  - docs/plan/PLN-260912B-cal-boda-recording-attendance.md
  - reference/BODA_API_TPI/BODA SERVER API 가이드 [SPEC_823]_v823.002.pdf §2.1·§2.3
---

# FIX-260920 — 보다 SERVER API 응답 봉투 미해제로 녹화·출결 목록이 항상 빈 배열 / BODA SERVER API envelope not unwrapped

## 1. Symptom (증상)

2026-09-20 06:56Z 프로덕션 `BODA_MODE=http` 전환 후 07:00Z 첫 cron:

- `BodaRecordingJob` — `recording sweep: synced=3/3 archived=0 failed=0` 인데 `amb_acm_cal_boda_recording` **0행**.
- `BodaReconcileService` — 모든 룸에 `reconcile skipped (vendor down) … client error status=405 MethodNotAllowed` (`GET /svr/meet/info`).
- 벤더는 8/31 수업(`tac-999cb70cff33462495f21f2218baa471`) 녹화 2건이 있다고 회신.

## 2. Root Cause (원인)

프로덕션 호스트에서 벤더 API 를 직접 호출해 실측:

```
GET /svr/record/log/video?searchType=ROOM&meetKey=tac-999cb70c…&size=100
→ 200 {"status":0,"data":{"page":0,"size":100,"total":2,"totalPages":1,
        "content":[{"recordIdx":8253,"meetIdx":80285,"recordTitle":"영어",
                    "startDatetime":"20260831190737","endDatetime":"20260831191210","fileExist":true},
                   {"recordIdx":8251,…}]},"success":true}
```

| # | 원인 | 위치 |
|---|---|---|
| R-1 | SPEC_823 §2.1 "각 API 호출 결과는 **`data` 객체 하위**로 전달" — 클라이언트는 최상위 `content` 를 읽어 항상 `[]` | `bodaedu-server-http.client.ts` `listRecordings` / `getJoinLog` |
| R-2 | `/svr/meet/info` 는 스펙상 **POST**(GET 호출 → 405) 이고, 응답에 상태·개설/시작/종료 시각이 없다(제목·개설자만). reconcile 이 필요한 시각은 §2.3 **회의 결과 목록** `GET /svr/meet/log/list?searchType=ROOM&meetKey=` 에 있음 | `getMeetInfo` |
| R-3 | 목 클라이언트는 인터페이스 객체를 직접 반환하므로 봉투 문제가 테스트에서 드러나지 않았고, HTTP 클라이언트 단위 스펙이 없었다 | — |

## 3. Fix (수정)

- `fetchJson` → `unwrapEnvelope`: `{ success: boolean, data }` 이면 `data` 반환, `success=false` 면 `BodaeduUnavailableException(errorCode errorName)`. 봉투가 아닌 응답(구형/목)은 그대로.
- `listRecordings` / `getJoinLog`: 공통 `contentOf()` 로 페이징 `content[]` 추출 (join log 는 구형 `entries`/bare array 도 호환).
- `getMeetInfo`: `GET /svr/meet/log/list?searchType=ROOM&meetKey=` 로 교체. 0건 → `null`(시작된 적 없음). 같은 키 재사용 시 `openDatetime` 최신 건. 상태는 `closeDatetime→CLOSED / endDatetime→ENDED / startDatetime→STARTED / openDatetime→OPEN` 으로 도출, `userCount` → `currentUserCount`.
- 신규 `bodaedu-server-http.client.spec.ts` 9건 — 프로덕션 실측 페이로드 fixture 포함.

## 4. Verification (검증)

- 단위: 위 스펙 + 기존 acm-cal 스위트 통과 (`tsc`·`jest`·`eslint`).
- 프로덕션(배포 후): 다음 10분 cron 에서 8/31 건 `recordIdx 8253·8251` upsert → `ARCHIVED` → 상세 화면 재생. reconcile 405 경고 소멸, 8/31 룸 `ENDED` + 입·퇴장 기록 표시.
