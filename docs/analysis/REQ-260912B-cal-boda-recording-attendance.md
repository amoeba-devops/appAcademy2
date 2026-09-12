---
document_id: CAL-REQ-260912B
version: 0.1.0
status: DRAFT (사용자 확인 대기 — CLAUDE.md §9.2)
date: 2026-09-12
related:
  - docs/plan/PLN-260728F-cal-boda-record-feedback.md
  - reference/BODA_API_TPI/BODA SERVER API 가이드 [SPEC_823]_v823.002.pdf
  - reference/BODA_API_TPI/BODA 이벤트 연동 가이드 [SPEC_823]_v823.002.pdf
change_log:
  - 2026-09-12 v0.1.0 초안 — 수업일정 상세의 보다스쿨 녹화본 링크 활성화 + 입·퇴장 기록 노출 (Claude Code)
---

# REQ-260912B — 수업일정 상세: 보다스쿨 녹화본 · 입출입 기록 / BODA Recording & Attendance on Event Detail

## 1. Requirement (요구사항)

`/admin/cal` 수업일정 **상세 모달 및 상세 페이지**(`/admin/cal/{evtId}`, 예: `999cb70c-ff33-4624-95f2-1f2218baa471`)에서

- **R-1** 종료된 수업에 대해 **보다스쿨에 저장된 녹화 동영상 링크를 활성화**한다 (관리자 콘솔).
- **R-2** **수업 상세(입·퇴장 기록)** 내용을 볼 수 있어야 한다.
- **R-3** 위 두 가지를 보다스쿨 API 스펙(SPEC_823 v823.002)에 근거해 구현 가능하도록 방안을 확정한다.

## 2. As-Is (현행 실태 — 2026-09-12 프로덕션 실측)

### 2.1 코드 (구현되어 있는 것)

