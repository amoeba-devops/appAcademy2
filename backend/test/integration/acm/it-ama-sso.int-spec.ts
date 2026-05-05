import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * IT-AMA-SSO — POST /api/acm/auth/ama-exchange + regression for legacy login.
 *
 * Covers:
 *   TC-INT-01..10  (AMA exchange happy + error paths)
 *   TC-REG-01..07  (legacy email/password login backward compatibility)
 *
 * @see docs/test/TC-260505-acm-ama-sso.md
 */

const AMA_SECRET = 'dev-acm-ama-secret-change-me-32bytes-for-tests';
const SEED_EMAIL = 'admin@tpi.co.kr';
const SEED_PASSWORD = 'acm20261234';
const SEED_ENT_ID = '00000000-0000-0000-0000-000000000001';

interface MakeTokenOpts {
  sub?: string;
  email?: string;
  role?: string;
  entityId?: string;
  appId?: string;
  appCode?: string;
  scope?: string;
  ttlSec?: number;
  iatOffsetSec?: number;
  signWith?: string;
  algorithm?: jwt.Algorithm;
}

function makeAmaToken(o: MakeTokenOpts = {}): string {
  const now = Math.floor(Date.now() / 1000) + (o.iatOffsetSec ?? 0);
  return jwt.sign(
    {
      sub: o.sub ?? 'c31e3cc1-c8c2-4a9a-8dbb-c0c39d6b6570',
      email: o.email ?? 'fremd@naver.com',
      role: o.role ?? 'MASTER',
      entityId: o.entityId ?? '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
      appId: o.appId ?? '15b69898-7828-4072-9892-a2f7bea1eb57',
      appCode: o.appCode ?? 'tpi-acm',
      scope: o.scope ?? 'custom_app:context',
      iat: now,
      exp: now + (o.ttlSec ?? 3600),
    },
    o.signWith ?? AMA_SECRET,
    { algorithm: o.algorithm ?? 'HS256' },
  );
}

function decodeAcmJwt(token: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
  );
}

