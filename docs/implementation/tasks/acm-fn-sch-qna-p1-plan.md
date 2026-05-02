---
document_id: ACM-PLAN-SCH-QNA-P1-1.0.0
version: 1.0.0
status: Draft
created: 2026-05-02
related_requirements:
  - ACM-REQ-SCH-QNA-P1-1.0.0
related_designs:
  - ACM-FN-SCH-001 v1.0.0
  - ACM-FN-QNA-001 v1.0.0
---

# ACM SCH+QNA P1 — 작업 계획서

> Stage 5 구현 사이클의 Task 분해 + UI 목업 + 의존성 + 리스크.

---

## 1. 목표 (Goal)

[ACM-REQ-SCH-QNA-P1-1.0.0](../../analysis/acm-fn-sch-qna-p1-requirements.md)에 정의된 FR-SCH-P1-01~05, FR-QNA-P1-01~09를 본 사이클에 구현하고 staging 검증까지 완료한다.

---

## 2. Task 분해 (WBS)

### 2.1 SCH (Schools 보강)

| Task | 설명 | 파일 (추정) | 의존 | 예상 |
|------|------|------------|------|------|
| **T-S-01** | DB 마이그레이션: `sch_grade_bands`, `sch_schedules` 테이블 신규 | [sql/acm/400-acm-v1.0a-sch-p1.sql](../../../sql/acm/400-acm-v1.0a-sch-p1.sql) | — | S |
| **T-S-02** | TypeORM entity: `GradeBandTypeormEntity`, `ScheduleTypeormEntity` | acm-sch/infrastructure/typeorm/ | T-S-01 | S |
| **T-S-03** | DTO: `CreateGradeBandDto`, `UpdateGradeBandDto`, `CreateScheduleDto`, `UpdateScheduleDto` | acm-sch/application/dto/ | — | S |
| **T-S-04** | Service: `GradeBandService`, `ScheduleService` (CRUD + Authorized 검증) | acm-sch/application/ | T-S-02, T-S-03 | M |
| **T-S-05** | Controller: `GradeBandController`, `ScheduleController` (S-10~S-13, S-20~S-23) | acm-sch/presentation/ | T-S-04 | S |
| **T-S-06** | School Controller PATCH 정렬 (PUT 유지 + PATCH 별칭) | acm-sch/presentation/school.controller.ts | — | XS |
| **T-S-07** | `SchSchoolPublicService` 정의 + acm-sch.module.ts exports | acm-sch/application/sch-school-public.service.ts | T-S-04 | S |
| **T-S-08** | School delete의 active CSL 차단 로직 (CSL repo로 count) | acm-sch/application/school.service.ts | T-S-07 | S |
| **T-S-09** | school-list-page UI에 "Grade Bands" / "Schedules" count 컬럼 + 카운트 클릭 시 modal placeholder | frontend-acm/src/modules/sch/pages/ | T-S-05 | S |
| **T-S-10** | i18n 키 (sch.gradeBands.*, sch.schedules.*, ko/en/vi) | frontend-acm/src/i18n/locales/ | T-S-09 | XS |

### 2.2 QNA (정기상담 보강)

| Task | 설명 | 파일 (추정) | 의존 | 예상 |
|------|------|------------|------|------|
| **T-Q-01** | DB 마이그레이션: `qna_categories` 테이블 + `amb_acm_qna_question`에 `thread_parent_id`, `category_id`, `use_count` 컬럼 | [sql/acm/410-acm-v1.0a-qna-p1.sql](../../../sql/acm/410-acm-v1.0a-qna-p1.sql) | — | S |
| **T-Q-02** | TypeORM entity: `QnaCategoryTypeormEntity` + question entity 확장 | acm-qna/infrastructure/typeorm/ | T-Q-01 | S |
| **T-Q-03** | DTO: `CreateQnaCategoryDto`, `EscalateQnaDto`, `ReplyQnaDto`, `UseFaqResponseDto` | acm-qna/application/dto/ | — | S |
| **T-Q-04** | Service 확장: soft delete, escalate, reply, thread, use-faq, timeline | acm-qna/application/question.service.ts | T-Q-02 | M |
| **T-Q-05** | `QnaCategoryService` 신규 (CRUD + delete 시 record 참조 검증) | acm-qna/application/qna-category.service.ts | T-Q-02 | S |
| **T-Q-06** | Controller 확장: 엔드포인트 6개 추가 + `QnaCategoryController` 신규 | acm-qna/presentation/ | T-Q-04, T-Q-05 | S |
| **T-Q-07** | Per-student timeline 컨트롤러 (`/api/acm/qna/students/:userId`) | acm-qna/presentation/qna-student.controller.ts | T-Q-04 | S |
| **T-Q-08** | `QnaPublicService` 정의 + acm-qna.module.ts exports | acm-qna/application/qna-public.service.ts | T-Q-04 | S |
| **T-Q-09** | qna-list-page UI: filter (category, isFaq), action 버튼 (escalate/reply/use-faq) | frontend-acm/src/modules/qna/pages/ | T-Q-06 | M |
| **T-Q-10** | i18n 키 (qna.actions.*, qna.categories.*, ko/en/vi) | frontend-acm/src/i18n/locales/ | T-Q-09 | XS |

