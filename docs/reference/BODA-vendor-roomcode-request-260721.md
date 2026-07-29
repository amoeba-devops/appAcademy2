---
document_id: BODA-VENDOR-ROOMCODE-REQUEST-260721
version: 1.0.0
status: ready-to-send
created: 2026-07-21
audience: ㈜새하컴즈 (BODA / 보다에듀) 연동 담당자
related:
  - docs/reference/BODA-vendor-questions-master-260624.md (D1 상세화)
  - docs/design/DSN-260721-boda-fixed-classroom-code.md
  - docs/report/체크리스트-보다스쿨-설정.md
supersedes: >
  BODA-vendor-questions-master-260624.md 의 D1 (그룹수업용 roomCode 추가발급) 한 줄 항목을
  목적·발급단위·동시성·운영조건까지 구체화한 단독 요청서
---

# ㈜새하컴즈 확인 요청 — `roomCode` 추가발급 · 고정 강의실 운영 (TPI)

> **목적**: 트리니티 아카데미(TPI)에서 **"예약 시각 없이 강사가 필요할 때 즉시 여는 고정 강의실"** 을
> 여러 개 상시 운영하려 한다. 현재 1:1 수업용 `roomCode=699` 1개만 보유. 추가 발급이 필요한지부터
> 확정하는 것이 이 요청의 핵심이다.
> **판정 분기점**: 아래 **③(동시성 한계)** 회신이 "1개 코드로 다중 방 제약 없음" 이면 **추가 발급 불필요**,
> 우리 설계는 코드 추가 없이 고정 `meetKey` 재사용만으로 완결된다.

---

## 1. 배경 (Context)

| 항목 | 값 | 비고 |
|---|---|---|
| companyCode (Ccd) / companyId (Cid) | `245` / `tpi` | 확보 |
| authKey (AuCd) | `769730064` | 확보 |
| **roomCode (1:1 수업)** | **`699`** | **현재 보유 유일** |
| bodaOpen `dup` | `1` 고정 | 동일 roomCode 다중 방 운영용 |
| userType | 강사 11 / 학생 12 / 운영자 13 | 확보 |

우리는 `bodaOpen(bodaWeb, joinUser, { roomCode: 699, dup: 1, meetKey })` 로 강사가 방을 여는 구조이며,
`meetKey` 는 우리 측이 부여하는 고객사 키다. **강의장(반) 단위로 상시 강의실을 두고**, 그 위에서 수업마다
방을 여는 사용을 계획 중이다.

---

## 2. [보내는 메시지] — 복사해서 전달

안녕하세요, 트리니티 아카데미(TPI, Ccd=245 / Cid=tpi) ACM 연동 담당입니다.
현재 1:1 수업용 `roomCode=699` 한 개를 부여받아 사용 중이며, **강의장(반)을 여러 개 상시 운영**하려고
`roomCode` 관련 아래 사항을 확인 부탁드립니다.

**① 추가 발급 가능 여부·방식**
- `roomCode` 를 **여러 개 추가 발급**해 주실 수 있나요? 가능하다면 발급 요청 방식(문서 회신 / 관리자 콘솔 등)과 소요 기간을 알려주세요.
- 발급 단위에 제한이 있나요? (예: 한 번에 N개, 총 보유 한도)

**② 발급 기준 (무엇당 1개가 적절한지)**
- 저희는 `roomCode` 를 **"강의장(고정 강의실)" 단위**로 쓰고 싶습니다. 코드 1개 = 상시 강의실 1개로 두고, 그 위에서 `dup=1` + 수업별 `meetKey` 로 개별 수업을 여는 구조입니다.
- 이 사용 방식이 권장 형태와 맞나요? 아니면 `roomCode` 는 **회사/수업유형 단위**로만 소량 부여되는 값인가요?

