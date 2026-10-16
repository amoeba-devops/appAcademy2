import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv, TEST_ENT_ID, TEST_USER_ID } from './setup';

/**
 * IT-09 — Multi-tenancy isolation via OwnEntityGuard.
 * Tenant A creates an inquiry; Tenant B cannot read it.
 */
describe('IT-09 multi-tenancy isolation', () => {
  let env: AcmTestEnv;
  const ENT_A = TEST_ENT_ID;
  const ENT_B = '00000000-0000-4000-8000-000000000099';

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 180_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  it('tenant B cannot see tenant A inquiry', async () => {
    const created = await request(env.app.getHttpServer())
      .post('/api/acm/csl/inquiries')
      .set({ 'x-test-user': TEST_USER_ID, 'x-test-ent': ENT_A, 'x-test-roles': 'staff' })
      .send({ studentName: 'A-student', schoolFreetext: 'A-school', grade: 'M1', inflowType: 'PHONE', applyType: 'COUNSELING_ONLY' })
      .expect(201);

    await request(env.app.getHttpServer())
      .get(`/api/acm/csl/inquiries/${created.body.id}`)
      .set({ 'x-test-user': TEST_USER_ID, 'x-test-ent': ENT_B, 'x-test-roles': 'staff' })
      .expect(404);

    const list = await request(env.app.getHttpServer())
      .get('/api/acm/csl/inquiries')
      .set({ 'x-test-user': TEST_USER_ID, 'x-test-ent': ENT_B, 'x-test-roles': 'staff' })
      .expect(200);
    // 목록 응답은 배열 또는 페이지 객체({ items | data, total })
    const rows = Array.isArray(list.body) ? list.body : (list.body.items ?? list.body.data ?? []);
    expect(rows).toHaveLength(0);
  });
});
