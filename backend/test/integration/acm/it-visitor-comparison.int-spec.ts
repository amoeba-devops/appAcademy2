import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { VisitorComparisonService } from '../../../src/modules/acm-dsh/application/visitor-comparison.service';

describe('visitor observations PostgreSQL', () => {
  let pg: StartedPostgreSqlContainer,
    ds: DataSource,
    svc: VisitorComparisonService;
  const a = '00000000-0000-0000-0000-000000000001',
    b = '00000000-0000-0000-0000-000000000002';
  const actor = '10000000-0000-0000-0000-000000000001',
    date = '2026-09-01';
  const input = {
    site: 'TPI',
    value: 0,
    note: 'Original export',
    timezone: 'Asia/Seoul',
    revision: 0,
  };
  const ga = {
    site: 'TPI',
    date,
    value: 12,
    metric: 'activeUsers',
    propertyId: '123',
    streamId: '456',
  };
  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'postgres:16-alpine',
    )
      .withPullPolicy({ shouldPull: () => false })
      .start();
    ds = await new DataSource({
      type: 'postgres',
      url: pg.getConnectionUri(),
    }).initialize();
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../../../sql/acm/1016-dsh-visitor-observations.sql',
      ),
      'utf8',
    );
    await ds.query(sql);
    await ds.query(sql);
    await ds.query(
      `CREATE TABLE amb_acm_dsh_site_visit(svt_id uuid DEFAULT gen_random_uuid(),ent_id uuid,svt_site text,svt_date date,svt_visitors int,svt_source text,svt_synced_at timestamptz DEFAULT now());`,
    );
    svc = new VisitorComparisonService(ds);
  });
  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (pg) await pg.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_dsh_visit_audit,amb_acm_dsh_visit_observation,amb_acm_dsh_site_visit',
    );
  });
  it('preserves zero and audits before/after including a clear', async () => {
    const created = await svc.saveImweb(a, actor, date, input);
    expect(created.value).toBe(0);
    expect(created.revision).toBe(1);
    const updated = await svc.saveImweb(a, actor, date, {
      ...input,
      value: 22,
      revision: 1,
    });
    expect(updated.revision).toBe(2);
    await svc.saveImweb(a, actor, date, { ...input, value: null, revision: 2 });
    const r = await svc.range(a, date, date, 'TPI');
    expect(r.rows[0].imweb).toMatchObject({ value: null, revision: 3 });
    const h = await svc.history(a, date, 'TPI');
    expect(h.rows).toHaveLength(3);
    expect(h.rows[0].before).toMatchObject({ vob_value: 22, vob_revision: 2 });
    expect(h.rows[0].after).toMatchObject({
      vob_value: null,
      vob_actor_id: actor,
    });
  });
  it('rejects stale create/update, and tenant cannot modify/read other tenant data', async () => {
    await svc.saveImweb(a, actor, date, input);
    await expect(svc.saveImweb(a, actor, date, input)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      svc.saveImweb(b, actor, date, { ...input, revision: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await svc.range(b, date, date, 'TPI')).rows[0].imweb).toBeNull();
    expect((await svc.history(b, date, 'TPI')).rows).toHaveLength(0);
    const results = await Promise.allSettled([
      svc.saveImweb(a, actor, date, { ...input, value: 2, revision: 1 }),
      svc.saveImweb(a, actor, date, { ...input, value: 3, revision: 1 }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await svc.history(a, date, 'TPI')).rows).toHaveLength(2);
  });
  it('records changed GA only, preserves Imweb and supports metric switch back', async () => {
    await svc.saveImweb(a, actor, date, { ...input, value: 20 });
    await svc.recordGa(a, ga);
    await svc.recordGa(a, ga);
    expect((await svc.history(a, date, 'TPI')).rows).toHaveLength(2);
    await svc.recordGa(a, { ...ga, value: 13 });
    expect((await svc.history(a, date, 'TPI')).rows).toHaveLength(3);
    await svc.recordGa(a, { ...ga, metric: 'totalUsers', value: 19 });
    expect((await svc.range(a, date, date, 'TPI')).rows[0].ga4?.metric).toBe(
      'totalUsers',
    );
    await svc.recordGa(a, { ...ga, value: 13 });
    const r = (await svc.range(a, date, date, 'TPI')).rows[0];
    expect(r.ga4?.metric).toBe('activeUsers');
    expect(r.imweb?.value).toBe(20);
    expect(r.difference).toBe(7);
  });
  it('reads legacy GA without inventing metric and new GA supersedes it', async () => {
    await ds.query(
      `INSERT INTO amb_acm_dsh_site_visit(ent_id,svt_site,svt_date,svt_visitors,svt_source) VALUES($1,'TPI',$2,100,'GA4')`,
      [a, date],
    );
    expect((await svc.range(a, date, date, 'TPI')).rows[0].ga4).toMatchObject({
      metric: 'unknown',
      value: 100,
    });
    await svc.recordGa(a, ga);
    expect((await svc.range(a, date, date, 'TPI')).rows[0].ga4).toMatchObject({
      metric: 'activeUsers',
      value: 12,
    });
  });
  it('validates dates, values, timezone, revision and site before writing', async () => {
    for (const patch of [
      { value: -1 },
      { value: 1.5 },
      { value: '12' },
      { timezone: 'invalid/zone' },
      { site: 'ALL' },
      { note: '' },
      { revision: -1 },
    ])
      await expect(
        svc.saveImweb(a, actor, date, { ...input, ...patch }),
      ).rejects.toMatchObject({ status: 400 });
    await expect(
      svc.saveImweb(a, actor, '2026-02-30', input),
    ).rejects.toMatchObject({ status: 400 });
    expect((await svc.history(a, date, 'TPI')).rows).toHaveLength(0);
  });
});
