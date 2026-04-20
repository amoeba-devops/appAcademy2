---
document_id: ACADEMY-REQ-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-19
updated: 2026-04-19
author: 김익용
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-04-19
    author: 김익용
    description: Initial draft — academy management system requirements
  - version: 1.1.0
    date: 2026-04-19
    author: 김익용
    description: |
      Supplemented with Question Bank (MAP), Class Timetable, and Student Master Extensions modules (FR-021~FR-038).
      Added NFR-009 (Content Integrity), NFR-010 (Data Migration).
      Added constraints C-005~C-006, assumptions A-005~A-008, metrics for timetable/MAP/migration, open questions Q-006~Q-013.
      Reinforced Teacher=AMA Client 1:1 binding. Grounded in TPI xlsx / 수업 확인표 xlsx / MAP RC Basic PDF reference files.
  - version: 1.2.0
    date: 2026-04-19
    author: 김익용
    description: |
      Rebranded to **Trinity Academy** — codename finalized, heraldic brand system adopted for the main portal (reference: trinityacademy.kr / imweb.me/contact / imweb.me/test).
      **Payment scope reversal**: Trinity Pay now in-scope as an internal module (C-003 revised); AMA is **not** involved in settlement. Added FR-039~FR-042 (payment/refund/receipt/ledger) and NFR-011 (PCI-DSS).
      **Frontend stack**: Vue.js → **React 18 + Next.js App Router (shared portal + admin console)** (C-004 revised).
      Trinity Academy main portal scope added (Home / About / Programs / MAP Test / Contact / News) as FR-043~FR-046.
      Added constraints C-007 (brand system), assumptions A-009 (PG direct integration), metrics for payment success rate, open questions Q-014~Q-017.
  - version: 1.3.0
    date: 2026-04-19
    author: 김익용
    description: |
      **Trinity Pay open decisions closed**:
      - Q-014 → **Toss Payments** 선정 (SDK `@tosspayments/payment-sdk` + Payment Webhook v2).
      - Q-015 → 환불 규정을 **수업일(회차) 경과 기준**으로 확정하며, 기본값은 **학원법 시행령 제18조** 3단계 (교습 개시 전 100% / 1/3 경과 전 2/3 / 1/2 경과 전 1/2 / 이후 0%). 학원 자체 오버라이드 가능하도록 `refund_policies` 버전 관리 테이블로 설계.
      - Q-018 → **세금계산서 자체 발행** 확정. 국세청 홈택스 **전자세금계산서 발급 API** 직접 연동(공인 공동인증서 기반), 팝빌/바로빌 등 SaaS 중계 미채택.
      Added FR-047 (Refund Policy Admin), FR-048 (Tax Invoice Issuance), NFR-013 (학원법·전자세금계산서법 준수), assumptions A-011~A-013.
      FR-040/041/042 의 PG·환불·영수증 문구를 위 결정에 맞춰 구체화.
---

# Trinity Academy — Management System Requirements Analysis (트리니티 아카데미 관리 솔루션 요구사항 분석서)

## 1. Project Overview (프로젝트 개요)

- **Project**: Trinity Academy Management System (트리니티 아카데미 통합 운영 솔루션)
- **Codename**: **Trinity Academy** (ko: 트리니티 아카데미) — 브랜드 공식 명칭
- **Brand Motto**: OMNIBUS OMNIA (1 Cor 9:22) — 학원 정체성/헤럴딕 엠블럼 기반
- **Version**: v1.3 (Trinity Pay 결정 확정 — Toss Payments · 수업일 기준 환불 · 자체 세금계산서)
- **Date**: 2026-04-19
- **Main Portal**: https://trinityacademy.kr/ (Home / About / Programs / MAP Test / Contact / News)
- **Legacy Sub-sites (참조)**: https://trinityacademy.imweb.me/contact · https://trinityacademy.imweb.me/test
- **Background and Purpose (배경 및 목적)**:
  - Trinity Academy는 학부모 상담, 학생/교사 등록, 프로그램 기획, MAP 시험 운영을 **imweb 기반 사이트 + 엑셀(TPI/수업 확인표)** 로 분산 운영해왔다.
  - 하나의 플랫폼에서 **학부모 대면 포털(트리니티아카데미 메인 사이트) + 운영 콘솔(학원장/행정/교사)** 을 통합하고, **프로그램 설계 → 상담 → 학생/학부모 등록 → 수업시간표 운영 → 수강 → 결제 → MAP 평가** 전 과정을 end-to-end로 관리한다.
  - 교사 정보는 Amoeba AMA(아메바에이아이)에 **거래처(Client)로 등록**되어 있으므로 AMA와 1:1 참조 연동하여 중복 입력을 제거한다 (교사 마스터 단일 진실 원천 = AMA Client).
  - **결제·정산은 Trinity Academy 메인 사이트에서 자체 처리**한다 (PG 직결). AMA는 결제에 관여하지 않으며, 교사 마스터 참조·알림(AmoebaTalk) 용도로만 연동한다.
  - 기존 PDF 기반 MAP 문제은행을 디지털화하여, 학생 학년/영역(RC/Math/Language)별로 문제를 관리하고 배정·채점한다.
