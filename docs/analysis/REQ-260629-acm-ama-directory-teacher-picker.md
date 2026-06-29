---
document_id: REQ-260629-acm-ama-directory-teacher-picker
version: 0.1.0
status: Draft
created: 2026-06-29
product_code: ACM
title: ACM TCH AMA 디렉토리 검색 + CSL 단계별 강사 픽커 AMA 통합
modules:
  - TCH (Teacher Master / 강사)
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260604-acm-tch-stf-ama-picker.md (v2 — picker 도입)
  - docs/design/DSN-260629-csl-stage-screen-revision.md §6 (Stage 2 1:N pivot)
  - backend/src/modules/acm-auth/application/ama-user-directory.service.ts (서버 사이드 캐시 + entId↔amaEntityId)
  - backend/src/modules/acm-auth/presentation/ama-user.controller.ts (`/acm/ama/users` proxy)
  - frontend-acm/src/components/common/ama-user-picker.tsx (공용 picker)
change_log:
  - { version: 0.1.0, date: 2026-06-29, author: Claude, notes: "초안 — TCH list 페이지 AMA 검색 섹션 + CSL stage 2/3 picker AMA 교체 + tch_ama_user_id 영속화" }
---

# REQ-260629 — ACM TCH AMA 디렉토리 검색 + CSL 단계별 강사 픽커 AMA 통합

## 1. Overview (개요)

본 요구사항은 2개의 인접한 변경을 1개 PR 트랙으로 묶는다:

1. **`/admin/tch` 리스트 페이지에 AMA 디렉토리 검색 섹션 추가** — 운영자가 모달을 열지 않고도 AMA 사용자를 직접 검색 → 결과 행 클릭 → 강사 등록 폼에 사전 채워서 등록.
2. **`/admin/csl/<id>` 2단계 레벨테스트 + 3단계 데모수업의 담당강사 picker 를 AMA picker 로 교체** — 로컬 등록 강사 드롭다운 대신 AMA 디렉토리 검색. 로컬에 강사 row 가 없어도 AMA 사용자라면 선택 가능. 저장 시 백엔드가 **lazy upsert** 로 teacher row 자동 생성.

전제: 백엔드 `AmaUserDirectoryService` + `/acm/ama/users` 엔드포인트는 이미 구현됨 (REQ-260604 v2). 본 작업은 그 위에 (a) 리스트 페이지 UI 와 (b) lazy-upsert 로직만 얹는다.

## 2. Background (배경)

### 2.1 현 상태

- `/admin/tch` 리스트: 로컬 등록 강사 (`amb_acm_tch_teacher` 테이블 행) 만 표시. "강사 추가" 모달 안에서만 AmaUserPicker 사용 가능.
- `/admin/csl/<id>` 2단계 (LevelTestSchedule + 점수 입력) 와 3단계 (DemoClassRow) 모두 `GET /acm/tch/teachers` 응답을 그대로 `<select>` 옵션으로 사용 → **로컬에 등록된 강사만 보이고**, AMA 마스터에는 있지만 로컬에 없는 사용자는 선택 불가.
- 결과: 운영자가 "이번 레벨테스트는 김선생님이 진행" 이라고 지정하려면 사전에 `/admin/tch` → 강사 추가 → AMA 검색 → 저장 → 다시 CSL 로 돌아와 picker 새로고침 후 선택. 3 클릭 이상의 우회 흐름.

### 2.2 운영자 요청 (2026-06-29)

> "신규상담에서 2단계 레벨테스트와 3단계 데모수업에서 담당강사 지정시 AMA 의 USER_LEVEL 사용자 리스트 출력하고 그중에서 선택해야함"

CSL 단계에서 AMA 마스터를 1차 진실원천으로 본다. 로컬 `amb_acm_tch_teacher` 는 (a) 사진/이력서 등 ACM 만의 부가 정보가 있고 (b) 강사 마스터 페이지에서 별도 관리하지만, 단계 picker 입장에서는 **AMA 검색이면 충분**해야 한다.

## 3. Functional Requirements (기능 요구사항)

### FR-AMA-301 — TCH 리스트 페이지 AMA 검색 섹션

`/admin/tch` 리스트 페이지 상단(기존 검색 input 옆 또는 위)에 **"AMA 디렉토리 조회"** 섹션을 신설.

- 입력: 검색어 (이름/이메일, ≥2자), 레벨 다중 체크 (MANAGER/MEMBER/VIEWER, 기본 전체)
- 호출: 기존 `GET /acm/ama/users?q=...&level=...&limit=20`
- 결과 표시: 이름 · 이메일 · 레벨 배지 · "강사 등록" 버튼
- "강사 등록" 클릭 → 기존 TchFormModal 오픈 + 해당 AMA user 정보 prefill (name/email/amaUserId)
- 이미 로컬 강사로 등록된 AMA user 는 결과에서 "이미 등록됨" 뱃지 + 클릭 시 해당 강사 편집 모달 오픈

