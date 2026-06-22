---
document_id: RUNBOOK-260622-cutover
version: 1.0.0
status: draft
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260622-mysql-to-postgres-full-migration.md
  - docs/plan/PLN-260622-mysql-to-postgres-full-migration.md (Phase 5 / 6 / 7)
  - docs/deployment/SPEC-260622-backup-policy.md
  - scripts/migrate-mysql-to-pg/
change_log:
  - 2026-06-22 v1.0.0 draft — operator runbook for production cutover
---

# Operator Runbook — MySQL → PostgreSQL Cutover (REQ-260622)

> Phase 5 (rehearsal) + Phase 6 (production) 의 운영자 실행 절차.
> Dual-write 0일 (Q-3) — **단일 시점 전환**. 컷오버 후 MySQL 즉시 삭제 (Q-4).

---

## 0. 결정 사항 요약 (TL;DR)

| Decision | Value |
|---|---|
| dual-write | **0일** (Q-3) — 단일 컷오버 |
| MySQL 잔존 | **즉시 삭제** (Q-4) — Phase 7 같은 날 |
| 결제 데이터 | **전체 이전** (Q-1) — `tac_pay_*` 전기간 |
| audit 보존 | **최근 90일** (Q-2) — 그 이전 cold archive |
| csl_inquiry reconcile | **자동** (Q-5) — PG 우선 |
| user reconcile | **ACM (PG) 권위** (Q-6) — MySQL은 PG에 없는 row만 inject |

**예상 MW**: KST 02:00 ~ 04:00 (2시간). Migration 자체는 15분 내 (스테이징 측정값 기반).

---

## 1. 사전 준비 (T-24h)

### 1.1 운영자 책임자 + 채널 확정

| 역할 | 담당 | 채널 |
|---|---|---|
| Cutover Lead | 운영자 (gray.kim@amoeba.group) | Slack #acm-cutover |
| Backup Operator | 운영자 (SSH 권한 보유) | (same) |
| Dev On-call | Claude Code session | 동시 active |
| Stakeholder Comm | AMA Comms | AmoebaTalk 사전 공지 |

### 1.2 사전 공지 (T-24h)

AmoebaTalk + 학원 portal 공지 게시:

> 2026-06-XX (목) 새벽 02:00 ~ 04:00 (KST) 시스템 점검 작업이 있을 예정입니다.
> 점검 시간 동안 학부모/관리자 포털 및 결제 페이지가 일시 중단됩니다.
> 결제 진행 중이신 분은 점검 시작 전에 마무리해 주세요.

### 1.3 사전 점검 항목

- [ ] cd-staging 에서 동일 cutover 시뮬레이션 1회 이상 통과 (Phase 5 T5-03).
- [ ] `scripts/migrate-mysql-to-pg/` build clean (`npm run build` in script dir).
- [ ] Staging row diff = 0 (verify-only 모드).
- [ ] S3 버킷 `amoeba-acm-backups` + IAM `acm-backup-writer` 활성 (T0-04 완료).
- [ ] `ACM_PII_KEY` env value 가 staging/production 양쪽에 설정됨 (csl_inquiry 자동 reconcile 시 필수).
- [ ] Rollback drill 1회 실행 (mysqldump restore + image revert 30분 SLA 검증).

---

## 2. T-30분 — 백업 + 점검 모드 활성화

### 2.1 Production MySQL dump (5분)

```bash
ssh appacademy@acm.amoeba.site
TS=$(date -u +%Y-%m-%dT%H%M)
docker exec tac-prod-mysql sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
    --hex-blob --routines --triggers --single-transaction \
    db_tac' | gzip > /tmp/db_tac-${TS}.sql.gz

# S3 업로드
aws s3 cp /tmp/db_tac-${TS}.sql.gz \
  s3://amoeba-acm-backups/mysql/production/2026-06-XX/db_tac.sql.gz \
  --metadata "ts=${TS}"

# Row count snapshot (롤백 시 무결성 검증용)
docker exec tac-prod-mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac \
  -e "SELECT table_name, table_rows FROM information_schema.tables \
      WHERE table_schema='db_tac' ORDER BY table_name;" \
  > /tmp/db_tac-${TS}.row-count.txt
aws s3 cp /tmp/db_tac-${TS}.row-count.txt \
  s3://amoeba-acm-backups/mysql/production/2026-06-XX/db_tac.row-count.txt
```

