---
document_id: RPT-260723-boda-cls-spec823-improvements
version: 1.0.0
status: complete
created: 2026-07-23
authors:
  - Claude (Opus 4.8)
basis:
  - docs/plan/PLN-260723-boda-cls-spec823-improvements.md (T0–T5)
  - docs/analysis/REQ-260722-boda-cls-spec823-improvements.md (FR-1~6)
related:
  - docs/reference/BODA-spec823-conformance-and-improvements-260721.md
---

# 완료 보고서 — BODA 수업 개설·관리 개선 (PLN-260723)

> PLN-260723 의 코드 트랙 **T1·T2·T3·T5 구현 완료** + **T4 전달 배선**. **T0(FR-1) 은 staging 실측(운영 작업)**
> 이라 본 작업 범위 밖 — 절차만 §5 에 기재. FE 전용(백엔드·DB 무변경), tsc·vite build clean.

---

## 1. Summary (요약)

| 트랙 | FR | 상태 | 내용 |
|:--:|:--:|:--:|---|
| T0 | FR-1 | ⏳ 운영 실측 대기 | 데스크톱 `bodaJoin` meetKey 단독 입장 staging 검증(코드 변경 없음) |
| **T1** | FR-2 | ✅ | `bodaOpen` 에 `roomTitle = evtTitle`(≤100 clamp) 전달 |
| **T2** | FR-3 | ✅ | 에러 콜백 `reason` 수집·로깅 + 신규 카드 3종 ×4 locale + title/body/code 노출 |
| **T3** | FR-4 | ✅ | Mac/Mobile 감지 → 브라우저 입장 동등 노출 + 안내문 |
| T4 | FR-5 | 🔩 배선만 | `roomPwd`(≤8) 전달 경로 개방 — 적용은 DSN-260721 고정강의실 + 벤더 Q-4 의존 |
| **T5** | FR-6 | ✅ | `enterBodaRoom` `appOpt` 파라미터 개방(하드코딩 `{}` 제거) |

- 빌드: `tsc --noEmit` clean, `vite build` 성공.
- **FE 단위테스트 미추가** — frontend-acm 에 테스트 러너(vitest/jest) 부재. 로직은 순수 함수(`detectBodaPlatform`/`enterBodaRoom`)로 분리해 향후 러너 도입 시 즉시 테스트 가능하게 설계.

---

## 2. 변경 파일 (Changed files)

| 파일 | 트랙 | 변경 |
|---|---|---|
| `frontend-acm/src/lib/boda-launch-api.ts` | T1·T5·T4 | `enterBodaRoom` opts 확장(`roomPwd`/`appOpt`), `roomTitle` clamp, meetKey 우선 주석. 신규 export `detectBodaPlatform`/`bodaInstallUndetectable`/`logBodaError` |
| `frontend-acm/src/modules/web/components/desktop-app-card.tsx` | T2·T3 | 플랫폼 감지, 콜백 `reason` 로깅, 브라우저 버튼 강조/재배치, 에러 카드 title+body+code |
| `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/classroom.json` | T2·T3 | `embed.macMobileHint` + `error.BODA-ALREADY_EXECUTE_PROGRAM`/`BODA-UPDATE_PROGRAM`/`BODA-NOT_SUPPORTED_DEVICE` |

---

## 3. 구현 상세

### T1 — roomTitle (FR-2)
`enterBodaRoom` 강사 개설 분기에서 `ctx.evtTitle` 을 trim 후 100자 clamp 하여 `roomOpt.roomTitle` 로 전달. 빈 값이면 생략(기본 제목 유지). `BodaLaunchContext.evtTitle` 는 기존 필드 → BE 무변경.

### T2 — 에러 커버리지·로깅 (FR-3)
- `api.setErrorCallback?.((code, reason) => …)` 로 SPEC 2번째 인자 `reason` 수집 → `logBodaError(code, reason)` 로 `console.warn('[BODA] entry error code=… reason=…')`. catch 경로도 동일 로깅.
- 신규 i18n 카드 3종(빈발 코드): `ALREADY_EXECUTE_PROGRAM`·`UPDATE_PROGRAM`·`NOT_SUPPORTED_DEVICE`.
- 미정의 코드(`WB-*` 포함)는 `error.unknown` fallback 카드 + 원시 코드 `(CODE)` 노출 → 진단 가능·앱 무중단.

