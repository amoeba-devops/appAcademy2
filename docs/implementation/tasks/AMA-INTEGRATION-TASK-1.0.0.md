---
document_id: AMA-INTEGRATION-TASK-1.0.0
version: 1.0.0
status: Draft (Awaiting Approval)
project_code: TAC
stage: Implementation / Phase 2 — P0-2
created: 2026-04-27
author: AI Assistant
reviewers: [김익용]
parent_docs:
  - CLAUDE.md
  - SPEC.md (v1.3.0)
  - docs/analysis/academy-management-requirements.md (FR-009, FR-010)
  - docs/implementation/academy-management-dev-plan.md (§AMA 경계)
  - docs/implementation/academy-management-phase1-completion-report.md (§10-2)
change_log:
  - version: 1.0.0
    date: 2026-04-27
    author: AI Assistant
    description: AMA Client 1:1 실연동 작업 요구사항 분석 + 작업계획서 (화면 구성안 포함) 최초 작성.
---

# P0-2 — AMA Client 1:1 실연동 (Real Integration)
## Requirements Analysis & Work Plan

> 본 문서는 CLAUDE.md §9.2 워크플로우에 따라 **사용자 확인을 받은 뒤** 구현(코드)으로 진행한다.

---

## 1. Overview (개요)

### 1.1 Purpose (목적)

Phase 1 에서 스캐폴드만 존재하던 **AMA Client ↔ Trinity Academy Teacher** 연동을 실제 동작 가능한 상태로 구현한다. 본 작업은 **읽기 전용 미러 (Read-only Mirror)** 원칙을 준수하며, AMA 가 교사 마스터의 단일 진실 원천(SSoT) 임을 코드 레벨에서 강제한다.

### 1.2 Scope (범위)

| 구분 | 내용 |
|------|------|
| **포함** | (a) AMA HTTP 클라이언트, (b) Teacher 등록 시 AMA Client 검증, (c) 캐시 프로필 갱신, (d) Cron 동기화 작업, (e) Admin 콘솔 — Teacher Picker UI (AMA Client 검색·선택), (f) Teacher 페이지에 동기화 상태 표시·수동 동기화 버튼 |
| **제외** | (i) AMA 의 Client 마스터 데이터를 TAC 측에서 수정 (write-back 금지), (ii) AmoebaTalk 알림 발송 (별도 P0-3), (iii) AMA Webhook 수신 (Polling cron 우선, Webhook 은 향후 확장), (iv) 결제·정산 관련 모든 AMA 호출 (C-003 경계 유지) |

### 1.3 Success Criteria (성공 기준)

1. Admin 사용자가 `/teachers` 페이지에서 **AMA Client ID 직접 입력 없이** 검색·선택만으로 교사 등록이 가능하다.
2. Teacher 생성 시 AMA Client 존재가 실제 호출로 검증되며, 미존재 시 `404 AMA_CLIENT_NOT_FOUND` 응답.
3. Teacher 상세에서 `lastSyncedAt`, `cachedProfile.name/phone/email` 이 AMA 응답값으로 채워진다.
4. Cron(15 분) 또는 수동 트리거로 모든 활성 Teacher 의 캐시 프로필이 갱신된다.
5. AMA 서비스 장애 시 503 (NFR — graceful degradation): 신규 등록은 차단, 기존 조회는 캐시로 응답.
6. 단위 테스트: `AmaClient`, `TeacherSyncService`, `CreateTeacherUseCase` (AMA 검증 포함).

---

## 2. Requirements (요구사항)

### 2.1 Functional (기능 요구)

