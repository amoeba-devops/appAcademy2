import { BadRequestException } from '@nestjs/common';
import {
  interpretTokenProbe,
  validateGoogleApp,
} from './google-app-config.service';

// REQ-261016B — 형식 검증과 연결 확인 판정.
const ok = {
  clientId: '123456789012-abcdefghijklmnop.apps.googleusercontent.com',
  clientSecret: 'GOCSPX-abcdefghijklmnopqrstu',
  redirectUri: 'https://acm.amoeba.site/api/acm/prj/drive/callback',
  pickerKey: 'AIza' + 'a'.repeat(35),
  projectNumber: '123456789012',
};

describe('validateGoogleApp', () => {
  it('accepts well-formed values and a kept secret', () => {
    expect(() => validateGoogleApp(ok, false)).not.toThrow();
    expect(() =>
      validateGoogleApp({ ...ok, clientSecret: '' }, true),
    ).not.toThrow();
    expect(() =>
      validateGoogleApp(
        {
          ...ok,
          redirectUri: 'http://localhost:4009/api/acm/prj/drive/callback',
        },
        false,
      ),
    ).not.toThrow();
  });
  it.each([
    ['clientId', { clientId: 'abc' }],
    ['clientSecret', { clientSecret: '' }],
    [
      'redirectUri',
      { redirectUri: 'http://acm.amoeba.site/api/acm/prj/drive/callback' },
    ],
    ['redirectUri', { redirectUri: 'https://evil.example/other' }],
    ['pickerKey', { pickerKey: 'not-a-key' }],
    ['projectNumber', { projectNumber: 'abc' }],
  ])('rejects invalid %s', (field, patch) => {
    try {
      validateGoogleApp({ ...ok, ...patch }, false);
      throw new Error('expected failure');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect(
        JSON.stringify((e as BadRequestException).getResponse()),
      ).toContain(field);
    }
  });
});

describe('interpretTokenProbe', () => {
  it('maps Google token errors', () => {
    expect(interpretTokenProbe(400, 'invalid_grant')).toEqual({
      ok: true,
      code: 'OK',
    });
    expect(interpretTokenProbe(401, 'invalid_client').code).toBe(
      'INVALID_CLIENT',
    );
    expect(interpretTokenProbe(400, 'redirect_uri_mismatch').code).toBe(
      'REDIRECT_MISMATCH',
    );
    expect(interpretTokenProbe(503).code).toBe('GOOGLE_UNAVAILABLE');
  });
});
