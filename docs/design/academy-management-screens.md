# Trinity Academy 관리 솔루션 — 화면 구성안 (Screen Composition)

> **문서 버전**: v1.3.0
> **작성일**: 2026-04-19
> **작성자**: 김익용 (fremdung@gmail.com)
> **범위**: 전체 8 모듈 × Portal(학부모 대면) + Admin(내부 관리)
> **전제**: Next.js 14 App Router 모노레포 — 라우트 그룹 `(portal)` / `(admin)` 분리

---

## 1. 설계 원칙

Trinity Academy 의 화면 설계는 세 가지 기둥 위에서 작동한다.

첫째, **Heraldic Brand System 일관성**. 방패 문장, OMNIBUS OMNIA 표어, Navy/Gold/Cream 팔레트는 Portal 과 Admin 모두에서 공통 토큰으로 재사용된다. Admin 은 운영 생산성을 위해 Cream 배경 비중을 낮추고 Slate 계열을 추가로 섞지만, 악센트·타이포·아이콘 스타일은 동일한 DNA 를 유지한다.

둘째, **역할 기반 분리 (Role-based separation)**. 학부모·원생은 `(portal)` 라우트 그룹의 계정 없는 공개 페이지 + 로그인 후 Parent Dashboard 로 접근한다. 원장·교무·교사·회계는 `(admin)` 라우트 그룹의 역할별 메뉴 · 권한 · 대시보드를 받는다. 역할은 RBAC 로 관리되며 화면 단위가 아닌 액션 단위로 권한이 부여된다.

셋째, **AMA 와 Trinity Pay 의 구조적 고립**. Admin 에서 교사 마스터를 "생성" 할 수 있는 경로는 없다 — AMA Client 에서 동기화된 것만 조회·매핑한다. 반대로 결제·환불·세금계산서 화면은 AMA 어떤 엔드포인트도 호출하지 않는다 (C-003, NFR-013). 이는 시퀀스 다이어그램에서 해당 scenario 에 AMA 액터가 등장하지 않는 것과 짝을 이룬다.

---

## 2. Information Architecture (Sitemap)

### 2.1 Portal — `(portal)` 라우트 그룹

```
trinityacademy.kr/
├── /                        Home (P-01)
├── /about                   About & OMNIBUS OMNIA (P-02)
├── /programs                Programs 목록 (P-03)
│   └── /programs/[slug]     Program 상세 (P-04)
├── /map                     MAP Test 안내 (P-05)
├── /contact                 상담 접수 폼 (P-06)
├── /news                    News 목록 (P-07)
│   └── /news/[slug]         News 상세 (P-08)
├── /login                   학부모 로그인 (P-09)
└── /my                      Parent Dashboard (P-10)
    ├── /my/children          자녀 목록 + 선택
    ├── /my/children/[id]     자녀별 수업/성적/결제 요약
    ├── /my/timetable         시간표 조회
    ├── /my/scores            MAP 성적 조회
    └── /my/payments          결제 이력·영수증·세금계산서
```

### 2.2 Admin — `(admin)` 라우트 그룹

