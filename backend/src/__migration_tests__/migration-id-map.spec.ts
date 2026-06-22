import { IdMap } from '../../../scripts/migrate-mysql-to-pg/src/lib/id-map';

/**
 * Behaviors covered:
 *  1. resolveMany — 1 round-trip per batch; placeholders + params correct
 *  2. resolveMany — cache hit + miss are NOT re-queried on a 2nd call
 *  3. resolveOne — cache-only path skips the DB
 *  4. resolveOne — null/NaN/undefined safe
 *  5. negative-hit memoization (queried but absent in PG → returns null
 *     forever without re-querying)
 *
 * The migration runner relies on this to keep FK resolution sub-linear in
 * the number of batches.
 */
describe('migration-runner :: IdMap', () => {
  function makePg(rows: Array<{ pk: string; legacy_id: string }> = []) {
    const query = jest.fn(async (_sql: string, _params: number[]) => rows);
    return {
      query,
      pgMock: {
        query,
      } as unknown as ConstructorParameters<typeof IdMap>[0],
    };
  }

  it('resolveMany makes 1 round-trip per unique batch', async () => {
    const { query, pgMock } = makePg([
      { pk: 'uuid-1', legacy_id: '101' },
      { pk: 'uuid-2', legacy_id: '102' },
    ]);
    const map = new IdMap(pgMock, 'amb_acm_pay_refund_policy', 'prp_id');

    const result = await map.resolveMany([101, 102]);
    expect(result.get(101)).toBe('uuid-1');
    expect(result.get(102)).toBe('uuid-2');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      'SELECT prp_id AS pk, legacy_id FROM amb_acm_pay_refund_policy WHERE legacy_id IN ($1, $2)',
      [101, 102],
    );
  });

  it('repeat resolveMany skips queried ids (positive + negative hits)', async () => {
    const { query, pgMock } = makePg([{ pk: 'uuid-1', legacy_id: '101' }]);
    const map = new IdMap(pgMock, 'amb_acm_pay_refund_policy', 'prp_id');

    await map.resolveMany([101, 999]); // 999 not in PG
    expect(query).toHaveBeenCalledTimes(1);

    // Second batch — both already queried (one hit, one miss). No new query.
    const result = await map.resolveMany([101, 999]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.get(101)).toBe('uuid-1');
    expect(result.has(999)).toBe(false);
  });

  it('resolveOne cache-hit path skips the DB', async () => {
    const { query, pgMock } = makePg([{ pk: 'uuid-1', legacy_id: '101' }]);
    const map = new IdMap(pgMock, 't', 'pk');

    await map.resolveMany([101]);
    query.mockClear();

    const hit = await map.resolveOne(101);
    expect(hit).toBe('uuid-1');
    expect(query).not.toHaveBeenCalled();
  });

  it('resolveOne — null/undefined/NaN safe (no query)', async () => {
    const { query, pgMock } = makePg();
    const map = new IdMap(pgMock, 't', 'pk');

    expect(await map.resolveOne(null)).toBeNull();
    expect(await map.resolveOne(undefined)).toBeNull();
    expect(await map.resolveOne(NaN)).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('resolveOne — negative hit memoized (PG has no such row)', async () => {
    const { query, pgMock } = makePg([]); // PG returns 0 rows
    const map = new IdMap(pgMock, 't', 'pk');

    expect(await map.resolveOne(404)).toBeNull();
    expect(await map.resolveOne(404)).toBeNull();
    // First call queries once; second call uses the negative-hit cache.
    expect(query).toHaveBeenCalledTimes(1);
  });
});
