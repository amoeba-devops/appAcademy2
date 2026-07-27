---
document_id: FIX-260724-boda-group-third-participant-inactive
version: 2.0.0
status: fixed
created: 2026-07-24
authors:
  - Claude (Opus 4.8)
severity: High (그룹 수업 화상 불가)
scope: 프로덕션(acm.amoeba.site, 테넌트 TPI) — BODA 그룹 수업 입장
related:
  - docs/reference/BODA-vendor-questions-master-260624.md (D1 그룹 roomCode / B6 동시성)
  - docs/reference/BODA-vendor-roomcode-request-260721.md (roomCode 추가발급 요청)
  - docs/design/DSN-260721-boda-fixed-classroom-code.md
  - docs/analysis/REQ-260722-boda-cls-spec823-improvements.md (FR-6 appOpt)
---

# 진단 보고 — BODA 그룹 수업: 3번째 참가자(2번째 학생) 화면 비활성

> **요청**: 원인 규명 우선(수정 전 보고). 본 문서는 **원인 분석**이며, 해결은 사용자 방향 결정 후 진행한다.

---

## 1. 증상 (Symptom)

- 보다스쿨 수업 개설 시 **강사 1명 + 학생 2명** 초대.
- 강의실에는 **강사 1명 + 처음 입장한 학생 1명**의 화면만 활성.
- **나중에 입장한 2번째 학생**: 본인 화면이 **활성화되지 않음**(다른 참가자 화면 **시청은 가능**).

즉 **3번째 참가자부터 활성 영상 슬롯을 받지 못하고 뷰어(시청)로만 참여**된다.

---

## 2. 결론 (Root cause) — 한 줄

**현재 사용 중인 `roomCode = 699` 는 벤더(㈜새하컴즈)가 "1:1 수업용"으로 발급한 룸 코드**다.
이 룸의 **활성 영상 정원/레이아웃이 1:1(강사+학생 1명 = 2인)** 로 구성되어 있어,
**3번째 참가자(2번째 학생)는 입장·시청은 되나 활성 영상 슬롯을 배정받지 못한다.**
→ **우리 애플리케이션 코드의 버그가 아니라, 벤더 룸 코드의 용도(1:1) 한계**다.

---

## 3. 근거 (Evidence)

