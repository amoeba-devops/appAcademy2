---
document_id: SPEC-260622-tac-to-pg-schema-map
version: 1.0.0
status: draft
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md
  - docs/plan/PLN-260622-mysql-to-postgres-full-migration.md
---

# 스키마 매핑 Spec — MySQL `tac_*` → PostgreSQL `amb_acm_*`

> Phase 1 (신규 PG 스키마) 작성 + Phase 3 (데이터 이전) 변환 룰의 단일 기준 문서.

---

## 1. 전역 변환 규칙

### 1.1 ID 체계 — BIGINT → UUID
| MySQL | PostgreSQL |
|---|---|
| `BIGINT UNSIGNED AUTO_INCREMENT` (PK) | `UUID DEFAULT gen_random_uuid()` (PK) |
| FK 참조 `tac_X.x_id BIGINT` | FK 참조 `amb_acm_X.id UUID` |

**ID 매핑 보존**: 각 신규 테이블에 **`legacy_id BIGINT UNIQUE`** 컬럼 추가. 이전 시 MySQL 의 원본 PK 를 보존 → Phase 3 의 FK 변환이 가능 (`SELECT id FROM amb_acm_X WHERE legacy_id = ?`). Phase 7 +N일 후 안전 확인 시 `legacy_id` 컬럼 drop.

### 1.2 Tenant 키 — `acd_id BIGINT` → `ent_id UUID`
- 기존 MySQL: 학원 = `tac_academies.acd_id BIGINT`.
- PG: 테넌트 = `amb_acm_tenant.id UUID` (= AMA `entity_id`).
- 변환: `acd_id → ent_id` mapping 은 `amb_acm_tenant.legacy_acd_id BIGINT` 컬럼 (T1 전 1회 add) + JOIN.
- 모든 신규 `amb_acm_*` 테이블의 `ent_id UUID NOT NULL` 컬럼 (기존 ACM 규칙 그대로).

### 1.3 데이터 타입 매핑
| MySQL | PostgreSQL |
|---|---|
| `BIGINT UNSIGNED` | `BIGINT` (PG 는 UNSIGNED 없음 — application-side 검증) |
| `INT` | `INTEGER` |
| `TINYINT(1)` (boolean) | `BOOLEAN` |
| `DECIMAL(12,2)` | `NUMERIC(12,2)` |
| `DECIMAL(5,4)` | `NUMERIC(5,4)` |
| `VARCHAR(N)` | `VARCHAR(N)` (그대로) |
| `TEXT` | `TEXT` |
| `DATE` | `DATE` |
| `DATETIME` | `TIMESTAMPTZ` (timezone 보존 — UTC 저장) |
| `DATETIME ON UPDATE CURRENT_TIMESTAMP` | `TIMESTAMPTZ` + `set_updated_at` trigger (기존 ACM 패턴) |
| `VARBINARY(N)` | `BYTEA` (암호화 컬럼 그대로 보존) |
| `JSON` | `JSONB` |
| `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` | (불요 — PG 기본 UTF-8) |

### 1.4 인덱스
| MySQL | PostgreSQL |
|---|---|
| `KEY idx_X (...)` | `CREATE INDEX idx_X ON amb_acm_X (...)` |
| `UNIQUE KEY uq_X (...)` | `CREATE UNIQUE INDEX uq_X ON amb_acm_X (...)` |
| 대용량 시계열 (`audit_log.created_at`) | **BRIN** 인덱스 사용 (PG 특화 — 압축 효율) |
| 한국어 LIKE 검색 | **pg_bigm** trigram 인덱스 (기존 ACM 패턴) |

### 1.5 CHECK 제약
- MySQL `CHECK (...)` 그대로 보존 (PG 도 동일 syntax 지원).

