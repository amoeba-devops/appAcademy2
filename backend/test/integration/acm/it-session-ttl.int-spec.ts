import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261019B → PLN-261027 — login session length:
 * - mobile (installed app `X-ACM-Client: pwa` or phone/tablet User-Agent): 30 days, renewed by /refresh
 * - PC/browser + "keep me signed in": the tenant's setting (1–48h, default 4)
 * - PC/browser without it: 4 hours
 */
describe('IT-SESSION-TTL login token lifetime', () => {
  let env: AcmTestEnv;
  let master: { id: string; entId: string };
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 Safari/605.1.15';
  beforeAll(async () => {
    env = await bootAcmTestEnv();
    [master] = await env.ds.query(
      `SELECT usr_id id, ent_id "entId" FROM amb_acm_user WHERE usr_email='admin@tpi.co.kr'`,
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission) VALUES ($1,$2,'CONFIG_ADMIN') ON CONFLICT DO NOTHING`,
      [master.entId, master.id],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const http = () => request(env.app.getHttpServer());
  const login = (
    o: { client?: string; ua?: string; remember?: boolean } = {},
  ) => {
    let req = http()
      .post('/api/acm/auth/login')
      .set('User-Agent', o.ua ?? MAC)
      .send({
        email: 'admin@tpi.co.kr',
        password: 'acm20261234',
        ...(o.remember ? { remember: true } : {}),
      });
    if (o.client) req = req.set('X-ACM-Client', o.client);
    return req.expect(200);
  };
  const hours = (token: string) => {
    const p = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { iat: number; exp: number };
    return (p.exp - p.iat) / 3600;
  };
  const as = () => ({
    'x-test-user': master.id,
    'x-test-ent': master.entId,
    'x-test-role': 'ADMIN',
  });

  it('keeps mobile signed in for 30 days (installed app or phone browser), ignoring the checkbox', async () => {
    expect(hours((await login({ client: 'pwa' })).body.accessToken)).toBe(720);
    expect(hours((await login({ client: 'PWA' })).body.accessToken)).toBe(720);
    expect(hours((await login({ ua: IPHONE })).body.accessToken)).toBe(720);
    expect(
      hours((await login({ ua: IPHONE, remember: true })).body.accessToken),
    ).toBe(720);
  });

  it('gives PC 4 hours, and the tenant setting only when "keep me signed in" is ticked', async () => {
    expect(hours((await login()).body.accessToken)).toBe(4);
    expect(
      hours((await login({ client: 'something-else' })).body.accessToken),
    ).toBe(4);
    expect(hours((await login({ remember: true })).body.accessToken)).toBe(4); // default setting = 4
    await http()
      .put('/api/acm/config/session')
      .set(as())
      .send({ hours: 49 })
      .expect(400);
    const saved = await http()
      .put('/api/acm/config/session')
      .set(as())
      .send({ hours: 48 })
      .expect(200);
    expect(saved.body).toMatchObject({
      hours: 48,
      isDefault: false,
      maxHours: 48,
    });
    expect(hours((await login({ remember: true })).body.accessToken)).toBe(48);
    expect(hours((await login()).body.accessToken)).toBe(4);
    const [log] = await env.ds.query(
      `SELECT aal_reason r FROM amb_acm_aud_access_log WHERE aal_actor_id=$1 AND aal_event='LOGIN' AND aal_result='SUCCESS' AND aal_reason IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [master.id],
    );
    expect(log.r).toBe('REMEMBER');
  });

  it('renews only on mobile', async () => {
    const pc = await http()
      .post('/api/acm/auth/refresh')
      .set(as())
      .set('User-Agent', MAC)
      .expect(200);
    expect(pc.body.accessToken).toBeNull();
    const phone = await http()
      .post('/api/acm/auth/refresh')
      .set(as())
      .set('User-Agent', IPHONE)
      .expect(200);
    expect(hours(phone.body.accessToken)).toBe(720);
  });

  it('keeps tokens of concurrent requests separate', async () => {
    const [a, b] = await Promise.all([
      login({ client: 'pwa' }),
      login({ client: 'web' }),
    ]);
    expect(hours(a.body.accessToken)).toBe(720);
    expect(hours(b.body.accessToken)).toBe(4);
  });
});
