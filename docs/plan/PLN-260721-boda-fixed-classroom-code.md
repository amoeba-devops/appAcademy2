---
document_id: PLN-260721-boda-fixed-classroom-code
version: 1.0.0
status: draft
created: 2026-07-21
authors:
  - Claude (Opus 4.8)
related:
  - docs/design/DSN-260721-boda-fixed-classroom-code.md (v1.0.0)
  - docs/reference/BODA-vendor-roomcode-request-260721.md (R-1 선결 벤더 회신)
  - docs/implementation/RPT-260610-acm-cal-boda-integration.md (재사용 인프라 T1–T7)
  - docs/analysis/REQ-260610-acm-cal-boda-instant-classroom.md (즉시강의 패턴 참조)
change_log:
  - 2026-07-21: v1.0.0 draft — DSN-260721 구현계획 (7 트랙)
---

# 구현계획 — 이벤트 비종속 영구 고정코드 강의실 (PLN)

> [DSN-260721](../design/DSN-260721-boda-fixed-classroom-code.md) 을 구현으로 옮기는 7 트랙 계획.
> 기존 BODA T1–T7 라이프사이클(webhook/reconcile/close)은 **재사용**하고, 신규는 "FIXED 방 종류 +
> 시간창 없는 런처 + 강사/학생 진입점" 에 한정한다.

---

## 0. 선결 조건 (Blocking) & 착수 판정

| 게이트 | 내용 | 영향 트랙 |
|---|---|---|
| **G-1 (권장 선결)** | 벤더 ⑤ 회신 — **고정 meetKey 재사용 가부** ([요청서 §2 ⑤](../reference/BODA-vendor-roomcode-request-260721.md)) | T1·T2 의 meetKey 전략 확정 (R-1) |
| G-2 (학생 완결) | 벤더 ①·② — webhook 등록 / JOIN_KEY 허용 | T5 학생 입장 완결도 |

- **G-1 미회신 상태로 착수 시**: DSN R-1 **fallback(고정 roomId + 회전 meetKey)** 을 기본 구현으로 잡는다. 재사용 허용 회신이 오면 T1 의 `resetForReopen` 이 meetKey 를 보존하도록 1줄 토글.
- 전체 기능은 **`BODA_FIXED_ROOM_ENABLED`(기본 false)** 뒤에서 개발 → 회신 무관하게 병행 가능.

---

## 1. 트랙 개요 (7 tracks)

| 트랙 | 범위 | 산출물 | 의존 |
|:---:|------|--------|:---:|
| **T1** | 스키마 + 엔티티 | 마이그레이션 1, 엔티티 컬럼 3 | — |
| **T2** | `BodaFixedRoomService` (getOrCreate / resetForReopen / meetKey) | service + spec | T1 |
| **T3** | 런처 컨텍스트 `buildForFixed` (시간창 우회 + 인가) | launch-context 확장 + spec | T2 |
| **T4** | API 엔드포인트 4종 (fixed-room / launch-context ×2 / list) | controller + DTO + spec | T2·T3 |
| **T5** | 학생 인가(CLS 수강) + 입장 3단 fallback 배선 | 인가 로직 + 폴링 재사용 | T3·T4 |
| **T6** | 프론트 — 강사 카드 / 학생 카드 / `/portal/classroom/fixed/:roomId` 분기 | FE 컴포넌트 3 + i18n ×4 | T4 |
| **T7** | 라이프사이클 회귀검증 (webhook/reconcile/close 가 FIXED 방에서 동작) | 통합 spec + mock 시연 | T1–T5 |

---

## 2. 트랙 상세

### T1 — 스키마 + 엔티티
- `sql/acm/9XX-acm-cal-boda-fixed-room.sql` (멱등, CD step4 자동적용):
  - `evt_id` DROP NOT NULL
  - `uq_acm_boda_room_evt` → partial `WHERE evt_id IS NOT NULL`
  - `bdr_kind`('EVENT'|'FIXED', DEFAULT 'EVENT', CHECK) · `bdr_owner_user_id` · `bdr_title`
  - `uq_acm_boda_room_fixed_owner` partial unique `WHERE bdr_kind='FIXED'`
  - `uq_acm_boda_room_meet_key` **유지**