```
admin.trinityacademy.kr/
├── /dashboard                      KPI Dashboard (A-00)
├── /consultations                  상담 Kanban (A-C-01)
│   └── /consultations/[id]         상담 상세 (A-C-02)
├── /students                       학생 목록 (A-S-01)
│   └── /students/[id]              학생 상세 + TPI (A-S-02)
├── /parents                        학부모 목록 (A-S-03)
│   └── /parents/[id]               학부모 상세 (A-S-04)
├── /teachers                       교사 목록 (AMA Client mirror) (A-T-01)
│   └── /teachers/[id]              교사 상세 (A-T-02)
├── /programs                       프로그램 목록 (A-P-01)
│   ├── /programs/[id]              프로그램 상세 (A-P-02)
│   └── /programs/[id]/classes/[c]  클래스 상세 (A-P-03)
├── /map                            MAP 문제은행 허브 (A-M-00)
│   ├── /map/passages               지문 라이브러리 (A-M-01)
│   ├── /map/items                  문항 에디터 (A-M-02)
│   ├── /map/testsets               TestSet Builder (A-M-03)
│   ├── /map/assignments            응시 관리 (A-M-04)
│   └── /map/grading                채점 센터 (A-M-05)
├── /timetable                      주간 시간표 (A-TT-01)
│   └── /timetable/sessions/[id]    세션 상세 (A-TT-02)
├── /pay                            Trinity Pay 허브 (A-PAY-00)
│   ├── /pay/orders                 주문 목록 (A-PAY-01)
│   │   └── /pay/orders/[id]        주문 상세 (A-PAY-02)
│   ├── /pay/refund/[orderId]       환불 계산·처리 (A-PAY-03)
│   ├── /pay/policies               환불 정책 관리 (A-PAY-04)
│   ├── /pay/tax-invoices           세금계산서 목록 (A-PAY-05)
│   │   └── /pay/tax-invoices/[id]  세금계산서 상세 (A-PAY-06)
│   ├── /pay/ledger                 원장·일일 정산 (A-PAY-07)
│   └── /pay/receipts               영수증 목록 (A-PAY-08)
└── /settings                       시스템 설정 (A-SET-00)
    ├── /settings/academy           학원 기본 정보
    ├── /settings/users             내부 사용자·권한
    ├── /settings/ama               AMA 연동 상태
    └── /settings/notifications     AmoebaTalk 템플릿
```

---

## 3. Portal — 화면별 사양

### P-01 · Home
**경로**: `/`
**목적**: 트리니티 아카데미의 정체성(OMNIBUS OMNIA, Heraldic 브랜드, 프로그램 트리오)을 90초 안에 전달하고 상담 전환 유도.
**주요 컴포넌트**: Hero(문장+표어+CTA "상담 예약"), 프로그램 3 카드(영어·수학·MAP), 교사 슬라이더, 실적 배너(합격 학교 로고), News 미리보기 3, Footer.
**상태**: 초기 / 스크롤 진행 / 모바일 햄버거 오픈 / CTA hover.
**전이**: CTA → `/contact`, 프로그램 카드 → `/programs/[slug]`, 교사 클릭 → `/about#faculty`.

### P-02 · About & OMNIBUS OMNIA
**경로**: `/about`
**목적**: 학원 철학·연혁·교사진·시설 공개.
**주요 컴포넌트**: 표어 OMNIBUS OMNIA + 해설(고린도전서 9:22), 연혁 타임라인, 원장 인사, 교사진 그리드, 시설 갤러리.

### P-03 · Programs 목록
**경로**: `/programs`
**목적**: 운영 중 프로그램을 필터(과목 × 학년 × 레벨)로 탐색.
**주요 컴포넌트**: 필터 바(과목 RC/Math/Language · 학년 G2-G12 · 레벨 Basic/Intermediate/Advanced), 프로그램 카드 그리드(대표 이미지·목표·회차·가격), 정렬(인기/개설일/가격).

### P-04 · Program 상세
**경로**: `/programs/[slug]`
**목적**: 단일 프로그램 상세 + 클래스(시간대별) 목록 + 상담 CTA.
**주요 컴포넌트**: 프로그램 헤더, 목차(커리큘럼 주차별), 담당 교사, 클래스 목록(요일·시간·정원·빈자리), 결제·환불 정책 snapshot, 후기, 하단 CTA("상담 예약"/"MAP 진단 응시").

### P-05 · MAP Test 안내
**경로**: `/map`
**목적**: MAP 진단 테스트 개념·점수 체계·신청 유도.
**주요 컴포넌트**: MAP 스토리(G2-G5 × Basic/Intermediate/Advanced 구조), 샘플 지문 프리뷰, 점수 리포트 예시, 예약 폼.

### P-06 · 상담 접수 폼 (Consultation Intake)
**경로**: `/contact`
**목적**: 학부모·예비원생 정보 수집 → Admin 상담 Kanban 에 카드 생성.
**주요 컴포넌트**: 자녀 학년·관심 과목·희망 시간 다중선택, 보호자 연락처, 동의 체크(개인정보·마케팅 별도), reCAPTCHA, 제출 후 "상담사 24h 이내 연락" 안내.
**AMA 연계**: 제출 시 AmoebaTalk 알림이 원장에게 발송(담당자 지정 전).

