---
document_id: ACM-REVIEW-001
version: 1.0.0
status: Draft
date: 2026-04-26
author: Implementation Review
scope: ACM v1.0a (CSL/REF/SCH/QNA/DSH) + i18n
---

# ACM v1.0a 구현 갭 분석 보고서 (Implementation Gap Review)

> 현재 Stage 3 스캐폴드 코드가 `docs/reference/acm-req-*` 명세를 어디까지 만족하는지, 어디가 누락 / 단순화 / 잘못 구현되었는지 평가한다.

---

## 1. 요약 (Executive Summary)

| 항목 | 상태 | 우선순위 |
|---|---|---|
| **i18n** (NFR-016, C-006) | ❌ 미적용 (패키지만 설치, 초기화 0건) | **P0 — 차단** |
| **CSL F-01..F-25** (TPI Master "신규" 시트 25개 컬럼) | ⚠️ 8/25 매핑 (32%) — 핵심 필드 17개 누락 | **P0 — 차단** |
| **CSL 6단계 파이프라인 상태머신** | ❌ 4단계 단순 ENUM (ACTIVE/ENROLLED/...) — 6단계 미구현 | **P0** |
| **REF per-update versioning** | ✅ 단일 테이블 1차 구현 — 3개 리소스 분리 미반영 | **P1** |
| **REF cgd_workflow_steps**, **lvl_*, sbm_*** | ❌ 모두 단일 `reference` 테이블로 합침 | **P1** |
| **QNA dual-tone + FAQ promotion** | ✅ 1차 구현 — `qna_resolution_status` 누락 | **P2** |
| **DSH 21개 일별 KPI** | ❌ 단순 snapshot — `metric_definitions` + `manual_inputs` 미구현 | **P1** |
| **CLS 모듈 전체** | ❌ 미생성 (v1.0b 범위지만 스캐폴드도 없음) | P2 (v1.0b) |
| **AMA Core 인증/엔티티 통합** | ❌ Mock JWT만 (실 통합 미구현) | P0 (배포 차단) |

**총평**: 현재 코드는 **명세의 약 25%**를 반영한 스켈레톤. CSL 모듈은 사실상 **재설계 + 재구현** 필요.

---

## 2. i18n 다국어 (NFR-016, C-006)

### 2.1 요구사항
- **NFR-016**: 한국어(default) / 영어 / 베트남어 (3개 언어, Amoeba §14)
- **C-006**: **모든 UI 텍스트는 i18n 통과 — 하드코드 금지**

### 2.2 현재 상태
- frontend-acm/package.json: `react-i18next@14`, `i18next@23` 설치됨 ✅
- **`i18next.init()` 호출 0건** ❌
- `t('...')` 사용 0건 ❌
- 리소스 파일 (`locales/ko/*.json` 등) 없음 ❌
- `App.tsx`, 5개 module 페이지, `csl-create-dialog.tsx` 모두 한/영 문자열 하드코딩

### 2.3 미적용 사례
```tsx
// frontend-acm/src/modules/csl/pages/csl-list-page.tsx
<h1 className="text-2xl font-semibold">New Counseling</h1>     // ❌ 하드코드
<th className="text-left px-4 py-3">Student</th>               // ❌ 하드코드

// csl-create-dialog.tsx
<DialogTitle>New Inquiry (신규 상담)</DialogTitle>             // ❌ 한/영 동시 하드코드
```

### 2.4 필요 작업 (P0)
1. `src/i18n/index.ts` 부트스트랩 (resources, lng:'ko', fallbackLng:'ko')
2. `src/i18n/locales/{ko,en,vi}/{common,csl,ref,sch,qna,dsh,validation}.json` 생성
3. `main.tsx`에서 `import './i18n'` (사이드 이펙트 임포트)
4. 모든 페이지 + 컴포넌트에서 `useTranslation()` + `t(key)` 적용
5. ESLint rule (e.g., `i18next/no-literal-string`) 도입 권장
6. **언어 전환 UI** (Header drop-down 또는 Settings)
7. Backend는 NFR-016 §UI 한정이므로 API 응답은 **ENUM key + 코드만 반환**, 표시 라벨은 FE에서 변환

---

## 3. CSL — TPI Master "신규" 시트 25개 컬럼 매핑

### 3.1 명세 (acm-req-csl-001 §2.4)

```
시트 컬럼 (C1~C25) → DB 필드 → Stage Pipeline (6단계)
INTAKE → MAP_TEST → TRIAL_CLASS → ENROLLMENT_COUNSELING → PAYMENT → CLASS_STARTED
```