### 2.3 공통

| Task | 설명 | 의존 | 예상 |
|------|------|------|------|
| **T-C-01** | acm.module.ts에 신규 controller/service 등록 | T-S-*, T-Q-* | XS |
| **T-C-02** | OpenAPI 스펙 갱신 ([acm-v1.0a-openapi-001.yaml](../../design/acm-v1.0a-openapi-001.yaml)) | T-S-05, T-Q-06 | S |
| **T-C-03** | 단위/통합 테스트 작성 (TC 문서 매핑) | TC 문서 | M |
| **T-C-04** | CHANGELOG.md 항목 추가 | 모두 | XS |

> 예상 단위: XS=30분 / S=1~2시간 / M=4~6시간 / L=1일+

---

## 3. UI 목업 (ASCII Wireframe)

### 3.1 SCH — School List Page (변경분만)

```
AS-IS
─────────────────────────────────────────────────────────────────────
Schools                                              [+ New School]
─────────────────────────────────────────────────────────────────────
| Name                | Level   | Region   | Foreign | Actions      |
| Trinity Foreign     | FOREIGN | Seoul    |   ✓     | [Edit] [Del] |
| Hana Middle         | MIDDLE  | Bundang  |         | [Edit] [Del] |
─────────────────────────────────────────────────────────────────────

TO-BE  (T-S-09)
─────────────────────────────────────────────────────────────────────────────────
Schools                                                       [+ New School]
─────────────────────────────────────────────────────────────────────────────────
| Name              | Level | Region | Auth     | Bands | Schedules | Actions   |
| Trinity Foreign   | FORGN | Seoul  | AUTH'D   |  3 ▸  |  2 ▸      | [⋯]       |
| Hana Middle       | MID   | Bundng | UNAUTH'D |  —    |  1 ▸      | [⋯]       |
─────────────────────────────────────────────────────────────────────────────────
                              ▲ click → modal: Grade Bands list (Add/Edit/Del)
                                       ▲ click → modal: Schedules list

Modal: Grade Bands of "Trinity Foreign"                                    [✕]
─────────────────────────────────────────────────────────────────────
| Label          | Min Grade | Max Grade | Note          | Actions   |
| Lower Level    | 5         | 6         | -             | [Edit][🗑]|
| Middle Level   | 7         | 8         | -             | [Edit][🗑]|
| Upper Level    | 9         | 11        | -             | [Edit][🗑]|
                                                       [+ Add band]
─────────────────────────────────────────────────────────────────────

Modal: Schedules of "Trinity Foreign"                                      [✕]
─────────────────────────────────────────────────────────────────────────────
| Year | Type    | Open    | Close   | Test    | Result  | Actions          |
| 2026 | REGULAR | 09-01   | 10-15   | 11-02   | 12-10   | [Edit] [🗑]      |
| 2026 | ROLLING | -       | -       | -       | -       | [Edit] [🗑]      |
                                                              [+ Add schedule]
─────────────────────────────────────────────────────────────────────────────
```

### 3.2 QNA — List Page (변경분만)

