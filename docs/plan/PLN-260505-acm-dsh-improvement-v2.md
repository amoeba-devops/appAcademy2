---
document_id: ACM-DSH-PLN-260505-v2
version: 1.0
status: DRAFT
related: REQ-260505-acm-dsh-improvement-v2.md
change_log:
  - 2026-05-05 GD initial draft
---

# PLN-260505 · ACM 대시보드 v2 작업 계획

## 1. Task Breakdown

### Phase A — DB 마이그레이션 (15min)
- A-1. `sql/acm/120-migration-dkp-manual-override.sql` 생성
  - `ALTER TABLE amb_acm_dsh_daily_kpi ADD COLUMN dkp_manually_overridden BOOLEAN NOT NULL DEFAULT false;`
  - `CREATE INDEX idx_acm_dsh_dkp_overridden ON amb_acm_dsh_daily_kpi (ent_id, dkp_manually_overridden) WHERE dkp_manually_overridden;`

### Phase B — 백엔드 (90min)
- B-1. `daily-kpi.typeorm-entity.ts`: `manuallyOverridden` 필드 추가.
- B-2. `daily-kpi.service.ts`:
  - `getRange(entId, from, to)` 신규 — `where: date BETWEEN`. sums/averages 동일 로직.
  - `getMonthGrid` / `getRange` 응답에서 `marketingEffect = csCounseling + csApply`로 override 후 sum 재계산.
  - `recomputeDay`: 수동 override true이면 early return.
- B-3. `monthly-summary.service.ts`:
  - `getRangeSummary(entId, from, to)` 추가. prev 범위는 같은 길이 직전 구간.
  - 카테고리 응답을 `metrics: MetricSummary[]` 배열로 변경 (3개 메트릭).
  - 기존 `getMonthlySummary` 유지 + 내부적으로 range로 위임.
- B-4. `dashboard.controller.ts`:
  - `GET /acm/dsh/daily-kpi-range?from&to` (가드 검증: from≤to, ≤365일).
  - `GET /acm/dsh/range-summary?from&to`.
  - `PUT /acm/dsh/daily-kpi-manual/:date` (UpsertDailyKpiManualDto, 19개 metric optional).
- B-5. `daily-kpi-manual.dto.ts` 신규.
- B-6. tsc + 단위 호출 smoke.

### Phase C — 프론트 (120min)
- C-1. `dashboard-page.tsx` 전면 리팩토링:
  - 월 셀렉터 → `from/to` date input + 5개 프리셋 버튼.
  - URL query sync(useSearchParams).
  - `gridQ` → `/daily-kpi-range`. `summaryQ` → `/range-summary`.
  - 일자 컬럼: 월 변경 행 위에 `<tr class="bg-surface-subtle"><td colSpan>{yearMonth}</td></tr>` 삽입.
- C-2. `kpi-summary-cards.tsx`:
  - props 타입 변경: `metrics: MetricSummary[]` (배열).
  - 카드 내부 mini 테이블 (3행 × 라벨/Sum/Avg/Δ%).
- C-3. `manual-input-dialog.tsx` 풀필드 리팩토링:
  - 4개 fieldset로 19개 메트릭.
  - effect는 readOnly + 자동계산 안내.
  - DialogContent에 `max-h-[85vh] overflow-y-auto`, footer sticky.
  - mutation: `PUT /acm/dsh/daily-kpi-manual/:date`.
- C-4. i18n 4종 키 추가:
  - `actions.preset.{thisMonth,lastMonth,last30,last90,custom}`
  - `manualInput.fields.{19개 metric}`
  - `manualInput.effectAutoNote`
  - `summary.headers.{label,sum,avg,delta}`
- C-5. tsc.

### Phase D — 배포 + 검증 (30min)
- D-1. 커밋, push, staging deploy.
- D-2. DB 컬럼 추가 확인.
- D-3. 브라우저 smoke: range 조회, 카드 표시, 수동입력 저장.
- D-4. RPT-260505-acm-dsh-improvement-v2.md 작성.

## 2. UI 화면 구성안

