import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv, TEST_ENT_ID, TEST_USER_ID } from './setup';

/**
 * IT-SCH-P1 — School + GradeBand + Schedule CRUD coverage.
 * Covers: AC-SCH-01..05 (FR-P1-01..04 in REQ-SCH-QNA-P1-FOLLOWUP-1.0.0).
 */
describe('IT-SCH-P1 school CRUD + bands + schedules', () => {
  let env: AcmTestEnv;
  let schoolId: string;
  let bandId: string;
  let scheduleId: string;

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 240_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  const auth = () => ({
    'x-test-user': TEST_USER_ID,
    'x-test-ent': TEST_ENT_ID,
    'x-test-roles': 'staff',
  });

  it('creates a school', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/sch/schools')
      .set(auth())
      .send({ name: 'IT-SCH-P1 Middle', level: 'MIDDLE', region: 'Seoul' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('IT-SCH-P1 Middle');
    expect(res.body.isAuthorized).toBe(true); // default
    schoolId = res.body.id;
  });

  it('updates the school (PATCH isAuthorized=false)', async () => {
    const res = await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${schoolId}`)
      .set(auth())
      .send({ isAuthorized: false })
      .expect(200);
    expect(res.body.isAuthorized).toBe(false);
  });

  it('rejects grade-band create when school not authorized', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/sch/schools/${schoolId}/grade-bands`)
      .set(auth())
      .send({ label: 'M-low', gradeMin: 1, gradeMax: 3 })
      .expect(422);
  });

  it('re-authorizes school then creates a grade band', async () => {
    await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${schoolId}`)
      .set(auth())
      .send({ isAuthorized: true })
      .expect(200);

    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/sch/schools/${schoolId}/grade-bands`)
      .set(auth())
      .send({ label: 'M-low', gradeMin: 1, gradeMax: 3 })
      .expect(201);
    expect(res.body.id).toBeDefined();
    bandId = res.body.id;
  });

  it('lists grade bands', async () => {
    const res = await request(env.app.getHttpServer())
      .get(`/api/acm/sch/schools/${schoolId}/grade-bands`)
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.find((b: { id: string }) => b.id === bandId)).toBeDefined();
  });

  it('updates the grade band', async () => {
    const res = await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${schoolId}/grade-bands/${bandId}`)
      .set(auth())
      .send({ label: 'M-low (updated)' })
      .expect(200);
    expect(res.body.label).toBe('M-low (updated)');
  });

  it('creates a schedule', async () => {
    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/sch/schools/${schoolId}/schedules`)
      .set(auth())
      .send({ year: 2026, type: 'REGULAR', testDate: '2026-06-01' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    scheduleId = res.body.id;
  });

  it('updates the schedule', async () => {
    const res = await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${schoolId}/schedules/${scheduleId}`)
      .set(auth())
      .send({ resultDate: '2026-06-15' })
      .expect(200);
    expect(res.body.resultDate).toBeDefined();
  });

  it('blocks delete when school is referenced by an active CSL inquiry', async () => {
    // Create an inquiry referencing this school
    await request(env.app.getHttpServer())
      .post('/api/acm/csl/inquiries')
      .set(auth())
      .send({
        studentName: 'IT-SCH-P1 Student',
        schoolId,
        grade: 'M2',
        inflowType: 'PHONE',
        applyType: 'COUNSELING_ONLY',
      })
      .expect(201);

    await request(env.app.getHttpServer())
      .delete(`/api/acm/sch/schools/${schoolId}`)
      .set(auth())
      .expect(422);
  });

  it('deletes the schedule', async () => {
    await request(env.app.getHttpServer())
      .delete(`/api/acm/sch/schools/${schoolId}/schedules/${scheduleId}`)
      .set(auth())
      .expect(204);
  });

  it('deletes the grade band', async () => {
    await request(env.app.getHttpServer())
      .delete(`/api/acm/sch/schools/${schoolId}/grade-bands/${bandId}`)
      .set(auth())
      .expect(204);
  });

  it('returns 404 for unknown school id', async () => {
    await request(env.app.getHttpServer())
      .get('/api/acm/sch/schools/00000000-0000-4000-8000-00000000ffff')
      .set(auth())
      .expect(404);
  });
});