**Decision point**: `db_tac.sql.gz` 가 비정상적으로 작거나 (<10 MB) S3 업로드 실패 시 **즉시 중단**, 운영자 디버깅 후 다시 시작.

### 2.2 Production PG pre-cutover dump (3분)

```bash
docker exec tac-prod-pg sh -c \
  'pg_dump -U "$ACM_PG_USER" -d "$ACM_PG_DB" -F c -Z 9' \
  > /tmp/db_acm-pre-${TS}.dump

aws s3 cp /tmp/db_acm-pre-${TS}.dump \
  s3://amoeba-acm-backups/pg/production/2026-06-XX/db_acm-pre-migration.dump
```

### 2.3 Maintenance page 활성화 (1분)

```bash
# nginx config swap — 모든 사용자 경로에서 503 maintenance.html 반환
ssh appacademy@acm.amoeba.site
sudo ln -sf /etc/nginx/sites-available/acm-maintenance.conf \
            /etc/nginx/sites-enabled/acm.conf
sudo nginx -t && sudo systemctl reload nginx

# 검증
curl -s -o /dev/null -w "%{http_code}\n" https://acm.amoeba.site/
# expected: 503
```

**T-0 시점**: 사용자 트래픽 차단됨. 이제 backend 가 idle.

---

## 3. T-15분 ~ T-0 — Migration Runner 실행

> 모든 명령은 **migration host** (별도 EC2 또는 `acm.amoeba.site` 자체)에서 실행.
> `scripts/migrate-mysql-to-pg/.env` 에 `MYSQL_*` + `ACM_PG_*` + `ACM_PII_KEY` 가 적재되어 있어야 함.

### 3.1 도메인 순서 (필수 — FK 의존성)

| # | Domain | 의존 | 비고 |
|---|---|---|---|
| 1 | `tenant-bootstrap` | (없음) | acd_id ↔ ent_id UUID 매핑 적재 |
| 2 | `backfill-legacy-id` | 1 | 9개 dual-write 테이블의 legacy_id 채움 (T0-05 prereq) |
| 3 | `cls-enrollment` | 2 | tac_enrollments → amb_acm_cls_enrollment (모델 X) |
| 4 | `pay` | 3 | pay_order.enrollment_id FK 가 cls-enrollment legacy_id 에 의존 |
| 5 | `map` | 2 | MAP item self-FK two-pass |
| 6 | `notification` | 2 | recipient FK |
| 7 | `audit` | 2 | actor FK |
| 8 | `posts` | 2 | author FK |
| 9 | `csl-aux` | 2 | visit_record.inquiry_id FK |
| 10 | `subscription` | (없음) | ent_id 미존재 row 도 NULL 보존 |

### 3.2 실행 (verify-only → real run)

```bash
cd /opt/migrate-mysql-to-pg
export $(cat .env.production | xargs)

ORDER="tenant-bootstrap backfill-legacy-id cls-enrollment pay map \
       notification audit posts csl-aux subscription"

# Step 1: verify-only — pre-migration row count baseline
for d in $ORDER; do
  echo "=== verify $d ==="
  node dist/index.js --domain $d --verify-only
done

# Step 2: real migration
for d in $ORDER; do
  echo "=== migrating $d ==="
  START=$(date -u +%s)
  node dist/index.js --domain $d 2>&1 | tee /var/log/acm-cutover/${d}.log
  RC=$?
  if [ $RC -ne 0 ]; then
    echo "FAIL $d exit=$RC — STOP and execute rollback"
    exit 1
  fi
  echo "$d done in $(( $(date -u +%s) - START ))s"
done

# Step 3: verify-only — post-migration row diff
for d in $ORDER; do
  node dist/index.js --domain $d --verify-only
done
```

