---
document_id: BODA-VENDOR-INQUIRY-260624
version: 1.0.0
status: ready-to-send
created: 2026-06-24
audience: ㈜새하컴즈 (BODA 벤더) 연동 담당자
related:
  - docs/implementation/RPT-260624-boda-status-check.md
  - reference/BODA_API_TPI/ (SPEC_823 v823.002 가이드 3종 + TPI 연동 정보)
---

# BODA 연동 확인 요청 (TPI / 트리니티 아카데미)

> 아래 **[보내는 메시지]** 블록을 그대로 복사해 벤더에 전달하면 됩니다.
> 컷오버(`mock→http` 전환)에 남은 외부 의존은 이 4가지뿐입니다.

---

## [보내는 메시지]

안녕하세요, 트리니티 아카데미(TPI) ACM 시스템 연동 담당입니다.
SPEC_823 v823.002 가이드 기준으로 연동 개발을 완료했고, 실연동 전환 전 아래 **4가지**만 확인 부탁드립니다.
(연동 정보 — Ccd: 245 / Cid: tpi — 는 전달주신 문서로 반영 완료했습니다.)

**1. 이벤트(Webhook) 출발지 IP 대역**
- BODA 시스템이 이벤트를 POST 하는 **출발지 IP(또는 CIDR 대역)** 를 알려주세요.
- 저희는 해당 IP 대역을 허용목록(allowlist)에 등록해 인증에 사용합니다.
- 수신 URL: `https://acm.amoeba.site/api/webhooks/boda` — 이 URL을 등록 부탁드립니다(등록 후부터 이벤트 수신).

**2. Webhook 고정 헤더 토큰 설정 가능 여부**
- SPEC_823 에는 이벤트 서명/토큰이 명세되어 있지 않습니다. 현재는 출발지 IP로 인증하도록 구성했습니다.
- 추가로, 이벤트 전송 시 **고정 헤더(예: `X-Boda-Token: <발급값>`)** 를 함께 보내도록 설정할 수 있나요?
  - 가능하면 IP + 토큰 이중 검증으로 더 안전하게 운영하려 합니다. (불가하면 IP 단독으로 운영)

**3. WebRTC 페이지 iframe 임베드 허용 여부 (Q-LX-1)**
- WebRTC 입장 페이지(`https://bodaedu.kr/webrtc`)를 저희 고객사 웹 화면 안에 **iframe 으로 임베드**해 사용할 수 있나요?
- 가능 여부와 함께, 응답 헤더의 `X-Frame-Options` / `Content-Security-Policy: frame-ancestors` 정책(임베드 허용 도메인)을 알려주세요.
  - 임베드 불가 시에는 현행대로 BODA 클라이언트 실행 / 브라우저 새 탭 방식으로 운영합니다.

**4. SERVER API 조회 키 (meetKey vs meetIdx)**
- 저희는 수업방 개설 시 고객사 측 `meetKey`(형식: `tac-<32자리>`)를 부여합니다.
- `/svr/meet/info`, `/svr/meet/log/user/join` 조회 시 **이 고객사 meetKey 로 조회가 가능**한가요?
  - 불가능하다면, 이벤트로 내려주시는 `meetIdx`(또는 `meetCodeKey`)로 조회해야 하는지 알려주세요.

확인 주시면 staging 환경에서 실연동 검증 후 운영 전환하겠습니다. 감사합니다.

---

## [내부 메모 — 회신 후 반영 위치]

| 회신 항목 | 반영 |
|---|---|
| 1. 출발지 IP 대역 | `/admin/config/boda` → `webhookAllowCidrs` (예: `1.2.3.0/24,5.6.7.8`) |
| 2. 고정 헤더 토큰 | (가능 시) `/admin/config/boda` → `eventSecret` 에 동일 값 저장 → IP+토큰 이중 |
| 3. iframe 허용 (Q-LX-1) | (허용 시) staging/prod env `BODA_EMBED_ENABLED=true` |
| 4. 조회 키 | meetKey 가능 → 변경 없음 / 불가 → reconcile·SVR 호출을 `meetIdx` 기준으로 전환(소규모 PR) |
| (공통) 수신 URL 등록 | 등록 완료 확인 후 webhook 수신 테스트 |