**③ 동시성·수용량 (기존 질문 B6과 동일 맥락)**
- **하나의 `roomCode` 위에서 `dup=1` 로 동시에 열 수 있는 방 개수 / 방당 동시 접속 인원 한계**가 있나요?
- 이 한계에 따라 **추가 코드가 필요한지 여부**가 결정됩니다. `roomCode` 1개로 동시 다중 방 운영에 제약이 없다면 추가 발급 없이 `699` 하나로 운영하려 합니다.

**④ 코드별 운영 조건**
- `roomCode` 별로 **제목·비밀번호(roomPwd)·userType 정책·녹화 옵션** 등이 개별 설정되나요, 아니면 회사 공통인가요?
- 발급된 `roomCode` 가 **만료·회수**되는 조건이 있나요? (미사용 시 회수 등) — 상시 강의실로 쓰려면 영구성이 중요합니다.

**⑤ 고정 `meetKey` 재사용 가부 (중요)**
- 저희는 강의장별로 **고정된 `meetKey` 를 부여해 반복적으로 방을 열고 닫으려** 합니다. 즉 같은 `meetKey` 로 **여러 번(방 종료 후 재개설) `bodaOpen`** 을 호출합니다.
- 이미 **종료(CLOSED)된 방과 동일한 `meetKey` 로 새 방을 다시 여는 것**이 허용되나요, 아니면 매 개설마다 **유일한 `meetKey`** 가 강제되나요?
- (관련) 학생 입장 시 `bodaJoin({ meetKey })` 로 **`meetIdx` 없이 `meetKey` 만으로 입장**이 가능한가요? 불가하면 개설 시 발급되는 `meetIdx` 를 이벤트(Webhook)로 수신해야 하는데, 저희 Webhook URL(`https://acm.amoeba.site/api/webhooks/boda`) 등록도 함께 부탁드립니다.

⚠️ 참고: 사용 목적은 **"예약된 시각 없이, 강사가 필요할 때 즉시 여는 고정 강의실"** 입니다.
`bodaOpen(roomCode, dup=1, meetKey)` 호출 시 별도 시간 예약 없이 방이 열리는 현재 동작을 전제로 하며, 이 전제가 맞는지도 함께 확인 부탁드립니다.

감사합니다.

---

## 3. [내부 메모] — 회신 후 반영 위치

| 회신 항목 | 반영 위치 / 조치 |
|---|---|
| ① 추가 발급 O + 코드 목록 | `/admin/config/boda` 현재 `defaultRoomCode` 단일값 → **강의장별 roomCode 매핑 구조** 필요 (스키마·UI 확장, 별도 PR). 코드 1개면 `defaultRoomCode` 유지 |
| ① 발급 불가 / 소량만 | `dup=1` 다중 방 운영으로 확정 → 추가 개발 없음, `699` 유지 |
| ② 발급 단위 = 강의장 | [DSN-260721](../design/DSN-260721-boda-fixed-classroom-code.md) 고정 강의실 기능과 직결 — `meetKey` 를 강의장별 고정값으로 pin |
| ③ **동시성 한계 값** | **이 요청의 판정 분기점.** 한계 없으면 추가 코드 불필요. 한계 있으면 런처에 동시 개설 throttle/안내 |
| ④ roomPwd/만료 정책 | config 에 roomPwd 필드 추가 여부 결정. 회수 조건 있으면 keep-alive 운영 절차 |
| ⑤ **고정 meetKey 재사용 가부** | **DSN-260721 의 핵심 리스크.** 재사용 불가 회신 시 → "고정 강의실 + 개설마다 새 meetKey 발급" 로 설계 조정 (§ DSN-260721 R-1) |
| ⑤ meetKey-only 입장 (JOIN_KEY) | 가능 시 webhook 없이도 학생 입장 → blocker 대폭 완화. 불가 시 A1·A2 webhook 컷오버 선결 |

> 관련: 컷오버 필수항목(A1·A2·A4)은 [BODA-vendor-questions-master-260624.md](./BODA-vendor-questions-master-260624.md) §2 [A] 참조.
</content>
</invoke>