### 3.2 매핑 표 (현재 vs 명세)

| F-id | 시트 컬럼 | 명세 필드 | 현재 구현 | 상태 |
|---|---|---|---|---|
| F-01 | No. | `inq_seq_no` (per-tenant auto-inc) | ❌ UUID만 | 누락 |
| F-02 | 등록일 | `inq_registered_at` | ✅ `createdAt` | 명칭만 다름 |
| F-03 | Follow-up 연락일 | `inq_followup_at` + `inq_followup_memo` | ❌ | **누락** |
| F-04 | 이름 | `inq_name` + `inq_is_anonymous` | ⚠️ `studentName`만 (anonymous flag 없음) | 부분 |
| F-05 | 전화번호 | `inq_phone_encrypted` + `inq_phone_status` (DECLINED 처리) | ⚠️ 암호화는 OK, status enum 없음 | 부분 |
| F-06 | 유입 유형 | `inq_inflow_type` ENUM (HOMEPAGE/KAKAO_CHANNEL/PHONE) | ⚠️ `channel`로 명명 + 값 enum 미정의 | 부분 |
| F-07 | 신청 유형 | `inq_apply_type` ENUM (COUNSELING_ONLY/EXAM_ONLY/BOTH) — Q-CSL-009 | ❌ | **누락** |
| F-08 | 신청 목적 | `inq_apply_purpose` ENUM (4 + OTHER) | ❌ | **누락** |
| F-09 | 상담 수행 | `inq_consult_done` ENUM (YES/NO) | ❌ | **누락** |
| F-10 | 기존 맵점수? | `mpt_has_prior_score` BOOLEAN | ❌ | **누락** |
| F-11 | 맵 응시료 | `mpt_fee_status` (PAID/UNPAID/WAIVED) + `mpt_waiver_*` | ❌ | **누락** |
| F-12 | 맵 예약일 | `mpt_scheduled_at` + `mpt_scheduled_status` | ❌ | **누락** |
| F-13 | 맵 점수 R/M/L | `mpt_score_reading/math/language` | ❌ | **누락** |
| F-14 | 체험 수업일 | `tcl_held_at` (별도 테이블 `csl_trial_classes`) | ❌ | **누락** |
| F-15 | 피드백 | `tcl_feedback_status` ENUM | ❌ | **누락** |
| F-16 | 수납 안내 | `enr_payment_notice_status` | ❌ | **누락** |
| F-17 | 수강 상담 | `enr_counsel_done` | ❌ | **누락** |
| F-18 | 수강 신청 | `enr_applied` | ❌ | **누락** |
| F-19 | 수납 안내 발송 | `enr_payment_notice_sent` | ❌ | **누락** |
| F-20 | 수강 시간 | `enr_class_minutes` (e.g., "120분" 파싱) | ❌ | **누락** |
| F-21 | 교육비 | `enr_tuition_amount` DECIMAL(12,0) | ❌ | **누락** |
| F-22 | 교육비 납부 | `enr_tuition_paid` (senior manager 권한 필요) | ❌ | **누락** |
| F-23 | 수강 시작일 | `cls_started_at` | ❌ | **누락** |
| F-24 | 수강 시작 | `cls_started` ENUM — **CLS 모듈 트리거** (ADR-001-A1) | ❌ | **누락** |
| F-25 | 비고 | `csl_remarks` 1:N append-only | ✅ `RemarkTypeormEntity` | OK |

**커버리지: 8/25 (32%)** — 핵심 17개 필드 누락.

### 3.3 Stage 파이프라인 갭

| 명세 (6단계) | 현재 (4단계) |
|---|---|
| INTAKE | ❌ — 매핑 안됨 |
| MAP_TEST | ❌ |
| TRIAL_CLASS | ❌ |
| ENROLLMENT_COUNSELING | ❌ |
| PAYMENT | ❌ |
| CLASS_STARTED | ❌ |
| (DROPPED) | ✅ |
| → 현재 ACTIVE / ENROLLED / NOT_ENROLLED / SUSPENDED / DROPPED | 명세와 무관한 자체 enum |

**해결 필요**: `inq_current_stage` ENUM으로 재설계 + 각 stage 진입 조건(§3.2 stage gate) 구현.

### 3.4 분할 테이블 누락

명세 ERD (§2.4):
```
amb_acm_csl_inquiries        ← 주 테이블
amb_acm_csl_map_tests        ← MAP_TEST stage 데이터
amb_acm_csl_trial_classes    ← TRIAL_CLASS stage 데이터
amb_acm_csl_enrollments      ← ENROLLMENT~PAYMENT stage
amb_acm_csl_remarks          ← ✅ 구현됨
```
**현재**: `consultation` 단일 테이블에 모든 필드 압축. 분리 필요.

