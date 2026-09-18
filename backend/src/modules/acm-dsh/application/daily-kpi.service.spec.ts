import { DataSource } from 'typeorm';
import { DailyKpiService } from './daily-kpi.service';

describe('DailyKpiService site reconciliation', () => {
  const query = jest.fn();
  const service = new DailyKpiService({ query } as unknown as DataSource);
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-18T03:00:00Z'));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('preserves missing site data and costs without manufacturing a Common residual', async () => {
    query
      .mockResolvedValueOnce([
        {
          site: 'TPI',
          visitor: '260',
          counseling: '4',
          apply: '0',
          cost: null,
          complain: '0',
        },
      ])
      .mockResolvedValueOnce([
        {
          visitor: '4617',
          counseling: '15',
          apply: '4',
          cost: null,
          complain: '6',
        },
      ]);
    const result = await service.getSiteComparison(
      'tenant-a',
      '2026-09-01',
      '2026-09-30',
    );
    expect(result.rows.find((r) => r.site === 'COMMON')).toMatchObject({
      visitor: null,
      counseling: null,
      cost: null,
    });
    expect(result.rows.find((r) => r.site === 'TOTAL')).toMatchObject({
      visitor: 4617,
      effect: 19,
      cost: null,
    });
    for (const [, parameters] of query.mock.calls)
      expect(parameters).toEqual(['tenant-a', '2026-09-01', '2026-09-18']);
    expect(query.mock.calls[1][0]).toContain(
      "dkp_computation_status = 'FRESH'",
    );
  });

  it('does not turn an entirely unavailable range into real zero counts', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          visitor: null,
          counseling: null,
          apply: null,
          cost: null,
          complain: null,
        },
      ]);
    const result = await service.getSiteComparison(
      'tenant-a',
      '2026-10-01',
      '2026-10-31',
    );
    expect(
      result.rows.every(
        (r) => r.counseling === null && r.effect === null && r.cost === null,
      ),
    ).toBe(true);
  });
});