- `boda-room.typeorm-entity.ts` 에 3 컬럼 추가.
- ✅ AC: 기존 EVENT 행 무영향(`bdr_kind` 기본값), `deleted`/NOT NULL 회귀 없음.

> ⚠️ 컨벤션 함정: `amb_acm_cal_boda_room` 은 `created_at`/`updated_at` **비접두어형**(엔티티 확인됨). raw SQL 에서 접두어 오용 금지 — [[project_cls_table_prefixed_columns]] 사례와 반대 케이스이므로 엔티티 기준으로 재확인.

### T2 — `BodaFixedRoomService`
- `getOrCreate({ entId, ownerUserId, title? })` — `(ent_id, owner)` 조회 → 없으면 FIXED 행 INSERT.
- `makeFixedMeetKey()` — `tac-fix-{16 hex}` (gen_random 아님, 앱단 crypto 랜덤).
- `resetForReopen(meetKey)` — ENDED/CLOSED FIXED 방을 `PENDING`+`meetIdx=NULL`+타임스탬프 클리어.
  - **G-1 토글 지점**: 재사용 불가 회신 시 여기서 `meetKey` 도 새로 회전(roomId·launcherUrl 은 불변).
- `createPending` 의 roomCode 결정·config isActive 검사 로직을 공유 헬퍼로 추출해 재사용.
- ✅ AC(spec): getOrCreate 멱등 / meetKey 포맷·유일성 / reset 상태전이 / config 비활성 시 422.

### T3 — 런처 컨텍스트 `buildForFixed`
- `boda-launch-context.service.ts` 에 `buildForFixed(roomId|ownerUserId, actor, lang)` 추가:
  - `assertTimeWindow` **미호출** (이벤트/시각 없음).
  - 인가: `owner === actor` → UTy 11(bodaOpen). 인가 학생 → UTy 12(bodaJoin).
  - 반환은 기존 `BodaLaunchContext` 형태 유지(evtTitle=강의장명, evtStart/End 는 null-safe 처리).
- ✅ AC(spec): 강사 owner→11 / 학생→12 / 무관자 403 / 시간창 검사 미적용 확인.

### T4 — API 엔드포인트
| Method | Path | 인증 |
|---|---|---|
| POST | `/api/admin/cal/boda/fixed-room` | JWT + `TEACHER`\|`ADMIN` |
| GET | `/api/cal/boda/fixed-launch-context?roomId=&lang=` | JWT (콘솔) |
| GET | `/api/portal/cal/boda/fixed-launch-context?roomId=&lang=` | JWT (포털) |
| GET | `/api/portal/cal/boda/fixed-rooms` | JWT (포털) |
- `launcherUrl = /portal/classroom/fixed/{roomId}` (+`?autoStart=1` 강사).
- ✅ AC: 무인증 401 / 학부모 fixed-room POST 403 / 학생 list 는 인가 강의장만.

### T5 — 학생 인가 + 입장 fallback
- 인가 소스: FIXED owner 담당 활성 클래스 학생(`cls_teacher` join, 즉시강의 suggestions 로직 재사용).
- 입장 3단(DSN §4): JOIN_IDX(캐시 meetIdx) → JOIN_KEY(벤더 ② 시) → soft-gate 폴링(현행 재사용).
- 폴링: `useBodaLaunchContext(..., { portal:true, pollWhilePending:true })` 를 fixed 훅에 그대로 배선.
- ✅ AC: webhook mock OPEN 후 meetIdx 채워지면 입장 버튼 활성 / PENDING 이면 대기 카드.

