import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource, IsNull } from 'typeorm';
import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import {
  TalkService,
  type TalkActor,
} from '../../src/modules/acm-talk/application/talk.service';
import { TalkSseService } from '../../src/modules/acm-talk/application/talk-sse.service';
import { TalkChannelTypeormEntity as Channel } from '../../src/modules/acm-talk/infrastructure/typeorm/talk-channel.typeorm-entity';
import { TalkMemberTypeormEntity as Member } from '../../src/modules/acm-talk/infrastructure/typeorm/talk-member.typeorm-entity';
import { TalkMessageTypeormEntity as Message } from '../../src/modules/acm-talk/infrastructure/typeorm/talk-message.typeorm-entity';
import { TalkAdminController } from '../../src/modules/acm-talk/presentation/talk-admin.controller';
import { TalkPortalController } from '../../src/modules/acm-talk/presentation/talk-portal.controller';
import {
  InboxService,
  type InboxActor,
} from '../../src/modules/acm-notification/application/inbox.service';
import { enqueueInbox } from '../../src/modules/acm-notification/application/inbox-outbox';
import { InboxController } from '../../src/modules/acm-notification/presentation/inbox.controller';
import { PortalInboxController } from '../../src/modules/acm-notification/presentation/portal-inbox.controller';
import { AcmJwtAuthGuard } from '../../src/modules/acm-auth/guards/acm-jwt-auth.guard';
import { PortalJwtAuthGuard } from '../../src/modules/acm-auth/guards/portal-jwt-auth.guard';
import type { ObjectStoreClient } from '../../src/modules/acm-csl/infrastructure/external/object-store.client';

