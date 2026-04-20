---
document_id: ACADEMY-FUNCSPEC-1.3.0
version: 1.3.0
status: Draft
created: 2026-04-20
updated: 2026-04-20
author: 김익용
reviewers: []
change_log:
  - version: 1.3.0
    date: 2026-04-20
    author: 김익용
    description: |
      Merged functional specification and screen composition into a single document.
      Links each FN-XXX function ID to its SCR-XXX screen ID and the corresponding
      Hi-Fi HTML mockup under docs/design/screens/. Aligned with v1.3 Trinity Pay
      decisions (Toss / 수업일 기준 환불 / NTS eTax 자체 발행).
---

# Trinity Academy — Functional Specification with Screen Composition (기능명세서 · 화면구성안)

본 문서는 요구사항 분석서(`ACADEMY-REQ-1.3.0`)의 FR 을 **기능 ID (FN-xxx)** 와 **화면 ID (SCR-xxx)** 로 구체화하고, 각 화면의 레이아웃·구성요소·인터랙션·Hi-Fi 목업 경로를 함께 기술한다. 기능 정의서(`ACADEMY-FUNC-1.3.0`)와 화면 구성안(`academy-management-screens.md`)의 핵심을 **기능 ↔ 화면 일대일 대응** 관점으로 재구성한 통합 사양서이다.

설계 원칙은 "개념과 설계" — 컨트롤러 메서드 시그니처나 CSS 클래스 단위 대신, **각 기능이 어떤 화면에서 어떤 객체·상태를 어떻게 다루는지** 를 기술한다. 구현 디테일은 코드와 PR 에서 확정된다.

---

## 1. Overview (개요)

### 1.1 Document Purpose (문서 목적)

- 각 기능(FN-xxx) 의 **책임과 경계**를 정의한다 (선행조건 · 후행조건 · 처리 로직 · 에러).
- 각 화면(SCR-xxx) 의 **역할과 구성**을 정의한다 (레이아웃 · 핵심 컴포넌트 · 인터랙션).
- 기능과 화면을 **양방향 추적 가능(traceable)** 하게 매핑한다. 개발자/PM/원장이 동일한 ID 로 대화한다.
- 42개 Hi-Fi HTML 목업(`docs/design/screens/*.html`)과 1:1 연결한다.

### 1.2 ID Convention (ID 체계)

| ID | Pattern | Example |
|----|---------|---------|
| Requirement | `FR-xxx` | FR-100 (Trinity Pay 결제) |
| Function | `FN-xxx` | FN-100 (주문 생성 및 Toss Widget 호출) |
| Screen | `SCR-{area}-{seq}` | SCR-A-PAY-02 (결제 주문 상세) |
| Process | `PRC-xxx` | PRC-004 (환불 처리) |
| Policy | `POL-xxx` | POL-002 (환불정책) |

Area 코드: `P` = Portal, `A` = Admin root, `A-C` = Consultation, `A-S` = Student/Parent, `A-T` = Teacher, `A-P` = Program/Class, `A-M` = MAP, `A-TT` = Timetable, `A-PAY` = Trinity Pay, `A-SET` = Settings.

### 1.3 Design Principles (설계 원칙)

**브랜드 시스템 일관성.** 방패 문장 · OMNIBUS OMNIA 표어 · Navy/Gold/Cream 팔레트는 Portal 과 Admin 모두에서 `heraldic-tokens.css` 단일 소스를 공유한다. Admin 은 운영 밀도를 위해 Slate 계열을 추가하지만 **타이포그래피 · 아이콘 · 간격 스케일** 은 동일하다.

**역할 기반 레이아웃 분리.** 학부모·원생은 `(portal)` — 상단 네비, 넓은 여백, SSG/ISR. 원장·교무는 `(admin)` — 좌측 사이드바(문장 아이콘 + 메뉴), 상단 컨텍스트바, SSR. 역할은 **화면 단위가 아니라 액션 단위** 로 RBAC 강제.

**AMA · Trinity Pay 구조적 고립.** Admin 에 "교사 생성" 버튼 자체를 제공하지 않는다 — AMA 미러만 표시. 반대로 결제·환불·세금계산서 화면은 AMA 아이콘조차 노출하지 않는다.

**용어·레전드 엑셀과 일치.** 시간표 색상(초록=진행, 빨강=결강, 금색=예정, 보라=보강), TPI 학생 정보 컬럼 순서는 기존 엑셀과 동일하게 유지해 운영자 전환 저항을 낮춘다.

---

## 2. Module × Screen × Function Matrix (모듈 × 화면 × 기능 매트릭스)