### P-07 · News 목록 / P-08 · News 상세
**경로**: `/news`, `/news/[slug]`
**목적**: 학원 소식·합격 실적·행사 공지.
**주요 컴포넌트**: 카드 리스트(썸네일·카테고리 배지·발행일), 상세는 Markdown 렌더 + 관련 글 추천.

### P-09 · 학부모 로그인
**경로**: `/login`
**목적**: Parent Dashboard 접근.
**주요 컴포넌트**: 이메일/휴대폰 + SMS OTP 2단계. "아이 성적만 보려면 패스" 옵션 없음 — 보안 우선.

### P-10 · Parent Dashboard
**경로**: `/my`
**목적**: 자녀의 수업·성적·결제를 한눈에.
**주요 컴포넌트**: 자녀 스위처, 이번 주 시간표 5칸, 최근 MAP 점수 트렌드 차트, 미납/예정 결제 배지, 최근 영수증·세금계산서 다운로드.
**전이**: 결제 카드 → `/my/payments/[orderId]`, 성적 카드 → `/my/scores`.

---

## 4. Admin — 화면별 사양

### A-00 · KPI Dashboard
**경로**: `/dashboard`
**목적**: 원장·교무가 "오늘 무슨 일이 벌어지고 있는가"를 60초 안에 파악.
**주요 컴포넌트**: 4 KPI 카드(이번 달 수강생·월 매출·신규 상담·MAP 평균), 7일 매출 라인 차트, 상담 Kanban 5 열 미니뷰, 오늘의 수업 스케줄, 임박한 결제·환불·세금계산서 시한 알림.
**배지**: 학원법 환불 시한 근접 / 세금계산서 익월 10일 D-N / 공동인증서 만료 D-N (NFR-013).

### A-C-01 · 상담 Kanban
**경로**: `/consultations`
**목적**: 상담 pipeline(Intake → Visited → Quoted → Converted → Dropped)을 Kanban 으로 관리.
**주요 컴포넌트**: 5 열 Kanban, 카드(학생명·학년·관심과목·D+N·담당자), 우측 필터 패널, 상단 KPI(전환율·평균 소요일·이번 주 신규).
**액션**: 카드 드래그 = 상태 변경, 카드 클릭 = 상세 drawer.

### A-C-02 · 상담 상세
**경로**: `/consultations/[id]`
**목적**: 단일 상담의 전체 이력(Intake → Visit Record → Quote → Conversion).
**주요 컴포넌트**: 상단 요약, 탭(기본/방문기록/견적/컨버전), 방문기록 타임라인, 견적 작성(프로그램·할인·기간), 컨버전 버튼(→ `tac_students` 자동 생성).

### A-S-01 · 학생 목록
**경로**: `/students`
**목적**: 전체 원생 조회·필터·TPI 전개.
**주요 컴포넌트**: 테이블(이름·학년·프로그램·담당교사·상태·등록일), 필터(학년/상태/프로그램), bulk action(CSV export, AmoebaTalk 단체 발송).

### A-S-02 · 학생 상세 (TPI 카드)
**경로**: `/students/[id]`
**목적**: TPI 구조(학습 성향·목표·특이사항) + 수강·성적·결제 통합.
**주요 컴포넌트**: Hero(프로필 사진·학년·레벨·상태), TPI 패널(학습성향·목표·비고), 탭(수강 프로그램·MAP 성적·출석·결제·가족관계), 결제 카드는 Trinity Pay 에서 주문·영수증·세금계산서 링크.
**엑셀 grounding**: TPI 학생 정보.xlsx 의 4 시트 (활성/종료/구버전/상담) 구조 반영.

### A-S-03 · 학부모 목록 / A-S-04 · 학부모 상세
**경로**: `/parents`, `/parents/[id]`
**목적**: 학부모 1 N 학생(`primary_parent_id`) + M:N(`tac_student_guardians`) 구조 관리.
**주요 컴포넌트**: 학부모 카드에 연결된 자녀 칩, 소통 채널 선택(SMS/AmoebaTalk/Email), 결제 주체 설정.

