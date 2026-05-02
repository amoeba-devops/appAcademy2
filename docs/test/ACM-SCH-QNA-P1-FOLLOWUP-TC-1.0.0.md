---
document_id: ACM-TC-SCH-QNA-P1-FOLLOWUP-1.0.0
version: 1.0.0
status: draft
date: 2026-05-02
related:
  - ACM-REQ-SCH-QNA-P1-FOLLOWUP-1.0.0
  - ACM-PLAN-SCH-QNA-P1-FOLLOWUP-1.0.0
change_log:
  - 1.0.0 (2026-05-02): initial test cases (1:1 to AC)
---

# ACM SCH + QNA P1 Follow-up — Test Cases (테스트 케이스)

**범례**: P0 = 출시 차단 / P1 = 회귀 방어 / P2 = nice-to-have
**Type**: U = Unit · I = Integration (jest + testcontainers) · E = E2E · M = Manual UAT · S = Smoke (curl)

## 1. P0 Smoke Tests

| TC ID | AC | Type | Pri | 전제조건 | 입력 | 기대 결과 |
|---|---|---|---|---|---|---|
| TC-S-01 | AC-01 | S | P0 | staging up, ACM_SMOKE_TOKEN 발급 | `bash scripts/smoke-acm-p1.sh https://acm-stg.amoeba.site $TOKEN` | exit 0, 7 step 모두 OK 출력 |
| TC-S-02 | AC-01 | S | P0 | TOKEN 누락 + env var 도 누락 | `bash scripts/smoke-acm-p1.sh https://...` | exit ≠ 0, "TOKEN required" 메시지 |
| TC-S-03 | AC-01 | S | P0 | TOKEN 오염 (`x` 1자) | 위 명령 | exit ≠ 0, HTTP 401 출력 |

## 2. Backend Integration — SCH P1

| TC ID | AC | Type | Pri | 전제조건 | 입력 | 기대 결과 |
|---|---|---|---|---|---|---|
| TC-I-SCH-01 | AC-12 | I | P0 | bootAcmTestEnv 완료 | POST /api/acm/sch/schools `{name, level: 'HIGH'}` | 201, body.id 존재, isAuthorized=false default |
| TC-I-SCH-02 | AC-12 | I | P0 | TC-I-SCH-01 결과 | PATCH /api/acm/sch/schools/:id `{isAuthorized: true}` | 200, body.isAuthorized=true |
| TC-I-SCH-03 | AC-12 | I | P0 | school 존재 + active CSL inquiry 가 해당 school 참조 | DELETE /api/acm/sch/schools/:id | 422, error code = SCHOOL_IN_USE |
| TC-I-SCH-04 | AC-12 | I | P0 | school 존재 + CSL 참조 없음 | DELETE /api/acm/sch/schools/:id | 200 / 204 |
| TC-I-SCH-05 | AC-12 | I | P0 | school 존재 | POST /api/acm/sch/schools/:schId/grade-bands `{label, gradeMin: 1, gradeMax: 3}` | 201, body.id 존재 |
| TC-I-SCH-06 | AC-12 | I | P1 | grade-band 존재 | PATCH /api/acm/sch/schools/:schId/grade-bands/:id `{label: 'updated'}` | 200, body.label='updated' |
| TC-I-SCH-07 | AC-12 | I | P1 | grade-band 존재 | DELETE /api/acm/sch/schools/:schId/grade-bands/:id | 200 |
| TC-I-SCH-08 | AC-12 | I | P0 | school 존재 | POST /api/acm/sch/schools/:schId/schedules `{year: 2026, type: 'REGULAR', testDate: '2026-06-01'}` | 201 |
| TC-I-SCH-09 | AC-12 | I | P1 | schedule 존재 | PATCH .../schedules/:id `{resultDate: '2026-06-15'}` | 200 |
| TC-I-SCH-10 | AC-12 | I | P1 | schedule 존재 | DELETE .../schedules/:id | 200 |
| TC-I-SCH-11 | AC-12 | I | P0 | 학교 미존재 | GET .../schools/00000000-... | 404 |
| TC-I-SCH-12 | AC-12 | I | P0 | 다른 ent_id 의 학교 | GET .../schools/:otherEntSchoolId | 404 (multi-tenant 격리) |

## 3. Backend Integration — QNA P1

