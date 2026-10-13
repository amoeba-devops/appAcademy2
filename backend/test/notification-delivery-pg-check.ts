import { FeedbackMailerService } from '../src/modules/acm-cal/application/feedback-mailer.service';
import { CalEventReviewTypeormEntity } from '../src/modules/acm-cal/infrastructure/typeorm/cal-event-review.typeorm-entity';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { InboxService } from '../src/modules/acm-notification/application/inbox.service';
import { ReviewReminderService } from '../src/modules/acm-notification/application/review-reminder.service';
import { TalkService } from '../src/modules/acm-talk/application/talk.service';
import { TalkChannelTypeormEntity as Channel } from '../src/modules/acm-talk/infrastructure/typeorm/talk-channel.typeorm-entity';
import { TalkMemberTypeormEntity as Member } from '../src/modules/acm-talk/infrastructure/typeorm/talk-member.typeorm-entity';
import { TalkMessageTypeormEntity as Message } from '../src/modules/acm-talk/infrastructure/typeorm/talk-message.typeorm-entity';
async function main() {
  const database =
    process.env.ACM_LIFECYCLE_TEST_DB ??
    'acm_lifecycle_test_notifications_261013';
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
    readFileSync('../sql/acm/1030-notification-delivery.sql', 'utf8'),
  );
  const ent = randomUUID(),
    admin = randomUUID(),
    sender = randomUUID(),
    teacher = randomUUID(),
    outsider = randomUUID();
  const inbox = new InboxService(ds),
    job = new ReviewReminderService(ds);
  const [rollout] = await ds.query(
    "SELECT created_at FROM amb_acm_notification_rollout WHERE nrl_id='review-reminders'",
  );
  const count = async (type: string) =>
    Number(
      (
        await ds.query(
          'SELECT count(*) FROM amb_acm_notification_outbox WHERE ent_id=$1 AND nob_type=$2',
          [ent, type],
        )
      )[0].count,
    );
  try {
    for (const id of [admin, sender])
      await ds.query(
        "INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_name,usr_role,usr_status) VALUES($1,$2,$3,'Test admin','ADMIN','ACTIVE')",
        [id, ent, id + '@example.invalid'],
      );
    for (const id of [teacher, outsider]) {
      await ds.query(
        "INSERT INTO amb_acm_tch_teacher(tch_id,ent_id,tch_name) VALUES($1,$2,'Test teacher')",
        [id, ent],
      );
      await ds.query(
        "INSERT INTO amb_acm_portal_account(ent_id,pac_kind,pac_ref_id,pac_login_id,pac_password_hash,pac_status) VALUES($1,'TEACHER',$2,$3,'not-a-real-login','ACTIVE')",
        [ent, id, id + '@example.invalid'],
      );
    }
    await ds.query(
      "UPDATE amb_acm_notification_rollout SET created_at=now()-interval '2 days' WHERE nrl_id='review-reminders'",
    );
    const create = async (hours: number, category = 'REGULAR_CLASS') => {
      const id = randomUUID();
      await ds.query(
        `INSERT INTO amb_acm_cal_event(evt_id,ent_id,evt_owner_user_id,evt_title,evt_category,evt_start_at,evt_end_at,evt_assignee_tch_id) VALUES($1,$2,$3,'Test lesson',$6,now()-($4::numeric+1)*interval '1 hour',now()-$4::numeric*interval '1 hour',$5)`,
        [id, ent, admin, hours, teacher, category],
      );
      return id;
    };
    const before = await create(4.99),
      five = await create(5.01),
      ten = await create(10.01),
      done = await create(5.02),
      personal = await create(12, 'OTHER');
    await ds.query(
      "INSERT INTO amb_acm_cal_event_review(ent_id,evt_id,rvw_feedback_html,rvw_homework_status) VALUES($1,$2,'<p>Good work</p>','NONE')",
      [ent, done],
    );
    await Promise.all([job.sweep(), job.sweep()]);
    assert.equal(
      await count('REVIEW_OVERDUE'),
      2,
      '5h and 10h each once, no early or completed/nonclass notices',
    );
    await inbox.deliver();
    const a = { entId: ent, id: admin },
      t = { entId: ent, id: teacher, kind: 'TEACHER' as const };
    assert.equal((await inbox.count(a)).unreadCount, 2);
    assert.equal((await inbox.count(t)).unreadCount, 2);
    assert.equal((await inbox.count({ ...t, id: outsider })).unreadCount, 0);
    const item = (await inbox.list(t)).items.find((i) => i.targetId === five)!;
    assert(
      (await inbox.read(t, item.id)).href === `/portal/calendar/${five}#review`,
    );
    await ds.query(
      "INSERT INTO amb_acm_cal_event_review(ent_id,evt_id,rvw_feedback_html,rvw_homework_status) VALUES($1,$2,'<p>Complete</p>','NONE')",
      [ent, five],
    );
    await ds.query(
      "UPDATE amb_acm_cal_event SET evt_start_at=now()-interval '12 hours',evt_end_at=now()-interval '11 hours' WHERE evt_id=$1",
      [five],
    );
    await job.sweep();
    assert.equal(
      await count('REVIEW_OVERDUE'),
      2,
      'completion stops 10h notice',
    );
    await ds.query(
      "UPDATE amb_acm_cal_event SET evt_start_at=now()-interval '7 hours',evt_end_at=now()-interval '6 hours' WHERE evt_id=$1",
      [before],
    );
    await job.sweep();
    assert.equal(await count('REVIEW_OVERDUE'), 3);
    await ds.query(
      "UPDATE amb_acm_cal_event SET evt_start_at=now()-interval '12 hours',evt_end_at=now()-interval '11 hours' WHERE evt_id=$1",
      [before],
    );
    await job.sweep();
    await job.sweep();
    assert.equal(
      await count('REVIEW_OVERDUE'),
      4,
      '10h second notification exactly once',
    );
    const completedNotification = (await inbox.list(a)).items.find(
      (i) => i.targetId === five,
    )!;
    assert.equal(
      await inbox.unreadItem(a, completedNotification.id),
      undefined,
      'completed review must not receive a delayed push',
    );
    const mail = Object.create(
      FeedbackMailerService.prototype,
    ) as FeedbackMailerService;
    let sent = 0;
    Object.assign(mail, {
      ds,
      reviews: ds.getRepository(CalEventReviewTypeormEntity),
      sendFeedbackEmail: async () => {
        sent++;
        return { results: [] };
      },
    });
    const saved = await ds
      .getRepository(CalEventReviewTypeormEntity)
      .findOneByOrFail({ entId: ent, evtId: done });
    const request = {
      recipients: [{ stdId: randomUUID(), parId: randomUUID() }],
      requestId: randomUUID(),
      expectedUpdatedAt: saved.updatedAt.toISOString(),
    };
    await mail.sendForTeacher(ent, done, teacher, request);
    await mail.sendForTeacher(ent, done, teacher, request);
    assert.equal(sent, 1, 'idempotent teacher mail claim');
    const [audit] = await ds.query(
      'SELECT cfs_content_hash,cfs_recipients FROM amb_acm_cal_feedback_send WHERE ent_id=$1',
      [ent],
    );
    assert.equal(audit.cfs_content_hash.length, 64);
    assert.equal(audit.cfs_recipients.length, 1);
    const channel = randomUUID();
    await ds.query(
      "INSERT INTO amb_acm_talk_channel(tlc_id,ent_id,tlc_type,tlc_name,tlc_created_by) VALUES($1,$2,'GROUP','Test group',$3)",
      [channel, ent, sender],
    );
    for (const id of [admin, sender])
      await ds.query(
        "INSERT INTO amb_acm_talk_member(ent_id,tlc_id,tlm_kind,tlm_ref_id) VALUES($1,$2,'USER',$3)",
        [ent, channel, id],
      );
    const talk = new TalkService(
      ds.getRepository(Channel),
      ds.getRepository(Member),
      ds.getRepository(Message),
      ds,
      {} as never,
      { emit: () => {} } as never,
    );
    const actor = { kind: 'USER' as const, refId: sender },
      reader = { kind: 'USER' as const, refId: admin };
    const first = await talk.sendMessage(ent, actor, channel, 'first');
    const second = await talk.sendMessage(ent, actor, channel, 'second');
    await talk.markRead(ent, reader, channel, first.id);
    await inbox.deliver();
    const unread = await ds.query(
      "SELECT nin_target_id FROM amb_acm_notification_inbox WHERE ent_id=$1 AND usr_id=$2 AND nin_type='CHAT_MESSAGE' AND nin_read_at IS NULL",
      [ent, admin],
    );
    assert.deepEqual(
      unread.map((x: { nin_target_id: string }) => x.nin_target_id),
      [second.id],
      'read boundary preserves later unseen message even before delivery',
    );
    await talk.markRead(ent, reader, channel, second.id);
    await talk.markRead(ent, reader, channel, first.id);
    assert.equal(
      (await talk.listMyChannels(ent, reader)).find((x) => x.id === channel)
        ?.unreadCount,
      0,
      'read pointer never goes backwards',
    );
    console.log(
      'PASS: 5h/10h boundaries, no-review handling, completion, nonclass exclusion, dedup, teacher access/deep link, late delivery/read race, monotonic read boundary',
    );
  } finally {
    await ds.query(
      "UPDATE amb_acm_notification_rollout SET created_at=$1 WHERE nrl_id='review-reminders'",
      [rollout.created_at],
    );
    for (const table of [
      'amb_acm_notification_inbox',
      'amb_acm_notification_outbox',
      'amb_acm_cal_review_reminder',
      'amb_acm_cal_feedback_send',
      'amb_acm_cal_event_review',
      'amb_acm_cal_event',
      'amb_acm_talk_message',
      'amb_acm_talk_member',
      'amb_acm_talk_channel',
      'amb_acm_portal_account',
      'amb_acm_tch_teacher',
      'amb_acm_user',
    ])
      await ds.query(`DELETE FROM ${table} WHERE ent_id=$1`, [ent]);
    await ds.destroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
