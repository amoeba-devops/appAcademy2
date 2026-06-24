---
document_id: RPT-260624-boda-status-check
version: 1.0.0
status: complete
created: 2026-06-24
authors:
  - gray.kim@amoeba.group
related:
  - docs/implementation/RPT-260610-acm-cal-boda-integration.md (v1.0.0)
  - docs/implementation/RPT-260610B-acm-cal-boda-instant-classroom.md (v1.0.0)
  - docs/plan/PLN-260619-boda-launcher-ux-enhancement.md (v1.0.0)
  - reference/BODA_API_TPI/ (vendor 연동 정보 + SPEC_823 가이드 3종)
---

# 점검 보고서 — 캘린더 → BODA 강의실 (개설·입장) 구현 상태 & 컷오버 준비

> **결론**: 기능 구현은 staging/production 배포 완료. 남은 핵심은 **벤더 실연동 컷오버(`BODA_MODE=mock→http`)**. TPI 연동 정보는 입수 완료, SVR API 경로 정합성 확인됨. 웹훅은 벤더가 토큰을 안 보내는 정책이라 **IP-allowlist 우선 인증으로 완화(FIX-260624)** 해 수신 리스크 제거. iframe(모드 A)만 Q-LX-1 회신 대기로 보류.

---

## 1. 구현 상태 (AS-BUILT)

| 흐름 | 상태 | 비고 |
|------|:---:|------|
| 일정 등록 시 룸 자동 개설(PENDING) + 런처 URL | ✅ | `meetKey=tac-{evtId32}` |
| 룸 상태머신 PENDING→OPEN→STARTED→PAUSED→ENDED→CLOSED | ✅ | webhook 구동 |
| 런처 입장 — 모드 B(데스크톱앱 + 브라우저 새 탭) | ✅ | `bodaOpen/Join`, `webBrowserUrl` |
| 런처 입장 — 모드 A(iframe 임베드) | ⚠️ 코드완료·게이트 | `BODA_EMBED_ENABLED=false`, Q-LX-1 대기 |
| 즉시 강의(INSTANT) + autoStart 자동 진입 | ✅ | 멱등키·추천학생 |
| Webhook 수신/출결 + 5분 reconcile cron + 관리자 폐쇄 | ✅ | dedup(DB UNIQUE) |
| 관리자 BODA 설정 화면 `/admin/config/boda` | ✅ | 비밀 BYTEA 암호화 |
| **실 벤더 연동(실 룸 개통)** | 🔴 미실시 | 현재 `BODA_MODE=mock` |

테스트: acm-cal 82 + bodaedu infra spec 통과. (RPT-260610 / 260610B 기준 110+)

---

## 2. TPI 연동 정보 (vendor docx — 입수 완료)

출처: `reference/BODA_API_TPI/보다에듀_tpi_연동 정보.docx`

| 항목 | 값 | 반영 위치 |
|------|-----|-----------|
| bodaWeb URL | `https://bodaedu.kr` | `/admin/config/boda` → bodaWebUrl |
| WEBRTC URL | `https://bodaedu.kr/webrtc` | → webrtcUrl |
| SVR API URL | `https://svr.bodaedu.kr` | → svrUrl |
| companyCode (Ccd) | `245` | → companyCode |
| companyId (Cid) | `tpi` | → companyId |
| authKey (AuCd) | `769730064` | → authKey |
| **SVR Basic 인증** | `Basic MjQ1Ojc2OTczMDA2NA==` (= base64 `245:769730064`) | **env `BODA_BASIC_AUTH`** |
| roomCode (1:1 수업) | `699` | → defaultRoomCode |
| userType | 강사 11 / 학생 12 / 운영자 13 | 코드 일치 |
| bodaOpen `dup` | `1` 고정 | 코드 일치 |

> ⚠️ SVR API Basic 인증은 테넌트 config가 아니라 **env `BODA_BASIC_AUTH`** 에서 읽음
> ([bodaedu-server-http.client.ts](../../backend/src/infrastructure/external/bodaedu/infrastructure/bodaedu-server-http.client.ts)). 컷오버 시 필수.

---

## 3. SVR API 정합성 (#3 — PDF 분석 결과)

`BODA SERVER API 가이드 [SPEC_823]_v823.002.pdf` 의 ASCII(경로/파라미터) 추출 결과와 우리 http 클라이언트 대조:

| 우리 클라이언트 호출 | 벤더 가이드 | 정합 |
|---|---|:---:|
| `GET /svr/meet/info?meetKey=` | `/svr/meet/info` (meetInfo/openerId/userInfo) | ✅ |
| `POST /svr/meet/close` {meetKey, reason?} | `/svr/meet/close` | ✅ |
| `GET /svr/meet/log/user/join?meetKey=` | `/svr/meet/log/user/join` (joinDatetime) | ✅ |
| `Authorization: Basic base64(companyCode:authKey)` | `Authorization: Basic` (companyCode:authKey) | ✅ |

