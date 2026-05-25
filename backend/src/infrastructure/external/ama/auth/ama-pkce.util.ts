import { createHash, randomBytes } from 'crypto';

/**
 * PKCE (RFC 7636) helpers for AMA OIDC.
 */
export function generatePkceVerifier(length = 64): string {
  // base64url 안전 — 문자 [A-Za-z0-9-_], 패딩 없음
  return randomBytes(length).toString('base64url').slice(0, length);
}

export function deriveCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function generateState(byteLen = 24): string {
  return randomBytes(byteLen).toString('base64url');
}
