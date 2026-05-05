---
document_id: ACM-REQ-DSH-002
version: 1.0.0
status: Draft
created: 2026-05-05
product_code: ACM
module: DSH (Dashboard / 대시보드)
source: docs/reference/[TPI] Master.xlsx · INDEX sheet
---

# ACM DSH — INDEX 시트 기반 대시보드 개선 요구사항 분석서

## 1. 배경 (Background)

`/admin/dashboard` 는 이미 INDEX 시트와 동일한 구조의 일별 KPI 그리드(Marketing / CS / Operating / Class · 19 metric)를 노출한다. 그러나 (1) 시트의 5개월 실데이터가 DB 에 시드되어 있지 않아 화면이 빈 그리드로만 보이고, (2) 그리드 외에는 월간 합계 · 전월 대비 · 카테고리 추세를 한눈에 파악할 위젯이 없다.

본 작업은 **INDEX 시트의 현 데이터를 모두 입력**하고, 그 데이터를 활용해 **대시보드 첫 화면을 KPI 카드 + 추세 미니차트 + 기존 그리드의 3-tier 레이아웃으로 개선**한다.

---

## 2. 원천 데이터 분석 (Source Data)

### 2-1. INDEX 시트 구조

| 행 영역 | 의미 |
|---------|------|
| row 1–2 | 카테고리/메트릭 헤더 (Marketing · CS · Operating · Class) |
| row 3, 36, 66, 99, 131 | 월별 **Sum** 행 (`12월 / 1월 / 2월 / 3월 / 4월`) |
| row 4, 37, 67, 100, 132 | 월별 **Aver.** 행 |
| row 5–35 등 | 일별 데이터 (`Day`, `MS`=요일, 19 metric) |

### 2-2. 데이터 범위

- 일별 실데이터: **12월(31일) + 1월(28일) + 2월(31일) + 3월(31일) ≒ 121일**
- 4월: Sum 만 존재(일별 데이터 없음) → 시드 제외
- 연도 추정: row5 `12월 1일=목` → **2022-12-01** 기준으로 시드 (확정 아님 — Q-DSH-01 참조)

### 2-3. 메트릭 매핑 (시트 컬럼 ↔ DB 컬럼)

| 카테고리 | 시트 컬럼 | met_code | DB 컬럼 (`amb_acm_dsh_daily_kpi.dkp_*`) |
|----------|----------|----------|-------------------------------------------|
| Marketing | Visitor | mkt_visitor | marketing_visitor |
| Marketing | Cost | mkt_cost | marketing_cost |
| Marketing | Effect | mkt_effect | marketing_effect |
| CS | Counseling | cs_counseling | cs_counseling |
| CS | Apply | cs_apply | cs_apply |
| CS | Beginning | cs_beginning | cs_beginning |
| CS | Missing | cs_missing | cs_missing |
| CS | Trial Class | cs_trial_class | cs_trial_class |
| CS | Complain | cs_complain | cs_complain |
| Operating | New St. | ops_new_st | ops_new_st |
| Operating | Out St. | ops_out_st | ops_out_st |
| Operating | # of St. | ops_count_st | ops_count_st |
| Operating | New Tc. | ops_new_tc | ops_new_tc |
| Operating | Out Tc. | ops_out_tc | ops_out_tc |
| Operating | # of Tc. | ops_count_tc | ops_count_tc |
| Class | Map Test | cls_map_test | class_map_test |
| Class | Tt. Class | cls_tt_class | class_tt_class |
| Class | Student | cls_student | class_student |
| Class | Teacher | cls_teacher | class_teacher |

→ 메트릭 코드는 이미 백엔드 `metric_definitions` 시드와 일치함. **추가 메트릭 정의 불필요.**

---

## 3. 목표 (Goals) & 비목표 (Non-Goals)

### 3-1. Goals
- G1. INDEX 시트 4개월 일별 실데이터(약 121행) 를 `amb_acm_dsh_daily_kpi` 시드 SQL 로 입력
- G2. 대시보드 상단에 **카테고리별 월간 KPI 요약 카드** 추가 (Sum · Aver · 전월대비 Δ%)
- G3. 카드별로 **일별 추세 sparkline** 표출
- G4. 월 셀렉터에서 시드된 모든 월(2022-12 ~ 2023-03) 선택 가능
- G5. 월 단위 CSV 다운로드 버튼 추가

### 3-2. Non-Goals
- 학생/강사/수업 등 다른 도메인 데이터를 dashboard 로 끌어오는 자동 집계 파이프라인 (별도 작업)
- 4월 부분 데이터 시드 (원본 부재)
- 다년도 trend 분석 (현 단계는 월 단위 화면)

---

