---
document_id: REQ-260610-acm-cal-boda-instant-classroom
version: 1.0.0
status: draft
created: 2026-06-10
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260526-acm-cal-boda-integration.md (v2.0.0)
  - docs/implementation/RPT-260610-acm-cal-boda-integration.md (v1.0.0)
  - docs/reference/MANUAL-260610-boda-classroom-user-flow.md (v1.0.0)
change_log:
  - 2026-06-10: v1.0.0 draft — MVP scope, vendor-capability-bounded
---

# 요구사항 — 즉시 개설 화상 강의 (Instant BODA Classroom)

> **One-liner**: 강사가 미리 캘린더에 일정을 등록하지 않고도, "지금 바로 강의 개설 + 학생 초대 + 보다스쿨 강의실 즉시 시작" 을 할 수 있는 1-클릭 흐름. MVP — BODA 가 제공하는 범위 내에서만.

---

## 1. Overview (개요)

### 1.1 배경
- [REQ-260526 v2](./REQ-260526-acm-cal-boda-integration.md) 로 캘린더 일정에 BODA 화상 강의실을 자동 연동하는 기능이 출시됨 (T1–T7 production live).
- 강사 피드백: "갑작스러운 보충·1:1 질문이 들어왔을 때 캘린더에 일정 등록 → 시간 입력 → 학생 검색 → 저장 → 별도 탭에서 입장하는 5단계가 번거롭다."
- 운영자 피드백: "정규 수업 외 임시 화상 미팅에도 BODA 출결 기록을 남겨두면 학부모 응대가 수월하다."

### 1.2 목표
**MVP** — 강사가 캘린더를 거치지 않고 3-클릭 이내에 BODA 룸을 띄울 수 있게 한다. 출결·webhook·종료 처리는 REQ-260526 v2 의 인프라를 그대로 재사용한다.

### 1.3 비목표 (Out of scope)
- 반복 일정 / 시간표 자동 등록 — 정규 수업은 기존 캘린더 흐름 사용.
- BODA 외 vendor 즉시 개설 — Google Meet 등은 외부 URL 입력 필요해 자동화 가치 낮음.
- 강사 본인 외 사용자 (학생·학부모) 가 강의 개설 — 권한·악용 방지 차원에서 v1 에서는 강사·운영자만.

---

## 2. Vendor capability check (보다에듀 제공 범위 확인)

| 기능 | 제공 여부 (SPEC_823 v823.002 기준) | MVP 의존 여부 |
|---|---|---|
| `bodaOpen()` — 강사가 룸 신규 생성 + 본인 입장 | ✅ APP API | **필수** — 즉시 개설의 핵심 |
| `bodaJoin()` — 학생 입장 | ✅ APP API | 필수 (기존 launcher 와 동일) |
| SERVER API `/svr/meet/info` / `/svr/meet/close` / `/svr/meet/log/user/join` | ✅ | 재사용 (REQ-260526 T4·T7) |
| Webhook 이벤트 1·2·3·4·5·10·11·12 | ✅ | 재사용 (REQ-260526 T6) |
| 룸 사전 발급 (캘린더 일정 없이도 meetKey 생성) | ✅ — `bodaOpen` 호출 시점에 생성 | **필수** |
| 룸 입장 가능 시간창 사전 지정 | ❌ — BODA 측은 강사 입장 → 학생 입장 가능 패턴 | MVP 에서는 강사 첫 클릭 = 룸 OPEN |

**결론**: 본 REQ 의 모든 항목은 BODA 가 이미 제공하는 기능 범위 내에서 구현 가능. 추가 벤더 협의 불필요.

---

## 3. AS-IS (현재 상태)

```
강사가 즉흥 보충 수업을 열려면:
  ┌─ 1. /admin/cal 캘린더 진입
  ├─ 2. + 일정 등록 클릭
  ├─ 3. 제목/시간/분류 모두 입력
  ├─ 4. 화상 미팅 → 보다스쿨 선택
  ├─ 5. 참석자 검색 → 다중 선택
  ├─ 6. 저장
  ├─ 7. 일정 다시 클릭 → 미팅 URL 복사 OR 새창 열기
  └─ 8. BODA 클라이언트 실행
  → 8-step / 1~2분 소요
```

문제점:
- **단계 수 과다** — 갑작스러운 수업에 부적합.
- **시간 정보 강제** — "지금 바로" 시작인데 시작/종료 시각 입력을 요구.
- **참석자 검색 UX 부담** — 정규 수업과 동일한 검색 모달.

---

## 4. TO-BE (목표 상태)

```
강사가 즉흥 보충 수업을 열려면:
  ┌─ 1. 어디서든 (캘린더·대시보드·헤더) "즉시 개설" 클릭
  ├─ 2. 한 화면에서: 제목(선택) + 학생 빠른 선택
  └─ 3. "강의 시작" 클릭 → 새 탭에서 BODA 룸 OPEN + 학생에게 즉시 알림
  → 3-step / 10~15초 소요
```