| 계층 | 항목 | 상태 |
|---|---|---|
| BODA client | `listRecordings(meetKey)` → `GET /svr/record/log/video?searchType=ROOM` | **구현됨** |
| BODA client | `downloadRecording(recordIdx)` → `GET /svr/record/log/video/{recordIdx}/download` | **구현됨** |
| BODA client | `getJoinLog(meetKey)` → `GET /svr/meet/log/user/join` | **구현됨** |
| Backend admin | `GET /api/acm/cal/events/:id/recordings` | **구현됨** |
| Backend admin | `GET /api/acm/cal/events/:id/class-record` (개설·시작·종료·폐쇄 + 참석자 입·퇴실) | **구현됨** |
| Backend admin | 녹화 파일 **다운로드/스트리밍 라우트** | **없음** ❌ (포털에만 존재) |
| Backend | Webhook `POST /api/webhooks/boda` — event 1·2·3·4·5·10·11·12 처리 | 구현됨 |
| Backend | Webhook **event 21(녹화파일 저장 완료)** | **no-op** ❌ ([boda-webhook.service.ts:175](../../backend/src/modules/acm-cal/application/boda-webhook.service.ts#L175)) |
| Frontend admin | 상세페이지 `🕐 강의실 기록`(입·퇴장) 섹션 | 구현됨 (데이터가 없어 미표시) |
| Frontend admin | `🎬 녹화본` 섹션 | **없음** ❌ (포털 상세페이지에만 존재) |

### 2.2 운영 데이터 (프로덕션 `db_acm`)

| 확인 항목 | 실측값 | 영향 |
|---|---|---|
| `BODA_MODE` (tac-prod-backend env) | **`mock`** | 모든 SERVER API 호출이 목 클라이언트로 감 → `listRecordings()` 가 **항상 빈 배열**, download 는 `MOCK_NO_RECORDING` |
| `amb_acm_cal_boda_config` | svrUrl `https://svr.bodaedu.kr`, companyCode `245`, companyId `tpi`, roomCode `699`, authKey **설정됨**, `is_active=true` | SERVER API 호출 자격은 준비됨 |
| 〃 `bdc_event_secret_enc` | **NULL** | 웹훅 서명 검증 불가 → 이벤트 수신 불가 |
| `amb_acm_cal_boda_room` (전체) | **모두 `PENDING`**, `meet_idx`/`opened_at`/`started_at`/`ended_at`/`closed_at` 전부 NULL | 보다 웹훅이 **한 번도 도달한 적 없음** |
| `amb_acm_cal_boda_participant` | 14건, 전부 `ama-user-mem-1`·`ama-user-mgr-1`(kind=UNKNOWN), 최종 2026-07-28 | 전부 **mock fixture** — 실제 입·퇴장 기록 0건 |
| 대상 이벤트 `999cb70c…` (영어, 8/31 19:00~21:00 KST) | room=PENDING, 참석자 0, 녹화 0 | 상세에 기록/녹화 섹션이 **아예 렌더되지 않음** |

### 2.3 결론

> **현재 프로덕션은 보다스쿨과 실제로 연동되어 있지 않다.** 녹화본·입출입 기록이 "비활성"인 것이 아니라 **데이터 자체가 들어온 적이 없다.** 따라서 본 요구사항은 프론트엔드 UI 추가만으로는 충족되지 않으며, **연동 활성화(운영 설정) → 백엔드 보강 → UI** 순서가 필요하다.

## 3. BODA API 근거 (SPEC_823 v823.002)

### 3.1 녹화 목록 — `GET [WEB Host]/svr/record/log/video`

| Parameter | 값 |
|---|---|
| `searchType` | `ROOM` |
| `meetKey` | ACM 이 관리하는 회의 구분 키 (`tac-{evtId 32hex}`) |
| `page` / `size` | 페이징 (default size 1000) |

Response `content[]`: `recordIdx`, `roomCode`, `meetIdx`, `recordTitle`, `startDatetime`(YYYYMMDDhhmmss), `endDatetime`, **`fileExist`**, `detailInfo`

### 3.2 녹화 파일 다운로드 — `GET /svr/record/log/video/{recordIdx}/download`

- Basic 인증(Base64(companyCode:authKey)) 필요, 응답은 **파일 스트림**.
- 문서 권고: *"서버에 파일을 저장하기 위한 용도로 사용하는 것을 권장"*.
- **공개 재생(Play) URL 은 API 스펙에 존재하지 않는다.** → 브라우저에서 바로 열 수 있는 링크를 만들려면 **ACM 백엔드가 인증 프록시**가 되어야 한다. (현 포털 구현 방식과 동일)

### 3.3 참석자 입/퇴장 이력 — `GET /svr/meet/log/user/join`

Response `content[]`: `meetIdx`, `meetKey`, `userId`, `userName`, `joinDatetime`, `quitDatetime`, `userTypeCd`, `clientType`
→ 웹훅(11/12)이 유실돼도 **이 API 가 권위 데이터**. 현 `BodaReconcileService` 가 이미 사용.

### 3.4 이벤트(웹훅)

| 코드 | 이름 | ACM 처리 |
|---|---|---|
| 1·2·3·4·5·10 | 개설/시작/일시중지/종료/폐쇄/전체폐쇄 | 룸 상태머신 반영 |
| 11·12 | 참석자 입장/퇴장 | participant upsert |
| **21** | **녹화파일 저장 완료** (`recordIdx`, `recordTitle`, `recordTime`) | **미처리** |

수신 URL 은 **보다 관리 웹에 등록**되어 있어야 하며, 이벤트별 전송 여부도 보다 담당자를 통해 설정한다(이벤트 가이드 §2).

## 4. Gap & To-Be (격차와 목표)

| # | Gap | To-Be |
|---|---|---|
| G-1 | 프로덕션 `BODA_MODE=mock` | 실 연동 모드로 전환 |
| G-2 | 웹훅 event secret 미설정 + 보다 관리웹에 수신 URL 미등록 | 시크릿 발급·등록, `POST /api/webhooks/boda` 등록, IP allowlist 설정 |
| G-3 | 룸이 `PENDING` 에서 전이되지 않으면 reconcile sweep 대상에서 제외 | 웹훅 유실 대비 **예약 종료시각 기준 pull 보정** 경로 추가 |
| G-4 | 관리자 콘솔에 녹화 다운로드/재생 라우트 없음 | admin download(+Range) 라우트 추가 |
| G-5 | 관리자 상세(모달/페이지)에 녹화본 섹션 없음 | `🎬 수업 녹화본` 섹션 추가 (4 locale i18n) |
| G-6 | 입출입 기록이 데이터 부재로 미표시, 수동 동기화 수단이 UI 에 없음 | `기록 동기화` 버튼(기존 `POST /admin/cal/events/:evtId/boda/reconcile` 연결) |
| G-7 | event 21 미처리 → 녹화 존재 여부를 사전에 알 수 없음 | event 21 로그 적재 + 룸 캐시 갱신(선택) |

## 5. Acceptance Criteria (인수 조건)

- **AC-1** 종료된 BODASCHOOL 수업 상세(모달·페이지)에서 보다스쿨에 저장된 녹화본 목록(제목·녹화 시각)이 보이고, 각 항목의 **재생 / 다운로드**가 동작한다.
- **AC-2** `fileExist=false` 항목은 목록에서 제외한다.
- **AC-3** 수업 상세에서 개설·시작·종료·폐쇄 시각과 참석자별 입·퇴장 시각·체류시간이 보인다.
- **AC-4** 기록이 비어 있을 때 관리자가 `기록 동기화`로 보다 SERVER API 에서 즉시 재수집할 수 있다.
- **AC-5** 신규 UI 문자열은 ko/en/vi/zh-CN 4 locale 키로 제공한다(하드코딩 금지).
- **AC-6** 보다 미연동/장애 시에도 상세 화면은 오류 없이 렌더되고 안내 문구를 표시한다.

## 6. Open Questions (미결)

| Q | 내용 | 확인 대상 |
|---|---|---|
| Q-1 | 프로덕션 실연동 전환 시점 — 보다스쿨 담당자 협의 필요 (웹훅 URL·이벤트 시크릿·IP allowlist) | 사용자/보다 담당자 |
| Q-2 | 녹화 기능이 보다 룸 설정에서 **켜져 있는지**(자동 녹화 여부). 꺼져 있으면 녹화본 자체가 생성되지 않음 | 보다 담당자 |
| Q-3 | 녹화본을 **학부모/학생 포털에도** 계속 노출할지 (현재 포털은 이미 노출 중) | 사용자 |
| Q-4 | 녹화 파일 보관 주기·용량 — ACM 서버로 복사 보관할지, 매번 프록시할지 | 사용자 |
