import {
  compareVisitors,
  visitorDate,
  visitorDays,
} from './visitor-comparison';
import type { VisitorObservation } from '../types/visitor-comparison';
function observation(
  overrides: Partial<VisitorObservation> = {},
): VisitorObservation {
  return {
    id: 'x',
    site: 'TPI',
    date: '2026-09-01',
    source: 'GA4',
    value: 10,
    metric: 'activeUsers',
    definition: 'v1',
    timezone: 'UNKNOWN',
    note: '',
    revision: 1,
    updatedAt: '',
    ...overrides,
  };
}
describe('visitor comparison', () => {
  it('rejects invalid real dates and unbounded ranges', () => {
    for (const d of ['2026-02-29', '2026-13-01', 'abc', '2026-09-1'])
      expect(() => visitorDate(d)).toThrow();
    expect(visitorDate('2024-02-29')).toBe('2024-02-29');
    expect(() => visitorDays('2026-09-02', '2026-09-01')).toThrow();
    expect(() => visitorDays('2024-01-01', '2026-01-01')).toThrow();
  });
  it('preserves zero, missing and division by zero separately', () => {
    const r = compareVisitors('2026-09-01', '2026-09-02', 'TPI', [
      observation({ value: 0 }),
      observation({ source: 'IMWEB', value: 2 }),
    ]);
    expect(r.rows[0]).toMatchObject({ difference: 2, differencePercent: null });
    expect(r.rows[1]).toMatchObject({
      ga4: null,
      imweb: null,
      difference: null,
    });
    expect(r.summary.ga4).toMatchObject({
      value: null,
      observedSum: 0,
      observed: 1,
      expected: 2,
    });
  });
  it('counts all three sites and refuses a complete total when a site is absent', () => {
    const rows = [
      observation(),
      observation({ site: 'TRINITY', value: 20 }),
      observation({ site: 'SANTACROCE', value: 30 }),
    ];
    expect(
      compareVisitors('2026-09-01', '2026-09-01', undefined, rows).summary.ga4
        .value,
    ).toBe(60);
    expect(
      compareVisitors('2026-09-01', '2026-09-01', undefined, rows.slice(1))
        .summary.ga4,
    ).toMatchObject({ value: null, observedSum: 50, expected: 3 });
  });
  it('does not add different metrics, timezones or within-site definitions', () => {
    for (const override of [
      { metric: 'sessions' },
      { timezone: 'Asia/Seoul' },
      { definition: 'other' },
    ]) {
      const r = compareVisitors('2026-09-01', '2026-09-02', 'TPI', [
        observation(),
        observation({ date: '2026-09-02', ...override }),
      ]);
      expect(r.summary.ga4).toMatchObject({
        mixedDefinition: true,
        value: null,
        observedSum: null,
      });
    }
  });
  it('allows different streams for different sites', () => {
    const r = compareVisitors('2026-09-01', '2026-09-01', undefined, [
      observation(),
      observation({ site: 'TRINITY', definition: 'stream2' }),
      observation({ site: 'SANTACROCE', definition: 'stream3' }),
    ]);
    expect(r.summary.ga4.value).toBe(30);
  });
  it('new originals supersede legacy values and explicit clears remain missing', () => {
    const r = compareVisitors('2026-09-01', '2026-09-01', 'TPI', [
      observation({ value: 99, definition: 'LEGACY_UNKNOWN' }),
      observation({ value: 12 }),
      observation({ source: 'IMWEB', value: null, revision: 2 }),
    ]);
    expect(r.rows[0].ga4?.value).toBe(12);
    expect(r.rows[0].imweb?.revision).toBe(2);
    expect(r.rows[0].difference).toBeNull();
  });
});
