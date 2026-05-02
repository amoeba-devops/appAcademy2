import request from 'supertest';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv, TEST_ENT_ID, TEST_USER_ID } from './setup';

/**
 * IT-QNA-P1 — Q&A categories + question CRUD + escalate/reply/thread/use-faq.
 * Covers FR-P1-05..12 + FR-P2-05 (label_vi/zh extension stays nullable).
 */
describe('IT-QNA-P1 question + category CRUD + thread', () => {
  let env: AcmTestEnv;
  let categoryId: string;
  let questionId: string;
  let replyId: string;

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 240_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  const auth = () => ({
    'x-test-user': TEST_USER_ID,
    'x-test-ent': TEST_ENT_ID,
    'x-test-roles': 'staff',
  });

  it('creates a category with all locale labels', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/qna/categories')
      .set(auth())
      .send({
        code: 'FEE',
        labelKr: '학비',
        labelEn: 'Fees',
        labelVi: 'Phí',
        labelZh: '学费',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.labelVi).toBe('Phí');
    expect(res.body.labelZh).toBe('学费');
    categoryId = res.body.id;
  });

  it('lists categories', async () => {
    const res = await request(env.app.getHttpServer())
      .get('/api/acm/qna/categories')
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((c: { id: string }) => c.id === categoryId)).toBeDefined();
  });

  it('updates the category', async () => {
    const res = await request(env.app.getHttpServer())
      .patch(`/api/acm/qna/categories/${categoryId}`)
      .set(auth())
      .send({ labelEn: 'Tuition Fees' })
      .expect(200);
    expect(res.body.labelEn).toBe('Tuition Fees');
  });

  it('creates a question (status=OPEN)', async () => {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/qna/questions')
      .set(auth())
      .send({ subject: '학비 문의', body: '월 학비가 어떻게 되나요?', categoryId })
      .expect(201);
    expect(res.body.status).toBe('OPEN');
    questionId = res.body.id;
  });

  it('lists questions and finds the new one', async () => {
    const res = await request(env.app.getHttpServer())
      .get('/api/acm/qna/questions')
      .set(auth())
      .expect(200);
    expect(res.body.items ?? res.body).toBeDefined();
    const items: Array<{ id: string }> = res.body.items ?? res.body;
    expect(items.find((q) => q.id === questionId)).toBeDefined();
  });

  it('updates the question subject', async () => {
    const res = await request(env.app.getHttpServer())
      .put(`/api/acm/qna/questions/${questionId}`)
      .set(auth())
      .send({ subject: '학비 문의 (수정됨)' })
      .expect(200);
    expect(res.body.subject).toBe('학비 문의 (수정됨)');
  });

  it('escalates the question', async () => {
    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/qna/questions/${questionId}/escalate`)
      .set(auth())
      .send({ reason: 'IT-QNA-P1 escalation' })
      .expect(201);
    expect(res.body.status).toBe('ESCALATED');
  });

  it('rejects double escalation (422)', async () => {
    await request(env.app.getHttpServer())
      .post(`/api/acm/qna/questions/${questionId}/escalate`)
      .set(auth())
      .send({})
      .expect(422);
  });

  it('creates a reply (child in thread)', async () => {
    const res = await request(env.app.getHttpServer())
      .post(`/api/acm/qna/questions/${questionId}/reply`)
      .set(auth())
      .send({ subject: 'Re: 학비', body: '월 80만원입니다.', externalBody: '월 80만원입니다.' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.threadParentId).toBe(questionId);
    replyId = res.body.id;
  });

  it('returns thread chain (root + reply)', async () => {
    const res = await request(env.app.getHttpServer())
      .get(`/api/acm/qna/questions/${questionId}/thread`)
      .set(auth())
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.find((q: { id: string }) => q.id === replyId)).toBeDefined();
  });

  it('blocks category delete while in use', async () => {
    await request(env.app.getHttpServer())
      .delete(`/api/acm/qna/categories/${categoryId}`)
      .set(auth())
      .expect(422);
  });

  it('soft-deletes the question', async () => {
    await request(env.app.getHttpServer())
      .delete(`/api/acm/qna/questions/${questionId}`)
      .set(auth())
      .expect(204);
  });

  it('deletes the category once unreferenced', async () => {
    // Also delete the reply child so no FK left
    await request(env.app.getHttpServer())
      .delete(`/api/acm/qna/questions/${replyId}`)
      .set(auth())
      .expect(204);
    await request(env.app.getHttpServer())
      .delete(`/api/acm/qna/categories/${categoryId}`)
      .set(auth())
      .expect(204);
  });

  it('returns 404 for unknown question id', async () => {
    await request(env.app.getHttpServer())
      .get('/api/acm/qna/questions/00000000-0000-4000-8000-00000000ffff')
      .set(auth())
      .expect(404);
  });
});