| ID | 요구사항 | 근거 | 우선 |
|----|---------|------|:--:|
| FR-AMA-01 | AMA 클라이언트는 `clientId` 단건 조회를 지원 (`GET /api/v1/clients/{clientId}`) | FR-009 | P0 |
| FR-AMA-02 | AMA 클라이언트는 검색을 지원 (`GET /api/v1/clients?q=&page=&limit=`) — Admin Picker 에서 사용 | FR-009 UX | P0 |
| FR-AMA-03 | `CreateTeacherUseCase` 는 등록 전 FR-AMA-01 호출하여 존재 검증, 404 시 BadRequest | FR-009 | P0 |
| FR-AMA-04 | 등록 성공 시 응답 페이로드의 `name/phone/email` 을 `tch_cached_profile` JSON 에 저장, `tch_last_synced_at` 갱신 | FR-009 | P0 |
| FR-AMA-05 | `TeacherSyncService.syncOne(teacherId)` — 단일 교사 강제 동기화 유스케이스 + REST 엔드포인트 (`POST /api/teachers/:id/sync`) | FR-010 | P0 |
| FR-AMA-06 | `TeacherSyncService.syncAll(academyId)` — Cron `*/15 * * * *` 로 활성(`ACTIVE`) 교사 일괄 갱신 | FR-010 | P1 |
| FR-AMA-07 | AMA 응답에 `is_deleted=true` 또는 404 시 Teacher 의 `tch_status` 를 `INACTIVE` 로 자동 전이 (soft) | FR-010 | P1 |
| FR-AMA-08 | Admin Teacher 등록 폼에 **AMA Client Picker** (검색 + 선택) UI 제공 | UX | P0 |
| FR-AMA-09 | Admin Teacher 상세에 동기화 상태(마지막 동기화 시각, 캐시 프로필) + **[수동 동기화]** 버튼 노출 | FR-010 | P0 |
| FR-AMA-10 | 모든 AMA 호출은 5초 timeout, 실패 시 1회 재시도 (exponential backoff 0.5s/1.5s) | NFR | P0 |
| FR-AMA-11 | AMA 호출 시 HMAC-SHA256 서명 헤더 (`X-Ama-Signature`, `X-Ama-Timestamp`) 첨부 | NFR-012 | P0 |
| FR-AMA-12 | Mock 모드 — 환경변수 `AMA_MODE=mock` 일 때 인메모리 fixture 사용 (개발/테스트) | DX | P0 |

### 2.2 Non-functional

| ID | 요구사항 |
|----|---------|
| NFR-AMA-01 | AMA SDK 호출은 `infrastructure/external/ama/` 외부에서 직접 사용 금지 (의존성 방향 강제, ESLint boundaries) |
| NFR-AMA-02 | 모든 AMA 호출은 Audit Log 에 기록 (action: `AMA_FETCH`, entity_type: `TEACHER`) |
| NFR-AMA-03 | AMA 호출 실패는 ERROR 레벨 로그 + Sentry 후크 지점만 마련 (실제 Sentry 연동은 별 트랙) |
| NFR-AMA-04 | AMA 응답 캐시는 TAC DB 의 `tch_cached_profile` 만 사용 (Redis 별도 캐시 없음 — 단순화) |

### 2.3 Constraints (제약)

- C-003: AMA 경계 유지 — `external/ama/` 는 **Teacher Read-only Mirror** + **AmoebaTalk Notify Publish** 두 기능만 제공. 결제·환불·세무는 절대 호출 금지 (코드리뷰 체크리스트).
- C-AMA-01: AMA Client 의 사번/이메일/전화번호는 **TAC 가 절대 수정하지 않는다**. 변경은 AMA 콘솔에서만.

### 2.4 Assumptions (가정 — 사용자 확인 필요)

| # | 가정 | 영향 |
|---|------|------|
| A-01 | AMA REST API 는 `Bearer ${AMA_API_KEY}` 인증 + HMAC 서명 헤더 검증 방식이다. | 클라이언트 인증 헤더 구성 |
| A-02 | AMA Client 응답 스키마는 `{ id, name, phone, email, status, employmentType?, profileImageUrl?, updatedAt }`. | DTO 매핑 |
| A-03 | AMA 의 `clientId` 는 문자열(예: `CL-2026-0001`) — 64 자 이내. | 컬럼 길이 OK (현행 64) |
| A-04 | 현 Phase 에서는 **Polling 기반 Cron 동기화** 만 구현 (Webhook 은 차후). | 단순화 |
| A-05 | Mock 모드 fixture 는 5명 정도 dev 시드 — 별도 운영 데이터 마이그레이션 없음. | 작업량 |

> **사용자 확인 요망**: A-01, A-02 의 실제 AMA API 스펙이 다를 경우, FR-AMA-01/02 의 클라이언트 코드 시그니처가 변경된다. AMA 팀과의 스펙 싱크 결과를 알려주시면 반영합니다.

---

## 3. Architecture (아키텍처)

### 3.1 모듈 배치 (Clean Architecture)

