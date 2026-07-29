---
document_id: REQ-260722-boda-cls-spec823-improvements
version: 1.0.0
status: draft
created: 2026-07-22
authors:
  - Claude (Opus 4.8)
audience: TAC 개발/운영 (BODA 연동) + 검토자(운영자)
basis: docs/reference/BODA-spec823-conformance-and-improvements-260721.md (F1–F7)
vendor_spec: BODA APP API 가이드 [SPEC_823] v823.002 (㈜새하컴즈, 2025-12-08)
related:
  - docs/reference/BODA-spec823-conformance-and-improvements-260721.md (적합성 점검)
  - docs/design/DSN-260721-boda-fixed-classroom-code.md (고정강의실 — R-2/R-4 연계)
  - docs/reference/BODA-vendor-questions-master-260624.md (B1·B3·A4 미결)
  - docs/report/체크리스트-보다스쿨-설정.md (webhook 미연동 blocker)
change_log:
  - 2026-07-22: v1.0.0 draft — SPEC_823 적합성 점검 기반 개선 요구사항 정의
---

# 요구사항정의서 — BODA 수업 개설·관리 개선 (SPEC_823 conformance)

> **One-liner**: 벤더 원문 SPEC_823 v823.002 대조 결과([conformance 문서](../reference/BODA-spec823-conformance-and-improvements-260721.md))에서 도출된
> 개선 항목을 정식 요구사항으로 정의한다. 스펙을 활용해 **① 학생 입장 blocker 재확정, ② 입장 UX·에러 처리 강화,
> ③ 룸 메타(제목/비밀번호) 적용, ④ 출결·자료 부가기능 로드맵**을 확정하고 우선순위를 부여한다.

---

## 1. Overview (개요)

### 1.1 배경
- BODA(보다스쿨) 화상 강의 개설·입장·출결은 REQ-260526(T1–T7)로 구현되어 staging/prod 배포됨(현재 `BODA_MODE=mock`, webhook 미연동).
- 벤더 원문 SPEC_823 v823.002 PDF 입수 후 현재 구현과 1:1 대조하여 **적합성 점검 문서(F1–F7)** 를 작성함.
- 호출부는 스펙 준수이나, 일부 규정을 활용하지 못하고 있어 **입장 안정성·운영 UX·출결 근거**에 개선 여지가 확인됨.

### 1.2 목표
1. 스펙 규정(`bodaJoin` meetKey 우선)을 검증하여 **학생 입장 의존성(webhook/meetIdx) 범위를 재확정**한다.
2. 입장 실패 시 사용자 안내·진단 로깅을 스펙 에러 taxonomy 기준으로 강화한다.
3. 룸 제목·비밀번호 등 저비용 개선을 반영한다.
4. 출결·자료 부가기능(`appOpt`)을 단계적 로드맵으로 확정한다.

### 1.3 비목표 (Out of scope)
- **브라우저 WebRTC 조인 계약**(B3) 확정 — 본 PDF 미포함, 벤더 회신 의존. 본 REQ는 데스크톱 `bodaJoin` 경로에 한정.
- **SERVER API 조회키(meetKey vs meetIdx, A4)** 전환 — 벤더 회신 의존, 별도.
- **고정강의실(이벤트 비종속)** 기능 — [DSN-260721](../design/DSN-260721-boda-fixed-classroom-code.md)/PLN-260721에서 별도. 본 REQ의 roomPwd(FR-5)만 연계.
- **얼굴대조 입장(AO_JC)·QR 증빙(AO_AuthQrInfo) 전면 구현** — FR-6 로드맵의 후속 단계로만 명시(본 REQ는 진입점 확보까지).

### 1.4 관련 코드 기준선 (As-is)
- 입장 매핑: `frontend-acm/src/lib/boda-launch-api.ts` `enterBodaRoom` — `appOpt={}`, `roomTitle/roomPwd` 미설정.
- 에러 콜백: `frontend-acm/src/modules/web/components/desktop-app-card.tsx:44` — `code`만 저장, i18n 카드 4종.
- 입장 컨텍스트/인가·시간창: `backend/.../boda-launch-context.service.ts`.

---

## 2. Requirements summary (요구사항 요약)

