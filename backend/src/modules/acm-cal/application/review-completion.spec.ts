import { hasReviewContent, reviewMissing } from './review-completion';
describe('review completion', () => {
  it.each([
    '',
    '<p><br></p>',
    '<p>&nbsp; &#160;</p>',
    '<script>alert(1)</script>',
  ])('rejects empty/nonvisible markup %s', (s) =>
    expect(hasReviewContent(s)).toBe(false),
  );
  it('requires both pieces of work but accepts explicit no-homework', () => {
    expect(reviewMissing({}, 0)).toEqual(['feedback', 'homework']);
    expect(
      reviewMissing({ feedbackHtml: 'Done', homeworkStatus: 'ASSIGNED' }, 0),
    ).toEqual(['homework']);
    expect(
      reviewMissing({ feedbackHtml: 'Done', homeworkStatus: 'NONE' }, 0),
    ).toEqual([]);
    expect(reviewMissing({ feedbackHtml: 'Done' }, 1)).toEqual([]);
    expect(
      reviewMissing({ feedbackHtml: 'Done', homeworkHtml: 'Practice' }, 0),
    ).toEqual([]);
  });
});