- 시간 정보는 자동: 시작 = 클릭 시각, 종료 = 시작 + 기본 90분 (테넌트 설정).
- 학생 초대는 강사 본인이 담당하는 클래스·세션 멤버 기반 ‘추천 리스트’ 우선 노출.
- 강의 시작 시 학생에게 AmoebaTalk·이메일 알림 즉시 발송 (기존 invitee-notifier 재사용).

---

## 5. Functional Requirements (기능 요구사항)

### FR-INSTANT-1. 즉시 개설 진입점 (Launch trigger)
- 다음 3 위치에 **`즉시 강의 개설`** 버튼을 노출 (모두 동일 모달 열림):
  1. `/admin/cal` 캘린더 상단 — 기존 `+ 일정 등록` 옆.
  2. `/admin/dashboard` 강사 위젯 (강사 역할에 한해).
  3. AppShell 상단 빠른액션 메뉴 (옵션 — 디자인 검토 후 결정).
- 운영자(ADMIN) + 강사(TEACHER) 권한만 보임. 학부모·학생은 미노출.

### FR-INSTANT-2. 즉시 개설 모달 — 최소 입력 폼
- 모달 필드:
  - 제목 (선택, 기본값: `"즉시 강의 - {강사명} {HH:mm}"`)
  - 예상 진행 시간 선택지: `30분 / 60분 / 90분 (default) / 120분`. 종료 시각은 시작 + 선택값으로 자동 계산.
  - 학생 빠른 선택 영역 (FR-INSTANT-3 참조).
- 시작 시각·분류·장소·설명·종일 토글은 모달에 노출하지 않음 (내부 기본값 사용).
- 화상 미팅 = 보다스쿨 **고정** — UI 노출하지 않음 (다른 vendor 는 즉시 개설 대상 아님).

### FR-INSTANT-3. 학생 빠른 초대 (Quick invitee picker)
- **추천 리스트 (Top section, 펼친 상태)**:
  - 본 강사가 담당하는 활성 클래스의 학생 (CLS 모듈 `cls_teacher` join, 중복 제거).
  - 최근 7일 내 본 강사 캘린더 이벤트의 참석 학생 (출현 빈도순).
  - 한 화면 12명 까지 표시. 이름 + 클래스명 칩으로 노출.
  - 체크박스로 다중 선택.
- **검색 (Top right, 항상 표시)**:
  - 입력 시 추천 리스트 영역이 검색 결과로 전환 (실시간).
  - 기존 invitee-picker 와 동일한 검색 백엔드 사용 (`/api/admin/cal/invitee-candidates`).
- **0명 초대도 허용** — 강사 본인만 입장하는 시연·테스트 용도.

### FR-INSTANT-4. 강의 시작 동작
- **`강의 시작`** 버튼 클릭 시 백엔드 처리:
  1. ACM 캘린더 이벤트 생성 (`evtSource='INSTANT'`, `evtCategory='CLASS'`, `evtMeetingProvider='BODASCHOOL'`, 시작=now, 종료=now+선택시간).
  2. `BodaRoomService.createPending()` 호출 → BODA 룸 `PENDING` 상태로 발급.
  3. invitee 행 INSERT + `InviteeNotifierService.notify()` 호출 (AmoebaTalk / Email).
  4. 응답: `{ evtId, launcherUrl, meetKey, invitedCount, notifyResult }`.
- 프론트엔드 후처리:
  1. 모달 닫기.
  2. **새 탭** 으로 `launcherUrl` (= `/web/classroom/{evtId}`) 열기.
  3. 런처 페이지가 현재 사용자를 강사로 인식 → 자동으로 `bodaOpen()` 호출 (FR-INSTANT-5).
  4. 모달 닫힐 때 캘린더 그리드에 새 이벤트가 즉시 반영 (React Query invalidate).

### FR-INSTANT-5. 런처 페이지 자동 진입 모드 (Auto-launch)
- `/web/classroom/{evtId}?autoStart=1` 쿼리 파라미터가 있고 사용자 역할이 강사·운영자면:
  - 페이지 로드 직후 BODA 클라이언트 자동 호출 (`bodaOpen()`).
  - 사용자가 별도 버튼을 누를 필요 없음 (FR-INSTANT-4 의 새 탭 흐름 매끄럽게).
- 클라이언트 미설치 / 시간창 외 / 권한 없음 등 오류 시 기존 9-state error card 표시 (REQ-260526 §5.3).
- `autoStart` 가 없으면 기존 수동 진입 흐름 그대로 유지 (학생 / 캘린더 다이얼로그에서 열린 경우).

