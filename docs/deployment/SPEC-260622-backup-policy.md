---
document_id: SPEC-260622-backup-policy
version: 1.0.1
status: Archived Reference
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/plan/PLN-260622-mysql-to-postgres-full-migration.md (Phase 0 T0-04, Phase 6 T6-01)
---

# 백업 정책 — MySQL → PostgreSQL 마이그레이션 (REQ-260622)

> Phase 6 (production cutover) 직전 백업 + Phase 7 직후 MySQL 제거 사이의 안전 그물.
>
> **2026-07-04 아카이브 안내**: 이 문서는 MySQL → PostgreSQL cutover 당시의 백업 계획을 보존한다. 현재 운영 백업 정책은 PostgreSQL-only 구조를 기준으로 별도 갱신되어야 한다.

---

## 1. S3 버킷 + prefix 구조

**버킷**: `s3://amoeba-acm-backups/` (운영자가 생성 — Phase 0 T0-04 필요).
**리전**: `ap-northeast-2` (서울).
**암호화**: SSE-S3 (server-side AES-256). 별도 KMS 키 불필요.

```
amoeba-acm-backups/
├── mysql/
│   ├── staging/
│   │   └── 2026-06-XX/             # cutover 일자
│   │       ├── db_tac.sql.gz       # 전체 dump (--hex-blob 포함)
│   │       └── db_tac.row-count.txt
│   └── production/
│       └── 2026-06-XX/
│           ├── db_tac.sql.gz
│           └── db_tac.row-count.txt
├── pg/
│   ├── staging/
│   │   └── 2026-06-XX/
│   │       ├── db_acm-pre-migration.sql.gz   # cutover 직전
│   │       └── db_acm-post-migration.sql.gz  # 데이터 이전 직후 (롤백 대비)
│   └── production/
│       └── 2026-06-XX/
│           ├── db_acm-pre-migration.sql.gz
│           └── db_acm-post-migration.sql.gz
└── audit-archive/                  # Q-2 N일치 초과 데이터 (audit_log 만)
    └── 2026-06-22-cutoff/
        └── tac_audit_logs.before-2026-03-24.sql.gz
```

---

## 2. 보존 기간 (S3 lifecycle rule)

| Prefix | 보존 | 이유 |
|---|---|---|
| `mysql/*/2026-06-*/` | **90일** | Phase 7 (MySQL 즉시 삭제) 후 안전 buffer. 롤백 자산. |
| `pg/*/2026-06-*/pre-migration` | **90일** | 데이터 이전 직전 PG 상태 (Phase 5 dual-write 결정 X 이므로 단일 기준점) |
| `pg/*/2026-06-*/post-migration` | **365일** | Phase 7 +N 일 후 검증용 baseline |
| `audit-archive/2026-06-22-cutoff/` | **2555일** (7년) | 감사 로그 보존 의무 (학원 운영) |

90일 후 자동 deep-archive (Glacier Deep Archive) 로 cold storage 전환 (`STANDARD → GLACIER_IR → DEEP_ARCHIVE` 단계).

---

## 3. 백업 실행 명령 — `scripts/backup-pre-cutover.sh`

Phase 6 T6-01 (cutover 직전 ~T-30분) 실행. 새 파일로 작성 예정 (Phase 5).

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
ENV=${1:?staging|production}
TS=$(date -u +%Y-%m-%dT%H-%M-%SZ)

# --- MySQL ---
docker exec tac-${ENV/production/prod-}mysql mysqldump \
  --hex-blob \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac \
| gzip -9 > /tmp/db_tac-$TS.sql.gz

aws s3 cp /tmp/db_tac-$TS.sql.gz \
  s3://amoeba-acm-backups/mysql/$ENV/$(date -u +%Y-%m-%d)/db_tac.sql.gz \
  --storage-class STANDARD_IA

# Row count snapshot (verification)
docker exec tac-${ENV/production/prod-}mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac \
  -e "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA='db_tac' ORDER BY TABLE_NAME" \