### A-T-01 · 교사 목록 / A-T-02 · 교사 상세
**경로**: `/teachers`, `/teachers/[id]`
**목적**: AMA Client 마스터를 1:1 참조. 로컬 생성 불가 — 생성 버튼은 AMA 포털로 외부링크.
**주요 컴포넌트**: 테이블(이름·과목·담당 클래스 수·AMA Client ID 배지·last sync), 상세에 담당 클래스 리스트 + AMA 프로필 embed iframe.

### A-P-01 · 프로그램 목록 / A-P-02 · 프로그램 상세 / A-P-03 · 클래스 상세
**경로**: `/programs`, `/programs/[id]`, `/programs/[id]/classes/[c]`
**목적**: Program(커리큘럼 단위) > Program Setting(운영 버전) > Class(실제 시간대) 3계층.
**주요 컴포넌트**:
- 프로그램 카드(썸네일·과목 배지·레벨·정원·기간·운영 상태),
- 상세에 커리큘럼 트리(주차×차시),
- 클래스 상세에 요일·시간·강의실·담당교사·정원·현재 등록 학생 리스트 + `tac_class_sessions` 회차 목록.

### A-M-00 · MAP 허브
**경로**: `/map`
**목적**: MAP 모듈 네비게이션 + 최근 활동.
**주요 컴포넌트**: 5 블록 바로가기(Passages/Items/TestSets/Assignments/Grading), 최근 채점 대기 건 수, 오늘의 응시 예정 학생.

### A-M-01 · 지문(Passage) 라이브러리
**경로**: `/map/passages`
**목적**: RC 지문 업로드·분류·재사용.
**주요 컴포넌트**: 필터(Grade × Level × Topic × 출처), 테이블(제목·단어수·연관 문항수·난이도·태그), 업로드 모달(PDF/텍스트 + OCR).

### A-M-02 · 문항 에디터
**경로**: `/map/items`
**목적**: 문항 작성(유형·지문 연결·복수정답·Part A-B).
**주요 컴포넌트**: 좌측 문항 리스트, 우측 에디터(지문 pane + 문항 편집 pane), 복수 정답 설정, Part A-B 묶음, 해설 첨부.
**PDF grounding**: `[기출] MAP RC G2-5_Basic_저용답.pdf` 의 구조(Passage 1/2, 복수 정답, Part A-B) 반영.

### A-M-03 · TestSet Builder
**경로**: `/map/testsets`
**목적**: 문항을 조합하여 응시용 시험지 생성.
**주요 컴포넌트**: 드래그앤드롭 문항 선택 보드, 섹션·배점 설정, 미리보기, 자동 셔플 옵션, 응시 시간 설정.

### A-M-04 · 응시 관리 (Assignment)
**경로**: `/map/assignments`
**목적**: 학생·클래스에 TestSet 배정·응시 현황 추적.
**주요 컴포넌트**: 대상 선택(개인/그룹/클래스), 기간 설정, 응시 현황 진행바, 리마인더 발송.

### A-M-05 · 채점 센터
**경로**: `/map/grading`
**목적**: 자동 채점 + 서술형 수동 채점.
**주요 컴포넌트**: 채점 대기 큐, 답안 스캔 뷰어, 문항별 정답 비교, rubric 기반 수동 점수 입력, 리포트 미리보기·발행.

### A-TT-01 · 주간 시간표
**경로**: `/timetable`
**목적**: 전체 강의실·교사의 한 주를 한눈에.
**주요 컴포넌트**: 가로축 월~일, 세로축 시간 슬롯(30분 단위), 블록 = Class Session(색상 = 프로그램 계열). 필터(강의실/교사/프로그램).
**엑셀 grounding**: `수업 확인표.xlsx` 의 월별 15 시트, 초록=진행/빨강=결강 색상 규약 반영.
**인터랙션**: 블록 클릭 = 세션 상세 drawer, 드래그 = 시간 이동(권한 필요).