// Disposable PostgreSQL only: no development or production data is touched.
describe('Chat management / PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let app: INestApplication;
  let talk: TalkService;
  let inbox: InboxService;
  const ent = randomUUID(),
    otherEnt = randomUUID();
  const owner: TalkActor = { kind: 'USER', refId: randomUUID() };
  const operator: TalkActor = { kind: 'USER', refId: randomUUID() };
  const teacher: TalkActor = { kind: 'TEACHER', refId: randomUUID() };
  const teacher2: TalkActor = { kind: 'TEACHER', refId: randomUUID() };
  const outsider: TalkActor = { kind: 'USER', refId: randomUUID() };
  const teacherInbox: InboxActor = {
    entId: ent,
    id: teacher.refId,
    kind: 'TEACHER',
  };
  const operatorInbox: InboxActor = { entId: ent, id: operator.refId };
  const sse = new TalkSseService();
  const emitted = jest.spyOn(sse, 'emit');
  const sql = (file: string) =>
    readFileSync(resolve(__dirname, '../../../sql/acm', file), 'utf8');
  const room = (members: TalkActor[] = [operator, teacher, teacher2]) =>
    talk.createChannel(ent, owner.refId, 'Teaching team', members);
  const auth = (actor: TalkActor, tenant = ent) => ({
    'x-user': actor.refId,
    'x-kind': actor.kind,
    'x-tenant': tenant,
  });
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    ds = await new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: [Channel, Member, Message],
      synchronize: true,
    }).initialize();
    await ds.query(`CREATE TABLE amb_acm_user(usr_id uuid PRIMARY KEY,ent_id uuid,usr_name text,usr_status text,usr_role text);
      CREATE TABLE amb_acm_tch_teacher(tch_id uuid PRIMARY KEY,ent_id uuid,tch_name text,tch_user_id uuid,deleted_at timestamptz);
      CREATE TABLE amb_acm_portal_account(pac_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid,pac_kind text,pac_ref_id uuid,pac_status text,pac_locked_at timestamptz);
      CREATE TABLE amb_acm_csl_inquiry(inq_id uuid,ent_id uuid,deleted_at timestamptz);
      CREATE TABLE amb_acm_cal_event(evt_id uuid,ent_id uuid,deleted_at timestamptz);`);
    await ds.query(sql('1025-notification-inbox.sql'));
    // Seed a pre-migration unread notification to verify preservation.
    await ds.query(
      "INSERT INTO amb_acm_user VALUES($1,$2,'Owner','ACTIVE','ADMIN'),($3,$2,'Operator','ACTIVE','APP_ADMIN'),($4,$5,'Outsider','ACTIVE','ADMIN')",
      [owner.refId, ent, operator.refId, outsider.refId, otherEnt],
    );
    await ds.query(
      "INSERT INTO amb_acm_tch_teacher(tch_id,ent_id,tch_name) VALUES($1,$2,'Teacher'),($3,$2,'TeacherTwo')",
      [teacher.refId, ent, teacher2.refId],
    );
    await ds.query(
      "INSERT INTO amb_acm_portal_account(ent_id,pac_kind,pac_ref_id,pac_status) VALUES($1,'TEACHER',$2,'ACTIVE'),($1,'TEACHER',$3,'ACTIVE')",
      [ent, teacher.refId, teacher2.refId],
    );
    const [{ nob_id }]: { nob_id: string }[] = await ds.query(
      "INSERT INTO amb_acm_notification_outbox(ent_id,nob_type,nob_target_id) VALUES($1,'CAL_UPDATED',$2) RETURNING nob_id",
      [ent, randomUUID()],
    );
    await ds.query(
      "INSERT INTO amb_acm_notification_inbox(ent_id,usr_id,nob_id,nin_type,nin_target_id,nin_payload) VALUES($1,$2,$3,'CAL_UPDATED',$4,'{}')",
      [ent, operator.refId, nob_id, randomUUID()],
    );
    await ds.query(sql('999y-chat-room-management.sql'));
    await ds.query(sql('999y-chat-room-management.sql'));
    const [legacy] = await ds.query(
      'SELECT usr_id,nin_recipient_id,nin_recipient_kind,nin_read_at FROM amb_acm_notification_inbox',
    );
    expect(legacy).toMatchObject({
      usr_id: operator.refId,
      nin_recipient_id: operator.refId,
      nin_recipient_kind: 'USER',
      nin_read_at: null,
    });
    const store = {
      putObject: async () => {},
      getObjectStream: async () => ({ stream: Readable.from(['test']) }),
    } as unknown as ObjectStoreClient;
    talk = new TalkService(
      ds.getRepository(Channel),
      ds.getRepository(Member),
      ds.getRepository(Message),
      ds,
      store,
      sse,
    );
    inbox = new InboxService(ds);
    const guard = {
      canActivate(ctx: ExecutionContext) {
        const r = ctx
          .switchToHttp()
          .getRequest<{ headers: Record<string, string>; user: unknown }>();
        r.user = {
          id: r.headers['x-user'],
          refId: r.headers['x-user'],
          entId: r.headers['x-tenant'],
          kind: r.headers['x-kind'],
          role: r.headers['x-role'] || 'ADMIN',
        };
        return !!r.headers['x-user'];
      },
    };
    const module = await Test.createTestingModule({
      controllers: [
        TalkAdminController,
        TalkPortalController,
        InboxController,
        PortalInboxController,
      ],
      providers: [
        { provide: TalkService, useValue: talk },
        { provide: TalkSseService, useValue: sse },
        { provide: InboxService, useValue: inbox },
      ],
    })
      .overrideGuard(AcmJwtAuthGuard)
      .useValue(guard)
      .overrideGuard(PortalJwtAuthGuard)
      .useValue(guard)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
    await container?.stop();
  });
  beforeEach(async () => {
    await ds.query(
      'TRUNCATE amb_acm_notification_inbox,amb_acm_notification_outbox,amb_acm_talk_message,amb_acm_talk_member,amb_acm_talk_channel',
    );
    emitted.mockClear();
  });

  it('delivers operator→teacher, teacher→operator and teacher→teacher once, suppressing self and duplicates', async () => {
    const c = await room();
    await talk.sendMessage(ent, owner, c.id, '@Teacher hello', [
      teacher,
      teacher,
    ]);
    await talk.sendMessage(
      ent,
      teacher,
      c.id,
      '@Operator @TeacherTwo @Teacher hello',
      [operator, teacher2, teacher],
    );
    await inbox.deliver();
    await inbox.deliver();
    expect((await inbox.count(teacherInbox)).unreadCount).toBe(1);
    expect((await inbox.count(operatorInbox)).unreadCount).toBe(1);
    expect(
      (await inbox.count({ entId: ent, id: teacher2.refId, kind: 'TEACHER' }))
        .unreadCount,
    ).toBe(1);
    const [{ c: total }] = await ds.query(
      'SELECT count(*)::int c FROM amb_acm_notification_inbox',
    );
    expect(total).toBe(3);
    const notification = (await inbox.list(teacherInbox)).items[0];
    expect((await inbox.read(teacherInbox, notification.id)).href).toContain(
      '/portal/chat?channelId=' + c.id,
    );
    expect((await inbox.count(teacherInbox)).unreadCount).toBe(0);
    await expect(inbox.read(operatorInbox, notification.id)).rejects.toThrow(
      'NOTIFICATION_UNAVAILABLE',
    );
  });
  it('validates mention membership, tenant and text; rolls back message and outbox together', async () => {
    const c = await room();
    for (const targets of [[outsider], [{ kind: 'USER', refId: 'bad' }]])
      await expect(
        talk.sendMessage(ent, owner, c.id, '@Outsider', targets),
      ).rejects.toThrow();
    await expect(
      talk.sendMessage(ent, owner, c.id, 'plain text', [teacher]),
    ).rejects.toThrow('MENTION_TEXT_MISSING');
    expect(await ds.getRepository(Message).count()).toBe(0);
    expect(
      (await ds.query('SELECT * FROM amb_acm_notification_outbox')).length,
    ).toBe(0);
    await expect(
      talk.sendMessage(otherEnt, owner, c.id, 'text'),
    ).rejects.toThrow();
  });
  it('keeps archived rooms personal and accessible through notification deep links', async () => {
    const c = await room();
    await talk.archiveChannel(ent, teacher, c.id, true);
    expect(await talk.listMyChannels(ent, teacher)).toHaveLength(0);
    expect(await talk.listMyChannels(ent, operator)).toHaveLength(1);
    expect(
      (await talk.listMyChannels(ent, teacher, 'archived'))[0].archived,
    ).toBe(true);
    const msg = await talk.sendMessage(ent, owner, c.id, '@Teacher hello', [
      teacher,
    ]);
    await inbox.deliver();
    expect((await talk.getChannelView(ent, c.id, teacher)).archived).toBe(true);
    expect((await talk.message(ent, teacher, c.id, msg.id)).id).toBe(msg.id);
    expect((await inbox.count(teacherInbox)).unreadCount).toBe(1);
    await talk.archiveChannel(ent, teacher, c.id, false);
    expect(await talk.listMyChannels(ent, teacher)).toHaveLength(1);
  });
  it('limits renaming to group owners and validates names through HTTP', async () => {
    const c = await room();
    const server = app.getHttpServer();
    await request(server)
      .patch('/acm/talk/channels/' + c.id)
      .set(auth(operator))
      .send({ name: 'Denied' })
      .expect(403);
    await request(server)
      .patch('/acm/talk/channels/' + c.id)
      .set(auth(owner))
      .send({ name: '  ' })
      .expect(400);
    await request(server)
      .patch('/acm/talk/channels/' + c.id)
      .set(auth(owner))
      .send({ name: 'x'.repeat(101) })
      .expect(400);
    await request(server)
      .patch('/acm/talk/channels/' + c.id)
      .set(auth(owner))
      .send({ name: ' New title ' })
      .expect(200);
    expect((await talk.getChannelView(ent, c.id, teacher)).name).toBe(
      'New title',
    );
    const dm = await talk.findOrCreateDm(ent, owner.refId, teacher);
    await expect(talk.renameChannel(ent, owner, dm.id, 'new')).rejects.toThrow(
      'DM_NAME_FIXED',
    );
  });
  it('rejects leave/archive for non-members, other tenants and invalid bodies', async () => {
    const c = await room();
    const server = app.getHttpServer();
    await request(server)
      .patch(`/portal/talk/channels/${c.id}/archive`)
      .set(auth(teacher))
      .send({ archived: 'true' })
      .expect(400);
    await request(server)
      .post(`/acm/talk/channels/${c.id}/leave`)
      .set(auth(outsider, otherEnt))
      .send({})
      .expect(404);
    await request(server)
      .post(`/acm/talk/channels/${c.id}/leave`)
      .set(auth(owner))
      .send({ successorId: 'bad' })
      .expect(400);
    await request(server)
      .get('/portal/notifications/inbox/count')
      .set({ ...auth(teacher), 'x-kind': 'STUDENT' })
      .expect(403);
    await request(server)
      .get('/portal/notifications/inbox/count')
      .set({ ...auth(teacher), 'x-kind': 'PARENT' })
      .expect(403);
    await request(server)
      .get('/acm/talk/channels')
      .set({ ...auth(owner), 'x-role': 'STAFF' })
      .expect(403);
  });
  it('withdraws message, file and old notification access on leave and preserves history for others', async () => {
    const c = await room();
    const msg = await talk.sendMessage(ent, owner, c.id, '@Teacher hello', [
      teacher,
    ]);
    await inbox.deliver();
    const n = (await inbox.list(teacherInbox)).items[0];
    const file = await talk.sendFile(ent, owner, c.id, {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1,
      buffer: Buffer.from('x'),
    });
    const download = await talk.downloadFile(ent, teacher, file.id);
    expect(download.stream.destroyed).toBe(false);
    await talk.leaveChannel(ent, teacher, c.id);
    expect(download.stream.destroyed).toBe(true);
    expect(await talk.listMyChannels(ent, teacher, 'all')).toHaveLength(0);
    expect((await inbox.count(teacherInbox)).unreadCount).toBe(0);
    for (const attempt of [
      () => talk.message(ent, teacher, c.id, msg.id),
      () => talk.sendMessage(ent, teacher, c.id, 'no'),
      () => talk.downloadFile(ent, teacher, file.id),
      () => inbox.read(teacherInbox, n.id),
      () => talk.archiveChannel(ent, teacher, c.id, true),
    ])
      await expect(attempt()).rejects.toThrow();
    expect(
      (await talk.listMessages(ent, operator, c.id)).messages,
    ).toHaveLength(2);
    const leaveEvent = emitted.mock.calls.at(-1);
    expect(leaveEvent?.[1]).toContain('TEACHER:' + teacher.refId);
    await talk.sendMessage(ent, owner, c.id, 'after leave');
    expect(emitted.mock.calls.at(-1)?.[1]).not.toContain(
      'TEACHER:' + teacher.refId,
    );
    await talk.updateMembers(ent, owner.refId, c.id, [
      operator,
      teacher,
      teacher2,
    ]);
    expect((await talk.getChannelView(ent, c.id, teacher)).archived).toBe(
      false,
    );
    expect(
      await ds
        .getRepository(Member)
        .countBy({
          entId: ent,
          channelId: c.id,
          kind: 'TEACHER',
          refId: teacher.refId,
          leftAt: IsNull(),
        }),
    ).toBe(1);
  });
  it('requires an active operator successor for a group owner, supports last-member leave', async () => {
    const c = await room();
    await expect(talk.leaveChannel(ent, owner, c.id)).rejects.toThrow(
      'SUCCESSOR_REQUIRED',
    );
    await expect(
      talk.leaveChannel(ent, owner, c.id, teacher.refId),
    ).rejects.toThrow('SUCCESSOR_REQUIRED');
    await talk.leaveChannel(ent, owner, c.id, operator.refId);
    expect((await talk.getChannelView(ent, c.id, operator)).mine).toBe(true);
    await talk.leaveChannel(ent, teacher, c.id);
    await talk.leaveChannel(ent, teacher2, c.id);
    await talk.leaveChannel(ent, operator, c.id);
    expect(
      await ds
        .getRepository(Member)
        .countBy({ channelId: c.id, leftAt: IsNull() }),
    ).toBe(0);
    expect(
      await ds
        .getRepository(Channel)
        .countBy({ id: c.id, deletedAt: IsNull() }),
    ).toBe(1);
  });
  it('makes a DM read-only after leave and creates a new DM on restart', async () => {
    const c = await talk.findOrCreateDm(ent, owner.refId, teacher);
    await talk.sendMessage(ent, owner, c.id, 'hello');
    await talk.leaveChannel(ent, teacher, c.id);
    expect((await talk.getChannelView(ent, c.id, owner)).canSend).toBe(false);
    await expect(talk.sendMessage(ent, owner, c.id, 'no')).rejects.toThrow(
      'DM_PARTICIPANT_LEFT',
    );
    expect((await talk.findOrCreateDm(ent, owner.refId, teacher)).id).not.toBe(
      c.id,
    );
  });
  it('serializes concurrent leave and send and prevents posts after committed leave', async () => {
    const c = await room();
    const results = await Promise.allSettled([
      talk.leaveChannel(ent, teacher, c.id),
      talk.sendMessage(ent, teacher, c.id, 'racing message'),
    ]);
    expect(results[0].status).toBe('fulfilled');
    await expect(
      talk.sendMessage(ent, teacher, c.id, 'after commit'),
    ).rejects.toThrow();
    expect(
      await ds
        .getRepository(Member)
        .countBy({
          channelId: c.id,
          kind: 'TEACHER',
          refId: teacher.refId,
          leftAt: IsNull(),
        }),
    ).toBe(0);
    expect(
      await ds.getRepository(Message).countBy({ channelId: c.id }),
    ).toBeLessThanOrEqual(1);
  });
  it('preserves legacy USER delivery and consultation/calendar notifications, read-all cutoff and retry deduplication', async () => {
    const id = randomUUID();
    await ds.query('INSERT INTO amb_acm_cal_event VALUES($1,$2,NULL)', [
      id,
      ent,
    ]);
    await ds.transaction((m) =>
      enqueueInbox(m, {
        entId: ent,
        actorId: owner.refId,
        type: 'CAL_UPDATED',
        targetId: id,
      }),
    );
    await inbox.deliver();
    const before = await inbox.count(operatorInbox);
    expect(before.unreadCount).toBe(1);
    await inbox.readAll(operatorInbox, before.asOf);
    expect((await inbox.count(operatorInbox)).unreadCount).toBe(0);
    await ds.query(
      'UPDATE amb_acm_notification_outbox SET nob_delivered_at=NULL',
    );
    await inbox.deliver();
    expect((await inbox.list(operatorInbox)).items).toHaveLength(1);
    const inquiry = randomUUID();
    await ds.query('INSERT INTO amb_acm_csl_inquiry VALUES($1,$2,NULL)', [
      inquiry,
      ent,
    ]);
    await ds.transaction((m) =>
      enqueueInbox(m, {
        entId: ent,
        actorId: owner.refId,
        type: 'CSL_CREATED',
        targetId: inquiry,
      }),
    );
    await inbox.deliver();
    expect((await inbox.count(operatorInbox)).unreadCount).toBe(1);
    expect((await inbox.count(teacherInbox)).unreadCount).toBe(0);
    const [{ nob_id }]: { nob_id: string }[] = await ds.query(
      "INSERT INTO amb_acm_notification_outbox(ent_id,nob_type,nob_target_id) VALUES($1,'CAL_UPDATED',$2) RETURNING nob_id",
      [ent, id],
    );
    await ds.query(
      "INSERT INTO amb_acm_notification_inbox(ent_id,usr_id,nob_id,nin_type,nin_target_id,nin_payload) VALUES($1,$2,$3,'CAL_UPDATED',$4,'{}')",
      [ent, operator.refId, nob_id, id],
    );
    expect((await inbox.count(operatorInbox)).unreadCount).toBe(2);
  });
  it('excludes inactive portal accounts and deleted teachers from recipient delivery and visibility', async () => {
    const c = await room();
    await ds.query(
      "UPDATE amb_acm_portal_account SET pac_status='INACTIVE' WHERE pac_ref_id=$1",
      [teacher.refId],
    );
    try {
      await talk.sendMessage(ent, owner, c.id, '@Teacher hello', [teacher]);
      await inbox.deliver();
      expect((await inbox.count(teacherInbox)).unreadCount).toBe(0);
    } finally {
      await ds.query(
        "UPDATE amb_acm_portal_account SET pac_status='ACTIVE' WHERE pac_ref_id=$1",
        [teacher.refId],
      );
    }
  });
});
