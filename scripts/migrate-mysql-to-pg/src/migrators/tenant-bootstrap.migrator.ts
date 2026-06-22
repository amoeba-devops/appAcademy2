import { BaseMigrator } from '../lib/migrator';
import type { MigrateOptions, MigrateResult, VerifyResult } from '../lib/migrator';

/**
 * Tenant bootstrap — MUST run before any other domain.
 *
 * Populates `amb_acm_tenant.legacy_acd_id` for each row in `tac_academies`,
 * matching by name. Without this mapping, all downstream FK resolution
 * (acd_id → ent_id) returns null and migrations skip every row.
 *
 * Matching strategy (per Q-6 — PG authoritative):
 *   1. If `amb_acm_tenant.tnt_name` == `tac_academies.acd_name` (exact),
 *      set legacy_acd_id.
 *   2. If no match: log + skip. Operator must create the PG tenant manually
 *      (typically via /system admin UI or seed SQL), then re-run.
 *
 * Conflicts (multiple tac_academies with same name) → fail loud.
 */
export class TenantBootstrapMigrator extends BaseMigrator {
  constructor(
    mysql: ConstructorParameters<typeof BaseMigrator>[1],
    pg: ConstructorParameters<typeof BaseMigrator>[2],
    tenants: ConstructorParameters<typeof BaseMigrator>[3],
    cfg: ConstructorParameters<typeof BaseMigrator>[4],
  ) {
    super('tenant-bootstrap', mysql, pg, tenants, cfg);
  }

  async migrate(opts: MigrateOptions): Promise<MigrateResult> {
    const start = Date.now();
    const dryRun = opts.dryRun ?? this.cfg.dryRun;
    let matched = 0;
    let unmatchedMysql = 0;
    let conflicts = 0;

    const mysqlRows = await this.mysql.findOne<{ rows: string }>(
      `SELECT COUNT(*) AS rows FROM tac_academies`,
    );
    const totalMysql = Number(mysqlRows?.rows ?? 0);
    this.log.info('begin tenant bootstrap', { mysqlAcademies: totalMysql, dryRun });

    for await (const batch of this.mysql.iterate<{
      acd_id: number;
      acd_name: string;
    }>('tac_academies', {
      orderBy: 'acd_id',
      batchSize: this.cfg.batchSize,
      columns: ['acd_id', 'acd_name'],
      limit: opts.limit,
    })) {
      for (const row of batch) {
        const pgTenants = await this.pg.query<{ tnt_ent_id: string; legacy_acd_id: string | null }>(
          `SELECT tnt_ent_id, legacy_acd_id
             FROM amb_acm_tenant
            WHERE tnt_name = $1`,
          [row.acd_name],
        );
        if (pgTenants.length === 0) {
          this.log.warn('no PG tenant match — manual create required', {
            acd_id: row.acd_id,
            acd_name: row.acd_name,
          });
          unmatchedMysql++;
          continue;
        }
        if (pgTenants.length > 1) {
          this.log.error('multiple PG tenants with same name — operator must resolve', {
            acd_id: row.acd_id,
            acd_name: row.acd_name,
            matches: pgTenants.map((t) => t.tnt_ent_id),
          });
          conflicts++;
          continue;
        }
        const target = pgTenants[0];
        // Already set + matches → no-op
        if (target.legacy_acd_id !== null && Number(target.legacy_acd_id) === row.acd_id) {
          matched++;
          continue;
        }
        // Already set + different → fail loud
        if (target.legacy_acd_id !== null && Number(target.legacy_acd_id) !== row.acd_id) {
          this.log.error('PG tenant already mapped to a different acd_id', {
            tnt_ent_id: target.tnt_ent_id,
            existing_legacy_acd: target.legacy_acd_id,
            attempted_legacy_acd: row.acd_id,
          });
          conflicts++;
          continue;
        }
        // Otherwise: set
        if (!dryRun) {
          await this.pg.query(
            `UPDATE amb_acm_tenant SET legacy_acd_id = $1 WHERE tnt_ent_id = $2`,
            [row.acd_id, target.tnt_ent_id],
          );
        }
        matched++;
        this.log.info(`mapped acd_id=${row.acd_id} → ent_id=${target.tnt_ent_id}`, {
          name: row.acd_name,
        });
      }
    }

    // Refresh in-memory cache so subsequent migrators see the new mapping.
    if (!dryRun) await this.tenants.load();

    const durationMs = Date.now() - start;
    return {
      domain: this.domain,
      tables: [
        {
          mysqlTable: 'tac_academies',
          pgTable: 'amb_acm_tenant',
          mysqlCount: totalMysql,
          pgInserted: matched,
          pgSkipped: unmatchedMysql + conflicts,
          durationMs,
        },
      ],
    };
  }

  async verify(): Promise<VerifyResult> {
    // Verify all MySQL academies have a corresponding mapped PG tenant.
    const total = await this.mysql.count('tac_academies');
    const mapped = await this.pg.findOne<{ c: string }>(
      `SELECT COUNT(*)::bigint AS c FROM amb_acm_tenant WHERE legacy_acd_id IS NOT NULL`,
    );
    const pgCount = Number(mapped?.c ?? 0);
    return {
      domain: this.domain,
      rows: [
        {
          mysqlTable: 'tac_academies',
          pgTable: 'amb_acm_tenant (legacy_acd_id NOT NULL)',
          mysqlCount: total,
          pgCount,
          diff: pgCount - total,
          ok: pgCount === total,
        },
      ],
    };
  }
}
