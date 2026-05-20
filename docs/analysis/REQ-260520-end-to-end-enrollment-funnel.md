---
document_id: REQ-260520-end-to-end-enrollment-funnel
version: 1.0.0
status: draft
date: 2026-05-20
author: Claude (Opus 4.7)
related:
  - docs/analysis/academy-management-requirements.md
  - docs/design/acm-v1.0a-fn-csl-001.md
  - docs/reference/acm-req-cls-001-class-mgmt-requirements.md
change_log:
  - 2026-05-20: 최초 작성. 8개 요구사항 항목별 코드/문서 갭 분석.
---

# REQ-260520 — 수업 문의→결제 자동화 퍼널 갭 분석 (End-to-End Enrollment Funnel Gap Analysis)

## 1. 분석 대상 (Scope)

사용자가 제시한 **"수업 문의 → 레벨 테스트 → 결과 안내 → 스케쥴링 → 등록(교육비 결제) 자동화"** 전 영역을 8개 세부 항목으로 분해하고, 현 [app-academy](../../README.md) 코드베이스(v1.4.1) + 문서가 각 항목을 어디까지 커버하는지 평가한다.

본 리포트는 **신규 요구사항이 아니라 기존 자산 점검(gap analysis)** 이다. 분석 결과를 토대로 후속 PLN-260520-* 작업 계획서를 별도 작성한다.

### 1.1 항목 분해

원본 요구사항을 9개로 분해 (사용자 텍스트에 "6." 항목이 중복되어 분리):

| # | 한국어 | English label |
|---|--------|---------------|
| R1 | 현재 수업에 대한 완벽한 이해 | Program / curriculum catalog |
| R2 | 자체 레벨 테스트를 통한 진단 | Internal level test (MAP) administration |
| R3 | 레벨 테스트 링크 발송 (2.2) | Test link delivery to prospect |
| R4 | 테스트 완료 후 진단 리포트 발송 | Diagnostic report generation & delivery |
| R5 | 진단 내용을 강사에게 수업 자료로 배포 | Diagnostic distribution to assigned teacher |
| R6 | 실시간 스케쥴 체크 + 가능 슬롯 제안 (학부모-강사 더블체크) | Real-time slot proposal with two-side confirm |
| R7 | 스케쥴-교육 명세서 작성 | Education specification document |
| R8 | 등록(교육비 결제) 링크 자동 전송 + 등록 완료 안내 | Auto payment link & enrollment confirmation |
| R9 | 스케쥴 변동 요청 자동 체크 + 변경 가능 횟수 차감 안내 | Schedule-change request with remaining-budget tracking |

### 1.2 평가 기준 (Status Legend)

- **✅ Implemented** — 백엔드 UC + 프론트 화면 + (해당 시) 알림 트리거까지 동작 가능한 수준
- **🟡 Partial** — 데이터/화면 한쪽만 존재하거나 자동화/연결이 빠진 상태
- **📐 Designed only** — 설계 문서만 있고 코드 없음
- **❌ Missing** — 설계·코드 둘 다 없음

---

## 2. 핵심 결론 (Executive Summary)