| Module | Hi-Fi Mockup | Screens (SCR) | Functions (FN) |
|--------|--------------|---------------|---------------|
| Portal | `portal.html`, `portal-trinity-site.html` | SCR-P-01 ~ SCR-P-10 | FN-110 ~ FN-119 |
| Admin Dashboard | `admin-dashboard.html` | SCR-A-00 | FN-010 ~ FN-012 |
| Consultation | `consultation-student-teacher.html` | SCR-A-C-01 ~ 03 | FN-020 ~ FN-029 |
| Student / Parent | `consultation-student-teacher.html` | SCR-A-S-01 ~ 04 | FN-030 ~ FN-039, FN-090 ~ 094 |
| Teacher (AMA) | `consultation-student-teacher.html` | SCR-A-T-01 ~ 02 | FN-040 ~ FN-045 |
| Program / Class | `program-map-timetable.html` | SCR-A-P-01 ~ 03 | FN-050 ~ FN-059 |
| MAP | `program-map-timetable.html` | SCR-A-M-00 ~ 05 | FN-070 ~ FN-079 |
| Timetable | `program-map-timetable.html` | SCR-A-TT-01 ~ 02 | FN-080 ~ FN-084 |
| Trinity Pay | `trinity-pay.html` | SCR-A-PAY-00 ~ 08 | FN-100 ~ FN-109 |
| Settings | `admin-dashboard.html` (hub) | SCR-A-SET-01 ~ 03 | FN-120 ~ FN-124 |

---

## 3. Module 1 — Portal (학부모 대면)

### 3.1 Scope (범위)

기존 imweb 기반 홍보 사이트를 대체한다. SSG/ISR 로 빌드해 LCP < 2.5s 를 목표. 로그인 후 학부모 대시보드(자녀별 성적·수업·결제 조회)까지 포괄한다.

### 3.2 Screens

#### SCR-P-01 Home (홈)
- **Mockup**: `docs/design/screens/portal.html#home`, `portal-trinity-site.html`
- **레이아웃**: Hero (Navy → Gold 그라디언트 + 방패 문장) → 핵심 가치(OMNIBUS OMNIA 3줄) → Programs Preview(3 카드) → MAP Test CTA → 합격 실적(숫자 4개) → Contact CTA → Footer.
- **핵심 컴포넌트**: `<HeroCrest/>`, `<ValuePillars/>`, `<ProgramCard/>×3`, `<StatBand/>`, `<BrandFooter/>`.
- **인터랙션**: 스크롤 IntersectionObserver 로 Navy 헤더가 투명 → 솔리드. Programs Preview 카드 클릭 → `/programs/[slug]`.
- **반응형**: Desktop ≥1280 3-column, Tablet 2-column, Mobile 1-column.

#### SCR-P-02 About (소개)
- **Mockup**: `portal.html#about`
- OMNIBUS OMNIA 모토 전문, 원장 인사말, 건학 이념. Typography-heavy(Cormorant Garamond + Noto Serif KR).

#### SCR-P-03 Programs 목록 / SCR-P-04 Programs 상세
- **Mockup**: `portal.html#programs`
- 카드 그리드(6개) → 상세(커리큘럼 트리 · 대상 · 학기 · 교재 · 등록 CTA). 상세는 관리자 콘솔의 `SCR-A-P-02` 커리큘럼 트리와 **동일 토큰** 을 사용해 브랜드 일관성 유지.

#### SCR-P-05 MAP Test 안내
- **Mockup**: `portal.html#map`
- 시험 소개 · Part A/B 구조 · 응시 프로세스 · 일정 조회 링크. 예시 문제 1개(Passage 미니 샘플).

#### SCR-P-06 Contact (상담 접수)
- **Mockup**: `portal.html#contact`
- **레이아웃**: 폼(성명/연락처/학년/희망 시간/메모) + reCAPTCHA v3.
- **기능 연동**: `FN-020 (상담 접수)` 호출, 성공 시 접수번호 반환.
- **검증**: 전화번호 포맷, 학년 범위, 메모 1000자.

#### SCR-P-07 News 목록 / SCR-P-08 News 상세
- 헤드리스 CMS 여부(Q-017)는 v1.3 에서 자체 DB 로 구현하고 v1.4 에서 재검토.

#### SCR-P-09 학부모 로그인
- NextAuth Credentials, 아이디(휴대폰) + 임시코드 SMS 2단계.

#### SCR-P-10 Parent Dashboard (/my)
- **Mockup**: `portal.html#dashboard`
- **레이아웃**: 상단 자녀 스위처 → 탭(오늘 수업 / 성적 / 결제) → 리스트.
- **Sub**: `/my/timetable` (주간), `/my/scores` (MAP 성적), `/my/payments` (영수증/세금계산서 다운로드).

### 3.3 Functions (기능)