### 2.1 대시보드 페이지 (TO-BE)
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Dashboard                                          [CSV] [수동입력] [컴플레인+]│
│                                                                              │
│ 기간: [2026-01-01] ~ [2026-04-30]                                            │
│       [이번달] [지난달] [최근30일] [최근90일] [사용자지정]                       │
│ * 113일 중 113일 데이터 입력됨 · 직전 기간 대비 비교                              │
│                                                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ MARKETING    │ │ CS           │ │ OPERATING    │ │ CLASS        │         │
│ │              │ │              │ │              │ │              │         │
│ │ 방문자  Sum 4,521 Avg 40 ▲ +12% │ 상담  37  0.3 ▼ -5% │ 학생수  39  ─ ▲+8%│ │
│ │ 전체비용 12.3M 109K  ▲ +20%    │ 지원  18  0.2 ▲+10% │ 강사수  10  ─  ─ │ │
│ │ 효과    55  0.5  ▲ +15%        │ 체험  8   0.1  ▼-2% │ 신입생  7  0.1 ▲ │ │
│ │  ╱╲╱╲╱╲╱╲╱╲╱╲                │ ╱╲╱╲╱╲╱╲                │ ─────────  │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Day │ DOW │ MARKETING ··· │ CS ··· │ OPERATING ··· │ CLASS ··· │       │ │
│ │ ─── 2026-04 ────────────────────────────────────────────────────────  │ │
│ │ 04-23│목  │ 14  /  ─  / 0 │ 0/0/0/0/0/0 │ 0/0/20/0/0/12 │ 0/11.5/8/3 │ │
│ │ 04-22│수  │ ...                                                       │ │
│ │ ...                                                                    │ │
│ │ ─── 2026-03 ───────────────────────────────────────────────────────── │ │
│ │ ...                                                                    │ │
│ │ Sum │     │ 4,521 / 12.3M / 55 / ...                                  │ │
│ │ Avg │     │ 40    / 109K  / 0.5 / ...                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 수동입력 모달 (TO-BE)
```
┌── 수동입력 ──────────────────────────────────── ▲ scrollable ──┐
│ Date  [2026-04-23]                                              │
│                                                                  │
│ ┌─ Marketing ────────────────────────────────────────────────┐ │
│ │ 방문자       [____]    전체 비용     [____]                │ │
│ │ 효과(자동) [상담+지원 합계로 계산]                           │ │
│ │ Visitor src [Naver]    Cost src [Naver Ads]                │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ CS ───────────────────────────────────────────────────────┐ │
│ │ 상담 [_]  지원 [_]  시작 [_]  결손 [_]  체험 [_]  컴플 [_] │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ Operating ────────────────────────────────────────────────┐ │
│ │ 신입생[_] 퇴원[_] 학생수[_]  신규강사[_] 퇴직[_] 강사수[_] │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ Class ────────────────────────────────────────────────────┐ │
│ │ MAP테스트[_] 총수업[__.__]  학생[_]  강사[_]               │ │
│ └────────────────────────────────────────────────────────────┘ │
│ Status [PARTIAL ▾]   Note [______]                              │
│                                                                  │
├── footer (sticky) ───────────────────────────────────────────────┤
│                                       [취소]  [저장]            │
└──────────────────────────────────────────────────────────────────┘
```

### 2.3 카테고리 카드 (TO-BE)
```
┌─ MARKETING ──────────────────────────┐
│ 방문자                  Sum   Avg  Δ │
│ Visitor                 4,521  40 ▲12│
│ Cost                  12.3M  109K ▲20│
│ Effect (자동)           55  0.5  ▲15 │
│ ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲ (visitor)        │
└──────────────────────────────────────┘
```

## 3. Risks & Mitigations
- R1. 수동 override 후 daily_batch가 덮어쓰면 데이터 손실 → `dkp_manually_overridden=true` 가드 필수.
- R2. 365일 응답 사이즈 큼(≈30KB) → gzip on(이미 nginx 적용).
- R3. effect 자동계산이 시드 데이터(2026-01~04)와 불일치할 수 있음 → 화면에서만 override, DB 보존(audit 가능).

## 4. Dependencies
- 없음 (기존 acm-dsh 모듈 내 변경).

## 5. Estimated Effort
- 총 ~4시간 (DB 15min + BE 90min + FE 120min + 배포/검증 30min).

## 6. Test Plan (요약 — TC 별 문서)
- Unit: `daily-kpi.service.getRange` 합계 검증 / effect override.
- Integration: `GET /acm/dsh/daily-kpi-range` 401/200/400(>365일).
- E2E (수동): 페이지 진입 → 프리셋 → 카드 → 모달 풀입력 → 저장 → 그리드 갱신.
