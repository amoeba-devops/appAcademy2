import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv, TEST_ENT_ID, TEST_USER_ID, TEST_ADMIN_ID } from './setup';

/**
 * IT-02 — Inquiry stage pipeline (현재 단계 모델: INTAKE → MAP_TEST → TRIAL_CLASS → … / DROPPED).
 * Verifies: 등록 = INTAKE, 정방향 전이, 직원 역방향 금지, 관리자 역방향 허용, 이력, 중단 → 재개.
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

  const stageOf = (b: Record<string, unknown>) => b.currentStage ?? b.stage;

  it('creates inquiry in INTAKE stage', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/csl/inquiries')
      .set(auth())
      .send({
        studentName: '홍길동',
        parentPhone: '01012345678',
        schoolFreetext: '서울중',
        grade: 'M1',
        channel: 'PHONE',
        inflowType: 'PHONE',
        applyType: 'COUNSELING_ONLY',
      })
      .expect(201);
    expect(stageOf(res.body)).toBe('INTAKE');
    inqId = res.body.id;
  });

  it('rejects backward transition for staff', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions/backward`)
      .set(auth('staff'))
      .send({ toStage: 'INTAKE', reason: 'correction', note: 'test' })
      .expect(403);
  });

  it('rejects a transition that skips the pipeline', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions`)
      .set(auth())
      .send({ toStage: 'PAYMENT' })
      .expect(400);
  });

  it('forwards INTAKE → MAP_TEST', async () => {
    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions`)
      .set(auth())
      .send({ toStage: 'MAP_TEST' })
      .expect(201);
    expect(stageOf(res.body)).toBe('MAP_TEST');
  });

  it('logs transition history (C-10)', async () => {
    const res = await request(env.app.getHttpServer())
      .get(`/api/acm/csl/inquiries/${inqId}/transitions`)
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(JSON.stringify(res.body)).toContain('MAP_TEST');
  });

  it('admin can backward override MAP_TEST → INTAKE', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/transitions/backward`)
      .set(auth('admin'))
      .send({ toStage: 'INTAKE', reason: 'admin correction' })
      .expect(201);
  });

  it('cancel + reactivate cycle', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/cancellations`)
      .set(auth())
      .send({ reasonCode: 'SIMPLE_INQUIRY_END' })
      .expect(201);
    const r = await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/reactivate`)
      .set(auth())
      .expect(201);
    expect(stageOf(r.body)).toBe('INTAKE');
  });
});
