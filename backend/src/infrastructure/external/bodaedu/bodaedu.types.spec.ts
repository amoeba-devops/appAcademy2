import { bodaDatetimeToIso } from './bodaedu.types';

describe('bodaDatetimeToIso', () => {
  it('parses YYYYMMDDhhmmss as KST', () => {
    expect(bodaDatetimeToIso('20260729140000')).toBe('2026-07-29T05:00:00.000Z');
  });

  it('parses "YYYY-MM-DD hh:mm:ss" as KST', () => {
    expect(bodaDatetimeToIso('2026-07-29 14:00:00')).toBe(
      '2026-07-29T05:00:00.000Z',
    );
  });

  it('parses "YYYY-MM-DDThh:mm" (no seconds, no TZ) as KST', () => {
    expect(bodaDatetimeToIso('2026-07-29T14:00')).toBe(
      '2026-07-29T05:00:00.000Z',
    );
  });

  it('passes through values that already carry an offset', () => {
    expect(bodaDatetimeToIso('2026-07-29T05:00:00.000Z')).toBe(
      '2026-07-29T05:00:00.000Z',
    );
    expect(bodaDatetimeToIso('2026-07-29T14:00:00+09:00')).toBe(
      '2026-07-29T05:00:00.000Z',
    );
  });

  it('returns null for empty or garbage input', () => {
    expect(bodaDatetimeToIso(null)).toBeNull();
    expect(bodaDatetimeToIso(undefined)).toBeNull();
    expect(bodaDatetimeToIso('')).toBeNull();
    expect(bodaDatetimeToIso('not-a-date')).toBeNull();
  });
});
