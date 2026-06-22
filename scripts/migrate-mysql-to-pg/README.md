# MySQL → PostgreSQL Migration Runner (REQ-260622 Phase 3)

> **Scope**: One-shot data migration tool. MySQL `db_tac` → PostgreSQL `db_acm`.
> Idempotent. Re-runnable. Read-only against MySQL.

---

## 1. Architecture

```
scripts/migrate-mysql-to-pg/
├── README.md                       # this file
├── src/
│   ├── index.ts                    # CLI dispatcher
│   ├── config.ts                   # env loader + DSN validation
│   ├── lib/
│   │   ├── mysql-client.ts         # mysql2/promise wrapper
│   │   ├── pg-client.ts            # pg (node-postgres) wrapper
│   │   ├── migrator.ts             # base class (count/migrate/verify)
│   │   ├── tenant-map.ts           # acd_id (BIGINT) → ent_id (UUID) resolver
│   │   ├── logger.ts               # progress + batch metrics
│   │   └── id-map.ts               # legacy_id → new UUID lookup cache
│   └── migrators/                  # one per domain
│       ├── tenant-bootstrap.migrator.ts   # MUST run first (populates amb_acm_tenant.legacy_acd_id)
│       ├── pay.migrator.ts                # 6 tables: refund_policy, refund_policy_tier, order, ledger, receipt, tax_invoice
│       ├── map.migrator.ts                # 8 tables: passage_asset, item, item_tag, test_set, test_set_item, assignment, response, score
│       ├── notification.migrator.ts       # 2 tables: template, log
│       ├── audit.migrator.ts              # 1 table: log (Q-2 N-day cutoff)
│       ├── posts.migrator.ts              # 4 tables: post, program, program_setting, classroom
│       ├── csl-aux.migrator.ts            # 3 tables: visit_record, intake_form, external_test_score
│       └── subscription.migrator.ts       # 1 table: subscription_event
```

---

## 2. Usage

### 2.1 Setup

Driver deps already installed in `backend/`:
- `mysql2` ^3.22.3 — MySQL source
- `pg` ^8.20.0 — PG destination
- `ts-node` ^10.9.2 — TypeScript execution

Environment variables (in `.env.staging` / `.env.production` on the server):

```bash
# MySQL source (legacy db_tac)
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_ROOT_PASSWORD=...           # already in .env.staging / .env.production
MYSQL_DATABASE=db_tac

# PostgreSQL destination (current ACM_*)
ACM_PG_HOST=127.0.0.1
ACM_PG_PORT=5434
ACM_PG_USER=acm
ACM_PG_PASSWORD=...               # already in env
ACM_PG_DATABASE=db_acm

# Migration knobs
MIGRATION_BATCH_SIZE=500           # per-INSERT batch
MIGRATION_AUDIT_CUTOFF_DAYS=90     # Q-2 N value (default 90, override per env)
MIGRATION_DRY_RUN=false            # 'true' = count + diff only, no writes
```

### 2.2 Run a single domain (staging dry-run first)

```bash
cd ~/app-academy/backend
npx ts-node ../scripts/migrate-mysql-to-pg/src/index.ts \
    --domain tenant-bootstrap

npx ts-node ../scripts/migrate-mysql-to-pg/src/index.ts \
    --domain pay \
    --dry-run

npx ts-node ../scripts/migrate-mysql-to-pg/src/index.ts \
    --domain pay
```

### 2.3 Run all domains in order (production cutover)

```bash
# Order matters — tenant-bootstrap MUST run first, then domains with FKs to others.
for domain in tenant-bootstrap pay map notification audit posts csl-aux subscription; do
    npx ts-node ../scripts/migrate-mysql-to-pg/src/index.ts --domain $domain || exit 1
done
```

### 2.4 Verify (row diff)

```bash
npx ts-node ../scripts/migrate-mysql-to-pg/src/index.ts \
    --domain pay \
    --verify-only
```

Outputs:
```
tac_pay_orders                | mysql=1234 | pg=1234 | diff=0  ✅
tac_pay_ledger                | mysql=5678 | pg=5678 | diff=0  ✅
...
```