| FN | Name | Description | Pre | Post | I/O |
|----|------|-------------|-----|------|-----|
| FN-110 | 상담 접수 처리 (Portal) | Contact 폼 제출을 Consultation `INQUIRY` 레코드로 전환 | reCAPTCHA 통과 | 상담 1건 신규 생성, AmoebaTalk 내부 알림 | POST /api/portal/consultations |
| FN-111 | 포털 프로그램 조회 | Programs 공개 카탈로그 + 상세 | — | — | GET /api/portal/programs[/slug] |
| FN-112 | MAP 안내 및 일정 | 공개 일정과 샘플 문제 | — | — | GET /api/portal/map-schedule |
| FN-113 | 뉴스 조회 | 뉴스 목록/상세 | — | — | GET /api/portal/news[/slug] |
| FN-114 | 학부모 로그인 | 휴대폰 + OTP | OTP 발송 한도 | 세션 발급 | POST /api/auth/parent |
| FN-115 | 내 자녀 요약 | 자녀 리스트 + 오늘 수업/최근 성적/미납 | 로그인 | — | GET /api/portal/my/children |
| FN-116 | 내 시간표 | 자녀의 주간 수업 | — | — | GET /api/portal/my/timetable |
| FN-117 | 내 성적 | MAP 결과 + 리포트 | — | — | GET /api/portal/my/scores |
| FN-118 | 내 결제/영수증 | 납부 이력 + 영수증/세금계산서 PDF | — | — | GET /api/portal/my/payments |
| FN-119 | 1:1 문의 | 로그인 사용자의 질문 접수 | 로그인 | — | POST /api/portal/my/inquiries |

---

## 4. Module 2 — Admin Dashboard

### 4.1 Scope

로그인 직후 모든 역할이 보는 첫 화면. KPI, 오늘의 액션, 경고(NFR-013 NTS 시한, HSM 만료) 를 **30초 스캔** 가능하도록 구성.

### 4.2 Screens

#### SCR-A-00 Dashboard (운영 홈)
- **Mockup**: `admin-dashboard.html`
- **레이아웃**: 상단 KPI 4종(오늘 수업 / 이번주 결제 / 미납 / 신규 상담) → Today 리스트(오늘 세션·결제 예정·세금계산서 시한) → 경고 배너(Trinity Pay Hub 에서 릴레이) → 최근 활동.
- **핵심 컴포넌트**: `<KpiCard/>×4`, `<TodayList/>`, `<AlertBanner severity="warn|danger"/>`, `<ActivityFeed/>`.
- **인터랙션**: KPI 클릭 → 해당 모듈 목록으로 이동. 경고 배너는 `SCR-A-PAY-00` 로 딥링크.

### 4.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-010 | KPI 집계 | academy_id 기준 오늘/이번주 수치 계산 (materialized view) |
| FN-011 | Today 목록 | 오늘 수업·결제·세금계산서 마감을 합쳐 시간순 정렬 |
| FN-012 | 글로벌 경고 릴레이 | Trinity Pay D-day, HSM 만료, AMA 동기화 실패 등을 전역 배너로 노출 |

---

## 5. Module 3 — Consultation (상담)

### 5.1 Scope

상담 접수 → 방문 예약 → MAP 시험 → 반 배치 → 등록 의 Kanban 기반 퍼널. 기존 엑셀의 "학생 현황 시트"를 시스템으로 대체.

### 5.2 Screens

#### SCR-A-C-01 Consultation Kanban
- **Mockup**: `consultation-student-teacher.html#consultation`
- **레이아웃**: 5-컬럼 보드 (INQUIRY / VISIT_SCHEDULED / MAP_TESTED / ENROLLED / LOST). 각 카드: 학생명, 학년, 상담자, 다음 액션 아이콘, D-day.
- **인터랙션**: 드래그앤드롭으로 상태 전환 → 확인 다이얼로그 → FN-024. `ENROLLED` 로 전환 시 **학생/학부모 레코드 생성 확인 모달**.

#### SCR-A-C-02 Consultation 상세
- **레이아웃**: 좌 학생 정보(TPI 미리보기), 우 활동 타임라인(접수·방문·시험·코멘트), 하단 다음 액션 폼.

#### SCR-A-C-03 방문 예약 모달
- 캘린더 피커 + 담당자 + 메모. AmoebaTalk 확인 알림 체크박스.

### 5.3 Functions