### A-TT-02 · 세션 상세
**경로**: `/timetable/sessions/[id]`
**목적**: 단일 수업 회차의 출결·교안·숙제·특이사항.
**주요 컴포넌트**: 출석 체크리스트(진행/결강/대체), 교안 업로드, 숙제 공지, 보강 일정 지정.

### A-PAY-00 · Trinity Pay 허브
**경로**: `/pay`
**목적**: 결제 영역 네비게이션 + 운영 지표.
**주요 컴포넌트**: KPI(이번 달 결제·환불·미납·세금계산서 미발행), 시한 경고 배너(학원법 환불·세금계산서 D-N), 최근 주문 10.

### A-PAY-01 · 주문 목록
**경로**: `/pay/orders`
**목적**: 주문 조회·필터.
**주요 컴포넌트**: 테이블(주문번호·학생·프로그램·금액·Toss status·정책버전·생성일·영수증/세금계산서 배지), Toss status 칩은 enum 7 종 색상으로 구분(READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED).

### A-PAY-02 · 주문 상세
**경로**: `/pay/orders/[id]`
**목적**: 단일 주문의 Toss 결제·원장·환불·영수증·세금계산서 통합.
**주요 컴포넌트**: Hero(주문번호·상태·금액·학생·정책 snapshot 버전), 탭(Timeline/Ledger/Receipts/Tax Invoice/Webhook log), 액션(부분취소·전액취소·세금계산서 재발행·영수증 재발송).

### A-PAY-03 · 환불 계산·처리 (수업일 기준)
**경로**: `/pay/refund/[orderId]`
**목적**: v1.3 핵심 — 수업일 기준 환불 금액 산출·승인·Toss 취소·원장 기록.
**주요 컴포넌트**:
- **정책 snapshot 카드**: `refund_policy_version_id` 와 해당 버전의 tier 목록.
- **경과 계산 카드**: `held_session_count / total_session_count = elapsed_ratio` 실시간 표시.
- **Tier 하이라이트 테이블**: 4 단계(pre-start 100% / ≤1/3 66.67% / ≤1/2 50% / >1/2 0%) 중 현재 구간 강조.
- **환불 금액 박스**: `FLOOR(payment_amount × refund_rate)` + 학원법 하한 안내.
- **액션**: "Toss 취소 호출 + 원장 insert(refund_tier_id, elapsed_ratio_at_refund)" 최종 승인.
**안전장치**: 학원법 하한 미달 시 차단(NFR-013).

### A-PAY-04 · 환불 정책 관리자
**경로**: `/pay/policies`
**목적**: `tac_pay_refund_policies` version 생성·수정(미래 effective_from), `tac_pay_refund_policy_tiers` 편집, audit log.
**주요 컴포넌트**:
- 정책 버전 리스트(버전·effective_from/to·템플릿 여부·생성자),
- 새 버전 생성 모달(미래 effective_from 강제),
- Tier 편집 테이블(elapsed_ratio_min/max + refund_rate, CHECK 제약 가시화),
- 학원법 시행령 제18조 기본값 seed 버튼,
- 변경 이력 타임라인.
**안전장치**: 과거 effective_from 차단, 학원법 하한 미달 tier 차단.

### A-PAY-05 · 세금계산서 목록
**경로**: `/pay/tax-invoices`
**목적**: `tac_pay_tax_invoices` 상태 추적.
**주요 컴포넌트**: 테이블(청구번호·공급가·세액·총액·NTS 상태·제출일·승인일·거절코드), 상태 칩(DRAFT/SUBMITTED/APPROVED/REJECTED), 시한 D-N 배지(익월 10일).

### A-PAY-06 · 세금계산서 상세
**경로**: `/pay/tax-invoices/[id]`
**목적**: 단일 전자세금계산서의 XML payload·PDF preview·NTS 응답·재시도.
**주요 컴포넌트**: 헤더(invoice_no, nts_issue_no), 공급자/공급받는자 섹션, 품목·금액 테이블, XML preview collapse, NTS 응답 로그(error_code/message), 액션(재전송/수정세금계산서 발행/PDF 다운로드).
**서명 플로우**: HSM/KMS 서명 → POST NTS → 응답 업데이트(NFR-013).

