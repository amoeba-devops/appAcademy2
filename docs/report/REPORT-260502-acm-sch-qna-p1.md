---
document_id: ACM-REPORT-SCH-QNA-P1-1.0.0
version: 1.1.0
status: completed
date: 2026-05-02
related:
  - ACM-REQ-SCH-QNA-P1-1.0.0
  - ACM-PLAN-SCH-QNA-P1-1.0.0
  - ACM-TC-SCH-QNA-P1-1.0.0
change_log:
  - 1.0.0 (2026-05-02): initial completion report
  - 1.1.0 (2026-05-02): add §7 Deploy Outcome — staging deploy (commit f42e9f7) success, 5 ACM migrations applied, smoke tests verified
---

# ACM SCH + QNA P1 Boost — Completion Report (완료 보고서)

## 1. Summary (개요)

ACM `v1.0a` 작업 백로그 중 SCH(학교) + QNA(상담 Q&A) 모듈의 P1 우선순위 항목 일괄 구현. 총 9개 SCH FR + 9개 QNA FR + 4개 cross-cutting task (T-C-01..04) 완료.

**상태**: 5단계(개발) + 6단계(테스트+보고) 완료. Staging 배포 + 마이그레이션은 운영 follow-up 으로 분리.

## 2. Changed Files (변경 파일)

### SQL Migrations
- [sql/acm/400-acm-v1.0a-sch-p1.sql](../../sql/acm/400-acm-v1.0a-sch-p1.sql) — **NEW**
- [sql/acm/410-acm-v1.0a-qna-p1.sql](../../sql/acm/410-acm-v1.0a-qna-p1.sql) — **NEW**

### Backend — SCH
- backend/src/modules/acm-sch/infrastructure/school.typeorm-entity.ts — `+isAuthorized`
- backend/src/modules/acm-sch/domain/school.entity.ts — `+isAuthorized`
- backend/src/modules/acm-sch/application/school.dto.ts — `+isAuthorized?`
- backend/src/modules/acm-sch/application/school.service.ts — active-CSL guard
- backend/src/modules/acm-sch/presentation/school.controller.ts — `+PATCH`, deprecate PUT
- backend/src/modules/acm-sch/infrastructure/grade-band.typeorm-entity.ts — **NEW**
- backend/src/modules/acm-sch/infrastructure/schedule.typeorm-entity.ts — **NEW**
- backend/src/modules/acm-sch/application/{grade-band,schedule}.dto.ts — **NEW**
- backend/src/modules/acm-sch/application/{grade-band,schedule}.service.ts — **NEW**
- backend/src/modules/acm-sch/presentation/{grade-band,schedule}.controller.ts — **NEW**
- backend/src/modules/acm-sch/application/sch-school-public.service.ts — **NEW**
- backend/src/modules/acm-sch/acm-sch.module.ts — wiring

### Backend — QNA
- backend/src/modules/acm-qna/infrastructure/question.typeorm-entity.ts — `+threadParentId/categoryId/useCount/escalatedAt/escalatedBy`
- backend/src/modules/acm-qna/infrastructure/qna-category.typeorm-entity.ts — **NEW**
- backend/src/modules/acm-qna/application/question.dto.ts — `+ReplyQuestionDto`, `+EscalateQnaDto`, `+categoryId`
- backend/src/modules/acm-qna/application/qna-category.dto.ts — **NEW**
- backend/src/modules/acm-qna/application/question.service.ts — `+softDelete/escalate/reply/thread/useFaq/listByStudent`, `list()` filter signature
- backend/src/modules/acm-qna/application/qna-category.service.ts — **NEW**
- backend/src/modules/acm-qna/application/qna-public.service.ts — **NEW**
- backend/src/modules/acm-qna/presentation/question.controller.ts — `+DELETE/escalate/reply/thread/use-faq` + filter params
- backend/src/modules/acm-qna/presentation/qna-category.controller.ts — **NEW**
- backend/src/modules/acm-qna/presentation/qna-student.controller.ts — **NEW**
- backend/src/modules/acm-qna/acm-qna.module.ts — wiring

