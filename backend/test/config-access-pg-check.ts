import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { ACM_DS } from '../src/modules/acm-common/datasource';
import { AcmJwtAuthGuard } from '../src/modules/acm-auth/guards/acm-jwt-auth.guard';
import { ConfigAccessController } from '../src/modules/acm-system/presentation/config-access.controller';
import { TenantService } from '../src/modules/acm-system/application/tenant.service';

async function main() {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  let app:
    | Awaited<
        ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
      >
    | undefined;
  try {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          name: ACM_DS,
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [],
          synchronize: false,
        }),
      ],
      controllers: [ConfigAccessController],
      providers: [
        {
          provide: TenantService,
          useValue: {
            getMenuConfig: async () => [
              { key: 'dashboard', visible: true, alwaysOn: true, order: 0 },
              { key: 'pay', visible: true, alwaysOn: false, order: 8 },
              { key: 'config', visible: false, alwaysOn: false, order: 12 },
            ],
          },
        },
      ],
    })
      .overrideGuard(AcmJwtAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            id: req.headers['x-test-user'],
            entId: req.headers['x-test-tenant'],
          };
          return !!req.user.id;
        },
      })
      .compile();
    app = module;
    const ds = module.get<DataSource>(getDataSourceToken(ACM_DS));
    await ds.query(`CREATE TABLE amb_acm_user(usr_id UUID PRIMARY KEY,ent_id UUID NOT NULL,usr_email TEXT,usr_status TEXT,usr_role TEXT);
      CREATE TABLE amb_acm_tenant_menu(tnm_ent_id UUID,tnm_menu_key TEXT,tnm_visible BOOLEAN,tnm_order SMALLINT,updated_at TIMESTAMPTZ DEFAULT NOW(),PRIMARY KEY(tnm_ent_id,tnm_menu_key));`);
    const sql = readFileSync(
      '../sql/acm/999x-config-admin-permission.sql',
      'utf8',
    );
    await ds.query(sql);
    await ds.query(sql);
    const tenant = '00000000-0000-0000-0000-000000000001';
    const other = '00000000-0000-0000-0000-000000000002';
    const user = '465380c8-0b7f-4ef6-81bd-5aa732fdc8df';
    const unprivileged = '00000000-0000-0000-0000-000000000003';
    await ds.query(
      `INSERT INTO amb_acm_user VALUES($1,$2,'fremd@naver.com','ACTIVE','ADMIN'),($3,$2,'test@example.invalid','ACTIVE','APP_ADMIN')`,
      [user, tenant, unprivileged],
    );
    const http = module.createNestApplication();
    http.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await http.init();
    const call = (id = user, ent = tenant) =>
      request(http.getHttpServer())
        .get('/acm/me/config-menus')
        .set('x-test-user', id)
        .set('x-test-tenant', ent);
    await call().expect(403);
    const grant = readFileSync(
      '../scripts/operations/grant-config-admin-fremd.sql',
      'utf8',
    );
    await ds.query(grant);
    await ds.query(grant);
    const permissionCount = await ds.query(
      'SELECT count(*)::int n FROM amb_acm_user_permission',
    );
    assert.equal(permissionCount[0].n, 1);
    assert.equal(
      (
        await ds.query('SELECT usr_role FROM amb_acm_user WHERE usr_id=$1', [
          user,
        ])
      )[0].usr_role,
      'ADMIN',
    );
    await call().expect(200);
    await call(unprivileged).expect(403);
    await call(user, other).expect(403);
    await ds.query(
      'INSERT INTO amb_acm_tenant_menu(tnm_ent_id,tnm_menu_key,tnm_visible,tnm_order) VALUES($1,$2,true,17),($3,$2,true,3)',
      [tenant, 'pay', other],
    );
    await request(http.getHttpServer())
      .put('/acm/me/config-menus')
      .set('x-test-user', user)
      .set('x-test-tenant', tenant)
      .send({ items: [{ key: 'pay', visible: false }] })
      .expect(200);
    const rows = await ds.query(
      'SELECT tnm_ent_id,tnm_visible,tnm_order FROM amb_acm_tenant_menu ORDER BY tnm_ent_id',
    );
    assert.equal(rows[0].tnm_visible, false);
    assert.equal(rows[0].tnm_order, 17);
    assert.equal(rows[1].tnm_visible, true);
    assert.equal(rows[1].tnm_order, 3);
    for (const body of [
      { items: [{ key: 'config', visible: false }] },
      { items: [{ key: 'bogus', visible: false }] },
      { entId: other, items: [{ key: 'pay', visible: true }] },
    ]) {
      await request(http.getHttpServer())
        .put('/acm/me/config-menus')
        .set('x-test-user', user)
        .set('x-test-tenant', tenant)
        .send(body)
        .expect('entId' in body ? 403 : 400);
    }
    await ds.query('DELETE FROM amb_acm_user_permission WHERE usr_id=$1', [
      user,
    ]);
    await call().expect(403);
    await http.close();
    console.log(
      'PASS: migration/grant idempotence, role preservation, permission grant/revoke, HTTP guard, tenant isolation, visibility-only update, input validation',
    );
  } finally {
    await app?.close();
    await container.stop();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
