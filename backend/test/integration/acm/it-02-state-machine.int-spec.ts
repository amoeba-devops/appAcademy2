import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv, TEST_ENT_ID, TEST_USER_ID, TEST_ADMIN_ID } from './setup';

/**
 * IT-02 — Inquiry stage state machine.
 * Verifies: ACTIVE → ENROLLED forward; FORWARD-only enforcement; admin BACKWARD override; cancel → reactivate.
 */
describe('IT-02 inquiry state machine', () => {
  let env: AcmTestEnv;
  let inqId: string;

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 180_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  const auth = (role: 'staff' | 'admin' = 'staff') => ({
    'x-test-user': role === 'admin' ? TEST_ADMIN_ID : TEST_USER_ID,
    'x-test-ent': TEST_ENT_ID,
    'x-test-roles': role,
  });

  it('creates inquiry in ACTIVE state', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/csl/inquiries')
      .set(auth())
      .send({
        studentName: '홍길동',
        parentPhone: '01012345678',
        schoolFreetext: '서울중',
        grade: 'M1',
        channel: 'PHONE',
      })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    inqId = res.body.id;
  });

  it('rejects backward transition for staff', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions/backward`)
      .set(auth('staff'))
      .send({ toStatus: 'ACTIVE', reasonCode: 'CORRECTION', note: 'test' })
      .expect(403);
  });

  it('forwards to ENROLLED', async () => {
    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions`)
      .set(auth())
      .send({ toStatus: 'ENROLLED' })
      .expect(201);
    expect(res.body.status).toBe('ENROLLED');
  });

  it('logs transition history (C-10)', async () => {
    const res = await request(env.app.getHttpServer())
      .get(`/api/acm/csl/inquiries/${inqId}/transitions`)
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[res.body.length - 1].toStatus).toBe('ENROLLED');
  });

  it('admin can backward override ENROLLED → ACTIVE', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions/backward`)
      .set(auth('admin'))
      .send({ toStatus: 'ACTIVE', reasonCode: 'CORRECTION', note: 'admin correction' })
      .expect(201);
  });

  it('cancel + reactivate cycle', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/cancellations`)
      .set(auth())
      .send({ reasonCode: 'NO_RESPONSE' })
      .expect(201);
    const r = await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/reactivate`)
      .set(auth())
      .expect(201);
    expect(['ACTIVE','ENROLLED','NOT_ENROLLED','SUSPENDED']).toContain(r.body.status);
  });
});