### A-PAY-07 · 원장·일일 정산
**경로**: `/pay/ledger`
**목적**: `tac_pay_ledger` 기반 일일·월별 정산.
**주요 컴포넌트**: 달력 히트맵, 일자 클릭 시 ledger 엔트리(결제·부분취소·환불·세금계산서 조정), 대사(PG 정산내역서 업로드 vs 자사 원장 diff).

### A-PAY-08 · 영수증 목록
**경로**: `/pay/receipts`
**목적**: 간이·현금영수증 조회·재발송.
**주요 컴포넌트**: 테이블(receipt_type 배지·cash_receipt_no·buyer_identifier 마스킹·발행일), 재발송 액션.
**주의**: 전자세금계산서는 이 화면에 나타나지 않는다 — `tac_pay_tax_invoices` 분리(v1.3).

### A-SET-00 · 시스템 설정
**경로**: `/settings/*`
**목적**: 학원 기본 정보, 내부 사용자·권한, AMA 연동 상태, AmoebaTalk 템플릿.
**주요 컴포넌트**:
- **AMA 연동 상태** 화면은 Client 수·last sync·교사 매핑 상태를 표시하고 sync 실패 시 경보.
- **공동인증서 상태** 배너가 만료 30일 전 NFR-013 에 따라 노출.

---

## 5. 컴포넌트 라이브러리 (공용)

Admin·Portal 공용으로 재사용되는 기본 블록.

| 컴포넌트 | 역할 | Trinity 적용 |
|----------|------|--------------|
| `HeraldShield` | 방패 문장 SVG | 로고·로딩·Empty state 일러스트 |
| `Button` | Primary(Navy)·Secondary(Gold outline)·Ghost | 주요 CTA 는 Gold, 위험 액션은 Crimson |
| `Badge` | 상태 표시 | Toss status 7 종 · 환불 tier · NTS status |
| `StatCard` | KPI | 대시보드 |
| `DataTable` | 페이지네이션·필터·CSV | 목록형 화면 전부 |
| `Drawer` | 상세 패널 | Kanban 카드 클릭·세션 상세 |
| `Timeline` | 타임라인 | 상담 이력·결제 webhook log |
| `KanbanBoard` | 5 열 보드 | 상담 |
| `WeekGrid` | 주간 시간표 블록 | 시간표 |
| `CurrencyInput` | 원(KRW) 입력 | 결제·환불·세금계산서 |
| `RefundCalculator` | 수업일 기준 계산기 | A-PAY-03 전용 |
| `TaxInvoiceXmlViewer` | 전자세금계산서 XML 뷰어 | A-PAY-06 |
| `AmaSyncStatus` | AMA Client 동기화 상태 | 교사·설정 |
| `HeraldicDivider` | 장식용 구분선 (방패 문양 중앙) | Portal |

---

## 6. 역할별 네비게이션 (RBAC)

| 역할 | 접근 가능 메뉴 |
|------|---------------|
| 원장(Owner) | 전체 |
| 교무(Academic) | Consultations, Students, Parents, Teachers(read), Programs, MAP, Timetable, Pay(read), Settings(일부) |
| 교사(Teacher) | 내 클래스 세션, 출석, MAP 채점(자신 담당) |
| 회계(Accountant) | Trinity Pay 전체, Settings(AMA/공동인증서 read-only) |
| 학부모(Parent) | Portal My Dashboard 만 |

---

## 7. User Flow (주요 전환)

### 7.1 Portal — 신규 상담 → 등록
`Home (P-01)` → `Programs (P-03)` → `Program 상세 (P-04)` → CTA "상담 예약" → `Contact (P-06)` → 제출 → (Admin 측 `Consultation Kanban (A-C-01)` 생성) → 상담사 → `Consultation Detail (A-C-02)` 컨버전 → `Student (A-S-02)` 자동 생성 → `Program Detail (A-P-02)` 클래스 배정 → `Trinity Pay Order (A-PAY-02)` 결제 링크 발송.

