import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261019B — 접속 환경별 로그인 유지 시간: 설치한 앱(X-ACM-Client: pwa) 8시간, 그 외 4시간.
 */
describe('IT-SESSION-TTL login token lifetime by client', () => {
  let env: AcmTestEnv;
  beforeAll(async () => {
    env = await bootAcmTestEnv();
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const login = (client?: string) => {
    const req = request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: 'admin@tpi.co.kr', password: 'acm20261234' });
    return (client ? req.set('X-ACM-Client', client) : req).expect(200);
  };
  const hours = (token: string) => {
    const p = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { iat: number; exp: number };
    return (p.exp - p.iat) / 3600;
  };

  it('issues 8h for the installed app, 4h for browsers and when the header is missing', async () => {
    expect(hours((await login('pwa')).body.accessToken)).toBe(8);
    expect(hours((await login('PWA')).body.accessToken)).toBe(8);
    expect(hours((await login('web')).body.accessToken)).toBe(4);
    expect(hours((await login()).body.accessToken)).toBe(4);
    expect(hours((await login('something-else')).body.accessToken)).toBe(4);
  });

  it('keeps tokens of concurrent requests separate', async () => {
    const [a, b] = await Promise.all([login('pwa'), login('web')]);
    expect(hours(a.body.accessToken)).toBe(8);
    expect(hours(b.body.accessToken)).toBe(4);
  });
});
