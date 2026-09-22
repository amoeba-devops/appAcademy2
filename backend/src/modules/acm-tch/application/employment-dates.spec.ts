import { validateEmploymentDates } from './employment-dates';
describe('employment dates', () => {
  it('accepts missing dates, clearing, leap days and same-day departures', () => {
    expect(() => validateEmploymentDates(null, null)).not.toThrow();
    expect(() =>
      validateEmploymentDates('2024-02-29', '2024-02-29'),
    ).not.toThrow();
    expect(() => validateEmploymentDates('2024-02-29', null)).not.toThrow();
  });
  it.each([
    '2026-02-29',
    '2026-04-31',
    '2026-01-01T00:00:00Z',
    'not-a-date',
    '',
  ])('rejects %s', (date) => {
    expect(() => validateEmploymentDates(date, null)).toThrow();
    expect(() => validateEmploymentDates(null, date)).toThrow();
  });
  it('rejects departure before hire', () => {
    expect(() => validateEmploymentDates('2026-09-22', '2026-09-21')).toThrow();
  });
});