### 1.6 set_updated_at 트리거
- PG 는 `ON UPDATE CURRENT_TIMESTAMP` 가 없으므로, 모든 신규 테이블에 다음 trigger 적용:
```sql
CREATE TRIGGER set_updated_at_amb_acm_X
BEFORE UPDATE ON amb_acm_X
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```
(`set_updated_at()` 함수는 `sql/acm/100-acm-v1.0a-init.sql` 에 이미 정의됨.)

---

## 2. 도메인별 매핑

### 2.0 모델 분리 결정 — Class enrollment ≠ CSL pipeline marker

본 마이그레이션 진행 중 `tac_enrollments` (학생-수업 join) 와 PG `amb_acm_csl_enrollment` (상담 파이프라인 단계 마커, FK → inquiry) 가 **다른 도메인 개념** 임을 확인. 옵션 X 채택:

- **신규**: `amb_acm_cls_enrollment` (sql/acm/952) — 학생 × 수업 join, `tac_enrollments` 1:1 미러
- **기존**: `amb_acm_csl_enrollment` (sql/acm/100) — 상담 파이프라인 단계 마커 그대로 유지
- 결제 모듈 FK: `amb_acm_pay_order.enrollment_id → amb_acm_cls_enrollment(ce_id)`. sql/acm/950 의 ALTER 는 952 끝에 위치 (deploy 순서 보장).

### 2.1 결제 (`tac_pay_*` → `amb_acm_pay_*`) — 6 테이블

#### 2.1.1 `tac_pay_refund_policies` → `amb_acm_pay_refund_policy`
| MySQL | PostgreSQL | 비고 |
|---|---|---|
| `rfp_id BIGINT AUTO_INC` | `id UUID PK` | UUID 신규 발급 |
| (legacy id 보존) | `legacy_id BIGINT UNIQUE` | Phase 3 만 사용, Phase 7 + 30일 drop |
| `acd_id BIGINT` | `ent_id UUID NOT NULL` | tenant mapping 으로 변환 |
| `rfp_version INT` | `version INTEGER` | |
| `rfp_basis VARCHAR(20)` | `basis VARCHAR(20)` + CHECK | enum 보존 |
| `rfp_label VARCHAR(100)` | `label VARCHAR(100)` | |
| `rfp_effective_from DATE` | `effective_from DATE` | |
| `rfp_effective_to DATE` | `effective_to DATE` | |
| `rfp_is_default_template TINYINT(1)` | `is_default_template BOOLEAN` | |
| `rfp_created_by BIGINT` | `created_by UUID` | user_id mapping |
| `rfp_created_at DATETIME` | `created_at TIMESTAMPTZ` | |
| — | `updated_at TIMESTAMPTZ` (신규) | trigger |
| `UNIQUE (acd_id, rfp_version)` | `UNIQUE (ent_id, version)` | |

#### 2.1.2 `tac_pay_refund_policy_tiers` → `amb_acm_pay_refund_policy_tier`
- 컬럼 prefix 제거 (`rpt_*` → 평문).
- FK: `rfp_id BIGINT → policy_id UUID` (legacy_id JOIN 으로 변환).
- CHECK 제약 보존 (`elapsed_ratio_min < elapsed_ratio_max`, `refund_rate IN [0,1]`).

