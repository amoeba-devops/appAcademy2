import { generateKeyPairSync, createVerify } from 'crypto';
import { Ga4DataClient, parseServiceAccountKey } from './ga4-data.client';

/** PLN-260912 — JWT assertion + runReport parsing (fetch mocked). */
describe('Ga4DataClient', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const key = parseServiceAccountKey(
    JSON.stringify({
      type: 'service_account',
      client_email: 'acm-ga4@proj.iam.gserviceaccount.com',
      private_key: pem,
      token_uri: 'https://oauth2.googleapis.com/token',
    }),
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parseServiceAccountKey rejects invalid JSON / missing fields', () => {
    expect(() => parseServiceAccountKey('nope')).toThrow(
      'GA4_SA_KEY_INVALID_JSON',
    );
    expect(() => parseServiceAccountKey('{"client_email":"a"}')).toThrow(
      'GA4_SA_KEY_MISSING_FIELDS',
    );
  });

  it('builds an RS256 JWT assertion with the analytics.readonly scope', () => {
    const client = new Ga4DataClient();
    const jwt = client.buildAssertion(key, 1_700_000_000);
    const [h, c, s] = jwt.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64url').toString());
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims.iss).toBe(key.client_email);
    expect(claims.scope).toBe(
      'https://www.googleapis.com/auth/analytics.readonly',
    );
    expect(claims.exp - claims.iat).toBe(3600);
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);
  });

  it('runReport maps date×streamId rows and caches the access token', async () => {
    const client = new Ga4DataClient();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('oauth2.googleapis.com')) {
          return new Response(
            JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            rows: [
              {
                dimensionValues: [{ value: '20260911' }, { value: '111' }],
                metricValues: [
                  { value: '149' },
                  { value: '160' },
                  { value: '170' },
                ],
              },
              {
                dimensionValues: [{ value: '20260911' }, { value: '222' }],
                metricValues: [
                  { value: '201' },
                  { value: '210' },
                  { value: '300' },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      });

    const rows = await client.runReport(key, {
      propertyId: '123',
      startDate: '2026-09-11',
      endDate: '2026-09-11',
      metrics: ['activeUsers', 'sessions', 'screenPageViews'],
    });
    expect(rows).toEqual([
      {
        date: '2026-09-11',
        streamId: '111',
        metrics: { activeUsers: 149, sessions: 160, screenPageViews: 170 },
      },
      {
        date: '2026-09-11',
        streamId: '222',
        metrics: { activeUsers: 201, sessions: 210, screenPageViews: 300 },
      },
    ]);
    // report call carried the bearer token and the property path
    const reportCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('analyticsdata'),
    );
    expect(String(reportCall?.[0])).toContain('/properties/123:runReport');
    expect((reportCall?.[1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer tok',
    });

    // second call reuses the cached token (no extra token exchange)
    await client.runReport(key, {
      propertyId: '123',
      startDate: '2026-09-11',
      endDate: '2026-09-11',
      metrics: ['activeUsers'],
    });
    const tokenCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('oauth2'),
    ).length;
    expect(tokenCalls).toBe(1);
  });

  it('runReport surfaces a 403 without retrying', async () => {
    const client = new Ga4DataClient();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (url) => {
        if (String(url).includes('oauth2')) {
          return new Response(
            JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
            { status: 200 },
          );
        }
        return new Response('permission denied', { status: 403 });
      });
    await expect(
      client.runReport(key, {
        propertyId: '1',
        startDate: '2026-09-01',
        endDate: '2026-09-02',
        metrics: ['activeUsers'],
      }),
    ).rejects.toThrow('GA4_REPORT_FAILED 403');
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes('analyticsdata'))
        .length,
    ).toBe(1);
  });
});