### FR-AMA-302 — CSL stage 2/3 picker AMA 교체

- LevelTestScheduleDialog (stage 2): 기존 `<select>` 의 teachers → `AmaUserPicker` 로 교체
- DemoClassRow (stage 3): 동일 교체
- AmaUserPicker `levels` prop = `['MANAGER', 'MEMBER', 'VIEWER']` (OWNER 는 server-side 가드, 어차피 응답 안 옴)
- 저장 시 backend 는 AMA userId 를 받아 lazy upsert (FR-AMA-303) → 로컬 teacher row 의 UUID 를 반환 / 저장
- 픽커는 이름 · 이메일 · 레벨 배지 표시 (기존 AmaUserPicker UX 그대로)
- 한 row 의 schedule modal 안에서 선택 → `PUT /level-tests/:type` 또는 `PATCH /trial-classes/:tclId` 로 전송

### FR-AMA-303 — 백엔드 lazy upsert (강사 자동 등록)

CSL stage 2/3 가 `teacherAmaUserId` 와 함께 schedule 저장 요청을 보낼 때:

1. 백엔드는 해당 (entId, amaUserId) 로 `amb_acm_tch_teacher` 조회 (신규 컬럼 `tch_ama_user_id` 활용)
2. 존재하면 그 row 의 `tch_id` 사용
3. 없으면 AMA 디렉토리에서 사용자 정보 fetch (이름, 이메일, 레벨) → 새 teacher row 생성 (`tch_status='ACTIVE'`, `created_by` = 현재 actor) → 그 `tch_id` 사용
4. CSL row 의 `mpt_teacher_id` / `tcl_teacher_id` 에는 항상 로컬 `tch_id` 저장 (FK 무결성 유지)

이 동작은 trial-class 데모 강사 + level-test 강사 동일하게 적용.

### FR-AMA-304 — TCH 신규 컬럼 `tch_ama_user_id`

- `amb_acm_tch_teacher` 에 컬럼 추가: `tch_ama_user_id VARCHAR(64) NULL`
- UNIQUE INDEX `uq_acm_tch_ama_user_id` ON `(ent_id, tch_ama_user_id) WHERE tch_ama_user_id IS NOT NULL AND deleted_at IS NULL`
- 기존 DTO `tchAmaUserId` (REQ-260604 v2 §7 의 passthrough) 가 실제로 영속화됨
- 컬럼 추가 SQL: `sql/acm/989-acm-tch-ama-user-id.sql`

### FR-AMA-305 — `POST /acm/tch/teachers/ama-import` 엔드포인트

`/admin/tch` 리스트의 "강사 등록" 결과 클릭 OR CSL lazy upsert 양쪽 모두에서 사용.

- Request: `{ amaUserId, tchName?, tchEmail? }` — name/email 은 클라이언트가 AMA 검색 결과를 그대로 넘기는 cache (검증용); 백엔드가 다시 AMA 호출해 신뢰값으로 덮어쓸 수도 있음
- Response: `{ teacherId, created: boolean }`
- 권한: STAFF↑ (REQ-260604 와 동일)
- 멱등: 동일 amaUserId 두 번 호출 시 `created=false` 로 같은 teacherId 반환

## 4. Non-Functional Requirements (비기능 요구사항)

| ID | 요건 |
|---|---|
| NFR-301 | AMA 디렉토리 호출은 기존 `AmaUserDirectoryService` 60s 캐시 그대로 활용 (RPS 통제) |
| NFR-302 | `levels` 화이트리스트 (MANAGER/MEMBER/VIEWER) 서버사이드 재강제. OWNER 절대 노출 X (REQ-260604 FR-5) |
| NFR-303 | 멀티테넌트 — `tch_ama_user_id` 의 UNIQUE 는 (ent_id) 스코프, 다른 테넌트가 같은 AMA userId 가져도 무관 |
| NFR-304 | i18n 4 locale (ko/en/vi/zh-CN) — 새 라벨 모두 i18next 키로 |
| NFR-305 | lazy upsert 실패 (AMA 다운, 등) 시 422 (UPSTREAM_FAIL) — 사용자 입력 양호 무관, retry 가능 안내 |

## 5. UX Outline (화면 구성안)

### 5.1 `/admin/tch` 리스트 페이지

