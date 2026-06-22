---
document_id: REQ-260622-mysql-to-postgres-full-migration
version: 1.0.0
status: draft
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/plan/PLN-260622-mysql-to-postgres-full-migration.md (작성 예정)
change_log:
  - 2026-06-22 v1.0.0 draft — 25 미이전 테이블 + 14 이중화 테이블 + 5 dead entity 전면 정리
---

# 요구사항 — MySQL 전면 제거 + PostgreSQL 단일화

> **One-liner**: TAC 코어 MySQL(`db_tac`, 39 테이블) 을 완전 폐기하고 모든 도메인을 PostgreSQL(`db_acm`) 로 통합한다. 코드·인프라·데이터 모두 PG 단일화.

---

## 1. Overview (개요)

### 1.1 배경
- ACM v1.0a 부터 새 모듈을 PostgreSQL(`amb_acm_*`) 에 만들면서 backend 가 dual-DB 구조 (MySQL + PG) 로 운영 중.
- 결과적으로 동일 도메인 (학생·교사·수업 등) 이 양쪽에 존재하여 데이터 권위 불명확 / 유지보수 부담 증가.
- 운영자 결정: **MySQL 완전 폐기, PostgreSQL 단일 운영.**

### 1.2 목표
- `backend` 가 PG 단일 datasource 로만 동작.
- `docker-compose.{staging,production}.yml` 에서 `mysql` 서비스 제거.
- 모든 `tac_*` 테이블의 데이터를 PG `amb_acm_*` 로 이전 + 코드 경로 재배치.
- 운영 무중단 — 배포 사이 결제 / 출결 / 로그인 같은 critical path 손실 0.

### 1.3 비목표 (Out of scope)
- 기능 추가 / UX 변경. **순수 1:1 이전 + 폐기.**
- 데이터베이스 엔진 외 다른 인프라 변경 (Redis, RabbitMQ, S3 그대로).
- legacy `frontend/` Next.js — 이미 archive 상태 (PLN-260519). 본 REQ 의 변경은 `frontend-acm/` 만 대상.

---

## 2. 현재 상태 분석 — 39 테이블 분류

### 2.1 PG 등가 이미 존재 — 14 테이블 (이중화 운영 중)
| MySQL | PG 등가 | 현재 권위 | 처리 |
|---|---|---|---|
| `tac_users` | `amb_acm_user` | ACM 신규 가입자: PG / legacy: MySQL | **PG 단일화** + 데이터 병합 |
| `tac_students` | `amb_acm_std_student` | 신규: PG (REQ-260621) | PG 단일화 + 데이터 병합 |
| `tac_parents` | `amb_acm_std_parent` | PG | PG 단일화 |
| `tac_teachers` | `amb_acm_tch_teacher` | PG | PG 단일화 |
| `tac_classes` | `amb_acm_cls_classes` | PG (CLS v1.0b) | PG 단일화 |
| `tac_class_sessions` | `amb_acm_cls_sessions` | PG | PG 단일화 |
| `tac_enrollments` | `amb_acm_csl_enrollment` | PG | PG 단일화 |
| `tac_attendances` | `amb_acm_cls_attendance` | PG | PG 단일화 |
| `tac_consultations` | `amb_acm_csl_inquiry` | PG | PG 단일화 (스키마 mapping 필요 — 부분 등가) |
| `tac_student_guardians` | `amb_acm_std_student_parent` | PG | PG 단일화 |
| `tac_menu_permissions` | `amb_acm_tenant_menu` | PG | PG 단일화 (스키마 정렬 필요) |
| `tac_map_passages` | `amb_acm_map_passage` | 미사용 | 데이터 이전 |
| `tac_user_academies` | `amb_acm_tenant` (+ user.entId) | PG | 모델 fold |
| `tac_subscription_events` | (PG 등가 신규 필요) | MySQL | **신규 PG 테이블 생성** |

### 2.2 PG 등가 없음 — 신규 스키마 + 데이터 이전 필요 (25 테이블)