#### 2.1.3 `tac_pay_orders` → `amb_acm_pay_order` (운영 핵심)
| 컬럼 | 처리 |
|---|---|
| `pod_id BIGINT` | `id UUID` |
| `acd_id` | `ent_id UUID` |
| `enr_id BIGINT` | `enrollment_id UUID` (FK → `amb_acm_csl_enrollment.id`) |
| `pod_order_no VARCHAR(40) UNIQUE` | `order_no VARCHAR(40) UNIQUE NOT NULL` |
| `pod_idempotency_key VARCHAR(64) UNIQUE` | `idempotency_key VARCHAR(64) UNIQUE NOT NULL` |
| `pod_amount DECIMAL(12,2)` | `amount NUMERIC(12,2)` |
| `pod_currency CHAR(3)` | `currency CHAR(3) DEFAULT 'KRW'` |
| `pod_method VARCHAR(20)` | `method VARCHAR(20)` + CHECK enum |
| `pod_pg_provider VARCHAR(20)` | `pg_provider VARCHAR(20) DEFAULT 'TOSS'` |
| `pod_pg_payment_key VARCHAR(200)` | `pg_payment_key VARCHAR(200)` (PCI-DSS — 토큰만, 원본 PAN 절대 X) |
| `pod_status VARCHAR(30)` | `status VARCHAR(30)` + CHECK enum (READY/IN_PROGRESS/DONE/CANCELED/PARTIAL_CANCELED/ABORTED/EXPIRED) |
| `rfp_id` | `refund_policy_id UUID` |
| 모든 `*_at DATETIME` | `*_at TIMESTAMPTZ` |
| 인덱스 `(acd_id, status)` | `(ent_id, status)` |
| 인덱스 `(enr_id)` | `(enrollment_id)` |

#### 2.1.4 `tac_pay_ledger` → `amb_acm_pay_ledger`
- `pod_id → order_id UUID`, `rpt_id → tier_id UUID`.
- 컬럼 prefix 제거. nullable / NOT NULL 그대로.

#### 2.1.5 `tac_pay_receipts` → `amb_acm_pay_receipt`
- `rct_buyer_identifier VARBINARY(128)` → `buyer_identifier BYTEA` (AES-GCM 보존 — Phase 3 에서 재암호화 X, raw bytes 그대로).
- 인덱스 `(pod_id)` → `(order_id)`.

#### 2.1.6 `tac_pay_tax_invoices` → `amb_acm_pay_tax_invoice`
- 컬럼 30개 prefix 제거. `pod_id → order_id`, `acd_id → ent_id`.
- CHECK `total_amount = supply_amount + tax_amount` 보존.
- 인덱스 `(status, nts_submitted_at)` 보존 — NTS pending 조회용.

### 2.2 MAP 평가 (`tac_map_*` → `amb_acm_map_*`) — 8 신규 (기존 2 + 신규 8)

이미 존재: `amb_acm_map_passage`, `amb_acm_map_question`. 확장 필요 8개:

| MySQL | PostgreSQL | 핵심 컬럼 |
|---|---|---|
| `tac_map_items` | `amb_acm_map_item` | `passage_id`, `item_no`, `prompt`, `choices JSONB`, `answer_key`, `points NUMERIC(5,2)` |
| `tac_map_item_tags` | `amb_acm_map_item_tag` | `item_id`, `tag VARCHAR(50)` — composite PK |
| `tac_map_test_sets` | `amb_acm_map_test_set` | `ent_id`, `title`, `level`, `time_limit_min`, `published BOOLEAN` |
| `tac_map_test_set_items` | `amb_acm_map_test_set_item` | `test_set_id`, `item_id`, `position INT` — composite PK |
| `tac_map_assignments` | `amb_acm_map_assignment` | `test_set_id`, `student_id UUID`, `assigned_by UUID`, `due_at TIMESTAMPTZ`, `status` |
| `tac_map_responses` | `amb_acm_map_response` | `assignment_id`, `item_id`, `selected_choice`, `is_correct BOOLEAN`, `submitted_at TIMESTAMPTZ` |
| `tac_map_scores` | `amb_acm_map_score` | `assignment_id`, `total_score NUMERIC(7,2)`, `percentile NUMERIC(5,2)`, `graded_at TIMESTAMPTZ` |
| `tac_map_passage_assets` | `amb_acm_map_passage_asset` | `passage_id`, `s3_key VARCHAR(500)`, `mime VARCHAR(100)`, `size_bytes BIGINT` |

특이사항:
- `tac_map_responses` 의 응답 옵션은 MySQL JSON. PG 는 `JSONB` 로 → 인덱스 가능.
- 대용량 (수강생당 수십 응답) 인덱스: `(assignment_id, item_id)` + `(student_id, submitted_at)`.

