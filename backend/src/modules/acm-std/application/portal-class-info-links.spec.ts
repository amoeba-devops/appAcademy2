import { mergeLinks } from './portal-class-info.service';

describe('REQ-261112D portal links merge calendar meeting links', () => {
  it('appends calendar links after saved links, marked as CAL', () => {
    expect(
      mergeLinks(
        [{ label: '정규', url: 'https://zoom.us/j/1' }],
        ['https://meet.google.com/abc-defg-hij'],
      ),
    ).toEqual([
      { label: '정규', url: 'https://zoom.us/j/1' },
      { label: null, url: 'https://meet.google.com/abc-defg-hij', source: 'CAL' },
    ]);
  });
  it('skips calendar links already saved (scheme / trailing slash / case ignored)', () => {
    expect(
      mergeLinks(
        [{ label: null, url: 'https://meet.google.com/abc-defg-hij' }],
        ['meet.google.com/ABC-defg-hij/', 'https://meet.google.com/xyz-abcd-efg'],
      ).map((l) => l.url),
    ).toEqual([
      'https://meet.google.com/abc-defg-hij',
      'https://meet.google.com/xyz-abcd-efg',
    ]);
  });
  it('returns saved links unchanged when no calendar links', () => {
    expect(mergeLinks([], [])).toEqual([]);
  });
});