가이드에 존재하나 **현재 미사용**(향후 nice-to-have): `/svr/auth/token`, `/svr/meet/list`, `/svr/meet/agenda`, `/svr/record/log/video[/download]`(녹화), `/svr/book/*`, `/svr/note/log/*`(노트/PDF).

**확인 권장 1건**: 가이드의 조회 키는 `meetKey` 외에 `meetCodeKey`/`meetIdx`/`roomCode` 도 존재(버전 822.002에서 `meetCodeKey` 도입). 우리는 customer `meetKey`(tac-…)로 조회 → 벤더가 customer meetKey로 미팅을 키잉하는지 **실연동 1회 검증** 필요(아니면 webhook event 1에서 받은 `meetIdx` 로 조회 전환).

---

## 4. 미결 질문 판정

| 질문 | 판정 | 근거 / 조치 |
|------|------|-------------|
| **Q1** AuCd 발급 | ✅ 해소 | `769730064` 직접 부여(고정). `Basic base64(245:769730064)` 사용 |
| **Q2** 웹훅 인증/서명 | ✅ **완화로 해소(FIX-260624)** | 벤더 스펙(823.002)에 서명/토큰 **미명세** → 토큰 강제 시 실 이벤트 거부. 웹훅 인증을 **IP-allowlist 우선·토큰 선택**으로 변경(아래 §5) |
| **Q-LX-1** iframe 임베드 허용 | 🟠 미해소 | APP API 가이드는 `BodaAppApi.js` 클라이언트 실행(모드 B)만 기술. iframe 가부 벤더 확인 전까지 모드 A 보류 |

---

## 5. 변경 사항 — 웹훅 인증 IP-우선 완화 (FIX-260624)

`boda-webhook.service.ts` `verifyAuth` 정책 변경:

- 인증 요소(allowlist / shared-secret) **둘 다 미설정이면 거부**(`NO_AUTH_CONFIGURED`, fail-closed) — 절대 전체 개방 안 함.
- **IP allowlist 설정 시 출발지 IP는 반드시 통과**(hard gate).
- shared-secret 설정 + 토큰 수신 시 → 일치 필수. 토큰 미수신이라도 **IP gate를 통과했으면 허용**(IP-only). IP allowlist 미설정 + secret 단독이면 토큰 필수(`MISSING_TOKEN`, 종전 호환).

효과: 벤더가 토큰 없이 POST해도 **출발지 IP 대역으로 인증** → 실 이벤트 수신 가능. spec 4→7 케이스로 확장, 전부 pass.

---

## 6. 컷오버 체크리스트 (T8)

**P0 — 지금 진행 가능(룸 개설·입장·SVR API):**
- [ ] `/admin/config/boda` 입력: bodaWebUrl·webrtcUrl·svrUrl·companyCode=245·companyId=tpi·authKey=769730064·defaultRoomCode=699
- [ ] **`webhookAllowCidrs`** 에 BODA 출발지 IP 대역 입력 ← 벤더 확인 필요(웹훅 인증 핵심)
- [ ] env: `BODA_BASIC_AUTH=MjQ1Ojc2OTczMDA2NA==`, `BODA_MODE=http`
- [ ] 웹훅 수신 URL `https://acm.amoeba.site/api/webhooks/boda` 를 ㈜새하컴즈에 등록
- [ ] staging 리허설: 강사 실제 입장 → SVR `/svr/meet/info` 연결 → webhook event 1 수신·룸 OPEN 확인

**벤더 확인 2~3건:**
- [ ] BODA 웹훅 **출발지 IP 대역** (allowlist 설정용)
- [ ] (선택) 웹훅에 고정 헤더 토큰 설정 가능 여부 — 가능하면 IP+토큰 이중
- [ ] Q-LX-1: iframe 임베드 허용 여부 → 허용 시 `BODA_EMBED_ENABLED=true`

**P3 운영 위생:**
- [ ] `BODA_CRYPTO_KEY` 로테이션(과거 노출 이력)
- [ ] SVR 조회 키 meetKey vs meetIdx 실연동 검증(§3)

---

## 7. Sign-off
- 작성: gray.kim@amoeba.group · 2026-06-24
- 코드 변경: 웹훅 IP-우선 인증(FIX-260624) — DB 마이그레이션 없음
- 다음 마일스톤: 벤더 IP 대역 회신 → staging 컷오버 리허설 → `BODA_MODE=http` prod