### FR-INSTANT-6. 학생 알림 즉시성
- 강의 시작 클릭 후 학생이 받는 알림 (AmoebaTalk / Email) 메시지에 다음 포함:
  - 강사명 + 강의 제목
  - "**지금 시작합니다**" 강조 문구
  - 입장 링크 = `https://acm.amoeba.site/my/timetable` (수업 시간표) — 거기서 새 즉시 강의 카드를 강조 표시.
- 즉시 강의는 학생 시간표에서 **`LIVE`** 빨간 뱃지로 구분 노출.

### FR-INSTANT-7. 일반 캘린더 일정과의 호환
- 즉시 개설 결과 이벤트는 **`evt_source = 'INSTANT'`** 컬럼 (신규) 으로 마킹.
- `/admin/cal` 캘린더에서는 일반 이벤트와 동일하게 표시되지만 작은 ⚡ 아이콘으로 구분.
- 일정 다이얼로그에서 즉시 강의 이벤트를 클릭 시: 시간·참석자 편집은 가능, **단 화상 미팅 vendor 변경은 차단** (이미 BODA 룸이 발급되어 있어 vendor 교체는 의미 없음).

### FR-INSTANT-8. 자동 종료
- 즉시 강의는 강사가 BODA 룸을 닫지 않고 떠나는 경우가 빈발 → REQ-260526 T7 의 reconcile cron 에 의존:
  - `evtEndAt` 도래 후 강사 leave(이벤트 12) → BODA 가 `ROOM_ENDED`(이벤트 4) 보냄 → ACM 룸 `ENDED` → cron 이 10분 후 `CLOSED` 전이.
- 별도 신규 로직 불필요 — 기존 인프라 재사용.

---

## 6. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 기준 |
|---|---|---|
| NFR-INSTANT-1 | **응답성** | "강의 시작" 클릭 → 새 탭 열림까지 ≤ 2초 (백엔드 p95). |
| NFR-INSTANT-2 | **알림 전송** | 학생 알림은 강의 시작 후 ≤ 30초 내 송부 (큐 워커 SLA). |
| NFR-INSTANT-3 | **권한** | 즉시 개설 API 는 JWT + `Roles('TEACHER' \| 'ADMIN')` + OwnEntityGuard. |
| NFR-INSTANT-4 | **다중 동시 호출** | 동일 강사가 즉시 개설 버튼을 빠르게 2번 클릭 시: 백엔드 idempotency-token (요청 헤더) 으로 중복 룸 발급 차단 → 같은 evtId 반환. |
| NFR-INSTANT-5 | **i18n** | ko / en / vi / zh-CN 4 locale 모두 동시 추가 (기존 cal 네임스페이스 확장). |
| NFR-INSTANT-6 | **감사** | INSTANT 이벤트는 작성자(`evt_owner_user_id`) + `evt_source='INSTANT'` + `created_at` 으로 추적 가능. 별도 audit log 불필요. |

---

## 7. UI mockups (텍스트 목업)

### 7.1 진입점 — 캘린더 헤더
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📅 캘린더                                                            │
│                                                  [⚡즉시 강의 개설] [+일정 등록] │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 즉시 개설 모달
```
╭─────────────────────────────────────────────────────────────╮
│ ⚡ 즉시 강의 개설                                    [X]    │
├─────────────────────────────────────────────────────────────┤
│ 제목 (선택)                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 즉시 강의 - 김교사 14:30                  (placeholder) │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ 예상 시간     ( ) 30분  ( ) 60분  (●) 90분  ( ) 120분        │
│                                                              │
│ 학생 초대                              🔍 [검색...........] │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 추천 (담당 클래스 / 최근 7일)                            │ │
│ │ ☑ 박학생 (중3-A)   ☑ 이학생 (중3-A)   ☐ 김학생 (중3-B)  │ │
│ │ ☐ 최학생 (중2-A)   ☐ 정학생 (중2-A)   ☐ 강학생 (중3-A)  │ │
│ │ ... (총 12명까지 표시)                                   │ │
│ │ 선택됨: 2명                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ℹ️ 강의 시작 시 학생에게 즉시 알림이 전송됩니다              │
│                                                              │
│                                    [취소]   [강의 시작 ⚡]   │
╰─────────────────────────────────────────────────────────────╯
```

