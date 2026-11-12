import { BadRequestException } from '@nestjs/common';
/**
 * REQ-261112C — Google Meet 링크는 형식 검사 없이 입력한 그대로 저장한다
 * (앞뒤 공백만 제거, 500자 제한은 DTO). 다른 종류는 http(s) URL 필수.
 */
export function validateMeetingUrl(
  provider?: string,
  value?: string | null,
): string | null {
  if (!provider || provider === 'NONE') return null;
  const trimmed = value?.trim();
  if (!trimmed) {
    if (provider === 'GOOGLE_MEET') return null;
    throw new BadRequestException('MEETING_URL_REQUIRED');
  }
  if (provider === 'GOOGLE_MEET') return trimmed;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('invalid URL');
    return trimmed;
  } catch {
    throw new BadRequestException('MEETING_URL_REQUIRED');
  }
}