**Decision point — `diff != 0`**:
1. PG 가 더 많으면 → 이전 partial run의 잔존 (ON CONFLICT DO NOTHING 으로 silent 처리됨). 안전.
2. MySQL 이 더 많으면 → **migration 실패**. 해당 테이블 log 확인 + 운영자 판단:
   - row 수 차이 < 5 + audit / log 류 → 허용 (race condition).
   - 그 외 → **rollback 트리거** (§5).

### 3.3 PG post-migration dump (롤백 baseline)

```bash
docker exec tac-prod-pg pg_dump -U "$ACM_PG_USER" -d "$ACM_PG_DB" -F c -Z 9 \
  > /tmp/db_acm-post-${TS}.dump
aws s3 cp /tmp/db_acm-post-${TS}.dump \
  s3://amoeba-acm-backups/pg/production/2026-06-XX/db_acm-post-migration.dump
```

---

## 4. T-0 ~ T+30분 — Backend Image Swap + Smoke

### 4.1 Image swap (3분)

```bash
# 새 backend image (Phase 4 까지 반영 — PG-only) 배포
gh workflow run cd-production.yml -f sha=<short-sha-of-phase4>
# 별도 reviewer 승인 후 진행 (production gate)
```

배포 완료 후 `docker ps` 로 컨테이너 `tac-prod-backend` 가 새 image 로 떠 있는지 확인.

### 4.2 Smoke 시나리오 (15분)

운영자 + dev on-call 이 각각 절반씩 분담:

| # | Flow | Expected |
|---|---|---|
| S-1 | `GET /api/healthz` | 200 + db: ok |
| S-2 | Login (admin) | JWT 발급 |
| S-3 | Dashboard KPI | 결제·재원·문의 수 모두 PG 기반 응답 |
| S-4 | `/api/portal/inquiry` (학부모 문의) | INSERT → amb_acm_csl_inquiry |
| S-5 | Pay — 결제 신청 → Toss widget redirect | pg_payment_key 발급 |
| S-6 | Pay — 결제 webhook → ledger | amb_acm_pay_ledger INSERT |
| S-7 | MAP — 학생 응답 제출 | amb_acm_map_response UPSERT |
| S-8 | Notification — template 발송 | amb_acm_notification_log status=SENT |
| S-9 | Audit — admin action | amb_acm_audit_log INSERT (BRIN 인덱스 사용 확인) |
| S-10 | `grep "tac_"` access logs | 0 hit (legacy MySQL 호출 없음) |

**Decision point — S-1 ~ S-10 중 1개라도 fail**:
- 가벼운 경우 (UI 표시 버그): 운영자가 30분 SLA 내 hotfix 또는 rollback 결정.
- 결제 / login / audit fail → **즉시 rollback** (§5).

### 4.3 Maintenance page 비활성화 (1분)

```bash
ssh appacademy@acm.amoeba.site
sudo ln -sf /etc/nginx/sites-available/acm.conf \
            /etc/nginx/sites-enabled/acm.conf
sudo nginx -t && sudo systemctl reload nginx

curl -s -o /dev/null -w "%{http_code}\n" https://acm.amoeba.site/
# expected: 200
```

### 4.4 T+30분 활성 감시

운영자 + dev 가 30분간 channel #acm-cutover 에서 monitor. Grafana / Sentry 알람 확인:
- API 5xx rate < 0.5% 유지.
- DB connection pool 안정 (PG `max_connections` 의 70% 이하).
- AmoebaTalk webhook outbound 정상.

---

## 5. Rollback (60분 SLA)

> 트리거 조건: §3.2 diff != 0 (허용 외) **OR** §4.2 S-1~S-10 critical fail.

### 5.1 Backend image revert (3분)

```bash
# 직전 production tag 로 revert
gh workflow run cd-production.yml -f sha=<previous-production-short-sha>
# reviewer 승인 후 즉시 배포
```

### 5.2 PG state revert (10분)

cutover 직전 dump 으로 복원:

```bash
ssh appacademy@acm.amoeba.site
docker exec tac-prod-pg pg_restore -U "$ACM_PG_USER" -d "$ACM_PG_DB" \
  --clean --if-exists --no-owner \
  /var/backup/db_acm-pre-${TS}.dump  # S3 에서 미리 다운로드
```

