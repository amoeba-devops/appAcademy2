import { DataSource } from 'typeorm';
import { DailyKpiTypeormEntity } from '../infrastructure/typeorm/daily-kpi.typeorm-entity';
import { DailyKpiSiteTypeormEntity } from '../infrastructure/typeorm/daily-kpi-site.typeorm-entity';
import { MonthlySummaryService } from './monthly-summary.service';

describe('MonthlySummaryService actuals contract', () => {
  const find = jest.fn();
  const getRepository = jest.fn(() => ({ find }));
  const service = new MonthlySummaryService({
    getRepository,
    query: jest.fn().mockResolvedValue([]),
  } as unknown as DataSource);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-18T03:00:00Z'));
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  function day(
    date: string,
    visitor: number | null,
    cost: string | null = null,
  ) {
    return Object.assign(new DailyKpiTypeormEntity(), {
      date,
      marketingVisitor: visitor,
      marketingCost: cost,
      computationStatus: 'FRESH',
      dataCompleteness: 'COMPLETE',
      csCounseling: 0,
      csApply: 0,
      opsCountSt: 2,
      opsCountTc: 2,
    });
  }

  it('preserves null cost, reports partial visitor coverage and suppresses invalid comparisons', async () => {
    find
      .mockResolvedValueOnce([
        day('2026-09-01', 100),
        day('2026-09-02', null),
        day('2026-09-30', 999),
      ])
      .mockResolvedValueOnce([day('2026-08-01', 0)]);
    const result = await service.getRangeSummary(
      'tenant-a',
      '2026-09-01',
      '2026-09-30',
    );
    const [visitor, cost] = result.categories[0].metrics;
    expect(visitor.sum).toBe(100);
    expect(visitor.aver).toBe(100);
    expect(visitor.momDeltaPct).toBeNull();
    expect(visitor.coverage.validDays).toBe(1);
    expect(cost.sum).toBeNull();
    expect(result.previousFrom).toBe('2026-08-01');
    expect(result.previousTo).toBe('2026-08-18');
    expect(result.categories[0].series).toHaveLength(18);
    for (const [options] of find.mock.calls)
      expect(options.where.entId).toBe('tenant-a');
  });

  it('keeps site filters on current and comparison queries and omits tenant-only cards', async () => {
    find
      .mockResolvedValueOnce([day('2026-09-01', 0, '0')])
      .mockResolvedValueOnce([day('2026-08-31', 0, '0')]);
    const result = await service.getRangeSummary(
      'tenant-a',
      '2026-09-01',
      '2026-09-01',
      'TPI',
    );
    expect(getRepository).toHaveBeenCalledWith(DailyKpiSiteTypeormEntity);
    expect(result.categories.map((c) => c.category)).toEqual([
      'MARKETING',
      'CS',
    ]);
    expect(result.categories[0].metrics[0].coverage.status).toBe('AVAILABLE');
    expect(result.categories[0].metrics[1].sum).toBe(0);
    for (const [options] of find.mock.calls)
      expect(options.where).toMatchObject({ entId: 'tenant-a', site: 'TPI' });
  });

  it('never reports +100% when the previous value was zero', async () => {
    find
      .mockResolvedValueOnce([day('2026-09-01', 10)])
      .mockResolvedValueOnce([day('2026-08-31', 0)]);
    const result = await service.getRangeSummary(
      'tenant-a',
      '2026-09-01',
      '2026-09-01',
    );
    expect(result.categories[0].metrics[0].momDeltaPct).toBeNull();
  });
});