### 2.3 알림 (`tac_notification_*` → `amb_acm_notification_*`) — 2 테이블

#### 2.3.1 `tac_notification_templates` → `amb_acm_notification_template`
- `ntp_*` prefix 제거. `acd_id → ent_id`.
- 컬럼: `code VARCHAR(40) UNIQUE per ent_id`, `channel VARCHAR(20)` (EMAIL/AMOEBATALK/SMS), `subject`, `body_text`, `body_html TEXT`, `locale VARCHAR(10)`, `is_active BOOLEAN`.

#### 2.3.2 `tac_notification_logs` → `amb_acm_notification_log`
- `ntl_*` prefix 제거.
- 대용량 — **BRIN** on `(created_at)` + `(ent_id, recipient_kind, recipient_id)` btree.
- enum: `status VARCHAR(20)` (SENT/FAILED/SKIPPED/PENDING).

### 2.4 감사 로그 (`tac_audit_logs` → `amb_acm_audit_log`) — 1 테이블

| MySQL | PostgreSQL |
|---|---|
| `aud_id BIGINT AUTO_INC` | `id UUID` |
| `acd_id` | `ent_id UUID` |
| `usr_id` | `user_id UUID` |
| `aud_method VARCHAR(10)` | `http_method VARCHAR(10)` |
| `aud_path VARCHAR(500)` | `http_path VARCHAR(500)` |
| `aud_status INT` | `http_status INTEGER` |
| `aud_request_id VARCHAR(64)` | `request_id VARCHAR(64)` |
| `aud_ip VARCHAR(45)` | `src_ip VARCHAR(45)` |
| `aud_user_agent TEXT` | `user_agent TEXT` |
| `aud_body_summary JSON` | `body_summary JSONB` |
| `aud_created_at DATETIME` | `created_at TIMESTAMPTZ` |

특화 인덱스:
- `BRIN (created_at)` — 시계열 압축 (수백만 row).
- `BTREE (ent_id, user_id, created_at DESC)` — 사용자별 최근 행위 조회.

데이터 이전: **Q-2 N일치만** (default 90일). 이전 데이터는 `s3://amoeba-acm-backups/audit-archive/{ent_id}/2026-06-22-cutoff.sql.gz` 보관.

자동 archive cron (Phase 2 T2-04):
```ts
@Cron('0 4 * * *', { timeZone: 'Asia/Seoul' })
async archiveOldAuditLogs() {
  // 90일 초과 row → S3 archive + DELETE.
}
```

### 2.5 포털 / 카탈로그 (4 테이블)

| MySQL | PostgreSQL |
|---|---|
| `tac_posts` | `amb_acm_post` (이미 `amb_acm_qna_question` 와는 별도 — 게시판) |
| `tac_programs` | `amb_acm_program` |
| `tac_program_settings` | `amb_acm_program_setting` |
| `tac_classrooms` | `amb_acm_classroom` (마스터 — 교실 식별자만) |

`tac_posts` 의 `pst_category_id` 는 이미 `posts-category` 마이그레이션 (sql/100) 으로 `tac_posts_categories` 가 있음 → `amb_acm_post_category` 신규 + FK.

### 2.6 상담 보조 (3 테이블)

| MySQL | PostgreSQL |
|---|---|
| `tac_visit_records` | `amb_acm_csl_visit_record` (`amb_acm_csl_inquiry` 에 FK) |
| `tac_consultation_intake_form` | `amb_acm_csl_intake_form` (orphan 이지만 schema 보존) |
| `tac_external_test_scores` | `amb_acm_std_external_test_score` (orphan 이지만 schema 보존) |

### 2.7 AMA Subscription (`tac_subscription_events` → `amb_acm_subscription_event`) — 1 테이블

- AMA App Store webhook idempotency 보장 row.
- `sub_event_id VARCHAR(64) UNIQUE` (AMA 측 event id 보존).
- 인덱스 `(ent_id, kind, occurred_at)`.

