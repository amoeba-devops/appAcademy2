import { TenantMap } from '../../../scripts/migrate-mysql-to-pg/src/lib/tenant-map';

/**
 * Behaviors covered:
 *  1. load — populates cache from `amb_acm_tenant.legacy_acd_id IS NOT NULL`
 *  2. load — re-loading clears stale entries (cache is replaced, not merged)
 *  3. resolve — known acdId returns the PG ent_id UUID
 *  4. resolve — null/undefined safe; unknown id returns null (caller decides)
 *  5. resolve — coerces string acdId from raw SQL rows
 */
describe('migration-runner :: TenantMap', () => {
  function makePg(rows: Array<{ tnt_ent_id: string; legacy_acd_id: string | null }>) {
    const query = jest.fn(async () => rows);
    return {
      query,
      pgMock: { query } as unknown as ConstructorParameters<typeof TenantMap>[0],
    };
  }

  it('load populates cache from non-null legacy_acd_id rows', async () => {
    const { query, pgMock } = makePg([
      { tnt_ent_id: 'ent-uuid-1', legacy_acd_id: '101' },
      { tnt_ent_id: 'ent-uuid-2', legacy_acd_id: '202' },
    ]);
    const tm = new TenantMap(pgMock);
    await tm.load();

    expect(tm.size()).toBe(2);
    expect(tm.resolve(101)).toBe('ent-uuid-1');
    expect(tm.resolve(202)).toBe('ent-uuid-2');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/legacy_acd_id IS NOT NULL/),
    );
  });

  it('load replaces previously cached entries (re-load is not additive)', async () => {
    const a = makePg([{ tnt_ent_id: 'ent-A', legacy_acd_id: '1' }]);
    const tm = new TenantMap(a.pgMock);
    await tm.load();
    expect(tm.size()).toBe(1);

    // Simulate a tenant rename — PG now returns a different mapping.
    const b = makePg([{ tnt_ent_id: 'ent-B', legacy_acd_id: '2' }]);
    (tm as unknown as { pg: { query: jest.Mock } }).pg = b.pgMock;
    await tm.load();
    expect(tm.size()).toBe(1);
    expect(tm.resolve(1)).toBeNull(); // stale entry gone
    expect(tm.resolve(2)).toBe('ent-B');
  });

  it('resolve returns null on null / undefined / unknown', async () => {
    const { pgMock } = makePg([{ tnt_ent_id: 'ent-A', legacy_acd_id: '1' }]);
    const tm = new TenantMap(pgMock);
    await tm.load();

    expect(tm.resolve(null)).toBeNull();
    expect(tm.resolve(undefined)).toBeNull();
    expect(tm.resolve(999)).toBeNull();
  });

  it('resolve coerces numeric strings (raw SQL columns) safely', async () => {
    const { pgMock } = makePg([{ tnt_ent_id: 'ent-A', legacy_acd_id: '42' }]);
    const tm = new TenantMap(pgMock);
    await tm.load();

    // Migrator callers pass acdId as number, but Number('42') === Number(42).
    expect(tm.resolve(Number('42'))).toBe('ent-A');
  });
});
