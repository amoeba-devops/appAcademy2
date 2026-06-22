---
document_id: RPT-260622-phase4-raw-sql-audit
version: 1.0.1
status: draft
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md
  - docs/plan/PLN-260622-mysql-to-postgres-full-migration.md (Phase 4 T4-03)
change_log:
  - 2026-06-22 v1.0.0 draft — Phase 4 raw-SQL audit + PG redo status
  - 2026-06-22 v1.0.1 §3.2 정정 — staff JWT 에 entId 이미 존재. 실제 gap 은 PARENT 역할 부재 (Option A/B/C 비교)
---

# Phase 4 — Raw SQL Audit (REQ-260622 T4-03)

> `grep "tac_"` 잔존 인벤토리 + 각 hit의 PG redo 상태.

---

## 1. Hit summary

```
$ grep -rE "FROM tac_|JOIN tac_|UPDATE tac_|INSERT INTO tac_" \
    backend/src --include='*.ts' -l
```

| # | File | Hits | PG redo |
|---|---|---|---|
| 1 | `application/subscription/provisioning.use-case.ts` | 1 (seed INSERT) | ✅ `.pg.ts` parked (`ProvisioningPgSeed.applySeedTemplate`) |
| 2 | `application/use-cases/dashboard/get-dashboard-kpi.use-case.ts` | 4 (raw SELECT) | ✅ `.pg.ts` parked (`GetDashboardKpiPgUseCase`) |
| 3 | `infrastructure/database/repositories/map-test-set.repository.ts` | 1 (raw INSERT) | ⏭ Phase 7 자체 삭제 — repository 자체가 legacy `MapTestSetEntity` 기반. 신규 모듈 `acm-map.MapAssignmentService` 가 대체 |
| 4 | `presentation/controllers/portal-parent.controller.ts` | 7 (raw SELECT) | ✅ `.pg.ts` parked (`ParentPortalPgUseCase`) |

`grep "tac_"` 전체 매치 (57파일) 의 대다수는 `infrastructure/database/entities/*.entity.ts` (40여 개) — legacy MySQL ORM 엔티티 매핑이며 Phase 7 일괄 삭제.

---

## 2. PG redo 파일 위치

| Sibling | 원본 | 비고 |
|---|---|---|
| `application/use-cases/dashboard/get-dashboard-kpi.use-case.pg.ts` | dashboard | T4-01 |
| `application/subscription/provisioning.use-case.pg.ts` | provisioning | T4-02 (seed 적용만, 전체 provisioning 흐름은 별도) |
| `application/use-cases/parent/parent-portal.use-case.pg.ts` | portal-parent.controller | T4-03 신규 (이 PR) |

**중요**: 이 3개 `.pg.ts` 파일은 **현재 어느 모듈에도 import 되지 않음**. Phase 6 cutover 단계에서 controller `import` 경로를 swap 하는 것이 정상 절차. 그때까지 legacy MySQL `.ts` 가 트래픽을 처리.

---

## 3. Schema mapping highlights

### 3.1 portal-parent 흐름 — legacy vs PG

| Legacy (MySQL) | PG | 변환 메모 |
|---|---|---|
| `tac_students.std_id BIGINT` | `amb_acm_std_student.std_id UUID` | — |
| `tac_students.prt_id` | (없음 — `amb_acm_std_student_parent.par_id`로 N:M) | **세맨틱 변경**: 학생-부모 1:N → N:M. 부모 식별은 JWT email → `amb_acm_std_parent.par_email` 매치 |
| `tac_class_sessions.csn_*` | `amb_acm_cls_sessions.ses_*` | 이름 + 시간 모델 변경 (`csn_start_at + csn_end_at` → `ses_scheduled_at + ses_duration_min`) |
| `tac_classes` + `tac_programs` (JOIN) | `amb_acm_cls_classes.cls_subject_label` | 프로그램 카탈로그가 cls 행에 denormalize. JOIN 제거 |
| `tac_enrollments` (student × class) | `amb_acm_cls_enrollment` (모델 X) | csl_enrollment 와 분리. `enr_status` → `ce_status` |
| `tac_pay_orders.pod_created_at` | `amb_acm_pay_order.created_at` | 컬럼 prefix 떼고 standard timestamp |
| `tac_map_scores.msc_*` | `amb_acm_map_score.msc_*` (또는 학생 행의 `std_map_*`) | 학생 snapshot 컬럼 + 히스토리 테이블 양쪽 존재 — controller 는 히스토리만 surface |

### 3.2 Auth path 분기 (Phase 6 prereq — 정정 2026-06-22)

