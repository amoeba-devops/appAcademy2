/**
 * MySQL → PostgreSQL migration runner — CLI entry (REQ-260622 Phase 3).
 *
 * Usage:
 *   npx ts-node src/index.ts --domain <name> [options]
 *
 * Options:
 *   --domain <name>     One of: tenant-bootstrap, pay, map, notification,
 *                       audit, posts, csl-aux, subscription
 *   --dry-run           Don't write to PG; print transform sample
 *   --verify-only       Skip migration; only report row diffs
 *   --limit <N>         Cap source rows per table (spike testing)
 *   --help              Show this message
 *
 * Exit codes:
 *   0 = success
 *   1 = bad arguments
 *   2 = connection failure
 *   3 = migration / verify error (look at logged diffs)
 */
/* eslint-disable no-console */
import { loadConfig } from './config';
import { Logger } from './lib/logger';
import { MysqlClient } from './lib/mysql-client';
import { PgClient } from './lib/pg-client';
import { TenantMap } from './lib/tenant-map';
import { TenantBootstrapMigrator } from './migrators/tenant-bootstrap.migrator';
import { PayMigrator } from './migrators/pay.migrator';
import {
  AuditMigrator,
  CslAuxMigrator,
  MapMigrator,
  NotificationMigrator,
  PostsMigrator,
  SubscriptionMigrator,
} from './migrators/stubs';
import type { BaseMigrator } from './lib/migrator';

interface CliArgs {
  domain: string | null;
  dryRun: boolean;
  verifyOnly: boolean;
  limit: number | null;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    domain: null,
    dryRun: false,
    verifyOnly: false,
    limit: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--domain':       args.domain = argv[++i] ?? null; break;
      case '--dry-run':      args.dryRun = true; break;
      case '--verify-only':  args.verifyOnly = true; break;
      case '--limit':        args.limit = Number(argv[++i] ?? '0') || null; break;
      case '--help':
      case '-h':             args.help = true; break;
      default:
        if (a.startsWith('--')) console.warn(`unknown flag: ${a}`);
    }
  }
  return args;
}

function printHelp(): void {
  console.log(`
MySQL → PostgreSQL migration runner (REQ-260622 Phase 3)

Usage:
  npx ts-node src/index.ts --domain <name> [options]

Domains (run in this order for full migration):
  tenant-bootstrap   MUST be first — populates amb_acm_tenant.legacy_acd_id
  pay                6 결제 테이블
  map                8 MAP 평가 테이블
  notification       2 알림 테이블
  audit              1 PII 감사 로그 (Q-2 N-day cutoff)
  posts              4 카탈로그 테이블 (posts/program/program_setting/classroom)
  csl-aux            3 상담 보조 + 학생 외부점수
  subscription       1 AMA 구독 이벤트

Options:
  --dry-run          Don't write to PG; print transform sample
  --verify-only      Skip migration; only report row diffs (PG count vs MySQL)
  --limit <N>        Cap source rows per table (spike testing)
  --help             Show this message

Examples:
  # Bootstrap tenant mapping first
  npx ts-node src/index.ts --domain tenant-bootstrap

  # Dry-run payment domain
  npx ts-node src/index.ts --domain pay --dry-run

  # Real run
  npx ts-node src/index.ts --domain pay

  # Verify only (no writes)
  npx ts-node src/index.ts --domain pay --verify-only
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const log = new Logger('cli');

  if (args.help || !args.domain) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const cfg = loadConfig();
  if (args.dryRun) cfg.dryRun = true;

  const mysql = new MysqlClient(cfg.mysql);
  const pg = new PgClient(cfg.pg);
  try {
    await mysql.connect();
    await pg.connect();
  } catch (e) {
    log.error(`connection failure: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const tenants = new TenantMap(pg);
  await tenants.load();
  log.info(`tenants loaded: ${tenants.size()}`);

  const factory: Record<string, () => BaseMigrator> = {
    'tenant-bootstrap': () => new TenantBootstrapMigrator(mysql, pg, tenants, cfg),
    pay:                 () => new PayMigrator(mysql, pg, tenants, cfg),
    map:                 () => new MapMigrator('map', mysql, pg, tenants, cfg),
    notification:        () => new NotificationMigrator('notification', mysql, pg, tenants, cfg),
    audit:               () => new AuditMigrator('audit', mysql, pg, tenants, cfg),
    posts:               () => new PostsMigrator('posts', mysql, pg, tenants, cfg),
    'csl-aux':           () => new CslAuxMigrator('csl-aux', mysql, pg, tenants, cfg),
    subscription:        () => new SubscriptionMigrator('subscription', mysql, pg, tenants, cfg),
  };

  const make = factory[args.domain];
  if (!make) {
    log.error(`unknown domain: ${args.domain}`);
    printHelp();
    process.exit(1);
  }

  const migrator = make();
  let exitCode = 0;

  try {
    if (args.verifyOnly) {
      const verify = await migrator.verify();
      console.log('\n=== Verify Report ===');
      console.log(`Domain: ${verify.domain}`);
      console.log('table_pair                                      | mysql | pg    | diff | ok');
      console.log('------------------------------------------------|-------|-------|------|---');
      for (const r of verify.rows) {
        const pair = `${r.mysqlTable} → ${r.pgTable}`.padEnd(48);
        console.log(
          `${pair}| ${String(r.mysqlCount).padStart(5)} | ${String(r.pgCount).padStart(5)} | ${String(r.diff).padStart(4)} | ${r.ok ? '✅' : '❌'}`,
        );
      }
      if (verify.rows.some((r) => !r.ok)) exitCode = 3;
    } else {
      const result = await migrator.migrate({
        dryRun: cfg.dryRun,
        limit: args.limit ?? undefined,
      });
      console.log('\n=== Migrate Report ===');
      console.log(`Domain: ${result.domain}`);
      console.log('table_pair                                      | mysql | inserted | skipped | ms');
      console.log('------------------------------------------------|-------|----------|---------|------');
      for (const t of result.tables) {
        const pair = `${t.mysqlTable} → ${t.pgTable}`.padEnd(48);
        console.log(
          `${pair}| ${String(t.mysqlCount).padStart(5)} | ${String(t.pgInserted).padStart(8)} | ${String(t.pgSkipped).padStart(7)} | ${t.durationMs}`,
        );
      }
    }
  } catch (e) {
    log.error(`migration error: ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) console.error(e.stack);
    exitCode = 3;
  } finally {
    await mysql.close();
    await pg.close();
  }

  process.exit(exitCode);
}

void main();