- **Expected Benefits (기대 효과)**:
  - 상담-등록-수강-결제-수료 전환율(funnel conversion) 가시화
  - 학부모-학생-수강-결제-성적 관계의 단일 진실 원천(Single Source of Truth)
  - AMA 거래처 정보 재활용으로 교사 관리 공수 감소
  - 엑셀(TPI 학생 정보 / 수업 확인표) 대체 — 학생 정보·수업 진행·MAP 성적을 통합 조회
  - 문제은행(MAP) 디지털화로 시험 생성·배정·채점·리포트 자동화
  - **브랜드 일관성(Trinity Heraldic Identity)** 을 적용한 학부모 대면 포털로 신뢰도·유입 제고

## 2. Stakeholders (이해관계자)

| Role | Person/Team | Responsibility |
|------|-------------|----------------|
| Product Owner | 학원 운영팀 | Scope 결정, 우선순위 |
| Academy Manager (학원장) | End user | 프로그램 기획, 운영 전반, 커리큘럼/교재 관리 |
| Academy Staff (행정 직원) | End user | 상담 접수, 등록/수납 처리, 시간표 관리, TPI 학생정보 관리 |
| Teacher (교사) | Secondary user | 담당 스케줄 조회, 출결/수업시간 기록, MAP 문제 출제·채점 — **AMA Client로 관리됨 (1:1 참조)** |
| Parent (학부모) | External user | 상담 신청, 자녀 등록, 수강 신청, 자녀 시간표/성적 조회(향후) |
| Student (학생) | Subject | 수강 주체, MAP 시험 응시 — 시스템 직접 사용은 Phase 2 [TBD] |
| AMA Integration | External system | 교사 마스터 데이터 제공 (Client = 거래처) |
| Content Editor (콘텐츠 담당) | Internal | MAP 문제은행 업로드·태깅·검수 |
| Development Team | KR-VN dist. | 설계/구현/테스트 |

## 3. Requirements (요구사항 목록)

### 3.1 Functional Requirements (기능 요구사항)

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-001 | Program CRUD — 학원 운영자는 학원 프로그램(커리큘럼 템플릿)을 등록/수정/삭제/조회할 수 있다 | P0 | |
| FR-002 | Program Setting — 프로그램별 수강료, 기간, 정원, 권장 연령/레벨, 커리큘럼 메타 설정 | P0 | |
| FR-003 | Program Catalog — 학부모에게 공개 가능한 프로그램 카탈로그 뷰 제공 | P1 | |
| FR-004 | Consultation Intake — 학부모의 프로그램 상담 요청 접수 (온라인/전화/방문) | P0 | 채널 [TBD] |
| FR-005 | Consultation Record — 상담 내역(문의 프로그램, 관심도, 예산, 자녀 정보 초안) 기록 | P0 | |
| FR-006 | Visit Record — 학원 방문 일시/목적/담당자/결과를 이력으로 누적 관리 | P0 | |
| FR-007 | Parent Registration — 학부모 계정/인적 정보 등록 (연락처, 이메일, 선호 채널) | P0 | |
| FR-008 | Student Registration (TPI) — 학생 등록, **반드시 학부모와 연결**(1 Parent : N Student). TPI 항목 포함: 이름, 성별, 생년월일, 연락처, 학교, 학년, 거주지, 담당 강사, 커리큘럼, 수업 교재, 수업 스케줄, 특이사항 | P0 | FR-007 선행, TPI xlsx 필드 기반 |
| FR-009 | Teacher Registration — 교사 등록 시 **AMA Client ID를 필수 참조**하여 등록. 본 시스템은 교사 마스터 데이터를 중복 저장하지 않는다 | P0 | AMA 연동 필수 |
| FR-010 | Teacher Sync — AMA Client 정보 변경 시 교사 정보 자동 동기화 | P1 | Webhook/Polling [TBD] |
| FR-011 | Class Creation — 프로그램에서 구체 강의(개설 반)를 생성 (담당 교사, 요일/시간, 강의실, 회차 수) | P0 | |
| FR-012 | Teacher Schedule — 교사별 담당 강의/회차 캘린더 조회 | P0 | |
| FR-013 | Schedule Conflict Check — 교사·강의실·시간대 중복 개설 방지 | P1 | |
| FR-014 | Enrollment — 학부모가 자녀(학생)를 특정 강의(Class)에 수강 등록할 수 있다 | P0 | FR-008, FR-011 선행 |
| FR-015 | Enrollment Status — 수강 상태(대기/확정/취소/수강중/수료) 라이프사이클 관리 | P0 | |
| FR-016 | Attendance — 강의 회차별 학생 출결 체크 (출석/결석/지각/조퇴) + 수업 소요시간·비고 기록 | P1 | 수업 확인표 엑셀 대체 |
| FR-017 | Consultation → Enrollment Conversion — 상담 건을 실제 등록으로 전환하는 기능 | P1 | 전환율 측정 |
| FR-018 | Dashboard — 학원장/행정 직원에게 상담·등록·수강·출석·MAP 성적 KPI 대시보드 제공 | P2 | |
| FR-019 | Notification — 등록/수강/결제/시험 결과 변경 시 학부모 알림 (AmoebaTalk 연동 가능) | P2 | [TBD] |
| FR-020 | Audit Log — 주요 데이터(등록/삭제/수강 취소/성적 수정) 변경 이력 감사 로그 | P1 | |

