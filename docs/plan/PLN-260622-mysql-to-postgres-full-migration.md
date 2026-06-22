---
document_id: PLN-260622-mysql-to-postgres-full-migration
version: 1.0.0
status: draft
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md (v1.0.0)
decisions:
  - Q-1 결제 데이터 — 전체 이전 (전기간)
  - Q-2 tac_audit_logs — 최근 N일치만 (default N=90, Phase 0 에서 조정)
  - Q-3 dual-write 기간 — 0일 (즉시 컷오버)
  - Q-4 MySQL 컨테이너 cutover 직후 즉시 삭제
  - Q-5 tac_consultations ↔ amb_acm_csl_inquiry — 자동 reconcile
  - Q-6 tac_users ↔ amb_acm_user — 신규 ACM 사용자(PG) 가 권위, MySQL legacy 는 PG 에 없는 row 만 inject
change_log:
  - 2026-06-22 v1.0.0 draft — 7 phase, 약 4-6주
---

# 작업 계획서 — MySQL 전면 제거 (REQ-260622)

> **One-liner**: REQ-260622 의 결정(Q-1~6) 반영. 7 phase / 약 22 영업일 / dual-write 없이 즉시 컷오버 / MySQL 컨테이너 즉시 삭제.

---

## 0. 핵심 가정 + Phase 게이트

| 가정 | 영향 |
|---|---|
| dual-write **0일** (Q-3) | 각 phase 끝에 staging 충분 검증 필수. cutover 는 단일 시점. |
| MySQL 즉시 삭제 (Q-4) | cutover 전 `mysqldump` + `pg_dump` 양쪽 백업 S3 보관 의무 (롤백 자산). |
| 결제 전체 이전 (Q-1) | 결제 데이터 row 수 영향 큼 — Phase 0 에서 실측. |
| audit N=90일 (Q-2) | 그 이전 데이터는 cold archive S3 dump 보관 후 PG 미적재. |
| 자동 reconcile (Q-5) | `tac_consultations` → `amb_acm_csl_inquiry` mapping 룰을 코드화 + dry-run diff 보고. |
| ACM user 권위 (Q-6) | MySQL `tac_users` 에만 있는 row 는 `amb_acm_user` 로 inject (entId·role 매핑) + 중복 email/sub 충돌 시 PG 우선. |

각 phase 종료 시 **사용자 승인** + cd-staging 통과 후 다음 phase 진입. Phase 6 (cutover) 는 별도 maintenance window 승인 필요.

---

## 1. Phase 0 — 데이터 인벤토리 + 의사결정 finalize (1-2일)

### T0-01. Production MySQL row count 보고서
- 작업: SSH → `docker exec tac-prod-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac -e "..."`
- 산출: 각 `tac_*` 테이블의 `COUNT(*)` + `MAX(created_at)` + 마지막 INSERT 시점 → `docs/analysis/RPT-260622-mysql-inventory.md`.

### T0-02. Audit 컷오프 결정 (Q-2 N 값 확정)
- `tac_audit_logs` row 수 보고 후 운영자가 N=30/60/**90**/180일 중 선택.
- 그 이전 데이터는 `tac_audit_logs_archive.sql.gz` 로 S3 보관 (cold).

### T0-03. 스키마 매핑 spec 작성
- 25 미이전 테이블 각각의 **컬럼 → PG 컬럼** 매핑 (타입 변환, 이름 변경, 압축 정책 등).
- `docs/design/SPEC-260622-tac-to-pg-schema-map.md`.
- 예: `tac_pay_orders.created_at TIMESTAMP` → `amb_acm_pay_order.created_at TIMESTAMPTZ DEFAULT NOW()`.

### T0-04. 백업 정책 + S3 prefix 결정
- pre-cutover dumps:
  - `s3://amoeba-acm-backups/mysql/{prod,staging}/2026-06-22T{ts}/db_tac.sql.gz`
  - `s3://amoeba-acm-backups/pg/{prod,staging}/2026-06-22T{ts}/db_acm.sql.gz`
- 보존: 90일 (lifecycle rule).

### T0-Gate. 운영자 승인
- N 값 확정 / 스키마 매핑 spec 확정 / 백업 destination 확정.