## 4. 기능 요구사항 (FR)

| ID | 기능 | 설명 |
|----|------|------|
| FR-01 | INDEX 데이터 시드 | 121행 `INSERT ... ON CONFLICT (ent_id, dkp_date) DO UPDATE` 로 멱등 시드 |
| FR-02 | KPI 요약 카드 | 카테고리(4개) × {Sum, Aver, MoM Δ%} 3-row 카드 그리드 |
| FR-03 | Sparkline | 카드 우측에 30px 높이 sparkline(SVG, 외부 lib 미사용) |
| FR-04 | 전월대비 Δ% | `(이번달 합계 − 전월 합계) / 전월 합계 × 100`, 전월 데이터 없으면 `—` |
| FR-05 | 월 셀렉터 확장 | 시드된 모든 yearMonth + 현재 ±1 월 표시. API `/acm/dsh/year-months` 신설 |
| FR-06 | CSV 다운로드 | "CSV 다운로드" 버튼 클릭 시 현 월 grid 를 RFC4180 CSV 로 export |
| FR-07 | 그리드 빈 셀 표시 개선 | `dataCompleteness=PARTIAL_FUTURE` 인 셀은 회색 `—`, `PARTIAL_PENDING_MANUAL` 은 점선 박스 |

---

## 5. 비기능 요구사항 (NFR)

- NFR-01. KPI 카드 + 그리드 동시 렌더링 시 LCP < 1.5s (시드 121일 기준 grid 30 rows)
- NFR-02. 시드 SQL 멱등성 — 재실행 시 row 중복/오염 없음
- NFR-03. 다국어(ko/en) 모두 카드/버튼 라벨 적용 (`dsh.json` namespace)
- NFR-04. 권한: 기존 dashboard 와 동일 (`role IN ('ADMIN','MANAGER')`)
- NFR-05. 멀티테넌트: 시드는 `ent_id = '00000000-0000-0000-0000-000000000001'` (Trinity 데모 테넌트) 한정

---

## 6. 인수 기준 (Acceptance Criteria)

| AC | 시나리오 | 기대 결과 |
|----|---------|-----------|
| AC-01 | 시드 SQL 실행 후 `SELECT COUNT(*) FROM amb_acm_dsh_daily_kpi WHERE ent_id=...` | 121 |
| AC-02 | `/admin/dashboard` 진입 (월=2023-01) | KPI 카드 4개 노출, 각 카드에 Sum/Aver/Δ%/sparkline 표시, 그리드에 1월 일별 31행 |
| AC-03 | 월=2022-12 (가장 첫 달) 선택 | Δ% 자리에 `—` (전월 없음) |
| AC-04 | 월=2023-04 선택 | grid 비어있으나 카드는 0/`—` 표시(에러 없음) |
| AC-05 | 시드 SQL 두번 실행 | 행 수 변동 없음 (idempotent) |
| AC-06 | "CSV 다운로드" 클릭 | `dsh-2023-01.csv` 다운로드, 헤더 + 31행 + Sum/Aver 2행 |
| AC-07 | EN 언어 전환 | 카드/버튼 라벨이 영문으로 표시 |
| AC-08 | 비관리자 계정 접근 | 403 / 사이드바 메뉴 미노출 (기존 동작 유지) |

---

## 7. 의존성 / 영향 (Dependencies & Impact)

- **재사용**: `amb_acm_dsh_metric_definitions`, `amb_acm_dsh_daily_kpi` (스키마 변경 없음)
- **신규 API**: `GET /acm/dsh/year-months`, `GET /acm/dsh/monthly-summary?yearMonth=...`
- **프론트 신규 컴포넌트**: `dsh/components/kpi-summary-cards.tsx`, `dsh/components/sparkline.tsx`
- **i18n 키 추가**: `dsh.summary.*`, `dsh.actions.exportCsv`
- 기존 manual-input/complaint dialog · grid table 동작은 변경 없음 (호환성 유지)

---

## 8. 미결 사항 (Open Questions)

| ID | 내용 | 임시 결정 |
|----|------|----------|
| Q-DSH-01 | INDEX 시트 시작 연도(년 표기 없음) | 12월1일=목 매칭으로 **2022-12-01** 가정. 사용자 확인 필요 |
| Q-DSH-02 | sparkline 라이브러리 vs 자체 SVG | 자체 SVG (의존성 최소화) |
| Q-DSH-03 | CSV 인코딩 | UTF-8 BOM 부착 (Excel 호환) |
| Q-DSH-04 | `MARKETING/Effect` 의 단위 | 시트상 정수 카운트 — 현 스키마 그대로 int 유지 |

---

## 9. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-05-05 | 초안 작성 |