#### Question Bank — MAP (문제은행 — MAP 관리) {FR-021~FR-028}

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-021 | MAP Question CRUD — 콘텐츠 담당자가 MAP 문제(문항)를 등록/수정/삭제/조회한다 | P0 | RC(Reading Comprehension), Math, Language 영역 |
| FR-022 | MAP Taxonomy — 문제 분류 체계: **영역**(RC/Math/Language), **학년**(G2~G5 등), **난이도**(Basic/Intermediate/Advanced), **유형**(단일선택/다중선택/Part A-B 복합형), **주제/스킬**(main idea, vocabulary, inference 등) | P0 | MAP PDF 분석 기반 |
| FR-023 | Passage Support — 독해 문제는 **지문(passage)** 과 문항(item)을 분리 저장. 한 지문에 여러 문항 연결(1 Passage : N Items). Passage 1/2 대비 문항도 지원 | P0 | RC PDF 구조 반영 |
| FR-024 | Question Item Structure — 문항 필드: 질문문, 보기(1~4 or 1~5), 정답(복수 가능), 해설, 배점, 태그 | P0 | |
| FR-025 | Test Set Composition — 여러 문항을 묶어 시험지(Test Set)를 구성. 고정 배열 또는 조건 기반 자동 생성(영역·학년·난이도 필터) | P0 | |
| FR-026 | Test Assignment — 특정 Class 또는 학생에게 Test Set 배정, 응시 기한 설정 | P1 | |
| FR-027 | Grading & Results — 응시 결과 자동 채점, 문항별 정오표, 영역별 점수 산출, 학생별 MAP 점수(Reading/Math/Language) 이력 누적 | P1 | TPI의 MAP TEST 컬럼 대체 |
| FR-028 | Question Versioning — 문제 수정 시 이전 버전 보존, 기 배정된 시험지의 문항은 스냅샷 유지 | P1 | 성적 추적 일관성 |

#### Class Timetable (수업시간표) {FR-029~FR-033}

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-029 | Timetable — Academy View — 요일×시간 그리드로 학원 전체 수업시간표 조회 (강의실별/교사별 필터) | P0 | |
| FR-030 | Timetable — Teacher View — 교사별 주간/월간 시간표. 색상 코드(진행/결강/보강)로 상태 표시 | P0 | 수업 확인표 엑셀의 색상 규약 반영 |
| FR-031 | Timetable — Student View — 학생별 개인 시간표 (등록된 모든 Class의 회차 통합 뷰) | P1 | 학부모 포털(향후) 선행 요건 |
| FR-032 | Session Record — 회차별 **날짜·실제 수업 시간(시간 단위, 예: 1.5h/2.0h)·비고(결강 사유, 보강 메모)** 기록 | P0 | 수업 확인표 엑셀 구조 |
| FR-033 | Makeup Session — 결강 회차에 대한 보강(Makeup) 스케줄 생성·연결 | P1 | 결강-보강 추적 |