---

## 2. Phase 1 — 신규 PG 스키마 (3-5일)

도메인별 SQL 마이그레이션 파일 작성. 모두 `sql/acm/95X-…` ~ `sql/acm/99X-…` prefix.

### T1-01. `sql/acm/950-acm-pay-schema.sql` — 결제 6 테이블
- `amb_acm_pay_order` (← `tac_pay_orders`)
- `amb_acm_pay_ledger` (← `tac_pay_ledger`)
- `amb_acm_pay_receipt` (← `tac_pay_receipts`)
- `amb_acm_pay_refund_policy` (← `tac_pay_refund_policies`)
- `amb_acm_pay_refund_policy_tier` (← `tac_pay_refund_policy_tiers`)
- `amb_acm_pay_tax_invoice` (← `tac_pay_tax_invoices`)
- 인덱스: `(ent_id, status)`, `(ent_id, student_id)`, `(pg_payment_key)` unique.
- 암호화 컬럼: `buyer_identifier BYTEA` (AES-GCM 보존).

### T1-02. `sql/acm/955-acm-map-expand.sql` — MAP 평가 8 테이블
- `amb_acm_map_item` (← `tac_map_items`)
- `amb_acm_map_item_tag` (← `tac_map_item_tags`)
- `amb_acm_map_test_set` (← `tac_map_test_sets`)
- `amb_acm_map_test_set_item` (← `tac_map_test_set_items`)
- `amb_acm_map_assignment` (← `tac_map_assignments`)
- `amb_acm_map_response` (← `tac_map_responses` — JSONB 로 마이그)
- `amb_acm_map_score` (← `tac_map_scores`)
- `amb_acm_map_passage_asset` (← `tac_map_passage_assets` — S3 key 만 보존)

### T1-03. `sql/acm/960-acm-notification-schema.sql` — 알림 2 테이블
- `amb_acm_notification_template` (← `tac_notification_templates`)
- `amb_acm_notification_log` (← `tac_notification_logs`)

### T1-04. `sql/acm/965-acm-audit-log.sql` — 감사 1 테이블
- `amb_acm_audit_log` (← `tac_audit_logs` — Q-2 N일치만)
- 인덱스: `(ent_id, created_at DESC)` BRIN (대용량 시계열 효율).

### T1-05. `sql/acm/970-acm-posts-schema.sql` — 포털 / 카탈로그 4 테이블
- `amb_acm_post` (← `tac_posts`)
- `amb_acm_program` (← `tac_programs`)
- `amb_acm_program_setting` (← `tac_program_settings`)
- `amb_acm_classroom` (← `tac_classrooms`)

### T1-06. `sql/acm/975-acm-csl-visit-record.sql` — 상담 보조 3 테이블
- `amb_acm_csl_visit_record` (← `tac_visit_records`)
- `amb_acm_csl_intake_form` (← `tac_consultation_intake_form` — orphan 이지만 향후 부활 대비 schema 만 유지)
- `amb_acm_std_external_test_score` (← `tac_external_test_scores`)

### T1-07. `sql/acm/980-acm-subscription-event.sql` — AMA subscription
- `amb_acm_subscription_event` (← `tac_subscription_events`)

### T1-08. 마이그레이션 적용 + staging 자동 적용 검증
- cd-staging 자동 실행 → `sql/_applied/acm/95X.sha256` 마커 생성 확인.

### T1-Gate
- 모든 신규 테이블 staging PG 에 생성됨. backend 는 아직 사용 안 함.

---

## 3. Phase 2 — 백엔드 모듈 재작성 (1-2주)

### T2-01. 신규 모듈 `acm-pay` 작성
- entity 6개 + repository + service (Toss / NTS 호출 부분은 `infrastructure/external/{toss,nts}` 그대로 사용 — interface 만 PG repo 로 swap).
- 기존 `presentation/payment.module.ts` 의 controller / use-case 를 `modules/acm-pay/presentation/` 로 이전.
- 단위 테스트 마이그레이션 — 결제 흐름 spec 100% pass.

