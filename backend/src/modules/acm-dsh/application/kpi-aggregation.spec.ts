import {
  aggregateKpis,
  comparisonRange,
  kpiToday,
  type KpiRow,
} from './kpi-aggregation';

function row(date: string, values: Partial<KpiRow> = {}): KpiRow {
  return {
    date,
    computationStatus: 'FRESH',
    dataCompleteness: 'COMPLETE',
    marketingVisitor: null,
    marketingCost: null,
    marketingEffect: null,
    csCounseling: 0,
    csApply: 0,
    csBeginning: 0,
    csMissing: 0,
    csTrialClass: 0,
    csComplain: 0,
    opsNewSt: 0,
    opsOutSt: 0,
    opsCountSt: 0,
    opsNewTc: 0,
    opsOutTc: 0,
    opsCountTc: 0,
    classMapTest: 0,
    classTtClass: '0',
    classStudent: 0,
    classTeacher: 0,
    ...values,
  };
}

describe('dashboard actuals aggregation', () => {
  it('excludes future/failed rows, preserves missing values and counts genuine zero days', () => {
    const result = aggregateKpis(
      [
        row('2026-09-01', { marketingVisitor: 100, opsCountSt: 50 }),
        row('2026-09-02', { marketingVisitor: 0, opsCountSt: 51 }),
        row('2026-09-03', {
          marketingVisitor: 999,
          computationStatus: 'FAILED',
        }),
        row('2026-09-04', {
          marketingVisitor: 999,
          dataCompleteness: 'PARTIAL_FUTURE',
        }),
        row('2026-09-30', { marketingVisitor: 999, opsCountSt: 2 }),
      ],
      '2026-09-01',
      '2026-09-30',
      '2026-09-04',
    );
    expect(result.sums.mkt_visitor).toBe(100);
    expect(result.averages.mkt_visitor).toBe(50);
    expect(result.sums.mkt_cost).toBeNull();
    expect(result.sums.ops_count_st).toBe(51);
    expect(result.series.mkt_visitor).toEqual([100, 0, null, null]);
    expect(result.coverage.mkt_visitor).toEqual({
      validDays: 2,
      expectedDays: 4,
      asOf: '2026-09-02',
      status: 'PARTIAL',
    });
    expect(result.populatedDayCount).toBe(2);
  });

  it('uses metric-specific cost coverage, including explicit zero', () => {
    const result = aggregateKpis(
      [
        row('2026-09-01', { marketingCost: '100' }),
        row('2026-09-02'),
        row('2026-09-03', { marketingCost: '0' }),
      ],
      '2026-09-01',
      '2026-09-03',
      '2026-09-18',
    );
    expect(result.sums.mkt_cost).toBe(100);
    expect(result.averages.mkt_cost).toBe(50);
    expect(result.coverage.mkt_cost.status).toBe('PARTIAL');
  });

  it('derives effect instead of using an inconsistent cached value', () => {
    const result = aggregateKpis(
      [
        row('2026-01-01', {
          csCounseling: 21,
          csApply: 16,
          marketingEffect: 34,
        }),
      ],
      '2026-01-01',
      '2026-01-01',
    );
    expect(result.sums.mkt_effect).toBe(37);
  });

  it('returns no actuals for an entirely future range', () => {
    const result = aggregateKpis(
      [row('2026-10-01')],
      '2026-10-01',
      '2026-10-31',
      '2026-09-18',
    );
    expect(result.actualThrough).toBeNull();
    expect(result.sums.cs_apply).toBeNull();
    expect(result.series.mkt_visitor).toEqual([]);
  });

  it('uses Seoul dates and equal elapsed comparison lengths', () => {
    expect(kpiToday(new Date('2026-09-17T15:00:00Z'))).toBe('2026-09-18');
    expect(comparisonRange('2026-09-01', '2026-09-30', '2026-09-16')).toEqual({
      through: '2026-09-16',
      previousFrom: '2026-08-01',
      previousTo: '2026-08-16',
    });
    expect(
      comparisonRange('2026-09-05', '2026-09-30', '2026-09-16').previousFrom,
    ).toBe('2026-08-24');
    expect(
      comparisonRange('2026-03-01', '2026-03-31', '2026-03-30').previousTo,
    ).toBe('2026-02-28');
  });
});
