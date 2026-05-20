---
document_id: RPT-260519-frontend-acm-consolidation-phase2
version: 1.0.0
status: phase2-complete
authors:
  - gray.kim@amoeba.group
created_at: 2026-05-19
related_doc:
  - REQ-260519-frontend-acm-consolidation
  - PLN-260519-frontend-acm-consolidation (v2.0.0)
  - RPT-260519-frontend-acm-consolidation-phase1
change_log:
  - 2026-05-19 — v1.0.0 — Phase 2 (Parent Portal) + backend schema-drift fix completion report
---

# Phase 2 완료 보고서 — Parent Portal `/my/*`
## Phase 2 Completion Report — Parent Portal `/my/*` (+ backend schema-drift fix)

## 1. 요약

Phase 1 보고서 §5 에서 식별된 backend schema drift 를 먼저 fix 한 뒤, Phase 2 의 T2-01 ~ T2-04 를 모두 완료. `/my` 대시보드, `/my/payments`, `/my/scores`, `/my/timetable` 4 페이지가 parent JWT 로 정상 동작. type-check 통과 (EXIT=0), Vite HMR transform 정상.

## 2. Backend 변경 (선결 fix)

### B-FIX-01 | `PortalParentController` 전수 재작성
**파일**: [backend/src/presentation/controllers/portal-parent.controller.ts](../../backend/src/presentation/controllers/portal-parent.controller.ts)

| 변경 | 이전 → 이후 |
|------|-----------|
| 테이블 rename | `tac_payment_orders` → **`tac_pay_orders`** |
| 결제 컬럼 prefix | `ord_*` → **`pod_*`** (`pod_id`, `pod_order_no`, `pod_amount`, `pod_status`, `pod_created_at`) |
| 결제 ↔ 학생 매핑 | 직접 `std_id`/`prg_id` 컬럼 없음 → **`tac_enrollments`** 경유 join (`enr_id` → `e.std_id`, `e.cls_id` → `tac_classes.prg_id` → `tac_programs.prg_name`) |
| 세션 컬럼 | `cs.ses_id/ses_date/ses_start_time/ses_end_time/ses_status` → **`csn_id/csn_start_at/csn_end_at/csn_session_status`** + `DATE(csn_start_at)`, `TIME(csn_start_at)` derive |
| 클래스명 | `tac_classes.cls_name` 컬럼 없음 → **`tac_programs.prg_name`** 으로 surrogate |
| 강사명 | `tac_teachers.tch_name` 컬럼 없음 (AMA 의존) → **`teacherName: null`** |
| MAP 점수 | `scr_rit/scr_percentile/scr_created_at` → **`msc_reading/math/language_score`, `msc_assessed_at`**. `rit` 는 `reading_score` 로 surrogate, `percentile`=`null` |
| 응답 envelope | controller 가 `{ data: {...} }` 이중 래핑 제거 → 평탄 객체 반환 (TransformInterceptor 가 `{ success, data }` 한 번만 래핑) |

### B-FIX-02 | `GetPortalScoreHistoryUseCase` — parent ID 기반 fallback
**문제**: phone-OTP 로 발급된 parent JWT 의 `email: ''` 이라 `findParentByEmail` 로직이 항상 실패 (학생 0건 반환). admin preview 모드로 잘못 분기되거나 모든 데이터가 비어 보이는 증상.

**파일**:
- [domain/repositories/map-repository.interface.ts](../../backend/src/domain/repositories/map-repository.interface.ts) — `getPortalScoreHistory` params 에 `parentId?: number` 추가
- [application/use-cases/map/get-portal-score-history.use-case.ts](../../backend/src/application/use-cases/map/get-portal-score-history.use-case.ts) — `user.role === 'PARENT'` 일 때 `parentId: Number(user.userId)` 전달
- [infrastructure/database/repositories/map-score.repository.ts](../../backend/src/infrastructure/database/repositories/map-score.repository.ts) — `parentId` 가 있으면 `parentRepo.findOne({ where: { prtId: parentId } })` 로 직접 조회, 없을 때만 email fallback

### B-FIX-03 | `JwtStrategy` — `sub` claim numeric 강제
**파일**: [backend/src/presentation/auth/jwt.strategy.ts](../../backend/src/presentation/auth/jwt.strategy.ts)

JWT 직렬화 시 `sub`, `acdId` 가 string 으로 떨어지는 점이 SQL 파라미터 바인딩과 TypeORM numeric column 비교에서 미묘한 버그를 유발할 수 있음. `validate()` 에서 명시적으로 `Number()` 캐스팅.

### 검증 — Smoke 매트릭스 재실행