| FN | Name | Pre | Post | Logic |
|----|------|-----|------|-------|
| FN-020 | 상담 접수 | — | INQUIRY 카드 생성 | Portal/Admin 양쪽에서 호출 가능, reCAPTCHA 검증 |
| FN-021 | 방문 예약 | INQUIRY | VISIT_SCHEDULED, AmoebaTalk 예약 안내 | 캘린더 충돌 체크 |
| FN-022 | MAP 시험 배정 | VISIT_SCHEDULED | MAP_TESTED (점수 입력 대기) | TestSet 선택, 시험 슬롯 예약 |
| FN-023 | MAP 결과 기록 | 시험 완료 | 점수 · 리포트 | Grading Center 연동(FN-077) |
| FN-024 | 상태 전이 | 각 단계 진입 조건 충족 | 다음 상태, 이벤트 발행 | 금지 전이 차단(예: MAP_TESTED → INQUIRY) |
| FN-025 | 등록 확정 | MAP_TESTED | ENROLLED + Student/Parent/Enrollment 생성 | **원자적 트랜잭션** — 학생·학부모·등록·초기 결제주문(DRAFT) 동시 생성 |
| FN-026 | 상실 처리 | 임의 상태 | LOST + 사유 | 사유 코드 선택(비용/거리/경쟁학원/기타) |
| FN-027 | 타임라인 조회 | — | — | 상담 + 학생 + 결제 이벤트 병합 뷰 |
| FN-028 | 상담 코멘트 | — | — | 내부 공개 범위(담당자/전체) |
| FN-029 | AmoebaTalk 상담 템플릿 | — | 알림 발송 | 템플릿 변수 바인딩 |

---

## 6. Module 4 — Student / Parent (학생·학부모)

### 6.1 Scope

TPI 학생 정보 엑셀 구조를 완전히 커버. 개인정보는 AES-GCM 암호화 저장(`phone_encrypted`, `email_encrypted`).

### 6.2 Screens

#### SCR-A-S-01 학생 목록
- **Mockup**: `consultation-student-teacher.html#students`
- 필터: 학년·반·상태(재원/휴원/퇴원)·담당 교사·검색. 테이블: 이름/학년/소속반/납부상태/다음 수업. 액션: 상세, 반 변경, 결제 생성.

#### SCR-A-S-02 학생 상세 (TPI)
- **레이아웃**: 상단 학생 헤더(크레스트 미니 + 이름 + 학년 + 상태 배지) → 탭(기본정보 / TPI / 수업·출결 / 성적 / 결제).
- **TPI 탭**: 기존 엑셀과 동일 컬럼 순서 — 생년월일, 성별, 학교, 학년, 담임, 자가진단, 학습이력, 특이사항. 암호화 필드는 마스킹 + "보기" 권한.

#### SCR-A-S-03 학부모 목록 / SCR-A-S-04 학부모 상세
- 자녀 연결 관리, 알림 수신 동의, 결제 이력.

### 6.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-030 | 학생 등록 | 상담 `ENROLLED` 시 자동 생성 또는 수동 |
| FN-031 | 학생 정보 수정 | 암호화 필드는 별도 권한 |
| FN-032 | 상태 전이 | 재원 → 휴원 → 퇴원 |
| FN-033 | 반 배정 변경 | 충돌 검사(시간표) |
| FN-034 | 학부모 등록 | 자녀 N명 연결, 주 수신자 1명 |
| FN-035 | 학부모-자녀 연결 | N:M 허용(이혼·보호자 분리) |
| FN-036 | TPI 편집 | 엑셀 컬럼 호환 |
| FN-037 | TPI 이력 | 변경 이력 타임라인 |
| FN-038 | 개인정보 열람 로그 | NFR-005, 감사로그 기록 |
| FN-039 | 암호화 필드 복호화 | 권한 + 이유 필수 입력 |
| FN-090 | 자가진단 기록 | TPI Extension |
| FN-091 | 학습이력 타임라인 | 상담·시험·성적을 시간순으로 |
| FN-092 | 특이사항 태그 | 색상 태그(알러지/건강/가정) |
| FN-093 | 부모-자녀 요약 | 학부모 화면에서 자녀 요약 카드 |
| FN-094 | 본인확인 요청 | 민감 필드 수정 시 본인인증 |

---

## 7. Module 5 — Teacher (교사, AMA Client Mirror)

### 7.1 Scope

교사 마스터는 AMA Client 를 **read-only mirror** 로 가져온다. 로컬 DB 에는 캐시와 매핑 정보만 보관하며, **"교사 신규 생성" UI 는 존재하지 않는다**. 이는 C-003, NFR-003 의 구조적 고립과 직접 대응.

### 7.2 Screens

#### SCR-A-T-01 교사 목록
- **Mockup**: `consultation-student-teacher.html#teachers`
- 카드 또는 테이블. AMA Client ID, 담당 반, 주간 수업시간, 동기화 상태 배지(정상/실패/지연).
- 상단 툴바: "AMA 에서 동기화" 버튼(수동 트리거).

#### SCR-A-T-02 교사 상세
- AMA 에서 가져온 기본정보(읽기 전용) + 로컬 매핑(담당 반, 급여 정책(v1.4), 메모).
- 주간 수업 캘린더 미니뷰 → `SCR-A-TT-01` 로 딥링크.

