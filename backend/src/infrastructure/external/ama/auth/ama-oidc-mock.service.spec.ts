import { AmaOidcMockService } from './ama-oidc-mock.service';

describe('AmaOidcMockService', () => {
  const svc = new AmaOidcMockService();

  describe('buildAuthorizeUrl', () => {
    it('embeds state and code into redirect URL', () => {
      const url = svc.buildAuthorizeUrl({
        state: 'st-abc',
        codeChallenge: 'cc-xyz',
        redirectUri: 'http://localhost:4009/api/auth/ama/callback',
      });
      const parsed = new URL(url);
      expect(parsed.searchParams.get('state')).toBe('st-abc');
      expect(parsed.searchParams.get('code')).toBe('mock-code-st-abc');
    });
  });

  describe('exchangeCode', () => {
    it('returns mock tokens with default sub', async () => {
      delete process.env.AMA_MOCK_SUB;
      const res = await svc.exchangeCode({
        code: 'mock-code-x',
        codeVerifier: 'v',
        redirectUri: 'r',
      });
      expect(res.tokenType).toBe('Bearer');
      expect(res.accessToken).toBe('mock-access-ama-user-001');
      expect(res.idToken).toBe('mock-id-ama-user-001');
      expect(res.expiresIn).toBe(3600);
    });

    it('honors AMA_MOCK_SUB override', async () => {
      process.env.AMA_MOCK_SUB = 'ama-user-test-9';
      try {
        const res = await svc.exchangeCode({
          code: 'c',
          codeVerifier: 'v',
          redirectUri: 'r',
        });
        expect(res.accessToken).toBe('mock-access-ama-user-test-9');
      } finally {
        delete process.env.AMA_MOCK_SUB;
      }
    });
  });

  describe('fetchUserInfo', () => {
    it('parses sub from access token', async () => {
      const info = await svc.fetchUserInfo('mock-access-foo-1');
      expect(info.sub).toBe('foo-1');
      expect(info.email).toBe('foo-1@mock.amoeba.site');
      expect(info.name).toContain('foo-1');
      expect(info.tenantMemberships).toEqual([]);
    });

    it('falls back to default sub for unrecognized token', async () => {
      const info = await svc.fetchUserInfo('opaque');
      expect(info.sub).toBe('ama-user-001');
    });
  });
});
