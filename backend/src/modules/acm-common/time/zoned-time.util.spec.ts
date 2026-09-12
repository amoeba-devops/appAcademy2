import { ymdInTz, zonedDateTimeToUtc, zonedToUtc } from './zoned-time.util';

describe('zoned-time.util', () => {
  describe('ymdInTz (요구 260912C)', () => {
    it('returns the tenant-local date, not the UTC one', () => {
      // 2026-09-11 16:38Z = 2026-09-12 01:38 KST — UTC 기준이면 하루 밀린다.
      const t = new Date('2026-09-11T16:38:27.110Z');
      expect(t.toISOString().slice(0, 10)).toBe('2026-09-11');
      expect(ymdInTz(t, 'Asia/Seoul')).toBe('2026-09-12');
    });

    it('agrees with UTC when the instant is mid-day', () => {
      const t = new Date('2026-09-11T06:25:28.885Z'); // 15:25 KST
      expect(ymdInTz(t, 'Asia/Seoul')).toBe('2026-09-11');
    });

    it('handles zones behind UTC', () => {
      const t = new Date('2026-09-12T02:00:00.000Z'); // 09-11 22:00 New York
      expect(ymdInTz(t, 'America/New_York')).toBe('2026-09-11');
    });

    it('zero-pads month and day', () => {
      expect(ymdInTz(new Date('2026-01-02T00:30:00.000Z'), 'Asia/Seoul')).toBe(
        '2026-01-02',
      );
    });
  });

  describe('zonedToUtc / zonedDateTimeToUtc', () => {
    it('converts a KST wall clock to the matching UTC instant', () => {
      expect(zonedToUtc(2026, 9, 12, 14, 30, 'Asia/Seoul').toISOString()).toBe(
        '2026-09-12T05:30:00.000Z',
      );
    });

    it('parses date + time strings, returning null on malformed input', () => {
      expect(
        zonedDateTimeToUtc('2026-09-12', '14:30', 'Asia/Seoul')?.toISOString(),
      ).toBe('2026-09-12T05:30:00.000Z');
      expect(
        zonedDateTimeToUtc('12/09/2026', '14:30', 'Asia/Seoul'),
      ).toBeNull();
      expect(zonedDateTimeToUtc('2026-09-12', '2pm', 'Asia/Seoul')).toBeNull();
    });
  });
});