### T2-02. `acm-map` 모듈 확장
- 기존 2 entity (`passage`, `question`) → 10 entity 로 확장.
- 기존 `acm-map.module.ts` 에 추가.
- MapQuestionService / Assignment / Score 분리.

### T2-03. 신규 모듈 `acm-notification` (또는 `acm-common/notification`)
- template + log entity + dispatcher service.
- AMA / Email / AmoebaTalk 어댑터는 그대로 (interface). 호출 site 는 `acm-cls/cal/csl` 에서 PG repo 로.

### T2-04. 신규 모듈 `acm-audit`
- interceptor (`AuditInterceptor`) 를 PG repo 로 swap.
- 옵션: BRIN 인덱스 활용 — 90일 cutoff 후 자동 archive cron 추가.

### T2-05. 신규 모듈 `acm-posts` + `acm-program` + classroom
- 게시판 / 프로그램 카탈로그 / 교실. CRUD service + controller.

### T2-06. `acm-csl` 보조 entity 추가 (T1-06)
- visit_record + intake_form + external_test_score 통합.

### T2-07. legacy `tac_*` 엔티티 deprecated 라벨
- 파일에 `// DEPRECATED — REQ-260622 — Phase 7 에 삭제` 주석 추가 (아직 삭제 X).

### T2-Gate
- backend `nest build` clean. legacy MySQL datasource 는 여전히 active (Phase 7 에서 제거).
- BODA / Instant / Login 흐름 회귀 0.

---

## 4. Phase 3 — 데이터 이전 스크립트 (3-5일)

### T3-01. Migration runner — `scripts/migrate-mysql-to-pg/`
- NestJS CLI `npm run migrate:mysql-to-pg` — 도메인별 sub-command:
  - `pay` / `map` / `notification` / `audit` / `posts` / `csl-aux` / `subscription`
- 각 sub-command:
  - MySQL SELECT (batched 500 rows) → 변환 → PG `INSERT ... ON CONFLICT DO NOTHING` (idempotent).
  - row diff 보고 (`{table}: mysql={n} pg={n} diff=0`).

### T3-02. 이중화 영역 reconcile (Q-5 / Q-6)
- `tac_users` → `amb_acm_user`: PG 에 없는 row 만 inject (`entId` + `email` UNIQUE 충돌 시 skip).
- `tac_consultations` → `amb_acm_csl_inquiry`: 부분 등가 mapping 룰 (자동, 충돌 시 PG 우선).
- 14 이중화 테이블 동일 패턴.

### T3-03. Staging dry-run
- Production MySQL → staging PG `db_acm_staging` 임시 schema 로 이전.
- row diff = 0 확인. PG 인덱스 EXPLAIN ANALYZE 회귀 점검.

### T3-04. Production migration rehearsal
- staging 에서 production 시뮬레이션. 예상 소요 시간 측정 (결제 / MAP 대용량 영향).

### T3-Gate
- staging dry-run 성공. 운영자 승인 후 maintenance window 일정 확정.

---

## 5. Phase 4 — Raw SQL 의존 코드 재작성 (2-3일)

### T4-01. `get-dashboard-kpi.use-case.ts` 재작성
- `tac_pay_orders` / `tac_enrollments` / `tac_consultations` raw SELECT → PG repository + query builder.
- 응답 shape 변경 0 (DTO 유지).
- EXPLAIN ANALYZE 회귀 점검 (NFR-MYSQL-OUT-6).

### T4-02. `provisioning.use-case.ts` 재작성
- `tac_academies` + `tac_pay_refund_policies` seed → `amb_acm_tenant` + `amb_acm_pay_refund_policy` seed.

### T4-03. 기타 raw SQL grep 점검
- `grep -rn "tac_" backend/src --include='*.ts'` → 0 hit 확인.

### T4-Gate
- backend `nest build` clean. 전체 spec pass.

---

## 6. Phase 5 — 컷오버 리허설 (1-2일, Q-3 = 0일 dual-write)

### T5-01. cutover script — `scripts/cutover-mysql-to-pg.sh`
- maintenance page 활성화 → `mysqldump db_tac > backup.sql.gz` → S3 업로드 → migration runner 실행 → row diff 검증 → backend image swap → smoke → maintenance page 비활성.