### Frontend (frontend-acm)
- frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/sch.json — full key set
- frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/qna.json — full key set
- frontend-acm/src/modules/sch/pages/school-list-page.tsx — full impl + child modal
- frontend-acm/src/modules/qna/pages/qna-list-page.tsx — full impl + Reply/Thread modals

### Docs
- [CHANGELOG.md](../../CHANGELOG.md) — `[1.4.3]` entry
- [docs/analysis/acm-fn-sch-qna-p1-requirements.md](../analysis/acm-fn-sch-qna-p1-requirements.md)
- [docs/implementation/tasks/acm-fn-sch-qna-p1-plan.md](../implementation/tasks/acm-fn-sch-qna-p1-plan.md)
- [docs/test/acm-fn-sch-qna-p1-tc.md](../test/acm-fn-sch-qna-p1-tc.md)

## 3. Test Execution (테스트 실행 결과)

| Suite | Result | Detail |
|-------|--------|--------|
| `backend && npx tsc --noEmit` | ✅ PASS | clean compile |
| `frontend-acm && npx tsc --noEmit` | ✅ PASS | clean compile |
| `backend && npm test` (jest unit) | ✅ **73/73 pass** | no regressions; covers shared dispatcher/AMA/notification utils |
| Backend integration (jest-int) | ⚠️ Not exercised this cycle | new SCH/QNA endpoints lack dedicated integration spec — see follow-ups |
| Frontend e2e (playwright) | ⚠️ Not exercised | UI list pages added; e2e deferred |

### TC coverage vs `acm-fn-sch-qna-p1-tc.md`
- **P0 (15)** — code paths implemented; manual smoke (curl) recommended after staging migration.
- **P1 (12)** — implemented; UI flows manually verifiable from `/sch` & `/qna`.
- **P2 (5)** — i18n key parity (ko/en/vi/zh-CN) verified by file diff.

## 4. Regression Impact (회귀 영향)

| Area | Risk | Notes |
|------|------|-------|
| Existing CSL flows | None | Cross-module reads only via new `SchSchoolPublicService` (additive). |
| Existing QNA listing | Low | `list()` signature changed to `(opts: {...})` — only internal callers updated. Controller-facing query params remain backward-compatible additions. |
| Schema migrations | Low | All `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`; safe re-run. |
| School `PUT` endpoint | None | Preserved as `[DEPRECATED]` alias of `PATCH`. |
| Multi-tenancy | None | All new tables include `ent_id`; all new services filter by `entId` from `OwnEntityGuard`. |

## 5. Follow-up Tasks (후속 작업)

| Priority | Task |
|----------|------|
| **P0** | Apply `400-acm-v1.0a-sch-p1.sql` + `410-acm-v1.0a-qna-p1.sql` to staging Postgres (`acm-pg`). |
| **P0** | Smoke test on staging: `GET /api/acm/sch/schools`, `POST /api/acm/sch/schools/:id/grade-bands`, `POST /api/acm/qna/questions/:id/reply`. |
| **P0** | (Carryover) Generate `ACM_PII_KEY` and add to `docker/staging/.env.staging`; restart `tac-backend`. |
| **P1** | Add jest integration specs `it-sch-p1.int-spec.ts`, `it-qna-p1.int-spec.ts` covering all P0 TCs (escalate/reply/thread/use-faq state transitions, school-not-authorized guard, school-in-use guard). |
| **P1** | Frontend Create/Edit modals (current UI is list-only per PLAN scope) — schools, grade-bands, schedules, qna-categories full CRUD UX. |
| **P2** | Replace `confirm()` / `alert()` with shared toast/dialog component. |
| **P2** | Hook `categoryLabel()` to use `vi`/`zh-CN` labels (currently falls back to `labelKr` if not English). |

## 6. Memory / Doc Updates (메모/문서 갱신)

