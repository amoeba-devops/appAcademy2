---
document_id: ACM-TC-SCH-QNA-P1-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-02
related_requirements:
  - ACM-REQ-SCH-QNA-P1-1.0.0
related_plans:
  - ACM-PLAN-SCH-QNA-P1-1.0.0
---

# ACM SCH+QNA P1 — 테스트 케이스

> AC 1:1 매핑. 분류: **U**=Unit / **I**=Integration (NestJS Test+TypeORM in-memory or test DB) / **E**=E2E / **M**=Manual.

## 1. SCH

| TC-ID | 분류 | 우선 | AC | 시나리오 | 입력 | 기대 결과 |
|-------|------|------|----|---------|------|----------|
| TC-SCH-01 | I | P0 | AC-SCH-01 | School PATCH 정상 | `PATCH /api/acm/sch/schools/:id { name:"X" }` | 200, body.name = "X", updatedAt 갱신 |
| TC-SCH-02 | I | P1 | AC-SCH-01 | School PUT 호환 (deprecated) | `PUT /api/acm/sch/schools/:id { name:"X" }` | 200 (alias 라우팅 동작) |
| TC-SCH-03 | U | P0 | — | CreateGradeBandDto validation | `gbdGradeMin > gbdGradeMax` | ValidationError |
| TC-SCH-04 | I | P0 | AC-SCH-02 | Authorized 학교에 grade-band 생성 | `POST /schools/:authId/grade-bands` 정상 body | 201, payload reflect |
| TC-SCH-05 | I | P0 | AC-SCH-02 | Unauthorized 학교에 grade-band 생성 차단 | 동일하지만 unauthorized 학교 | 422, code `SCHOOL_NOT_AUTHORIZED` |
| TC-SCH-06 | I | P1 | AC-SCH-03 | grade-band list 테넌트 격리 | 다른 entId 사용자가 조회 | 404 |
| TC-SCH-07 | I | P0 | AC-SCH-03 | schedule CRUD 4 액션 한 사이클 | POST→GET list→PATCH→DELETE | 모두 200/201/204, 최종 list 비어있음 |
| TC-SCH-08 | I | P0 | AC-SCH-04 | active CSL 참조 학교 삭제 차단 | school에 inq 1건 연결된 상태에서 DELETE | 422, code `SCHOOL_IN_USE` |
| TC-SCH-09 | U | P1 | AC-SCH-05 | `SchSchoolPublicService.findById` 호출 | mock repo로 entId/schId | DTO 반환 / null |
| TC-SCH-10 | M | P2 | UI | school-list-page에서 "Bands count" 컬럼 노출 | UI 수동 확인 | 카운트 정확, 클릭 시 modal open |
| TC-SCH-11 | M | P2 | UI | i18n ko→en 토글 | 언어 전환 | "Grade Bands" 라벨 변경 |

## 2. QNA

| TC-ID | 분류 | 우선 | AC | 시나리오 | 입력 | 기대 결과 |
|-------|------|------|----|---------|------|----------|
| TC-QNA-01 | I | P0 | AC-QNA-01 | Soft delete + 재조회 | DELETE → GET | 204 → 404 |
| TC-QNA-02 | I | P1 | AC-QNA-01 | 다른 entId DELETE 차단 | 외부 테넌트 user | 404 |
| TC-QNA-03 | I | P0 | AC-QNA-02 | Escalate 정상 | POST :id/escalate | 200, status=ESCALATED, escalatedAt set |
| TC-QNA-04 | I | P1 | AC-QNA-02 | 이미 ESCALATED → 재escalate | 동일 호출 2회 | 422, code `INVALID_STATUS_TRANSITION` |
| TC-QNA-05 | I | P0 | AC-QNA-03 | Reply 자식 record 생성 | POST :id/reply | 201, child.threadParentId = :id |
| TC-QNA-06 | I | P0 | AC-QNA-04 | Thread chain 시간순 | parent→reply1→reply2 후 GET :id/thread | 3건 반환, asc 정렬 |
| TC-QNA-07 | U | P1 | — | CreateQnaCategoryDto validation | code 빈 문자열 | ValidationError |
| TC-QNA-08 | I | P0 | AC-QNA-05 | Categories CRUD 사이클 | Create→List→Patch→Delete | 모두 정상 |
| TC-QNA-09 | I | P0 | AC-QNA-05 | 사용중 category 삭제 차단 | record가 참조하는 cat DELETE | 422, code `CATEGORY_IN_USE` |
| TC-QNA-10 | I | P0 | AC-QNA-06 | per-student timeline | GET /students/:userId/qna | 해당 학생 record만, desc 정렬 |
| TC-QNA-11 | I | P1 | AC-QNA-06 | 다른 entId 학생 timeline 조회 차단 | 외부 테넌트 user | 404 |
| TC-QNA-12 | I | P0 | AC-QNA-07 | Use-FAQ tracking | POST :id/use-faq | 200, useCount +1, body.externalBody 반환 |
| TC-QNA-13 | I | P1 | — | Non-FAQ promoted use-faq 차단 | isFaqPromoted=false인 record | 422, code `NOT_FAQ` |
| TC-QNA-14 | U | P1 | AC-QNA-08 | `QnaPublicService.findByStudent` | mock repo | DTO[] 반환 |
| TC-QNA-15 | I | P1 | — | List FAQ-only 필터 | GET /records?faqOnly=true | isFaqPromoted=true 만 |
| TC-QNA-16 | M | P2 | UI | qna-list-page action menu 동작 | reply/escalate 버튼 클릭 | modal 열림, API 호출, list 갱신 |
| TC-QNA-17 | M | P2 | UI | i18n ko→en 토글 | 언어 전환 | qna.actions.* 라벨 변경 |

## 3. 회귀 (Regression)

| TC-ID | 분류 | 우선 | 시나리오 | 기대 결과 |
|-------|------|------|---------|----------|
| TC-REG-01 | I | P0 | 기존 School CRUD 5개 액션 | 그대로 통과 |
| TC-REG-02 | I | P0 | 기존 QNA respond/markResolved/promoteFaq | 그대로 통과 |
| TC-REG-03 | E | P1 | backend `npm test` 전체 | 0 failure |
| TC-REG-04 | M | P0 | staging 배포 후 smoke (https://app-academy-stg.amoeba.site/) | 200 OK |

## 4. 우선순위 정의

| 등급 | 의미 | 출시 차단? |
|------|------|-----------|
| P0 | 핵심 시나리오, 데이터 무결성 | YES — 1건이라도 실패 시 머지/배포 보류 |
| P1 | 부가 시나리오, 권한 경계 | NO — 별건 fix-up PR 허용 |
| P2 | UI/UX 수동, i18n | NO — 다음 사이클 이월 가능 |

---

_End of ACM-TC-SCH-QNA-P1-1.0.0._
