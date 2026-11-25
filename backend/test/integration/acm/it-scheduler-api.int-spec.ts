import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { bootAcmTestEnv, type AcmTestEnv } from './setup';
import { AcmIntegrationModule } from '../../../src/modules/acm-integration/acm-integration.module';
import { IntegrationAccessService } from '../../../src/modules/acm-integration/application/integration-access.service';
import { SCOPES } from '../../../src/modules/acm-integration/application/dto/scheduler.dto';
import { CalEventService } from '../../../src/modules/acm-cal/application/cal-event.service';
import { TeacherMeetingLinkService } from '../../../src/modules/acm-cal/application/teacher-meeting-link.service';
import { StudentLinkService } from '../../../src/modules/acm-cal/application/student-link.service';

const ENT = '00000000-0000-0000-0000-000000000001';
const OTHER = randomUUID();
describe('External scheduler API (real PostgreSQL + runtime HTTP contract)', () => {
  let env: AcmTestEnv,
    master: string,
    teacher: string,
    student: string,
    client: string,
    secret: string;
  let access: IntegrationAccessService;
  let portalToken: string;
  const headers = () => ({
    'x-test-user': master,
    'x-test-ent': ENT,
    'x-test-role': 'ADMIN',
  });
  const token = (key = secret) => ({ Authorization: `Bearer ${key}` });
  const lesson = (overrides: Record<string, unknown> = {}) => ({
    teacherEmail: 'teacher@fixture.test',
    students: [{ name: 'Guest demo' }],
    startsAt: '2026-12-01T10:00:00+09:00',
    endsAt: '2026-12-01T10:50:00+09:00',
    category: 'DEMO_CLASS',
    deliveryMode: 'ONSITE',
    ...overrides,
  });
  const write = (id: string, body = lesson(), key = randomUUID()) =>
    request(env.app.getHttpServer())
      .put(`/api/integrations/v1/lessons/external/${id}`)
      .set(token())
      .set('Idempotency-Key', key)
      .set('If-None-Match', '*')
      .send(body);
  const settings = (enabled = true, scopes: readonly string[] = SCOPES) =>
    request(env.app.getHttpServer())
      .put('/api/acm/integrations/settings')
      .set(headers())
      .send({ enabled, scopes });
  beforeAll(async () => {
    env = await bootAcmTestEnv([AcmIntegrationModule], {
      runtimeContract: true,
    });
    access = env.app.get(IntegrationAccessService);
    await env.ds.query(
      'INSERT INTO amb_acm_tenant(tnt_ent_id,tnt_name) VALUES($1,$2)',
      [OTHER, 'Other fixture'],
    );
    [{ id: master }] = await env.ds.query(
      `INSERT INTO amb_acm_user(ent_id,usr_email,usr_password_hash,usr_name,usr_role) VALUES($1,'master@fixture.test','fixture','Master','ADMIN') RETURNING usr_id AS id`,
      [ENT],
    );
    await env.ds.query(
      "INSERT INTO amb_acm_user_permission(ent_id,usr_id,upr_permission) VALUES($1,$2,'TENANT_MASTER')",
      [ENT, master],
    );
    [{ id: teacher }] = await env.ds.query(
      `INSERT INTO amb_acm_tch_teacher(ent_id,tch_name,tch_email) VALUES($1,'Fixture teacher','teacher@fixture.test') RETURNING tch_id AS id`,
      [ENT],
    );
    [{ id: student }] = await env.ds.query(
      `INSERT INTO amb_acm_std_student(ent_id,std_name) VALUES($1,'Registered student') RETURNING std_id AS id`,
      [ENT],
    );
    const [{ pac_id }] = await env.ds.query(
      `INSERT INTO amb_acm_portal_account(ent_id,pac_kind,pac_ref_id,pac_login_id,pac_password_hash,pac_must_change_password)
      VALUES($1,'TEACHER',$2,$3,'fixture',false) RETURNING pac_id`,
      [ENT, teacher, randomUUID()],
    );
    portalToken = new JwtService({ secret: 'acm-test-secret' }).sign(
      { sub: pac_id, entId: ENT, kind: 'TEACHER' },
      { expiresIn: '10m' },
    );
    client = (await access.addClient(ENT, master, 'Internal scheduler')).id;
    secret = (
      await access.issueKey(ENT, master, client, {
        name: 'test',
        scopes: [...SCOPES],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
    ).secret;
  });
  beforeEach(async () => {
    await env.ds.query('DELETE FROM amb_acm_int_request');
    await env.ds.query('DELETE FROM amb_acm_int_lesson_link');
    await env.ds.query('DELETE FROM amb_acm_cal_event');
    await env.ds.query('DELETE FROM amb_acm_cal_video_config WHERE ent_id=$1', [
      ENT,
    ]);
    await env.ds.query('DELETE FROM amb_acm_cal_boda_config WHERE ent_id=$1', [
      ENT,
    ]);
    await env.ds.query(
      'UPDATE amb_acm_int_api_key SET iak_window=NULL,iak_count=0',
    );
    await env.ds.query(
      "UPDATE amb_acm_tch_teacher SET tch_status='ACTIVE',tch_user_id=NULL WHERE tch_id=$1",
      [teacher],
    );
    await env.ds.query(
      'UPDATE amb_acm_int_client SET icl_is_active=true WHERE icl_id=$1',
      [client],
    );
    await settings().expect(200);
  });
  afterAll(async () => {
    if (env) {
      await env.app.close();
      await env.pg.stop();
    }
  });

  it('defaults OFF and blocks existing valid keys until enabled', async () => {
    await env.ds.query('DELETE FROM amb_acm_int_config WHERE ent_id=$1', [ENT]);
    const config = await request(env.app.getHttpServer())
      .get('/api/acm/integrations/settings')
      .set(headers())
      .expect(200);
    expect(config.body.data.enabled).toBe(false);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .set(token())
      .expect(403);
    await settings().expect(200);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .set(token())
      .expect(200);
  });
  it('supports Google Meet, requires HTTPS and changes online lessons to onsite', async () => {
    await env.ds.query(
      "INSERT INTO amb_acm_cal_video_config(ent_id,vdc_provider) VALUES($1,'GOOGLE_MEET')",
      [ENT],
    );
    await write('missing-meet', lesson({ deliveryMode: 'ONLINE' })).expect(422);
    await write(
      'unsafe-meet',
      lesson({ deliveryMode: 'ONLINE', meetingUrl: 'http://example.test' }),
    ).expect(422);
    const a = await write(
      'meet',
      lesson({
        deliveryMode: 'ONLINE',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }),
    ).expect(201);
    expect(a.body.data.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    const updated = await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/meet')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', a.headers.etag)
      .send(lesson())
      .expect(200);
    expect(updated.body.data).toMatchObject({
      deliveryMode: 'ONSITE',
      meetingUrl: null,
    });
  });
  it('provisions a BODA pending room atomically without contacting the remote service', async () => {
    await env.ds.query(
      `INSERT INTO amb_acm_cal_boda_config(ent_id,bdc_boda_web_url,bdc_svr_url,bdc_webrtc_url,bdc_company_code,bdc_company_id,bdc_default_room_code)
      VALUES($1,'https://fixture.test','https://fixture.test','https://fixture.test','fixture','fixture','699')`,
      [ENT],
    );
    const result = await write(
      'boda',
      lesson({ deliveryMode: 'ONLINE' }),
    ).expect(201);
    expect(result.body.data.meetingUrl).toContain(result.body.data.id);
    const [room] = await env.ds.query(
      'SELECT bdr_status FROM amb_acm_cal_boda_room WHERE evt_id=$1',
      [result.body.data.id],
    );
    expect(room.bdr_status).toBe('PENDING');
    const changed = await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/boda')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', result.headers.etag)
      .send(lesson())
      .expect(200);
    expect(changed.body.data.meetingUrl).toBeNull();
    expect(
      await env.ds.query(
        'SELECT bdr_status FROM amb_acm_cal_boda_room WHERE evt_id=$1',
        [result.body.data.id],
      ),
    ).toHaveLength(0);
  });
  it('includes legacy teacher invitees and linked owners in busy-time checks', async () => {
    const [{ evt_id }] = await env.ds.query(
      `INSERT INTO amb_acm_cal_event(ent_id,evt_owner_user_id,evt_title,evt_start_at,evt_end_at) VALUES($1,$2,'Legacy', $3,$4) RETURNING evt_id`,
      [ENT, master, '2026-12-01T10:00:00+09:00', '2026-12-01T10:50:00+09:00'],
    );
    await env.ds.query(
      "INSERT INTO amb_acm_cal_invitee(ent_id,evt_id,inv_kind,inv_ref_id) VALUES($1,$2,'TEACHER',$3)",
      [ENT, evt_id, teacher],
    );
    await write('invitee-conflict').expect(409);
    await env.ds.query('DELETE FROM amb_acm_cal_invitee WHERE evt_id=$1', [
      evt_id,
    ]);
    await env.ds.query(
      'UPDATE amb_acm_tch_teacher SET tch_user_id=$2 WHERE tch_id=$1',
      [teacher, master],
    );
    await write('owner-conflict').expect(409);
  });
  it('serializes identical concurrent retries and canonicalizes JSON property order', async () => {
    const body = lesson(),
      key = randomUUID();
    const responses = await Promise.all([
      write('retry-concurrent', body, key).then((r) => r),
      write(
        'retry-concurrent',
        Object.fromEntries(Object.entries(body).reverse()),
        key,
      ).then((r) => r),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0].count,
    ).toBe('1');
  });
  it('rejects missing/invalid keys and extra body parameters', async () => {
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .expect(401);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .set(token('wrong'))
      .expect(401);
    await write('extra', lesson({ entId: OTHER })).expect(400);
  });
  it('enforces master permission, own tenant and one-time key projection', async () => {
    await request(env.app.getHttpServer())
      .put('/api/acm/integrations/settings')
      .set({ ...headers(), 'x-test-user': randomUUID() })
      .send({ enabled: true, scopes: SCOPES })
      .expect(403);
    await request(env.app.getHttpServer())
      .put('/api/acm/integrations/settings')
      .set(headers())
      .send({ enabled: true, scopes: SCOPES, entId: OTHER })
      .expect(403);
    const clients = await request(env.app.getHttpServer())
      .get('/api/acm/integrations/clients')
      .set(headers())
      .expect(200);
    expect(JSON.stringify(clients.body)).not.toMatch(/iak_hash|secret|acm_sk_/);
    const key = await request(env.app.getHttpServer())
      .post(`/api/acm/integrations/clients/${client}/keys`)
      .set(headers())
      .send({
        name: 'issued',
        scopes: ['teachers:read'],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);
    expect(key.headers['cache-control']).toBe('no-store');
    expect(key.body.data.secret).toMatch(/^acm_sk_/);
    const stored = await env.ds.query(
      'SELECT iak_hash FROM amb_acm_int_api_key WHERE iak_id=$1',
      [key.body.data.id],
    );
    expect(stored[0].iak_hash).not.toContain('acm_sk_');
  });
  it('matches teacher email case-insensitively and limits fields', async () => {
    const r = await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .query({ email: ' TEACHER@fixture.test ' })
      .set(token())
      .expect(200);
    expect(r.body.data).toEqual([
      {
        id: teacher,
        name: 'Fixture teacher',
        email: 'teacher@fixture.test',
        status: 'ACTIVE',
      },
    ]);
    expect(r.body.meta.nextCursor).toBeNull();
  });
  it('creates a guest demo atomically, visible in real calendar without creating accounts', async () => {
    const before = await env.ds.query(
      'SELECT count(*) FROM amb_acm_std_student',
    );
    const r = await write('guest').expect(201);
    expect(r.body.data.students).toEqual([
      { studentId: null, name: 'Guest demo' },
    ]);
    const cal = await env.app.get(CalEventService).list(ENT, master, 'ADMIN', {
      from: '2026-12-01T00:00:00Z',
      to: '2026-12-02T00:00:00Z',
    });
    expect(cal.items[0]).toMatchObject({
      source: 'EXTERNAL',
      deliveryMode: 'ONSITE',
      meetingProvider: 'NONE',
      primaryStudentName: 'Guest demo',
      externalClientName: 'Internal scheduler',
    });
    const portal = await request(env.app.getHttpServer())
      .get('/api/portal/cal/events')
      .set('Authorization', `Bearer ${portalToken}`)
      .query({ from: '2026-12-01T00:00:00Z', to: '2026-12-02T00:00:00Z' })
      .expect(200);
    expect(portal.body.data.items[0]).toMatchObject({
      id: r.body.data.id,
      primaryStudentName: 'Guest demo',
      deliveryMode: 'ONSITE',
    });
    expect(
      await env.ds.query('SELECT count(*) FROM amb_acm_std_student'),
    ).toEqual(before);
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_cal_boda_room'))[0]
        .count,
    ).toBe('0');
  });
  it('links a registered student and rejects unknown regular students', async () => {
    const r = await write(
      'registered',
      lesson({
        category: 'REGULAR_CLASS',
        students: [{ studentId: student, name: 'Registered student' }],
      }),
    ).expect(201);
    expect(r.body.data.students[0].studentId).toBe(student);
    const portal = await request(env.app.getHttpServer())
      .get(`/api/portal/cal/events/${r.body.data.id}`)
      .set('Authorization', `Bearer ${portalToken}`)
      .expect(200);
    expect(portal.body.data.externalStudents).toEqual([
      { studentId: null, name: 'Registered student' },
    ]);
    await write(
      'missing',
      lesson({
        category: 'REGULAR_CLASS',
        startsAt: '2026-12-02T10:00:00+09:00',
        endsAt: '2026-12-02T11:00:00+09:00',
      }),
    ).expect(422);
    expect(
      (
        await env.ds.query(
          "SELECT count(*) FROM amb_acm_cal_invitee WHERE inv_kind='STUDENT'",
        )
      )[0].count,
    ).toBe('1');
  });
  it('rejects duplicate names and foreign student IDs without creating partial events', async () => {
    await env.ds.query(
      'ALTER TABLE amb_acm_std_student DROP CONSTRAINT uq_acm_std_ent_name',
    );
    await env.ds.query(
      `INSERT INTO amb_acm_std_student(ent_id,std_name) VALUES($1,'Duplicate'),($1,'Duplicate')`,
      [ENT],
    );
    try {
      await write(
        'ambiguous',
        lesson({ students: [{ name: 'Duplicate' }] }),
      ).expect(422);
      await write(
        'foreign',
        lesson({ students: [{ name: 'Other', studentId: randomUUID() }] }),
      ).expect(422);
      expect(
        (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0].count,
      ).toBe('0');
    } finally {
      await env.ds.query(
        "DELETE FROM amb_acm_std_student WHERE std_name='Duplicate'",
      );
      await env.ds.query(
        'ALTER TABLE amb_acm_std_student ADD CONSTRAINT uq_acm_std_ent_name UNIQUE(ent_id,std_name)',
      );
    }
  });
  it.each(['LEAVE', 'RESIGNED'])(
    'rejects new assignment to %s teachers',
    async (status) => {
      await env.ds.query(
        'UPDATE amb_acm_tch_teacher SET tch_status=$2 WHERE tch_id=$1',
        [teacher, status],
      );
      const r = await write('inactive').expect(422);
      expect(r.body.error.code).toBe('TEACHER_NOT_ACTIVE');
    },
  );
  it('rejects ambiguous email and missing teacher', async () => {
    const [{ id }] = await env.ds.query(
      `INSERT INTO amb_acm_tch_teacher(ent_id,tch_name,tch_email) VALUES($1,'Duplicate','TEACHER@fixture.test') RETURNING tch_id AS id`,
      [ENT],
    );
    await write('duplicate').expect(422);
    await env.ds.query('DELETE FROM amb_acm_tch_teacher WHERE tch_id=$1', [id]);
    await write(
      'missing',
      lesson({ teacherEmail: 'missing@fixture.test' }),
    ).expect(422);
  });
  it('replays identical requests without creating duplicate events and rejects key reuse', async () => {
    const key = randomUUID(),
      a = await write('idempotent', lesson(), key).expect(201),
      b = await write('idempotent', lesson(), key).expect(201);
    expect(b.body).toEqual(a.body);
    expect(b.headers.etag).toBe(a.headers.etag);
    const reused = await write('different', lesson(), key);
    expect({ status: reused.status, error: reused.body.error?.code }).toEqual({
      status: 409,
      error: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0].count,
    ).toBe('1');
  });
  it('detects time conflicts, permits adjacent boundaries and includes legacy schedules', async () => {
    const a = await write('first').expect(201);
    const conflict = await write('overlap').expect(409);
    expect(conflict.body.error.details.eventIds).toContain(a.body.data.id);
    await write(
      'adjacent',
      lesson({
        startsAt: '2026-12-01T10:50:00+09:00',
        endsAt: '2026-12-01T11:00:00+09:00',
      }),
    ).expect(201);
    const q = await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons')
      .set(token())
      .query({
        from: '2026-12-01T00:00:00+09:00',
        to: '2026-12-02T00:00:00+09:00',
        teacherId: teacher,
        limit: 1,
      })
      .expect(200);
    expect(q.body.data).toHaveLength(1);
    expect(q.body.meta.nextCursor).not.toBeNull();
    const next = await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons')
      .set(token())
      .query({
        from: '2026-12-01T00:00:00+09:00',
        to: '2026-12-02T00:00:00+09:00',
        teacherId: teacher,
        limit: 1,
        cursor: q.body.meta.nextCursor,
      })
      .expect(200);
    expect(next.body.data[0].id).not.toBe(q.body.data[0].id);
  });
  it('updates with ETag and excludes itself from overlap checks; stale versions fail', async () => {
    const a = await write('update').expect(201);
    const r = await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/update')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', a.headers.etag)
      .send(lesson({ location: 'Room 3', reason: 'time edit' }))
      .expect(200);
    expect(r.headers.etag).not.toBe(a.headers.etag);
    await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/update')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', a.headers.etag)
      .send(lesson())
      .expect(412);
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event_revision'))[0]
        .count,
    ).not.toBe('0');
  });
  it('manual edits invalidate ETags', async () => {
    const a = await write('manual-version').expect(201);
    await env.ds.query(
      "UPDATE amb_acm_cal_event SET evt_title='Manual change' WHERE evt_id=$1",
      [a.body.data.id],
    );
    await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/manual-version')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', a.headers.etag)
      .send(lesson())
      .expect(412);
  });
  it('soft-deletes with reason, replays deletion and prevents ID reuse', async () => {
    const a = await write('delete').expect(201),
      key = randomUUID();
    const del = () =>
      request(env.app.getHttpServer())
        .delete('/api/integrations/v1/lessons/external/delete')
        .set(token())
        .set('Idempotency-Key', key)
        .set('If-Match', a.headers.etag)
        .send({ reason: 'Fixture cancellation' });
    await del().expect(200);
    await del().expect(200);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons/external/delete')
      .set(token())
      .expect(404);
    await write('delete').expect(409);
    expect(
      (
        await env.ds.query(
          'SELECT evt_delete_reason FROM amb_acm_cal_event WHERE evt_id=$1',
          [a.body.data.id],
        )
      )[0].evt_delete_reason,
    ).toBe('Fixture cancellation');
  });
  it('rotates keys within the same app and revokes old keys immediately', async () => {
    const a = await write('rotation').expect(201);
    const rotated = await access.issueKey(ENT, master, client, {
      name: 'rotation',
      scopes: [...SCOPES],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/rotation')
      .set(token(rotated.secret))
      .set('Idempotency-Key', randomUUID())
      .set('If-Match', a.headers.etag)
      .send(lesson({ location: 'new' }))
      .expect(200);
    await access.revokeKey(ENT, master, rotated.id);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .set(token(rotated.secret))
      .expect(401);
  });
  it('enforces global toggle, feature toggles, client state, key scopes and expiry', async () => {
    const a = await write('toggle', lesson(), 'toggle-key').expect(201);
    await settings(false).expect(200);
    await write('toggle', lesson(), 'toggle-key').expect(403);
    await settings(true, ['teachers:read']).expect(200);
    await write('blocked').expect(403);
    await settings().expect(200);
    await access.setClient(ENT, master, client, false);
    await write('stopped').expect(403);
    await access.setClient(ENT, master, client, true);
    const key = await access.issueKey(ENT, master, client, {
      name: 'read only',
      scopes: ['teachers:read'],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons/external/toggle')
      .set(token(key.secret))
      .expect(403);
    await env.ds.query(
      "UPDATE amb_acm_int_api_key SET iak_expires_at=now()-interval '1 second' WHERE iak_id=$1",
      [key.id],
    );
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/teachers')
      .set(token(key.secret))
      .expect(401);
    expect(a.body.data.externalId).toBe('toggle');
  });
  it('isolates tenants and client ownership', async () => {
    await write('owned').expect(201);
    await expect(access.addClient(OTHER, master, 'Foreign')).rejects.toThrow();
    const [{ id: otherActor }] = await env.ds.query(
      `INSERT INTO amb_acm_user(ent_id,usr_email,usr_password_hash,usr_name,usr_role) VALUES($1,$2,'fixture','Other master','ADMIN') RETURNING usr_id AS id`,
      [OTHER, `${randomUUID()}@fixture.test`],
    );
    const other = (await access.addClient(OTHER, otherActor, 'Other tenant'))
      .id;
    await access.saveSettings(OTHER, otherActor, {
      enabled: true,
      scopes: [...SCOPES],
    });
    const otherKey = await access.issueKey(OTHER, otherActor, other, {
      name: 'other',
      scopes: [...SCOPES],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons/external/owned')
      .set(token(otherKey.secret))
      .expect(404);
    const second = (await access.addClient(ENT, master, 'Second app')).id;
    const secondKey = await access.issueKey(ENT, master, second, {
      name: 'second',
      scopes: [...SCOPES],
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons/external/owned')
      .set(token(secondKey.secret))
      .expect(404);
    const list = await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons')
      .set(token(secondKey.secret))
      .query({ from: '2026-12-01T00:00:00Z', to: '2026-12-02T00:00:00Z' })
      .expect(200);
    expect(list.body.data[0]).toMatchObject({
      externalId: null,
      managedByClient: false,
    });
  });
  it('serializes simultaneous overlapping requests and duplicate retries', async () => {
    const responses = await Promise.all([
      write('concurrent-a').then((r) => r),
      write('concurrent-b').then((r) => r),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const id = responses.find((r) => r.status === 201)!.body.data.externalId;
    const c = (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0]
      .count;
    expect(c).toBe('1');
    expect(id).toMatch(/^concurrent-/);
  });
  it('coordinates with an existing SQL calendar writer before collision checks', async () => {
    const runner = env.ds.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `INSERT INTO amb_acm_cal_event(ent_id,evt_owner_user_id,evt_title,evt_start_at,evt_end_at,evt_assignee_tch_id) VALUES($1,$2,'Manual', $3,$4,$5)`,
        [
          ENT,
          master,
          '2026-12-01T10:00:00+09:00',
          '2026-12-01T10:50:00+09:00',
          teacher,
        ],
      );
      const pending = write('manual-race').then((r) => r);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await runner.commitTransaction();
      expect((await pending).status).toBe(409);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('rolls back the entire event and audit when link persistence fails', async () => {
    await env.ds
      .query(`CREATE OR REPLACE FUNCTION reject_fixture_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$;
      CREATE TRIGGER reject_fixture_link BEFORE INSERT ON amb_acm_int_lesson_link FOR EACH ROW EXECUTE FUNCTION reject_fixture_link()`);
    try {
      await write('rollback').expect(500);
      expect(
        (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0].count,
      ).toBe('0');
      expect(
        (await env.ds.query('SELECT count(*) FROM amb_acm_int_request'))[0]
          .count,
      ).toBe('0');
    } finally {
      await env.ds.query(
        'DROP TRIGGER reject_fixture_link ON amb_acm_int_lesson_link; DROP FUNCTION reject_fixture_link()',
      );
    }
  });
  it('validates offsets, preconditions, ranges and video configuration', async () => {
    await write('offset', lesson({ startsAt: '2026-12-01T10:00:00' })).expect(
      400,
    );
    await write(
      'reverse',
      lesson({ endsAt: '2026-12-01T09:00:00+09:00' }),
    ).expect(400);
    await write(
      'onsite-url',
      lesson({ meetingUrl: 'https://example.test' }),
    ).expect(422);
    await request(env.app.getHttpServer())
      .put('/api/integrations/v1/lessons/external/no-condition')
      .set(token())
      .set('Idempotency-Key', randomUUID())
      .send(lesson())
      .expect(428);
    await request(env.app.getHttpServer())
      .get('/api/integrations/v1/lessons')
      .set(token())
      .query({ from: '2026-12-01T00:00:00Z', to: '2027-02-01T00:00:00Z' })
      .expect(400);
  });
  it('provides catalog, required parameter metadata and valid OpenAPI download', async () => {
    const c = await request(env.app.getHttpServer())
      .get('/api/acm/integrations/catalog')
      .set(headers())
      .expect(200);
    expect(c.body.data.apis).toHaveLength(5);
    expect(
      c.body.data.apis
        .find((e: { id: string }) => e.id === 'put')
        .fields.find((f: { name: string }) => f.name === 'deliveryMode').values,
    ).toEqual(['ONSITE', 'ONLINE']);
    const spec = await request(env.app.getHttpServer())
      .get('/api/acm/integrations/openapi.json')
      .set(headers())
      .expect(200);
    expect(spec.body.openapi).toBe('3.0.3');
    expect(
      spec.body.paths['/lessons/external/{externalId}'].put.requestBody.content[
        'application/json'
      ].schema.required,
    ).toContain('students');
  });
  it('returns Retry-After and does not write when rate limited', async () => {
    await env.ds.query(
      "UPDATE amb_acm_int_api_key SET iak_window=date_trunc('minute',now()),iak_count=60 WHERE icl_id=$1",
      [client],
    );
    const r = await write('limited').expect(429);
    expect(r.headers['retry-after']).toBe('60');
  });
  it('replays migration safely', async () => {
    await env.ds.query(
      readFileSync(
        resolve(
          __dirname,
          '../../../../sql/acm/1072-external-scheduler-api.sql',
        ),
        'utf8',
      ),
    );
    await write('after-replay').expect(201);
  });
  it('cleans expired replay payloads without deleting lessons', async () => {
    await write('expiry-cleanup').expect(201);
    await env.ds.query(
      "UPDATE amb_acm_int_request SET irq_expires_at=now()-interval '1 second'",
    );
    await access.purgeExpiredRequests();
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_int_request'))[0].count,
    ).toBe('0');
    expect(
      (await env.ds.query('SELECT count(*) FROM amb_acm_cal_event'))[0].count,
    ).toBe('1');
  });
  it('rejects nonexistent clients and keys without affecting other records', async () => {
    await request(env.app.getHttpServer())
      .put(`/api/acm/integrations/clients/${randomUUID()}`)
      .set(headers())
      .send({ active: false })
      .expect(404);
    await request(env.app.getHttpServer())
      .delete(`/api/acm/integrations/keys/${randomUUID()}`)
      .set(headers())
      .expect(404);
  });
  it('prevents teachers from adding a video link to an onsite lesson', async () => {
    await env.ds.query(
      "INSERT INTO amb_acm_cal_video_config(ent_id,vdc_provider) VALUES($1,'GOOGLE_MEET')",
      [ENT],
    );
    const a = await write('onsite-teacher-link').expect(201);
    await expect(
      env.app
        .get(TeacherMeetingLinkService)
        .update(ENT, teacher, a.body.data.id, {
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
          scope: 'ONE',
          notify: false,
        }),
    ).rejects.toMatchObject({ response: { code: 'ONSITE_VIDEO_NOT_ALLOWED' } });
  });
  it('serializes the existing student-link tool with external updates without deadlock', async () => {
    const a = await write('student-link-race').expect(201);
    const [{ evt_title }] = await env.ds.query(
      'SELECT evt_title FROM amb_acm_cal_event WHERE evt_id=$1',
      [a.body.data.id],
    );
    const responses = await Promise.all([
      request(env.app.getHttpServer())
        .put('/api/integrations/v1/lessons/external/student-link-race')
        .set(token())
        .set('Idempotency-Key', randomUUID())
        .set('If-Match', a.headers.etag)
        .send(lesson({ location: 'Concurrent edit' }))
        .then((r) => r),
      env.app
        .get(StudentLinkService)
        .apply(ENT, master, [
          { title: evt_title, eventIds: [a.body.data.id], stdIds: [student] },
        ]),
    ]);
    expect([200, 412]).toContain(responses[0].status);
    const participants = await env.ds.query(
      "SELECT inv_ref_id FROM amb_acm_cal_invitee WHERE evt_id=$1 AND inv_kind='STUDENT'",
      [a.body.data.id],
    );
    expect(participants).toEqual([{ inv_ref_id: student }]);
  });
});
