import { expandRecurrence, wallTime } from './recurrence-calculator';
import type { RecurrenceRuleDto } from './dto/recurrence.dto';
const base: RecurrenceRuleDto = {
  kind: 'DAILY',
  interval: 1,
  excludeWeekends: false,
  end: 'COUNT',
  count: 5,
};
const run = (
  start: string,
  rule: Partial<RecurrenceRuleDto> = {},
  end?: string,
  tz = 'Asia/Seoul',
) =>
  expandRecurrence(
    start,
    end ?? new Date(+new Date(start) + 3600000).toISOString(),
    tz,
    { ...base, ...rule },
    new Date('2040-01-01'),
  );
describe('manual calendar recurrence', () => {
  it('counts actual weekdays and skips an excluded weekend start', () => {
    expect(
      run('2026-10-03T00:00Z', { excludeWeekends: true }).map((x) =>
        x.start.slice(0, 10),
      ),
    ).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });
  it('preserves N-day phase while excluding weekends', () => {
    expect(
      run('2026-10-01T00:00Z', { interval: 2, excludeWeekends: true }).map(
        (x) => x.start.slice(0, 10),
      ),
    ).toEqual([
      '2026-10-01',
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-13',
    ]);
  });
  it('includes weekends by default and includes the until date in local timezone', () => {
    expect(
      run('2026-10-02T23:00Z', { end: 'UNTIL', until: '2026-10-04' }).map(
        (x) => x.start,
      ),
    ).toEqual(['2026-10-02T23:00:00.000Z', '2026-10-03T23:00:00.000Z']);
  });
  it('supports multiple weekdays and skips short months', () => {
    expect(
      run('2026-10-01T00:00Z', {
        kind: 'WEEKLY',
        weekdays: [1, 3],
        count: 3,
      }).map((x) => x.start.slice(0, 10)),
    ).toEqual(['2026-10-05', '2026-10-07', '2026-10-12']);
    expect(
      run('2028-01-31T00:00Z', { kind: 'MONTHLY', count: 3 }).map((x) =>
        x.start.slice(0, 10),
      ),
    ).toEqual(['2028-01-31', '2028-03-31', '2028-05-31']);
  });
  it('deduplicates dates, retains overnight duration and ignores recurrence count for explicit dates', () => {
    const x = run(
      '2026-10-01T14:00Z',
      {
        kind: 'DATES',
        dates: ['2026-10-09', '2026-10-03', '2026-10-03'],
        count: 1,
      },
      '2026-10-01T16:00Z',
    );
    expect(x).toHaveLength(2);
    expect(x[0].start).toBe('2026-10-03T14:00:00.000Z');
    expect(x[0].end).toBe('2026-10-03T16:00:00.000Z');
  });
  it('retains local time over DST and skips nonexistent local times', () => {
    const x = run(
      '2027-03-13T14:00Z',
      { count: 3 },
      undefined,
      'America/New_York',
    );
    expect(
      x.map((o) => wallTime(o.start, 'America/New_York').slice(11)),
    ).toEqual(['09:00:00', '09:00:00', '09:00:00']);
    expect(x[1].start).toBe('2027-03-14T13:00:00.000Z');
    const gap = run(
      '2027-03-13T07:30Z',
      { count: 2 },
      undefined,
      'America/New_York',
    );
    expect(gap[1].start.slice(0, 10)).toBe('2027-03-15');
  });
  it('preserves all-day local boundaries across DST', () => {
    const x = run(
      '2027-03-13T05:00Z',
      { count: 2 },
      '2027-03-14T05:00Z',
      'America/New_York',
    );
    expect(x[1].end).toBe('2027-03-15T04:00:00.000Z');
  });
  it('returns no occurrences when a weekly daily interval only lands on excluded weekends', () => {
    expect(
      run('2026-10-03T00:00Z', { interval: 7, excludeWeekends: true }),
    ).toEqual([]);
  });
  it('rejects missing weekdays, invalid dates and inverted duration', () => {
    expect(() =>
      run('2026-10-01T00:00Z', { kind: 'WEEKLY', weekdays: [] }),
    ).toThrow();
    expect(() =>
      run('2026-10-01T00:00Z', { kind: 'DATES', dates: ['2026-02-30'] }),
    ).toThrow();
    expect(() => run('2026-10-01T00:00Z', {}, '2026-09-01T00:00Z')).toThrow();
  });
});
