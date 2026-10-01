import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCalEventDto, UpdateCalEventDto } from './dto/cal-event.dto';
import { validateMeetingUrl } from './meeting-url';
describe('Google Meet links', () => {
  it('trims and preserves valid meeting links including Google account parameters', () => {
    expect(
      validateMeetingUrl(
        'GOOGLE_MEET',
        '  https://meet.google.com/abc-defg-hij?authuser=1  ',
      ),
    ).toBe('https://meet.google.com/abc-defg-hij?authuser=1');
  });
  it.each([
    'http://meet.google.com/abc-defg-hij',
    'https://meet.google.com.evil.test/abc-defg-hij',
    'https://evil.test/abc-defg-hij',
    'https://user@meet.google.com/abc-defg-hij',
    'https://meet.google.com:8443/abc-defg-hij',
    'javascript:alert(1)',
    'https://meet.google.com/',
    'https://meet.google.com/landing',
    'https://meet.google.com/abc-defg-hij/extra',
  ])('rejects %s', (url) => {
    expect(() => validateMeetingUrl('GOOGLE_MEET', url)).toThrow();
  });
  it.each([undefined, null, '', '   '])('allows pending Google link %s', (url) => {
    expect(validateMeetingUrl('GOOGLE_MEET', url)).toBeNull();
    expect(() => validateMeetingUrl('OTHER', url)).toThrow('MEETING_URL_REQUIRED');
  });
  it('keeps ordinary meetings and no-meeting events compatible', () => {
    expect(validateMeetingUrl('OTHER', 'https://example.com/meeting')).toBe(
      'https://example.com/meeting',
    );
    expect(validateMeetingUrl('NONE')).toBeNull();
  });
});

describe('calendar request validation for deferred links', () => {
  it.each([undefined, null, '', '   ', 'https://meet.google.com/abc-defg-hij'])('accepts optional URL %s through create and update DTOs', async (url) => {
    const payload = {evtTitle: 'Class', evtCategory: 'REGULAR_CLASS', evtMeetingProvider: 'GOOGLE_MEET', evtMeetingUrl: url, evtStartAt: '2030-10-01T00:00:00Z', evtEndAt: '2030-10-01T01:00:00Z', evtEditReason: 'Link edit'};
    for (const instance of [plainToInstance(CreateCalEventDto, payload), plainToInstance(UpdateCalEventDto, payload)]) {
      expect((await validate(instance)).filter(e => e.property === 'evtMeetingUrl')).toEqual([]);
    }
  });
  it('still rejects non-URL input in the update DTO', async () => {
    const errors = await validate(plainToInstance(UpdateCalEventDto, {evtMeetingUrl: 'invalid'}));
    expect(errors.some(e => e.property === 'evtMeetingUrl')).toBe(true);
  });
});
