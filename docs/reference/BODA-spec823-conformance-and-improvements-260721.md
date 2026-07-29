---
document_id: BODA-SPEC823-CONFORMANCE-260721
version: 1.0.0
status: active
created: 2026-07-21
authors:
  - Claude (Opus 4.8)
audience: TAC 개발/운영 (BODA 연동 담당)
basis: BODA APP API 가이드 [SPEC_823] v823.002 (㈜새하컴즈, 2025-12-08) — 원문 PDF 대조
source_of_truth:
  - frontend-acm/src/lib/boda-launch-api.ts (enterBodaRoom / bodaOpen·bodaJoin 매핑)
  - frontend-acm/src/modules/web/components/desktop-app-card.tsx (setErrorCallback 배선)
  - backend/src/modules/acm-cal/application/boda-launch-context.service.ts (buildVendorWebUrl / 인가·시간창)
  - frontend-acm/src/i18n/locales/*/classroom.json (에러 카드)
related:
  - docs/reference/BODA-vendor-questions-master-260624.md (B1·B3·A4)
  - docs/design/DSN-260721-boda-fixed-classroom-code.md (R-2 학생입장 / R-4 roomPwd)
  - docs/report/체크리스트-보다스쿨-설정.md (webhook 미연동 blocker)
---

# BODA SPEC_823 v823.002 적합성 점검 · 개선 제안 (Conformance & Gap Analysis)

> 벤더 원문 **BODA APP API 가이드 v823.002** 를 현재 구현과 1:1 대조하여, **적합성(준수 여부)** 과
> **미활용 기능 · 개선 포인트**를 정리한다. 결론적으로 핵심 호출부(`bodaOpen`/`bodaJoin`/`setErrorCallback`)는
> 스펙을 준수하나, **① 학생 입장 키(meetKey 우선) 재해석, ② appOpt(출결·증빙·자료) 전면 미사용,
> ③ 에러코드 커버리지 부족, ④ roomTitle/roomPwd 미설정** 이 개선 여지다.

---

## 1. 적합성 요약표 (Conformance matrix)

| SPEC 항목 (v823.002) | 스펙 규정 | 현재 구현 | 판정 |
|---|---|---|---|
| `bodaOpen` 5-인자 시그니처 | `(bodaWeb, joinUser, roomOpt, appOpt, joinOpt)` | 동일하게 호출 (`enterBodaRoom`) | ✅ 준수 |
| `bodaJoin` 시그니처 | `(bodaWeb, joinUser, {meetIdx?, meetKey?, inviteCode?})` | 동일 (student) | ✅ 준수 |
| `meetKey` 타입 = **String** (v823.002 변경점) | String, ≤255, "+" 금지 | `tac-{32hex}` (36자, "-"만 사용) | ✅ 준수 |
| joinUser.`UTy` 코드 | 10 참석자·11 강사·12 학생·13 운영자 | 11/12/13 사용 | ✅ 준수 |
| joinUser.`AuCd` | **Opt(선택)** — 인증키 | 미전달(TCPS 위임 가정) | ✅ 준수 (B1 스펙으로 해소) |
| joinUser.`UId` | ≤32, 초과 시 **오류**, 공란=임시사용자 | UUID 32hex(정확히 32) | ✅ 준수 (경계값) |
| joinUser.`UNm` | ≤32, 초과 시 **절삭** | 사용자명 그대로 | ⚠️ 32자 초과 시 벤더가 절삭 |
| `dup` | bodaOpen 전용, 0 불가/1 허용 | 강사 개설에 `dup:1` | ✅ 준수 |
| `bodaJoin.meetKey` **우선순위** | "meetIdx **값보다 우선**해서 사용" | student에 meetKey 전달 + meetIdx는 있을 때만 | ✅ 전달하나 **해석 미반영** (§F1) |
| `roomOpt.roomTitle` | ≤100, 초과 시 절삭 | **미설정** | 🟡 미사용 (§F3) |
| `roomOpt.roomPwd` | ≤8, 영문·숫자·특수 | **미설정** | 🟡 미사용 (§F3) |
| `roomOpt.inviteCode` (bodaJoin) | Opt 초대코드 | **미사용** | 🟡 미사용 |
| `appOpt` (openOption/AO_ScCap/AO_AuthQrInfo/AO_JC/agendaAdd/AO_JOpenUl) | 다수 부가기능 | **`{}` 빈 객체** | 🔴 전면 미사용 (§F2) |
| `joinOpt.lang` / `hide` | 'ko'·'en' / true=윈도우 자동실행 | lang + hide(autoStart) 사용 | ✅ 준수 |
| `setErrorCallback` | `(errorCode, reason)` 콜백 | 배선됨(desktop-app-card) | ✅ 배선, 🟡 매핑 부족 (§F4) |
| 에러코드(BODA-* 14종 + WB-* 9종) | 전체 taxonomy | 4종만 i18n 카드 | 🔴 커버리지 부족 (§F4) |
| Mac/Mobile 설치 감지 | **불가 → 고객사 별도 처리 필요** | 9-state 카드 + 설치링크 | 🟡 사전 감지 불가 대응 (§F5) |

---

## 2. 핵심 발견 & 개선 제안 (Findings)

### F1 (HIGH) — `bodaJoin`의 meetKey 우선 규정 → 학생 데스크톱 입장은 meetIdx(=webhook) 없이도 가능성

**스펙 근거** (p.7, bodaJoin roomOpt):
> `meetKey` — "bodaOpen 에서 지정한 회의키, **meetIdx 값 보다 우선해서 사용되어 짐**"

**현황**: 우리는 학생 데스크톱 `bodaJoin` 에 이미 `meetKey` 를 전달하고, `meetIdx` 는 **있을 때만** 추가한다 ([boda-launch-api.ts:203-209](../../frontend-acm/src/lib/boda-launch-api.ts#L203-L209)). 즉 방이 아직 안 열려 meetIdx 가 없으면 **meetKey 단독**으로 호출된다.

**시사점**: 그동안 "학생 입장 = meetIdx 필요 = webhook 선결" 로 blocker 를 잡았으나([체크리스트 §1](../report/체크리스트-보다스쿨-설정.md)), 스펙상 **데스크톱 앱 조인은 meetKey 우선**이다. 체크리스트가 겪은 `WB-400-221 InvalidMeetIdx` 는 **WebRTC 브라우저 조인 URL** 경로에서 발생한 것으로, 이는 이 PDF가 다루는 `bodaJoin`(데스크톱)과 **다른 계약**이다(여전히 미확인 = 벤더 B3/Q5).

> 📌 **제안**: staging 에서 **데스크톱 `bodaJoin` meetKey 단독 입장**을 1회 실측. 성공하면 **데스크톱 경로 학생 입장은 webhook 없이도 동작**하며, webhook(meetIdx)은 (a) 브라우저 WebRTC 조인, (b) SERVER API 출결/reconcile 에만 필요한 것으로 blocker 범위가 축소된다. 이는 [DSN-260721 R-2](../design/DSN-260721-boda-fixed-classroom-code.md) (고정강의실 학생입장)도 완화한다.
> ⚠️ 브라우저 경로(`buildVendorWebUrl`)는 `meetIdx` 를 있을 때만 붙이지만 계약 자체가 미확인이므로, F1 성공 여부와 무관하게 **B3(브라우저 조인 파라미터)** 벤더 확인은 유지.

### F2 (HIGH) — `appOpt` 전면 미사용: 출결·증빙·자료 벤더 기능 미활용

현재 `appOpt` 를 항상 `{}` 로 넘긴다 ([boda-launch-api.ts:214](../../frontend-acm/src/lib/boda-launch-api.ts#L214)). 스펙 §3.2 는 학원 운영에 직접 쓸모 있는 부가기능을 정의한다:

| appOpt 키 | 기능 | 학원 활용 아이디어 |
|---|---|---|
| **`AO_ScCap`** | 주기적 스크린샷 업로드 (`CapSec` 주기, `CapArea` 1=본인비디오/2=앱화면, `UpUrl`) | **수업 증빙·원격 감독** — 출결 근거 이미지를 우리 스토리지(S3/MinIO)로 수집 |
| **`AO_AuthQrInfo`** | 수업 증빙 화면 캡처, `notifyAtList`(시작 후 n분 노출) | **출석 인증(QR)** — CLS 출결과 연계 |
| **`AO_JC`** | 대면 승인 입장(얼굴 대조: `UPtDnUrl`/`FaceApiUrl`/`RetApiUrl`) | **본인확인 입장** — 시험/레벨테스트 부정 방지 |
| **`agendaAdd`** | 공유 자료 등록(`JDocUl` 다운로드 URL, `recvType/recvId` 대상 지정) | **자료실(materials) 연계** — 수업 자료를 룸에 자동 푸시 |
| **`AO_JOpenUl`** | 입장 안내문 팝업(`Url`, `BrwTy`) | **수업 공지/규칙** 입장 시 노출 |
| **`openOption`** | 공유모드/레이아웃/화질 기본값 | 강사 UX 기본 프리셋 |

> 📌 **제안**: 즉시 전부 도입할 필요는 없으나, **출결·증빙 로드맵**에 `AO_ScCap`/`AO_AuthQrInfo`(출결 근거)와 `agendaAdd`(자료실 연계)를 후속 REQ 후보로 등록. `enterBodaRoom` 에 `appOpt` 조립 파라미터를 여는 것이 선행 작업(현재 시그니처가 빈 객체 하드코딩). RPT-260610 §7.4 의 "녹화/노트" nice-to-have 와 합집합.

### F3 (MEDIUM) — `roomTitle` / `roomPwd` 미설정

- **`roomTitle`**: 미설정 → BODA 클라이언트에 기본 제목 노출. `enterBodaRoom` 에서 **`evtTitle`(≤100, 초과 절삭)** 을 넘기면 강사·학생이 룸 안에서 수업명을 바로 인지. 저비용 UX 개선.
- **`roomPwd`**: 미설정. [DSN-260721 R-4](../design/DSN-260721-boda-fixed-classroom-code.md)(상시 고정강의실 코드 유출 대비)에서 **≤8자 룸 비밀번호**를 옵션으로 적용하면 무단 입장 방어. `bodaOpen` 강사 개설 시 발급 → 학생 `bodaJoin` 은 `meetKey`/`meetIdx` 로 이미 지목하므로 pwd 전달 불필요 여부는 벤더 확인.

> 📌 **제안**: `BodaRoomOpt` 타입엔 이미 두 필드가 있으나 `enterBodaRoom` 이 채우지 않는다([boda-launch-api.ts:205-208](../../frontend-acm/src/lib/boda-launch-api.ts#L205-L208)). `roomTitle=evtTitle` 는 즉시 반영 권장, `roomPwd` 는 고정강의실 설계와 함께.

### F4 (MEDIUM) — 에러코드 커버리지 부족

`setErrorCallback` 은 배선되어 있으나([desktop-app-card.tsx:44](../../frontend-acm/src/modules/web/components/desktop-app-card.tsx#L44)) i18n 카드는 **`BODA-NOT_INSTALLED` · `BODA-NOT_CONNECTED_AGENT` · `BODA-SCRIPT_LOAD_FAILED` · `BODA-SCRIPT_TIMEOUT` 4종만** 존재. 스펙의 나머지는 원시 코드/일반 오류로만 표시된다.

**미매핑 BODA-* (스펙 §4)**: `BODA-NONE_REQUIRED_VALUE`, `BODA-INVALID_VALUE`, `BODA-NONE_TCPS_INFO`, `BODA-NONE_WEB`, `BODA-NONE_COMPANY_INFO`, `BODA-NOT_SUPPORTED_DEVICE`, `BODA-WIN_CALL_ERROR`, `BODA-APP_CALL_ERROR`, **`BODA-ALREADY_EXECUTE_PROGRAM`**(이미 실행 중 — 흔함), **`BODA-UPDATE_PROGRAM`**(업데이트 중 — 흔함), `BODA-MSG_MAX_LENGTH_EXCEED`, `BODA-SCHEME_MSG_LENGTH_EXCEED`, `BODA-UNDEFINED_ERROR`.

**미매핑 WB-* (WAS)**: `WB-400-184`(meetKey 오류), `WB-400-221`(meetIdx 오류), `WB-400-205`(companyId), `WB-400-220`(inviteCode), `WB-403-101`(입장 금지된 회의실), `WB-500-108`(회사 없음), `WB-500-122`/`123`(개설된/개설할 룸 정보 없음), `WB-500-999`.

> 📌 **제안**:
> 1. **운영에 흔한** `BODA-ALREADY_EXECUTE_PROGRAM`(→"이미 실행 중, 기존 창 확인"), `BODA-UPDATE_PROGRAM`(→"업데이트 중, 잠시 후"), `BODA-NOT_SUPPORTED_DEVICE`(→"미지원 단말, 브라우저 입장 안내") 부터 i18n 카드 추가(4 locale).
> 2. **WB-* 는 진단용 로깅** 우선(사용자에겐 일반 안내 + code). 특히 `WB-400-221`/`184`/`WB-500-122`는 우리 meetKey/meetIdx/방상태 계약 검증에 핵심 신호 — 콘솔/서버 로그로 남겨 컷오버 리허설에 활용.
> 3. `setErrorCallback` 콜백이 현재 `code` 만 저장한다 — 스펙의 2번째 인자 `reason` 도 로깅 권장([desktop-app-card.tsx:44](../../frontend-acm/src/modules/web/components/desktop-app-card.tsx#L44)).

### F5 (MEDIUM) — Mac/Mobile 설치 감지 불가에 대한 사전 UX

스펙 §1.3: **Windows 는 설치 확인 가능, Mac/Mobile 은 불가 → 고객사 별도 처리 필요**. 현재 9-state 카드 + 설치링크는 있으나, Mac/Mobile 에선 "앱 미설치"를 사전 감지할 수 없어 사용자가 빈 화면을 겪을 수 있다.

> 📌 **제안**: 플랫폼 감지(userAgent)로 **Mac/Mobile 사용자에겐 처음부터** "앱이 안 열리면 설치하세요" 안내 + **브라우저 입장 버튼을 동등 비중**으로 노출. 벤더 B5(권장 fallback UX) 회신을 기다리지 말고 설계(스펙이 "고객사 처리"로 명시).

### F6 (LOW) — 스펙으로 해소되는 벤더 미결

- **B1 (AuCd 클라이언트 전달 필요 여부)**: 스펙 joinUser.`AuCd` 는 **Opt** → 미전달은 스펙 합치. [질문서](BODA-vendor-questions-master-260624.md) B1 을 "스펙상 선택 → 미전달 유지"로 **해소 처리** 가능(단, 실연동 1회 확인 권장).
- **meetKey Integer→String (v823.002)**: 우리는 이미 String — 버전 정합 확인.

### F7 (LOW) — 준수 확인만 (조치 불요)
- meetKey "+" 금지 → `tac-` 사용, 준수. UId ≤32 → 32hex 정확, 준수. dup=1 bodaOpen 전용, 준수.

---

## 3. 우선순위 로드맵 (Action plan)

| 순위 | 항목 | 작업 | 규모 |
|:---:|---|---|:---:|
| P0 | **F1 meetKey 단독 입장 실측** | staging 데스크톱 `bodaJoin` meetKey-only 검증 → blocker 범위 재정의 | 검증(코드 0) |
| P1 | **F3 roomTitle** | `enterBodaRoom` 에 `roomTitle=evtTitle` 추가 | XS |
| P1 | **F4 흔한 에러 3종 + reason 로깅** | i18n 카드(ALREADY_EXECUTE/UPDATE/NOT_SUPPORTED) ×4 locale + reason 로깅 | S |
| P2 | **F5 Mac/Mobile UX** | 플랫폼 감지 → 설치안내+브라우저 동등 노출 | S |
| P2 | **F4 WB-* 진단 로깅** | 콜백/서버에 WB 코드 구조화 로깅 | S |
| P3 | **F3 roomPwd** | 고정강의실(DSN-260721 R-4)과 함께 도입 | M |
| P3 | **F2 appOpt 로드맵** | `enterBodaRoom` appOpt 파라미터화 → AO_ScCap/AO_AuthQrInfo(출결) · agendaAdd(자료실) 후속 REQ | L |

---

## 4. 연계 & 벤더 확인 (Cross-refs)

- **[DSN-260721 고정강의실](../design/DSN-260721-boda-fixed-classroom-code.md)**: F1(meetKey 우선)은 R-2(학생입장) 완화, F3(roomPwd)은 R-4(유출 방어) 근거.
- **[벤더 질문 마스터](BODA-vendor-questions-master-260624.md)**: B1 → 스펙으로 해소(F6). **B3(브라우저 WebRTC 조인 계약)은 이 PDF 미포함 → 여전히 open** (F1 주의). A4(SERVER API 조회키 meetKey vs meetIdx)도 미포함 → 유지.
- **[roomCode 추가발급 요청](BODA-vendor-roomcode-request-260721.md)** ⑤(고정 meetKey 재사용)·③(동시성)은 이 PDF 범위 밖 — 별도 회신 필요.

---

## 5. Sign-off
- 근거: BODA APP API 가이드 v823.002 원문 PDF (㈜새하컴즈, 2025-12-08).
- 결론: 호출부는 스펙 준수. 개선 우선순위는 **F1 실측 → roomTitle/에러카드(quick win) → appOpt 출결·자료(로드맵)**.
- 다음: P0(F1) staging 실측 결과에 따라 [체크리스트 §1 blocker](../report/체크리스트-보다스쿨-설정.md) 범위 갱신.
</content>
