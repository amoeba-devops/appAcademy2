import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  CUSTOM_MENU_LIMIT,
  TenantCustomMenuService,
} from '../../../src/modules/acm-system/application/tenant-custom-menu.service';

// REQ-261026 — 테넌트 사용자 메뉴(북마크).
const TPI = '00000000-0000-0000-0000-000000000001';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sql = (f: string) =>
  readFileSync(resolve(__dirname, '../../../../sql/acm', f), 'utf8');
const menu = (name: string, url = '/admin/csl') => ({
  name,
  url,
  newTab: false,
  roles: ['ADMIN', 'TEACHER', 'STAFF'] as ('ADMIN' | 'TEACHER' | 'STAFF')[],
});

describe('tenant custom menus (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let db: DataSource;
  let svc: TenantCustomMenuService;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withDatabase('tcm_test')
      .withUsername('tcm_test')
      .withPassword('tcm_test')
      .withPullPolicy({ shouldPull: () => false })
      .start();
    db = await new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      synchronize: false,
    }).initialize();
    await db.query(`CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;`);
    // 두 번 적용해 멱등성 확인.
    await db.query(sql('1053-tenant-custom-menu.sql'));
    await db.query(sql('1053-tenant-custom-menu.sql'));
    svc = new TenantCustomMenuService(db);
  }, 120_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (pg) await pg.stop();
  });

  it('adds, edits, reorders and deletes within the tenant', async () => {
    await svc.create(TPI, menu('A'));
    await svc.create(TPI, {
      ...menu('B', 'https://x.com'),
      newTab: true,
      roles: ['ADMIN'],
    });
    let list = await svc.create(TPI, menu('C'));
    expect(list.map((i) => i.name)).toEqual(['A', 'B', 'C']);
    expect(list[1]).toMatchObject({
      url: 'https://x.com',
      newTab: true,
      roles: ['ADMIN'],
    });

    list = await svc.update(TPI, list[0].id, {
      ...menu('A2'),
      roles: ['STAFF', 'ADMIN'],
    });
    expect(list[0]).toMatchObject({ name: 'A2', roles: ['ADMIN', 'STAFF'] });

    const [a, b, c] = list.map((i) => i.id);
    list = await svc.reorder(TPI, [c, a]);
    expect(list.map((i) => i.id)).toEqual([c, a, b]);

    list = await svc.remove(TPI, a);
    expect(list.map((i) => i.id)).toEqual([c, b]);
    // 다른 테넌트에서는 보이지도, 고쳐지지도 않는다.
    expect(await svc.list(OTHER)).toEqual([]);
    await expect(svc.remove(OTHER, b)).rejects.toThrow('not found');
    await expect(svc.update(OTHER, b, menu('X'))).rejects.toThrow('not found');
  });

  it('filters the sidebar by role', async () => {
    expect(
      (await svc.navFor(TPI, 'TEACHER', false)).map((i) => i.name),
    ).toEqual(['C']);
    expect((await svc.navFor(TPI, 'TEACHER', true)).map((i) => i.name)).toEqual(
      ['C', 'B'],
    );
    expect((await svc.navFor(TPI, 'ADMIN', false))[1]).toEqual({
      id: expect.any(String) as string,
      name: 'B',
      url: 'https://x.com',
      newTab: true,
    });
  });

  it('the database refuses unsafe links', async () => {
    await expect(
      db.query(
        `INSERT INTO amb_acm_tenant_custom_menu (ent_id, tcm_name, tcm_url) VALUES ($1, 'x', 'javascript:alert(1)')`,
        [TPI],
      ),
    ).rejects.toThrow(/chk_acm_tcm_url/);
  });

  it(`caps a tenant at ${CUSTOM_MENU_LIMIT} items, even concurrently`, async () => {
    const existing = (await svc.list(OTHER)).length;
    const results = await Promise.allSettled(
      Array.from({ length: CUSTOM_MENU_LIMIT + 3 - existing }, (_, i) =>
        svc.create(OTHER, menu(`M${i}`)),
      ),
    );
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
    expect(await svc.list(OTHER)).toHaveLength(CUSTOM_MENU_LIMIT);
  });
});
