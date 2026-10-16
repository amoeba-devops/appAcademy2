import { mentionIds } from './issue-mentions';

// REQ-261016E — Tiptap Mention HTML 에서 사용자 ID 추출.
describe('mentionIds', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  it('extracts ids from mention spans regardless of attribute order', () => {
    const html = `<p>확인 <span data-type="mention" data-id="${a}" data-label="kim">@kim</span>
      <span class="x" data-label="lee" data-id="${b.toUpperCase()}" data-type="mention">@lee</span></p>`;
    expect(mentionIds(html).sort()).toEqual([a, b]);
  });
  it('ignores non-mention spans, invalid ids and duplicates', () => {
    const html = `<span data-id="${a}">x</span><span data-type="mention" data-id="nope">@x</span>
      <span data-type="mention" data-id="${a}">@a</span><span data-type="mention" data-id="${a}">@a</span>`;
    expect(mentionIds(html)).toEqual([a]);
  });
  it('handles empty input', () => {
    expect(mentionIds('')).toEqual([]);
    expect(mentionIds(null)).toEqual([]);
  });
});