| 도메인 | MySQL 테이블 | 신규 PG 명 | 우선도 |
|---|---|---|---|
| **결제** (6) | `tac_pay_orders`, `tac_pay_ledger`, `tac_pay_receipts`, `tac_pay_refund_policies`, `tac_pay_refund_policy_tiers`, `tac_pay_tax_invoices` | `amb_acm_pay_*` | 🔴 P0 |
| **MAP 평가** (8) | `tac_map_items`, `tac_map_item_tags`, `tac_map_test_sets`, `tac_map_test_set_items`, `tac_map_assignments`, `tac_map_responses`, `tac_map_scores`, `tac_map_passage_assets` | `amb_acm_map_*` (확장) | 🔴 P0 |
| **알림** (2) | `tac_notification_templates`, `tac_notification_logs` | `amb_acm_notification_*` | 🟡 P1 |
| **감사 로그** (1) | `tac_audit_logs` | `amb_acm_audit_log` | 🟡 P1 |
| **포털 / 카탈로그** (4) | `tac_posts`, `tac_programs`, `tac_program_settings`, `tac_classrooms` | `amb_acm_posts_*`, `amb_acm_programs`, `amb_acm_classroom` | 🟢 P2 |
| **상담 보조** (3) | `tac_visit_records`, `tac_counseling_records`, `tac_consultation_intake_form` | `amb_acm_csl_visit_record` etc | 🟡 P1 |
| **기타** (1) | `tac_external_test_scores` | `amb_acm_std_external_test_score` | 🟢 P2 |

### 2.3 Dead — 즉시 삭제 가능 (5 테이블)
- `tac_counseling_records` — orphan
- `tac_consultation_intake_form` — orphan
- `tac_external_test_scores` — orphan (service import 없음, 향후 부활 시 새로 작성 권장)
- `tac_student_guardians` — relationship 테이블이지만 자체 query 없음 (이미 `amb_acm_std_student_parent` 가 대체)
- `tac_classrooms` — FK 만 받는 마스터, 실제 controller / use-case 미사용

위 5 테이블은 §2.2 의 ‘orphan’ 으로 재확인 후 단순 entity 삭제만 진행 (데이터 이전 불요).

---

## 3. Raw SQL 의존성 (코드 재작성 필요)

| 파일 | 의존 테이블 | 작업 |
|---|---|---|
| `backend/src/application/.../get-dashboard-kpi.use-case.ts` | `tac_pay_orders`, `tac_enrollments`, `tac_consultations` 등 | PG 쿼리로 재작성 (전체 SELECT 문 교체) |
| `backend/src/application/.../provisioning.use-case.ts` | `tac_academies`, `tac_pay_refund_policies` seed | `amb_acm_tenant` + `amb_acm_pay_refund_policy` seed 로 교체 |

---

## 4. Functional Requirements (기능 요구사항)

### FR-MYSQL-OUT-1 — Backend 단일 datasource
- TypeORM `default` datasource = PG (`type: 'postgres'`, `db_acm`).
- `ACM_DS = 'acm-pg'` alias 폐기 (또는 `default` 와 동일 가리키도록 단순화) — 모든 entity 가 같은 connection 사용.
- env 정리: `DB_HOST/PORT/USER/PASSWORD/DATABASE` 제거 또는 PG 값으로 통합.

### FR-MYSQL-OUT-2 — 모든 `tac_*` 엔티티 폐기
- `backend/src/**/*.typeorm-entity.ts` 중 `@Entity('tac_*')` 40 종 삭제.
- 같은 도메인의 PG 등가 (`amb_acm_*`) 엔티티만 유지.
- 의존하던 서비스 / 컨트롤러 / 인터셉터 / 유스케이스 / repo interface 모두 PG 엔티티로 swap.

### FR-MYSQL-OUT-3 — 신규 PG 스키마 (25 테이블)
- 도메인별 분리된 마이그레이션 파일 (`sql/acm/950 ~ 990`).
- 도메인별 책임 모듈에 entity / repository / service / DTO 생성 또는 기존 모듈에 추가:
  - `acm-pay` (신규 모듈)
  - `acm-map` (확장)
  - `acm-notification` (신규 모듈)
  - `acm-audit` (신규 모듈 또는 common 에 흡수)
  - `acm-posts` (신규 모듈)
  - `acm-csl` (visit_record 등 추가)

### FR-MYSQL-OUT-4 — 데이터 이전 스크립트
- production / staging 의 MySQL 데이터를 PG 로 1회 이전 + 검증.
- per-tenant idempotent 스크립트 (재실행 안전).
- 도구 후보: `pgloader` 또는 backend 의 `npm run migrate:mysql-to-pg` 커스텀 NestJS CLI.
- 이전 후 row-count diff 0 검증 필수.