---

## 4. REF — Reference Materials

### 4.1 명세 (acm-req-ref-001 §2)
3개 독립 리소스, 각각 per-update versioning:
1. **Class Guidelines** (`cgd_*`) — `수업별 가이드라인` 시트, workflow steps 1:N (자식 테이블)
2. **MAP/Exam Levels** (`lvl_*`) — `시험별 적정 점수대`, NWEA 100-300 레벨 정의
3. **School Benchmarks** (`sbm_*`) — 학교별 입학 기준

각 테이블 공통:
- `*_version_no INT`, `*_effective_from DATE`, `*_effective_to DATE`, `*_supersedes_id UUID`

### 4.2 현재 구현
- 단일 `amb_acm_ref_reference` 테이블 ✅ (versioning 패턴은 OK)
- **3개 리소스 분리 안됨** ❌
- `cgd_workflow_steps` (가이드라인 워크플로우 1:N) 미구현
- `lvl_*` (NWEA 점수대) 도메인 모델 없음
- `sbm_*` (학교 벤치마크) 도메인 모델 없음

### 4.3 영향
- CSL F-13 (MAP 점수) 입력 시 LVL 자동 매핑 불가
- SCH 학교 선택 시 SBM 벤치마크 표시 불가 (`Gap Analysis` 기능 차단)

---

## 5. SCH — School Master

### 5.1 명세
- 학교 마스터 + autocomplete (pg_trgm)
- CSL `schoolFreetext` 입력 시 후보 제시 → 정규화 추천

### 5.2 현재
- `amb_acm_sch_school` 테이블 + autocomplete 엔드포인트 ✅
- pg_trgm GIN 인덱스 ✅
- **시드 데이터 없음** — 운영 시작 시 비어있어 freetext fallback만 동작

### 5.3 누락
- 시드 SQL (`docs/reference/[TPI] Master.xlsx › 학교입학 정보` 시트 → import 스크립트)
- CSL 폼에서 SCH autocomplete 통합 (현재 freetext만)

---

## 6. QNA — Regular Counseling

### 6.1 명세 (acm-req-qna-001 §2)
- `qna_status` ENUM: **OPEN / RESPONDED / RESOLVED / ESCALATED / DEFERRED**
- `qna_resolution_status` ENUM: **CONFIRMED_RESOLVED / UNCONFIRMED / UNSATISFIED / NA** (FAQ promotion gate)
- `qna_response_status` ENUM: **DRAFT / INTERNAL_ONLY / EXTERNAL_READY / DELIVERED** (dual-tone gate)
- FAQ visibility: ADVISOR_ONLY / ALL_USER / INCLUDE_TEACHER

### 6.2 현재
- 상태머신: OPEN→RESPONDED→RESOLVED/ESCALATED/CLOSED ⚠️ (DEFERRED 누락, CLOSED는 명세에 없음)
- `qna_resolution_status` ❌ 누락
- `qna_response_status` ❌ 누락 (DRAFT/EXTERNAL_READY/DELIVERED 라이프사이클 없음)
- FAQ visibility 3-way ❌ 단순 boolean만

---

## 7. DSH — Dashboard

### 7.1 명세 (acm-req-dsh-001 §1.4 ~ §2.4)
- **21개 일별 KPI** (Marketing/CS/Operating/Class 4 카테고리)
- 테이블 3종:
  - `amb_acm_dsh_metric_definitions` — 메트릭 레지스트리 + `met_aggregation_type` (SUM_ONLY / AVG_ONLY / SUM_AND_AVG / LAST_VALUE)
  - `amb_acm_dsh_daily_kpi` — 일별 스냅샷 (1 row/day/Entity)
  - `amb_acm_dsh_manual_inputs` — Marketing/Complain 수동 입력
- **Status vs Count 구분** (§1.4 critical insight): 학생수/교사수는 day-end state — Monthly Sum row는 **마지막 날 값**

### 7.2 현재
- 단일 `amb_acm_dsh_kpi_snapshot` 테이블 ⚠️
- metric_definitions / manual_inputs 테이블 ❌
- `met_aggregation_type` 분류 없음 ❌
- 21개 메트릭 정의 ❌ (cron job stub만 존재)
- Marketing 수동 입력 UI 없음 ❌

---

## 8. CLS — Class Management (v1.0b 범위)

