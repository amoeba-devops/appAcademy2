---
document_id: ACM-PLN-DSH-002
version: 1.0.0
status: Draft
created: 2026-05-05
product_code: ACM
module: DSH (Dashboard / 대시보드)
req_ref: ACM-REQ-DSH-002
---

# ACM DSH — INDEX 시트 기반 대시보드 개선 작업 계획서

## 1. 목표 (Objective)

(1) `[TPI] Master.xlsx` INDEX 시트 4개월 일별 실데이터(약 121행)를 `amb_acm_dsh_daily_kpi` 시드 SQL 로 입력하고, (2) `/admin/dashboard` 상단에 KPI 요약 카드 + sparkline + CSV export 를 추가하여 시각적 가독성을 개선한다.

---

## 2. 화면 구성안 (UI Layout Mockup)

### 2-1. AS-IS (현재)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard                       [2023-01 ▼] [Manual] [+ Complaint] │
├─────────────────────────────────────────────────────────────────────┤
│  │ Day│DOW│ Marketing      │ CS              │ Operating  │ Class  │
│  │  1 │목 │ 25  5,335   0  │ 0 0 0 0 0 0     │ 0 0 39 ... │ ...    │
│  │  2 │금 │ 38 12,397   4  │ 2 2 3 0 1 0     │ 1 2 38 ... │ ...    │
│  │ …  │ … │   …            │   …             │   …        │   …    │
│  │ Sum│ — │ 805  ...       │ 19  8  ...      │  5  ... 39 │ ...    │
│  │ Aver│ — │ 25.9 ...      │ 0.6 0.3 ...     │ 0.2 ...    │ ...    │
└─────────────────────────────────────────────────────────────────────┘
```
→ 한 화면에 grid 만 노출. 월간 트렌드/전월대비 가독성 낮음.

### 2-2. TO-BE (개선)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                  [2023-01 ▼] [↓ CSV] [✎ Manual] [+ Complaint]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─ Marketing ──────────┐ ┌─ CS ─────────────┐                              │
│  │ Visitor              │ │ Counseling       │                              │
│  │  Sum 805  Aver 25.9  │ │  Sum 19  Aver 0.6│   ← 4 개 카테고리 카드      │
│  │  ▲ +10.3% vs 전월   │ │  ▼ -5% vs 전월  │                               │
│  │  ▁▂▃▅▆▇▆▅▃▂▁  (spark)│ │  ▁▁▂▃▂▁▁▁▂  ()  │                               │
│  └──────────────────────┘ └──────────────────┘                              │
│  ┌─ Operating ──────────┐ ┌─ Class ──────────┐                              │
│  │ # of Students  39    │ │ Map Test  Sum 7  │                              │
│  │  Δ Net  -2 (in/out)  │ │  Tt.Class Sum 290│                              │
│  │  ▇▇▇▇▇▆▆▆▆▆ (level)  │ │  ▂▃▅▆▇▆▅▃▂ ()   │                               │
│  └──────────────────────┘ └──────────────────┘                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ▼ 일별 상세 (Daily Grid) — 기존 그리드 그대로 유지                          │
│  │ Day│DOW│ Marketing      │ CS              │ Operating  │ Class  │       │
│  │  1 │목 │ 25  5,335   0  │ 0 0 0 0 0 0     │ 0 0 39 ... │ ...    │       │
│  │ …  │ … │   …            │   …             │   …        │   …    │       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2-3. KPI 카드 컴포넌트 상세

```
┌─ <Category Name> ─────────────────────────────┐
│ <대표 메트릭 라벨>                             │
│   Sum  <NNN>     Aver  <NN.N>                │
│   <▲|▼|—> <NN.N%> vs prev month              │
│   <sparkline 30px height, 100% width>         │
└───────────────────────────────────────────────┘
```
- 카테고리 → 대표 메트릭 매핑:
  - MARKETING → `mkt_visitor`
  - CS → `cs_counseling`
  - OPERATING → `ops_count_st` (status snapshot — Δ Net = newSt − outSt 로 표시)
  - CLASS → `cls_tt_class`
- Δ% 색상: 양수 = `var(--color-success)`, 음수 = `var(--color-danger)`, 0/null = secondary
- OPERATING 의 `ops_count_st` 는 STATUS_SNAPSHOT 이므로 **평균 대신 월말 값**, Δ는 net = sum(new)−sum(out)

---

## 3. Task 분해 (WBS)

### Phase A — 데이터 (Data)

| ID | Task | 산출물 | 의존 |
|----|------|--------|------|
| A1 | INDEX 시트 121행 → SQL 변환 스크립트 작성 | `scripts/build-dsh-index-seed.py` | — |
| A2 | 시드 SQL 생성 | `sql/acm/700-seed-dsh-index-data.sql` | A1 |
| A3 | 로컬 적용 + 행수 검증 (AC-01, AC-05) | psql 실행 결과 | A2 |

### Phase B — 백엔드 (Backend)

| ID | Task | 산출물 | 의존 |
|----|------|--------|------|
| B1 | `GET /acm/dsh/year-months` (시드된 yearMonth distinct) | usecase + controller | A3 |
| B2 | `GET /acm/dsh/monthly-summary` (카테고리별 Sum/Aver + 전월 비교) | usecase + DTO | A3 |
| B3 | sparkline 용 일별 시계열 포함 (대표 메트릭만) | B2 응답에 `seriesByCategory` 추가 | B2 |
| B4 | 통합 테스트 (jest-int) — 2개 신규 엔드포인트 | `test/integration/dsh-summary.spec.ts` | B1, B2, B3 |

### Phase C — 프론트엔드 (Frontend)

| ID | Task | 산출물 | 의존 |
|----|------|--------|------|
| C1 | `KpiSummaryCards` 컴포넌트 | `frontend-acm/src/modules/dsh/components/kpi-summary-cards.tsx` | B2 |
| C2 | `Sparkline` 자체 SVG 컴포넌트 | `frontend-acm/src/modules/dsh/components/sparkline.tsx` | — |
| C3 | `DashboardPage` 상단 카드 영역 + 월 셀렉터를 `/year-months` 응답으로 채우기 | `dashboard-page.tsx` 수정 | C1, B1 |
| C4 | CSV export 유틸 + "CSV 다운로드" 버튼 | `dsh/lib/export-csv.ts`, page 버튼 | — |
| C5 | i18n 키 추가 (ko/en) — `dsh.summary.sum/aver/momDelta/exportCsv` | `frontend-acm/src/i18n/{ko,en}/dsh.json` | C1, C4 |
| C6 | 그리드 빈 셀 표시 개선 (FR-07) | `dashboard-page.tsx` td 클래스 분기 | — |

### Phase D — 검증 & 배포 (Verify & Deploy)

| ID | Task | 산출물 | 의존 |
|----|------|--------|------|
| D1 | E2E 수동 시나리오 실행 (AC-01~AC-08) | TR 보고서 | C6, B4 |
| D2 | 스테이징 배포 (`scripts/deploy-staging.sh`) | 배포 로그 | D1 |
| D3 | 운영 데모 확인 (`https://acm-stg.amoeba.site/admin/dashboard`) | 스크린샷 | D2 |

