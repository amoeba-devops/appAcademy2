import { InquiryService } from '../src/modules/acm-csl/application/inquiry.service';
import { InquiryTypeormEntity as Inquiry } from '../src/modules/acm-csl/infrastructure/typeorm/inquiry.typeorm-entity';
import { TransitionTypeormEntity as Transition } from '../src/modules/acm-csl/infrastructure/typeorm/transition.typeorm-entity';
import { CalEventService } from '../src/modules/acm-cal/application/cal-event.service';
import { CalEventTypeormEntity as CalEvent } from '../src/modules/acm-cal/infrastructure/typeorm/cal-event.typeorm-entity';
import { CalEventRevisionTypeormEntity as Revision } from '../src/modules/acm-cal/infrastructure/typeorm/cal-event-revision.typeorm-entity';
import { AcmUserTypeormEntity as User } from '../src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { InboxService } from '../src/modules/acm-notification/application/inbox.service';
import { enqueueInbox } from '../src/modules/acm-notification/application/inbox-outbox';
import { TalkService } from '../src/modules/acm-talk/application/talk.service';
import { TalkChannelTypeormEntity as Channel } from '../src/modules/acm-talk/infrastructure/typeorm/talk-channel.typeorm-entity';
import { TalkMemberTypeormEntity as Member } from '../src/modules/acm-talk/infrastructure/typeorm/talk-member.typeorm-entity';
import { TalkMessageTypeormEntity as Message } from '../src/modules/acm-talk/infrastructure/typeorm/talk-message.typeorm-entity';
config({ path: process.env.ACM_TEST_ENV_FILE ?? '.env', quiet: true });
async function main() {
  const database =
    process.env.ACM_LIFECYCLE_TEST_DB ?? 'acm_lifecycle_test_260929';
  assert(database.startsWith('acm_lifecycle_test_'));
  const ds = new DataSource({
    type: 'postgres',
    host: '127.0.0.1',
    port: 5434,
    username: process.env.ACM_PG_USER || 'acm',
    password: process.env.ACM_PG_PASSWORD || 'acm',
    database,
    entities: [__dirname + '/../src/modules/**/*.typeorm-entity.ts'],
  });
  await ds.initialize();
  await ds.query(
    readFileSync('../sql/acm/1025-notification-inbox.sql', 'utf8'),
  );
  const ent = randomUUID(),
    other = randomUUID(),
    actor = randomUUID(),
    user = randomUUID(),
    staff = randomUUID(),
    outsider = randomUUID(),
    inq = randomUUID(),
    evt = randomUUID(),
    channel = randomUUID();
  const u = { entId: ent, id: user, role: 'ADMIN' as const },
    sender = { kind: 'USER' as const, refId: actor };
  const inbox = new InboxService(ds),
    talk = new TalkService(
      ds.getRepository(Channel),
      ds.getRepository(Member),
      ds.getRepository(Message),
      ds,
      {} as never,
      { emit: () => {} } as never,
    );
  const queue = () =>
    ds.transaction((m) =>
      enqueueInbox(m, {
        entId: ent,
        actorId: actor,
        type: 'CAL_UPDATED',
        targetId: evt,
      }),
    );
  try {
    for (const [id, tenant, role, name] of [
      [actor, ent, 'ADMIN', 'Sender'],
      [user, ent, 'ADMIN', 'Recipient'],
      [staff, ent, 'STAFF', 'Staff'],
      [outsider, other, 'ADMIN', 'Outsider'],
    ])
      await ds.query(
        "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_role,usr_status) VALUES($1,$2,$3,$4,$5,'ACTIVE')",
        [id, tenant, id + '@example.invalid', name, role],
      );
    await ds.query(
      "INSERT INTO amb_acm_csl_inquiry(inq_id,ent_id,inq_seq_no,inq_name_encrypted,inq_name_iv,inq_name_auth_tag,inq_inflow_type,inq_apply_type,school_freetext) VALUES($1,$2,1,$3,$3,$3,'PHONE','BOTH','Test school')",
      [inq, ent, Buffer.from('test')],
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_event(evt_id,ent_id,evt_owner_user_id,evt_title,evt_start_at,evt_end_at) VALUES($1,$2,$3,'Test',now(),now()+interval '1 hour')",
      [evt, ent, actor],
    );
    await assert.rejects(
      ds.transaction(async (m) => {
        await enqueueInbox(m, {
          entId: ent,
          actorId: actor,
          type: 'CSL_CREATED',
          targetId: inq,
        });
        throw Error('rollback');
      }),
    );
    await inbox.deliver();
    assert.equal((await inbox.count(u)).unreadCount, 0);
    for (const type of [
      'CSL_CREATED',
      'CSL_STAGE',
      'CAL_CREATED',
      'CAL_UPDATED',
    ] as const)
      await ds.transaction((m) =>
        enqueueInbox(m, {
          entId: ent,
          actorId: actor,
          type,
          targetId: type.startsWith('CSL') ? inq : evt,
        }),
      );
    await Promise.all([inbox.deliver(), inbox.deliver()]);
    await inbox.deliver();
    assert.equal((await inbox.count(u)).unreadCount, 4);
    assert.equal((await inbox.count({ ...u, id: actor })).unreadCount, 0);
    assert.equal(
      (await inbox.count({ entId: other, id: outsider })).unreadCount,
      0,
    );
    assert.equal((await inbox.count({ ...u, id: staff })).unreadCount, 4);
    let page = await inbox.list(u);
    const first = page.items[0];
    await assert.rejects(inbox.read({ ...u, id: actor }, first.id));
    await assert.rejects(inbox.read({ entId: other, id: outsider }, first.id));
    assert((await inbox.read(u, first.id)).href.startsWith('/admin/'));
    assert.equal((await inbox.count(u)).unreadCount, 3);
    const cutoff = page.asOf;
    await queue();
    await inbox.deliver();
    await inbox.readAll(u, cutoff);
    assert.equal((await inbox.count(u)).unreadCount, 1);
    await ds.query(
      'UPDATE amb_acm_cal_event SET deleted_at=now() WHERE evt_id=$1',
      [evt],
    );
    assert.equal((await inbox.count(u)).unreadCount, 0);
    await ds.query(
      'UPDATE amb_acm_cal_event SET deleted_at=NULL WHERE evt_id=$1',
      [evt],
    );
    for (let n = 0; n < 24; n++) await queue();
    await inbox.deliver();
    page = await inbox.list(u);
    assert.equal(page.items.length, 20);
    assert(page.nextCursor);
    const next = await inbox.list(u, page.nextCursor);
    assert.equal(next.items.length, 9);
    assert(!next.items.some((x) => page.items.some((y) => y.id === x.id)));
    await assert.rejects(inbox.list(u, 'not-a-cursor'));
    await ds.query(
      "INSERT INTO amb_acm_talk_channel(tlc_id,ent_id,tlc_type,tlc_name,tlc_created_by) VALUES($1,$2,'GROUP','Test room',$3)",
      [channel, ent, actor],
    );
    for (const id of [actor, user])
      await ds.query(
        "INSERT INTO amb_acm_talk_member(ent_id,tlc_id,tlm_kind,tlm_ref_id,tlm_role) VALUES($1,$2,'USER',$3,'MEMBER')",
        [ent, channel, id],
      );
    const before = (await inbox.count(u)).unreadCount;
    await assert.rejects(
      talk.sendMessage(ent, sender, channel, '@Outsider hello', [
        { kind: 'USER', refId: outsider },
      ]),
    );
    await assert.rejects(
      talk.sendMessage(ent, sender, channel, 'no mention', [
        { kind: 'USER', refId: user },
      ]),
    );
    await assert.rejects(
      talk.sendMessage(ent, sender, channel, 'hello', [
        { kind: 'USER', refId: 'bad' },
      ]),
    );
    const msg = await talk.sendMessage(
      ent,
      sender,
      channel,
      '@Recipient hello',
      [
        { kind: 'USER', refId: user },
        { kind: 'USER', refId: user },
      ],
    );
    assert.equal(msg.mentions.length, 1);
    await inbox.deliver();
    assert.equal((await inbox.count(u)).unreadCount, before + 1);
    const notification = (await inbox.list(u)).items.find(
      (x) => x.type === 'CHAT_MENTION',
    )!;
    assert(
      (await inbox.read(u, notification.id)).href.includes(
        'messageId=' + msg.id,
      ),
    );
    assert.equal(
      (await talk.message(ent, { kind: 'USER', refId: user }, channel, msg.id))
        .id,
      msg.id,
    );
    await talk.sendMessage(ent, sender, channel, '@Sender self', [
      { kind: 'USER', refId: actor },
    ]);
    await inbox.deliver();
    assert.equal((await inbox.count({ ...u, id: actor })).unreadCount, 0);
    await ds.query(
      'UPDATE amb_acm_talk_member SET tlm_left_at=now() WHERE ent_id=$1 AND tlm_ref_id=$2',
      [ent, user],
    );
    await assert.rejects(inbox.read(u, notification.id));
    await assert.rejects(
      talk.message(ent, { kind: 'USER', refId: user }, channel, msg.id),
    );
    await ds.query(
      "UPDATE amb_acm_user SET usr_status='INACTIVE' WHERE usr_id=$1",
      [user],
    );
    assert.equal((await inbox.list(u)).items.length, 0);
    const cal = Object.create(CalEventService.prototype) as CalEventService;
    Object.assign(cal, {
      toDetail: (e: CalEvent) => ({ id: e.id }),
      repo: ds.getRepository(CalEvent),
      revisionRepo: ds.getRepository(Revision),
      userRepo: ds.getRepository(User),
      video: {
        withLock: async (_ent: string, work: () => Promise<unknown>) => work(),
        get: async () => ({ provider: 'BODASCHOOL', bodaEnabled: true }),
        assertBoda: async () => {},
      },
      inviteeSvc: {
        assertSameTenant: async () => {},
        listForEvent: async () => [],
      },
      bodaRoomSvc: {
        createPending: async () => {
          throw Error('simulated room failure');
        },
      },
    });
    const outboxCount = async () =>
      Number(
        (
          await ds.query(
            'SELECT count(*) AS n FROM amb_acm_notification_outbox WHERE ent_id=$1',
            [ent],
          )
        )[0].n,
      );
    const eventCount = async () =>
      Number(
        (
          await ds.query(
            'SELECT count(*) AS n FROM amb_acm_cal_event WHERE ent_id=$1',
            [ent],
          )
        )[0].n,
      );
    const countBefore = await outboxCount();
    const created = await cal.create(ent, actor, 'ADMIN', {
      evtTitle: 'Service event',
      evtCategory: 'OTHER',
      evtMeetingProvider: 'NONE',
      evtStartAt: '2030-01-01T01:00:00Z',
      evtEndAt: '2030-01-01T02:00:00Z',
    });
    assert.equal(
      await outboxCount(),
      countBefore + 1,
      'create service emits transactionally',
    );
    await cal.update(ent, actor, 'ADMIN', created.id, {
      evtTitle: 'Service event',
      evtEditReason: 'unchanged',
    });
    assert.equal(await outboxCount(), countBefore + 1, 'no-op update excluded');
    await cal.update(ent, actor, 'ADMIN', created.id, {
      evtTitle: 'Updated event',
      evtEditReason: 'changed',
    });
    assert.equal(
      await outboxCount(),
      countBefore + 2,
      'update service emits transactionally',
    );
    const eventsBefore = await eventCount();
    await assert.rejects(
      cal.create(ent, actor, 'ADMIN', {
        evtTitle: 'Failed room',
        evtCategory: 'OTHER',
        evtMeetingProvider: 'BODASCHOOL',
        evtStartAt: '2030-01-01T01:00:00Z',
        evtEndAt: '2030-01-01T02:00:00Z',
      }),
    );
    assert.equal(
      await eventCount(),
      eventsBefore,
      'failed room rolls back event',
    );
    assert.equal(
      await outboxCount(),
      countBefore + 2,
      'failed room leaves no notification',
    );
    const csl=Object.create(InquiryService.prototype) as InquiryService;
    Object.assign(csl,{ds,inq:ds.getRepository(Inquiry),transitions:ds.getRepository(Transition),events:{emit:()=>{}},
      crypto:{encrypt:(v:string)=>({ciphertext:Buffer.from(v),iv:Buffer.alloc(12),authTag:Buffer.alloc(16)}),decrypt:()=>''},
      tenantSettings:{getTimezone:async()=> 'Asia/Seoul'},toView:(e:Inquiry)=>({id:e.id})});
    const cslBefore=await outboxCount();
    const consultation=await csl.create(ent,{studentName:'Synthetic student',inflowType:'PHONE',applyType:'BOTH',schoolFreetext:'Test school'},actor);
    assert.equal(await outboxCount(),cslBefore+1,'consultation creation queues notification');
    await csl.applyTransition(ent,await csl.getOrThrow(ent,consultation.id),'DROPPED','CANCEL','OTHER','test',actor);
    assert.equal(await outboxCount(),cslBefore+2,'consultation state change queues notification');
    const failing=Object.create(InquiryService.prototype) as InquiryService;
    Object.assign(failing,{ds,inq:ds.getRepository(Inquiry),transitions:{create:()=>{throw Error('simulated audit write failure');}},events:{emit:()=>{}}});
    await assert.rejects(failing.applyTransition(ent,await csl.getOrThrow(ent,consultation.id),'INTAKE','REACTIVATE',undefined,undefined,actor));
    assert.equal((await csl.getOrThrow(ent,consultation.id)).currentStage,'DROPPED','failed transition rolls back state');
    assert.equal(await outboxCount(),cslBefore+2,'failed transition leaves no notification');
    console.log(
      'PASS: rollback, 5 event types, tenant/recipient isolation, delivery concurrency/deduplication, read ownership/cutoff, pagination, deletion, mentions/deep links, self exclusion, membership revocation',
    );
  } finally {
    for (const t of [
      'amb_acm_notification_inbox',
      'amb_acm_notification_outbox',
      'amb_acm_talk_message',
      'amb_acm_talk_member',
      'amb_acm_talk_channel',
      'amb_acm_cal_event_revision',
      'amb_acm_cal_event',
      'amb_acm_csl_transition',
      'amb_acm_csl_inquiry',
      'amb_acm_user',
    ])
      await ds.query(`DELETE FROM ${t} WHERE ent_id=ANY($1::uuid[])`, [
        [ent, other],
      ]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