| ID | 제목 | 근거 | 우선순위 |
|---|---|---|:---:|
| FR-1 | 학생 데스크톱 입장 meetKey 단독 성립 검증·확정 | F1 | **P0** |
| FR-2 | 룸 제목(roomTitle) = 수업 제목 전달 | F3 | **P1** |
| FR-3 | 입장 에러코드 커버리지 확대 + reason·WB 로깅 | F4 | **P1** |
| FR-4 | Mac/Mobile 설치 감지 불가 대응 입장 UX | F5 | **P2** |
| FR-5 | 룸 비밀번호(roomPwd) 옵션 (고정강의실 연계) | F3/R-4 | **P3** |
| FR-6 | appOpt 파라미터화 + 출결·자료 기능 로드맵 | F2 | **P3** |
| NFR-1~6 | i18n·로깅·성능·보안·스펙정합·회귀 | 공통 | — |

---

## 3. Functional Requirements (기능 요구사항)

### FR-1. 학생 데스크톱 입장 meetKey 단독 성립 검증·확정 (P0)
**근거**: SPEC p.7 — `bodaJoin.meetKey` 는 "meetIdx 값보다 우선 사용". 현재 학생 조인은 이미 meetKey 를 전달하고 meetIdx 는 있을 때만 추가한다.

- **FR-1.1** staging 에서 **데스크톱 `bodaJoin` meetKey 단독(meetIdx 부재)** 입장을 실측하여 성립 여부를 확정한다.
- **FR-1.2** meetKey 단독 입장이 **성립하면**: 학생 입장 카드/버튼은 룸 상태가 `PENDING` 이어도(강사 개설 전이 아닌, meetIdx 미수신 상태) **데스크톱 앱 입장을 시도 가능**해야 한다. (현행 soft-gate 유지, 하드 게이트 신설 금지)
- **FR-1.3** meetKey 단독 입장이 **불성립하면**: 기존 대로 meetIdx(webhook) 의존을 유지하고, [체크리스트 §1](../report/체크리스트-보다스쿨-설정.md) blocker 범위를 그대로 둔다.
- **FR-1.4** 실측 결과(성립/불성립 + 관측된 오류코드)를 문서화하여 blocker 범위를 갱신한다.

**수락 기준**
- AC-1.1 staging 강사 개설 전/후 각 1회 이상 학생 데스크톱 입장 시도 로그 확보(입장 성공 또는 오류코드 기록).
- AC-1.2 결과에 따라 conformance 문서 F1 + 체크리스트 §1 이 갱신된다.

> ⚠️ 본 항목은 **코드 변경 이전의 검증(spike)** 이 핵심이다. 결과가 FR-1.2/1.3의 분기를 결정한다.

### FR-2. 룸 제목 전달 (P1)
- **FR-2.1** `enterBodaRoom` 이 `roomOpt.roomTitle` 에 **수업 제목(`evtTitle`)** 을 전달한다. (스펙 ≤100자, 초과 시 벤더 절삭)
- **FR-2.2** 제목이 없으면(빈 값) 필드를 생략한다(기본 제목 유지).

**수락 기준**
- AC-2.1 강사 개설 시 BODA 클라이언트 룸 제목에 수업 제목이 표시된다.
- AC-2.2 제목 100자 초과 입력에도 오류 없이 개설된다(절삭 허용).

### FR-3. 입장 에러코드 커버리지 확대 + 진단 로깅 (P1)
- **FR-3.1** `setErrorCallback` 콜백이 스펙 2번째 인자 **`reason`** 까지 수집·로깅한다.
- **FR-3.2** 운영 빈발 코드에 **사용자 안내 카드(4 locale)** 를 추가한다:
  - `BODA-ALREADY_EXECUTE_PROGRAM` → "이미 실행 중입니다. 기존 창을 확인하세요."
  - `BODA-UPDATE_PROGRAM` → "앱 업데이트 중입니다. 잠시 후 다시 시도하세요."
  - `BODA-NOT_SUPPORTED_DEVICE` → "지원하지 않는 단말입니다. 브라우저 입장을 이용하세요."
- **FR-3.3** 나머지 `BODA-*`(INVALID_VALUE, NONE_TCPS_INFO, NONE_WEB, NONE_COMPANY_INFO, WIN/APP_CALL_ERROR, MSG/SCHEME_LENGTH, UNDEFINED 등)는 **공통 안내 카드 + 코드 표기 + 로깅**으로 처리한다.
- **FR-3.4** WAS 오류 **`WB-*`** (`WB-400-184` meetKey / `WB-400-221` meetIdx / `WB-403-101` 입장금지 / `WB-500-122·123` 룸정보없음 등)는 **구조화 로깅**(코드+맥락)으로 남긴다. 사용자에겐 일반 안내.