```
TO-BE  (T-Q-09)
──────────────────────────────────────────────────────────────────────────────────
Q&A Records                                                   [+ New Question]
Filters: [Category ▾] [Status ▾] [☐ FAQ only] [Search _______]
──────────────────────────────────────────────────────────────────────────────────
| Subject              | Student      | Cat        | Status     | FAQ | Actions  |
| Tuition due date     | Kim Minjun   | Billing    | RESPONDED  |     | [⋯]      |
| ISEE prep schedule   | Lee Soyoung  | Schedule   | OPEN       |     | [⋯]      |
| Refund inquiry       | Park Jisu    | Refund     | ESCALATED  |  ★  | [⋯]      |
──────────────────────────────────────────────────────────────────────────────────
Action menu [⋯]:
   • Reply (스레드 후속)        ─ POST :id/reply
   • Escalate                   ─ POST :id/escalate
   • View thread                ─ GET  :id/thread (modal)
   • Mark resolved              ─ PATCH :id/resolution
   • Use as FAQ (clipboard)     ─ POST :id/use-faq
   • Delete                     ─ DELETE :id (team_lead+ only)

Modal: Reply to "Tuition due date"                                          [✕]
─────────────────────────────────────────────────────────────────────
Subject (auto: "Re: Tuition due date") ___________________________
Body                                                              
[                                                              ]
                                                       [Cancel] [Send]
─────────────────────────────────────────────────────────────────────

Modal: Thread chain                                                         [✕]
─────────────────────────────────────────────────────────────────────
[#1] 2026-05-01 14:22  Kim (parent)        Tuition due date
     "결제일이 언제인가요?"
   └ [#2] 2026-05-01 16:05  Lee (advisor)  Re: Tuition due date
        "이번 달 25일까지입니다."
        └ [#3] 2026-05-02 09:30  Kim (parent)  Re: Tuition due date
             "감사합니다."
─────────────────────────────────────────────────────────────────────
```

### 3.3 QNA — Categories Mini Page (T-Q-06, 별도 라우트 OOS, list 페이지 헤더 [Manage Categories] 버튼으로 modal)

```
Modal: Q&A Categories                                                       [✕]
─────────────────────────────────────────────────────────────────────
| Code     | Label (KR)        | Active | Actions                |
| BILLING  | 결제/환불         |   ✓    | [Edit] [🗑 (refs:0)]   |
| SCHEDULE | 수업 일정          |   ✓    | [Edit] [🗑 (refs:12)]  |  ← 사용중 → 삭제 disabled
| OTHER    | 기타              |   ✓    | [Edit] [🗑]            |
                                                       [+ Add category]
─────────────────────────────────────────────────────────────────────
```

---

## 4. 일정 / 의존성 (Sequence)

```
T-S-01 ──┐                                T-Q-01 ──┐
T-S-03 ──┼─▶ T-S-02 ─▶ T-S-04 ─▶ T-S-05    T-Q-03 ──┼─▶ T-Q-02 ─▶ T-Q-04 ─▶ T-Q-06
T-S-06 ──┘            └─▶ T-S-07 ─▶ T-S-08                       └─▶ T-Q-05 ─┘
                                T-S-09 ─▶ T-S-10                  T-Q-04 ─▶ T-Q-07
                                                                  T-Q-04 ─▶ T-Q-08
                                                                  T-Q-06 ─▶ T-Q-09 ─▶ T-Q-10
                                            ▼                              ▼
                                    T-C-01 → T-C-02 → T-C-03 → T-C-04 (PR commit)
```

---

## 5. 리스크 / 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| SCH 컬럼명 명세 불일치 (`name` vs `schName`) | API 응답 contract 혼동 | 본 사이클 OOS (Decision-D1). 별도 사이클로 명세 정렬 |
| QNA single→N:N student 미전환 | Q-11 시맨틱 불일치 | 본 사이클 단일 student 유지 (Decision-D2). Q-11 OOS |
| RBAC 미구현으로 viewer/admin 분기 부재 | 보안 노출 | 권한 명세 주석으로만 기재, AMA Auth 사이클로 위임 (Decision-D5) |
| frontend-acm i18n 부트스트랩 부재 (P0) | t() 호출 시 fallback ko 출력 | 본 사이클은 i18n 인스턴스 init 포함 (최소: ko/en/vi resources + i18next.init) |
| ACM PostgreSQL 마이그레이션 deploy 자동화 | 미존재 (현 deploy script는 MySQL 전용) | 마이그레이션 SQL은 별도 수동 실행 (`docs/deployment/acm-pg-migrate.md`에 1회 명령 기록) — 본 사이클 후속 |
| Cross-module DI 순환 import | nest 컨테이너 부팅 실패 | Public service는 별도 forwardRef 없이 stateless (entity → DTO 변환만) |

---

## 6. 완료 정의 (Definition of Done)

- [ ] 마이그레이션 SQL 2개 staging DB(`db_amb`)에 적용 + 무결성 확인
- [ ] 신규 엔드포인트 모두 Swagger `/api/docs` 노출 + ApiOperation summary 작성
- [ ] 단위/통합 테스트 [TC 문서](../../test/acm-fn-sch-qna-p1-testcases.md) 모두 통과 (P0/P1 100%)
- [ ] frontend-acm 신규 UI 액션 동작 + ko/en/vi 언어 전환 시 라벨 정상 표시
- [ ] CHANGELOG.md 갱신 + 완료 보고서 작성
- [ ] staging 배포 + smoke test 통과

---

_End of ACM-PLAN-SCH-QNA-P1-1.0.0._
