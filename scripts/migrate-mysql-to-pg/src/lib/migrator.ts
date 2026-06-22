import type { MysqlClient } from './mysql-client';
import type { PgClient } from './pg-client';
import type { TenantMap } from './tenant-map';
import type { MigrationConfig } from '../config';
import { Logger } from './logger';

export interface MigrateOptions {
  /** Limit rows per source table — useful for spike testing. */
  limit?: number;
  /** Dry-run: count + transform sample only, no writes. */
  dryRun?: boolean;
}

export interface MigrateResult {
  domain: string;
  tables: Array<{
    mysqlTable: string;
    pgTable: string;
    mysqlCount: number;
    pgInserted: number;
    pgSkipped: number;
    durationMs: number;
  }>;
}

export interface VerifyResult {
  domain: string;
  rows: Array<{
    mysqlTable: string;
    pgTable: string;
    mysqlCount: number;
    pgCount: number;
    diff: number;
    ok: boolean;
  }>;
}

/**
 * Abstract base for per-domain migrators. Concrete subclasses implement
 * `migrate(opts)` and `verify()` only.
 *
 * Shared utilities: `selectBatched()`, `insertBatched()`, tenant + legacy_id
 * resolvers, plus a `compareCounts()` helper for verify mode.
 */
export abstract class BaseMigrator {
  protected readonly log: Logger;

  constructor(
    public readonly domain: string,
    protected readonly mysql: MysqlClient,
    protected readonly pg: PgClient,
    protected readonly tenants: TenantMap,
    protected readonly cfg: MigrationConfig,
  ) {
    this.log = new Logger(`migrator:${domain}`);
  }

  abstract migrate(opts: MigrateOptions): Promise<MigrateResult>;
  abstract verify(): Promise<VerifyResult>;

  // --------------------------------------------------------------------
  // Shared helpers
  // --------------------------------------------------------------------

  /**
   * Stream MySQL rows in batches, transform each via `mapRow`, and
   * insert into PG. Returns the run summary for one table.
   *
   * Failure of any single batch rolls back that batch only; previous
   * batches stay committed. Caller decides whether to retry.
   */
  protected async migrateTable<TMysqlRow extends Record<string, unknown>>(input: {
    mysqlTable: string;
    pgTable: string;
    orderBy: string;
    columns: string[];
    where?: string;
    mapRow: (row: TMysqlRow) => Record<string, unknown> | null;
    onConflict: string; // typically 'legacy_id'
    opts: MigrateOptions;
  }): Promise<MigrateResult['tables'][number]> {
    const start = Date.now();
    let pgInserted = 0;
    let pgSkipped = 0;
    let processed = 0;

    const totalMysql = await this.mysql.count(input.mysqlTable, input.where);
    this.log.info(`begin ${input.mysqlTable} → ${input.pgTable}`, {
      mysqlCount: totalMysql,
      limit: input.opts.limit,
      dryRun: input.opts.dryRun,
    });

    for await (const batch of this.mysql.iterate<TMysqlRow>(input.mysqlTable, {
      orderBy: input.orderBy,
      batchSize: this.cfg.batchSize,
      where: input.where,
      limit: input.opts.limit,
    })) {
      const mapped = batch
        .map((r) => input.mapRow(r))
        .filter((r): r is Record<string, unknown> => r !== null);
      const skippedInThisBatch = batch.length - mapped.length;
      pgSkipped += skippedInThisBatch;

      if (mapped.length === 0) {
        processed += batch.length;
        continue;
      }

      const inserted = await this.pg.transaction(async (client) =>
        this.pg.batchInsert(
          client,
          input.pgTable,
          input.columns,
          mapped,
          input.onConflict,
          { dryRun: input.opts.dryRun ?? this.cfg.dryRun },
        ),
      );

      pgInserted += inserted;
      processed += batch.length;
      this.log.progress(input.mysqlTable, processed, totalMysql);
    }

    const durationMs = Date.now() - start;
    this.log.info(`done ${input.mysqlTable}`, { pgInserted, pgSkipped, durationMs });

    return {
      mysqlTable: input.mysqlTable,
      pgTable: input.pgTable,
      mysqlCount: totalMysql,
      pgInserted,
      pgSkipped,
      durationMs,
    };
  }

  /**
   * Row-count diff for verify mode. Returns one row per (mysql, pg) pair.
   * Caller logs/asserts whether all `diff === 0`.
   */
  protected async compareCounts(
    pairs: Array<[string, string, string?]>, // [mysqlTable, pgTable, optionalWhere]
  ): Promise<VerifyResult> {
    const rows: VerifyResult['rows'] = [];
    for (const [mysqlTable, pgTable, where] of pairs) {
      const [mysqlCount, pgCount] = await Promise.all([
        this.mysql.count(mysqlTable, where),
        // For PG we just count the whole table (legacy_id NOT NULL implies
        // post-migration row count, which is what we want — orphaned PG rows
        // would inflate count and signal a real diff).
        this.pg.count(pgTable),
      ]);
      const diff = pgCount - mysqlCount;
      rows.push({ mysqlTable, pgTable, mysqlCount, pgCount, diff, ok: diff === 0 });
    }
    return { domain: this.domain, rows };
  }

  /**
   * Convert MySQL DATETIME (server-local timezone — KST per @see
   * docs/design/SPEC-260622-tac-to-pg-schema-map.md §3.4) to a JS Date,
   * which `pg` then serializes as TIMESTAMPTZ in UTC.
   *
   * mysql2 already returns DATETIME as a Date object in the local TZ when
   * `timezone: '+09:00'` is set on the pool. Pass-through.
   */
  protected toTimestampTz(v: unknown): Date | null {
    if (v == null) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'string') {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  /** Convert MySQL TINYINT(1) (0/1) to JS boolean — robust against types. */
  protected toBoolean(v: unknown): boolean | null {
    if (v == null) return null;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
    return null;
  }

  /** Coerce `bigint | string | number` → number (PG bigint comes back as string). */
  protected toBigIntNumber(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