### T3 — Mac/Mobile UX (FR-4)
- `detectBodaPlatform(userAgent)` → `windows|mac|mobile|other`. `bodaInstallUndetectable` = mac||mobile.
- 해당 플랫폼: 브라우저 버튼 `variant=default`(강조) + 컨테이너 `flex-col-reverse sm:flex-row-reverse` 로 우선 배치 + `embed.macMobileHint` 노출. Windows/other 는 현행(앱 우선) 유지 → 무회귀.
- (참고) iPadOS 가 UA 상 Macintosh 로 위장해도 두 버킷 모두 `undetectable` 이라 동작 동일.

### T4 — roomPwd 배선 (FR-5)
`enterBodaRoom` 이 `opts.roomPwd`(≤8 clamp)를 강사 `bodaOpen` `roomOpt.roomPwd` 로 전달할 수 있게만 개방. **호출측에서 아직 전달하지 않음** — 적용 시점/발급/전달은 [DSN-260721](../design/DSN-260721-boda-fixed-classroom-code.md) R-4 및 벤더 Q-4(학생 조인 pwd 필요 여부) 회신 후.

### T5 — appOpt 파라미터 개방 (FR-6)
`fn(bodaWeb, joinUser, roomOpt, opts.appOpt ?? {}, joinOpt)` — 하드코딩 `{}` 제거. 호출측 미전달 시 `{}` 로 **현행과 동일**(무회귀). 출결(AO_ScCap/AO_AuthQrInfo)·자료(agendaAdd) 등 실제 기능은 각각 후속 REQ.

---

## 4. NFR 확인

| NFR | 확인 |
|---|---|
| NFR-1 i18n | 4 locale 신규 키 반영, JSON 유효성 통과 |
| NFR-2 로깅 | code+reason+WB 로깅, PII 미포함 |
| NFR-3 성능 | 입장 경로 추가 지연 없음(동기 매핑) |
| NFR-5 스펙정합 | roomTitle≤100·roomPwd≤8 clamp, meetKey String, UId 무변경 |
| NFR-6 회귀 | 기존 caller(autoStart/desktop-card) 시그니처 호환, Windows 동선 유지, build clean |

---

## 5. 남은 작업 (Operator / follow-up)

### T0 — FR-1 staging 실측 (운영 필요, P0)
코드가 아닌 **검증 작업**. 절차:
1. staging config: companyCode=245 / companyId=tpi / authKey / roomCode=699 / URL 3종 입력, `BODA_MODE=http`. *webhook 미등록 상태 유지*(meetIdx 부재 재현).
2. 강사 개설 **전/후** 각각 학생 데스크톱 입장 시도 → 성공 여부 + 콘솔 `[BODA]` 로그(오류코드)를 기록.
3. **성립 시**: 학생 데스크톱 입장이 webhook 없이 동작 → [체크리스트 §1](../report/체크리스트-보다스쿨-설정.md) blocker 를 "브라우저 WebRTC·SERVER API 한정"으로 갱신. **불성립 시**: 기존 meetIdx 의존 유지.
4. 결과를 conformance 문서 F1 + 체크리스트에 반영.

### 벤더 확인 의존 (본 작업 비목표)
- Q-4 학생 조인 roomPwd 필요 여부(T4 적용 전제)
- B3 브라우저 WebRTC 조인 계약 / A4 SERVER API 조회키

### 후속 REQ 후보 (FR-6 로드맵)
- 출결 근거(AO_ScCap/AO_AuthQrInfo) · 자료실 연계(agendaAdd) · 입장 안내문(AO_JOpenUl) · 얼굴대조(AO_JC, 개인정보 영향평가 필요)

---

## 6. Sign-off
- 코드 트랙 T1·T2·T3·T5 완료 + T4 배선, FE 전용·무회귀. build/typecheck clean.
- 다음 마일스톤: **T0 staging 실측**(운영) → 결과에 따라 학생 입장 blocker 범위 확정.
</content>
