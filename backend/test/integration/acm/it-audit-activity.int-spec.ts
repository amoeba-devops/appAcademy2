import request from 'supertest';
import { AcmStdModule } from '../../../src/modules/acm-std/acm-std.module';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/**
 * PLN-261022 (REQ-261021B P2) — activity log: automatic write capture, label snapshot,
 * field names without values, guard denials, marked reads, downloads, permissions.
 */
describe('IT-AUDIT-ACTIVITY activity log', () => {
  let env: AcmTestEnv;
  let admin: { id: string; entId: string };
  const VIEWER_ID = '00000000-0000-4000-8000-0000000a0d18';
  const PLAIN_ADMIN_ID = '00000000-0000-4000-8000-0000000a0d19';
  const nameOf = async (id: string) =>
    (
      (await env.ds.query(
        `SELECT std_name n FROM amb_acm_std_student WHERE std_id=$1`,
        [id],
      )) as { n: string }[]
    )[0].n;

  beforeAll(async () => {
    env = await bootAcmTestEnv([AcmStdModule]);
    [admin] = await env.ds.query(
      `SELECT usr_id id, ent_id "entId" FROM amb_acm_user WHERE usr_email='admin@tpi.co.kr'`,
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user (usr_id, ent_id, usr_email, usr_name, usr_status, usr_role)
       VALUES ($1, $3, 'viewer2@it.test', 'Viewer2', 'ACTIVE', 'STAFF'),
             ($2, $3, 'plain-admin@it.test', 'PlainAdmin', 'ACTIVE', 'ADMIN')`,
      [VIEWER_ID, PLAIN_ADMIN_ID, admin.entId],
    );
    await env.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission) VALUES ($1, $2, 'AUDIT_VIEWER')`,
      [admin.entId, VIEWER_ID],
    );
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  const http = () => request(env.app.getHttpServer());
  const as = (userId: string, role = 'ADMIN') => ({
    'x-test-user': userId,
    'x-test-ent': admin.entId,
    'x-test-role': role,
    'X-Forwarded-For': '6.6.6.6, 198.51.100.9, 172.18.0.1',
  });
  /** Rows are written when the response finishes — give the async insert a moment. */
  const rows = async (where: string, params: unknown[]) => {
    await new Promise((r) => setTimeout(r, 150));
    return env.ds.query<
      {
        action: string;
        menu: string;
        type: string;
        target: string;
        label: string | null;
        fields: string | null;
        result: string;
        status: number;
        ip: string;
        path: string;
      }[]
    >(
      `SELECT adl_action action, adl_menu menu, adl_entity_type type, adl_entity_id target, adl_target_label label,
              adl_field_name fields, adl_result result, adl_http_status status, adl_ip ip, adl_http_path path
         FROM amb_acm_audit_log WHERE ent_id=$1 AND ${where} ORDER BY created_at, adl_id`,
      [admin.entId, ...params],
    );
  };
  let studentId = '';

  it('records a create with the new id and label, and an update with field names only', async () => {
    const created = await http()
      .post('/api/acm/std/students')
      .set(as(admin.id))
      .send({ stdSite: 'TPI', stdName: '감사테스트학생' })
      .expect(201);
    studentId = created.body.id ?? created.body.data?.id ?? created.body.stdId;
    expect(studentId).toBeTruthy();
    const [c] = await rows(`adl_action='CREATE' AND adl_menu='std'`, []);
    expect(c).toMatchObject({
      target: studentId,
      label: '감사테스트학생',
      result: 'SUCCESS',
      ip: '198.51.100.9',
    });
    expect(c.fields).toBe('stdSite,stdName');

    await http()
      .put(`/api/acm/std/students/${studentId}`)
      .set(as(admin.id))
      .send({ stdName: '감사테스트학생2', stdSite: 'TPI' })
      .expect(200);
    const u = (
      await rows(`adl_action='UPDATE' AND adl_entity_id=$2`, [studentId])
    ).at(-1)!;
    // Label is the name before the change.
    expect(u).toMatchObject({
      type: 'student',
      label: '감사테스트학생',
      fields: 'stdName,stdSite',
    });
    // Values are never stored.
    const [raw] = await env.ds.query(
      `SELECT count(*)::int n FROM amb_acm_audit_log WHERE adl_new_value LIKE '%감사테스트학생2%' OR adl_old_value LIKE '%감사테스트학생2%'`,
    );
    expect(raw.n).toBe(0);
  });

  it('records marked personal-data reads but not ordinary lists', async () => {
    await http()
      .get(`/api/acm/std/students/${studentId}`)
      .set(as(admin.id))
      .expect(200);
    await http().get('/api/acm/std/students').set(as(admin.id)).expect(200);
    const r = await rows(`adl_action='READ'`, []);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      type: 'student',
      target: studentId,
      label: await nameOf(studentId),
    });
  });

  it('records a denial inside the handler, then keeps the label after deletion', async () => {
    // REQ-261024 — archiving needs admin + service operator/tenant master: a plain admin → 403 from the service.
    await http()
      .delete(`/api/acm/std/students/${studentId}`)
      .set(as(PLAIN_ADMIN_ID))
      .expect(403);
    const denied = (
      await rows(`adl_action='DELETE' AND adl_entity_id=$2`, [studentId])
    ).at(-1)!;
    expect(denied).toMatchObject({
      result: 'DENIED',
      status: 403,
      label: await nameOf(studentId),
    });

    // The seed admin is the tenant master → allowed (no AMA link needed any more).
    const name = await nameOf(studentId);
    await http()
      .delete(`/api/acm/std/students/${studentId}`)
      .set(as(admin.id))
      .expect(200);
    const d = (
      await rows(`adl_action='DELETE' AND adl_entity_id=$2`, [studentId])
    ).at(-1)!;
    expect(d).toMatchObject({ label: name, result: 'SUCCESS' });
  });

  it('records a guard denial (runs before interceptors) as DENIED', async () => {
    await http()
      .patch('/api/acm/std/students/sites')
      .set(as(admin.id, 'STAFF'))
      .send({ items: [] })
      .expect(403);
    const d = (await rows(`adl_http_path='/acm/std/students/sites'`, [])).at(
      -1,
    )!;
    expect(d).toMatchObject({
      action: 'UPDATE',
      result: 'DENIED',
      status: 403,
    });
  });

  it('records file downloads through the safety net and hints', async () => {
    await http()
      .get('/api/acm/std/students/template')
      .set(as(admin.id))
      .expect(200);
    const d = (await rows(`adl_action='DOWNLOAD'`, [])).at(-1)!;
    expect(d).toMatchObject({ type: 'student-template', menu: 'std' });
  });

  it('does not record logins in the activity log', async () => {
    await http()
      .post('/api/acm/auth/login')
      .send({ email: 'admin@tpi.co.kr', password: 'acm20261234' })
      .expect(200);
    expect(await rows(`adl_http_path LIKE '/acm/auth%'`, [])).toHaveLength(0);
  });

  it('serves the activity log to audit viewers only and records client downloads', async () => {
    const today = new Date()
      .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      .slice(0, 10);
    await http()
      .get(`/api/acm/audit/activity-logs?from=${today}&to=${today}`)
      .set(as(PLAIN_ADMIN_ID))
      .expect(403);
    const list = await http()
      .get(
        `/api/acm/audit/activity-logs?from=${today}&to=${today}&targetType=student&targetId=${studentId}`,
      )
      .set(as(VIEWER_ID, 'STAFF'))
      .expect(200);
    expect(
      list.body.rows.map(
        (r: { action: string; result: string }) => `${r.action}:${r.result}`,
      ),
    ).toEqual([
      'DELETE:SUCCESS',
      'DELETE:DENIED',
      'READ:SUCCESS',
      'UPDATE:SUCCESS',
      'CREATE:SUCCESS',
    ]);
    await http()
      .get('/api/acm/audit/activity-logs/summary')
      .set(as(VIEWER_ID, 'STAFF'))
      .expect(200);

    await http()
      .post('/api/acm/audit/client-download')
      .set(as(admin.id))
      .send({ kind: 'dashboard-csv', label: 'dashboard.csv' })
      .expect(204);
    const c = (await rows(`adl_entity_type='dashboard-csv'`, [])).at(-1)!;
    expect(c).toMatchObject({ action: 'DOWNLOAD', label: 'dashboard.csv' });

    const csv = await http()
      .get(`/api/acm/audit/activity-logs/export.csv?from=${today}&to=${today}`)
      .set(as(VIEWER_ID, 'STAFF'))
      .expect(200);
    expect(csv.text.split('\r\n')[0]).toContain('행위자');
    expect(
      await rows(`adl_entity_type='activity-log-export'`, []),
    ).toHaveLength(1);
  });
});