```
backend/src/
├── infrastructure/external/ama/         ← 신규
│   ├── ama.module.ts                    NestJS 모듈
│   ├── ama-client.config.ts             환경변수 로딩
│   ├── ama-client.service.ts            HTTP 클라이언트 (axios)
│   ├── ama-mock.service.ts              Mock 구현 (dev/test)
│   ├── ama-signature.util.ts            HMAC 서명 유틸
│   ├── teacher-sync.service.ts          단건/일괄 동기화 + Cron
│   ├── dto/
│   │   ├── ama-client.dto.ts            응답 DTO
│   │   └── ama-search-result.dto.ts
│   └── interfaces/
│       └── ama-client.interface.ts      port (real/mock 양쪽 구현)
│
├── application/use-cases/teacher/       ← 수정
│   ├── create-teacher.use-case.ts       AMA 검증 추가
│   ├── sync-teacher.use-case.ts         신규 — POST /teachers/:id/sync
│   └── search-ama-clients.use-case.ts   신규 — Picker 검색 위임
│
└── presentation/controllers/
    └── teacher.controller.ts            +sync, +search-ama 엔드포인트
```

### 3.2 의존성 방향

```
TeacherController → CreateTeacherUseCase → TeacherRepository
                                         ↘ AmaClientService (interface)
                                                    ↑
                                  AmaClientHttpService / AmaMockService
```

### 3.3 데이터 흐름 — Teacher 등록

```
[Admin UI]                      [Backend]                          [AMA]
  │                               │                                  │
  │ 1. 검색 "홍길동"               │                                  │
  ├─► GET /teachers/ama-search?q=홍길동                              │
  │                               ├─► GET /api/v1/clients?q=홍길동──►│
  │                               │◄──── [{id, name, ...}, ...]──────┤
  │◄───── 검색 결과 list ─────────┤                                  │
  │                               │                                  │
  │ 2. 선택 → Save               │                                  │
  ├─► POST /teachers              │                                  │
  │   { amaClientId: "CL-..." }  │                                  │
  │                               ├─► GET /api/v1/clients/CL-... ──►│
  │                               │◄──── { name, phone, email }─────┤
  │                               │                                  │
  │                               │ INSERT tac_teachers              │
  │                               │   tch_cached_profile=...         │
  │                               │   tch_last_synced_at=NOW()       │
  │◄───── 201 Created ────────────┤                                  │
```

### 3.4 Cron 동기화

```
@Cron('*/15 * * * *')   // every 15 min
syncAll() {
  for each acdId in distinct(tac_teachers.acd_id):
    teachers = SELECT * FROM tac_teachers WHERE acd_id=? AND tch_status='ACTIVE'
    for each t:
      try: amaResp = ama.getClient(t.tchAmaClientId)
           UPDATE tch_cached_profile, tch_last_synced_at
      catch 404: UPDATE tch_status='INACTIVE'
      catch other: log error, continue
}
```

---

## 4. Data Model (데이터 모델)

### 4.1 기존 테이블 (변경 없음)

`tac_teachers`:
- `tch_ama_client_id VARCHAR(64) NOT NULL` ← AMA Client 외부 키
- `tch_cached_profile JSON NULL` ← `{ name, phone, email, profileImageUrl, employmentType }`
- `tch_last_synced_at DATETIME NULL` ← 마지막 AMA 동기화 시각
- `tch_status VARCHAR(20) DEFAULT 'ACTIVE'` ← AMA 404 시 자동 INACTIVE 전이

### 4.2 신규 테이블: 없음

(AMA 호출 audit 은 기존 `tac_audit_logs` 사용)

---

## 5. API Spec (API 명세)

### 5.1 신규 엔드포인트

| Method | Path | 설명 | 권한 |
|--------|------|------|:---:|
| GET | `/api/teachers/ama-search?q={q}&page={n}&limit={m}` | AMA Client 검색 (Picker 용) | ADMIN |
| POST | `/api/teachers/:id/sync` | 단일 교사 강제 동기화 | ADMIN |

### 5.2 변경 엔드포인트

| Method | Path | 변경 사항 |
|--------|------|----------|
| POST | `/api/teachers` | 본문에서 `name/phone/email` 제거 (AMA 응답으로 채움). `amaClientId` 만 필수. AMA 검증 추가. |

### 5.3 응답 예시