### 7.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-040 | 교사 목록 조회 | 로컬 미러 + AMA 상태 |
| FN-041 | 교사 상세 조회 | — |
| FN-042 | AMA Client 동기화 | 15분 cron + 수동 버튼, **쓰기 없음** |
| FN-043 | 로컬 매핑 편집 | 담당 반, 메모, 내부 역할만 |
| FN-044 | 주간 수업 집계 | Session 쿼리 → 교사별 주간 시수 |
| FN-045 | Tombstone 처리 | AMA 에서 삭제 시 로컬 상태 = `ARCHIVED`, 과거 수업 보존 |

---

## 8. Module 6 — Program / Class / Session

### 8.1 Scope

**Program (교재·커리큘럼 단위)** + **Class (운영 단위)** + **Session (개별 수업 회차)** 의 3-계층 모델. 기존 수업 확인표.xlsx 의 주간 뷰를 Session 단위 컬러 레전드(초록/빨강/금/보라)로 재현.

### 8.2 Screens

#### SCR-A-P-01 Program 목록
- **Mockup**: `program-map-timetable.html#programs`
- 6 카드(RC Basic / RC Intermediate / Math Pre-Algebra / Math Algebra / MAP 대비 / 실전모의). 카드: 대상 학년, 주당 시수, 기간, 교재, 담당 반 수.

#### SCR-A-P-02 Program 상세 (커리큘럼)
- **레이아웃**: 상단 Program 헤더 → 커리큘럼 트리(5 Unit × 4 Week) → 교재 · 참고서 · 평가계획 → 개설반 리스트.
- **커리큘럼 트리 컴포넌트**: dashed border + 금색 점 마커.

#### SCR-A-P-03 Class 상세 (회차표)
- **레이아웃**: 상단 Class 헤더(프로그램·교사·교실·시간·진도) → 회차 테이블 (회차 / 일자 / 주제 / 과제 / 출결 요약 / 상태) → 우측 진척 사이드바(`elapsed_ratio` 계산 콜아웃 — 환불 계산용 데이터 출처).
- **Row state**: 진행(초록)·결강(빨강)·예정(금)·보강(보라) — 배경색과 좌측 border 로 이중 표시.

### 8.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-050 | Program CRUD | 활성/비활성, 버전 |
| FN-051 | 커리큘럼 편집 | Unit·Week·주제·과제 |
| FN-052 | Class 개설 | Program × 요일/시간/교사/교실/시작일/종료일 |
| FN-053 | 회차 자동 생성 | 시작~종료 + 휴원일 캘린더 빼고 Session 다량 생성 |
| FN-054 | 휴원일 관리 | 연간 공휴일 + 학원 자체 휴원일 |
| FN-055 | Session 상태 전이 | UPCOMING → HELD / CANCELED / MAKEUP |
| FN-056 | 학생 배정 | Class × Student 매핑, 시간 충돌 검사 |
| FN-057 | 보강 처리 | 결강 1회 → 보강 1회 생성, 연결 |
| FN-058 | elapsed_ratio 계산 | `held_session_count / total_session_count` — Trinity Pay 환불의 입력 |
| FN-059 | 진도 조회 | 학생 기준 진도율 리포트 |

---

## 9. Module 7 — MAP Question Bank & Grading

### 9.1 Scope

MAP RC(Reading Comprehension) 중심, Part A (Vocabulary) + Part B (Reading Comp) 구조. 자료 흐름: **Passage → Item → TestSet → Assignment → Grading → Score Portal**.

### 9.2 Screens

#### SCR-A-M-00 MAP Hub
- **Mockup**: `program-map-timetable.html#map-hub`
- **레이아웃**: Hero(Navy) + KPI 4종(총 지문·총 문항·운영 중 TestSet·지난주 응시) + 6개 모듈 진입 카드.

#### SCR-A-M-01 Passage Library (지문 라이브러리)
- **레이아웃**: 필터(Lexile / 카테고리 / 출처) + 카드 그리드. 카드: 제목, Lexile 배지, 단어수, 미리보기 발췌(Cream 배경 + 그라디언트 페이드).

#### SCR-A-M-02 Item Editor (문항 편집기)
- **Mockup**: `program-map-timetable.html#item-editor`
- **레이아웃**: 좌 Passage(고정 스크롤) / 우 Item Panel (Part A · Part B 탭). Part A: 단어/뜻/예문/보기. Part B: 문제/5지선다/정답/해설.
- **정답 하이라이트**: 선택된 정답은 금색 체크 + 옅은 크림 배경.

#### SCR-A-M-03 TestSet Builder
- **레이아웃**: 좌 Bank(Passage / Item 검색 + 체크 선택) → 중앙 드롭존(순서 지정) → 우 Sticky Summary(총 문항·배점·난이도·예상 시간).

#### SCR-A-M-04 Assignment (배포)
- **레이아웃**: TestSet 요약 + 대상(반/학생) + 기간 + 공개 일시 + AmoebaTalk 사전 안내 체크. 하단에 알림톡 미리보기 카드.

