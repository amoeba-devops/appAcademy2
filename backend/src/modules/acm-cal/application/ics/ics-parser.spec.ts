import { expandSource, splitCalendar } from './ics-parser';
function source(body: string) {
  return splitCalendar(
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-TIMEZONE:Asia/Seoul\r\nBEGIN:VEVENT\r\nUID:test\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR`,
    'test.ics',
  )[0];
}
describe('ICS preservation', () => {
  it('preserves a Zoom join URL as OTHER', () => {
    const e = expandSource(
      source(
        'DTSTART:20261001T000000Z\r\nDTEND:20261001T010000Z\r\nLOCATION:https://zoom.us/j/123456?pwd=sample',
      ),
      new Date(),
    )[0];
    expect(e.meetingProvider).toBe('OTHER');
    expect(e.meetingUrl).toBe('https://zoom.us/j/123456?pwd=sample');
  });
  it('uses calendar timezone for exclusive all-day end', () => {
    const e = expandSource(
      source(
        'DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261003\r\nSUMMARY:휴일',
      ),
      new Date(),
    )[0];
    expect(e.start).toBe('2026-09-30T15:00:00.000Z');
    expect(e.end).toBe('2026-10-02T15:00:00.000Z');
    expect(e.allDay).toBe(true);
  });
  it('preserves finite count, exclusions, and Meet link', () => {
    const s = source(
      'DTSTART:20261001T000000Z\r\nDTEND:20261001T010000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE:20261002T000000Z\r\nSUMMARY:Test\r\nDESCRIPTION:https://meet.google.com/abc-defg-hij',
    );
    const r = expandSource(s, new Date('2026-10-01'));
    expect(r).toHaveLength(2);
    expect(r[0].meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(s.unbounded).toBe(false);
  });
  it('extends unbounded rule without imposing end', () => {
    const s = source(
      'DTSTART:20261001T000000Z\r\nDTEND:20261001T010000Z\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Test',
    );
    expect(s.unbounded).toBe(true);
    expect(expandSource(s, new Date('2026-10-03'))).toHaveLength(2);
    expect(expandSource(s, new Date('2026-10-05'))).toHaveLength(4);
  });
  it('excludes cancelled events', () => {
    expect(
      expandSource(
        source(
          'DTSTART:20261001T000000Z\r\nDTEND:20261001T010000Z\r\nSTATUS:CANCELLED',
        ),
        new Date(),
      ),
    ).toEqual([]);
  });
});