```json
// GET /api/teachers/ama-search?q=홍
{
  "data": [
    { "amaClientId": "CL-2026-0001", "name": "홍길동", "phone": "010-1234-5678", "email": "hong@example.com" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}

// POST /api/teachers/12/sync
{
  "data": {
    "id": 12,
    "amaClientId": "CL-2026-0001",
    "cachedName": "홍길동",
    "cachedPhone": "010-1234-5678",
    "lastSyncedAt": "2026-04-27T09:15:32Z"
  }
}
```

---

## 6. UI Design (화면 구성안)

### 6.1 AS-IS — Teacher 등록 모달 (기존)

```
┌──────────────────────────────────────────────────────┐
│ 교사 등록                                       [✕]  │
├──────────────────────────────────────────────────────┤
│ AMA Client ID *  [______________________]           │ ← 직접 타이핑
│ 담당 과목        [수학▼] [영어▼]                    │
│ 고용 형태 *      [○ 정규] [○ 시간강사]              │
│                                                      │
│                     [ 취소 ]  [ 저장 ]               │
└──────────────────────────────────────────────────────┘
```

### 6.2 TO-BE — Teacher 등록 모달 (AMA Picker)

```
┌────────────────────────────────────────────────────────────────┐
│ 교사 등록                                                  [✕] │
├────────────────────────────────────────────────────────────────┤
│ AMA Client *                                                   │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🔍 이름 또는 사번으로 검색...                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌── 검색 결과 ─────────────────────────────────────────────┐ │
│ │ ◯ 홍길동       (CL-2026-0001)  010-1234-5678            │ │ ← radio
│ │ ◯ 홍지수       (CL-2026-0042)  010-9876-5432            │ │
│ │ ◯ 홍성민       (CL-2025-1130)  010-5555-1234            │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ┌── 선택된 AMA Client ─────────────────────────────────────┐ │
│ │ 홍길동                                                    │ │
│ │ CL-2026-0001 · 010-1234-5678 · hong@example.com          │ │
│ │ ⓘ 이름·연락처는 AMA 에서 관리됩니다 (TAC 수정 불가)      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ 담당 과목 *      [수학▼] [영어▼]    ← TAC 자체 관리          │
│ 고용 형태 *      [○ 정규] [○ 시간강사]                       │
│                                                                │
│                            [ 취소 ]  [ 저장 ]                  │
└────────────────────────────────────────────────────────────────┘
```

**컴포넌트**: `<AmaClientPicker>` — debounce 300ms 검색, 선택된 client 카드 + 미러 안내 배지(Gold).

### 6.3 TO-BE — Teacher 상세 페이지 (동기화 패널 추가)

```
┌────────────────────────────────────────────────────────────────┐
│ ← 교사 목록                                                    │
│                                                                │
│ 홍길동                                                  [편집] │
│ CL-2026-0001 · 정규 · ACTIVE                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ ┌── AMA Client 동기화 ──────────────────────────────[새로고침]┐│
│ │ ✅ 마지막 동기화: 2026-04-27 09:15:32 (2분 전)              ││
│ │                                                              ││
│ │  이름     홍길동                                             ││
│ │  연락처   010-1234-5678                                      ││
│ │  이메일   hong@example.com                                   ││
│ │  고용형태 정규                                               ││
│ │                                                              ││
│ │  ⓘ 본 정보는 AMA Client 마스터의 캐시입니다. (read-only)   ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                │
│ ┌── TAC 자체 정보 ─────────────────────────────────────────────┐│
│ │  담당 과목     수학, 영어                          [수정]    ││
│ │  담당 반       3-A, 3-B                                       ││
│ │  주간 시수     12시간                                         ││
│ └──────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

- **[새로고침]** 버튼: `POST /teachers/:id/sync` 호출 → 토스트 성공/실패 → 패널 리로드.
- 동기화 시각 30분 초과 시 노란 경고 색상.
- AMA 404 (INACTIVE 전이) 발생 시 빨간 경고 배너 + "AMA Client 가 삭제되었습니다. 교사 상태가 비활성화되었습니다."

### 6.4 TO-BE — Teacher 목록 페이지 (변경 최소)

```
┌────────────────────────────────────────────────────────────────┐
│ 교사 관리                                  [+ 교사 등록]       │
├────────────────────────────────────────────────────────────────┤
│ [🔍 검색]    상태 [ALL▼]   [↻ 전체 동기화]                    │
├────────────────────────────────────────────────────────────────┤
│ 이름      | AMA Client    | 과목   | 형태 | 동기화      | 상태│
│ ──────────────────────────────────────────────────────────────│
│ 홍길동    | CL-2026-0001  | 수,영  | 정규 | 2분 전      | 🟢  │
│ 김선생    | CL-2026-0002  | 영     | 시간 | 1시간 전    | 🟢  │
│ 박교사    | CL-2025-9999  | 수     | 정규 | 3일 전      | 🔴  │ ← INACTIVE
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Tasks (작업 단위)

