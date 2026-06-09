import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  AmaTokenVerifier,
  AmaTokenVerifyException,
} from './ama-token.verifier';

const SECRET = 'dev-acm-ama-secret-change-me-32bytes-for-tests';

function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
  const env: Record<string, string | undefined> = {
    AMA_JWT_SECRET: SECRET,
    AMA_JWT_ALLOWED_APP_CODES: 'tpi-acm',
    ...overrides,
  };
  return {
    get: <T = string>(k: string, def?: T): T | undefined => (env[k] as T | undefined) ?? def,
  } as unknown as ConfigService;
}

function makeToken(
  overrides: Partial<{
    sub: string; email: string; role: string;
    entityId: string; appId: string; appCode: string;
    scope: string; ttlSec: number;
    iatOffsetSec: number;
    signWith?: string;
    algorithm?: jwt.Algorithm;
  }> = {},
): string {
  const now = Math.floor(Date.now() / 1000) + (overrides.iatOffsetSec ?? 0);
  const payload = {
    sub:       overrides.sub      ?? 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
    email:     overrides.email    ?? 'fremd@naver.com',
    role:      overrides.role     ?? 'MASTER',
    entityId:  overrides.entityId ?? '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
    appId:     overrides.appId    ?? '15b69898-7828-4072-9892-a2f7bea1eb57',
    appCode:   overrides.appCode  ?? 'tpi-acm',
    scope:     overrides.scope    ?? 'custom_app:context',
    iat: now,
    exp: now + (overrides.ttlSec ?? 3600),
  };
  return jwt.sign(payload, overrides.signWith ?? SECRET, {
    algorithm: overrides.algorithm ?? 'HS256',
    
  });
}

describe('AmaTokenVerifier (unit)', () => {
  it('TC-UNIT-01: verifies a well-formed HS256 token and returns payload', () => {
    const v = new AmaTokenVerifier(makeConfig());
    const t = makeToken();
    const p = v.verify(t);
    expect(p.sub).toBe('c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570');
    expect(p.appCode).toBe('tpi-acm');
    expect(p.scope).toBe('custom_app:context');
  });

  it('TC-UNIT-01b: rejects token signed with wrong secret', () => {
    const v = new AmaTokenVerifier(makeConfig());
    const t = makeToken({ signWith: 'different-secret-different-different' });
    expect(() => v.verify(t)).toThrow(AmaTokenVerifyException);
    try { v.verify(t); } catch (e) {
      expect((e as AmaTokenVerifyException).code).toBe('AMA_TOKEN_INVALID_SIGNATURE');
    }
  });

  it('TC-UNIT-02: rejects expired token', () => {
    const v = new AmaTokenVerifier(makeConfig());
    const t = makeToken({ ttlSec: -3600, iatOffsetSec: -7200 });
    try { v.verify(t); fail('expected throw'); } catch (e) {
      expect((e as AmaTokenVerifyException).code).toBe('AMA_TOKEN_EXPIRED');
    }
  });

  it('TC-UNIT-03: clock skew tolerance allows token within 30s of nbf/exp', () => {
    const v = new AmaTokenVerifier(makeConfig());
    // Token expired 10s ago — within 30s skew → still accepted.
    const t = makeToken({ ttlSec: 90, iatOffsetSec: -100 });
    const p = v.verify(t);
    expect(p.sub).toBeDefined();
  });

  it('TC-UNIT-04: appCode authorization is delegated to the gate, not the verifier (REQ-260609B)', () => {
    // The verifier no longer rejects unknown appCodes — authorization moved to
    // AmaConfigGateService (admin-configured amb_acm_ama_config). The verifier
    // only validates signature / claim presence / scope and passes appCode through.
    const v = new AmaTokenVerifier(makeConfig());
    const p = v.verify(makeToken({ appCode: 'some-other-app' }));
    expect(p.appCode).toBe('some-other-app');
  });

  it('TC-UNIT-05: rejects bad scope', () => {
    const v = new AmaTokenVerifier(makeConfig());
    const t = makeToken({ scope: 'wrong:scope' });
    try { v.verify(t); fail('expected throw'); } catch (e) {
      expect((e as AmaTokenVerifyException).code).toBe('AMA_TOKEN_SCOPE_INVALID');
    }
  });

  it('TC-UNIT-06: rejects missing required claims (entityId)', () => {
    const v = new AmaTokenVerifier(makeConfig());
    const now = Math.floor(Date.now() / 1000);
    const partial = jwt.sign(
      { sub: 'x', email: 'x@y', appCode: 'tpi-acm', scope: 'custom_app:context', iat: now, exp: now + 3600 },
      SECRET,
      { algorithm: 'HS256', noTimestamp: true },
    );
    try { v.verify(partial); fail('expected throw'); } catch (e) {
      expect((e as AmaTokenVerifyException).code).toBe('AMA_TOKEN_CLAIMS_MISSING');
    }
  });

  it('TC-UNIT-07: rejects malformed token (not parseable)', () => {
    const v = new AmaTokenVerifier(makeConfig());
    expect(() => v.verify('not-a-jwt')).toThrow(AmaTokenVerifyException);
  });

  it('disabled mode (no secret) → returns 503-equivalent error code on verify()', () => {
    const v = new AmaTokenVerifier(makeConfig({ AMA_JWT_SECRET: '' }));
    expect(v.isEnabled()).toBe(false);
    try { v.verify('anything'); fail('expected throw'); } catch (e) {
      expect((e as AmaTokenVerifyException).code).toBe('AMA_TOKEN_INVALID_SIGNATURE');
    }
  });

  it('accepts any appCode regardless of env (env whitelist removed — gate is authoritative)', () => {
    const v = new AmaTokenVerifier(makeConfig());
    expect(() => v.verify(makeToken({ appCode: 'arbitrary-app' }))).not.toThrow();
  });
});
