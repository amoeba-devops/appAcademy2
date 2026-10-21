import { maskLoginId } from './aud.types';

describe('maskLoginId', () => {
  it('keeps two leading characters and the e-mail domain', () => {
    expect(maskLoginId('nobody@example.com')).toBe('no***@example.com');
    expect(maskLoginId('p1023')).toBe('p1***');
    expect(maskLoginId('a')).toBe('a***');
    expect(maskLoginId('')).toBeNull();
  });
});