```
┌─────────────────────────────────────────────────────────────────┐
│ 강사 관리                                          [ + 강사 등록 ] │
├─────────────────────────────────────────────────────────────────┤
│ ▼ AMA 디렉토리 조회                                                │
│   🔍 [ 김선생                  ]   레벨 [✓ MGR ✓ MEM ✓ VIEW]      │
│                                                                 │
│   ┌─ 검색 결과 ──────────────────────────────────────────────┐  │
│   │ 김선생  kim@trinity.kr  [MEMBER]      [ 강사 등록 ▶ ]    │  │
│   │ 김민지  mj@trinity.kr   [MANAGER]     [ 이미 등록됨 ✓ ]  │  │
│   └────────────────────────────────────────────────────────┘  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 로컬 등록 강사 (12명)                                              │
│   🔍 [ 검색          ]   상태 [▼ ACTIVE]                          │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ 김민지  MANAGER  ACTIVE  …                                │ │
│   │ 이정수  MEMBER   ACTIVE  …                                │ │
│   └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- AMA 검색 섹션은 collapsible(▼/▶) — 기본 펼침
- "이미 등록됨" 클릭 시 해당 로컬 강사 편집 모달
- 검색 결과는 ≥2자부터 debounce 300ms 후 비동기 호출

### 5.2 CSL stage 2 (레벨테스트) — schedule modal

```
┌──── MAP 응시예정일 지정 ──────────────────────┐
│ 날짜  [ 2026-07-03 ]                          │
│ 시간  [▼ 14:00 ]                              │
│ 담당강사                                       │
│   ┌────────────────────────────────────────┐ │
│   │ 🔍 김선생                                │ │
│   │   ↓ AMA 검색 결과 (debounce 300ms)       │ │
│   │   ┌──────────────────────────────────┐ │ │
│   │   │ 김선생  kim@trinity.kr  [MEMBER]│ │ │
│   │   │ 김민지  mj@trinity.kr   [MANAGER]│ │ │
│   │   └──────────────────────────────────┘ │ │
│   │ ※ 저장 시 강사 마스터에 자동 등록됨        │ │
│   └────────────────────────────────────────┘ │
│ ※ 저장 시 수업일정(CAL)에 자동 등록됩니다.       │
│                                               │
│              [ 취소 ]  [ 저장 + CAL 등록 ]    │
└────────────────────────────────────────────────┘
```

### 5.3 CSL stage 3 (데모수업) — row 인라인 편집

```
┌─── 2026-07-10  14:00 ─── ──────── [✓ 완료] ──┐
│ 시간  [▼ 14:00]      담당강사                  │
│                       ┌────────────────────┐ │
│                       │ 🔍 [Lee] [SELECTED]│ │
│                       │   Lee Min Jung      │ │
│                       │   mj@trinity.kr     │ │
│                       │   [MANAGER]    ×    │ │
│                       └────────────────────┘ │
│              [ 저장 ]                          │
│ (...feedback workflow 영역...)                 │
└────────────────────────────────────────────────┘
```

## 6. Out of Scope (제외)

- AMA 디렉토리 사용자의 photo/avatar 표시 (AMA 응답에 없음, FR-2X 로 별도)
- ACM 로컬 강사를 AMA 디렉토리로 push (역방향 동기화) — 항상 AMA 가 SOURCE
- TCH 외 STF 또는 STD 모듈에 동일 흐름 적용 — 본 PR 은 TCH + CSL 만

## 7. Open Questions (미결 사항)

| Q | Topic | 비고 |
|---|-------|------|
| Q-301 | lazy upsert 시 AMA 디렉토리 fetch 실패하면 어떻게? | **제안**: 클라이언트가 picker 결과 시점에 받은 캐시 (`name`, `email`)를 그대로 사용 → 사후 동기화 워커가 갱신. 422 보다 graceful |
| Q-302 | "이미 등록됨" 표시는 어떤 데이터로 판단? | 로컬 teachers 목록 `tch_ama_user_id` 매칭 |
| Q-303 | CSL 에서 OWNER 레벨 사용자는? | 기본 제외 (REQ-260604 FR-5). 운영자 요청 (OWNER) 발생 시 별도 |
| Q-304 | 동일 강사가 여러 단계 row 에서 lazy upsert 시도 시 race condition | UNIQUE 인덱스로 차단 + UPSERT (`ON CONFLICT DO UPDATE`) |

## 8. Acceptance Criteria

- AC-1: `/admin/tch` 리스트 페이지 상단에 AMA 검색 섹션이 보이고, 2자 이상 입력 시 결과 노출
- AC-2: AMA 검색 결과 행의 "강사 등록" 클릭 → TchFormModal 이 amaUserId/name/email prefilled 로 오픈
- AC-3: 이미 등록된 AMA user 는 "이미 등록됨" 배지 + 클릭 시 편집 모달
- AC-4: `/admin/csl/<id>` 2단계 schedule modal 에서 AMA 검색 → 선택 → 저장 시 로컬에 없던 강사도 자동 등록 → CAL 이벤트 정상 생성
- AC-5: `/admin/csl/<id>` 3단계 DemoClassRow 의 강사 select 가 AmaUserPicker 로 교체됨
- AC-6: 4 locale (ko/en/vi/zh-CN) 라벨 모두 번역
- AC-7: `tch_ama_user_id` 컬럼 추가 SQL (sql/acm/989) staging+prod 자동 적용
