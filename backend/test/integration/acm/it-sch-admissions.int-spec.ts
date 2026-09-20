import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import {
  bootAcmTestEnv,
  teardownAcmTestEnv,
  AcmTestEnv,
  TEST_ENT_ID,
  TEST_USER_ID,
} from './setup';

describe('School admission catalog', () => {
  let env: AcmTestEnv;
  beforeAll(async () => {
    env = await bootAcmTestEnv();
  }, 240000);
  afterAll(async () => {
    if (env) await teardownAcmTestEnv(env);
  });
  const auth = () => ({
    'x-test-user': TEST_USER_ID,
    'x-test-ent': TEST_ENT_ID,
    'x-test-roles': 'staff',
  });
  it('preserves multiline admissions, clears values, filters, detects stale updates and soft deletes', async () => {
    const created = await request(env.app.getHttpServer())
      .post('/api/acm/sch/schools')
      .set(auth())
      .send({
        name: 'Admission School',
        level: 'FOREIGN',
        curriculumDescription: 'IB / IGCSE',
        eligibility: 'No restriction',
        admissions: [
          {
            targetLabel: 'Reception',
            examContent: 'Observation\nInterview',
            scheduleText: '2026-04-17',
          },
          {
            targetLabel: 'Y3',
            examContent: 'CAT4',
            scheduleText: 'Rolling\nWednesday',
          },
        ],
      })
      .expect(201);
    expect(created.body.admissions).toHaveLength(2);
    expect(created.body.isAuthorized).toBeNull();
    expect(created.body.admissions[0].examContent).toBe(
      'Observation\nInterview',
    );
    const id = created.body.id;
    const edited = await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${id}`)
      .set(auth())
      .send({
        expectedUpdatedAt: created.body.updatedAt,
        eligibility: '',
        isAuthorized: false,
        admissions: [created.body.admissions[1]],
      })
      .expect(200);
    expect(edited.body.eligibility).toBe('');
    expect(edited.body.admissions).toHaveLength(1);
    expect(edited.body.admissions[0].id).toBe(created.body.admissions[1].id);
    await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${id}`)
      .set(auth())
      .send({ expectedUpdatedAt: created.body.updatedAt, notes: 'stale edit' })
      .expect(409);
    expect(
      await env.ds.query(
        'SELECT sai_id FROM amb_acm_sch_admission_info WHERE sch_id=$1 AND deleted_at IS NOT NULL',
        [id],
      ),
    ).toHaveLength(1);
    const filtered = await request(env.app.getHttpServer())
      .get('/api/acm/sch/schools?curriculum=IGCSE&authorization=no&limit=1')
      .set(auth())
      .expect(200);
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.items[0].admissions[0].targetLabel).toBe('Y3');
  });
  it('rolls back invalid admissions and prevents cross-tenant and foreign-school access', async () => {
    const created = await request(env.app.getHttpServer())
      .post('/api/acm/sch/schools')
      .set(auth())
      .send({
        name: 'Atomic School',
        level: 'FOREIGN',
        admissions: [{ examContent: 'No target specified' }],
      })
      .expect(201);
    const other = await request(env.app.getHttpServer())
      .post('/api/acm/sch/schools')
      .set(auth())
      .send({
        name: 'Other School',
        level: 'FOREIGN',
        admissions: [{ examContent: 'Other info' }],
      })
      .expect(201);
    await request(env.app.getHttpServer())
      .patch(`/api/acm/sch/schools/${created.body.id}`)
      .set(auth())
      .send({ name: 'Must rollback', admissions: [other.body.admissions[0]] })
      .expect(400);
    const unchanged = await request(env.app.getHttpServer())
      .get(`/api/acm/sch/schools/${created.body.id}`)
      .set(auth())
      .expect(200);
    expect(unchanged.body.name).toBe('Atomic School');
    expect(unchanged.body.admissions).toHaveLength(1);
    await request(env.app.getHttpServer())
      .get(`/api/acm/sch/schools/${created.body.id}`)
      .set({ ...auth(), 'x-test-ent': '22222222-2222-2222-2222-222222222222' })
      .expect(404);
    await request(env.app.getHttpServer())
      .post('/api/acm/sch/schools')
      .set(auth())
      .send({
        name: 'Empty admission rollback',
        level: 'FOREIGN',
        admissions: [{}],
      })
      .expect(400);
    const absent = await request(env.app.getHttpServer())
      .get('/api/acm/sch/schools?q=Empty%20admission%20rollback')
      .set(auth())
      .expect(200);
    expect(absent.body.total).toBe(0);
    await expect(
      env.ds.query(
        `INSERT INTO amb_acm_sch_admission_info(ent_id,sch_id,exam_content) VALUES($1,$2,'invalid tenant')`,
        ['22222222-2222-2222-2222-222222222222', created.body.id],
      ),
    ).rejects.toThrow();
  });

  it('imports only reviewed rows, preserves blanks, rejects stale plans and is idempotent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'school-import-'));
    try {
      const source = {
        fileHash: 'synthetic-school-source',
        sheet: 'test',
        schools: Array.from({ length: 18 }, (_, i) => ({
          name: `Source School ${i}`,
          curriculumDescription: 'Source curriculum',
          region: null,
          eligibility: null,
          notes: null,
          isAuthorized: i < 7 ? null : false,
          admissions: Array.from(
            { length: [7, 4, 3, 2, 3, 2, 1][i] ?? 1 },
            (_, j) => ({
              sourceRow: i * 10 + j,
              targetLabel: `Y${j}`,
              examContent: 'Exam\nInterview',
              scheduleText: 'Rolling',
            }),
          ),
        })),
      };
      for (const s of source.schools)
        await env.ds.query(
          `INSERT INTO amb_acm_sch_school(sch_id,ent_id,name,level,region,is_authorized,notes)
        VALUES(gen_random_uuid(),$1,$2,'FOREIGN','Keep region',true,'Keep notes')`,
          [TEST_ENT_ID, s.name],
        );
      const file = join(dir, 'source.json'),
        plan = join(dir, 'plan.json');
      writeFileSync(file, JSON.stringify(source));
      const run = (apply = false) =>
        spawnSync(
          process.execPath,
          [
            resolve(__dirname, '../../../../scripts/import-sch-admissions.cjs'),
            file,
            TEST_ENT_ID,
            plan,
            ...(apply ? ['--apply'] : []),
          ],
          {
            cwd: resolve(__dirname, '../../..'),
            encoding: 'utf8',
            env: {
              ...process.env,
              ACM_PG_HOST: env.pg.getHost(),
              ACM_PG_PORT: String(env.pg.getPort()),
              ACM_PG_USER: 'amb',
              ACM_PG_PASSWORD: 'amb',
              ACM_PG_DATABASE: 'db_amb_test',
            },
          },
        );
      expect(run().status).toBe(0);
      expect(JSON.parse(readFileSync(plan, 'utf8')).summary).toMatchObject({
        schools: 18,
        admissions: 33,
        authorizationCorrections: 11,
      });
      await env.ds.query(
        `UPDATE amb_acm_sch_school SET notes='Concurrent edit' WHERE ent_id=$1 AND name='Source School 0'`,
        [TEST_ENT_ID],
      );
      expect(run(true).status).toBe(1);
      expect(run().status).toBe(0);
      const applied = run(true);
      expect({ status: applied.status, stderr: applied.stderr }).toEqual({
        status: 0,
        stderr: '',
      });
      const rows = await env.ds.query(
        `SELECT name,region,notes,is_authorized FROM amb_acm_sch_school WHERE ent_id=$1 AND name LIKE 'Source School %'`,
        [TEST_ENT_ID],
      );
      expect(
        rows.filter((r: { is_authorized: boolean }) => !r.is_authorized),
      ).toHaveLength(11);
      expect(
        rows.every((r: { region: string }) => r.region === 'Keep region'),
      ).toBe(true);
      expect(
        rows.find((r: { name: string }) => r.name === 'Source School 0').notes,
      ).toBe('Concurrent edit');
      expect(run().status).toBe(0);
      expect(JSON.parse(readFileSync(plan, 'utf8')).summary).toMatchObject({
        updated: 0,
        admissions: 0,
      });
      expect(run(true).status).toBe(0);
      const count = await env.ds.query(
        `SELECT count(*)::int AS n FROM amb_acm_sch_admission_info WHERE source_file_hash=$1`,
        [source.fileHash],
      );
      expect(count[0].n).toBe(33);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
