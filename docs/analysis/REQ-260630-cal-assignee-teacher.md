---
document_id: REQ-260630-cal-assignee-teacher
version: 0.1.0
status: Draft
created: 2026-06-30
product_code: ACM
title: CAL 이벤트 "담당자" 필드 — CSL 단계별 일정에 강사 자동 매핑
modules:
  - CAL (Calendar)
  - CSL (Consultation Management)
authors:
  - gray.kim@amoeba.group
related:
  - backend/src/modules/acm-csl/application/csl-cal-linker.service.ts
  - backend/src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity.ts
  - backend/src/modules/acm-cal/infrastructure/typeorm/cal-invitee.typeorm-entity.ts
  - frontend-acm/src/modules/cal/* (calendar UI)
change_log:
  - { version: 0.1.0, date: 2026-06-30, author: Claude, notes: "초안" }
---

# REQ-260630 — CAL 이벤트 "담당자" 필드 + CSL 단계 자동 매핑

## 1. Overview (개요)

CSL 상담관리 **2단계 (레벨테스트)** + **3단계 (데모수업)** 일정 저장 시 CAL 이벤트가 자동 생성된다 (REQ-260626 T-08). 현 모델은:

- `evt_owner_user_id` = **작성자** (이벤트 생성한 운영자)
- `amb_acm_cal_invitee` (kind=TEACHER/STUDENT/PARENT) = **참석자** (1:N junction — 알림 발송 대상)

운영자 요청: 강사 정보를 **작성자 외에 별도 "담당자" 필드**로 캘린더에 표시 (참석자와도 별도). `/admin/cal` 에서 이벤트 카드/상세에 담당자 강사명 노출.

## 2. Functional Requirements

### FR-CAL-A01 — `evt_assignee_tch_id` 컬럼 추가

`amb_acm_cal_event` 에 `evt_assignee_tch_id UUID NULL REFERENCES amb_acm_tch_teacher(tch_id) ON DELETE SET NULL` 추가. 인덱스 `idx_acm_cal_evt_assignee (ent_id, evt_assignee_tch_id, start_at) WHERE deleted_at IS NULL` — 강사별 일정 조회 가속.

### FR-CAL-A02 — CSL 자동 매핑

`CslCalLinkerService.linkLevelTest` + `linkDemoClass` 가 `mt.teacherId` / `tcl.teacherId` 값을 그대로 새 컬럼에 전달. teacherId 가 null 이면 컬럼도 null.

### FR-CAL-A03 — `/admin/cal` UI

- 이벤트 카드 (월/주 뷰): 담당자 표시 (강사명 — 최대 1줄 truncate). 강사 미지정 시 표시 안함.
- 이벤트 상세 모달: "담당자: 김선생 (kim@trinity.kr)" 별도 행. "작성자" / "참석자" 와 분리.
- 이벤트 생성/편집 모달: 담당자 강사 select (로컬 강사 리스트, 필터 ACTIVE) + 비우기 옵션.

### FR-CAL-A04 — `CalEventService` DTO

`CreateCalEventDto.assigneeTchId?: string` (UUID), `UpdateCalEventDto.assigneeTchId?: string | null` — 양쪽 다 optional. 응답 DTO 에 `assigneeTchId` + (선택적으로 `assigneeTchName` join 값) 포함.

## 3. Non-Functional

- 4 locale i18n 필수 (담당자 라벨)
- FK ON DELETE SET NULL — 강사 삭제(soft delete) 와 무관, hard delete 시에만 발동 (현재 hard delete 없음)
- 인덱스 partial WHERE deleted_at IS NULL 로 인덱스 크기 최소

## 4. UI 목업

### `/admin/cal` 월 뷰 — 이벤트 카드
```
┌─────────────────────────┐
│ 14:00 Level Test (MAP)  │
│ — 홍길동                 │
│ 👤 김선생                │  ← 담당자 (NEW)
└─────────────────────────┘
```

### 이벤트 상세 모달
```
Level Test (MAP) — 홍길동
─────────────────────────────────────
일시   2026-07-03 14:00 ~ 15:00
분류   EVENT
회의   NONE
─────────────────────────────────────
담당자  김선생 (kim@trinity.kr)       ← NEW
작성자  관리자 (admin@trinity.kr)
참석자  • 학생 홍길동
       • 학부모 홍부모
       • 강사 김선생
─────────────────────────────────────
[ 편집 ]  [ 삭제 ]
```

### 이벤트 편집 모달
```
... 기존 필드 ...
담당자  [▼ 김선생                     ]   ← NEW select (로컬 강사 ACTIVE)
       └ 비우기
... 기존 필드 ...
```

## 5. Out of Scope

- "담당자" 알림 (현 invitee 알림과 무관)
- 다중 담당자 (현 1명)
- CSL 외 다른 모듈의 자동 매핑 (CLS 수업 세션 등은 별도 트랙)

## 6. Acceptance Criteria

- AC-1: SQL migration apply 후 `\d amb_acm_cal_event` 에서 신규 컬럼 + 인덱스 확인
- AC-2: CSL 2/3단계 schedule modal 에서 강사 지정 + 저장 → CAL 이벤트에 `evt_assignee_tch_id` 채워짐
- AC-3: `/admin/cal` 월 뷰 카드 + 상세 모달에 담당자 강사명 노출
- AC-4: 편집 모달에서 담당자 변경 (다른 강사 OR 비우기) 가능
- AC-5: 4 locale (ko/en/vi/zh-CN) 라벨 정상
- AC-6: 회귀 — 기존 evtOwner / invitee 동작 영향 0