### T5-02. Maintenance page 준비
- nginx 정적 503 페이지 — 모든 경로에서 "점검 중 (예상 종료 시각 XX:YY)" 표시.
- nginx 설정 추가 `try_files maintenance.html @backend`.

### T5-03. Staging full cutover 리허설
- staging 의 MySQL → PG cutover 전체 수행. smoke 항목 통과. rollback drill 실행.

### T5-04. Rollback runbook
- `docs/deployment/RUNBOOK-260622-mysql-to-pg-cutover.md`:
  - 사전 백업 위치
  - cutover 실행 절차 (15분 estimate)
  - 실패 시 rollback 절차 (60분 SLA — git revert + DB restore)

### T5-Gate
- staging cutover 검증 완료. 운영자가 production maintenance window 확정 (KST 02:00~04:00 권장).

---

## 7. Phase 6 — Production Cutover (1일 · maintenance window)

### T6-01. 사전 작업 (T-30분)
- production `mysqldump` + `pg_dump` → S3.
- maintenance page 활성화.
- BODA / AMA 알림은 운영자가 사전 공지.

### T6-02. Migration 실행 (T-15분)
- `scripts/cutover-mysql-to-pg.sh production` 실행.
- 로그 실시간 모니터링.
- row diff 0 확인.

### T6-03. Image swap + smoke (T-5분)
- 새 backend image (Phase 4 까지 반영 — PG only) 배포.
- smoke: 로그인 / 결제 endpoint / dashboard / MAP / 알림 / 감사 로그.

### T6-04. Maintenance page off (T+0분)
- nginx 리로드.
- 운영자 + dev 가 30분간 활성 감시.

### T6-Gate
- AC-1 ~ 11 모두 pass. 운영자 승인 후 Phase 7 진입.

---

## 8. Phase 7 — MySQL 제거 + 코드 cleanup (1일)

### T7-01. Backend 정리
- `backend/src/**/*.typeorm-entity.ts` 의 `tac_*` entity 40개 삭제.
- TypeORM `default` datasource (MySQL) 제거 → PG 가 default.
- `ACM_DS` 상수 폐기 또는 alias 유지 (호환성).

### T7-02. Docker stack 정리
- `docker/{staging,production}/docker-compose.*.yml` — `mysql` service block 삭제.
- `.env.{staging,production}.example` — `MYSQL_*` 라인 삭제.
- `scripts/deploy-{staging,production}.sh` §4 (MySQL migration) 블록 삭제.

### T7-03. Container 삭제 (Q-4 즉시 삭제)
- staging: `docker rm -f tac-mysql && docker volume rm staging_mysql`
- production: `docker rm -f tac-prod-mysql && docker volume rm production_mysql`
- (백업은 이미 S3 보관 — Phase 6 T6-01)

### T7-04. 문서 정리
- `CLAUDE.md` Tech Stack 표에서 MySQL 행 삭제.
- `docs/reference/MANUAL-*` 의 MySQL 언급 삭제.
- 새 RPT-260622 작성.

### T7-Gate
- AC-3 (`grep "tac_"` 0 hit) 통과.
- cd-staging + cd-production 정상.

---

## 9. 트랙 합산 일정

| Phase | 트랙 | 영업일 | 누적 |
|---|---|---|---|
| 0 | 인벤토리 + 의사결정 | 1-2 | 2 |
| 1 | 신규 PG 스키마 (7 SQL 파일) | 3-5 | 7 |
| 2 | 백엔드 모듈 재작성 (5 신규 모듈 + 확장) | 5-10 | 17 |
| 3 | 데이터 이전 스크립트 + dry-run | 3-5 | 22 |
| 4 | Raw SQL 재작성 | 2-3 | 25 |
| 5 | 컷오버 리허설 + Runbook | 1-2 | 27 |
| 6 | Production cutover (1일, MW) | 1 | 28 |
| 7 | MySQL 제거 + cleanup | 1 | **29** |

**예상 총 기간: 약 6주 (22-29 영업일)**. 단축 옵션: Phase 2 의 일부 모듈 (acm-posts, acm-program, acm-classroom) 을 운영자가 우선순위 후순 결정 시 Phase 7 후 별도 PR 로 이연 가능.

