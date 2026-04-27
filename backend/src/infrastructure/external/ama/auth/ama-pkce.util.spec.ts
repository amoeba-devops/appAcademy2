import {
  deriveCodeChallenge,
  generatePkceVerifier,
  generateState,
} from './ama-pkce.util';
import { createHash } from 'crypto';

describe('ama-pkce util', () => {
  it('verifier is base64url and respects requested length', () => {
    const v = generatePkceVerifier(43);
    expect(v).toHaveLength(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('challenge is base64url(SHA256(verifier))', () => {
    const v = 'verifier-test-fixed';
    const expected = createHash('sha256').update(v).digest('base64url');
    expect(deriveCodeChallenge(v)).toBe(expected);
  });

  it('state is unique base64url string', () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
