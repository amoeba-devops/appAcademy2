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
