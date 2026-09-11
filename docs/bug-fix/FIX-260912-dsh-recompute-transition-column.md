---
document_id: DSH-FIX-260912
version: 1.0.0
status: RESOLVED (PLN-260912 브랜치에 포함)
date: 2026-09-12
related: docs/plan/PLN-260912-dsh-ga4-visitor-sync.md, backend/src/modules/acm-dsh/application/daily-kpi.service.ts
---

# FIX-260912 — daily_kpi 재계산이 `amb_acm_csl_transition.created_at` 참조로 항상 실패 / Daily KPI recompute failed on a non-existent column

## 1. Symptom (증상)

- `POST /api/acm/dsh/daily-kpi/recompute?date=…` → 500 `INTERNAL_ERROR`.
- 로그: `query failed: SELECT COUNT(*) … FROM amb_acm_csl_transition WHERE … DATE(created_at AT TIME ZONE 'Asia/Seoul') = $2` → `column "created_at" does not exist`.
- 영향: `DailyKpiService.recomputeDay` 를 쓰는 모든 경로 — 03:00 야간 배치(`runDailyBatch`), 수동 입력 저장 후 재계산, 수동 새로고침. CS "누락(cs_missing)" 집계 단계에서 예외가 나므로 해당 날짜의 daily_kpi 행이 갱신되지 않았다(기존 행은 STALE 없이 그대로 남음).

## 2. Root Cause (원인)

`amb_acm_csl_transition` 의 시각 컬럼은 `occurred_at` 이다(`sql/acm/100-acm-v1.0a-init.sql` 357행, 인덱스 `(inq_id, occurred_at)`). 재계산 SQL 이 존재하지 않는 `created_at` 을 참조했다. `amb_acm_csl_enrollment` 는 `updated_at` 이 실제로 존재해 그 쿼리는 정상.

## 3. Fix (수정)

`backend/src/modules/acm-dsh/application/daily-kpi.service.ts` cs_missing 쿼리: `DATE(created_at …)` → `DATE(occurred_at …)`.

## 4. Verification (검증)

로컬 db_acm 에서 `recompute?date=2026-09-10` → 200, `daily-kpi-range` 에 행 갱신 확인 (GA4 site_visit 합산 225 반영, 수동 입력 999 우선 확인). PLN-260912 스모크 테스트 중 발견·수정.

## 5. Follow-up (후속)

- 운영 daily_kpi 가 언제부터 갱신되지 않았는지 `dkp_computed_at` 분포로 확인 권장. 배포 후 03:00 배치가 최근 31일을 자동 재계산하므로 별도 백필은 불필요(31일 이전 구간이 필요하면 `recompute` 를 날짜별 호출).
- raw SQL 에서 `created_at/updated_at` 을 쓰기 전 테이블별 실제 컬럼명(접두어형 `cls_created_at`, `occurred_at` 등) 확인 — 999b 사고와 같은 유형.
