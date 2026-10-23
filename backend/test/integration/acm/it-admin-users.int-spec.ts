import { randomUUID } from 'node:crypto';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261024 Part 2 — 서비스 설정 > 관리자 관리: permissions, edit rules, passwords,
 * AMA → local switch that survives a later AMA login, and the new delete permission.
 */
describe('IT-ADMIN-USERS admin user management', () => {
  let env: AcmTestEnv;
  let master: { id: string; entId: string };
  const AMA_SECRET = 'dev-acm-ama-secret-change-me-32bytes-for-tests';
  const STAFF_EMAIL = 'ama-staff@it.test';
  const STAFF_SUB = randomUUID();
  const PLAIN_ID = randomUUID();
  let staffId = '';

  const token = (role = 'MEMBER') => {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        sub: STAFF_SUB,
        email: STAFF_EMAIL,
        role,
        entityId: '928f5fe4-12ab-4113-b9b9-d8d455ca4e3b',
        appId: '15b69898-7828-4072-9892-a2f7bea1eb57',
        appCode: 'tpi-acm',
        scope: 'custom_app:context',
        iat: now,
        exp: now + 3600,
      },
      AMA_SECRET,
      { algorithm: 'HS256' },
    );
  };
  const http = () => request(env.app.getHttpServer());
  const as = (id: string, role = 'ADMIN') => ({
    'x-test-user': id,
    'x-test-ent': master.entId,
    'x-test-role': role,
  });
  const row = async (id: string) =>
    (
      await env.ds.query(
        `SELECT auth_source a, usr_local_pinned p, usr_role r, usr_name n, (usr_password_hash IS NOT NULL) pw FROM amb_acm_user WHERE usr_id=$1`,
        [id],
      )
    )[0] as { a: string; p: boolean; r: string; n: string; pw: boolean };

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    [master] = await env.ds.query(
      `SELECT usr_id id, ent_id "entId" FROM amb_acm_user WHERE usr_email='admin@tpi.co.kr'`,
    );
    // Like production: AMA entity 928f… is the seed tenant …0001 (this spec has its own container).
    await env.ds.query(
      `DELETE FROM amb_acm_ama_config WHERE amc_ama_entity_id='928f5fe4-12ab-4113-b9b9-d8d455ca4e3b'`,
    );
    await env.ds.query(
      `INSERT INTO amb_acm_ama_config (ent_id, amc_ama_entity_id, amc_app_code, amc_is_active) VALUES ($1,'928f5fe4-12ab-4113-b9b9-d8d455ca4e3b','tpi-acm',TRUE)
       ON CONFLICT (ent_id) DO UPDATE SET amc_ama_entity_id=EXCLUDED.amc_ama_entity_id, amc_app_code='tpi-acm', amc_is_active=TRUE`,
      [master.entId],
    );
    const sso = await http()
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token() })
      .expect(200);
    staffId = sso.body.user.id;
    expect(sso.body.user.entId).toBe(master.entId);
    await env.ds.query(
      `INSERT INTO amb_acm_user (usr_id, ent_id, usr_email, usr_name, usr_status, usr_role) VALUES ($1,$2,'plain-admin2@it.test','Plain','ACTIVE','ADMIN')`,
      [PLAIN_ID, master.entId],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission) VALUES ($1,$2,'CONFIG_ADMIN') ON CONFLICT DO NOTHING`,
      [master.entId, master.id],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('is for service operators only and lists admins and staff', async () => {
    await http().get('/api/acm/config/admins').set(as(PLAIN_ID)).expect(403);
    const list = await http()
      .get('/api/acm/config/admins')
      .set(as(master.id))
      .expect(200);
    const roles = new Set((list.body as { role: string }[]).map((u) => u.role));
    expect([...roles].every((r) => r === 'ADMIN' || r === 'STAFF')).toBe(true);
    const staff = (
      list.body as { id: string; authSource: string; hasPassword: boolean }[]
    ).find((u) => u.id === staffId);
    expect(staff).toMatchObject({ authSource: 'ama', hasPassword: false });
  });

  it('blocks self-demotion and protects the tenant master', async () => {
    await http()
      .patch(`/api/acm/config/admins/${master.id}`)
      .set(as(master.id))
      .send({ role: 'STAFF' })
      .expect(403);
    await http()
      .patch(`/api/acm/config/admins/${master.id}`)
      .set(as(master.id))
      .send({ status: 'INACTIVE' })
      .expect(403);
    await http()
      .post(`/api/acm/config/admins/${master.id}/lock`)
      .set(as(master.id))
      .expect(403);
  });

  it('switches AMA → local with a temporary password, and an AMA login keeps it local', async () => {
    const sw = await http()
      .post('/api/acm/config/admins/switch-local')
      .set(as(master.id))
      .send({ ids: [staffId] })
      .expect(200);
    const res = sw.body.results[0];
    expect(res).toMatchObject({ id: staffId, switched: true });
    expect(res.temp.tempPassword).toBeTruthy(); // no SMTP in tests → shown once
    expect(await row(staffId)).toMatchObject({ a: 'local', p: true, pw: true });

    const login = await http()
      .post('/api/acm/auth/login')
      .send({ email: STAFF_EMAIL, password: res.temp.tempPassword })
      .expect(200);
    expect(login.body.user).toMatchObject({
      authSource: 'local',
      mustChangePassword: true,
    });

    // Admin edits grade/name in ACM; a later AMA login must not undo either.
    await http()
      .patch(`/api/acm/config/admins/${staffId}`)
      .set(as(master.id))
      .send({ role: 'ADMIN', name: '직원A' })
      .expect(200);
    const again = await http()
      .post('/api/acm/auth/ama-exchange')
      .send({ amaToken: token('MEMBER') })
      .expect(200);
    expect(again.body.user.authSource).toBe('local');
    expect(await row(staffId)).toMatchObject({
      a: 'local',
      p: true,
      r: 'ADMIN',
      n: '직원A',
    });
  });

  it('sets a password that works at login', async () => {
    await http()
      .put(`/api/acm/config/admins/${staffId}/password`)
      .set(as(master.id))
      .send({ password: 'short' })
      .expect(400);
    await http()
      .put(`/api/acm/config/admins/${staffId}/password`)
      .set(as(master.id))
      .send({ password: 'NewPass2026', mustChange: false })
      .expect(200);
    const login = await http()
      .post('/api/acm/auth/login')
      .send({ email: STAFF_EMAIL, password: 'NewPass2026' })
      .expect(200);
    expect(login.body.user.mustChangePassword).toBe(false);
    const [log] = await env.ds.query(
      `SELECT aal_reason r FROM amb_acm_aud_access_log WHERE aal_actor_id=$1 AND aal_event='PASSWORD_CHANGED' ORDER BY created_at DESC LIMIT 1`,
      [staffId],
    );
    expect(log.r).toBe('ADMIN');
  });

  it('allows consultation delete for admin + service operator only (not by AMA link)', async () => {
    const missing = randomUUID();
    const denied = await http()
      .delete(`/api/acm/csl/inquiries/${missing}`)
      .set(as(PLAIN_ID));
    expect(denied.status).toBe(403);
    const allowed = await http()
      .delete(`/api/acm/csl/inquiries/${missing}`)
      .set(as(master.id));
    expect(allowed.status).not.toBe(403);
    const access = await http()
      .get('/api/acm/me/config-access')
      .set(as(master.id))
      .expect(200);
    expect(access.body.canDeleteRecords).toBe(true);
  });
});
