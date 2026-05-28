---
document_id: APP-ACADEMY-UAT-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-27
audience: QA / Product / Ops
---

# app-academy — UAT Checklist (사용자 인수 테스트 체크리스트)

S5 산출물 — AMA App Store 출시 전 staging에서 실행한다. 모든 시나리오가 PASS여야 production cut-over로 진행한다.

> **Environment**: https://app-academy-stg.amoeba.site
> **Pre-condition**: `sql/091-migration-trinity-as-demo.sql` 적용됨, 데모 테넌트(Trinity) `acd_is_demo=1`.

---

## 1. UAT-A — 신규 테넌트 프로비저닝 (S5-3)

**목적**: AMA App Store 구독 → 신규 학원 자동 생성 흐름 검증.

| # | Step | Expected | Result |
|---|------|----------|--------|
| A-1 | AMA 측에서 `subscription.created` webhook 발송 (`acdAmaTenantId=ama-uat-A`, `plan=basic`, `status=ACTIVE`) | HTTP 200, body `{ ok: true, deduped: false }` | ☐ |
| A-2 | DB: `SELECT * FROM tac_academies WHERE acd_ama_tenant_id='ama-uat-A'` | 1 row, `acd_status='ACTIVE'`, `acd_subscription_status='ACTIVE'` | ☐ |
| A-3 | DB: `SELECT * FROM tac_pay_refund_policies WHERE acd_id=<new>` | 1 row, `rfp_version=1`, `rfp_basis='SESSION'`, `rfp_is_default_template=1` | ☐ |
| A-4 | DB: `SELECT * FROM tac_pay_refund_policy_tiers WHERE rfp_id=<new>` | 정확히 4 row, `rpt_tier_order` 1..4, ratio min/max + refund rate 학원법 §18 일치 | ☐ |
| A-5 | DB: `SELECT * FROM tac_subscription_events WHERE evt_nonce=<webhook nonce>` | 1 row, `evt_action='PROVISION'`, `evt_status='APPLIED'` | ☐ |
| A-6 | 동일 webhook 재전송 (replay) | HTTP 200, body `{ deduped: true }`, DB 신규 row 없음 | ☐ |
| A-7 | AMA Custom App SSO JWT 교환으로 신규 운영자 로그인 (`/login?ama_token=<HS256 JWT>` → `POST /api/acm/auth/ama-exchange`) | `/admin/onboarding` 진입, step 1 표시 | ☐ |
| A-8 | Onboarding wizard 3단계 완료 (학원정보 → 운영시간 → 교사동기화 skip) | `/admin/dashboard` 리다이렉트, 학원명/슬러그가 헤더에 표시 | ☐ |

---

## 2. UAT-B — 멀티테넌트 격리 (S5-4)

**목적**: 한 운영자가 여러 테넌트에 멤버일 때 데이터/권한이 섞이지 않음을 검증.

**Setup**:
- UAT-A에서 만든 `ama-uat-A` 테넌트(=학원 X)
- 추가 테넌트 `ama-uat-B`(=학원 Y) provisioning (UAT-A 단계 반복)
- 테스트 사용자 `qa@example.com` 을 두 테넌트의 OWNER로 등록 (`tac_user_academies` 두 row, 둘 다 `uam_status='ACTIVE'`)

| # | Step | Expected | Result |
|---|------|----------|--------|
| B-1 | `qa@example.com` 으로 AMA SSO 로그인 | `/admin/select-tenant` 진입, X·Y 두 학원 표시 | ☐ |
| B-2 | 학원 X 선택 → 대시보드 진입 | 헤더 TenantSwitcher가 X 표시 | ☐ |
| B-3 | 학원 X에서 학생 1명 등록 (이름=ALPHA) | DB: `tac_students.acd_id = X.acd_id` | ☐ |
| B-4 | TenantSwitcher → Y 전환 (페이지 reload) | 헤더가 Y 표시, 학생 목록에 ALPHA 미표시 | ☐ |
| B-5 | Y에서 학생 등록 (이름=BETA) | DB: BETA의 `acd_id = Y.acd_id` | ☐ |
| B-6 | API 직접 호출: `GET /api/students` (Y 활성 세션) | response에 ALPHA 없음 (acd_id 가드 동작) | ☐ |
| B-7 | DB 조작으로 X의 학생 ID를 Y 세션에서 `GET /api/students/<X-student-id>` | HTTP 404 (또는 403) — 절대 200 아님 | ☐ |
| B-8 | DEPROVISIONED 테넌트가 TenantSwitcher에 disabled로 표시되는지 (UAT-C 후 재확인) | dropdown 항목 회색 처리 + 클릭 무효 | ☐ |
| B-9 | `tac_user_academies.uam_status='SUSPENDED'`로 강제 변경 후 해당 테넌트 선택 시도 | 403 / 다시 select-tenant로 | ☐ |

