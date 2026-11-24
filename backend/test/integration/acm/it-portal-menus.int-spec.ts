import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { bootAcmTestEnv, type AcmTestEnv } from './setup';
import { AcmPostsModule } from '../../../src/modules/acm-posts/acm-posts.module';
import { PostService } from '../../../src/modules/acm-posts/application/services/post.service';
import { PortalNoticeController } from '../../../src/modules/acm-posts/presentation/portal-notice.controller';
import {
  PortalMenuService,
  type PortalMenuKind,
} from '../../../src/modules/acm-system/application/portal-menu.service';
import type { PortalAuthUser } from '../../../src/modules/acm-auth/application/portal-account.service';

const TPI = '00000000-0000-0000-0000-000000000001';
const OTHER = randomUUID();
describe('teacher/student portal menus and notices (PostgreSQL)', () => {
  let env: AcmTestEnv;
  let menus: PortalMenuService;
  let notices: PortalNoticeController;
  let master: string;
  let otherMaster: string;
  const tokens = new Map<string, string>();
  const principal = (kind: PortalMenuKind, entId = TPI): PortalAuthUser => ({
    id: randomUUID(),
    entId,
    refId: randomUUID(),
    kind,
    loginId: 'fixture',
    mustChangePassword: false,
  });
  const admin = () => ({
    'x-test-user': master,
    'x-test-ent': TPI,
    'x-test-role': 'ADMIN',
  });

  beforeAll(async () => {
    env = await bootAcmTestEnv([AcmPostsModule]);
    menus = env.app.get(PortalMenuService);
    notices = env.app.get(PortalNoticeController);
    await env.ds.query(
      'INSERT INTO amb_acm_tenant(tnt_ent_id,tnt_name) VALUES ($1,$2)',
      [OTHER, 'Other fixture'],
    );
    for (const ent of [TPI, OTHER]) {
      const [{ usr_id }] = await env.ds.query<{ usr_id: string }[]>(
        `INSERT INTO amb_acm_user(ent_id,usr_email,usr_password_hash,usr_name,usr_role)
         VALUES ($1,$2,'fixture','Fixture master','ADMIN') RETURNING usr_id`,
        [ent, `${ent}@fixture.test`],
      );
      await env.ds.query(
        "INSERT INTO amb_acm_user_permission(ent_id,usr_id,upr_permission) VALUES ($1,$2,'TENANT_MASTER')",
        [ent, usr_id],
      );
      if (ent === TPI) master = usr_id;
      else otherMaster = usr_id;
    }
    const posts = env.app.get(PostService);
    for (const entId of [TPI, OTHER]) {
      for (const kind of ['TEACHER', 'STUDENT'] as const) {
        const [{ pac_id }] = await env.ds.query<{ pac_id: string }[]>(
          `INSERT INTO amb_acm_portal_account(ent_id,pac_kind,pac_ref_id,pac_login_id,pac_password_hash,pac_must_change_password)
           VALUES ($1,$2,$3,$4,'fixture',false) RETURNING pac_id`,
          [entId, kind, randomUUID(), `fixture-${kind}`],
        );
        tokens.set(
          `${entId}:${kind}`,
          new JwtService({ secret: 'acm-test-secret' }).sign(
            { sub: pac_id, entId, kind },
            { expiresIn: '10m' },
          ),
        );
      }
    }
    for (const ent of [TPI, OTHER]) {
      await posts.upsert({
        entId: ent,
        slug: 'shared-fixture',
        title: ent,
        bodyMd: 'fixture body',
        category: 'NOTICE',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });
    }
    await posts.upsert({
      entId: TPI,
      slug: 'draft-fixture',
      title: 'Draft',
      bodyMd: '',
      category: 'NOTICE',
      status: 'DRAFT',
    });
    await posts.upsert({
      entId: TPI,
      slug: 'event-fixture',
      title: 'Event',
      bodyMd: '',
      category: 'EVENT',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    await posts.upsert({
      entId: OTHER,
      slug: 'foreign-only',
      title: 'Other only',
      bodyMd: '',
      category: 'NOTICE',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
  });
  beforeEach(async () => {
    await env.ds.query(
      'DELETE FROM amb_acm_tenant_portal_menu WHERE ent_id IN ($1,$2)',
      [TPI, OTHER],
    );
    await env.ds.query(
      'DELETE FROM amb_acm_tenant_menu WHERE tnm_ent_id IN ($1,$2)',
      [TPI, OTHER],
    );
  });
  afterAll(async () => {
    if (env) {
      await env.app.close();
      await env.pg.stop();
    }
  });

  it('defaults notices off, preserves role restrictions and parent navigation', async () => {
    const response = await request(env.app.getHttpServer())
      .get('/api/acm/tenant/portal-menus')
      .set(admin())
      .expect(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'notices',
          roles: { TEACHER: false, STUDENT: false },
        }),
        expect.objectContaining({
          key: 'calendar',
          roles: { TEACHER: true, STUDENT: false },
          locked: ['STUDENT'],
        }),
        expect.objectContaining({
          key: 'me',
          roles: { TEACHER: true, STUDENT: true },
          alwaysOn: true,
        }),
      ]),
    );
    expect((await menus.nav(TPI, 'PARENT')).visible).toContain('notices');
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    'independently applies teacher=%s student=%s to notice list and detail',
    async (teacher, student) => {
      await request(env.app.getHttpServer())
        .put('/api/acm/tenant/portal-menus')
        .set(admin())
        .send({
          items: [
            { key: 'notices', kind: 'TEACHER', visible: teacher },
            { key: 'notices', kind: 'STUDENT', visible: student },
          ],
        })
        .expect(200);
      for (const [kind, visible] of [
        ['TEACHER', teacher],
        ['STUDENT', student],
      ] as const) {
        const user = principal(kind);
        if (visible) {
          expect(
            (await notices.list(user)).every(
              (post) => post.category === 'NOTICE',
            ),
          ).toBe(true);
          expect(await notices.detail(user, 'shared-fixture')).toMatchObject({
            title: TPI,
            bodyMd: 'fixture body',
          });
        } else {
          await expect(notices.list(user)).rejects.toThrow(
            'PORTAL_MENU_HIDDEN',
          );
          await expect(notices.detail(user, 'shared-fixture')).rejects.toThrow(
            'PORTAL_MENU_HIDDEN',
          );
        }
      }
    },
  );

  it('scopes settings and same-slug notice details to the authenticated tenant', async () => {
    await menus.save(TPI, [{ key: 'notices', kind: 'TEACHER', visible: true }]);
    expect((await menus.nav(OTHER, 'TEACHER')).visible).not.toContain(
      'notices',
    );
    await request(env.app.getHttpServer())
      .put('/api/acm/tenant/portal-menus')
      .set({
        'x-test-user': otherMaster,
        'x-test-ent': OTHER,
        'x-test-role': 'ADMIN',
      })
      .send({ items: [{ key: 'notices', kind: 'TEACHER', visible: true }] })
      .expect(200);
    expect(
      await notices.detail(principal('TEACHER', OTHER), 'shared-fixture'),
    ).toMatchObject({ title: OTHER });
    await expect(
      notices.detail(principal('TEACHER'), 'foreign-only'),
    ).rejects.toThrow('POST_NOT_FOUND');
    await expect(
      notices.detail(principal('TEACHER'), 'draft-fixture'),
    ).rejects.toThrow('POST_NOT_FOUND');
    await expect(
      notices.detail(principal('TEACHER'), 'event-fixture'),
    ).rejects.toThrow('POST_NOT_FOUND');
  });

  it('keeps console role settings separate and system entitlement as an upper limit', async () => {
    await env.ds.query(
      "INSERT INTO amb_acm_tenant_role_menu(ent_id,trm_role,trm_menu_key,trm_visible) VALUES ($1,'TEACHER','posts',false) ON CONFLICT DO NOTHING",
      [TPI],
    );
    await menus.save(TPI, [{ key: 'notices', kind: 'TEACHER', visible: true }]);
    expect((await menus.nav(TPI, 'TEACHER')).visible).toContain('notices');
    const [{ trm_visible }] = await env.ds.query<{ trm_visible: boolean }[]>(
      "SELECT trm_visible FROM amb_acm_tenant_role_menu WHERE ent_id=$1 AND trm_role='TEACHER' AND trm_menu_key='posts'",
      [TPI],
    );
    expect(trm_visible).toBe(false);
    await env.ds.query(
      "INSERT INTO amb_acm_tenant_menu(tnm_ent_id,tnm_menu_key,tnm_visible) VALUES ($1,'posts',false)",
      [TPI],
    );
    expect((await menus.nav(TPI, 'TEACHER')).visible).not.toContain('notices');
    await expect(notices.list(principal('TEACHER'))).rejects.toThrow(
      'PORTAL_MENU_HIDDEN',
    );
    await expect(
      menus.save(TPI, [{ key: 'notices', kind: 'TEACHER', visible: true }]),
    ).rejects.toThrow('INVALID_PORTAL_MENU');
  });

  it.each([
    [
      { key: 'notices', kind: 'TEACHER', visible: true },
      { key: 'calendar', kind: 'STUDENT', visible: true },
    ],
    [{ key: 'me', kind: 'TEACHER', visible: false }],
    [{ key: 'notices', kind: 'PARENT', visible: true }],
    [{ key: 'unknown', kind: 'TEACHER', visible: true }],
    [{ key: 'notices', kind: 'TEACHER', visible: 'true' }],
    [
      { key: 'notices', kind: 'TEACHER', visible: true },
      { key: 'notices', kind: 'TEACHER', visible: false },
    ],
  ])(
    'rejects invalid/locked/duplicate payload without partial writes: %j',
    async (...items) => {
      await request(env.app.getHttpServer())
        .put('/api/acm/tenant/portal-menus')
        .set(admin())
        .send({ items })
        .expect(400);
      const [{ count }] = await env.ds.query<{ count: number }[]>(
        'SELECT count(*)::int AS count FROM amb_acm_tenant_portal_menu WHERE ent_id=$1',
        [TPI],
      );
      expect(count).toBe(0);
    },
  );

  it('requires tenant-master permission and rejects a foreign tenant in the body', async () => {
    await request(env.app.getHttpServer())
      .put('/api/acm/tenant/portal-menus')
      .set({
        'x-test-user': randomUUID(),
        'x-test-ent': TPI,
        'x-test-role': 'TEACHER',
      })
      .send({ items: [] })
      .expect(403);
    await request(env.app.getHttpServer())
      .put('/api/acm/tenant/portal-menus')
      .set(admin())
      .send({ entId: OTHER, items: [] })
      .expect(403);
  });

  it('uses the real portal JWT guard for navigation/list/detail and reacts to settings changes', async () => {
    const server = env.app.getHttpServer();
    await request(server).get('/api/portal/me/menus').expect(401);
    await request(server).get('/api/portal/posts/notices').expect(401);
    await request(server)
      .get('/api/portal/posts/notices/shared-fixture')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    await menus.save(TPI, [{ key: 'notices', kind: 'TEACHER', visible: true }]);
    const teacherAuth = `Bearer ${tokens.get(`${TPI}:TEACHER`)}`;
    const studentAuth = `Bearer ${tokens.get(`${TPI}:STUDENT`)}`;
    const nav = await request(server)
      .get('/api/portal/me/menus')
      .set('Authorization', teacherAuth)
      .expect(200);
    expect(nav.body.visible).toContain('notices');
    await request(server)
      .get('/api/portal/posts/notices')
      .set('Authorization', teacherAuth)
      .expect(200);
    const detail = await request(server)
      .get('/api/portal/posts/notices/shared-fixture')
      .set('Authorization', teacherAuth)
      .expect(200);
    expect(detail.body.title).toBe(TPI);
    await request(server)
      .get('/api/portal/posts/notices/shared-fixture')
      .set('Authorization', studentAuth)
      .expect(403);
    const foreign = `Bearer ${tokens.get(`${OTHER}:TEACHER`)}`;
    await request(server)
      .get('/api/portal/posts/notices')
      .set('Authorization', foreign)
      .expect(403);
    await menus.save(TPI, [
      { key: 'notices', kind: 'TEACHER', visible: false },
    ]);
    await request(server)
      .get('/api/portal/posts/notices')
      .set('Authorization', teacherAuth)
      .expect(403);
  });

  it('rejects malformed nested items without throwing or writing rows', async () => {
    await request(env.app.getHttpServer())
      .put('/api/acm/tenant/portal-menus')
      .set(admin())
      .send({ items: [null] })
      .expect(400);
  });

  it('falls back to my profile when all optional menus are disabled and survives migration replay', async () => {
    for (const kind of ['TEACHER', 'STUDENT'] as const) {
      await menus.save(
        TPI,
        (await menus.matrix(TPI))
          .filter((item) => !item.alwaysOn && !item.locked.includes(kind))
          .map((item) => ({ key: item.key, kind, visible: false })),
      );
      expect(await menus.nav(TPI, kind)).toEqual({
        visible: ['me'],
        home: '/portal/me',
      });
    }
    await env.ds.query(
      readFileSync(
        resolve(__dirname, '../../../../sql/acm/1071-tenant-portal-menu.sql'),
        'utf8',
      ),
    );
    expect(await menus.nav(TPI, 'TEACHER')).toEqual({
      visible: ['me'],
      home: '/portal/me',
    });
    // Public homepage news is intentionally separate from authenticated portal notices.
    await request(env.app.getHttpServer())
      .get('/api/portal/news?category=NOTICE')
      .expect(200);
  });
});
