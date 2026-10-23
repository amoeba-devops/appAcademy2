import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { AcmUserTypeormEntity } from '../../../src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmTenantTypeormEntity } from '../../../src/modules/acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from '../../../src/modules/acm-system/infrastructure/typeorm/acm-tenant-menu.typeorm-entity';
import { TenantService } from '../../../src/modules/acm-system/application/tenant.service';
import { TenantRoleMenuService } from '../../../src/modules/acm-system/application/tenant-role-menu.service';
import { hasUserPermission } from '../../../src/modules/acm-common/guards/config-admin.guard';
import { SystemUserService } from '../../../src/modules/acm-system/application/system-user.service';
import type { AcmAuthService } from '../../../src/modules/acm-auth/application/acm-auth.service';

// REQ-261015C WP2 — 테넌트 마스터 + 등급별 메뉴 노출.
const TPI = '00000000-0000-0000-0000-000000000001';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sql = (f: string) =>
  readFileSync(resolve(__dirname, '../../../../sql/acm', f), 'utf8');

describe('tenant master and per-role menus (PostgreSQL)', () => {
  let pg: StartedPostgreSqlContainer;
  let db: DataSource;
  let svc: TenantRoleMenuService;
  let tenants: TenantService;
  let master: string;
  let teacher: string;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer(
      process.env.ACM_TEST_PG_IMAGE ?? 'tac-postgres-acm:pg16-bigm',
    )
      .withDatabase('trm_test')
      .withUsername('trm_test')
      .withPassword('trm_test')
      .withPullPolicy({ shouldPull: () => false })
      .start();
    db = await new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      entities: [
        AcmUserTypeormEntity,
        AcmTenantTypeormEntity,
        AcmTenantMenuTypeormEntity,
      ],
      synchronize: false,
    }).initialize();
    await db.query(`CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;`);
    for (const f of [
      '500-acm-auth.sql',
      '505-migration-user-role.sql',
      '510-acm-ama-sso.sql',
      '510-migration-app-admin-role.sql',
      '520-acm-tenant.sql',
      '920-acm-ama-config.sql',
      '992-acm-tenant-postgres-only.sql',
      '998-acm-tenant-code.sql',
      '1006-acm-tenant-timezone.sql',
      '999k-acm-tenant-menu-order.sql',
      '999x-config-admin-permission.sql',
    ])
      await db.query(sql(f));
    // 사용자 엔티티 전체 컬럼(830/880 의 사용자 부분만).
    await db.query(
      `ALTER TABLE amb_acm_user ADD COLUMN IF NOT EXISTS usr_locked_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS usr_ama_job_role VARCHAR(40),
         ADD COLUMN IF NOT EXISTS usr_temp_password_expires_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS usr_local_pinned BOOLEAN NOT NULL DEFAULT false`,
    );
    const insert = async (ent: string, email: string, role: string) =>
      (
        await db.query<{ usr_id: string }[]>(
          `INSERT INTO amb_acm_user (ent_id, usr_email, usr_password_hash, usr_name, usr_role)
           VALUES ($1,$2,'x',$2,$3) ON CONFLICT (ent_id, usr_email)
           DO UPDATE SET usr_role = EXCLUDED.usr_role RETURNING usr_id`,
          [ent, email, role],
        )
      )[0].usr_id;
    // 500 이 시드한 admin@tpi.co.kr 이 최초 테넌트 마스터 대상이다.
    master = (
      await db.query<{ usr_id: string }[]>(
        `SELECT usr_id FROM amb_acm_user WHERE ent_id=$1 AND usr_email='admin@tpi.co.kr'`,
        [TPI],
      )
    )[0].usr_id;
    teacher = await insert(TPI, 't@example.com', 'TEACHER');
    // 1035 를 두 번 적용해 멱등성 확인.
    await db.query(sql('1035-tenant-master-role-menu.sql'));
    await db.query(sql('1035-tenant-master-role-menu.sql'));
    tenants = new TenantService(
      db.getRepository(AcmTenantTypeormEntity),
      db.getRepository(AcmTenantMenuTypeormEntity),
      db.getRepository(AcmUserTypeormEntity),
    );
    svc = new TenantRoleMenuService(db, tenants);
  }, 120_000);

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (pg) await pg.stop();
  });

  it('migration grants admin@tpi.co.kr the tenant master permission once', async () => {
    expect(
      await hasUserPermission(db, { id: master, entId: TPI }, 'TENANT_MASTER'),
    ).toBe(true);
    expect(
      await hasUserPermission(db, { id: teacher, entId: TPI }, 'TENANT_MASTER'),
    ).toBe(false);
    expect(
      await hasUserPermission(
        db,
        { id: master, entId: OTHER },
        'TENANT_MASTER',
      ),
    ).toBe(false);
    expect(await svc.masters(TPI)).toHaveLength(1);
  });

  it('only menus allowed by the system admin appear, without config', async () => {
    await tenants.setMenuConfig(TPI, [{ key: 'qna', visible: false }]);
    const keys = (await svc.matrix(TPI)).map((i) => i.key);
    expect(keys).not.toContain('qna');
    expect(keys).not.toContain('config');
    expect(keys[0]).toBe('dashboard');
    await expect(
      svc.save(TPI, [{ key: 'qna', role: 'STAFF', visible: false }]),
    ).rejects.toThrow();
  });

  it('hides per role, keeps dashboard fixed and pay locked for teachers', async () => {
    await svc.save(TPI, [
      { key: 'csl', role: 'TEACHER', visible: false },
      { key: 'projects', role: 'STAFF', visible: false },
    ]);
    const matrix = await svc.matrix(TPI);
    const csl = matrix.find((i) => i.key === 'csl')!;
    expect(csl.roles).toEqual({ ADMIN: true, TEACHER: false, STAFF: true });
    expect(matrix.find((i) => i.key === 'pay')!.locked).toEqual(['TEACHER']);
    await expect(
      svc.save(TPI, [{ key: 'dashboard', role: 'STAFF', visible: false }]),
    ).rejects.toThrow();
    await expect(
      svc.save(TPI, [{ key: 'pay', role: 'TEACHER', visible: true }]),
    ).rejects.toThrow();

    const tch = await svc.navFor(TPI, 'TEACHER');
    expect(tch.hidden).toEqual(expect.arrayContaining(['csl', 'qna']));
    expect(tch.hidden).not.toContain('projects');
    const staff = await svc.navFor(TPI, 'STAFF');
    expect(staff.hidden).toContain('projects');
    expect(staff.hidden).not.toContain('csl');
    // APP_ADMIN 등 등급 외 역할은 테넌트 허가만 적용.
    expect((await svc.navFor(TPI, 'APP_ADMIN')).hidden).toEqual(['qna']);
    // 테넌트 마스터는 등급 숨김 없이 시스템 허가 메뉴를 모두 본다.
    expect((await svc.navFor(TPI, 'STAFF', true)).hidden).toEqual(['qna']);
    expect((await svc.navFor(TPI, 'TEACHER', true)).hidden).toEqual(['qna']);
    // 다른 테넌트에는 영향이 없다.
    expect((await svc.navFor(OTHER, 'TEACHER')).hidden).toEqual([]);
  });

  it('restoring visibility deletes the override row', async () => {
    await svc.save(TPI, [{ key: 'csl', role: 'TEACHER', visible: true }]);
    const rows = await db.query(
      `SELECT 1 FROM amb_acm_tenant_role_menu WHERE ent_id=$1 AND trm_menu_key='csl'`,
      [TPI],
    );
    expect(rows).toHaveLength(0);
  });

  it('system admin lists a fixed-id tenant and edits supplemental permissions', async () => {
    const users = new SystemUserService(
      db.getRepository(AcmUserTypeormEntity),
      db.getRepository(AcmTenantTypeormEntity),
      {} as AcmAuthService,
    );
    // REQ-261016D — 고정 ID 테넌트 필터 + 보조 권한 표시·교체.
    const list = await users.list({ entId: TPI });
    expect(list.items.find((u) => u.id === master)?.permissions).toEqual([
      'TENANT_MASTER',
    ]);
    const view = await users.setPermissions(
      teacher,
      ['CONFIG_ADMIN', 'TENANT_MASTER'],
      master,
    );
    expect(view.permissions).toEqual(['CONFIG_ADMIN', 'TENANT_MASTER']);
    expect(
      await hasUserPermission(db, { id: teacher, entId: TPI }, 'CONFIG_ADMIN'),
    ).toBe(true);
    expect(
      (await users.setPermissions(teacher, [], master)).permissions,
    ).toEqual([]);
    expect(
      await hasUserPermission(db, { id: teacher, entId: TPI }, 'TENANT_MASTER'),
    ).toBe(false);
  });
  it('grants and revokes masters only for users of that tenant', async () => {
    await svc.grantMaster(TPI, teacher);
    expect((await svc.masters(TPI)).map((m) => m.id)).toContain(teacher);
    await svc.revokeMaster(TPI, teacher);
    expect((await svc.masters(TPI)).map((m) => m.id)).not.toContain(teacher);
    await expect(svc.grantMaster(OTHER, teacher)).rejects.toThrow();
  });
});