#### SCR-A-M-05 Grading Center
- **Mockup**: `program-map-timetable.html#grading`
- **레이아웃**: 3-패널 — 좌 학생 리스트(상태 배지), 중 답안 그리드(5열), 우 Insights(총점·Part A/B 별 정답률·오답 경향).

### 9.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-070 | Passage CRUD | 원문·Lexile·카테고리·태그 |
| FN-071 | Item CRUD (Part A) | 단어/뜻/예문/보기/정답/해설 |
| FN-072 | Item CRUD (Part B) | 지문 FK + 5지선다 + 정답 + 해설 |
| FN-073 | TestSet Build | Passage/Item 조합 + 순서 + 배점 |
| FN-074 | TestSet Preview | 학생 화면 시뮬레이션 |
| FN-075 | Assignment 생성 | TestSet × 대상 × 기간 |
| FN-076 | Assignment 알림 | AmoebaTalk 사전/공개/마감 |
| FN-077 | 채점 | 객관식 자동 + 서술형 수기, 재채점 지원 |
| FN-078 | Insights 집계 | Part A/B 별 정답률, 오답 경향 |
| FN-079 | Score Portal 노출 | 공개 일시 이후 `SCR-P-10/scores` 에 표시 |

---

## 10. Module 8 — Timetable (시간표)

### 10.1 Scope

"수업 확인표.xlsx" 의 주간 캘린더를 대체한다. **Session 단위 컬러 레전드** 를 엑셀과 동일하게 유지.

### 10.2 Screens

#### SCR-A-TT-01 Weekly Calendar (주간 달력)
- **Mockup**: `program-map-timetable.html#timetable`
- **레이아웃**: 상단 주 네비(이전/오늘/다음 + 주차 라벨) → Week Grid: 좌 70px 시간축, 상 40px 헤더, 7열 x 여러 시간대. 각 이벤트: 반명·교사·교실·상태(색).
- **색 규칙**: `.held` #28a745 (초록) / `.canceled` #dc3545 (빨강) / `.upcoming` Gold / `.makeup` #6F4DB8 (보라, AMA Accent).

#### SCR-A-TT-02 Session Detail (세션 상세)
- **레이아웃**: 상단 세션 헤더 + 출결표(학생 × 상태) + 진도/과제 기록 + 상태 변경 액션(결강/보강). 하단 AMA 결석 알림 버튼.

### 10.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-080 | 주간 조회 | academy_id + 주차 + 필터(교사/반) |
| FN-081 | 세션 상세 | 학생·출결·진도·과제 |
| FN-082 | 출결 저장 | 출석/결석/지각/병결 + 메모 |
| FN-083 | 결강·보강 연결 | 1:1 보강 슬롯 생성 |
| FN-084 | AMA 결석 알림 | 결석 마킹 시 학부모에게 AmoebaTalk |

---

## 11. Module 9 — Trinity Pay (v1.3 핵심)

### 11.1 Scope

v1.3 의 세 가지 결정(**Toss Payments 직결 / 학원법 시행령 §18 수업일 기준 환불 / NTS Hometax eTax 자체 발행**)을 모두 수용하는 자체 결제/환불/세무 모듈. AMA 어떤 엔드포인트도 호출하지 않는다.

### 11.2 Screens

#### SCR-A-PAY-00 Pay Hub
- **Mockup**: `trinity-pay.html#hub`
- **레이아웃**: Decision Strip (Toss / 수업일 기준 / NTS 자체 3개 pill) → KPI 4종(이번달 결제·미수금·환불·세금계산서 미발행) → Alerts(NFR-013 D-5 / HSM 만료 D-28) → 최근 주문·최근 환불.

#### SCR-A-PAY-01 Orders List (주문 목록)
- **레이아웃**: 필터(기간·상태·결제수단) + 테이블(주문번호·학생·반·금액·Toss status·결제일). 상태 pill: READY / IN_PROGRESS / DONE / PARTIAL_CANCELED / CANCELED / ABORTED / EXPIRED.

#### SCR-A-PAY-02 Order Detail (주문 상세)
- **Mockup**: `trinity-pay.html#order-detail`
- **레이아웃**: 상단 주문 헤더(학생·반·금액·상태) → Toss 정보(paymentKey · method · approvedAt · 카드 마스킹) → Timeline(생성 → Confirm → Webhook → 상태 변화) → 영수증/세금계산서 섹션 → 환불 CTA.
- **보안**: 카드 PAN/CVC 저장 없음, `pg_payment_key` 토큰만.