| TC ID | AC | Type | Pri | 전제조건 | 입력 | 기대 결과 |
|---|---|---|---|---|---|---|
| TC-I-QNA-01 | AC-12 | I | P0 | category 존재 | POST /api/acm/qna/questions `{subject, body, categoryId}` | 201, body.status='OPEN', body.id 존재 |
| TC-I-QNA-02 | AC-12 | I | P0 | TC-I-QNA-01 결과 | GET /api/acm/qna/questions | 200, items 길이 ≥ 1, item.id 일치 |
| TC-I-QNA-03 | AC-12 | I | P0 | question 존재 | GET /api/acm/qna/questions/:id | 200, body.subject 일치 |
| TC-I-QNA-04 | AC-12 | I | P0 | question 존재 | PUT /api/acm/qna/questions/:id `{subject: 'updated'}` | 200, body.subject='updated' |
| TC-I-QNA-05 | AC-12 | I | P0 | question OPEN 상태 | POST /api/acm/qna/questions/:id/escalate | 201, body.status='ESCALATED' |
| TC-I-QNA-06 | AC-12 | I | P0 | question 존재 | POST /api/acm/qna/questions/:id/reply `{subject, body}` | 201, child question 생성, parent question.status='RESPONDED' |
| TC-I-QNA-07 | AC-12 | I | P0 | TC-I-QNA-06 결과 | GET /api/acm/qna/questions/:id/thread | 200, items.length ≥ 2 (root + reply) |
| TC-I-QNA-08 | AC-12 | I | P0 | question.is_faq_promoted=true | POST /api/acm/qna/questions/:id/use-faq | 201/200, body.externalBody 존재, faq_use_count 증가 |
| TC-I-QNA-09 | AC-12 | I | P0 | question 존재 | DELETE /api/acm/qna/questions/:id | 200, soft-delete 적용 |
| TC-I-QNA-10 | AC-12 | I | P0 | category 미존재 | POST /api/acm/qna/categories `{code, labelKr, labelEn}` | 201 |
| TC-I-QNA-11 | AC-12 | I | P0 | category 존재 | PATCH /api/acm/qna/categories/:id `{labelEn: 'updated'}` | 200 |
| TC-I-QNA-12 | AC-12 | I | P0 | category 존재, 참조 question 없음 | DELETE /api/acm/qna/categories/:id | 200 |
| TC-I-QNA-13 | AC-12 | I | P0 | 다른 ent_id 의 question | GET /api/acm/qna/questions/:otherId | 404 (multi-tenant) |
| TC-I-QNA-14 | AC-12 | I | P1 | category labelVi/labelZh 신규 컬럼 | POST .../categories `{labelVi: 'Phí', labelZh: '学费'}` | 201, response 에 두 라벨 포함 |

## 4. Frontend Manual UAT — SCH

| TC ID | AC | Type | Pri | 시나리오 |
|---|---|---|---|---|
| TC-M-SCH-01 | AC-02 | M | P0 | `/sch` → `+ New School` → 모달 → 입력(name=테스트중, level=MIDDLE) → Save → 리스트에 새 행 등장 + 성공 toast |
| TC-M-SCH-02 | AC-03 | M | P0 | 학교 행 Edit → isAuthorized 토글 (off→on) → Save → 행의 authorized 뱃지 'Yes' 로 변경 |
| TC-M-SCH-03 | AC-04 | M | P0 | active CSL 참조 학교 Delete → 에러 toast "Cannot delete: in use" 표시 (행 유지) |
| TC-M-SCH-04 | AC-05 | M | P0 | 학교 → bands 모달 → `+ Add` → label/min/max 입력 → Save → 카운트 증가 |
| TC-M-SCH-05 | AC-05 | M | P1 | grade-band Edit → label 변경 → Save → 모달 갱신 |
| TC-M-SCH-06 | AC-05 | M | P1 | grade-band Delete → confirm dialog → confirm → 행 사라짐 + 카운트 감소 |
| TC-M-SCH-07 | — | M | P1 | schedules 모달도 동일 CRUD 동작 |

## 5. Frontend Manual UAT — QNA

| TC ID | AC | Type | Pri | 시나리오 |
|---|---|---|---|---|
| TC-M-QNA-01 | AC-06 | M | P0 | `/qna` → `+ New Question` → 입력 → Save → 리스트에 등장 + toast |
| TC-M-QNA-02 | AC-07 | M | P0 | row ⋯ → Edit → subject 수정 → Save → 행의 subject 변경 |
| TC-M-QNA-03 | AC-08 | M | P0 | row ⋯ → Delete → ConfirmDialog (native confirm 아님) → confirm → 행 제거 + toast |
| TC-M-QNA-04 | AC-09 | M | P0 | 사이드바 Q&A → Categories → list 표시 → `+ New Category` → Save → 등장 |
| TC-M-QNA-05 | AC-09 | M | P1 | category Edit/Delete 동작 |
| TC-M-QNA-06 | AC-11 | M | P0 | 언어 vi 전환 → QNA 카테고리 라벨이 vi 값 표시 (없으면 ko) |
| TC-M-QNA-07 | AC-11 | M | P1 | 언어 zh-CN 전환 → 동일 |

## 6. Code Quality / Static

| TC ID | AC | Type | Pri | 명령 | 기대 |
|---|---|---|---|---|---|
| TC-U-01 | AC-13 | U | P0 | `cd backend && npx tsc --noEmit` | 에러 0 |
| TC-U-02 | AC-13 | U | P0 | `cd frontend-acm && npm run build` | tsc clean + bundle 생성 |
| TC-U-03 | AC-10 | U | P0 | `grep -rn 'confirm(\|alert(' frontend-acm/src --include='*.tsx' --include='*.ts'` | 0 hit |
| TC-U-04 | AC-12 | U | P0 | `cd backend && npm test` | 73 + 신규 ≥ 10 PASS |

## 7. Coverage Map (AC ↔ TC)

| AC | TC IDs |
|---|---|
| AC-01 | TC-S-01 ~ 03 |
| AC-02 | TC-M-SCH-01 |
| AC-03 | TC-M-SCH-02 |
| AC-04 | TC-M-SCH-03 + TC-I-SCH-03 |
| AC-05 | TC-M-SCH-04~06 + TC-I-SCH-05~07 |
| AC-06 | TC-M-QNA-01 + TC-I-QNA-01 |
| AC-07 | TC-M-QNA-02 + TC-I-QNA-04 |
| AC-08 | TC-M-QNA-03 + TC-I-QNA-09 |
| AC-09 | TC-M-QNA-04~05 + TC-I-QNA-10~12 |
| AC-10 | TC-U-03 |
| AC-11 | TC-M-QNA-06~07 + TC-I-QNA-14 |
| AC-12 | TC-U-04 + TC-I-* (전체) |
| AC-13 | TC-U-01 + TC-U-02 |

**커버리지**: 모든 13개 AC 가 최소 1개 TC 로 커버됨 ✅
