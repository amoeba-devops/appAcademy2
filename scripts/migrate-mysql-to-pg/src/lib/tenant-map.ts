import type { PgClient } from './pg-client';
import { Logger } from './logger';

/**
 * Resolves MySQL `acd_id` (BIGINT) to PG `ent_id` (UUID) via the
 * `amb_acm_tenant.legacy_acd_id` mapping column.
 *
 * Cache-once design — populated in the constructor, not refreshed during
 * the migration run. If new tenants are created between Phase 0 and
 * Phase 6, the operator must re-run tenant-bootstrap to refresh.
 */
export class TenantMap {
  private cache: Map<number, string> = new Map();
  private readonly log = new Logger('tenant-map');

  constructor(private readonly pg: PgClient) {}

  async load(): Promise<void> {
    const rows = await this.pg.query<{ tnt_ent_id: string; legacy_acd_id: string | null }>(
      `SELECT tnt_ent_id, legacy_acd_id
         FROM amb_acm_tenant
        WHERE legacy_acd_id IS NOT NULL`,
    );
    this.cache.clear();
    for (const r of rows) {
      const acd = Number(r.legacy_acd_id);
      if (Number.isFinite(acd)) {
        this.cache.set(acd, r.tnt_ent_id);
      }
    }
    this.log.info('loaded', { tenants: this.cache.size });
  }

  /**
   * @returns The PG ent_id UUID for the given MySQL acd_id, or null when
   *   the tenant hasn't been bootstrapped yet. Caller decides whether to
   *   skip the row (typical for orphaned rows) or fail loud.
   */
  resolve(acdId: number | null | undefined): string | null {
    if (acdId == null) return null;
    return this.cache.get(Number(acdId)) ?? null;
  }

  size(): number {
    return this.cache.size;
  }
}
