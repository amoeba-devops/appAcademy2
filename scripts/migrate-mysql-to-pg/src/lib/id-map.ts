import type { PgClient } from './pg-client';

/**
 * Batched FK resolution — `legacy_id BIGINT → new UUID`.
 *
 * Used when migrating a child table whose FK references a parent that's
 * already been migrated (and therefore has both the new UUID PK and the
 * `legacy_id` mapping column populated).
 *
 * Per-batch pattern (called inside the migrator's preBatch):
 *
 *   const rfpMap = new IdMap(pg, 'amb_acm_pay_refund_policy', 'prp_id');
 *   const newRows = await Promise.all(mysqlBatch.map(async (r) => {
 *     const prp_id = await rfpMap.resolve(r.rfp_id);
 *     return prp_id ? { ...r, prp_id } : null;
 *   }));
 *
 * Caches across calls within the same IdMap instance. Use one IdMap per
 * (pgTable, pkColumn) pair per migration run.
 *
 * @remarks Some dual-write tables (e.g. `amb_acm_csl_enrollment`) don't
 *   yet have a `legacy_id` column — Phase 3 needs a small ALTER TABLE
 *   prep step before running migrators that depend on those FKs. See
 *   README §3 'enrollment FK gap'.
 */
export class IdMap {
  private cache = new Map<number, string>();
  /** Legacy IDs we've already queried (positive or negative hit). */
  private queried = new Set<number>();

  constructor(
    private readonly pg: PgClient,
    private readonly pgTable: string,
    /** PG primary-key column name (e.g. 'prp_id', 'pod_id'). */
    private readonly pkColumn: string,
  ) {}

  /**
   * Resolve N legacy IDs in one round-trip. Missing IDs are recorded as
   * "queried but not found" so we don't re-query them.
   */
  async resolveMany(legacyIds: ReadonlyArray<number | null | undefined>): Promise<Map<number, string>> {
    const toQuery: number[] = [];
    for (const id of legacyIds) {
      if (id == null) continue;
      const n = Number(id);
      if (!Number.isFinite(n)) continue;
      if (this.queried.has(n)) continue;
      toQuery.push(n);
    }
    if (toQuery.length === 0) return this.cache;

    const placeholders = toQuery.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.pg.query<{ pk: string; legacy_id: string }>(
      `SELECT ${this.pkColumn} AS pk, legacy_id FROM ${this.pgTable} WHERE legacy_id IN (${placeholders})`,
      toQuery,
    );
    for (const r of rows) {
      const legacy = Number(r.legacy_id);
      if (Number.isFinite(legacy)) this.cache.set(legacy, r.pk);
    }
    for (const id of toQuery) this.queried.add(id);
    return this.cache;
  }

  /** Resolve one legacy ID. Returns null when not found. */
  async resolveOne(legacyId: number | null | undefined): Promise<string | null> {
    if (legacyId == null) return null;
    const n = Number(legacyId);
    if (!Number.isFinite(n)) return null;
    if (this.cache.has(n)) return this.cache.get(n) ?? null;
    if (this.queried.has(n)) return null;
    await this.resolveMany([n]);
    return this.cache.get(n) ?? null;
  }

  size(): number {
    return this.cache.size;
  }
}