1. **8개 요구사항 중 1개(R8 결제)만 거의 완성**, R1·R2는 행정/관리자 영역이 구현됨. **나머지 5개(R3·R4·R5·R6·R7·R9)는 부분 또는 부재**.
2. 현재 퍼널은 **상담사(advisor) 중심 수동 진행** — CSL `INTAKE → MAP_TEST → TRIAL_CLASS → ENROLLMENT_COUNSELING → PAYMENT → CLASS_STARTED` 6단계가 [InquiryWorkflowService](../../backend/src/modules/acm-csl/application/inquiry-workflow.service.ts#L20-L28)에 있지만, 단계 간 **자동 전이(auto-transition) 없음**. 학부모가 직접 진행을 트리거하는 흐름 부재.
3. **알림 이벤트 인프라는 7종 정의**되어 있으나([notification-context.types.ts:23-31](../../backend/src/application/notification/notification-context.types.ts#L23-L31)), **테스트 링크 발송 / 진단 리포트 발송 / 스케쥴 제안 / 변경 횟수 차감** 이벤트는 정의·핸들러 둘 다 없음.
4. **학부모 페이지(`/my/*`)는 read-only** — [my/pages/](../../frontend-acm/src/modules/my/) 4개 페이지(dashboard, scores, timetable, payments) 모두 조회 전용. 슬롯 선택/리스케줄 요청/테스트 응시 UI 부재.
5. **R7 (교육 명세서) 는 설계·코드·문서 어디에도 흔적 없음** — 신규 설계 필요.

**한 줄 요약**: 결제 단(R8)은 완성됐고 관리자 운영 도구(R1·R2 일부)는 갖춰졌으나, **학부모-자동화 퍼널 자체는 미구축**이다. 9개 단계를 한 흐름으로 묶을 orchestration 레이어가 필요하다.

---

## 3. 항목별 상세 (Detailed Findings)

### R1. 현재 수업에 대한 완벽한 이해 — 🟡 Partial

| 영역 | 상태 | 근거 |
|------|------|------|
| ERD/도메인 | ✅ | [program.entity.ts](../../backend/src/infrastructure/database/entities/program.entity.ts), [program-setting.entity.ts](../../backend/src/infrastructure/database/entities/program-setting.entity.ts), `acm-ref` 모듈(class_guidelines / level_test_guides / score_benchmarks) |
| 백엔드 UC | ✅ | [use-cases/program/](../../backend/src/application/use-cases/program/) |
| Admin UI | ✅ | [frontend-acm/src/modules/ref/](../../frontend-acm/src/modules/ref/) (관리자용 가이드라인 편집) |
| Portal 공개 카탈로그 | 🟡 | [frontend-acm/src/modules/portal/](../../frontend-acm/src/modules/portal/) — Trinity 사이트 컨텐츠 있으나 **DB 기반 동적 프로그램 목록** 아닌 정적 컨텐츠 위주. 학부모가 보는 "현 수업 이해" 페이지는 마케팅 카피 중심 |

**갭**: 학부모가 자녀 레벨/학년에 맞는 수업 옵션을 **데이터 기반으로 자동 추천**받는 흐름 부재. `class_guidelines` 데이터를 portal에서 활용하지 않음.

---

### R2. 자체 레벨 테스트 진단 (MAP) — 🟡 Partial

| 영역 | 상태 | 근거 |
|------|------|------|
| 문항 은행 (Question bank) | ✅ | [acm-map 모듈](../../backend/src/modules/acm-map/), `MapQuestion`/`MapPassage` TypeORM 엔티티 |
| 시험 세트 / 배정 (test set / assignment) | ✅ | [map-assignment.entity.ts](../../backend/src/infrastructure/database/entities/map-assignment.entity.ts), [map-test-set.entity.ts](../../backend/src/infrastructure/database/entities/map-test-set.entity.ts), [create-assignment.use-case.ts](../../backend/src/application/use-cases/map/create-assignment.use-case.ts) |
| 채점 (grading) | ✅ | [grade-assignment.use-case.ts](../../backend/src/application/use-cases/map/grade-assignment.use-case.ts), [get-grading-queue.use-case.ts](../../backend/src/application/use-cases/map/get-grading-queue.use-case.ts) |
| 점수 조회 | ✅ | [get-portal-score-history.use-case.ts](../../backend/src/application/use-cases/map/get-portal-score-history.use-case.ts), [my/pages/scores-page.tsx](../../frontend-acm/src/modules/my/pages/scores-page.tsx) |
| **학생 응시 UI (test-taking app)** | ❌ | [map/pages/mpq-list-page.tsx](../../frontend-acm/src/modules/map/pages/mpq-list-page.tsx) — 관리자용 문제 목록만 존재. **학생이 직접 응시하는 화면 없음** |
| CSL 연동 | 🟡 | [inquiry.dto.ts](../../backend/src/modules/acm-csl/application/dto/inquiry.dto.ts) 의 `mptScheduledAt / mptHeldAt / mptScoreReading|Math|Language` — 상담사가 점수를 **수동 입력**하는 구조 |

**갭**: ① 학생/학부모가 응시하는 인터페이스 (CBT 또는 OMR 업로드) ② MAP assignment를 CSL inquiry와 자동 연결하는 로직 — 둘 다 부재.

---

### R3. 레벨 테스트 링크 발송 (2.2) — ❌ Missing

| 영역 | 상태 | 근거 |
|------|------|------|
| 토큰 발급 / unauthenticated invite | ❌ | grep 결과: `test.*link / invitation.*token / map.*invite` 0건 (백엔드 전체) |
| AmoebaTalk 발송 인프라 | ✅ | [amoebatalk-client.service.ts](../../backend/src/infrastructure/external/ama/notify/amoebatalk-client.service.ts), mock + 실서비스 클라이언트 양쪽 존재 |
| 알림 이벤트 정의 | ❌ | [NOTIFICATION_EVENTS](../../backend/src/application/notification/notification-context.types.ts#L23-L31)에 `LevelTestInvited` / `MapTestLinkSent` 류 이벤트 **정의되어 있지 않음** |
| 템플릿 | ❌ | `tac_notification_templates` 에 해당 `ntf_event` 키 부재 (CONSULTATION_RECEIVED, ENROLLMENT_CONFIRMED, PAYMENT_DONE, REFUND_DONE, MAP_SCORE, CLASS_ABSENT, TAX_INVOICE_APPROVED 7종만) |
| 비회원 응시 페이지 | ❌ | frontend-acm에 비회원용 시험 응시 경로 없음 — [router.tsx](../../frontend-acm/src/routes/router.tsx)는 RequireAuth 후 admin/my 영역만 |

**갭 전체**. 신규 설계 필요: ① 1회용 토큰 (e.g. `tac_map_invitation_tokens`) ② 토큰 검증 + 응시 페이지 ③ CSL 단계 진입 시 자동 발송 핸들러.

---

### R4. 진단 리포트 발송 — ❌ Missing

| 영역 | 상태 | 근거 |
|------|------|------|
| 점수 발행 이벤트 | ✅ | `tac.map.score.published` 이벤트 정의됨 ([notification-context.types.ts:28](../../backend/src/application/notification/notification-context.types.ts#L28)) |
| 점수 history 조회 | ✅ | [scores-page.tsx](../../frontend-acm/src/modules/my/pages/scores-page.tsx) |
| **리포트 템플릿/PDF 생성** | ❌ | grep: PDF/리포트 렌더링 코드 없음. `score_benchmarks` 비교는 가능하나 진단 코멘트/약점 분석 산출물 없음 |
| **자동 발송 핸들러** | ❌ | `MapScorePublished` 이벤트는 발행만 가능, 핸들러가 단순 알림톡 메시지 1건 발송에 한정. 첨부 리포트 / 링크 발송 없음 |

**갭**: 진단 리포트 산출 로직(레벨/취약 영역/추천 수업) + 렌더링 + 배포 채널(PDF/링크) 일체 미구현.

---

### R5. 진단 내용을 강사에게 수업 자료로 배포 — ❌ Missing

| 영역 | 상태 | 근거 |
|------|------|------|
| Teacher 도메인 | ✅ | [teacher.entity.ts](../../backend/src/infrastructure/database/entities/teacher.entity.ts), [use-cases/teacher/](../../backend/src/application/use-cases/teacher/) |
| 강사용 화면 | 🟡 | [frontend-acm/src/modules/tch/](../../frontend-acm/src/modules/tch/) 강사 마스터 관리 (행정용). **강사 본인 로그인 후 보는 수업 준비 대시보드 없음** |
| 진단→강사 자동 배포 | ❌ | MAP score → teacher 알림/링크 매핑 코드 없음 |
| 강사용 학생 프로파일 뷰 | ❌ | 강사 본인 시각의 학생 상세 페이지 없음 |

**갭 전체**. 강사 로그인 영역 자체가 **행정/마스터 관리** 위주 (관리자가 강사 정보를 편집)이고, 강사가 자기 수업 준비를 보는 영역 미구축.

---

### R6. 실시간 스케쥴 체크 + 슬롯 제안 (학부모-강사 더블체크) — 📐 Partial design

| 영역 | 상태 | 근거 |
|------|------|------|
| 클래스 시간표 데이터 | ✅ | [class-session.entity.ts](../../backend/src/infrastructure/database/entities/class-session.entity.ts), [use-cases/timetable/](../../backend/src/application/use-cases/timetable/) |
| 캘린더 모듈 | ✅ | [acm-cal 모듈](../../backend/src/modules/acm-cal/), 초청자 알림 인프라 존재 |
| acm-sch 스케쥴 모듈 | 🟡 | [acm-sch 모듈](../../backend/src/modules/acm-sch/) — 학교 정보/학년 밴드/공개 일정 위주. **수업 가능 슬롯 계산 / availability solver 부재** |
| **학부모 슬롯 선택 UI** | ❌ | 학부모 화면에 슬롯 picker 없음 |
| **강사 승인 워크플로우** | ❌ | 양방향 확정 로직 없음 (단방향 캘린더 초대만 존재) |

**갭**: 강사 가용 시간 × 교실 가용 × 학생 학교 시간표 교차 계산 알고리즘 + 2-step (학부모 제안 → 강사 승인 → 확정) 워크플로우 신규 필요.

---

### R7. 스케쥴-교육 명세서 — ❌ Missing

| 영역 | 상태 | 근거 |
|------|------|------|
| 설계 문서 | ❌ | docs/analysis/ + docs/design/ 전수 grep: "명세서 / specification / contract" 으로 묶이는 enrollment 산출 문서 부재 |
| 백엔드 UC | ❌ | [use-cases/enrollment/](../../backend/src/application/use-cases/enrollment/) — create / get / update-status 3개만, 산출물 생성 UC 없음 |
| 템플릿 엔진 | ❌ | 인보이스 발행 외 PDF/HTML 산출 엔진 없음 |

**갭 전체**. 설계부터 신규.

> 참고: `enrollment` 엔티티 자체는 존재하므로 데이터 소스는 있다. 다만 "교육 명세서"가 **무엇을 담아야 하는지** (수업 시간/요일/총 차시/총액/환불 정책 요약/시작·종료일/강사명 등)에 대한 정의가 부재.

---

### R8. 등록 결제 링크 자동 전송 + 완료 안내 — 🟡 Partial (결제 자체는 완성)

| 영역 | 상태 | 근거 |
|------|------|------|
| Toss Payments 클라이언트 | ✅ | [toss-payments.client.ts](../../backend/src/infrastructure/external/toss/toss-payments.client.ts), [toss-webhook.guard.ts](../../backend/src/presentation/guards/toss-webhook.guard.ts) |
| 결제 UC 일체 | ✅ | [use-cases/payment/](../../backend/src/application/use-cases/payment/) — create-order / confirm-payment / process-webhook / execute-refund / tax-invoice 등 11개 UC |
| 결제 ledger / receipt | ✅ | [pay-order.entity.ts](../../backend/src/infrastructure/database/entities/pay-order.entity.ts), [pay-ledger.entity.ts](../../backend/src/infrastructure/database/entities/pay-ledger.entity.ts) |
| 결제 완료 알림 | ✅ | `tac.payment.done` 이벤트 + 핸들러 ([notification-dispatcher.service.ts](../../backend/src/presentation/notification/notification-dispatcher.service.ts)) |
| Admin 결제 화면 | ✅ | [frontend-acm/src/modules/pay/](../../frontend-acm/src/modules/pay/) |
| 학부모 결제 페이지 | 🟡 | [my/pages/payments-page.tsx](../../frontend-acm/src/modules/my/pages/payments-page.tsx) — **조회 전용**, 결제 진행 위젯 없음 |
| **결제 링크 자동 발송 (CSL→Pay 자동 전이)** | ❌ | 현재 `ENROLLMENT_COUNSELING → PAYMENT` 단계 전이는 [InquiryWorkflowService](../../backend/src/modules/acm-csl/application/inquiry-workflow.service.ts)에서 **상담사 수동 호출** |

**갭**: 결제 인프라는 완비됐으나 ① 결제 링크(또는 학부모용 결제 위젯 URL) 자동 발송 트리거 ② CSL `ENROLLMENT_COUNSELING` 단계에서 명세서 확정 시 결제 단계로 자동 전이 — 둘 다 미구현.

---

### R9. 스케쥴 변동 요청 + 변경 가능 횟수 차감 — 🟡 Partial (데이터만)

| 영역 | 상태 | 근거 |
|------|------|------|
| 세션 수정 카운트 컬럼 | ✅ | [session.typeorm-entity.ts:97](../../backend/src/modules/acm-cls/infrastructure/typeorm/session.typeorm-entity.ts#L97) — `ses_modification_count INT DEFAULT 0` |
| 리스케쥴 설계 | 📐 | [acm-req-cls-001:496](../../docs/reference/acm-req-cls-001-class-mgmt-requirements.md#L496) — FR-CLS-S04 단일 세션 리스케쥴 모달 (status=RESCHEDULED + count 증가) |
| **변경 가능 횟수 정책 (max budget per enrollment/term)** | ❌ | 정책 데이터 컬럼/엔티티 없음 — `enrollment` 에 `reschedule_quota` 미정의 |
| **학부모 요청 워크플로우** | ❌ | 학부모가 변경 요청을 보내는 UI/API 없음 |
| **횟수 차감 알림** | ❌ | 알림 이벤트 정의 없음 |

**갭**: ① 정책(허용 횟수 / 기간 단위) 데이터 모델 신설 ② 학부모 요청 + 관리자 승인 UI ③ 차감 카운터 + threshold 알림.

---

## 4. 종합 매트릭스 (Summary Matrix)

| # | 요구사항 | 설계 | 백엔드 | 프론트 (Admin) | 프론트 (학부모) | 알림/자동화 | 종합 |
|---|---------|:---:|:------:|:--------------:|:---------------:|:-----------:|:----:|
| R1 | Programs 카탈로그 | ✅ | ✅ | ✅ | 🟡 정적 | — | 🟡 |
| R2 | MAP 진단 | ✅ | ✅ | ✅ 관리 | ❌ 응시 UI | 🟡 점수 알림 | 🟡 |
| R3 | 테스트 링크 발송 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| R4 | 진단 리포트 발송 | ❌ | ❌ | ❌ | 🟡 history | 🟡 이벤트만 | ❌ |
| R5 | 강사 자료 배포 | ❌ | ❌ | ❌ | n/a | ❌ | ❌ |
| R6 | 슬롯 제안 더블체크 | 📐 일부 | 🟡 데이터만 | ❌ | ❌ | ❌ | ❌ |
| R7 | 교육 명세서 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| R8 | 결제 링크 + 완료 알림 | ✅ | ✅ | ✅ | 🟡 조회 | 🟡 결제완료만 | 🟡 |
| R9 | 변경 횟수 차감 | 📐 일부 | 🟡 컬럼만 | ❌ | ❌ | ❌ | ❌ |

**점수 합산** (✅=2, 🟡=1, ❌=0):
- 설계: 7 / 18
- 백엔드: 7 / 18
- 알림 인프라 활용도: 2 / 18
- **퍼널 자동화 종합: 약 30%**

---

## 5. 오케스트레이션 갭 (Funnel Wiring Gap)

설령 R1–R9가 개별 모듈로 완성되더라도 **하나의 자동화 흐름**으로 묶이려면 다음이 추가로 필요하다.

### 5.1 자동 전이 (Auto-transition)
현재 [InquiryWorkflowService](../../backend/src/modules/acm-csl/application/inquiry-workflow.service.ts#L20-L28) 의 6단계는 **모두 상담사 호출 의존**. 자동 전이 후보:
- `INTAKE` 생성 시 → MAP 테스트 링크 자동 발송 → `MAP_TEST` 자동 진입
- 점수 publish 시 → 진단 리포트 자동 발송 → `TRIAL_CLASS` 후보 슬롯 제안
- 결제 완료 webhook 수신 시 → `CLASS_STARTED` 자동 진입

### 5.2 학부모 self-service 경로
학부모가 비로그인 상태에서도 진입 가능한 토큰 기반 경로 필요:
- `/invite/map/:token` — 테스트 응시
- `/invite/schedule/:token` — 슬롯 선택
- `/invite/pay/:token` — 결제 위젯
- `/invite/reschedule/:token` — 변경 요청

### 5.3 강사 자동 통지
강사 로그인 영역(`/teacher/*`)에 신규 학생 진단 결과 자동 푸시. 현재 강사 self-view 영역 자체 부재.

### 5.4 알림 이벤트 확장
현 7종에서 다음 6종 추가 필요:
- `LevelTestInvited` (R3)
- `DiagnosticReportSent` (R4)
- `TeacherPrepReady` (R5)
- `ScheduleSlotProposed` / `ScheduleSlotConfirmed` (R6)
- `PaymentLinkSent` (R8 보강)
- `RescheduleQuotaWarning` / `RescheduleApproved` (R9)

---

## 6. 권장 후속 작업 (Recommendations)

### 6.1 즉시 PRD 작성 대상
| 우선순위 | 항목 | 사유 |
|---------|------|------|
| P0 | R3 + R4 결합 PRD (테스트 초대 → 응시 → 리포트 자동 발송) | 학부모 self-service 시작점. R2 인프라 활용 가능 |
| P0 | R6 슬롯 제안 + R7 명세서 결합 PRD | R8 결제로 가는 직전 단계, 명세서 없이는 결제 자동화 불가 |
| P1 | R8 자동 결제 링크 트리거 PRD | 결제 인프라는 완비, 트리거만 보강 |
| P1 | R5 강사 self-view 도메인 신설 PRD | 강사 로그인 영역 자체 신설 필요 |
| P2 | R9 변경 횟수 정책 PRD | 운영 진입 후 발생, 초기 MVP 후순위 |

### 6.2 인프라 작업
- [ ] `tac_invitation_tokens` 테이블 신설 (R3, R6, R8 공통)
- [ ] `NOTIFICATION_EVENTS` 에 6종 이벤트 추가 + 템플릿 시드
- [ ] CSL `InquiryWorkflowService` 에 자동 전이 hook (`onStageEntered` 패턴)
- [ ] 강사 인증 + `/teacher/*` 라우트 신설

### 6.3 의사결정 필요 사항 (Open Questions)
1. **테스트 응시 형태**: CBT(브라우저 응시) vs OMR 업로드 vs PDF + 학원 방문 응시 — 현 데이터 모델(`map-response.entity.ts`)은 응답 단위 저장 가능하나 응시 채널 미정.
2. **R7 명세서 법적 위상**: 단순 안내문 vs 학원법상 계약서 — 후자라면 전자서명/PDF 보관 요구 추가.
3. **R6 더블체크 방식**: 동기(실시간 양쪽 동시 확인) vs 비동기(제안 → 응답 대기) — 후자가 구현 단순, 전자가 UX 우수.
4. **R9 변경 횟수 정책 단위**: 학기 단위 / 등록 단위 / 월 단위 — 환불 정책과 정합성 필요.

---

## 7. 참조 문서

- [academy-management-requirements.md](../analysis/academy-management-requirements.md) — v1.3 전체 요구사항
- [acm-v1.0a-fn-csl-001.md](../design/acm-v1.0a-fn-csl-001.md) — CSL 상담 파이프라인 설계
- [acm-req-cls-001-class-mgmt-requirements.md](../reference/acm-req-cls-001-class-mgmt-requirements.md) — 수업 관리 (FR-CLS-S04 리스케쥴)
- [PLN-260519-frontend-acm-consolidation.md](../plan/PLN-260519-frontend-acm-consolidation.md) — 프론트 통합 (현 영향 없음)
- [notification-context.types.ts](../../backend/src/application/notification/notification-context.types.ts) — 현 7종 알림 이벤트 정의

---

**리포트 작성**: Claude (Opus 4.7)
**검증 방법**: docs/ 전수 grep + backend/src + frontend-acm/src 디렉토리 트리 점검 + 핵심 파일 직접 열람.
**한계**: 본 리포트는 정적 코드/문서 점검 기반. 실제 동작 검증(E2E 시나리오 실행)은 포함하지 않음.