#### SCR-A-PAY-03 Refund Calculator (환불 계산기)
- **Mockup**: `trinity-pay.html#refund`
- **레이아웃**: 좌 입력(주문 선택 · 환불 요청일) → 우 계산 결과. 4-row Tier 테이블(T0 pre-start 100% / T1 ≤33.3% 2/3 / T2 ≤50% 1/2 / T3 >50% 0) 중 현재 Tier 하이라이트. 계산 식 표시: `elapsed_ratio = 3/8 = 37.5% → T2` → 환불액 `₩190,000`.
- **불변식**: 주문 생성 시 스냅샷된 `refund_policy_version_id` 로만 계산 (정책 변경 소급 미적용).

#### SCR-A-PAY-04 Refund History (환불 이력)
- 테이블: 환불번호·주문·사유·금액·Toss cancel key·상태.

#### SCR-A-PAY-05 Tax Invoice List
- 발행 대기·발행 완료·승인·거절 탭.

#### SCR-A-PAY-06 Tax Invoice Detail (전자세금계산서 상세)
- **Mockup**: `trinity-pay.html#tax-invoice`
- **레이아웃**: 헤더(상태 pill: DRAFT/SUBMITTED/APPROVED/REJECTED) → 공급자·공급받는자·금액·품목 → XML Viewer (dark bg, 색 구분) → 제출 로그(공동인증서 HSM: TRINITY-HSM-01).

#### SCR-A-PAY-07 Receipts (영수증)
- 카드 영수증·현금영수증 템플릿. 학원 헤더 + 대시 border + 금색 총액.

#### SCR-A-PAY-08 Refund Policy Admin
- **레이아웃**: 버전 리스트(시행일 기준) + 편집. 각 버전: Tier 경계(elapsed_ratio) · 환불율(%) · 수수료(%). "이 버전을 기본으로 설정" 토글. 소급 미적용 주문 수 배지 표시.

### 11.3 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-100 | 주문 생성 | 학생/반/금액 + `refund_policy_version_id` 스냅샷 + Toss Widget 호출용 payment_intent |
| FN-101 | Toss 결제 확정 | Widget `successUrl` 콜백 → Confirm API → 내부 상태 `DONE`. Webhook v2 이중 수신 reconcile (idempotent) |
| FN-102 | 환불 계산 | `elapsed_ratio = held/total` → snapshot policy tier lookup → 환불액/수수료 산출 |
| FN-103 | 환불 실행 | Toss cancel API → 내부 `PARTIAL_CANCELED` or `CANCELED` → Ledger 기록 |
| FN-104 | Webhook 처리 | `TossPayments-Signature` HMAC 검증, idempotency, 5분 cron delta reconcile |
| FN-105 | 영수증 발급 | 카드/현금 영수증 PDF, `buyer_identifier` VARBINARY(128) 암호화 |
| FN-106 | NTS eTax 자체 발행 | DRAFT 저장 → SUBMITTED → APPROVED/REJECTED. 공동인증서 HSM/KMS 서명. 익월 10일 시한 (NFR-013), D-5 알림 |
| FN-107 | 환불정책 버전 관리 | 버전 생성·편집·기본설정, 기존 주문 스냅샷 보존 |
| FN-108 | 미수금 집계 | DRAFT/FAILED/EXPIRED 중 회수 대상 분리 |
| FN-109 | Pay Hub 경고 릴레이 | NTS D-day, HSM 만료, Webhook 지연을 `SCR-A-00` 으로 릴레이 |

---

## 12. Module 10 — Settings (설정)

### 12.1 Screens

#### SCR-A-SET-01 Academy Profile
- 학원명·주소·사업자번호·로고·연락처(포털 footer/영수증/세금계산서 공통 소스).

#### SCR-A-SET-02 Role & Permission
- 역할(원장/교무/교사/회계/영업) × 액션 매트릭스. RBAC.

#### SCR-A-SET-03 Notification Template
- AmoebaTalk 템플릿 변수 편집, 카카오 검수 상태.

### 12.2 Functions

| FN | Name | Description |
|----|------|-------------|
| FN-120 | Academy 프로필 편집 | 로고·주소·사업자번호 |
| FN-121 | 역할 매트릭스 | 액션 단위 권한 편집 |
| FN-122 | 알림톡 템플릿 | 변수 바인딩·검수상태 조회 |
| FN-123 | 공동인증서 등록 | HSM/KMS slot 등록, 만료일 모니터 |
| FN-124 | 감사로그 조회 | NFR-005 열람 이력 |

---

## 13. Cross-cutting Concerns (횡단 관심사)

### 13.1 Authentication / Session

- Portal: NextAuth Credentials(휴대폰 + OTP) / Parent 계정.
- Admin: NextAuth Credentials(이메일 + 비밀번호 + OTP 선택).
- 세션 저장: Redis(세션 hash + academy_id + role).
- NestJS Guard 가 `academy_id` 를 TypeORM QueryBuilder 에 global where 로 주입.

### 13.2 Audit & Privacy

- 모든 민감정보 읽기·복호화 이벤트는 `tac_audit_logs` 에 기록. 상세 화면 접근 + 필드 열람 분리.
- PII 필드(phone/email/주민번호 유사값)는 VARBINARY AES-GCM.