#### MAP Score & Student Master Extensions {FR-034~FR-038}

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-034 | Student MAP Score History — 학생별 MAP TEST 점수(Reading/Math/Language) 누적 저장 및 시계열 조회 | P0 | TPI xlsx "MAP TEST" 필드 기반 |
| FR-035 | External Test Scores — SSAT/ISEE/GPA 등 외부 시험 점수 입력 및 관리 | P1 | TPI 상담 시트 필드 |
| FR-036 | Counseling Record — 학생별 상담 누적 이력(학적/거주지 변동, 수업 목표 변동, 만족도/개선점, 최종 상담 일자) | P0 | TPI "학부모 및 학생 상담" 시트 |
| FR-037 | Student Lifecycle — 학생 상태 전이: 상담중 → 등록 → 수업중 → 종료(종료일/종료 사유) | P0 | TPI 수업 종료 시트 |
| FR-038 | Excel Import — 기존 TPI 학생 정보 xlsx / 수업 확인표 xlsx를 일괄 업로드하여 초기 마이그레이션 | P1 | 운영 전환 지원 |

#### Trinity Pay — 결제/정산 {FR-039~FR-042}

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-039 | Payment Order — 수강 확정 시 결제 주문(order) 생성. 학부모에게 Toss Payments 위젯/결제 링크 노출 (카드/계좌이체/가상계좌/간편결제) | P0 | PG 직결, AMA 경유 X |
| FR-040 | Payment Execution & Webhook — **Toss Payments** SDK 결제 승인 + Payment Webhook(v2) 수신으로 결제 상태(READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED)를 동기화 | P0 | `idempotency_key` DB unique 제약으로 멱등성 보장 |
| FR-041 | Refund & Partial Refund — 수강 취소/중도 해지 시 **수업일(회차) 경과 기준** 환불 규정을 적용하여 전액/부분 환불 처리. 기본 규정은 **학원법 시행령 제18조 3단계 (전 100% / 1/3 전 2/3 / 1/2 전 1/2 / 이후 0%)** | P0 | `refund_policies` / `refund_policy_tiers` 버전 관리, FR-047 과 연동 |
| FR-042 | Payment Ledger & Receipt — 결제/환불 트랜잭션 원장(ledger) 및 영수증 발급 기록. 세금계산서/현금영수증은 FR-048 과 연동 | P0 | 감사·세무 요건 |
| FR-047 | Refund Policy Administration — 학원 관리자가 환불 규정(경과 구간 % 테이블)을 버전 관리하며 편집할 수 있다. 기본값은 학원법 시행령 제18조 템플릿이 preload 되고, 새 버전 활성화 시 기존 결제에는 소급 적용되지 않는다(정책 snapshot 보존) | P0 | 감사 로그 필수 |
| FR-048 | Tax Invoice Issuance — 결제 건에 대해 **국세청 홈택스 전자세금계산서 발급 API** 직결로 세금계산서(사업자) / 현금영수증(개인) 를 자체 발행. 발행 상태(발행중/발행완료/전송실패/취소) 및 승인번호(NTS issue no.)를 `tax_invoices` 에 기록 | P0 | 전자세금계산서법, 공동인증서 기반 |

#### Trinity Academy Main Portal (학부모 대면 포털) {FR-043~FR-046}

| ID | Requirement | Priority | Note |
|----|-------------|----------|------|
| FR-043 | Portal Site — Trinity Academy 브랜드 포털(Home / About / Programs / MAP Test / Contact / News) 운영 | P0 | 기존 imweb 대체 |
| FR-044 | Online Consultation Request — 포털 Contact 페이지에서 학부모가 상담 신청 폼을 제출 → FR-004 Consultation Intake로 연결 | P0 | |
| FR-045 | MAP Test Public Info — MAP Test 소개 페이지(응시 안내/샘플 문제/등급표) 제공. 실 응시는 로그인 필요 (v1.2) | P1 | |
| FR-046 | Program Catalog (Public) — 프로그램 카탈로그 공개 뷰 (FR-003 연장) 및 수강 신청 CTA | P0 | FR-003 보강 |

### 3.2 Non-Functional Requirements (비기능 요구사항)

