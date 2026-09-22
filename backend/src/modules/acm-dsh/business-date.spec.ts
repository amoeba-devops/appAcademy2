import { kstDaysAgo } from './business-date';
describe('GA KST business dates', () => {
  it.each([
    '2026-09-21T15:00:00Z',
    '2026-09-21T19:00:00Z',
    '2026-09-21T23:00:00Z',
    '2026-09-22T00:00:00Z',
  ])('uses September 21 as yesterday at %s', (now) => {
    expect(kstDaysAgo(1, new Date(now))).toBe('2026-09-21');
    expect(kstDaysAgo(3, new Date(now))).toBe('2026-09-19');
  });
  it.each([
    ['2026-12-31T19:00:00Z', '2026-12-31'],
    ['2024-02-29T19:00:00Z', '2024-02-29'],
    ['2026-02-28T19:00:00Z', '2026-02-28'],
  ])('handles calendar boundaries %s', (now, expected) => {
    expect(kstDaysAgo(1, new Date(now))).toBe(expected);
  });
});
