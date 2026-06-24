---
document_id: BODA-VENDOR-QUESTIONS-MASTER-260624
version: 1.0.0
status: ready-to-send
created: 2026-06-24
audience: ㈜새하컴즈 (BODA) 연동 담당자
supersedes: docs/reference/BODA-vendor-inquiry-260624.md (컷오버 4항목 단축본)
related:
  - docs/implementation/RPT-260624-boda-status-check.md
  - docs/analysis/REQ-260526-acm-cal-boda-integration.md (Q1–Q8)
  - docs/analysis/REQ-260619-boda-launcher-ux-enhancement.md (Q-LX-1~3)
  - reference/BODA_API_TPI/ (SPEC_823 v823.002 + TPI 연동 정보)
---

# ㈜새하컴즈 확인 요청 (BODA 연동 미해결 사항 마스터)

> 트리니티 아카데미(TPI) ACM 연동 개발은 SPEC_823 v823.002 기준 완료(staging/prod 배포).
> 현재 **mock 모드**이며, 아래 항목 회신 후 실연동(`http`)으로 전환합니다.
> **A 그룹(컷오버 필수)** 만 회신되면 화상 강의 기본 동작(개설·입장·출결)이 가능합니다.

---

## 1. 상태 보드 (Status board)

| # | 항목 | 그룹 | 상태 | 우선순위 |
|---|------|:---:|:---:|:---:|
| A1 | Webhook 수신 URL 등록 | A 컷오버 | 🔴 요청 | **필수** |
| A2 | Webhook 출발지 IP 대역 (Q2 연계) | A 컷오버 | 🔴 미회신 | **필수** |
| A3 | Webhook 고정 헤더 토큰 지원 여부 (Q2) | A 컷오버 | 🔴 미회신 | High |
| A4 | SERVER API 조회 키 — 고객사 `meetKey` vs `meetIdx` | A 컷오버 | 🔴 미회신 | High |
| B1 | `bodaOpen/bodaJoin` 클라이언트에 `AuCd` 노출 필요 여부 (Q1) | B 입장 | 🟡 가정(불필요) | High |
| B2 | `BodaAppApi.js` 배포처·버전·갱신 정책 (Q4) | B 입장 | 🔴 미회신 | Medium |
| B3 | WebRTC 무설치 입장이 `bodaOpen/bodaJoin`과 동일 동작인가 (Q5) | B 입장 | 🔴 미회신 | Medium |
| B4 | `UId ≤ 32` ↔ UUID 32 hex 적합 확인 (Q7) | B 입장 | 🟡 가정(적합) | Low |
| B5 | Mac/Mobile 설치 감지 불가 — 권장 fallback UX (Q8) | B 입장 | 🔴 미회신 | Low |
| B6 | 동일 `roomCode` + `dup=1` 다중 룸 동시 운영 한계 (Q6) | B 입장 | 🔴 미회신 | Low |
| C1 | WebRTC 페이지 iframe 임베드 허용 + 헤더 정책 (Q-LX-1) | C iframe | 🔴 미회신 | High |
| C2 | iframe `src` URL + 쿼리 파라미터 정확한 명세 (Q-LX-2) | C iframe | 🔴 미회신 | High |
| C3 | iframe 모드 강사 입장 시 SSO 처리 방식 (Q-LX-3) | C iframe | 🔴 미회신 | High |
| D1 | 그룹수업용 `roomCode` 추가 발급 (Q3) | D 확장 | 🔴 미회신 | 후속 |
| D2 | 녹화/수업노트 SERVER API 조회·재생 권한 | D 확장 | 🔴 미회신 | 후속 |
| D3 | 자격증명 비대칭 보안 채널 합의 (Q12) | D 확장 | 🟡 협의 | Medium |

> ✅ 이미 확보(재질문 불필요): Ccd=245 / Cid=tpi / AuCd=769730064 / SvrApi Basic=`MjQ1Ojc2OTczMDA2NA==` / roomCode(1:1)=699 / URL(bodaweb·svr·webrtc) / userType 11·12·13 / `dup=1` 고정.

---

## 2. [보내는 메시지] — 복사해서 전달

안녕하세요, 트리니티 아카데미(TPI) ACM 시스템 연동 담당입니다.
SPEC_823 v823.002 기준 연동 개발을 완료했고, 실연동 전환 전 아래 항목 확인을 부탁드립니다.
**[A] 항목만 회신되어도 화상 강의 기본 동작(개설·입장·출결)이 가능**합니다. [B][C]는 입장 방식·임베드, [D]는 후속 확장입니다.

### [A] 실연동 전환에 필요한 필수 항목
- **A1.** 이벤트(Webhook) 수신 URL `https://acm.amoeba.site/api/webhooks/boda` 를 등록 부탁드립니다. (등록 후부터 이벤트 수신)
- **A2.** BODA가 이벤트를 보내는 **출발지 IP(또는 CIDR 대역)** 를 알려주세요. 해당 IP를 허용목록에 등록해 인증에 사용합니다.
- **A3.** 이벤트 전송 시 **고정 헤더 토큰**(예: `X-Boda-Token: <발급값>`)을 함께 보내도록 설정 가능한가요? (SPEC_823에 서명 명세가 없어 현재는 IP로 인증 중. 가능하면 IP+토큰 이중 검증을 적용하려 합니다.)
- **A4.** SERVER API(`/svr/meet/info`, `/svr/meet/log/user/join`) 조회 시, 저희가 개설 때 부여하는 **고객사 `meetKey`(형식 `tac-<32자리>`)로 조회가 가능**한가요? 불가하면 이벤트로 내려주시는 `meetIdx`(또는 `meetCodeKey`)로 조회해야 하는지 알려주세요.

