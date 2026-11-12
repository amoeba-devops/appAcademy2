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
    'https://meet.google.com/landing',
    'meet.google.com/abc-defg-hij',
    'abc-defg-hij',
  ])('REQ-261112C: keeps %s as entered (no format check)', (url) => {
    expect(validateMeetingUrl('GOOGLE_MEET', `  ${url} `)).toBe(url);
  });
  it('still requires an http(s) URL for other providers', () => {
    expect(() => validateMeetingUrl('OTHER', 'javascript:alert(1)')).toThrow();
    expect(() => validateMeetingUrl('OTHER', 'abc-defg-hij')).toThrow();
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
  it('accepts free-form Google Meet text in the DTOs (checked per provider in the service)', async () => {
    const errors = await validate(plainToInstance(UpdateCalEventDto, {evtMeetingUrl: 'abc-defg-hij'}));
    expect(errors.some(e => e.property === 'evtMeetingUrl')).toBe(false);
  });
});