### 8.1 명세 (acm-req-cls-001)
- 수업 일정, 회차 occurrence, 출결, 보강, 화상 (Google Meet/Bodaschool), Google Calendar one-way push, 강사 정산
- Source: `수업_확인표_*.xlsx` (per-teacher, 15 monthly sheets exemplar)

### 8.2 현재
- **모듈 자체 미생성** ❌
- ADR-001-A1에 따른 `CSL F-24 cls_started=YES → CLS.SCHEDULE_INITIATED` 이벤트 트리거 미구현

### 8.3 평가
v1.0a 범위는 아니지만, CSL F-23/F-24 구현 시 **이벤트 명세만이라도** 미리 정의 필요 (event interface 스텁).

---

## 9. AMA Core 통합 (acm-req-001 §C-006 등)

### 9.1 요구
- AMB 상속: 멀티테넌시(`ent_id`), 인증, ACL Policy, KMS, Task/Issue
- 사용자 5단계 권한 (`USER_LEVEL`, `teacher`, `advisor`, `team_lead`, `admin`)

### 9.2 현재
- `OwnEntityGuard`만 구현 ✅ (req.user.entId 강제)
- **JWT 검증 미구현** ❌ — `AcmCurrentUser` 데코레이터는 req.user를 신뢰만 함
- AMB JWT/OAuth 통합 ❌
- AMB ACL Policy 매핑 ❌ — 현재 Controller 레벨 RBAC `user.roles.includes('admin')` 단순 체크
- KMS 통합 ❌ — `ACM_PII_KEY`를 환경 변수에 평문 저장 (NFR-005 위반)

---

## 10. 권장 조치 (Priority Plan)

### P0 (배포 차단 — 즉시)
1. **i18n 부트스트랩** — `src/i18n/index.ts` + `locales/{ko,en,vi}` + 모든 페이지 t() 적용
2. **CSL 재설계 v1** — 6단계 stage ENUM + F-01~F-25 필드 + 분할 테이블 (inquiries / map_tests / trial_classes / enrollments) + Q-CSL-009 ENUM 적용
3. **AMB JWT Guard** — Mock 인증 제거, AMB 토큰 검증 미들웨어 구현
4. **KMS 통합** — `ACM_PII_KEY`를 AMB KMS API에서 fetch (per-tenant rotation)

### P1 (베타 차단)
5. **REF 3-resource 분리** — Guidelines / Levels / Benchmarks + workflow_steps 자식 테이블
6. **DSH 21 metric registry** + manual_inputs 테이블 + cron 실제 구현
7. **SCH 시드 import** — 학교입학 정보 시트 → INSERT SQL
8. **QNA 상태머신 보강** — DEFERRED 추가, `resolution_status` + `response_status` 도입

### P2 (정식 출시 전)
9. **CLS 모듈 신설** (v1.0b)
10. **AMB ACL Policy** 통합
11. **CSL F-24 → CLS 이벤트 핸드오프** 명세화

### P3 (개선)
12. CSL `inq_seq_no` per-tenant auto-increment (sequence별도 또는 trigger)
13. ESLint i18n 강제 룰
14. Integration test IT-01..IT-12 모두 구현

---

## 11. 통계

| 모듈 | 명세 필드 수 | 구현 필드 수 | 커버리지 |
|---|---|---|---|
| CSL | 25 (+ stage state machine) | 8 | **32%** |
| REF | ~35 (3 resources × 10+ fields) | 8 (single table) | **23%** |
| SCH | 8 + autocomplete + seed | 8 | **80%** (seed 제외) |
| QNA | 12 (3 ENUMs) | 6 (1 ENUM) | **50%** |
| DSH | 21 metrics + 3 tables | 1 table, 0 metrics | **5%** |
| **i18n** | 3 langs × N keys | **0** | **0%** |
| **AMA Core** | JWT + ACL + KMS | OwnEntityGuard만 | **15%** |

**전체 평균: ~25%**

---

## 12. 다음 단계 제안

권장 순서:
1. **i18n 부트스트랩** (반나절) — 모든 후속 UI 작업의 기반
2. **CSL 모듈 재설계** (1~2주) — F-01~F-25 + 6단계 + 4개 분할 테이블 + 상세 폼/리스트 UI 재구현
3. **REF 3-resource 분리** (3일)
4. **AMB 인증/KMS 통합** (2~3일, AMB SDK 의존)
5. **DSH 21 metric** (1주)

> 본 보고서는 검토 단계이며, 사용자 진행 지시 후 단계별 작업 계획서(WBS + ASCII 와이어프레임 포함)를 별도로 작성한다.

_End of ACM-REVIEW-001 v1.0.0._