### [B] 클라이언트 입장 관련
- **B1.** `bodaOpen()` / `bodaJoin()` 호출 시 **`AuCd`(authKey)를 클라이언트(JS)에서 전달해야 하나요?** 저희는 현재 `meetKey/roomCode/UTy/UId/UNm/dup=1`만 전달하고 인증은 BODA 클라이언트/TCPS가 처리한다고 가정 중입니다. 맞는지 확인 부탁드립니다.
- **B2.** `BodaAppApi.js` 의 **배포 URL·버전·갱신 정책**(CDN vs 자체 호스팅)을 알려주세요.
- **B3.** **WebRTC 무설치(브라우저) 입장**이 `bodaOpen/bodaJoin` 호출로 동일하게 동작하나요, 아니면 별도 URL/방식인가요?
- **B4.** 사용자 식별자 `UId`는 32자 이하 제약으로 이해했습니다. 저희는 UUID에서 하이픈 제거한 32 hex를 사용합니다 — 적합한가요?
- **B5.** Mac/모바일에서 BODA 클라이언트 설치 여부 감지가 어렵습니다. **미설치 사용자 권장 안내/대체 입장 UX**가 있나요?
- **B6.** 동일 `roomCode`(699) 위에서 `dup=1`로 **여러 수업방을 동시 운영할 때 한계(동시 방 수/동시 접속 수용량)** 가 있나요?

### [C] iframe 임베드(고객사 웹 내장) — 선택 기능
- **C1.** WebRTC 입장 페이지(`https://bodaedu.kr/webrtc`)를 저희 도메인(`acm.amoeba.site`)에서 **iframe으로 임베드 허용**하나요? 응답 헤더의 `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`(허용 도메인) 정책을 알려주세요.
- **C2.** 임베드 시 사용할 **정확한 `src` URL과 쿼리 파라미터 명세**(joinUser 인코딩·토큰 등)를 알려주세요.
- **C3.** iframe 모드에서 강사 입장 시 **SSO 처리 방식**(URL 토큰 / 쿠키 / postMessage 등)은 무엇인가요?
  - (임베드 불가 시에는 현행대로 클라이언트 실행 / 브라우저 새 탭 방식으로 운영합니다.)

### [D] 후속/확장
- **D1.** 그룹수업용 **`roomCode` 추가 발급**이 가능한가요? (현재 1:1용 699만 보유)
- **D2.** **녹화·수업노트** SERVER API 조회/재생(`/svr/record/*`, `/svr/note/*`) 사용 조건·권한을 알려주세요.
- **D3.** 향후 자격증명(authKey 등) 교체 시 **비대칭 보안 채널**(1Password share / GPG 등)로 전달 부탁드립니다.

확인 주시면 staging에서 실연동 검증 후 운영 전환하겠습니다. 감사합니다.

---

## 3. 항목별 우리 측 현황 / 회신 후 반영 (내부)

| # | 우리 측 현재 구현·가정 | 회신 후 반영 위치 |
|---|------------------------|-------------------|
| A1 | 수신 엔드포인트 구현 완료(`POST /api/webhooks/boda`), 200 멱등 | 벤더 등록 확인 → 수신 테스트 |
| A2 | webhook 인증을 **IP-allowlist 우선**으로 완화(FIX-260624) | `/admin/config/boda` → `webhookAllowCidrs` |
| A3 | 토큰 있으면 IP+토큰 이중, 없으면 IP 단독 | (가능 시) `eventSecret` 저장 |
| A4 | `getMeetInfo/getJoinLog`를 고객사 `meetKey`로 조회 | 불가 시 `meetIdx` 기준 전환(소규모 PR) |
| B1 | `bodaOpen/Join`에 AuCd 미전달(TCPS 가정) | 필요 회신 시 클라이언트 파라미터 추가 |
| B2 | `appApiUrl = {bodaWebUrl}/BodaAppApi.js` 로 로드(10s 타임아웃) | 배포처/버전 회신 반영 |
| B3 | 모드 B "브라우저 새 탭"(`webBrowserUrl`)로 무설치 진입 제공 | 동작 차이 회신 반영 |
| B4 | `UId = UUID(32 hex)` | 부적합 시 매핑 규칙 변경 |
| B5 | 9-state 에러 카드 + 설치 안내 링크 | 권장 UX 회신 반영 |
| B6 | 동시 운영 한계 미반영 | 한계 회신 시 throttle/안내 |
| C1–C3 | 모드 A(iframe) **코드 완료·`BODA_EMBED_ENABLED=false`로 비활성** | 허용 회신 시 `BODA_EMBED_ENABLED=true` + URL/SSO 반영 |
| D1 | 그룹수업 Non-Goal | 발급 시 다종 roomCode 운용 |
| D2 | 녹화/노트 미사용 | 조건 회신 후 별도 작업 |
| D3 | 비밀 AES-GCM BYTEA 저장, env 키 이름만 기록 | 채널 합의 |

> 참고: 컷오버 절차·설정 매핑은 [RPT-260624](../implementation/RPT-260624-boda-status-check.md) §6, 리허설은 [scripts/boda-staging-cutover-rehearsal.sh](../../scripts/boda-staging-cutover-rehearsal.sh).