describe('IT-AMA-SSO ama-exchange + legacy login regression', () => {
  let env: AcmTestEnv;

  beforeAll(async () => {
    env = await bootAcmTestEnv();
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('TC-INT-01: valid token → 200, JWT issued, AMA user upserted', async () => {
    const token = makeAmaToken({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'newuser@example.com',
      entityId: '22222222-2222-2222-2222-222222222222',
    });
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe('newuser@example.com');
    expect(res.body.user.entId).toBe('22222222-2222-2222-2222-222222222222');
    expect(res.body.user.authSource).toBe('ama');

    // ACM JWT payload sanity (FR-AMA-30/31/32)
    const payload = decodeAcmJwt(res.body.accessToken);
    expect(payload.email).toBe('newuser@example.com');
    expect(payload.entId).toBe('22222222-2222-2222-2222-222222222222');
    expect(payload.sub).toBe(res.body.user.id);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // DB row created with auth_source='ama' + ama_user_id mapped
    const rows = await env.ds.query(
      `SELECT auth_source, ama_user_id, ama_entity_id, usr_password_hash
         FROM amb_acm_user WHERE usr_email='newuser@example.com'`,
    );
    expect(rows[0].auth_source).toBe('ama');
    expect(rows[0].ama_user_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(rows[0].ama_entity_id).toBe('22222222-2222-2222-2222-222222222222');
    expect(rows[0].usr_password_hash).toBeNull();
  });

  it('TC-INT-05: re-entry → same acm user (idempotent upsert)', async () => {
    const token = makeAmaToken({
      sub: '11111111-1111-1111-1111-111111111111',
      email: 'newuser@example.com',
      entityId: '22222222-2222-2222-2222-222222222222',
    });
    const r1 = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(200);
    const r2 = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(200);
    expect(r1.body.user.id).toBe(r2.body.user.id);
  });

  it('TC-INT-06: email change in AMA → synced to ACM user', async () => {
    const sub = '33333333-3333-3333-3333-333333333333';
    const ent = '44444444-4444-4444-4444-444444444444';
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: makeAmaToken({ sub, email: 'old@x.com', entityId: ent }) })
      .expect(200);
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: makeAmaToken({ sub, email: 'new@x.com', entityId: ent }) })
      .expect(200);
    const rows = await env.ds.query(
      `SELECT usr_email FROM amb_acm_user WHERE ama_user_id=$1`,
      [sub],
    );
    expect(rows[0].usr_email).toBe('new@x.com');
  });

  it('TC-INT-07: same email, different entityId → separate users (multi-tenancy)', async () => {
    const r1 = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({
        amaToken: makeAmaToken({
          sub: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          email: 'shared@x.com',
          entityId: '55555555-5555-5555-5555-555555555555',
        }),
      })
      .expect(200);
    const r2 = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({
        amaToken: makeAmaToken({
          sub: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          email: 'shared@x.com',
          entityId: '66666666-6666-6666-6666-666666666666',
        }),
      })
      .expect(200);
    expect(r1.body.user.id).not.toBe(r2.body.user.id);
    expect(r1.body.user.entId).toBe('55555555-5555-5555-5555-555555555555');
    expect(r2.body.user.entId).toBe('66666666-6666-6666-6666-666666666666');
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  it('TC-INT-02: expired token → 401 AMA_TOKEN_EXPIRED', async () => {
    const token = makeAmaToken({ ttlSec: -3600, iatOffsetSec: -7200 });
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(401);
    expect(res.body.code).toBe('AMA_TOKEN_EXPIRED');
  });

  it('TC-INT-03: forged signature → 401 AMA_TOKEN_INVALID_SIGNATURE', async () => {
    const token = makeAmaToken({ signWith: 'wrong-secret-wrong-secret-wrong' });
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(401);
    expect(res.body.code).toBe('AMA_TOKEN_INVALID_SIGNATURE');
  });

  it('TC-INT-04: unknown appCode → 403 AMA_TOKEN_APP_CODE_INVALID', async () => {
    const token = makeAmaToken({ appCode: 'other-app' });
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token })
      .expect(403);
    expect(res.body.code).toBe('AMA_TOKEN_APP_CODE_INVALID');
  });

  it('TC-INT-08: DTO validation rejects missing/short amaToken (400)', async () => {
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({})
      .expect(400);
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: 'short' })
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // Backward compatibility — TC-REG-01..07 (FR-AMA-60..64)
  // ---------------------------------------------------------------------------

  it('TC-REG-01: legacy POST /api/acm/auth/login still returns JWT', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe(SEED_EMAIL);
    expect(res.body.user.entId).toBe(SEED_ENT_ID);
  });

  it('TC-REG-02: legacy login with wrong password → 401', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password: 'wrong-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('TC-REG-06: AMA-provisioned user cannot self-login (no password hash)', async () => {
    // Pre-create via AMA exchange.
    await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({
        amaToken: makeAmaToken({
          sub: '99999999-9999-9999-9999-999999999999',
          email: 'amaonly@example.com',
          entityId: '88888888-8888-8888-8888-888888888888',
        }),
      })
      .expect(200);
    // Then try legacy login.
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: 'amaonly@example.com', password: 'anything12' })
      .expect(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('TC-REG-07: ACM JWT payload identical between login and ama-exchange paths', async () => {
    const loginRes = await request(env.app.getHttpServer())
      .post('/api/acm/auth/login')
      .send({ email: SEED_EMAIL, password: SEED_PASSWORD })
      .expect(200);
    const exchangeRes = await request(env.app.getHttpServer())
      .post('/api/acm/auth/ama-exchange')
      .send({
        amaToken: makeAmaToken({
          sub: '77777777-7777-7777-7777-777777777777',
          email: 'reg07@example.com',
          entityId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
        }),
      })
      .expect(200);

    const a = decodeAcmJwt(loginRes.body.accessToken);
    const b = decodeAcmJwt(exchangeRes.body.accessToken);
    // Same key set
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    // Required keys present
    for (const k of ['sub', 'entId', 'email', 'name', 'iat', 'exp']) {
      expect(a[k]).toBeDefined();
      expect(b[k]).toBeDefined();
    }
  });
});
