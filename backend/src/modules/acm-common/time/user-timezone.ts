import { BadRequestException } from '@nestjs/common';

/** IANA 타임존 이름인지 확인 (Intl 이 거부하면 무효). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** REQ-261015C — 사용자 타임존 입력 정규화. 빈 값/null 은 테넌트 기본(null). */
export function normalizeUserTimeZone(
  tz: string | null | undefined,
): string | null {
  const v = (tz ?? '').trim();
  if (!v) return null;
  if (!isValidTimeZone(v))
    throw new BadRequestException('유효하지 않은 타임존입니다.');
  return v;
}