---

## 3. 데이터 이전 변환 룰 — Phase 3 핵심

### 3.1 ID 변환 — `legacy_id` lookup
```sql
-- 예: tac_pay_orders → amb_acm_pay_order 이전 시
INSERT INTO amb_acm_pay_order (id, legacy_id, ent_id, enrollment_id, ...)
SELECT
  gen_random_uuid(),
  src.pod_id,
  tnt.id AS ent_id,
  enr.id AS enrollment_id,
  ...
FROM mysql_tac_pay_orders src
JOIN amb_acm_tenant tnt ON tnt.legacy_acd_id = src.acd_id
JOIN amb_acm_csl_enrollment enr ON enr.legacy_id = src.enr_id
ON CONFLICT (legacy_id) DO NOTHING;  -- idempotent
```

### 3.2 BYTEA 컬럼 — 재암호화 X
- `tac_pay_receipts.rct_buyer_identifier VARBINARY(128)` → `amb_acm_pay_receipt.buyer_identifier BYTEA` (동일 키로 암호화된 원본 byte 그대로).
- ⚠️ 주의: MySQL VARBINARY 이전 시 character set 손상 가능 → `mysqldump --hex-blob` 옵션 사용.

### 3.3 JSON → JSONB
- `JSON_VALID()` 검증 후 직접 cast.
- 손상된 JSON 발견 시 `body_summary = '{}'::jsonb` 로 대체 + 별도 로그.

### 3.4 타임존
- MySQL `DATETIME` 은 timezone 없음 — KST 가정 (운영자가 server timezone 확인 필요).
- PG `TIMESTAMPTZ` 로 cast 시 `AT TIME ZONE 'Asia/Seoul'` 로 명시 → UTC 저장.

### 3.5 충돌 처리 (Q-6 ACM 우선)
- `tac_users.usr_email` 이 `amb_acm_user.email` 와 충돌하면 skip.
- 충돌 발견 시 `mysql-pg-conflict-report.csv` 에 한 줄 추가 → 운영자 검토.

### 3.6 자동 reconcile (Q-5 — tac_consultations → amb_acm_csl_inquiry)
- `tac_consultations.con_status` 와 `amb_acm_csl_inquiry.inq_status` 의 enum 매핑:
  - `'PENDING' → 'OPEN'`
  - `'IN_PROGRESS' → 'IN_PROGRESS'`
  - `'CONVERTED' → 'CONVERTED'`
  - `'DROPPED' → 'CLOSED'`
- 매핑 불가 값은 `'OPEN'` 으로 + 로그.

---

## 4. 인덱스·CHECK·트리거 적용 시점

- Phase 1 (`sql/acm/950 ~ 980`) 작성 시 모든 인덱스 + CHECK + trigger 포함.
- Phase 3 데이터 이전 직전에 인덱스 DROP → 이전 후 재생성 (대량 INSERT 속도 향상). idempotent 스크립트가 처리.

---

## 5. Phase 3 dry-run 검증 항목

각 테이블별:
- ✅ row count: `mysql.tac_X count == pg.amb_acm_X count`
- ✅ legacy_id 분포: `legacy_id IS NOT NULL && UNIQUE`
- ✅ FK integrity: orphan row 0 (LEFT JOIN child IS NULL = 0)
- ✅ enum sanity: CHECK 위반 row 0
- ✅ BYTEA 무결성: 샘플 100row 복호화 성공 (결제 receipt)
- ✅ JSON 무결성: `body_summary @? '$'` 모두 valid
- ✅ 타임존 sanity: PG ↔ MySQL 동일 UTC 시각

---

## 6. Sign-off

본 spec 은 Phase 1 SQL 작성 + Phase 3 migration 스크립트의 기준 — 작성 진입 전 운영자 검토 1회 권장. 변경 발생 시 v1.1.0+ 로 bump.
