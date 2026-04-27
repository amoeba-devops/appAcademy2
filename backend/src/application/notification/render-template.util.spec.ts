import { renderTemplate } from './render-template.util';

describe('renderTemplate', () => {
  it('T-1: replaces {{var}} placeholders with provided values', () => {
    const result = renderTemplate('Hello {{name}}, your order {{orderNo}} is done.', {
      name: '홍길동',
      orderNo: 'ORD-2026-0001',
    });
    expect(result.body).toBe('Hello 홍길동, your order ORD-2026-0001 is done.');
    expect(result.missing).toEqual([]);
  });

  it('T-2a: tracks missing variables and replaces with empty string', () => {
    const result = renderTemplate('Hi {{name}}, score: {{score}}', { name: '홍' });
    expect(result.body).toBe('Hi 홍, score: ');
    expect(result.missing).toContain('score');
  });

  it('T-2b: handles undefined / null / empty string values as missing', () => {
    const r1 = renderTemplate('A: {{a}} B: {{b}} C: {{c}}', {
      a: '',
      b: null as unknown as string,
      c: undefined as unknown as string,
    });
    expect(r1.body).toBe('A:  B:  C: ');
    expect(r1.missing.sort()).toEqual(['a', 'b', 'c']);
  });

  it('T-1b: supports repeated occurrences of the same variable', () => {
    const result = renderTemplate('{{x}}-{{x}}-{{x}}', { x: 'A' });
    expect(result.body).toBe('A-A-A');
    expect(result.missing).toEqual([]);
  });

  it('handles whitespace inside braces', () => {
    const result = renderTemplate('{{ name }} and {{  age  }}', {
      name: '홍',
      age: 12,
    });
    expect(result.body).toBe('홍 and 12');
  });

  it('passes through text without placeholders', () => {
    const result = renderTemplate('static text only', {});
    expect(result.body).toBe('static text only');
    expect(result.missing).toEqual([]);
  });
});