### 13.3 Error Conventions (에러 규칙)

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | DTO 검증 실패 |
| `UNAUTHORIZED` | 401 | 세션 없음/만료 |
| `FORBIDDEN` | 403 | 권한 부족 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `CONFLICT` | 409 | 중복·스케줄 충돌 |
| `BUSINESS_RULE_VIOLATION` | 422 | 금지된 상태 전이, 정책 위반 |
| `EXTERNAL_SERVICE_UNAVAILABLE` | 503 | Toss/AMA/NTS 장애 |

### 13.4 i18n

- 기본 ko. 영어는 Stage 2 에서 선택 적용 가능하도록 키 구조만 준비. 브랜드 카피(OMNIBUS OMNIA 등)는 **번역 금지**.

---

## 14. Traceability Matrix (추적 매트릭스)

| FR | FN | SCR | Mockup |
|----|----|-----|--------|
| FR-001 상담 접수 | FN-020 | SCR-P-06, SCR-A-C-01 | portal.html, consultation-student-teacher.html |
| FR-004 학생 등록 | FN-025, FN-030 | SCR-A-C-02, SCR-A-S-02 | consultation-student-teacher.html |
| FR-011 반 개설 | FN-052, FN-053 | SCR-A-P-02, SCR-A-P-03 | program-map-timetable.html |
| FR-016 출결 | FN-082 | SCR-A-TT-02 | program-map-timetable.html |
| FR-029 시간표 | FN-080 | SCR-A-TT-01 | program-map-timetable.html |
| FR-039 결제 | FN-100, FN-101 | SCR-A-PAY-02 | trinity-pay.html |
| FR-040 환불 | FN-102, FN-103 | SCR-A-PAY-03, SCR-A-PAY-04 | trinity-pay.html |
| FR-041 영수증 | FN-105 | SCR-A-PAY-07 | trinity-pay.html |
| FR-042 세금계산서 | FN-106 | SCR-A-PAY-05, SCR-A-PAY-06 | trinity-pay.html |
| FR-043~046 포털 | FN-110~FN-119 | SCR-P-01~10 | portal.html, portal-trinity-site.html |

---

## 15. Open Items (미결 사항)

| Q | Topic | Impact on screens/functions |
|---|-------|----------------------------|
| Q-016 | admin 서브도메인 분리 | v1.3 은 공통 도메인 경로 분리. 분리 시 SCR 변경 없음, 리버스 프록시만 교체 |
| Q-017 | News CMS vs 자체 DB | v1.3 자체 DB. CMS 전환 시 SCR-P-07/08 데이터 소스만 교체 |
| Q-019 | Toss Brandpay 자동결제 | v1.4. SCR-A-PAY-02 에 "Brandpay 토큰 연결" 버튼 자리만 준비 |
| Q-020 | 위약금(cancellation fee) | v1.4. SCR-A-PAY-03 의 환불 계산 결과에 `fee_override` 가능 필드만 설계 |
| Q-021 | 공동인증서 HSM vs KMS | v1.3 HSM 우선. SCR-A-SET-03 은 "슬롯 등록" UI 만 고정, 백엔드 구현은 어댑터 패턴 |

---

## 16. Reference Documents (참조 문서)

| Document | Path |
|----------|------|
| 요구사항 분석서 v1.3 | `docs/analysis/academy-management-requirements.md` |
| 기능 정의서 v1.3 (legacy 상세) | `docs/design/academy-management-func-definition.md` |
| 화면 구성안 v1.3 (legacy sitemap) | `docs/design/academy-management-screens.md` |
| 개발계획서 v1.3 | `docs/implementation/academy-management-dev-plan.md` |
| ERD v1.3 | `docs/design/academy-management-erd.md` |
| 프로세스 정의서 v1.3 | `docs/design/academy-management-process.md` |
| 시퀀스 다이어그램 v1.3 | `docs/design/academy-management-sequence.md` |
| DB Schema SQL | `sql/academy-management-schema.sql` |
| Hi-Fi Mockup 허브 | `docs/design/screens/index.html` |
| Hi-Fi Portal | `docs/design/screens/portal.html`, `portal-trinity-site.html` |
| Hi-Fi Admin Dashboard | `docs/design/screens/admin-dashboard.html` |
| Hi-Fi Consultation/Student/Teacher | `docs/design/screens/consultation-student-teacher.html` |
| Hi-Fi Program/MAP/Timetable | `docs/design/screens/program-map-timetable.html` |
| Hi-Fi Trinity Pay | `docs/design/screens/trinity-pay.html` |
| Design Tokens | `docs/design/screens/heraldic-tokens.css` |

---

*OMNIBUS OMNIA — 모든 이에게 모든 것이 되어.*