### 7.3 강의 시작 후 — 새 탭의 런처
```
┌─────────────────────────────────────────────────────────────┐
│   ⚡  강의를 시작합니다...                                   │
│                                                              │
│   📡 BODA 클라이언트 호출 중                                 │
│   ⏳ 약 3초 후 BODA 강의실이 열립니다                        │
│                                                              │
│   강의가 열리지 않나요?  [수동으로 다시 시도]                │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 학생 측 — 수업 시간표의 LIVE 표시
```
오늘 (2026-06-10 화)
┌─────────────────────────────────────────────────────────────┐
│ 🔴 LIVE   14:30 - 16:00                                     │
│ ⚡ 즉시 강의 - 김교사 14:30                                  │
│ 강사: 김교사  ·  보다스쿨                                    │
│                                          [지금 입장하기 →]   │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Acceptance criteria (수락 기준)

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| AC-INSTANT-1 | 강사가 캘린더 헤더의 "즉시 강의 개설" 클릭 | 모달이 열리고 입력값 모두 기본값 채워져 있다. |
| AC-INSTANT-2 | 학생 0명 선택, 제목 비움, 시간 = 90분 default 로 "강의 시작" | 200 응답 + 새 탭으로 런처 열림 + cal_event 행 1개 생성 + boda_room 1개 PENDING. |
| AC-INSTANT-3 | 학생 3명 선택 + "강의 시작" | invitee 3행 + 즉시 알림 3건 송부 (mock 환경에서는 큐 enqueued 로그). |
| AC-INSTANT-4 | 학부모/학생 계정으로 "즉시 강의 개설" 버튼 URL 직접 호출 | 403 Forbidden (RolesGuard). |
| AC-INSTANT-5 | 즉시 강의 진행 후 90분 경과 + 강사 leave | reconcile cron 이 10분 뒤 ROOM `CLOSED` 전이 (T7 인프라). |
| AC-INSTANT-6 | 같은 강사가 즉시 개설 버튼 1초 간격 더블 클릭 | 백엔드가 idempotency-token (X-Idempotency-Key 헤더) 으로 두 번째 요청을 거부하거나 첫 evtId 재반환. 새 cal_event 중복 생성 없음. |
| AC-INSTANT-7 | 학생이 시간표에서 LIVE 카드 클릭 | `/web/classroom/{evtId}` 런처가 즉시 입장 가능 상태로 열림. |
| AC-INSTANT-8 | 즉시 강의 이벤트를 캘린더에서 다시 클릭 → 화상 미팅 vendor 를 다른 것으로 바꾸려 시도 | 드롭다운이 disabled. |
| AC-INSTANT-9 | i18n | ko/en/vi/zh-CN 4 locale 모두 신규 키 누락 없음. |

---

## 9. Open questions (미결 사항)

| ID | 질문 | 책임 / 기한 |
|---|---|---|
| Q-INSTANT-1 | "예상 시간" 4개 선택지 외에 커스텀(분 단위 입력) 도 허용할지? | 운영자 회의, 2026-06-12 |
| Q-INSTANT-2 | 학생 알림 채널 우선순위 — AmoebaTalk > Email vs 둘 다 동시? | NotificationService 정책 확인 |
| Q-INSTANT-3 | 본 강의 시작 직전 시간대에 강사가 다른 즉시 강의를 진행 중인 경우 차단할지 경고만? (BODA 측은 1 강사 = 1 룸 동시 제한 있음) | 벤더 정책 재확인 후 결정 |
| Q-INSTANT-4 | 즉시 강의 이벤트의 통계 — KPI 대시보드에 별도 카드 노출 vs 일반 수업과 통합? | DSH 모듈 PO 의견 |

---

## 10. Implementation impact (영향 범위 - 분석용)

### 10.1 신규
- **BE**: `application/instant-event.service.ts` (얇은 wrapper) + `presentation/instant-event.controller.ts` (1 endpoint: `POST /api/admin/cal/events/instant`).
- **BE schema**: `cal_event` 테이블에 `evt_source` 컬럼 추가 (`MANUAL` / `INSTANT` / `RECURRING` enum) — migration 1개.
- **BE**: 추천 학생 조회 endpoint `GET /api/admin/cal/invitee-suggestions` (강사 본인 + 최근 7일 기반).
- **FE**: `components/instant-class-modal.tsx` + `pages/cal-month-page.tsx` 버튼 추가.
- **FE**: `web-classroom-page.tsx` 의 `autoStart=1` 분기 추가.
- **FE**: `pages/my/timetable-page.tsx` 의 LIVE 카드 분기.

### 10.2 재사용 (기존)
- BodaRoomService, BodaWebhookService, BodaReconcileService — 100% 재사용.
- InviteeNotifierService — 즉시 강의도 동일 알림.
- 캘린더 일정 그리드, 일정 다이얼로그 — 즉시 강의 이벤트는 그대로 표시됨.

### 10.3 미변경
- BODA 측 설정 (`BODA_CRYPTO_KEY`, vendor config) — 무변경.
- DB 의 BODA 4 테이블 (config / room / participant / event_log) — 무변경.

---

## 11. Sign-off (승인 대기)

- 본 REQ 는 **draft** 상태로, 작성자가 다음 단계 작업을 위해 PLN 문서를 함께 작성 중.
- 사용자(운영자) 검토 후 confirm 시 → PLN 의 6 트랙 구현으로 진입.