**수락 기준**
- AC-3.1 FR-3.2 3종이 4 locale 카드로 표시된다.
- AC-3.2 미정의 코드는 앱이 깨지지 않고 공통 카드 + code 를 노출한다.
- AC-3.3 콜백 `reason` 및 WB 코드가 로그에서 확인된다.

### FR-4. Mac/Mobile 설치 감지 불가 대응 UX (P2)
**근거**: SPEC §1.3 — Windows 만 설치 확인 가능, Mac/Mobile 은 불가(고객사 별도 처리 필요).
- **FR-4.1** userAgent 로 **Mac/Mobile** 판별 시, 입장 화면에 **설치 안내 + 브라우저 입장 버튼을 동등 비중**으로 노출한다.
- **FR-4.2** Windows 는 현행(앱 우선) 유지.
- **FR-4.3** 앱 호출 후 일정 시간 내 진입 실패(감지 불가 플랫폼)면 "앱이 안 열리면 설치/브라우저 입장" 안내를 강조한다.

**수락 기준**
- AC-4.1 Mac/Mobile UA 에서 브라우저 입장 버튼이 1차 동선에 노출된다.
- AC-4.2 Windows 동선은 회귀 없이 유지된다.

### FR-5. 룸 비밀번호 옵션 (P3, 고정강의실 연계)
- **FR-5.1** `bodaOpen` 개설 시 **룸 비밀번호(`roomPwd`, ≤8자)** 를 옵션으로 전달할 수 있다.
- **FR-5.2** 적용 대상·발급/전달 방식은 [DSN-260721](../design/DSN-260721-boda-fixed-classroom-code.md) 고정강의실(R-4)과 함께 설계한다.
- **FR-5.3** 학생 `bodaJoin` 에 pwd 전달 필요 여부는 벤더 확인 후 반영(미확인 시 meetKey/meetIdx 지목만 유지).

**수락 기준**
- AC-5.1 roomPwd 설정 시 개설되며, 미설정 시 현행과 동일 동작.

### FR-6. appOpt 파라미터화 + 출결·자료 로드맵 (P3)
- **FR-6.1** `enterBodaRoom` 시그니처의 `appOpt` 를 **하드코딩 `{}` 에서 조립 가능한 파라미터로 개방**한다(선행 리팩터).
- **FR-6.2 (로드맵 단계 정의 — 후속 REQ)**:
  - (a) **출결 근거**: `AO_ScCap`(주기 스크린샷 업로드) / `AO_AuthQrInfo`(QR 증빙) → CLS 출결 연계.
  - (b) **자료 연계**: `agendaAdd`(공유 자료 URL 푸시) → 자료실(materials) 연계.
  - (c) **입장 안내문**: `AO_JOpenUl`(입장 시 공지 팝업).
  - (d) **본인확인**: `AO_JC`(얼굴대조 입장) — 시험/레벨테스트 부정 방지(최후순위, 개인정보 검토 필요).
- **FR-6.3** 본 REQ 범위는 **FR-6.1(파라미터 개방)까지**. (a)~(d)는 각각 별도 REQ로 승격한다.

**수락 기준**
- AC-6.1 `enterBodaRoom` 이 appOpt 를 인자로 받아 전달할 수 있다(빈 값이면 현행과 동일).
- AC-6.2 로드맵 (a)~(d)가 후속 REQ 후보로 문서화된다.

---

## 4. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-1 | **i18n** | FR-3 신규 카드·FR-4 안내는 ko/en/vi/zh-CN 4 locale 동시 반영(누락 0). |
| NFR-2 | **로깅/진단** | 에러코드·reason·WB 코드는 콘솔/서버 로그에서 추적 가능. PII 미포함. |
| NFR-3 | **성능** | 입장 클릭 → 앱/브라우저 호출까지 체감 지연 증가 없음(기존 대비 회귀 금지). |
| NFR-4 | **보안** | roomPwd(FR-5)는 평문 노출 금지, 전달 채널 최소화. |
| NFR-5 | **스펙 정합** | 모든 파라미터는 SPEC_823 v823.002 타입/길이 준수(meetKey String·"+"금지, UId≤32, roomTitle≤100, roomPwd≤8). |
| NFR-6 | **회귀 안전** | 강사 개설·즉시강의·기존 학생 입장 경로 무회귀. 기능 플래그로 점진 릴리스 권장. |