### 7.1 Backend

| ID | 작업 | 파일 |
|----|------|------|
| BE-1 | AMA 환경변수 스키마 추가 | `backend/.env.example`, `infrastructure/config/env.config.ts` |
| BE-2 | `IAmaClientService` 인터페이스 (port) | `infrastructure/external/ama/interfaces/ama-client.interface.ts` |
| BE-3 | `AmaClientHttpService` (axios + HMAC + 재시도) | `infrastructure/external/ama/ama-client.service.ts` |
| BE-4 | `AmaMockService` (인메모리 fixture 5건) | `infrastructure/external/ama/ama-mock.service.ts` |
| BE-5 | `AmaModule` (mode 따라 provider 분기) | `infrastructure/external/ama/ama.module.ts` |
| BE-6 | `TeacherSyncService` (Cron + syncOne/syncAll) | `infrastructure/external/ama/teacher-sync.service.ts` |
| BE-7 | `CreateTeacherUseCase` 수정 — AMA 검증 추가 | `application/use-cases/teacher/create-teacher.use-case.ts` |
| BE-8 | `SyncTeacherUseCase` 신설 | `application/use-cases/teacher/sync-teacher.use-case.ts` |
| BE-9 | `SearchAmaClientsUseCase` 신설 | `application/use-cases/teacher/search-ama-clients.use-case.ts` |
| BE-10 | `TeacherController` — `/sync`, `/ama-search` 추가 + Create 본문 슬림화 | `presentation/controllers/teacher.controller.ts` |
| BE-11 | DTO: `CreateTeacherDto` 에서 name/phone/email 제거 (이미 없음 — 확인) / 검색 응답 DTO 추가 | `application/dto/teacher/*` |
| BE-12 | `TeacherModule` 에 `AmaModule` 임포트 + DI 와이어링 | `presentation/teacher.module.ts` |
| BE-13 | 단위 테스트 — `AmaClientHttpService` (mock axios), `TeacherSyncService`, `CreateTeacherUseCase` | `backend/test/...` |

### 7.2 Frontend

| ID | 작업 | 파일 |
|----|------|------|
| FE-1 | `AmaClientPicker` 컴포넌트 (debounce 검색 + radio 선택) | `frontend/src/components/admin/teacher/ama-client-picker.tsx` |
| FE-2 | Teacher 등록 모달 — Picker 통합, name/phone 필드 제거 | `frontend/src/components/admin/teacher/teacher-form.tsx` |
| FE-3 | Teacher 상세 — AMA 동기화 패널 + 새로고침 버튼 | `frontend/src/app/(admin)/teachers/[id]/page.tsx` |
| FE-4 | Teacher 목록 — 동기화 컬럼 + 전체 동기화 버튼 (cron 의존이지만 트리거는 추후) | `frontend/src/app/(admin)/teachers/page.tsx` |
| FE-5 | API 클라이언트 함수 추가 — `searchAmaClients`, `syncTeacher` | `frontend/src/lib/api/teacher.ts` |
| FE-6 | i18n — `admin.teacher.*` 키 4개국어 추가 (sync.label, sync.refresh, ama.notice 등) | `frontend/public/locales/{ko,en,vi,zh-CN}/admin.json` |

### 7.3 Infrastructure / Config

| ID | 작업 |
|----|------|
| INF-1 | `backend/.env.example` 갱신 — `AMA_MODE`, `AMA_API_URL`, `AMA_API_KEY`, `AMA_HMAC_SECRET`, `AMA_TIMEOUT_MS=5000` |
| INF-2 | docker-compose dev 환경변수 기본값 = `mock` 설정 |

---

## 8. Test Plan (테스트 계획)

### 8.1 단위 테스트