### T6 — 프론트엔드
- `components/fixed-classroom-card.tsx` (강사: 지금 시작 / 학생: 입장 대기·LIVE) — DSN §7 목업.
- `web-classroom-page.tsx` 에 `/portal/classroom/fixed/:roomId` 분기(기존 evtId 런처와 컨텍스트 훅만 교체).
- 진입점: `/admin/dashboard` 강사 위젯 + (옵션) `/admin/cal` 헤더.
- i18n: ko/en/vi/zh-CN 4 locale 동시 ([[feedback_i18n_default]]).
- ✅ AC: 강사 autoStart → bodaOpen / 학생 LIVE 전환 / 4 locale 키 누락 0.

### T7 — 라이프사이클 회귀검증
- webhook `applyEvent` / reconcile cron / `forceClose` 가 FIXED 방(meetKey 조회)에서 EVENT 와 동일 동작함을 통합 spec 으로 고정.
- `resetForReopen` ↔ reconcile race(R-5) 안전망: lazy reset + cron 이중.
- ✅ AC: mock 에서 FIXED 방 open→ended→reopen 2회전 성공.

---

## 3. 재사용 vs 신규 (영향 범위)

| 구분 | 항목 |
|---|---|
| **재사용(무변경)** | webhook 수신·dedup·상태전이(meetKey 기반), reconcile cron, forceClose, `enterBodaRoom`/`bodaOpen`/`bodaJoin`, 런처 폴링 훅, config(roomCode/URL/authKey) |
| **신규** | FIXED 스키마 3컬럼+2인덱스, `BodaFixedRoomService`, `buildForFixed`, API 4종, FE 카드 2 + 라우트 분기, CLS 인가 |
| **변경(완화)** | `evt_id` NOT NULL→nullable, `UNIQUE(evt_id)`→partial |

---

## 4. 테스트 계획

| 레벨 | 대상 | 신규 spec(예상) |
|---|---|---|
| unit | BodaFixedRoomService | +6 (getOrCreate 멱등 / meetKey / reset / 422) |
| unit | buildForFixed 인가·시간창미적용 | +4 |
| unit | fixed API 컨트롤러 가드 | +3 |
| 통합 | FIXED 라이프사이클 open→ended→reopen | +3 |
| **합계** | | **~+16** (기존 BODA 111 → ~127) |

---

## 5. 롤아웃 순서

```
G-1 벤더 ⑤ 회신 (권장)
  └─(무회신 병행 시 R-1 fallback 기본)
T1 스키마 → T2 서비스 → T3 런처 → T4 API → T5 인가/입장 → T6 FE → T7 회귀
  └ 전 구간 BODA_FIXED_ROOM_ENABLED=false 뒤에서 개발
staging: mock 2회전 시연 → BODA_MODE=http 컷오버(A1·A2) 후 학생 JOIN_IDX 검증
production: 플래그 true (단일 강사 파일럿 → 전체)
```

- 배포: main push → cd-staging → `gh workflow run cd-production.yml -f sha=<short-sha>` ([[reference_deploy_workflow]]).
- 마이그레이션은 CD 자동 적용(로컬만 수동, [[project_deploy_auto_migrations]]).

---

## 6. 미결 (PLN 단계 결정 필요)

| ID | 질문 | 기한/책임 |
|---|---|---|
| P-1 | 강사 1인 = 고정 강의실 **1개**(현 설계) vs 다강의장 허용? | 운영자 회의 |
| P-2 | roomPwd(비밀번호) 를 FIXED 방 기본 적용할지(R-4 유출 대비) | 보안 검토 |
| P-3 | 진입점 — dashboard 위젯만 vs cal 헤더 병행 | 디자인 |
| P-4 | R-1 fallback 확정 전 T1·T2 착수 여부(플래그 뒤) | 사용자 승인 |

---

## 7. Sign-off (승인 대기)

- 본 PLN 은 **draft**. CLAUDE.md §9.2 에 따라 **사용자 확인 후 구현(T1) 착수**.
- 권장 순서: **벤더 요청서 발송 → ③·⑤ 회신 → PLN 확정(P-1~P-4) → T1 착수**.
</content>
