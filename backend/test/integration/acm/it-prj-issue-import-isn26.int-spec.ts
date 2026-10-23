import * as fs from 'node:fs';
import * as path from 'node:path';
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

/** REQ-261024 — AMA TPI01 ISN-26 import (sql/acm/1051) applies on a fresh DB and is idempotent. */
describe('IT-PRJ-ISSUE-IMPORT-ISN26', () => {
  let env: AcmTestEnv;
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../../sql/acm/1051-prj-issue-import-ama-tpi01-isn26.sql'), 'utf8');
  const rows = () =>
    env.ds.query<{ title: string; status: string; type: string; priority: number; due: string; prj: string; body: string }[]>(
      `SELECT i.pit_title title, i.pit_status status, i.pit_issue_type type, i.pit_priority priority, i.due_date::text due, p.prj_title prj, i.pit_body body
         FROM amb_acm_prj_item i JOIN amb_acm_prj_project p ON p.prj_id=i.prj_id
        WHERE i.pit_source='AMA' AND i.pit_source_ref='TPI01#ISN-26'`,
    );
  beforeAll(async () => {
    env = await bootAcmTestEnv();
  }, 240_000);
  afterAll(async () => {
    await teardownAcmTestEnv(env);
  });

  it('creates the issue under a "업무" project once', async () => {
    const [master] = await env.ds.query(`SELECT 1 FROM amb_acm_user WHERE lower(usr_email)='admin@tpi.co.kr' AND ent_id='00000000-0000-0000-0000-000000000001'`);
    expect(master).toBeTruthy(); // the shared seed has the tenant master, so the import must run
    const first = await rows();
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ status: 'OPEN', type: 'TASK', priority: 3, due: '2026-10-23', prj: '업무' });
    // Staff accounts do not exist in the test DB → fallback note keeps their e-mails.
    expect(first[0].body).toContain('tpimorgan@tpiglobal.network');
    await env.ds.query(sql.replace(/^\s*\\.*$/gm, ''));
    expect(await rows()).toHaveLength(1);
    const [{ n }] = await env.ds.query(`SELECT count(*)::int n FROM amb_acm_prj_issue_status_log l JOIN amb_acm_prj_item i ON i.pit_id=l.pit_id WHERE i.pit_source_ref='TPI01#ISN-26'`);
    expect(n).toBe(1);
  });
});
