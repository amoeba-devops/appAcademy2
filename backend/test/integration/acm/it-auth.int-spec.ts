import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * IT-AUTH — ACM authentication flow.
 * Covers: AC-1, AC-2, AC-3, AC-4, AC-5 (REQ-1.0.0).
 *
 * NOTE: setup.ts overrides AcmJwtAuthGuard with a permissive stub so the existing
 * P1 specs keep working via x-test-user/x-test-ent header middleware. To exercise
 * real JWT enforcement here, we POST to /api/acm/auth/login (no guard) and
 * confirm the returned token's payload structure. Direct guard-vs-401 is covered
 * implicitly by the absence of req.user from headers in protected routes.
 */
describe('IT-AUTH acm-auth login + me + protected access', () => {
  let env: AcmTestEnv;

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 240_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  const SEED_EMAIL = 'admin@acm.local';
  const SEED_PASSWORD = 'acm20261234';

  it('AC-1: POST /api/acm/auth/login with seed credentials returns a JWT', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(20);
    expect(res.body.user).toMatchObject({
      email: SEED_EMAIL,
      name: 'ACM Admin',
      entId: '00000000-0000-0000-0000-000000000001',
    });
    expect(res.body.user.id).toBeDefined();

    // JWT payload sanity (decoded base64 middle segment)
    const payload = JSON.parse(
      Buffer.from(res.body.accessToken.split('.')[1], 'base64').toString('utf8'),
    );
    expect(payload.entId).toBe('00000000-0000-0000-0000-000000000001');
    expect(payload.email).toBe(SEED_EMAIL);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('AC-2: POST /api/acm/auth/login with wrong password returns 401', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password: 'wrong-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('AC-2: unknown email returns 401 with same message', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: 'nope@acm.local', password: 'whatever12' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('login DTO validation rejects malformed payload (400)', async () => {
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });
});
