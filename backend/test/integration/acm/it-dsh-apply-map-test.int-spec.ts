import { DailyKpiService } from '../../../src/modules/acm-dsh/application/daily-kpi.service';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/** FIX-261026 — Dashboard "지원" (cs_apply) = MAP-test inquiries on their registration date. */
describe('IT-DSH-APPLY-MAP-TEST', () => {
  let env: AcmTestEnv;
  const ENT = '00000000-0000-4000-8000-0000000e0001';
  const inquiry = (seq: number, kind: string, date: string, deleted = false) =>
    env.ds.query(
      `INSERT INTO amb_acm_csl_inquiry (ent_id, inq_seq_no, inq_name_encrypted, inq_name_iv, inq_name_auth_tag,
         inq_inflow_type, inq_apply_type, inq_kind, inq_registered_at, school_freetext, deleted_at)
       VALUES ($1,$2,'\\x00','\\x00','\\x00','WEB_EXTERNAL','EXAM_ONLY',$3,$4,'X',$5)`,
      [ENT, seq, kind, date, deleted ? new Date() : null],
    );
  beforeAll(async () => {
    env = await bootAcmTestEnv();
    await inquiry(1, 'MAP_TEST', '2026-10-07');
    await inquiry(2, 'MAP_TEST', '2026-10-07');
    await inquiry(3, 'TUTORING', '2026-10-07');
    await inquiry(4, 'MAP_TEST', '2026-10-07', true);
    await inquiry(5, 'MAP_TEST', '2026-10-08');
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('counts MAP-test inquiries by registration date, excluding deleted ones and tutoring', async () => {
    const kpi = env.app.get(DailyKpiService);
    await kpi.recomputeDay(ENT, '2026-10-07');
    await kpi.recomputeDay(ENT, '2026-10-08');
    const rows = await env.ds.query<
      { d: string; apply: number; counseling: number }[]
    >(
      `SELECT dkp_date::text d, dkp_cs_apply apply, dkp_cs_counseling counseling FROM amb_acm_dsh_daily_kpi WHERE ent_id=$1 ORDER BY 1`,
      [ENT],
    );
    expect(rows).toEqual([
      { d: '2026-10-07', apply: 2, counseling: 3 },
      { d: '2026-10-08', apply: 1, counseling: 1 },
    ]);
  });
});