### FR-MYSQL-OUT-5 — Docker stack 정리
- `docker/{staging,production}/docker-compose.*.yml` 에서 `mysql` service block 완전 제거.
- `.env.{staging,production}.example` 에서 `MYSQL_*` 환경변수 라인 삭제.
- `scripts/deploy-{staging,production}.sh` 의 §4 (MySQL migration) 블록 삭제.
- nginx 설정 / DNS / 백업 cron 영향 없음 (별도 layer).

### FR-MYSQL-OUT-6 — Frontend 영향 0
- `frontend-acm` 은 DTO 만 보므로 변경 없음. 단 응답 필드명 / 형식 차이가 있다면 (snake_case → camelCase 등) 백엔드에서 호환 유지.

### FR-MYSQL-OUT-7 — 점진적 컷오버 (운영 무중단)
- 7 phase 진행 (PLN-260622 참조). 각 phase 끝에 staging 검증 + 사용자 승인.
- 결제 / 출결 / 로그인 같은 critical path 는 dual-write 기간을 두고 결과 비교 후 cutover.

---

## 5. Non-Functional Requirements

| ID | 항목 | 기준 |
|---|---|---|
| NFR-MYSQL-OUT-1 | **무중단** | cutover 시 사용자 노출 다운타임 ≤ 60초 (image swap + restart). |
| NFR-MYSQL-OUT-2 | **데이터 무손실** | MySQL → PG 이전 후 row count 100% 일치 확인 (per-tenant). |
| NFR-MYSQL-OUT-3 | **롤백** | 각 phase 가 git revert + 데이터 backup restore 로 1시간 이내 롤백 가능. |
| NFR-MYSQL-OUT-4 | **PCI-DSS** | 결제 테이블 이전 시 카드 PAN 절대 노출 X — `tac_pay_orders.pg_payment_key` (토큰만) 이미 PCI-DSS SAQ-A 준수. PG 이전 시도 동일 정책 유지. |
| NFR-MYSQL-OUT-5 | **개인정보 암호화** | `parents.phone_encrypted`, `receipts.buyer_identifier` 등 AES-GCM 컬럼은 PG 이전 시 그대로 BYTEA 보존 (재암호화 X). |
| NFR-MYSQL-OUT-6 | **인덱스 + 성능** | dashboard KPI 쿼리 응답 ≤ 500ms (legacy MySQL 대비 회귀 X). PG 인덱스 사전 설계. |
| NFR-MYSQL-OUT-7 | **감사 로그 유지** | `tac_audit_logs` 의 운영 기록 (~수십만 row) 손실 X. archive 테이블로 이전. |

---

## 6. Acceptance Criteria (수락 기준)

| AC | 시나리오 | 기대 결과 |
|---|---|---|
| AC-1 | `docker compose ps` | `tac-mysql` / `tac-prod-mysql` 컨테이너 없음 (서비스 정의 자체 부재). |
| AC-2 | backend startup logs | MySQL datasource 초기화 시도 0건 (`type: 'mysql'` 코드 부재). |
| AC-3 | `find backend/src -name '*.ts' \| xargs grep "tac_"` | 0 hit (entity / Repository / raw SQL 어디서도 `tac_*` 참조 없음). |
| AC-4 | row count 검증 | 이전 직후 staging 의 각 테이블 row count = 사전 MySQL row count. ±0. |
| AC-5 | KPI 대시보드 | `/admin/dashboard?preset=thisMonth` 평소대로 동작 (실 데이터 표시 확인). |
| AC-6 | 결제 흐름 | Toss 결제 시도 → `amb_acm_pay_order` insert + receipt + 알림. NTS 세금계산서 status `DRAFT → SUBMITTED → APPROVED`. |
| AC-7 | MAP 평가 | 강사가 학생에게 assignment 발급 + 학생 응답 + 자동 채점. PG 단독 동작. |
| AC-8 | 알림 발송 | invitee_notifier / cls.jobs / dashboard.cron 모두 `amb_acm_notification_*` 사용. |
| AC-9 | 감사 로그 | interceptor 가 PG `amb_acm_audit_log` 에 기록. archive 데이터 조회 가능. |
| AC-10 | i18n | 변경 없음 — DTO 호환 유지로 frontend 회귀 0. |
| AC-11 | rollback | git revert + DB snapshot restore 로 1시간 이내 이전 상태 복귀. |

