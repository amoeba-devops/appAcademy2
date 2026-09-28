import { BadRequestException } from '@nestjs/common';
export function validateMeetingUrl(
  provider?: string,
  value?: string | null,
): string | null {
  if (!provider || provider === 'NONE') return null;
  const trimmed = value?.trim();
  if (!trimmed) throw new BadRequestException('MEETING_URL_REQUIRED');
  try {
    const url = new URL(trimmed);
    if (provider === 'GOOGLE_MEET') {
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'meet.google.com' ||
        url.port ||
        url.username ||
        url.password ||
        !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)
      ) {
        throw new Error('invalid Meet URL');
      }
    } else if (!['http:', 'https:'].includes(url.protocol))
      throw new Error('invalid URL');
    return trimmed;
  } catch {
    throw new BadRequestException(
      provider === 'GOOGLE_MEET'
        ? 'INVALID_GOOGLE_MEET_URL'
        : 'MEETING_URL_REQUIRED',
    );
  }
}