### 3.1 roomCode 699 = 1:1 전용 (벤더 확인 사항)
- [RPT-260624 §2](../implementation/RPT-260624-boda-status-check.md#L51): `roomCode (1:1 수업) | 699`
- [벤더 질문 마스터:44](../reference/BODA-vendor-questions-master-260624.md#L44): "이미 확보 … **roomCode(1:1)=699** … dup=1 고정"
- [동:75, D1](../reference/BODA-vendor-questions-master-260624.md#L75): "그룹수업용 roomCode 추가 발급이 가능한가요? **현재 1:1용 699만 보유**" → **그룹용 코드 미발급 상태**
- [동:66, B6](../reference/BODA-vendor-questions-master-260624.md#L66): "동일 roomCode(699) 위에서 여러 수업방 동시 운영 시 **동시 접속 수용량 한계**" → **정원 한계 미확인(질문 상태)**

### 3.2 우리 구현은 모든 참가자를 같은 699 룸에 조인 (단일 코드)
- 방 발급 시 `roomCode = cfg.defaultRoomCode`(= 699)를 **모든 방에 복사** — [boda-room.service.ts:100-121](../../backend/src/modules/acm-cal/application/boda-room.service.ts#L100-L121)
- 포털 입장 컨텍스트가 그 `room.roomCode` 를 그대로 반환 — [boda-launch-context.service.ts:242](../../backend/src/modules/acm-cal/application/boda-launch-context.service.ts#L242)
- 즉 강사·학생1·학생2 모두 **동일 meetKey + roomCode 699** 로 같은 방에 들어간다(방 분리 아님).

### 3.3 배제한 가설 (Ruled out)
| 가설 | 판정 | 근거 |
|---|---|---|
| **UId 충돌**(두 학생이 같은 사용자로 처리) | ❌ 배제 | `uid = toBodaUid(refId)` — 학생별 std_id(UUID 32hex)라 **고유** ([boda-launch-context.service.ts:219, 567-570](../../backend/src/modules/acm-cal/application/boda-launch-context.service.ts#L219)) |
| **방 분리**(dup=1 중복 개설로 서로 다른 방) | ❌ 낮음 | `dup` 은 **강사 bodaOpen 에만** 사용, 학생은 bodaJoin(dup 미사용). 모두 동일 meetKey → 동일 방 |
| **meetIdx 라우팅 오류** | ❌ 배제 | 두 학생 모두 동일 `room.meetIdx` 공유 |
| **앱 레이아웃 강제(openOption)로 슬롯 제한** | 🟡 기여 요인 | 우리는 `appOpt={}` 로 **레이아웃 미지정** — 멀티 레이아웃을 강제하지 못함. 단 **1:1 룸에선 레이아웃만으로 정원 확장 불가**(§4 확인 필요) |

→ **코드 측 결함은 발견되지 않음.** 남는 원인은 **룸 코드의 1:1 용도**.

---

## 4. 확정을 위한 확인 (Vendor — 1건)
룸 코드 정원이 실제로 1:1(2인)인지 벤더에 최종 확인한다(이미 [질문서](../reference/BODA-vendor-roomcode-request-260721.md) ③·D1 로 발송 대상):
- **699 의 동시 활성(영상) 인원/정원** — 1:1(2인)로 고정인지, 아니면 `openOption`/설정으로 확장 가능한지 (B6/③).
- **그룹 수업용 roomCode 추가 발급** 가부 및 정원 (D1).

---

## 5. 해결 방향 (제안 — 결정 대기)

| # | 방향 | 성격 | 비고 |
|---|---|---|---|
| **A (근본)** | **그룹수업용 roomCode 발급 요청**(D1) → 그룹 이벤트는 그 코드 사용 | 벤더 발급 + 우리 매핑 | `defaultRoomCode` 단일 → **그룹/1:1 코드 분기** 필요(스키마·config·UI 소규모). 발급이 전제 |
| B (확인 후) | 699 가 `openOption` 멀티 레이아웃으로 확장 가능하면 **appOpt.openOption 지정** | 우리 코드 | [REQ-260722 FR-6](../analysis/REQ-260722-boda-cls-spec823-improvements.md)에서 `enterBodaRoom` appOpt 파라미터 개방됨(PR #162) → 이 경로 재사용 가능. **단 1:1 정원이면 무효** |
| C (임시 운영) | 그룹 수업은 BODA 대신 타 vendor(Google Meet), 또는 **BODA는 1:1만** 운용 | 운영 정책 | 근본 해결 전 회피책 |

> 권장: **B/무효 여부를 §4 벤더 확인으로 먼저 판정** → 확장 가능하면 B(저비용), 불가하면 A(그룹 코드 발급) 로 확정.

---

## 6. 영향 범위 (Impact)
- **그룹 수업(3인 이상) 전부** 동일 증상 예상(강사+학생1만 활성). 1:1 수업은 정상.
- 최근 개선 PR #162([REQ-260722](../analysis/REQ-260722-boda-cls-spec823-improvements.md))와 **무관**(roomTitle/에러/플랫폼/ appOpt 파라미터화는 본 증상의 원인·해결과 직접 관련 없음. 단 방향 B의 **구현 토대**는 제공).

---

## 7. 해결 (Resolution — 2026-07-27, 방향 A 확정)

벤더가 **1:N(그룹) 전용 roomCode `881`** 발급 → 방향 A 로 구현. 운영자가 **수업일정 등록 시 1:1/1:N 을 선택**하고, 룸 발급 시 유형에 맞는 roomCode 를 사용한다.

### 구현 내역
| 계층 | 변경 |
|---|---|
| **DB** | `sql/acm/999h-acm-cal-boda-group-room-code.sql` — `bdc_group_room_code`(config) + `evt_boda_room_type`(event, CHECK ONE_TO_ONE\|ONE_TO_MANY, 기본 ONE_TO_ONE) + TPI 1:N=881 시드(멱등) |
| **BE config** | `boda-config` 엔티티/DTO/서비스 `groupRoomCode` 추가 |
| **BE event** | `cal-event` 엔티티/DTO `bodaRoomType` + 응답 노출. create/update 반영 |
| **BE room** | `boda-room.service.resolveRoomCode()` — 1:1→`defaultRoomCode`(699) / 1:N→`groupRoomCode`(881). 미설정 시 **422 BODA_GROUP_ROOM_CODE_MISSING**(1:1로 조용히 대체하지 않음). `createPending(roomType)` + `applyRoomTypeIfPending()`(개설 전 PENDING 이면 토글 반영) |
| **FE 모달** | `cal-event-modal` — BODASCHOOL(데모/정규수업)에 **수업 유형 1:1/1:N 선택** 드롭다운(기본 1:1) + 안내문. 저장 시 `evtBodaRoomType` 전송 |
| **FE config** | `/admin/config/boda` 에 1:N Room Code(881) 입력 필드 |
| **i18n** | cal(수업 유형/1:1/1:N/안내) + common(groupRoomCode 라벨) ×4 locale |

### 동작
- **1:1 선택** → roomCode 699 (기존과 동일).
- **1:N 선택** → roomCode 881 → 그룹 정원 룸으로 개설되어 **3번째 참가자(2번째 학생) 화면 활성**.
- 언어 기본값 **ko**(joinOpt.lang, 기존 동작 유지).
- 개설 전(PENDING) 유형 변경 시 roomCode 자동 교체. 개설 후(OPEN 이상)에는 세션 중 변경하지 않음.

### 검증
- BE `tsc`/`nest build` clean, FE `tsc`/`vite build` clean, JSON 4 locale 유효.
- 마이그레이션은 CD(step4)가 staging/prod 자동 적용(멱등) — [[project_deploy_auto_migrations]].

### 남은 확인 (운영)
- 실제 1:N 수업 개설 → 학생 2명 이상 **동시 활성** 확인(벤더 881 정원 실측).
- 기존에 1:1(699)로 개설돼 버린 그룹 이벤트는 **유형을 1:N 으로 수정**(개설 전이면 roomCode 자동 교체, 이미 열렸다면 재개설).
</content>