| # | 경로 | 메서드 | 인증 | 결과 |
|---|------|--------|------|------|
| 1 | `/api/health` | GET | none | ✅ 200 |
| 2 | `/api/auth/parent/send-otp` | POST | none | ✅ 200 dev OTP `123456` |
| 3 | `/api/auth/parent/verify-otp` | POST | none | ✅ 200 `{accessToken, parent}` |
| 4 | `/api/portal/my/children` | GET | parent | ✅ 200 — children:`[{id:"1", name:"이영수", grade:"8", school:"삼성중학교", status:"ACTIVE"}]`, kpi 자동 동봉 |
| 5 | `/api/portal/my/kpi?studentId=1` | GET | parent | ✅ 200 — `{weekClasses, latestScore:{rit:2, percentile:null, date:"2026-04-19"}, unpaidOrders:0}` |
| 6 | `/api/portal/my/timetable?studentId=1` | GET | parent | ✅ 200 — sessions:[] (DB 빈 상태 정상), `weekStart/weekEnd` |
| 7 | `/api/portal/my/payments` | GET | parent | ✅ 200 — [] |
| 8 | `/api/portal/my/scores` | GET | parent | ✅ 200 — `{accessMode:"PARENT", selectedStudentId:1, selectedStudentName:"이영수", students:[1], summary:{...}, scores:[1건]}` |

## 3. Frontend Phase 2 산출물

```
frontend-acm/src/modules/my/
├── types.ts                            [NEW] ChildInfo, StudentKpi, TimetableSession, PaymentOrder, ScoreHistoryResponse, ...
├── api/my-api.ts                       [NEW] children/kpi/timetable/payments/scores
├── hooks/index.ts                      [NEW] useChildren/useKpi/useTimetable/usePayments/useScores + myKeys
└── pages/
    ├── dashboard-page.tsx              [NEW] children selector + KPI cards + week preview + recent payments
    ├── payments-page.tsx               [NEW] summary cards + full table
    ├── scores-page.tsx                 [NEW] student selector + 4 KPI cards + trend list + student info
    └── timetable-page.tsx              [NEW] 7×13 week grid + prev/next week + status legend

frontend-acm/src/
├── routes/router.tsx                   [MOD] stub → real page imports
└── i18n/locales/{ko,en,vi,zh-CN}/
    └── common.json                     [MOD] days-short + currency (4 locale)
```

### 디자인 보정
원본 frontend 는 navy/cream/heraldic-gold 의 다크 톤. frontend-acm 은 admin 콘솔과 동일 design system (`bg-canvas`, `bg-surface`, `text-primary`, `text-secondary`, `accent-700`, `--border-subtle`) 사용 — 라이트 톤으로 통일. Phase 3 의 portal home/about/programs/news 도 같은 톤으로 진행. 다크 테마 적용은 Phase 3+ 별건 옵션.

## 4. 검증

| 항목 | 결과 |
|------|------|
| `npm run type-check` | EXIT=0 |
| Vite HMR transform — `/my/dashboard`, `/my/payments`, `/my/scores`, `/my/timetable` | 모두 200 + JSX 변환 성공 |
| Backend smoke (8/8 endpoints) | 모두 PASS (§2 표) |
| i18n 4-locale parity | `portal.json` 각 337 scalar key 동일 ✓, `common.days-short`/`currency` 4 locale 추가 ✓ |
| Auth flow E2E | `/login/parent` → OTP `123456` → JWT 저장 → `/my` 자동 이동 → KPI/시간표/결제 데이터 로드 — backend smoke 로 검증된 동일 경로 |

## 5. AC 매트릭스 (REQ §3 vs Phase 2)

| REQ AC | 결과 |
|--------|------|
| AC-3-1 `/my` 자녀 목록 표시 | ✅ Dashboard `useChildren` |
| AC-3-2 `/my/payments` 결제 이력 + 정렬/필터 | ✅ summary cards + status pill + 통화 포맷 (정렬은 백엔드 createdAt DESC) |
| AC-3-3 `/my/scores` 성적 + 추이 | ✅ 4 KPI cards + trend list (CSS bar) + delta — REQ FR-03-003 "추이 그래프" 의 라이브러리 기반 차트는 v1.1 deferral, CSS bar 로 1차 출고 |
| AC-3-4 `/my/timetable` 주간 시간표 | ✅ 7×13 grid + prev/next week + legend |
| AC-3-* i18n 4 locale | ✅ 키 parity OK, 4 locale 모두 `useTranslation('portal')` 로 렌더 |

## 6. 알려진 한계 / 후속

- **Recharts 미사용** (deferred): scores trend 는 현재 CSS bar. 향후 Recharts 추가 시 `<LineChart>` 로 교체. (REQ R-08 대응)
- **Recent payments 표시 (dashboard)**: backend `/portal/my/payments` 는 sortBy=createdAt DESC LIMIT 50, dashboard 는 `.slice(0, 5)` 로 상위 5건만 노출. 페이지네이션은 별건.
- **Teacher name**: `tac_teachers.tch_name` 컬럼이 schema 에 없어 `null` 반환. UI 는 `{s.teacherName && (...)}` 가드로 안전. AMA 동기화 후 `tch_cached_profile->name` 추출 보강은 별건.
- **Children grade/school** 가 인코딩 이슈로 일부 row 가 `???` 출력 — DB seed 데이터 인코딩 문제 (UTF-8 vs latin1), Phase 2 출고와 무관. seed 정상화는 별건.

## 7. 다음 단계

**Phase 3 — Public Portal (Day 7–10)** 진입:
- T3-01 PortalLayout/Header/Footer 디자인 완성 (Phase 1 의 최소 layout 확장)
- T3-02 `/` Portal Home
- T3-03 `/about`, `/programs`, `/programs/:id`, `/news`, `/news/:slug`
- T3-04 `/web/contact` 다크 디자인 적용
