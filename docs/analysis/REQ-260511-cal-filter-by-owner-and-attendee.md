# REQ-260511-cal-filter-by-owner-and-attendee — 캘린더 작성자/참석자 필터

> **Type**: 요구사항 분석서 (Requirements)
> **Date**: 2026-05-11
> **Module**: ACM CAL
> **Related**: REQ-260511-cal-invitee-and-std-contact (선행 — 참석자 등록 기능)

---

## 1. Overview (개요)

`acm-stg.amoeba.site/admin/cal` 월간 캘린더에서 **작성자(강사)별 보기**와 **참석자(학생)별 보기** 필터 기능을 추가한다. 관리자가 특정 강사/학생의 일정만 빠르게 확인할 수 있도록 한다.

---

## 2. Goals / Non-Goals

### Goals
- G1. 캘린더 헤더에 작성자(강사) 필터 셀렉트 박스 추가 — 선택 시 해당 강사가 작성한 일정만 표시
- G2. 캘린더 헤더에 참석자(학생) 필터 셀렉트/검색 추가 — 선택 시 해당 학생이 참석자로 등록된 일정만 표시
- G3. 두 필터는 독립 적용 + AND 결합 (둘 다 선택 시 교집합)
- G4. ADMIN 권한만 사용 가능. TEACHER 는 본인 일정만 보이는 기존 동작 유지

### Non-Goals
- 강사/학생 자동 추천, 다중 선택, 즐겨찾기 — 단일 선택만 (v1)
- 학부모(PARENT) 별 보기 — Out of scope (요구 없음)
- 주간/일간 뷰 — 현재 월간 뷰만 존재
- 필터 상태 URL 영속 / 새로고침 후 유지 — Out of scope

---

## 3. Functional Requirements (FR)

| ID | 요구사항 |
|----|---------|
| FR-1 | `GET /api/acm/cal/events` 가 신규 쿼리 파라미터를 받는다: `ownerUserId`(기존), `attendeeKind`(STUDENT/TEACHER/PARENT), `attendeeRefId`(UUID) |
| FR-2 | `attendeeKind`+`attendeeRefId` 가 동시에 제공되어야 attendee 필터가 활성화된다. 한쪽만 있으면 400 |
| FR-3 | attendee 필터는 `amb_acm_cal_invitee` 테이블 EXISTS 서브쿼리로 적용 (entId 격리) |
| FR-4 | TEACHER 권한이 `ownerUserId` 또는 `attendeeKind` 를 보내면 무시되거나 403 (현 정책 유지: ownerUserId 무시 → 본인 강제). attendee 필터도 동일하게 무시 |
| FR-5 | 프론트 캘린더 페이지에 `[작성자(강사) 전체 ▾]` `[참석자(학생) 전체 ▾]` 두 셀렉트 박스 노출 |
| FR-6 | 작성자 셀렉트는 `useTeachers()` 로 강사 목록 로딩 (계정 보유한 강사만, 즉 `hasAccount=true` + status=ACTIVE) |
| FR-7 | 참석자 셀렉트는 학생 검색형 — 입력 디바운스 후 `/acm/cal/invitee-candidates?kind=STUDENT&q=` 호출 |
| FR-8 | 필터 변경 시 React Query key 가 갱신되어 자동 재조회 |
| FR-9 | 두 필터 모두 "전체" 선택 가능 (= undefined 전송) |
| FR-10 | TEACHER role 로그인 시 두 필터 UI 자체를 숨긴다 |

---

## 4. Non-Functional Requirements (NFR)

- NFR-1. 필터 추가가 기존 ownerUserId 동작과 충돌 없어야 함 (회귀 0건)
- NFR-2. attendee EXISTS 서브쿼리에 인덱스 활용 — 기존 `idx_acm_cal_invitee_evt_kind_ref` 가 (evt_id, kind, ref_id) 커버 → 즉시 활용 가능
- NFR-3. invitee-candidates 호출은 디바운스 250ms

---

## 5. Acceptance Criteria (AC)

| ID | 시나리오 | 기대 |
|----|---------|------|
| AC-1 | ADMIN 이 작성자 필터로 강사 A 선택 | 강사 A 가 owner 인 일정만 표시 |
| AC-2 | ADMIN 이 참석자 필터로 학생 B 선택 | 학생 B 가 invitee 로 등록된 일정만 표시 |
| AC-3 | 두 필터 동시 선택 (강사 A + 학생 B) | A 작성 AND B 가 참석자인 일정만 표시 |
| AC-4 | 필터 "전체" 로 복귀 | 모든 일정 다시 표시 |
| AC-5 | TEACHER 로 로그인 | 두 필터 UI 가 숨김. API 가 본인 일정만 반환 (기존 동작 유지) |
| AC-6 | `attendeeRefId` 만 보내고 `attendeeKind` 누락 | 400 INVALID_ATTENDEE_FILTER |
| AC-7 | 잘못된 UUID 형식의 `attendeeRefId` | 400 (class-validator) |

---

## 6. Out of Scope

- 학부모/강사 attendee 필터 (스펙 미요구)
- 다중 선택 (ADMIN 이 여러 강사 동시 비교)
- 필터 상태 URL 보존
