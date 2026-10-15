import { BadRequestException } from '@nestjs/common';
import { isValidTimeZone, normalizeUserTimeZone } from './user-timezone';

describe('user timezone (REQ-261015C)', () => {
  it('accepts IANA zones and maps blank to tenant default', () => {
    expect(isValidTimeZone('Asia/Ho_Chi_Minh')).toBe(true);
    expect(normalizeUserTimeZone(' America/New_York ')).toBe(
      'America/New_York',
    );
    expect(normalizeUserTimeZone('')).toBeNull();
    expect(normalizeUserTimeZone(null)).toBeNull();
    expect(normalizeUserTimeZone(undefined)).toBeNull();
  });
  it('rejects unknown zones', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(() => normalizeUserTimeZone('Mars/Olympus')).toThrow(
      BadRequestException,
    );
    expect(() => normalizeUserTimeZone('x'.repeat(65))).toThrow();
  });
});
