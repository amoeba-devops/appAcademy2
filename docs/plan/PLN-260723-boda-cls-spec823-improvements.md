---
document_id: PLN-260723-boda-cls-spec823-improvements
version: 1.0.0
status: draft
created: 2026-07-23
authors:
  - Claude (Opus 4.8)
audience: TAC 개발/운영 (BODA 연동)
basis: docs/analysis/REQ-260722-boda-cls-spec823-improvements.md (FR-1~6 / NFR-1~6)
related:
  - docs/reference/BODA-spec823-conformance-and-improvements-260721.md (F1–F7)
  - docs/design/DSN-260721-boda-fixed-classroom-code.md (FR-5 roomPwd 연계)
  - docs/reference/BODA-vendor-questions-master-260624.md (B3·A4 미결)
  - docs/report/체크리스트-보다스쿨-설정.md (webhook blocker)
change_log:
  - 2026-07-23: v1.0.0 draft — REQ-260722 구현계획 (6 트랙, P0 spike 선행)
---

# 작업계획서 — BODA 수업 개설·관리 개선 (PLN)

> [REQ-260722](../analysis/REQ-260722-boda-cls-spec823-improvements.md) 을 구현으로 옮기는 6 트랙 계획.
> **T0(FR-1) 은 코드 변경 전 staging 실측(spike)** 이며 그 결과가 이후 트랙의 학생 입장 처리 방향을 가른다.
> 인가·시간창·룸 상태머신·webhook·reconcile 는 **무변경 재사용**한다.

---

## 0. 선행 게이트 & 원칙

| 게이트 | 내용 | 영향 |
|---|---|---|
| **G-0 (P0 선행)** | T0(FR-1) staging 실측 — 데스크톱 `bodaJoin` meetKey 단독 입장 성립? | T1~T4 의 학생 입장 문구/게이트 결정 |
| G-1 (병행) | 신규 코드는 **기능 플래그 뒤** 개발(NFR-6). quick win(T1·T2)은 저위험이라 플래그 없이 가능 | 회귀 안전 |

- 스펙 정합(NFR-5): meetKey String·"+"금지, UId≤32, roomTitle≤100, roomPwd≤8 준수.
- i18n(NFR-1): 신규 문자열은 ko/en/vi/zh-CN 4 locale 동시.

---

## 1. 트랙 개요 (6 tracks)

| 트랙 | FR | 범위 | 우선 | 의존 |
|:--:|:--:|------|:--:|:--:|
| **T0** | FR-1 | (spike) 데스크톱 meetKey 단독 입장 staging 실측 + 문서 갱신 | **P0** | — |
| **T1** | FR-2 | `roomTitle = evtTitle` 전달 | **P1** | — |
| **T2** | FR-3 | 에러코드 카드 확대 + `reason`·`WB-*` 로깅 + i18n×4 | **P1** | — |
| **T3** | FR-4 | Mac/Mobile 설치 감지 불가 대응 입장 UX | P2 | T2 |
| **T4** | FR-5 | 룸 비밀번호(roomPwd) 옵션 (고정강의실 연계) | P3 | DSN-260721 |
| **T5** | FR-6 | `appOpt` 파라미터 개방(리팩터) + 로드맵 문서화 | P3 | — |

---

## 2. 트랙 상세

### T0 — FR-1 데스크톱 meetKey 단독 입장 실측 (P0, spike)
**목적**: 코드 변경 전, 스펙(“meetKey 우선”)이 실제 동작하는지 확정.
- **작업**
  1. staging `BODA_MODE=http` 최소 조건 확보(config: companyCode/URL/authKey/roomCode=699). *webhook 미등록 상태 그대로* — meetIdx 없는 상황 재현.
  2. 강사 개설 **전/후** 각각 학생 데스크톱 `bodaJoin`(meetKey 단독, meetIdx 부재) 시도.
  3. 결과·관측 오류코드(`WB-400-221`/`184`/`WB-403-101`/성공) 기록.
- **분기 반영**
  - **성립** → T1~T3 에서 학생 입장 카드는 PENDING(meetIdx 미수신)에서도 데스크톱 입장 시도 활성(현행 soft-gate 유지, 하드게이트 금지). 체크리스트 §1 blocker 범위를 "브라우저·SERVER API 한정"으로 축소 기재.
  - **불성립** → 기존 meetIdx(webhook) 의존 유지. blocker 원문 유지.
- **산출물**: conformance 문서 F1 + 체크리스트 §1 갱신(코드 변경 없음).
- ✅ AC-1.1/1.2.

> T0 는 **차단이 아니라 정보 게이트**다. T1·T2(quick win)는 T0 결과와 무관하게 병행 착수 가능.

### T1 — FR-2 룸 제목 전달 (P1)
- `frontend-acm/src/lib/boda-launch-api.ts` `enterBodaRoom`: `roomOpt.roomTitle = ctx.evtTitle` (값 있을 때만; ≤100 초과는 벤더 절삭 허용).
- `BodaLaunchContext.evtTitle` 는 이미 존재 → BE 변경 불필요.
- ✅ AC-2.1(룸 제목 표시) / AC-2.2(100자 초과 무오류).
- 규모 **XS**.

### T2 — FR-3 에러코드 커버리지 + 진단 로깅 (P1)
- **콜백 `reason` 수집**: `desktop-app-card.tsx:44` `setErrorCallback((code, reason) => …)` 로 확장, `code`+`reason` 상태 저장·로깅(NFR-2, PII 미포함).
- **신규 i18n 카드 3종**(ko/en/vi/zh-CN): `BODA-ALREADY_EXECUTE_PROGRAM` · `BODA-UPDATE_PROGRAM` · `BODA-NOT_SUPPORTED_DEVICE` (REQ §3 문구).
- **공통 fallback 카드**: 미정의 `BODA-*` → 일반 안내 + `code` 노출(앱 무중단).
- **`WB-*` 구조화 로깅**: `WB-400-184/221`, `WB-403-101`, `WB-500-122/123` 등 코드+맥락 로깅(사용자엔 일반 안내).
- ✅ AC-3.1/3.2/3.3.
- 규모 **S**.

