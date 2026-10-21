import request from 'supertest';
import { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * REQ-261021B P1 — access log, DB-backed login lockout (5 failures → 5 min), real client IP,
 * audit API permissions.
 */
describe('IT-AUDIT-ACCESS access log and lockout', () => {
  let env: AcmTestEnv;
  let admin: { id: string; entId: string };
  const SEED_EMAIL = 'admin@tpi.co.kr';
  const SEED_PASSWORD = 'acm20261234';
  const VIEWER_ID = '00000000-0000-4000-8000-0000000a0d17';
  // host nginx appends the client, container nginx appends host nginx: entry 2 from the end.
  const XFF = '6.6.6.6, 203.0.113.7, 172.18.0.1';

  beforeAll(async () => {
    env = await bootAcmTestEnv();
    [admin] = await env.ds.query(
      `SELECT usr_id id, ent_id "entId" FROM amb_acm_user WHERE usr_email=$1`,
      [SEED_EMAIL],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user (usr_id, ent_id, usr_email, usr_name, usr_status, usr_role)
       VALUES ($1, $2, 'viewer@it.test', 'Viewer', 'ACTIVE', 'STAFF')`,
      [VIEWER_ID, admin.entId],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission)
       VALUES ($1, $2, 'TENANT_MASTER'), ($1, $3, 'AUDIT_VIEWER')
       ON CONFLICT DO NOTHING`,
      [admin.entId, admin.id, VIEWER_ID],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const http = () => request(env.app.getHttpServer());
  // The test app has no GlobalExceptionFilter: accept both `{ error: {...} }` and Nest's default body.
  const err = (body: {
    error?: { code: string; details?: { retryAt: string } };
    code?: string;
    details?: { retryAt: string };
  }) => body.error ?? (body as { code: string; details: { retryAt: string } });
  const login = (password: string, email = SEED_EMAIL) =>
    http()
      .post('/api/acm/auth/login')
      .set('X-Forwarded-For', XFF)
      .send({ email, password });
  const as = (userId: string) => ({
    'x-test-user': userId,
    'x-test-ent': admin.entId,
  });
  const logs = (where = 'TRUE', params: unknown[] = []) =>
    env.ds.query<
      {
        event: string;
        result: string;
        reason: string | null;
        ip: string;
        loginId: string;
      }[]
    >(
      `SELECT aal_event event, aal_result result, aal_reason reason, aal_ip ip, aal_login_id "loginId"
         FROM amb_acm_aud_access_log WHERE ${where} ORDER BY created_at, aal_id`,
      params,
    );

  it('records a successful login with the real client IP', async () => {
    await login(SEED_PASSWORD).expect(200);
    const rows = await logs(`ent_id=$1 AND aal_actor_id=$2`, [
      admin.entId,
      admin.id,
    ]);
    expect(rows.at(-1)).toMatchObject({
      event: 'LOGIN',
      result: 'SUCCESS',
      ip: '203.0.113.7',
    });
  });

  it('locks after 5 consecutive failures for 5 minutes and keeps the lock in the DB', async () => {
    for (let i = 0; i < 4; i++) await login('wrong-password').expect(401);
    const fifth = await login('wrong-password').expect(429);
    expect(err(fifth.body).code).toBe('ACCOUNT_TEMP_LOCKED');
    const retryAt = Date.parse(err(fifth.body).details!.retryAt);
    expect(retryAt - Date.now()).toBeGreaterThan(4 * 60_000);
    expect(retryAt - Date.now()).toBeLessThanOrEqual(5 * 60_000 + 5_000);

    // Correct password is refused while locked.
    const blocked = await login(SEED_PASSWORD).expect(429);
    expect(err(blocked.body).code).toBe('ACCOUNT_TEMP_LOCKED');

    const rows = await logs(`ent_id=$1 AND aal_actor_id=$2`, [
      admin.entId,
      admin.id,
    ]);
    const tail = rows
      .slice(-7)
      .map((r) => `${r.event}:${r.result}:${r.reason ?? ''}`);
    expect(tail).toEqual([
      'LOGIN:FAILURE:BAD_PASSWORD',
      'LOGIN:FAILURE:BAD_PASSWORD',
      'LOGIN:FAILURE:BAD_PASSWORD',
      'LOGIN:FAILURE:BAD_PASSWORD',
      'LOGIN:FAILURE:BAD_PASSWORD',
      'LOCKED:SUCCESS:AUTO',
      'LOGIN:FAILURE:TEMP_LOCKED',
    ]);
  });

  it('lists the lock and lets the tenant master unlock it', async () => {
    const list = await http()
      .get('/api/acm/audit/locked-accounts')
      .set(as(admin.id))
      .expect(200);
    const lock = (
      list.body as Array<{ failureId: string; actorId: string; reason: string }>
    ).find((l) => l.actorId === admin.id);
    expect(lock).toMatchObject({ reason: 'AUTO' });
    await http()
      .post('/api/acm/audit/locked-accounts/unlock')
      .set(as(VIEWER_ID))
      .send({ kind: 'CONSOLE', actorId: admin.id, failureId: lock!.failureId })
      .expect(403);
    await http()
      .post('/api/acm/audit/locked-accounts/unlock')
      .set(as(admin.id))
      .send({ kind: 'CONSOLE', actorId: admin.id, failureId: lock!.failureId })
      .expect(200);
    await login(SEED_PASSWORD).expect(200);
  });

  it('logs unknown accounts under the system tenant with a masked login id', async () => {
    await login('wrong-password', 'nobody-here@example.com').expect(401);
    const rows = await logs(
      `ent_id='00000000-0000-0000-0000-0000000000ff' AND aal_reason='NO_ACCOUNT'`,
    );
    expect(rows.at(-1)?.loginId).toBe('no***@example.com');
  });

  it('rejects an admin-locked account token immediately (findById returns null)', async () => {
    const auth = env.app.get(AcmAuthService);
    await auth.lockUser(admin.id, admin.id);
    expect(await auth.findById(admin.id)).toBeNull();
    await auth.unlockUser(admin.id, admin.id);
    expect(await auth.findById(admin.id)).not.toBeNull();
    const rows = await logs(
      `ent_id=$1 AND aal_actor_id=$2 AND aal_event IN ('LOCKED','UNLOCKED')`,
      [admin.entId, admin.id],
    );
    expect(rows.slice(-2).map((r) => `${r.event}:${r.reason}`)).toEqual([
      'LOCKED:ADMIN',
      'UNLOCKED:ADMIN',
    ]);
  });

  it('enforces audit permissions and records CSV exports', async () => {
    const today = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      .slice(0, 10);
    await http()
      .get(`/api/acm/audit/access-logs?from=${today}&to=${today}`)
      .set(as('00000000-0000-4000-8000-00000000dead'))
      .expect(403);
    const list = await http()
      .get(
        `/api/acm/audit/access-logs?from=${today}&to=${today}&result=FAILURE`,
      )
      .set(as(VIEWER_ID))
      .expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(6);
    await http()
      .get('/api/acm/audit/access-logs/summary')
      .set(as(VIEWER_ID))
      .expect(200);
    await http()
      .put('/api/acm/audit/policy')
      .set(as(VIEWER_ID))
      .send({
        failMax: 5,
        lockMinutes: 5,
        ipFailMax: 20,
        ipWindowMinutes: 10,
        ipBlockMinutes: 10,
      })
      .expect(403);
    const saved = await http()
      .put('/api/acm/audit/policy')
      .set(as(admin.id))
      .send({
        failMax: 6,
        lockMinutes: 10,
        ipFailMax: 30,
        ipWindowMinutes: 10,
        ipBlockMinutes: 15,
      })
      .expect(200);
    expect(saved.body).toMatchObject({ failMax: 6, lockMinutes: 10 });

    const csv = await http()
      .get(`/api/acm/audit/access-logs/export.csv?from=${today}&to=${today}`)
      .set(as(VIEWER_ID))
      .expect(200);
    expect(csv.text.split('\r\n')[0]).toContain('일시(KST)');
    const [exp] = await env.ds.query(
      `SELECT count(*)::int n FROM amb_acm_audit_log WHERE ent_id=$1 AND adl_action='EXPORT' AND adl_entity_type='acm.aud.access_log'`,
      [admin.entId],
    );
    expect(exp.n).toBe(1);
  });

  it('keeps audit records append-only', async () => {
    await expect(
      env.ds.query(`DELETE FROM amb_acm_aud_access_log`),
    ).rejects.toThrow(/append-only/);
  });
});
