---
document_id: DSH-PLN-260914B
version: 1.0.0
status: IMPLEMENTED (배포 대기 — PR 생성)
date: 2026-09-14
depends_on: docs/analysis/REQ-260914B-dsh-site-dashboards.md
change_log:
  - 2026-09-14 v1.0.0 구현 완료 — backend(daily_kpi_site·site-comparison·site 파라미터·siteOverride) + frontend(사이트 탭·비교 표·수동입력/불만 사이트 선택·상담 사이트 귀속) + i18n 4 locale, 로컬 스모크 통과 (Claude Code)
  - 2026-09-14 v0.1.0 초안 — 사이트 탭(통합/TPI/TRINITY/SANTACROCE) + daily_kpi_site + 사이트 비교 표 (Claude Code)
---

# PLN-260914B — 사이트별 대시보드 + 통합 대시보드 구현 계획 / Implementation Plan

## 1. Scope (범위)

- 대시보드에 사이트 차원 추가: 통합(ALL) + TPI/TRINITY/SANTACROCE.
- 사이트 분리 대상 지표: MARKETING(방문자·비용·효과), CS(상담·지원·시강·누락·체험수업·불만). OPERATING·CLASS 는 통합 전용.
- 통합 탭에 사이트 비교 표 추가.
- 수동 입력·불만 등록에 사이트 선택 추가(기본 공통).

## 2. Data Model (SQL — `sql/acm/1012-dsh-daily-kpi-site.sql`, 멱등)

```sql
CREATE TABLE IF NOT EXISTS amb_acm_dsh_daily_kpi_site (
  dks_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id            UUID NOT NULL,
  dks_site          VARCHAR(20) NOT NULL,        -- TPI | TRINITY | SANTACROCE | COMMON(미지정)
  dks_date          DATE NOT NULL,
  dks_year_month    VARCHAR(7) NOT NULL,
  dks_marketing_visitor INT, dks_marketing_cost NUMERIC(12,0), dks_marketing_effect INT,
  dks_cs_counseling INT NOT NULL DEFAULT 0, dks_cs_apply INT NOT NULL DEFAULT 0,
  dks_cs_beginning INT NOT NULL DEFAULT 0, dks_cs_missing INT NOT NULL DEFAULT 0,
  dks_cs_trial_class INT NOT NULL DEFAULT 0, dks_cs_complain INT NOT NULL DEFAULT 0,
  dks_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_dsh_dks UNIQUE (ent_id, dks_site, dks_date),
  CONSTRAINT chk_acm_dsh_dks_site CHECK (dks_site IN ('TPI','TRINITY','SANTACROCE','COMMON'))
);
ALTER TABLE amb_acm_dsh_manual_inputs ADD COLUMN IF NOT EXISTS min_site VARCHAR(20);   -- NULL=공통
ALTER TABLE amb_acm_dsh_complaints   ADD COLUMN IF NOT EXISTS cmp_site VARCHAR(20);   -- NULL=공통
-- manual_inputs 유일키를 (ent_id, min_date, COALESCE(min_site,'COMMON')) 로 교체
ALTER TABLE amb_acm_csl_inquiry ADD COLUMN IF NOT EXISTS inq_site_override VARCHAR(20); -- Q-1 운영자 지정(선택)
```
- 사이트 귀속 규칙(상담): `COALESCE(inq_site_override, inq_source_site, 'COMMON')`.
- 통합 = `daily_kpi`(기존) — 값은 사이트 행 합 + COMMON 과 일치해야 함(재계산 시 검증 로그).

## 3. Backend (`acm-dsh`, `acm-csl`)

| 파일 | 내용 |
|---|---|
| `infrastructure/typeorm/daily-kpi-site.typeorm-entity.ts` | 신규 |
| `application/daily-kpi.service.ts` | `recomputeDay` 확장: 사이트별(TPI/TRINITY/SANTACROCE/COMMON) CS 집계(상담 source 규칙), 방문자(site_visit), 수동 입력(min_site) → `daily_kpi_site` upsert. `getRange(entId, from, to, site?)`: site 지정 시 site 표에서 조회, 응답 형태 동일(OPERATING/CLASS 는 null) |
| `application/monthly-summary.service.ts` | `getRangeSummary(…, site?)` 사이트 필터; 통합용 `getSiteComparison(entId, from, to)` → `[{site, visitor, counseling, apply, effect, cost}]` |
| `application/manual-input.service.ts`, `complaint.service.ts` | `site` 필드 저장·조회(기본 null=공통) |
| `presentation/dashboard.controller.ts` | 기존 GET 들에 `site` 쿼리(옵션, `ALL` 기본) + `GET /api/acm/dsh/site-comparison?from&to` |
| `acm-csl` | 상담 생성/수정 DTO·화면에 `siteOverride`(선택) — Q-1 채택 시 |
| 테스트 | recompute 사이트 분배(합계=통합 검증), 수동 입력 사이트 반영, 비교 표 |

## 4. Frontend (`frontend-acm`)