### T3 — FR-4 Mac/Mobile 입장 UX (P2)
- 플랫폼 감지(userAgent) → **Mac/Mobile** 이면 `desktop-app-card` 에 **[브라우저로 입장]** 버튼을 앱 버튼과 **동등 1차 동선**으로 노출(Windows 는 현행 앱 우선 유지).
- 앱 호출 후 감지 불가 플랫폼에서 진입 실패 시 "설치/브라우저 입장" 강조 안내.
- 브라우저 입장은 기존 `webBrowserUrl`(있을 때) 재사용.
- ✅ AC-4.1(Mac/Mobile 브라우저 버튼 1차 노출) / AC-4.2(Windows 무회귀).
- 규모 **S**.

### T4 — FR-5 룸 비밀번호 (P3, 고정강의실 연계)
- `enterBodaRoom` (강사 `bodaOpen`)에 `roomPwd`(≤8) 옵션 전달 배선.
- 적용 대상·발급·전달은 [DSN-260721 R-4](../design/DSN-260721-boda-fixed-classroom-code.md) 고정강의실과 **함께 설계**(본 PLN은 전달 배선까지). 학생 조인 pwd 필요 여부는 **Q-4 벤더 확인** 후.
- ✅ AC-5.1(on/off 개설).
- 규모 **M** (설계 의존).

### T5 — FR-6 appOpt 파라미터 개방 (P3)
- `enterBodaRoom` 시그니처의 `appOpt` 를 **하드코딩 `{}` → 호출측 조립 파라미터**로 개방(빈 값이면 현행과 동일 = 무회귀).
- 로드맵 (a)출결(AO_ScCap/AO_AuthQrInfo) (b)자료(agendaAdd) (c)입장안내(AO_JOpenUl) (d)얼굴대조(AO_JC)는 **각각 후속 REQ 후보로 문서화**(본 트랙은 진입점 리팩터까지).
- ✅ AC-6.1(파라미터 전달) / AC-6.2(로드맵 문서화).
- 규모 **S**(리팩터) + 후속 REQ.

---

## 3. 화면 목업 (UI mockups — §9.2)

### 3.1 입장 실패 카드 (T2)
```
┌──────────────────────────────────────────────┐
│ ⚠️ 보다스쿨 앱이 이미 실행 중입니다              │
│ 기존 강의실 창을 확인하거나, 앱 종료 후 다시 입장 │
│                         [다시 시도] [설치 안내] │
│ (오류코드: BODA-ALREADY_EXECUTE_PROGRAM)        │
└──────────────────────────────────────────────┘
```

### 3.2 Mac/Mobile 입장 화면 (T3)
```
┌──────────────────────────────────────────────┐
│ 🏫 {수업 제목}                                  │
│ ────────────────────────────────────────────  │
│   [ 📥 보다스쿨 앱으로 입장 ]                    │
│   [ 🌐 브라우저로 입장 ]  ← Mac/Mobile 동등 노출 │
│ 앱이 열리지 않으면 설치가 필요합니다. [설치 안내]│
└──────────────────────────────────────────────┘
```

---

## 4. 테스트 계획 (NFR-6 회귀 안전)

| 레벨 | 대상 | 예상 |
|---|---|---|
| 실측 | T0 staging 데스크톱 입장(강사 개설 전/후) | 로그 2+건 |
| unit | `enterBodaRoom` roomTitle/roomPwd/appOpt 전달 매핑 | +4 |
| unit | 에러 매핑(신규 3종 + fallback) | +5 |
| unit | 플랫폼 감지 분기(Mac/Mobile/Windows) | +3 |
| i18n | 신규 키 4 locale 누락 검사 | 스냅샷 |
| 회귀 | 강사 개설·즉시강의·기존 학생 입장 무회귀 | 기존 spec 통과 |

---

## 5. 롤아웃 순서

```
T0 실측(P0) ──(정보 게이트)──┐
T1 roomTitle ─ T2 에러/로깅 ─┴─ T3 Mac/Mobile ─ T4 roomPwd(DSN-260721) ─ T5 appOpt 리팩터
   └ T1·T2 저위험 즉시 / T3~T5 기능 플래그 뒤 점진
staging 검증 → production
```
- 배포: main push → cd-staging → `gh workflow run cd-production.yml -f sha=<short-sha>` ([[reference_deploy_workflow]]).
- DB 마이그레이션 없음(FE 중심). roomPwd/appOpt 후속은 별도.

---

## 6. 미결 (PLN 단계 결정)

| ID | 질문 | 기한/의존 |
|---|---|---|
| P-1 | T0 실측 성립/불성립 → 학생 입장 문구 확정 | staging (P0) |
| P-2 | Q-4 학생 조인 roomPwd 필요 여부 | 벤더 확인 |
| P-3 | FR-6 로드맵 (a)~(d) 중 우선 착수 대상 | 운영자·PO |
| P-4 | 브라우저 WebRTC 계약(B3)·SERVER API 키(A4) | 벤더 회신(본 PLN 비목표) |

---

## 7. Sign-off (승인 대기)

- 본 PLN 은 **draft**. CLAUDE.md §9.2 에 따라 **사용자 확인 후 T0 착수**.
- 권장: **T0(실측) 즉시 → T1·T2(quick win) → T3 → T4·T5**.
</content>