---

## 5. UI mockups (텍스트 목업)

### 5.1 입장 실패 카드 (FR-3 — 빈발 코드 예시)
```
┌──────────────────────────────────────────────┐
│ ⚠️ 보다스쿨 앱이 이미 실행 중입니다              │
│ 기존 강의실 창을 확인하거나, 앱을 종료 후        │
│ 다시 입장해 주세요.                             │
│                         [다시 시도] [설치 안내] │
│ (오류코드: BODA-ALREADY_EXECUTE_PROGRAM)        │
└──────────────────────────────────────────────┘
```

### 5.2 Mac/Mobile 입장 화면 (FR-4 — 브라우저 동등 노출)
```
┌──────────────────────────────────────────────┐
│ 🏫 {수업 제목}                                  │
│ ────────────────────────────────────────────  │
│ 입장 방법을 선택하세요                          │
│   [ 📥 보다스쿨 앱으로 입장 ]                    │
│   [ 🌐 브라우저로 입장 ]  ← Mac/Mobile 동등 노출 │
│ 앱이 열리지 않으면 설치가 필요합니다. [설치 안내]│
└──────────────────────────────────────────────┘
```

---

## 6. Acceptance criteria 총괄 (Traceability)

| AC | 대응 FR | 검증 방법 |
|---|---|---|
| AC-1.1/1.2 | FR-1 | staging 실측 로그 + 문서 갱신 |
| AC-2.1/2.2 | FR-2 | 개설 시 룸 제목 확인 |
| AC-3.1~3.3 | FR-3 | 카드 표시 + 로그 확인 |
| AC-4.1/4.2 | FR-4 | Mac/Mobile·Windows 동선 확인 |
| AC-5.1 | FR-5 | roomPwd on/off 개설 |
| AC-6.1/6.2 | FR-6 | appOpt 파라미터 전달 + 로드맵 문서화 |

---

## 7. Open questions (미결 사항)

| ID | 질문 | 의존 |
|---|---|---|
| Q-1 | 데스크톱 meetKey 단독 입장 성립? (FR-1) | staging 실측 (P0) |
| Q-2 | 브라우저 WebRTC 조인 파라미터 계약 (B3) | 벤더 회신 |
| Q-3 | SERVER API 조회키 meetKey vs meetIdx (A4) | 벤더 회신 |
| Q-4 | 학생 조인에 roomPwd 전달 필요 여부 (FR-5.3) | 벤더 확인 |
| Q-5 | AO_ScCap/AO_AuthQrInfo 업로드 대상 스토리지·보존정책 (FR-6a) | 후속 REQ + 운영 정책 |
| Q-6 | AO_JC 얼굴대조 도입 시 개인정보 영향평가 (FR-6d) | 보안/법무 검토 |

---

## 8. Implementation impact (영향 범위 — 분석용)

| 구분 | 항목 |
|---|---|
| **FE** | `enterBodaRoom`(roomTitle·appOpt 파라미터), `desktop-app-card`(에러 매핑·reason·플랫폼 감지), classroom.json ×4 locale |
| **BE** | 필요 시 launch-context 에 roomTitle 필드 노출, WB 로깅. (roomPwd·appOpt 는 후속) |
| **재사용** | 인가·시간창·룸 상태머신·webhook·reconcile 무변경 |
| **미변경** | BODA config(companyCode/URL/authKey), DB BODA 4테이블 |

---

## 9. Sign-off (승인 대기)

- 본 REQ 는 **draft**. CLAUDE.md §9.2 에 따라 **사용자 검토·확인 후** 작업계획서(PLN, 화면 목업 포함) 작성 → 구현 착수.
- 권장 착수 순서: **FR-1(P0 실측) → FR-2·FR-3(P1 quick win) → FR-4(P2) → FR-5·FR-6(P3)**.
- FR-1 실측 결과가 학생 입장 blocker 이해를 바꿀 수 있으므로 **최우선**.
</content>