### 7.2 Admin — 월말 정산
`Dashboard (A-00)` 시한 배너 → `Tax Invoices (A-PAY-05)` 미발행 필터 → 일괄 발행 → `Tax Invoice Detail (A-PAY-06)` NTS 응답 확인 → 거절건 재전송 → `Ledger (A-PAY-07)` 대사 완료.

### 7.3 Admin — 환불 처리
`Order List (A-PAY-01)` → `Order Detail (A-PAY-02)` → "환불 요청" → `Refund Calculator (A-PAY-03)` → 정책 snapshot + 경과 계산 확인 → 승인 → Toss 취소 호출 → 원장 insert + AmoebaTalk 알림 발송.

### 7.4 Admin — MAP 진단 + 성적 리포트
`Map Hub (A-M-00)` → `TestSet Builder (A-M-03)` 구성 → `Assignment (A-M-04)` 대상 지정 → 학생 응시 → `Grading (A-M-05)` 채점 → 리포트 발행 → 학부모 `Portal My Scores` 에서 조회.

---

## 8. 반응형 & 접근성

**브레이크포인트**: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. Admin 은 `lg` 이상 최적화, `md` 이하는 상세 뷰만 허용.

**접근성**: WCAG 2.1 AA 기준 — Navy/Gold 조합은 본문 대비비 검증 필수, 방패 SVG 는 `<title>` 라벨, 데이터 테이블은 `<caption>` + `scope` 속성.

**국제화**: 기본 ko-KR, 향후 en-US 확장 대비 문구는 i18n key 로 분리. 날짜·통화는 로캘 기반.

---

## 9. 문서·코드 상호 참조

| 화면군 | 요구사항 (FR) | 기능정의 (FN) | 프로세스 (PRC) | 시퀀스 (Scenario) |
|--------|---------------|----------------|----------------|--------------------|
| Portal 상담 접수 (P-06) | FR-007~009 | FN-010~012 | PRC-010 | 1 |
| Admin 상담 (A-C-*) | FR-010~013 | FN-013~020 | PRC-011 | 2 |
| Student (A-S-02) | FR-014~018 | FN-021~030 | PRC-012 | 3 |
| Teacher (A-T-*) | FR-019~021 | FN-031~035 | PRC-013 | 4 |
| Program/Class (A-P-*) | FR-022~027 | FN-040~052 | PRC-020 | 5 |
| MAP (A-M-*) | FR-028~035 | FN-060~082 | PRC-040 | 6, 7 |
| Timetable (A-TT-*) | FR-036~038 | FN-090~097 | PRC-060 | 8 |
| Trinity Pay 결제 (A-PAY-02) | FR-039, 040 | FN-100, 101 | PRC-070 | 10 |
| 환불 (A-PAY-03/04) | FR-041, 047 | FN-102, 107 | PRC-075 | 12 |
| 세금계산서 (A-PAY-05/06) | FR-048 | FN-106 | PRC-076 | 13 |
| 영수증 (A-PAY-08) | FR-042 | FN-103 | PRC-071 | 11 |

---

## 10. 산출물 인덱스 (HTML 목업)

실제 시각적 목업은 `docs/design/screens/` 하위에 모듈별 HTML 파일로 구축된다.

| 파일 | 포함 화면 |
|------|-----------|
| `screens/index.html` | 네비게이션 허브 |
| `screens/portal.html` | P-01 ~ P-10 |
| `screens/admin-shell.html` | Admin 레이아웃 + A-00 Dashboard |
| `screens/consultation.html` | A-C-01, A-C-02 |
| `screens/student-family.html` | A-S-01~04 |
| `screens/teacher.html` | A-T-01, A-T-02 |
| `screens/program.html` | A-P-01~03 |
| `screens/map.html` | A-M-00~05 |
| `screens/timetable.html` | A-TT-01, A-TT-02 |
| `screens/trinity-pay.html` | A-PAY-00~08 |
| `screens/settings.html` | A-SET-00 |