**1차 audit 의 오류 정정**: ACM staff JWT (`AcmJwtPayload`) 에는 `entId` 가 이미 존재함 ([backend/src/modules/acm-auth/application/acm-auth.service.ts:108-115](backend/src/modules/acm-auth/application/acm-auth.service.ts#L108)). `AcmCurrentUser` 데코레이터도 `entId/id/email` 노출 중.

**실제 gap**: ACM auth 시스템은 admin/staff 전용 (`AcmRole = 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN'`). **`PARENT` 역할 미포함**. portal-parent 흐름은 legacy `JwtAuthGuard` (`CurrentUserPayload.userId: number`) 를 사용 중. 따라서 Phase 6 cutover 시 다음 옵션 중 택일:

| Option | 비고 | 복잡도 |
|---|---|---|
| **A. AcmRole 확장** | `'PARENT'` 추가 + `amb_acm_user` 에 parent row 생성 + `par_id` 매핑 컬럼 추가 | 중 — 신규 컬럼 + JWT issue 흐름 변경 |
| **B. Parent JWT 별도 발급** | `acm-parent-jwt` strategy 신규. `email + entId` payload, `parentUuid` 사전 주입 | 중-상 — 신규 strategy + guard |
| **C. legacy JwtAuthGuard 유지** | parent 경로만 legacy 유지. 내부에서 PG 쿼리 시 email lookup + tenant 직접 resolve | 저 — 현재 `ParentPortalPgUseCase.findParentId(entId, email)` 와 일치 |

**권장**: Option C — Phase 6 swap 시 controller 가 legacy JwtAuthGuard 그대로 사용하되, `req.user.email` + 별도 tenant resolver (request domain 또는 query param) 로 `entId` 산출. `ParentPortalPgUseCase` 가 이미 (entId, email) signature 라 호환됨. parent auth 전면 재설계는 별도 REQ 로 분리.

성능: `findParentId(entId, email)` 가 매 호출마다 lookup (1 query +5ms). 필요 시 Redis 60s cache 로 mitigate. 사전주입은 Option A/B 로 가야 가능.

---

## 4. Phase 6 cutover 작업 (이 RPT 의 follow-up)

1. **Parent auth** — §3.2 Option C 채택 가정. portal-parent controller 는 legacy `JwtAuthGuard` 유지. `entId` 는 request host (`acm.amoeba.site` ↔ `ent_id` map) 또는 `X-Ent-Id` header (admin 만) 로 resolve. `email` 은 그대로 JWT payload 에서 추출.
2. controller import swap:
   - [presentation/controllers/portal-parent.controller.ts](backend/src/presentation/controllers/portal-parent.controller.ts) → `ParentPortalPgUseCase` 호출하는 신규 controller 로 교체. legacy `.ts` 는 Phase 7 삭제 대상.
   - dashboard 호출 site → `GetDashboardKpiPgUseCase` import swap. `entId` 는 staff JWT (`AcmCurrentUser.entId`) 에서 직접.
   - subscription provisioning 흐름 → `ProvisioningPgSeed.applySeedTemplate(entId)` 호출 추가 (legacy MySQL seed 호출 직후 또는 대체).
3. [repositories/map-test-set.repository.ts](backend/src/infrastructure/database/repositories/map-test-set.repository.ts) → Phase 7 일괄 삭제. 신규 controller 가 `acm-map.MapAssignmentService` + 추가 신규 `MapTestSetService` (Phase 6 신규) 호출.

---

## 5. 검증 후 잔존 위험

| Item | Risk | Mitigation |
|---|---|---|
| `ParentPortalPgUseCase.findParentId` 매 호출 lookup | 응답 +5~10ms | JWT에 `parentUuid` 사전 주입 (Phase 6) — 또는 Redis 1분 cache |
| `amb_acm_std_student_parent` N:M — 한 학생에 부모 2명 | 중복 row 가능 | `JOIN ... ON sp.par_id = $2` 로 직접 매칭 (현재 use case 이미 처리) |
| `cls_subject_label` 비어있는 row | className 누락 | `COALESCE(..., cls_code)` 처리 완료 |
| `amb_acm_map_score` empty | latestScore = null | UI 가 null gracefully render 보장 (legacy 와 동일) |

---

## 6. Acceptance check (Phase 4 closure)

| AC | 상태 |
|---|---|
| AC-4-01 build clean (`npm run build`) | ✅ 통과 (2026-06-22) |
| AC-4-02 regression 116/116 jest pass | ✅ 통과 (2026-06-22) |
| AC-4-03 raw SQL hits 0 in **shipped** code paths | ⏳ Phase 6 swap 후. 현재는 `.pg.ts` 가 부재상태로 parked — legacy `.ts` 가 트래픽 처리 |
| AC-4-04 PG redo 파일은 별도 review 가능 형태로 존재 | ✅ — `.pg.ts` siblings 3개 commit 완료 |

---

**Outcome**: Phase 4 T4-01/02/03 코드 작업 100% 완료. 실제 트래픽 swap 은 Phase 6 cutover 시점. 그동안 `.pg.ts` 파일은 staging PG 에 대해 unit/integration test 추가 가능.