---

## 4. 데이터 모델 변경

- **DDL 변경 없음.** 기존 `amb_acm_dsh_*` 4개 테이블 그대로 사용.
- 시드 한정 추가:
  - `sql/acm/700-seed-dsh-index-data.sql` — 121 INSERT (`ON CONFLICT DO UPDATE`)
  - `dkp_computation_status='FRESH'`, `dkp_data_completeness='COMPLETE'`, `dkp_computed_at=NOW()` 고정
  - `ent_id='00000000-0000-0000-0000-000000000001'` (Trinity 데모)

---

## 5. API 스펙 (Backend)

### 5-1. `GET /acm/dsh/year-months`
```jsonc
// Response
{ "data": ["2022-12","2023-01","2023-02","2023-03","2023-04"] }
```

### 5-2. `GET /acm/dsh/monthly-summary?yearMonth=2023-01`
```jsonc
{
  "yearMonth": "2023-01",
  "previousYearMonth": "2022-12",
  "categories": [
    {
      "category": "MARKETING",
      "primaryMetricCode": "mkt_visitor",
      "sum": 805, "aver": 25.97,
      "previousSum": 730, "momDeltaPct": 10.27,
      "series": [25,38,21,15,18, /* …31 days */ ]
    },
    /* CS, OPERATING, CLASS … */
  ]
}
```

---

## 6. 프론트엔드 컴포넌트 트리

```
DashboardPage
 ├─ Header (title + month select + CSV/Manual/Complaint buttons)
 ├─ KpiSummaryCards
 │    └─ KpiCard × 4
 │         └─ Sparkline
 ├─ DailyGridTable  (existing)
 ├─ ManualInputDialog (existing)
 └─ ComplaintDialog (existing)
```

---

## 7. 일정 (Sequencing)

```
A1 → A2 → A3 ─┬─ B1 ─┐
              ├─ B2 ──┼─ B4 ─┐
              └─ B3 ──┘      │
                             ├─ C1, C3 → C5
              C2 ──────────────┘
              C4, C6 ─────────────────────┐
                                          ├─ D1 → D2 → D3
                                          B4 ┘
```

마일스톤은 시간 추정 없이 **승인 후 순차 진행**.

---

## 8. 리스크 (Risks) & 완화책

| ID | 리스크 | 영향 | 완화 |
|----|--------|------|------|
| R1 | INDEX 시트 시작 연도 추정 오류 | 시드 날짜가 실제와 불일치 | Q-DSH-01 사용자 확인 후 시드 빌드 |
| R2 | 121행 INSERT 트랜잭션이 다른 시드와 충돌 | 시드 실행 실패 | `ON CONFLICT DO UPDATE` 멱등 처리 |
| R3 | sparkline 렌더가 grid 높이를 키워 LCP 저하 | NFR-01 위반 | 카드 영역 fixed height + memoize |
| R4 | CSV 한글 깨짐 | 운영진 사용성 저하 | UTF-8 BOM(`\uFEFF`) 부착 |
| R5 | 다른 테넌트에 동일 데이터 노출 | 멀티테넌트 격리 위반 | 시드 `ent_id` 단일 테넌트 한정, 쿼리 전체 `ent_id` 필터 점검 |

---

## 9. 테스트 전략

| 레벨 | 대상 | 도구 |
|------|------|------|
| Unit (FE) | sparkline path 계산, CSV 직렬화 | vitest |
| Unit (BE) | monthly-summary usecase (sum/aver/Δ%) | jest |
| Integration (BE) | 2개 신규 endpoint, 시드 데이터 기반 | jest-int |
| Manual / E2E | AC-01 ~ AC-08 | 수동 + Playwright(선택) |

상세 TC 는 사용자 승인 후 `docs/test/TC-260505-acm-dsh-index-data-improvement.md` 로 작성한다.

---

## 10. 후속 작업 (Out of scope · 차기)

- 자동 집계 파이프라인 (CSL/CLS/STD 도메인 → daily_kpi 자동 채움)
- 다년도 trend 비교 (year-over-year)
- 권한별 카드 가시성 제어 (e.g., MARKETING 카드는 마케팅 매니저만)
- AmoebaTalk 일일 KPI 푸시

---

## 11. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2026-05-05 | 초안 작성 |