### 5.3 MySQL container 재가동 확인 (2분)

```bash
docker ps | grep tac-prod-mysql
# Phase 6 시점에는 아직 살아있음 — Phase 7 (당일 +N시간 후) 에서 삭제.
# Rollback 시 MySQL container는 아무것도 변경되지 않음 (read-only로만 사용됨).
```

### 5.4 Maintenance page off + 사후 점검

운영자가 사용자 안내 (AmoebaTalk):

> 시스템 점검 작업 중 일시적 이슈가 발견되어 작업을 보류했습니다.
> 모든 서비스는 정상 작동 중이며, 추후 재공지하겠습니다. 감사합니다.

이후 Phase 5 rehearsal 부터 다시 (디버깅 후).

---

## 6. T+2h ~ T+24h — Phase 7 정리 (Q-4 즉시 삭제)

> 운영자 승인 후 진행. 보통 같은 maintenance window 내 (T+2h 부터).

### 6.1 MySQL container 삭제

```bash
ssh appacademy@acm.amoeba.site
docker rm -f tac-prod-mysql
docker volume rm production_mysql
# Staging도 동일하게:
ssh appacademy@acm-stg
docker rm -f tac-mysql
docker volume rm staging_mysql
```

### 6.2 Docker compose + env 정리

운영자 또는 dev 가 PR 생성 (`feat/acm-mysql-removal`):
- `docker/production/docker-compose.production.yml` — mysql service block 삭제.
- `docker/staging/docker-compose.staging.yml` — 동일.
- `.env.production.example` / `.env.staging.example` — `MYSQL_*` 라인 삭제.
- `scripts/deploy-{production,staging}.sh` §4 (MySQL migration) 블록 삭제.

### 6.3 Backend code cleanup

별도 PR (`feat/acm-tac-entity-removal`):
- `backend/src/**/*.typeorm-entity.ts` 의 `tac_*` 엔티티 40개 삭제.
- TypeORM default datasource (MySQL) 제거 — PG 가 default.
- `grep -rn "tac_" backend/src --include='*.ts'` → 0 hit 검증.

---

## 7. 사후 산출물 (T+24h)

운영자가 작성:

| 파일 | 내용 |
|---|---|
| `docs/implementation/RPT-260622-cutover-execution.md` | 실측 소요 시간 / row diff 결과 / smoke 결과 / 미해결 이슈 |
| Slack #acm-cutover archive | 의사결정 timeline (T-30, T-0, T+30, T+2h) |
| S3 lifecycle 확인 | `mysql/*` prefix가 90일 후 deep-archive 전환되도록 lifecycle rule 활성 검증 |

---

## 8. Appendix — Quick Reference

### 8.1 Migration runner 도메인 호출 한 줄

```bash
# Verify only
node dist/index.js --domain <name> --verify-only

# Dry run (PG 에 쓰지 않음)
node dist/index.js --domain <name> --dry-run

# Spike (소량만 — 50 row)
node dist/index.js --domain <name> --limit 50

# Real run
node dist/index.js --domain <name>
```

### 8.2 PG 상태 빠른 점검 SQL

```sql
-- 도메인별 row 수
SELECT
  (SELECT count(*) FROM amb_acm_pay_order)         AS pay_order,
  (SELECT count(*) FROM amb_acm_map_response)      AS map_response,
  (SELECT count(*) FROM amb_acm_notification_log)  AS notification_log,
  (SELECT count(*) FROM amb_acm_audit_log)         AS audit_log,
  (SELECT count(*) FROM amb_acm_post)              AS post;

-- legacy_id 채워진 비율 (backfill 검증)
SELECT
  count(*) FILTER (WHERE legacy_id IS NOT NULL) AS with_legacy,
  count(*) AS total
FROM amb_acm_user;
```

### 8.3 비상 연락

- Slack: #acm-cutover (cutover 전용)
- 운영자: gray.kim@amoeba.group
- AMA on-call: (운영자 별도 공지)

---

**작성**: 2026-06-22 (Claude Code session)
**검토 필요**: Phase 5 rehearsal 1회 통과 후 운영자 sign-off.