| aws s3 cp - s3://amoeba-acm-backups/mysql/$ENV/$(date -u +%Y-%m-%d)/db_tac.row-count.txt

# --- PostgreSQL (pre-migration baseline) ---
docker exec tac-${ENV/production/prod-}postgres-acm pg_dump \
  -U acm -d db_acm --no-owner --no-privileges --clean --if-exists \
| gzip -9 > /tmp/db_acm-pre-$TS.sql.gz

aws s3 cp /tmp/db_acm-pre-$TS.sql.gz \
  s3://amoeba-acm-backups/pg/$ENV/$(date -u +%Y-%m-%d)/db_acm-pre-migration.sql.gz \
  --storage-class STANDARD_IA

rm -f /tmp/db_tac-$TS.sql.gz /tmp/db_acm-pre-$TS.sql.gz
echo "Backup complete → s3://amoeba-acm-backups/{mysql,pg}/$ENV/$(date -u +%Y-%m-%d)/"
```

---

## 4. 검증 — `scripts/verify-backup.sh`

백업 직후 S3 객체 무결성 확인:
```bash
aws s3 ls --recursive --human-readable s3://amoeba-acm-backups/mysql/production/$(date -u +%Y-%m-%d)/
aws s3api head-object --bucket amoeba-acm-backups \
  --key mysql/production/$(date -u +%Y-%m-%d)/db_tac.sql.gz \
  --query 'ContentLength' --output text
```

다운로드 + 검증:
```bash
aws s3 cp s3://amoeba-acm-backups/mysql/production/$(date -u +%Y-%m-%d)/db_tac.sql.gz - \
  | zcat | head -50  # 헤더 + CREATE TABLE 시작 확인
```

---

## 5. 롤백 시나리오 (RUNBOOK 발췌 — Phase 5 T5-04)

### 5.1 Phase 6 cutover 실패 → 60분 SLA
1. nginx maintenance page 유지 (사용자 노출 X).
2. `docker compose stop backend frontend-acm` (write 정지).
3. PG 복원:
```bash
aws s3 cp s3://amoeba-acm-backups/pg/production/{date}/db_acm-pre-migration.sql.gz - \
  | zcat | docker exec -i tac-prod-postgres-acm psql -U acm -d db_acm
```
4. MySQL container 재기동 (Phase 7 미진입 상태이므로 컨테이너 존재):
```bash
docker compose up -d mysql
```
5. backend image 이전 SHA 로 rollback:
```bash
DEPLOY_SHA={이전 SHA} docker compose up -d backend frontend-acm
```
6. smoke OK → maintenance page off.

### 5.2 Phase 7 진입 후 데이터 회복 (MySQL 컨테이너 삭제됨)
- MySQL 백업에서 ad-hoc 복원 (별도 MySQL 인스턴스 + sql.gz 적재).
- PG 측은 `db_acm-pre-migration.sql.gz` 로 복원 가능.

---

## 6. 사전 운영자 작업 (Phase 0 T0-04)

- [ ] S3 버킷 `amoeba-acm-backups` 생성 (Seoul 리전, 버전 관리 활성, 암호화 SSE-S3).
- [ ] Lifecycle rule:
  - `mysql/*` & `pg/*/pre-migration` & `pg/*/post-migration` — 90일 후 GLACIER_IR, 365일 후 DEEP_ARCHIVE.
  - `audit-archive/*` — 2555일 후 GLACIER_DEEP_ARCHIVE 직행.
- [ ] IAM role `acm-backup-writer` — staging / production 서버에 attach. 권한 `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` (prefix 한정).
- [ ] AWS CLI credentials 또는 IAM instance profile 을 staging / production 서버에 배치.
- [ ] `scripts/backup-pre-cutover.sh` + `scripts/verify-backup.sh` 작성 (Phase 5 T5-04).

---

## 7. Sign-off

운영자가 §6 작업 완료 후 Phase 6 진입 가능. 본 spec 은 cutover 전 단단한 안전망 — 위반 시 운영자 + dev 양자 사전 합의 필요.
