import request from 'supertest';
import {
  bootAcmTestEnv,
  teardownAcmTestEnv,
  AcmTestEnv,
  TEST_ADMIN_ID,
  TEST_ENT_ID,
  TEST_USER_ID,
} from './setup';

describe('IT-10 CSL list filters + enrollment payment fields', () => {
  let env: AcmTestEnv;

  beforeAll(async () => { env = await bootAcmTestEnv(); }, 240_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  const auth = (role: 'staff' | 'admin' = 'staff') => ({
    'x-test-user': role === 'admin' ? TEST_ADMIN_ID : TEST_USER_ID,
    'x-test-ent': TEST_ENT_ID,
    'x-test-roles': role,
  });

  async function createInquiry(input: {
    studentName: string;
    parentName?: string;
    inflowType?: 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
    applyType?: 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
    applyPurposes?: string[];
    registeredAt?: string;
    followupAt?: string;
  }) {
    const res = await request(env.app.getHttpServer())
      .post('/api/acm/csl/inquiries')
      .set(auth())
      .send({
        studentName: input.studentName,
        parentName: input.parentName,
        parentPhone: '01012345678',
        schoolFreetext: '테스트학교',
        grade: 'M1',
        inflowType: input.inflowType ?? 'PHONE',
        applyType: input.applyType ?? 'BOTH',
        applyPurposes: input.applyPurposes ?? ['ISEE_TUTORING'],
        registeredAt: input.registeredAt,
        followupAt: input.followupAt,
      })
      .expect(201);

    return res.body.id as string;
  }

  it('filters by student/parent query, purpose, follow-up state, and paginates', async () => {
    await createInquiry({
      studentName: '김민수',
      parentName: '박영희',
      applyPurposes: ['ISEE_TUTORING'],
      registeredAt: '2026-07-01',
      followupAt: '2026-07-02',
    });
    await createInquiry({
      studentName: '최서윤',
      parentName: '민수 아버지',
      applyPurposes: ['MAP_TEST_TUTORING'],
      registeredAt: '2026-07-03',
    });
    await createInquiry({
      studentName: 'John Doe',
      parentName: 'Jane Doe',
      inflowType: 'HOMEPAGE',
      applyType: 'EXAM_ONLY',
      applyPurposes: ['ISEE_TUTORING'],
      registeredAt: '2026-07-04',
    });

    const byName = await request(env.app.getHttpServer())
      .get('/api/acm/csl/inquiries')
      .set(auth())
      .query({ q: '민수', limit: 10, offset: 0 })
      .expect(200);

    expect(byName.body.total).toBe(2);
    expect(byName.body.items).toHaveLength(2);
    expect(byName.body.items.map((row: { studentName: string }) => row.studentName)).toEqual(
      expect.arrayContaining(['김민수', '최서윤']),
    );

    const filtered = await request(env.app.getHttpServer())
      .get('/api/acm/csl/inquiries')
      .set(auth())
      .query({
        applyPurpose: 'ISEE_TUTORING',
        followupState: 'SET',
        registeredFrom: '2026-07-01',
        registeredTo: '2026-07-02',
      })
      .expect(200);

    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].studentName).toBe('김민수');

    const paged = await request(env.app.getHttpServer())
      .get('/api/acm/csl/inquiries')
      .set(auth())
      .query({ limit: 1, offset: 1 })
      .expect(200);

    expect(paged.body.total).toBe(3);
    expect(paged.body.items).toHaveLength(1);
  });

  it('stores operator-entered payment metadata on enrollment rows', async () => {
    const inqId = await createInquiry({
      studentName: '결제저장 학생',
      parentName: '결제저장 학부모',
      registeredAt: '2026-07-04',
    });

    const saved = await request(env.app.getHttpServer())
      .put(`/api/acm/csl/inquiries/${inqId}/enrollment`)
      .set(auth())
      .send({
        counselDone: 'YES',
        paymentNoticeSent: 'YES',
        classMinutes: 90,
        tuitionAmount: 1200000,
        paymentDate: '2026-07-04',
        paymentMethod: 'OTHER',
        paymentAmount: 1200000,
        paymentMemo: '현장 수기 결제',
        classStarted: 'NO',
        counselMemo: '여름 집중반 상담 완료',
        courseFreetext: 'SAT Summer Intensive',
        sessionCount: 8,
        startDate: '2026-07-10',
        endDate: '2026-08-10',
      })
      .expect(200);

    expect(saved.body.paymentDate).toBe('2026-07-04');
    expect(saved.body.paymentMethod).toBe('OTHER');
    expect(saved.body.paymentAmount).toBe('1200000');
    expect(saved.body.paymentMemo).toBe('현장 수기 결제');
    expect(saved.body.courseFreetext).toBe('SAT Summer Intensive');

    const fetched = await request(env.app.getHttpServer())
      .get(`/api/acm/csl/inquiries/${inqId}/enrollment`)
      .set(auth())
      .expect(200);

    expect(fetched.body.paymentDate).toBe('2026-07-04');
    expect(fetched.body.paymentMethod).toBe('OTHER');
    expect(fetched.body.paymentAmount).toBe('1200000');
    expect(fetched.body.paymentMemo).toBe('현장 수기 결제');
    expect(fetched.body.classMinutes).toBe(90);
    expect(fetched.body.counselMemo).toBe('여름 집중반 상담 완료');
  });

  it('accepts OTHER on explicit payment approval for admin users', async () => {
    const inqId = await createInquiry({
      studentName: '승인테스트 학생',
      parentName: '승인테스트 학부모',
      registeredAt: '2026-07-05',
    });

    const approved = await request(env.app.getHttpServer())
      .post(`/api/acm/csl/inquiries/${inqId}/enrollment/approve-payment`)
      .set(auth('admin'))
      .send({ method: 'OTHER', memo: '외부 결제 링크 사용' })
      .expect(201);

    expect(approved.body.tuitionPaid).toBe(true);
    expect(approved.body.paymentMethod).toBe('OTHER');
    expect(approved.body.paymentMemo).toBe('외부 결제 링크 사용');
    expect(approved.body.counselMemo).toContain('[payment-approved method=OTHER memo=외부 결제 링크 사용]');
  });
});