---

## 3. Idempotency contract

Every INSERT uses `ON CONFLICT (legacy_id) DO NOTHING` — re-runs are safe.
The migrator tracks progress in `amb_acm_migration_state` (created on first run).

```sql
-- created on demand
CREATE TABLE IF NOT EXISTS amb_acm_migration_state (
  mst_domain      VARCHAR(50)   PRIMARY KEY,
  mst_table       VARCHAR(60)   NOT NULL,
  mst_started_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  mst_completed_at TIMESTAMPTZ,
  mst_mysql_count BIGINT,
  mst_pg_count    BIGINT,
  mst_error       TEXT
);
```

---

## 4. Conflict resolution (Q-5 / Q-6)

- **Q-5 — `tac_consultations` → `amb_acm_csl_inquiry`**: automatic reconcile.
  status enum map: `PENDING → OPEN`, `IN_PROGRESS → IN_PROGRESS`,
  `CONVERTED → CONVERTED`, `DROPPED → CLOSED`.

- **Q-6 — `tac_users` ↔ `amb_acm_user`**: PG is authoritative.
  MySQL row inserted only when no `amb_acm_user.email` collision.
  Conflicts written to `/tmp/mysql-pg-conflict-report.csv` for operator review.

---

## 5. Safety rails

- **Read-only against MySQL** — no UPDATE/DELETE issued.
- **Per-batch transactions** — failure rolls back the current batch only.
- **Dry-run mode** — `--dry-run` prints transform output without committing PG rows.
- **Verify mode** — `--verify-only` runs COUNT + sample row diff, no writes.
- **Re-run safety** — `ON CONFLICT (legacy_id) DO NOTHING` makes every domain
  re-runnable. State table tracks completion.
- **`--limit N`** — for spike testing on tiny subsets (e.g., `--limit 10`).

---

## 6. Phase 3 execution checklist

1. [ ] Phase 0 gate passed (operator inventory + S3 backup buckets + N value).
2. [ ] Phase 1 SQL files applied to staging (cd-staging picks up `sql/acm/950-980`).
3. [ ] `scripts/backup-pre-cutover.sh staging` — pre-migration backup to S3.
4. [ ] `npx ts-node .../index.ts --domain tenant-bootstrap` — must succeed.
5. [ ] For each domain: dry-run → real run → verify (row diff = 0).
6. [ ] Investigate `/tmp/mysql-pg-conflict-report.csv` — operator sign-off on Q-6 conflicts.
7. [ ] `npm test --testPathPattern=acm-pay` etc. — backend test suite still green.
8. [ ] Operator signs off → repeat steps 3-7 on production during maintenance window (PLN-260622 Phase 6).

---

## 7. Authoring more migrators

Each migrator extends `BaseMigrator`:

```ts
export class PayMigrator extends BaseMigrator {
  readonly domain = 'pay';

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    // 1. Run each table in order (parents first)
    await this.migrateRefundPolicies(opts);
    await this.migrateRefundPolicyTiers(opts);
    await this.migrateOrders(opts);
    ...
  }

  async verify(): Promise<VerifyResult> {
    return this.compareCounts([
      ['tac_pay_refund_policies', 'amb_acm_pay_refund_policy'],
      ['tac_pay_orders',          'amb_acm_pay_order'],
      ...
    ]);
  }
}
```

The `BaseMigrator` provides:
- `selectBatched(mysqlTable, batchSize, callback)` — paged SELECT
- `insertBatched(pgTable, columns, rows, onConflict)` — paged INSERT
- `tenantMap.resolve(acdId)` — `acd_id → ent_id UUID` lookup
- `idMap.resolve(table, legacyId)` — `legacy_id → new UUID` lookup
- `compareCounts(pairs)` — row diff report

---

## 8. Phase 7 cleanup

After successful production cutover (Phase 6), this entire directory becomes
obsolete. Phase 7 T7-04 deletes it along with `backend/src/**/tac_*` entities
and the MySQL docker service. Backup remains in S3 for 90 days.