| ID | Requirement | Criteria |
|----|-------------|----------|
| NFR-001 | Response Time | 일반 조회 API P95 < 300ms / 시간표 주간 조회 P95 < 500ms |
| NFR-002 | Availability | 99.5% (평일 08:00–22:00 학원 운영시간 기준) |
| NFR-003 | Scalability | 학원 기준 1,000 학생 / 100 교사 / 200 강의 동시 운영 / 문제은행 50,000 문항 |
| NFR-004 | Multi-tenancy | 학원 단위 테넌트 격리 (academy_id 기준 row-level isolation). 단, MAP 문제은행은 **본사 공용 풀 + 학원 사설 풀** 이중화 [TBD] |
| NFR-005 | Personal Data | 학생/학부모 개인정보 보호 (KR 개인정보보호법 준수), 연락처·생년월일 암호화 저장 |
| NFR-006 | AMA Integration | 교사 정보 변경은 AMA를 기준 원천(Source of Truth)으로 하며, 로컬 캐시는 read-only |
| NFR-007 | Audit | 수강/결제/성적 관련 쓰기 작업은 감사로그 필수 (FR-020) |
| NFR-008 | Localization | 한국어 기본, 다국어 확장 가능 구조 (i18n). MAP 문항은 **영어 원문 우선** (RC는 영문 지문) |
| NFR-009 | Content Integrity | MAP 문항/지문의 저작권 관리 — 외부 공개 금지, 학원 관리자/배정된 학생에게만 노출 |
| NFR-010 | Data Migration | TPI xlsx / 수업 확인표 xlsx의 기존 데이터 손실 없이 1회성 마이그레이션 지원 (FR-038) |
| NFR-011 | Payment Security | PCI-DSS SAQ-A 범위 준수 — 카드 원본 PAN 미저장, Toss Payments `paymentKey` 토큰만 `payment_orders.pg_payment_key` 에 보관. 환불/재결제는 관리자 승인 + 감사로그 필수 |
| NFR-012 | Brand Consistency | Trinity Academy Heraldic Identity(Navy #0E1E3A · Gold #C9A656 · Cream #FAF7EE · Serif typography) 를 포털과 관리 콘솔 헤더에 일관 적용 |
| NFR-013 | Legal Compliance (학원법·전자세금계산서법) | (1) 환불 규정은 **학원의 설립·운영 및 과외교습에 관한 법률 시행령 제18조** 의 반환 기준(교습 전/1·3/1·2 구간)을 기본값으로 하고, 학원 자체 규정은 이보다 학부모에게 불리하지 않게 제한. (2) 세금계산서는 **전자세금계산서법** 및 부가가치세법 제32조에 따라 공급 시점 익월 10일까지 홈택스에 **전송 완료**. (3) 공동인증서는 만료 30일 전 알림 및 갱신 프로세스 명문화. |

## 4. Scope Definition (범위 정의)

### In-Scope (포함 범위)
- **Trinity Academy Main Portal** (Home / About / Programs / MAP Test / Contact / News) — 학부모 대면 공개 사이트
- Program / Program Setting CRUD + 공개 카탈로그
- Consultation 접수·기록, 방문 이력, 상담-등록 전환 (포털 Contact 폼 연계)
- Parent / Student 등록 및 관계 관리 (TPI 항목 포함)
- Teacher 등록 (AMA Client 참조 1:1 필수)
- Class 개설, Teacher/Academy/Student Schedule(시간표) 조회
- Class Timetable (요일×시간 그리드, 색상 코드 상태 표시, 회차 기록)
- Enrollment (수강 등록 및 상태 관리)
- Attendance (출결 체크 + 수업 시간/비고) — P1
- **Trinity Pay — 결제/환불/영수증/원장** (PG 직결, AMA 경유 X)
- **MAP 문제은행 관리** (문제/지문 CRUD, Taxonomy, Test Set 구성, 배정, 자동 채점, 성적 누적)
- **MAP 점수·외부 시험 점수(SSAT/ISEE/GPA) 이력 관리**
- 학생 상담 누적 이력 · 학생 라이프사이클(상담중→수업중→종료)
- TPI xlsx / 수업 확인표 xlsx 일괄 마이그레이션
- Dashboard 기초 — P2
- Trinity Heraldic Brand System 적용 (포털 + 관리 콘솔 헤더)

### Out-of-Scope (제외 범위)
- **온라인 라이브 수업 플랫폼** — 외부 서비스 연동
- **학원 간 프랜차이즈 통합 관리** — Multi-tenant는 지원하나 그룹 리포트는 제외
- **AMA Client 원본 수정** — 본 시스템은 read-only 참조만 수행
- **AMA를 통한 결제 중계** — 결제는 Trinity Pay가 PG와 직접 연동. AMA는 결제 트랜잭션에 관여하지 않음
- **학생 자가 학습 포털 / 온라인 MAP 응시 UI** — Phase 2 ([TBD])
- **MAP 문제 자동 출제 AI 알고리즘** — v1.x는 수동 작성·태깅 기반
- **자체 PG 라이선스 취득** — Toss/KG/NHN 중 한 곳을 선정하여 SDK/Webhook 기반 연동

### MVP vs Full
- **MVP (v1.0)**: FR-001~FR-015 (P0 중심) — 프로그램/상담/등록/수강까지의 핵심 플로우
- **v1.1**:
  - FR-016 (Attendance + 수업시간 기록), FR-017 (Conversion), FR-020 (Audit)
  - FR-021~FR-025 (MAP 문제·지문·Test Set 핵심)
  - FR-029~FR-032 (Timetable Academy/Teacher View + Session Record)
  - FR-034, FR-036, FR-037 (MAP 점수 이력, 상담 이력, 학생 라이프사이클)
  - FR-038 (Excel Import — 초기 마이그레이션)
- **v1.2 (본 버전 범위 — Trinity 통합)**:
  - FR-039~FR-042 (**Trinity Pay** — 결제/환불/원장/영수증)
  - FR-043~FR-046 (**Trinity Academy 메인 포털** — Home/About/Programs/MAP Test/Contact/News)
  - FR-019 (Notification — AmoebaTalk 연동)
  - FR-026~FR-028 (Test Assignment, Grading, Versioning)
  - FR-031 (Student Timetable View), FR-033 (Makeup)
  - FR-035 (External Test Scores)
  - Trinity Heraldic Brand System 적용 (NFR-012)
- **v1.3+**:
  - FR-018 (Dashboard 고도화 — 상담→결제 funnel, MAP 성장 곡선)
  - 학부모 포털 (자녀별 시간표/성적/영수증 조회)
  - MAP 온라인 응시 UI, 본사 공용 문제 풀 구독

## 5. Constraints and Assumptions (제약사항 및 가정)

### Constraints
- **C-001**: 교사 마스터 데이터는 AMA Client를 단일 진실 원천으로 사용한다.
- **C-002**: 본 시스템은 **Trinity Academy 메인 포털(학부모 대면) + 운영 콘솔(학원장/행정/교사)** 로 구성된다. 학부모 자녀 전용 포털(성적/시간표 조회)은 v1.3+ ([TBD]).
- **C-003 (revised @ v1.2)**: 결제는 **Trinity Academy 메인 사이트에서 직접 처리**한다 (Trinity Pay 모듈). PG(Toss/KG이니시스/NHN KCP 중 택1)와 직결하며, **AMA는 결제 플로우에 관여하지 않는다.**
- **C-004 (revised @ v1.2)**: 기술 스택 — **Frontend: React 18 + Next.js 14 App Router** (포털/관리콘솔 공통) + Tailwind + shadcn/ui / **Backend: Next.js Route Handlers (Node 20)** + MySQL 8 + RabbitMQ + Redis / **Storage**: S3 호환 오브젝트 스토리지 (MAP 지문 이미지/영수증 PDF).
- **C-005**: MAP 문제·지문은 **저작권 보호 자산**이다. API 응답/PDF 내보내기 시 권한 검증과 워터마킹(향후)을 고려한다.
- **C-006**: 시간표(Timetable)는 독립 엔티티가 아닌 **Class + class_sessions의 파생 뷰(derived view)** 로 구현한다. 별도 timetable 테이블을 만들지 않는다.
- **C-007**: Trinity Academy Heraldic Brand System은 디자인 토큰화(색상·타이포·엠블럼 SVG)하여 포털/관리콘솔의 디자인 시스템 단일 소스로 관리한다. 기존 imweb 페이지의 임의 스타일을 직접 복제하지 않는다.

### Assumptions
- **A-001**: 학생은 반드시 1명의 학부모(또는 보호자)와 연결된다. 보호자가 여러 명인 경우는 `primary_parent_id` 기준으로 관리한다.
- **A-002**: 한 학원(Academy)은 여러 프로그램을 운영하며, 한 프로그램에서 여러 강의(Class)가 개설된다.
- **A-003**: 한 학생은 동시에 여러 강의에 등록될 수 있다 (Enrollment N:M via join table).
- **A-004**: AMA의 Client(거래처) 엔티티에는 교사로 사용 가능한 개인/업체 정보가 이미 존재한다.
- **A-005**: MAP 문제은행은 **학원별 사설 풀(private pool)을 기본**으로 한다. 본사 공용 풀(shared pool)은 v1.2 이후 검토. (NFR-004 참조)
- **A-006**: MAP 문항의 정답은 **복수 정답**(Multi-correct) 및 **Part A-B 복합 문항**을 허용한다. (MAP RC Basic PDF 분석 결과)
- **A-007**: 수업 회차(Session)의 실제 수업 시간은 **0.5시간 단위**로 기록한다 (예: 1.0, 1.5, 2.0). 수업 확인표 xlsx 관행 반영.
- **A-008**: 초기 운영 전환 시 TPI xlsx / 수업 확인표 xlsx는 **1회성 Excel Import**로 마이그레이션하며, 이후 이중 기록하지 않는다.
- **A-009**: Trinity Pay는 **PG와 직접(direct)** 연동한다 — 브라우저 ↔ PG 위젯, 서버 ↔ PG Webhook. AMA를 통한 결제 중계(proxy) 아키텍처는 채택하지 않는다.
- **A-010**: Trinity Academy 메인 포털과 관리 콘솔은 **단일 Next.js 모노레포**에서 라우트 그룹 `(portal)` / `(admin)` 으로 분리한다 (shared design system, separate auth).
- **A-011**: Trinity Pay의 PG는 **Toss Payments**로 확정한다 (Q-014 closed @ v1.3). 결제창은 Toss Payments Widget v2 (`@tosspayments/payment-widget-sdk`), 승인은 `POST /v1/payments/confirm`, Webhook은 Payment Webhook v2 스펙을 따른다. 카드/계좌이체/가상계좌/간편결제를 지원.
- **A-012**: 환불 규정 기본값은 **학원법 시행령 제18조**의 3단계 공식으로 한다 (Q-015 closed @ v1.3). 학원 자체 규정으로 오버라이드할 경우 `refund_policies` 테이블에 새 version을 발행하고, 기존 결제는 발행 당시 정책 snapshot으로 계산된다.
- **A-013**: 세금계산서/현금영수증은 **국세청 홈택스 전자세금계산서 발급 API**에 직접 연동하여 자체 발행한다 (Q-018 closed @ v1.3). 공인인증서(전자서명용 공동인증서)는 서버 HSM/KMS에 보관, 팝빌/바로빌 등 중계 SaaS는 채택하지 않는다.

## 6. Related Systems (연관 시스템)

| System | Integration Type | Purpose |
|--------|------------------|---------|
| AMA (아메바에이아이) | REST API / Webhook | Client(거래처) → Teacher 참조. **결제 중계 X** |
| AmoebaTalk | API | 학부모 알림 발송 (FR-019), 상담 접수/결제 완료/MAP 성적 통보 |
| **Toss Payments** | Widget SDK + Confirm API + Webhook v2 | **Trinity Pay 결제·승인·환불** (FR-039~FR-042) — 직결, AMA 경유 X |
| **국세청 홈택스 eTax (전자세금계산서 발급 API)** | XML/REST + 공동인증서 | **세금계산서/현금영수증 자체 발행** (FR-048) |
| Email/SMS Gateway | API | Trinity Pay 영수증·상담 신청 확인 백업 채널 |
| Object Storage (S3 호환) | SDK | MAP 지문 이미지/삽화, 문항 첨부, 영수증/세금계산서 PDF |
| CDN (CloudFront/Cloudflare) | DNS + SSL | Trinity Academy 포털 정적 자산 배포 |
| Analytics (GA4 / Plausible) | JS tag | 포털 유입/상담 전환 funnel |
| (Future) MAP Central Pool | Internal API | 본사 공용 문제 풀 참조 — v1.3 이후 [TBD] |

## 7. Success Metrics (성공 지표)

| KPI | Measurement | Target |
|-----|-------------|--------|
| 상담 → 등록 전환율 | Enrollment created / Consultation count | 30% 이상 |
| 교사 정보 동기화 정확도 | AMA ↔ Academy mismatch rate | < 1% |
| 학생 등록 완료 소요시간 | Avg. time from consultation to enrollment | < 3일 |
| 시스템 가용성 | Uptime in 운영시간 | 99.5% |
| 관리자 사용성 | 신규 행정 직원 온보딩 시간 | < 4시간 |
| **시간표 엑셀 이탈율** | 수업 확인표 xlsx 대비 시스템 기록률 | 3개월 내 90% 이상 |
| **MAP 배정 완료율** | 배정된 Test Set의 응시/채점 완료 비율 | 80% 이상 |
| **MAP 문제은행 적재량** | 디지털화 완료된 유효 문항 수 | 6개월 내 3,000문항 |
| **마이그레이션 오류율** | Excel Import 시 검증 실패 row 비율 | < 2% |
| **출결 기록 적시성** | 수업 당일 출결 기록 완료율 | 95% 이상 |
| **포털 상담 전환율** | trinityacademy.kr Contact 폼 제출 → Consultation 생성 | 95% 이상 (손실 최소화) |
| **Trinity Pay 결제 성공률** | PG 승인 건 / 결제 주문 생성 건 | 98% 이상 |
| **결제-수강 동기화 지연** | 결제 Webhook 수신 → 수강 상태 '확정' 반영 P95 | < 5초 |
| **포털 Core Web Vitals** | LCP P75 (Home/Programs) | < 2.5s |

## 8. Open Questions (미결정 사항)

| ID | Question | Owner | Due |
|----|----------|-------|-----|
| Q-001 | 학부모 포털(셀프 상담/수강 신청)을 MVP에 포함할지? | PO | [TBD] |
| Q-002 | 결제 연동 대상 PG는 어디로? | PO | [TBD] |
| Q-003 | AMA와의 동기화 방식: Webhook vs Polling? | Tech Lead | [TBD] |
| Q-004 | 알림 채널: SMS only vs AmoebaTalk 통합? | PO | [TBD] |
| Q-005 | 출결 체크 주체: 교사 직접 vs 행정 직원 대행? (수업 확인표는 교사 작성 관행) | PO | [TBD] |
| Q-006 | MAP 문제은행의 **본사 공용 풀 vs 학원 사설 풀** 운영 정책 — 공용 풀 구독 모델 여부 | PO | [TBD] |
| Q-007 | MAP 시험 **온라인 응시 UI**를 v1.x에 포함할지, 아니면 오프라인 OMR 채점만 지원할지 | PO | [TBD] |
| Q-008 | 수업 시간 단위를 **0.5h 고정**으로 제약할지, 분 단위(정수) 허용할지 | Tech Lead | [TBD] |
| Q-009 | **MAP 문항 저작권 소유** — 콘텐츠 담당자 업로드 시 저작권 귀속(본사 vs 학원)과 재사용 권한 | Legal | [TBD] |
| Q-010 | 기존 TPI "학생정보(구)" 시트의 데이터를 모두 마이그레이션할지, 활성 학생만 이관할지 | PO | [TBD] |
| Q-011 | **강의실(Classroom)** 을 별도 마스터로 관리할지, Class의 자유 문자열 필드로 둘지 (충돌 검사 영향) | Tech Lead | [TBD] |
| Q-012 | MAP Passage에 포함된 **원본 이미지/표**의 저장 방식 (DB TEXT vs Object Storage URL) | Tech Lead | [TBD] |
| Q-013 | 보강(Makeup) 세션 생성 시 **원 회차와의 1:1 매핑** 필수 여부 (결강 1건당 보강 여러 건 허용?) | PO | [TBD] |
| ~~Q-014~~ | ~~Trinity Pay 연동 **PG 선정**~~ → **DECIDED @ v1.3: Toss Payments** (A-011) | PO | **Closed 2026-04-19** |
| ~~Q-015~~ | ~~환불 규정 테이블 — **수업 경과 회차별 환불률** 공식~~ → **DECIDED @ v1.3: 수업일(회차) 기준, 학원법 시행령 제18조 3단계 기본값** (A-012, FR-041, FR-047) | PO | **Closed 2026-04-19** |
| Q-016 | 포털과 관리 콘솔의 **도메인 분리** 여부 — `trinityacademy.kr` (public) vs `admin.trinityacademy.kr` (admin) | Tech Lead | [TBD] |
| Q-017 | News/공지는 **헤드리스 CMS**(Sanity/Contentful) 연결할지, 자체 DB의 Post 엔티티로 관리할지 | Tech Lead | [TBD] |
| ~~Q-018~~ | ~~세금계산서 발급은 **Trinity Pay 자체 발급** vs **외부 서비스** 연동~~ → **DECIDED @ v1.3: 자체 발급, 국세청 홈택스 eTax API 직결** (A-013, FR-048) | PO | **Closed 2026-04-19** |
| Q-019 | Toss Payments **Brandpay**(간편결제 토큰) 도입 여부 — 학부모 재결제 UX vs 추가 인증 정책 | PO | [TBD] |
| Q-020 | 환불 정책 중 **위약금(수업료 외 교재비/시설비)** 별도 처리 여부 | PO | [TBD] |
| Q-021 | 공동인증서 보관 — 서버 로컬 HSM vs AWS KMS + CloudHSM | Tech Lead / Security | [TBD] |
