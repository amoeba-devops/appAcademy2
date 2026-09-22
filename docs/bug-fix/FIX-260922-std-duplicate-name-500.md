---
document_id: STD-FIX-260922-duplicate-name-500
version: 1.0.0
status: FIXED (배포 진행)
date: 2026-09-22
---

# FIX-260922 — 퇴원생 등록 시 동명 학생이 있으면 500 Internal server error / Duplicate student name surfaced as 500

## 1. Symptom (증상)

`/admin/std/withdrawn` → [퇴원생 등록] 에서 `김범준`(TPI, 입학 2026-03-02, 퇴원 2026-03-06) 저장 시 **500 Internal server error**. nginx 접근 로그에 `POST /api/acm/std/students → 500` 3회(2026-09-22 01:20:40~58Z). 백엔드 로그에는 아무 흔적이 없었다.

## 2. Root Cause (원인)

| # | 원인 | 근거 |
|---|---|---|
| R-1 | 학생 테이블 유니크 제약 `uq_acm_std_ent_name UNIQUE (ent_id, std_name)` (sql/acm/600) — **소프트 삭제 행 포함, 상태 무관**. 프로덕션에 `김범준`(INACTIVE, 2026-05-25 등록) 이 이미 있어 INSERT 가 `duplicate key value violates unique constraint "uq_acm_std_ent_name"` 로 실패 | 로컬 재현: 동일 payload 2회 → 2회째 500, 서버 로그 `duplicate key … uq_acm_std_ent_name` |
| R-2 | `StudentService.create/update` 가 이메일은 사전 검사(`EMAIL_DUPLICATE` 409)하지만 **이름은 검사하지 않음** → TypeORM `QueryFailedError` 가 그대로 전파 | [student.service.ts](../../backend/src/modules/acm-std/application/student.service.ts) |
| R-3 | `GlobalExceptionFilter` 가 비HTTP 예외를 500 으로만 바꾸고 **로그를 남기지 않아** 프로덕션에서 원인 추적 불가 | [global-exception.filter.ts](../../backend/src/presentation/filters/global-exception.filter.ts) |

## 3. Fix (수정)

- `StudentService.assertNameUnique()` — 생성 시, 그리고 수정에서 이름이 바뀔 때 사전 검사 → **409 `NAME_DUPLICATE`**. 제약과 같은 범위(소프트 삭제 포함)로 검사한다.
- `GlobalExceptionFilter` — PG `23505`(unique_violation) 는 **409 `UNIQUE_VIOLATION` + 제약 이름**으로 변환(다른 테이블의 제약 위반도 더 이상 500 아님). **5xx 는 메서드·경로·예외·스택을 error 로그로 기록**.
- 프론트 학생 폼 — `NAME_DUPLICATE` / `UNIQUE_VIOLATION(uq_acm_std_ent_name)` 을 안내 문구로 표시 (ko/en/vi/zh-CN): "같은 이름의 학생이 이미 등록되어 있습니다(재원·비활성·퇴원 포함). 기존 학생을 수정하거나 이름을 구분해 주세요."
- 테스트: `global-exception.filter.spec.ts` 3건.

## 4. Operator Note (운영 안내)

`김범준` 은 이미 **비활성(INACTIVE)** 학생으로 존재한다. 같은 사람이면 학생 상세에서 상태를 **퇴원(WITHDRAWN)** 으로 바꾸고 입학·퇴원일을 입력하는 것이 맞다(퇴원생 xlsx 이관은 이름으로 기존 학생을 매칭한다). 다른 사람이면 이름을 구분해(예: `김범준(2)`) 등록한다. 동명이인을 허용하려면 유니크 제약 자체를 바꿔야 하며 이는 별도 결정 사항이다.

## 5. Verification (검증)

- 로컬(마이그레이션 100건 적용 후): 동일 payload → 수정 전 500, 수정 후 **409 `NAME_DUPLICATE`**.
- backend tsc · eslint · jest / frontend tsc.