| 파일 | 내용 |
|---|---|
| `modules/dsh/pages/dashboard-page.tsx` | 상단 **사이트 탭**(통합/TPI/TRINITY/SANTACROCE, URL `site=`) → 모든 쿼리에 `site` 전달. 사이트 탭에서는 OPERATING·CLASS 카드/열 숨김 + 안내 |
| `modules/dsh/components/site-comparison-table.tsx` | 통합 탭 전용 표: 사이트별 방문자·상담·지원·효과·비용 + 합계 |
| `modules/dsh/components/manual-input-dialog.tsx`, `complaint-dialog.tsx` | 사이트 선택(공통/TPI/TRINITY/SANTACROCE) |
| `modules/csl/...` | 상담 등록·상세 "사이트" 선택(옵션, Q-1) |
| i18n | `dsh.json` (`site.*`), `csl.json` — ko/en/vi/zh-CN |

## 5. 화면 구성안

```
┌ Dashboard ──────────────────────────────────────────────────────────────┐
│ [통합] [TPI] [TRINITY] [SANTACROCE]      기간 09/01~09/30 [이번 달]…     │
│                                                                          │
│ (통합)  MARKETING │ CS │ OPERATING │ CLASS  ← 현행 4카드                  │
│         ┌ 사이트 비교 (09/01~09/30) ───────────────────────────────────┐ │
│         │ 사이트      방문자   상담   지원   효과   비용                 │ │
│         │ TPI         1,532     4      1      5     300,000            │ │
│         │ TRINITY     1,980     2      0      2           0            │ │
│         │ SANTACROCE    800     1      0      1           0            │ │
│         │ 공통(미지정)    —      16     3     19     150,000            │ │
│         │ 합계        4,312    23      4     27     450,000            │ │
│         └───────────────────────────────────────────────────────────────┘ │
│         일자 그리드(현행)                                                │
│                                                                          │
│ (TPI)   MARKETING │ CS                       ⓘ 운영·수업 지표는 통합 탭  │
│         일자 그리드: Marketing·CS 열만                                   │
└──────────────────────────────────────────────────────────────────────────┘

┌ 수동 입력 ────────────────┐
│ 일자 [2026-09-14]          │
│ 사이트 (●)공통 ( )TPI ( )TRINITY ( )SANTACROCE │
│ 방문자 [ ] 비용 [ ] 불만 [ ] …                  │
└───────────────────────────┘
```

## 6. 일정·공수

| 단계 | 내용 | 공수 |
|---|---|---|
| 1 | SQL 1012 + 엔티티 + recompute 사이트 분배 + 단위테스트 | 2d |
| 2 | API site 파라미터 + 사이트 비교 + 수동 입력/불만 site | 1d |
| 3 | 프론트 사이트 탭·비교 표·다이얼로그·i18n | 2d |
| 4 | (Q-1 채택 시) 상담 사이트 지정 필드 | 0.5d |
| 5 | 스테이징 검증·배포·보고 | 0.5d |
| 합계 | | **약 5.5~6d** |

## 7. Risks

- TPI·TRINITY GA4 태그 미동작 시 사이트 방문자 0 → 선행 해결 필요(GUIDE-260912).
- 사이트 미지정 상담 비중이 크면 사이트 대시보드의 CS 수치가 작게 보임 → Q-1 운영자 지정 필드 권장.
- 기존 daily_kpi 재계산 로직 확장으로 야간 배치 시간 증가(3~4배) — 31일×4사이트, 허용 범위.

## 8. Acceptance

1. 통합 탭 값 = 현행과 동일, 사이트 비교 표 합계 = 통합 값.
2. 사이트 탭에서 방문자·CS 지표가 해당 사이트만 반영, OPERATING·CLASS 숨김.
3. 수동 입력에 사이트 지정 시 해당 사이트와 통합에 반영.
4. 단위테스트·lint·tsc·i18n 4 locale 통과.

---

## Implementation Notes (구현 메모, 2026-09-14)

- **Tenant visitor roll-up (테넌트 방문자 합산)**: `daily_kpi.mkt_visitor` = 테넌트 수동입력(공통) ?? Σ_site (사이트 수동입력 ?? GA4 site_visit). 사이트 수동 방문자만 입력해도 통합 값과 사이트 비교 표 TOTAL 이 일치한다.
- **Manual input dialog (수동입력)**: 사이트 선택 시 방문자·비용·불만 3개 필드만 입력 → `PUT /acm/dsh/manual-inputs/:date` (`site`). 공통은 기존 `PUT /acm/dsh/daily-kpi-manual/:date` 전체 오버라이드 유지.
- **Complaint (불만)**: `site` 선택 (기본 공통) → `cmp_site`. 사이트 탭에서 열면 해당 사이트 preselect.
- **Inquiry (상담)**: Intake 패널 "대시보드 사이트" select → `PATCH /acm/csl/inquiries/:id { siteOverride }`; 유효 귀속 = override ?? sourceSite ?? 공통.
- **Local smoke (로컬 스모크)**: `site=FOO` → 400, `site=TPI` range/summary 는 MARKETING/CS 만, site-comparison TOTAL == 통합, 사이트 수동입력·불만·siteOverride 왕복 확인 후 스모크 데이터 삭제·재계산.