---

## 7. Open questions / 운영자 결정 필요

| ID | 질문 | 결정자 | 영향 |
|---|---|---|---|
| Q-1 | 결제 데이터 (tac_pay_*) — 최근 N개월만 이전 vs 전체 이전? | 운영자 / 회계 | row 수 / migration 시간 |
| Q-2 | `tac_audit_logs` — 전체 이전 vs N일치만 이전? (대용량) | 운영자 | PG 용량 |
| Q-3 | dual-write 기간 — 0일 (즉시 컷오버) vs 7일 (관찰) ? | 운영자 | 위험도 trade-off |
| Q-4 | MySQL 컨테이너 즉시 삭제 vs 30일 cold standby ? | 운영자 | 롤백 대응성 |
| Q-5 | `tac_consultations` ↔ `amb_acm_csl_inquiry` 스키마 mapping — 자동 vs 수동 reconcile ? | 운영자 / CSL 모듈 owner | reconcile 효과 |
| Q-6 | `tac_users` ↔ `amb_acm_user` 권위 통합 — 신규 ACM 사용자가 권위 vs MySQL legacy 우선 vs 양쪽 병합 ? | 운영자 / auth owner | 로그인 흐름 |

---

## 8. Risks + Mitigations

| 위험 | 영향 | 완화 |
|---|---|---|
| 결제 데이터 이전 중 inconsistency | 매출 누락 / 환불 차이 | dual-write 기간 + Toss webhook idempotency 활용 + row diff 검증 |
| 라이브 트래픽 중 cutover 시 503 | 사용자 노출 | maintenance window (KST 02:00~04:00) + nginx 정적 maintenance page |
| 마이그레이션 스크립트 버그로 데이터 손상 | 복구 불가 | 모든 phase 전 `pg_dump` + `mysqldump` 백업 + S3 보관 |
| PG 성능 저하 (인덱스 미설계) | KPI 대시보드 응답 지연 | phase 별 `EXPLAIN ANALYZE` benchmark + 필요 시 인덱스 추가 PR |
| 외부 vendor 호환 (Toss webhook 등) | 결제 실패 | Toss endpoint 변경 없음 (backend URL 동일). PG cutover 후 webhook smoke 의무. |
| MySQL container 삭제 후 발견된 누락 | 데이터 손실 | 30일 cold MySQL container (stop 만, rm 안함) 정책 권장 (Q-4) |
| 작업 기간 중 신규 기능 PR 충돌 | merge hell | feature freeze 또는 별도 feature branch 운영 + 짧은 phase 길이 |

---

## 9. Phasing 개요 (자세한 단계는 PLN-260622)

| Phase | 산출물 | 기간 |
|---|---|---|
| 0 | 데이터 인벤토리 + row count 보고 + Q-1~6 결정 | 1-2일 |
| 1 | 신규 PG 스키마 + 마이그레이션 파일 (`sql/acm/950+`) | 3-5일 |
| 2 | 도메인별 백엔드 모듈 재작성 (acm-pay 신규, acm-map 확장, acm-notification, acm-audit, acm-posts) | 1-2주 |
| 3 | MySQL → PG 데이터 이전 스크립트 + staging dry-run | 3-5일 |
| 4 | Raw SQL 의존 코드 (dashboard KPI / provisioning) 재작성 | 2-3일 |
| 5 | dual-write 기간 (선택) + cutover 리허설 | 1-7일 |
| 6 | Production cutover (배포 + smoke + 감시) | 1일 (maintenance window) |
| 7 | MySQL 컨테이너 + entity / datasource / env 제거 + 최종 정리 | 1일 |
| **합계** | **약 4-6주** | — |

---

## 10. Sign-off (승인 대기)

- 본 REQ 는 **draft**. 운영자 승인 시 → PLN-260622 작성 → Phase 0 진입.
- 핵심 결정 항목: Q-1 (결제 데이터 범위) / Q-3 (dual-write 기간) / Q-4 (MySQL cold standby) 는 PLN 작성 전에 회신 필요.
- 작업 중 신규 결제 / MAP / 알림 기능 PR feature freeze 권장 — merge 충돌 방지.
