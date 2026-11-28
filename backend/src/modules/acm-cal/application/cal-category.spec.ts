import { calCategoryBlocksBooking, systemCalCategory } from './cal-category';

describe('calCategoryBlocksBooking (REQ-261128C)', () => {
  it.each(['AVAILABLE', 'CANCELED'])('%s does not occupy the slot', (c) => {
    expect(calCategoryBlocksBooking(c)).toBe(false);
  });
  it.each([
    'UNAVAILABLE',
    'ABSENT',
    'REGULAR_CLASS',
    'DEMO_CLASS',
    'LEVEL_TEST',
    'MEETING',
    'OTHER',
    'CLASS',
    'C_1a2b3c4d',
  ])('%s blocks booking', (c) => {
    expect(calCategoryBlocksBooking(c)).toBe(true);
  });
  it('keeps the fixed external category for tenant codes', () => {
    expect(systemCalCategory('AVAILABLE')).toBe('OTHER');
    expect(systemCalCategory('CLASS')).toBe('REGULAR_CLASS');
  });
});
