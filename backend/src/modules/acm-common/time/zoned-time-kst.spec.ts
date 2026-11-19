import {
  addDaysYmd,
  dowOfYmd,
  monthInTz,
  todayInTz,
  ymdOf,
} from './zoned-time.util';

describe('REQ-261119 KST date helpers', () => {
  it('UTC 15:00 이후는 한국 다음 날', () => {
    expect(todayInTz(undefined, new Date('2026-11-18T14:59:59Z'))).toBe('2026-11-18');
    expect(todayInTz(undefined, new Date('2026-11-18T15:00:00Z'))).toBe('2026-11-19');
  });
  it('월 경계도 한국시간', () => {
    expect(monthInTz(undefined, new Date('2026-11-30T15:30:00Z'))).toBe('2026-12');
  });
  it('addDaysYmd / dowOfYmd', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
    expect(dowOfYmd('2026-11-16')).toBe(1);
  });
  it('ymdOf', () => {
    expect(ymdOf('2026-11-16')).toBe('2026-11-16');
    expect(ymdOf(new Date('2026-11-16T00:00:00Z'))).toBe('2026-11-16');
  });
});