- ✅ `CHANGELOG.md` → `[1.4.3]` entry.
- ✅ This report at `docs/report/REPORT-260502-acm-sch-qna-p1.md`.
- ✅ `/memories/repo/trinity-academy-project.md` → "ACM Postgres Datasource" + "스테이징 배포 팁" 섹션 추가 (pg_bigm 빌드 의존성, nohup 백그라운드 배포 패턴).

## 7. Deploy Outcome — Staging (배포 결과)

**Deployed**: 2026-05-02 16:22 KST · Commit `f42e9f7` · Host `appacademy@125.133.49.165`

### 7.1 Infrastructure Changes (during deploy)

배포 중 신규 인프라 추가 — 별도 커밋으로 분리:

| Commit | Scope | Notes |
|---|---|---|
| `47f0645` | feat v1.4.3 (this report's work) | Code drop |
| `afbfe4a` | feat(staging): ACM Postgres datasource + PII key wiring | `docker-compose.staging.yml` 에 `postgres-acm` 서비스, `deploy-staging.sh` step 4b (sql/acm/* 적용), `.env.staging` 에 `ACM_PG_*` + `ACM_PII_KEY` |
| `ba7d397` | fix(staging): build custom postgres-acm image with pg_bigm | `docker/staging/Dockerfile.postgres-acm` (postgres:16 + pg_bigm 1.2-20240606) |
| `f42e9f7` | fix(staging): add libicu-dev/libxml2-dev for pg_bigm build | postgres:16 ICU 헤더(`unicode/ucol.h`) 누락 해결 |

### 7.2 Migrations Applied (sql/acm/)

```
[apply] acm/100-acm-v1.0a-init.sql                                 OK
[apply] acm/200-seed-sch-schools.sql                               OK
[apply] acm/300-acm-cls-v1.0b.sql                                  OK
[apply] acm/400-acm-v1.0a-sch-p1.sql                               OK
[apply] acm/410-acm-v1.0a-qna-p1.sql                               OK
```

### 7.3 Container Status

| Container | Status |
|---|---|
| `tac-postgres-acm` (image `tac-postgres-acm:pg16-bigm`) | Up (healthy) |
| `tac-backend` | Up — Nest application successfully started, ACM 라우트 정상 매핑 (`SchoolController`, `GradeBandController`, `ScheduleController`, `QuestionController`, …) |
| `tac-frontend` | Up |
| `acm-frontend` | Up |
| `tac-mysql` / `tac-redis` | Up (healthy) |

### 7.4 Smoke Tests (public)

| URL | HTTP | 비고 |
|---|---|---|
| `https://acm-stg.amoeba.site/` | 200 | CMS shell 로딩 |
| `https://acm-stg.amoeba.site/api/acm/sch/schools` | 403 | 인증 필요 → 라우트 정상 등록 확인 |

### 7.5 Resolved Follow-up Items (from §5)

- ✅ **P0** — sql/acm/400 + 410 staging 적용 완료.
- ✅ **P0** — `ACM_PII_KEY` 생성 + `.env.staging` 적용 + `tac-backend` 정상 기동 확인.
- ⏸ **P0 (잔여)** — 인증 후 endpoint 응답 smoke test (sch GET / grade-bands POST / qna reply POST) — 별도 QA 라운드.

### 7.6 Lessons Learned

- `postgres:16` 이미지에서 pg_bigm 빌드 시 ICU 헤더(`libicu-dev`) + `libxml2-dev` 누락은 흔한 함정. `unicode/ucol.h: No such file or directory` 에러 발생 시 즉시 의존성 추가.
- 긴 빌드+배포는 `ssh -t` 인터랙티브 대신 `nohup ... > /tmp/deploy.log 2>&1 &` 백그라운드 + 로그 폴링이 안전(VS Code 채팅 surface 에서 Ctrl+C 사고 방지).
- `deploy-staging.sh` step 6(host nginx sync) 은 sudo TTY 가 필요해 백그라운드 배포에서 자동 진행 안 됨 — nginx conf 변경이 없는 배포에서는 영향 없음.