---

## 10. 영향받는 파일 (개략)

### 10.1 신규 (약 60+)
- `sql/acm/950 ~ 980` — 7 SQL 파일
- `backend/src/modules/acm-pay/{domain,application,infrastructure,presentation}/*` — 약 20 파일
- `backend/src/modules/acm-notification/*` — 약 6 파일
- `backend/src/modules/acm-audit/*` — 약 4 파일
- `backend/src/modules/acm-posts/*` + `acm-program/*` + classroom — 약 10 파일
- `backend/src/modules/acm-map/*` 확장 — 약 8 파일
- `scripts/migrate-mysql-to-pg/*` — CLI 작성
- `scripts/cutover-mysql-to-pg.sh`
- 문서 — REQ + PLN + RPT + 스키마 매핑 spec + runbook + manual update

### 10.2 수정 (약 30+)
- 기존 `presentation/payment.module.ts` + 관련 controller — 이전
- `get-dashboard-kpi.use-case.ts`, `provisioning.use-case.ts` — raw SQL 재작성
- `docker/{staging,production}/docker-compose.*.yml`
- `.env.{staging,production}.example`
- `scripts/deploy-{staging,production}.sh`
- `backend/src/infrastructure/database/*.ts` — datasource 단일화
- `backend/src/app.module.ts` — module imports 정리

### 10.3 삭제 (Phase 7)
- 약 40 `tac_*` typeorm-entity.ts 파일
- MySQL datasource 설정
- 기타 dead 5 테이블 entity

---

## 11. Risks + Mitigations (상세)

| 위험 | 영향 | 완화 |
|---|---|---|
| MySQL 데이터 일부 누락 이전 | 결제 / 출결 / 감사 손실 | T3 dry-run row diff 검증 + production cutover 직전 `mysqldump` 비교 |
| PG 신규 인덱스 미설계로 dashboard 503 | 사용자 노출 | T4-01 시 EXPLAIN ANALYZE + 1일 grace 감시 |
| Toss / NTS 외부 vendor 영향 | 결제 실패 | webhook URL 변경 없음 + Toss idempotency-key 그대로 + NTS cert는 envelope 그대로 |
| audit_log 대용량 적재 시 PG 성능 | KPI 회귀 | BRIN 인덱스 + 90일 자동 archive cron (T2-04) |
| Phase 6 cutover 60분 초과 | maintenance window 초과 | T5-03 staging 리허설로 측정 + buffer 30분 |
| 작업 중 신규 feature PR 충돌 | merge hell | feature freeze 권고 (Phase 2-6 기간 약 4주) |
| BODA_CRYPTO_KEY 노출 follow-up 미해결 | 보안 follow-up 누락 | 본 작업과 무관 — 별도 follow-up 처리 (REQ 와 별도) |

---

## 12. Done 정의

- [ ] Phase 0~7 모든 gate 통과.
- [ ] AC-1 ~ 11 (REQ §6) 통과.
- [ ] Production `acm.amoeba.site` 의 backend 가 PG 단일 datasource 로 운영.
- [ ] `docker compose ps` 에 `mysql` 컨테이너 없음.
- [ ] `grep "tac_" backend/src` 0 hit.
- [ ] CLAUDE.md / MANUAL 문서 MySQL 언급 제거.
- [ ] S3 백업 (`db_tac.sql.gz`) 90일 보관 시작.
- [ ] RPT-260622 작성 + 운영자 sign-off.

---

## 13. Sign-off (승인 대기)

본 PLN 은 **draft**. 운영자 승인 시 → Phase 0 (인벤토리) 즉시 진입.

핵심 승인 요청:
1. 약 6주 일정 (22-29 영업일).
2. Phase 2 기간 (약 2주) **feature freeze** 권고 — 결제 / MAP / 알림 모듈 신규 PR 보류.
3. Phase 6 maintenance window (KST 02:00~04:00 권장) 사전 일정 확정.
4. Q-2 N 값 (default 90일) — Phase 0 T0-02 에서 final 결정.
