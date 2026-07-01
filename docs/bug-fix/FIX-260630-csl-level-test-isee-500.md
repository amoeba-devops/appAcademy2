---
document_id: FIX-260630-csl-level-test-isee-500
version: 1.0.0
status: fixed
created: 2026-06-30
product_code: ACM
title: CSL stage 2 ISEE upsert 500 — legacy UNIQUE(inq_id) constraint
---

# FIX-260630 — CSL stage 2 ISEE upsert 500

## 1. Symptom (증상)

Production:
```
PUT https://acm.amoeba.site/api/acm/csl/inquiries/<inqId>/level-tests/ISEE
→ 500 Internal Server Error
```

MAP 시험은 정상 저장되지만, 같은 inquiry 에 두 번째 시험 (ISEE) 저장 시 500. inquiry 예시: `7598e1cb-3515-434e-9c75-e08f1cd2a974` (REQ-260629).

## 2. Root cause (원인)

`sql/acm/100-acm-v1.0a-init.sql:275` 의 1:1 원본 정의:

```sql
CREATE TABLE amb_acm_csl_map_test (
  ...
  inq_id UUID NOT NULL UNIQUE REFERENCES amb_acm_csl_inquiry(inq_id) ON DELETE CASCADE,
  ...
);
```

PG 가 column-level `UNIQUE` 에 대해 auto-generate constraint (`amb_acm_csl_map_test_inq_id_key`).

`sql/acm/987-acm-csl-level-test-per-type.sql` (DSN-260629 §6) 가 1:N 전환을 위해 새 `UNIQUE INDEX uq_acm_csl_mpt_inq_type (inq_id, mpt_test_type)` 를 추가했지만, **legacy 단일컬럼 UNIQUE(inq_id) 를 drop 하지 않음**.

결과:
- 1st save (MAP) → INSERT row #1 (legacy UNIQUE(inq_id) 통과, composite UNIQUE 도 통과)
- 2nd save (ISEE) → INSERT row #2, inq_id 동일 → **legacy UNIQUE(inq_id) 위반** → 500

## 3. Fix

`sql/acm/990-acm-csl-map-test-drop-legacy-unique.sql` 추가:

- `pg_constraint` 에서 `conkey = [inq_id_attnum]` 인 UNIQUE 찾아 dynamic DROP
- 보수적 fallback: `DROP CONSTRAINT IF EXISTS amb_acm_csl_map_test_inq_id_key` (관례적 이름)

composite UNIQUE(inq_id, mpt_test_type) 는 그대로 유지 — 1:N picker 의 진실원천.

## 4. Other tables — 영향 검토

`amb_acm_csl_enrollment` 도 동일 패턴 (`inq_id UUID NOT NULL UNIQUE`) — 하지만 enrollment 는 **1:1 by design** 이므로 legacy UNIQUE 가 정상 동작. 변경 없음.

## 5. Test plan

- [x] sql/acm/990 staging cd-staging 자동 apply → `[apply] acm/990-...` OK 확인
- [ ] /admin/csl/&lt;inq&gt; → 2단계 MAP 저장 → 정상
- [ ] 같은 inquiry 에 ISEE 추가 저장 → **200** (회귀 없음)
- [ ] DB: `\d amb_acm_csl_map_test` 에서 `inq_id` 단일 UNIQUE 가 사라졌고 composite UNIQUE 만 남았는지 확인

## 6. References

- DSN-260629 §6 (Stage 2 1:N pivot)
- sql/acm/100 (origin), sql/acm/987 (composite UNIQUE add — missed legacy drop)