| 테스트 | 대상 | 커버 |
|--------|------|------|
| UT-1 | `AmaClientHttpService.getClient` 200 응답 → DTO 매핑 |
| UT-2 | `AmaClientHttpService.getClient` 404 → null 반환 |
| UT-3 | `AmaClientHttpService` timeout → 1회 재시도 후 throw |
| UT-4 | `AmaClientHttpService` HMAC 헤더 생성 검증 |
| UT-5 | `AmaMockService.search` "홍" → 결과 반환 |
| UT-6 | `CreateTeacherUseCase` AMA 미존재 → BadRequest |
| UT-7 | `CreateTeacherUseCase` 정상 → cachedProfile 저장 |
| UT-8 | `TeacherSyncService.syncOne` AMA 404 → 상태 INACTIVE 전이 |

### 8.2 통합 테스트 (선택)

- Mock 모드로 등록→상세→동기화 일괄 시나리오 (Jest e2e).

### 8.3 수동 검증 시나리오

1. dev 환경 `AMA_MODE=mock` 로 기동 → Picker 검색 → 등록 → 상세 캐시 확인 → 새로고침 작동.
2. fixture 에 없는 ID 강제 입력 시도 (Picker 우회) → 400.
3. Cron 15분 후 `tch_last_synced_at` 갱신 확인 (또는 수동 트리거 엔드포인트로 즉시 확인).

---

## 9. Risks & Open Questions (리스크·미결)

| # | 리스크 | 완화 |
|---|--------|------|
| R-01 | AMA 실 API 스펙 미확정 (가정 A-01/A-02) | Mock 모드 우선 구현, 실 API 스펙 확정 시 `AmaClientHttpService` 만 교체. 인터페이스 안정 |
| R-02 | AMA 장애 시 신규 등록 차단 | 503 반환 + 운영자 안내. 캐시 조회는 영향 없음 |
| R-03 | HMAC 비밀키 운영 환경 배포 절차 미정 | `.env` 의 `AMA_HMAC_SECRET` 만 운용, 추후 KMS 트랙에서 다시 다룸 |
| Q-01 | AMA 검색 API의 페이지네이션 방식 (cursor vs offset)? | 사용자 확인 후 클라이언트 코드 확정 |
| Q-02 | Cron 주기 15분이 적정한가, 더 짧게/길게? | 사용자 의견 반영 |
| Q-03 | 전체 동기화(Manual Trigger) 버튼은 이번 범위에 포함? (현재 계획서: "추후") | 사용자 결정 |

---

## 10. Out-of-Scope Reminders (범위 외 재확인)

- 결제·환불·세금계산서: AMA 호출 절대 금지 (C-003)
- 공동인증서 HSM/KMS: 본 범위 제외
- AmoebaTalk 알림 발송: P0-3 별도 작업
- AMA Webhook 수신: 향후 확장

---

## 11. Acceptance Checklist (수락 체크리스트)

- [ ] `npm run dev` 후 `AMA_MODE=mock` 으로 Picker 검색 동작
- [ ] AMA Client 미존재 ID 로 직접 POST 시 400
- [ ] 등록 직후 상세에서 `lastSyncedAt` ≠ null
- [ ] [새로고침] 버튼 클릭 시 `lastSyncedAt` 갱신
- [ ] Cron 1회 수행 시 모든 ACTIVE 교사 갱신 확인 (로그)
- [ ] 단위 테스트 8개 모두 green
- [ ] ESLint boundaries — `external/ama/*` 가 다른 곳에서 직접 임포트되지 않음
- [ ] i18n 키 ko/en/vi/zh-CN 모두 채워짐
- [ ] Swagger `/api/docs` 에 신규 엔드포인트 2개 노출

---

## 12. Estimated Sub-task Order (구현 순서)

1. INF-1, INF-2 (env)
2. BE-2, BE-4, BE-5 (interface + mock + module)  ← Mock 만 먼저
3. BE-9 → BE-10 (search 엔드포인트) → FE-1 → FE-2 (Picker + 등록 모달)
4. BE-7 (Create UC AMA 검증)
5. BE-6, BE-8 → BE-10 (sync 엔드포인트) → FE-3 (상세 패널)
6. BE-3 (HTTP 실 클라이언트) — Mock 인터페이스 검증 후 swap-in
7. BE-13 (테스트)
8. FE-4, FE-5, FE-6 (목록 컬럼 + i18n)
9. Acceptance 검증

---

— *End of AMA-INTEGRATION-TASK-1.0.0* —