---

## 3. UAT-C — Lifecycle: SUSPEND / RESUME / CANCEL / DEPROVISION (S5-5)

**목적**: AMA가 보내는 4가지 lifecycle webhook이 정확히 반영되고, 실제 접근 통제까지 일관됨을 검증.

| # | Step | Expected | Result |
|---|------|----------|--------|
| C-1 | `subscription.suspended` webhook (테넌트 X) | 200, X.`acd_subscription_status='SUSPENDED'`, `acd_suspended_at` set | ☐ |
| C-2 | X 사용자가 `/admin/billing` 외 모든 페이지 접근 시 | 결제 안내 배너 + 데이터 변경 API 차단 | ☐ |
| C-3 | `subscription.resumed` webhook | 200, `acd_subscription_status='ACTIVE'`, `acd_suspended_at=NULL` | ☐ |
| C-4 | C-3 직후 X에서 정상 데이터 변경 | 성공 (200/201) | ☐ |
| C-5 | `subscription.canceled` webhook | 200, `acd_canceled_at` set, `acd_subscription_status='CANCELED'`, **데이터는 보존** | ☐ |
| C-6 | C-5 직후 X 사용자가 데이터 변경 시도 | 차단 (read-only 모드) | ☐ |
| C-7 | `subscription.deprovisioned` webhook | 200, `acd_deprovisioned_at` set, X가 select-tenant 목록에서 사라짐 | ☐ |
| C-8 | 서비스 재기동 없이 `tenant-deprovision.cron`을 수동 트리거 (`AMA_DEPROVISION_GRACE_DAYS` 단축 후) | `acd_canceled_at` 이 cutoff 이전인 테넌트가 자동 DEPROVISIONED 처리 | ☐ |
| C-9 | `subscription.plan_changed` webhook (`plan=pro`) | 200, `acd_subscription_plan='pro'`, status·timestamps 변경 없음 | ☐ |
| C-10 | 모든 webhook의 HMAC 서명을 1바이트 변조 후 재전송 | HTTP 401 (SIGNATURE_MISMATCH), DB 변경 없음 | ☐ |
| C-11 | `X-AMA-Timestamp` 를 600초 과거로 위조 | HTTP 401 (TIMESTAMP_OUT_OF_RANGE) | ☐ |

---

## 4. UAT-D — 데모 테넌트 격리 (S5-1/2)

| # | Step | Expected | Result |
|---|------|----------|--------|
| D-1 | DB: `SELECT acd_id, acd_name, acd_is_demo, acd_ama_tenant_id FROM tac_academies WHERE acd_is_demo=1` | Trinity 1행, `acd_ama_tenant_id='demo-trinity'` | ☐ |
| D-2 | 신규 provisioning(`UAT-A`) 후 데모와 ID 충돌 없음 | A의 `acd_id != Trinity.acd_id` | ☐ |
| D-3 | `STACK=staging scripts/export-demo-seed.sh` | `sql/seeds/demo-tenant-YYYYMMDD.sql` 생성, 파일 안에 비-데모 테넌트 row 0건 | ☐ |
| D-4 | Production .env 에서 `FEATURE_DEMO_TENANT=off` 시 (구현 시) 데모 라우트 비활성 | TBD — 결정 필요 | ☐ |

---

## 5. Sign-off (서명)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Product Owner | | | |
| Tech Lead | | | |
| Ops On-call | | | |

모든 항목 PASS + 서명 완료 후 [docs/deployment/CUTOVER.md](CUTOVER.md) 진행.
